from __future__ import annotations

import html
import os
import sqlite3
import threading
import time
import webbrowser
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urlparse

from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string


ORDLISTE_SHEET_CANDIDATES = ["Ordliste", "AlleOrd", "Kolonner"]
SEARCH_SHEET_CANDIDATES = ["SearchWords", "test"]
SEARCH_CELL = "D3"
COLUMN_START = "A"
COLUMN_END = "AC"
DB_PATH = Path(__file__).with_name("ordliste_cache.sqlite3")
HOST = "127.0.0.1"
PORT = 8765
UI_VERSION = "v2026-03-22-wildcards"
DEFAULT_SAMPLE_LIMIT = 200


def resolve_excel_path() -> Path:
    env_path = os.environ.get("ORDLISTE_XLSM")
    candidates = [
        Path(env_path) if env_path else None,
        # Prøv nye filer fra samlet mappe først
        Path.cwd() / "G-Ordliste Norsk.xlsm",
        Path.cwd() / "G-Ordliste.xlsm",
        Path.cwd() / "Ordliste Norsk v. 30.6.xlsm",
        Path.cwd() / "Ordlista HovedFil.xlsm",
        Path.cwd() / "Ordliste Norsk.xlsm",
        # Originale OneDrive-steder
        Path(r"C:\Users\ØyvindGranberg\OneDrive\Dokumenter\Annet\Ordlista HovedFil.xlsm"),
        Path(r"C:\Users\ØyvindGranberg\OneDrive\Dokumenter\Annet\Ordliste Norsk.xlsm"),
    ]

    valid_candidates = [path for path in candidates if path is not None]
    for candidate in valid_candidates:
        if candidate.is_file():
            return candidate

    # Fallback to the first candidate so the error message points to a concrete path.
    return valid_candidates[0]


EXCEL_PATH = resolve_excel_path()


def normalize_word(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    return " ".join(text.split())


def wildcard_to_sql_like(pattern: str) -> str:
    translated: list[str] = []
    for char in pattern:
        if char == "*":
            translated.append("%")
        elif char == "?":
            translated.append("_")
        elif char in {"%", "_", "\\"}:
            translated.append("\\" + char)
        else:
            translated.append(char)
    return "".join(translated)


def find_edge_executable() -> Path | None:
    candidates = [
        Path(os.environ.get("ProgramFiles(x86)", "")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(os.environ.get("ProgramFiles", "")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        Path(os.environ.get("LocalAppData", "")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


@dataclass
class SearchResult:
    query: str
    normalized_query: str
    found: bool
    wildcard_used: bool
    match_count: int
    sample_matches: list[str]
    sample_limit: int
    total_words: int
    source: str
    indexed_at: str | None
    message: str


class WordIndex:
    def __init__(self, excel_path: Path, db_path: Path) -> None:
        self.excel_path = excel_path
        self.db_path = db_path
        self._lock = threading.Lock()
        self.active_word_sheet: str | None = None
        self.active_search_sheet: str | None = None
        self._ensure_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=NORMAL")
        return connection

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS words (
                    word TEXT PRIMARY KEY
                )
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)")

    def _get_metadata(self, key: str) -> str | None:
        with self._connect() as connection:
            row = connection.execute("SELECT value FROM metadata WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def _set_metadata(self, key: str, value: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO metadata(key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )

    @staticmethod
    def _get_sheet_from_candidates_or_raise(workbook, candidates: list[str], label: str):
        normalized_map = {name.strip().casefold(): name for name in workbook.sheetnames}
        for candidate in candidates:
            key = candidate.strip().casefold()
            if key in normalized_map:
                return workbook[normalized_map[key]], normalized_map[key]

        available = ", ".join(workbook.sheetnames)
        wanted = ", ".join(candidates)
        raise KeyError(
            f"Fant ikke {label}. Prøvde: {wanted}. Tilgjengelige ark: {available}"
        )

    def _iter_words_from_workbook(self) -> Iterable[str]:
        workbook = load_workbook(
            self.excel_path,
            read_only=True,
            data_only=True,
            keep_vba=True,
            keep_links=False,
        )
        try:
            sheet, actual_name = self._get_sheet_from_candidates_or_raise(
                workbook,
                ORDLISTE_SHEET_CANDIDATES,
                "ordliste-ark",
            )
            self.active_word_sheet = actual_name
            min_column = column_index_from_string(COLUMN_START)
            max_column = column_index_from_string(COLUMN_END)
            for row_values in sheet.iter_rows(min_col=min_column, max_col=max_column, values_only=True):
                for cell_value in row_values:
                    word = normalize_word(cell_value)
                    if word:
                        yield word
        finally:
            workbook.close()

    def rebuild_if_needed(self) -> bool:
        if not self.excel_path.is_file():
            raise FileNotFoundError(f"Fant ikke Excel-filen: {self.excel_path}")

        stat = self.excel_path.stat()
        signature = f"{stat.st_mtime_ns}:{stat.st_size}"
        cached_signature = self._get_metadata("excel_signature")
        if cached_signature == signature:
            return False

        with self._lock:
            cached_signature = self._get_metadata("excel_signature")
            if cached_signature == signature:
                return False

            print("Bygger indeks fra Excel ...")
            start_time = time.perf_counter()
            indexed_at = time.strftime("%Y-%m-%d %H:%M:%S")
            scanned = 0
            batch: list[tuple[str]] = []
            batch_size = 10000

            with self._connect() as connection:
                connection.execute("DELETE FROM words")

                for word in self._iter_words_from_workbook():
                    scanned += 1
                    batch.append((word,))
                    if len(batch) >= batch_size:
                        connection.executemany("INSERT OR IGNORE INTO words(word) VALUES (?)", batch)
                        batch.clear()
                    if scanned % 250000 == 0:
                        print(f"  Leste {scanned:,} celler ...".replace(",", " "))

                if batch:
                    connection.executemany("INSERT OR IGNORE INTO words(word) VALUES (?)", batch)

                unique_count = connection.execute("SELECT COUNT(*) FROM words").fetchone()[0]
                connection.execute(
                    "INSERT INTO metadata(key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    ("excel_signature", signature),
                )
                connection.execute(
                    "INSERT INTO metadata(key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    ("indexed_at", indexed_at),
                )
                connection.execute(
                    "INSERT INTO metadata(key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    ("word_count", str(unique_count)),
                )

            elapsed = time.perf_counter() - start_time
            print(
                (
                    f"Indeks ferdig. Leste {scanned:,} celler, "
                    f"{unique_count:,} unike ord, tid {elapsed:.1f}s"
                ).replace(",", " ")
            )

        return True

    def count_words(self) -> int:
        cached = self._get_metadata("word_count")
        return int(cached) if cached else 0

    def indexed_at(self) -> str | None:
        return self._get_metadata("indexed_at")

    def contains(self, query: str) -> bool:
        normalized = normalize_word(query)
        if not normalized:
            return False
        with self._connect() as connection:
            row = connection.execute("SELECT 1 FROM words WHERE word = ? LIMIT 1", (normalized,)).fetchone()
        return row is not None

    def find_wildcard_matches(self, query: str, limit: int = 50) -> tuple[int, list[str]]:
        normalized = normalize_word(query)
        if not normalized:
            return 0, []

        like_pattern = wildcard_to_sql_like(normalized)
        with self._connect() as connection:
            count_row = connection.execute(
                "SELECT COUNT(*) FROM words WHERE word LIKE ? ESCAPE '\\'",
                (like_pattern,),
            ).fetchone()
            if limit <= 0:
                sample_rows = connection.execute(
                    "SELECT word FROM words WHERE word LIKE ? ESCAPE '\\' ORDER BY word",
                    (like_pattern,),
                ).fetchall()
            else:
                sample_rows = connection.execute(
                    "SELECT word FROM words WHERE word LIKE ? ESCAPE '\\' ORDER BY word LIMIT ?",
                    (like_pattern, limit),
                ).fetchall()

        total = int(count_row[0]) if count_row else 0
        samples = [row[0] for row in sample_rows]
        return total, samples

    def read_search_cell(self) -> str:
        workbook = load_workbook(
            self.excel_path,
            read_only=True,
            data_only=True,
            keep_vba=True,
            keep_links=False,
        )
        try:
            sheet, actual_name = self._get_sheet_from_candidates_or_raise(
                workbook,
                SEARCH_SHEET_CANDIDATES,
                "søkeark",
            )
            self.active_search_sheet = actual_name
            value = sheet[SEARCH_CELL].value
            return "" if value is None else str(value)
        finally:
            workbook.close()


class SearchApp:
    def __init__(self, index: WordIndex) -> None:
        self.index = index

    def make_result(self, query: str, source: str, sample_limit: int = DEFAULT_SAMPLE_LIMIT) -> SearchResult:
        try:
            rebuilt = self.index.rebuild_if_needed()
        except Exception as exc:
            return SearchResult(
                query=query,
                normalized_query=normalize_word(query),
                found=False,
                wildcard_used=False,
                match_count=0,
                sample_matches=[],
                sample_limit=sample_limit,
                total_words=self.index.count_words(),
                source=source,
                indexed_at=self.index.indexed_at(),
                message=f"Klarte ikke lese Excel-filen: {exc}",
            )

        normalized = normalize_word(query)
        if not normalized:
            return SearchResult(
                query=query,
                normalized_query=normalized,
                found=False,
                wildcard_used=False,
                match_count=0,
                sample_matches=[],
                sample_limit=sample_limit,
                total_words=self.index.count_words(),
                source=source,
                indexed_at=self.index.indexed_at(),
                message="Ingen verdi å søke etter.",
            )

        wildcard_used = "*" in normalized or "?" in normalized
        if wildcard_used:
            match_count, sample_matches = self.index.find_wildcard_matches(query, limit=sample_limit)
            found = match_count > 0
            if found:
                message = f"Wildcard-sok ga {match_count:,} treff.".replace(",", " ")
            else:
                message = "Wildcard-sok ga ingen treff."
        else:
            found = self.index.contains(query)
            match_count = 1 if found else 0
            sample_matches = [normalized] if found else []
            if found:
                message = "Treff i ordlisten."
            else:
                message = "Ingen eksakt treff i ordlisten."

        if rebuilt:
            message += " Indeksen ble oppdatert fra Excel-filen."

        return SearchResult(
            query=query,
            normalized_query=normalized,
            found=found,
            wildcard_used=wildcard_used,
            match_count=match_count,
            sample_matches=sample_matches,
            sample_limit=sample_limit,
            total_words=self.index.count_words(),
            source=source,
            indexed_at=self.index.indexed_at(),
            message=message,
        )

    def render_page(self, result: SearchResult) -> str:
        status_class = "found" if result.found else "missing"
        status_label = "FUNNET" if result.found else "IKKE FUNNET"
        safe_query = html.escape(result.query)
        safe_normalized = html.escape(result.normalized_query)
        safe_message = html.escape(result.message)
        safe_samples = "".join(f"<li>{html.escape(item)}</li>" for item in result.sample_matches)
        indexed_at = html.escape(result.indexed_at or "ikke bygget ennå")
        source = html.escape(result.source)
        total_words = f"{result.total_words:,}".replace(",", " ")
        match_count = f"{result.match_count:,}".replace(",", " ")
        sample_limit = "alle" if result.sample_limit == 0 else f"{result.sample_limit:,}".replace(",", " ")
        return f"""<!doctype html>
<html lang=\"no\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>Ordliste-søk</title>
  <style>
    :root {{
      --bg: #f7f3ea;
      --panel: rgba(255,255,255,0.88);
      --text: #1c1a17;
      --muted: #665f53;
      --accent: #0d5c63;
      --accent-2: #d1495b;
      --ok: #1f7a4d;
      --warn: #ad2e24;
      --shadow: 0 24px 80px rgba(30, 24, 14, 0.12);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: Georgia, 'Times New Roman', serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(13,92,99,0.16), transparent 38%),
        radial-gradient(circle at top right, rgba(209,73,91,0.18), transparent 28%),
        linear-gradient(180deg, #f9f6ef 0%, #efe8dc 100%);
      display: grid;
      place-items: center;
      padding: 32px;
    }}
    .card {{
      width: min(920px, 100%);
      background: var(--panel);
      border: 1px solid rgba(28,26,23,0.08);
      border-radius: 28px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      overflow: hidden;
    }}
    .hero {{
      padding: 32px 32px 20px;
      background: linear-gradient(135deg, rgba(13,92,99,0.10), rgba(209,73,91,0.08));
      border-bottom: 1px solid rgba(28,26,23,0.08);
    }}
    h1 {{
      margin: 0 0 10px;
      font-size: clamp(2rem, 4vw, 3.4rem);
      line-height: 0.95;
      letter-spacing: -0.04em;
    }}
    p {{ margin: 0; color: var(--muted); font-size: 1rem; }}
    .content {{ padding: 28px 32px 32px; display: grid; gap: 24px; }}
    .status {{
      display: grid;
      gap: 12px;
      padding: 22px;
      border-radius: 22px;
      background: white;
      border: 1px solid rgba(28,26,23,0.08);
    }}
    .pill {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      width: fit-content;
      padding: 10px 16px;
      border-radius: 999px;
      font-size: 0.85rem;
      letter-spacing: 0.16em;
      font-weight: 700;
      color: white;
      background: var(--{'ok' if result.found else 'warn'});
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
    }}
    .metric {{
      padding: 16px;
      border-radius: 18px;
      background: #f5f0e6;
    }}
    .metric strong {{ display: block; font-size: 0.78rem; color: var(--muted); margin-bottom: 8px; }}
    .metric span {{ font-size: 1.15rem; }}
    form {{ display: grid; gap: 14px; }}
    label {{ font-size: 0.9rem; color: var(--muted); }}
    input[type=text] {{
      width: 100%;
      padding: 16px 18px;
      border-radius: 16px;
      border: 1px solid rgba(28,26,23,0.14);
      font-size: 1rem;
      background: #fffefb;
    }}
        input[type=number] {{
            width: 100%;
            padding: 16px 18px;
            border-radius: 16px;
            border: 1px solid rgba(28,26,23,0.14);
            font-size: 1rem;
            background: #fffefb;
        }}
    .actions {{ display: flex; flex-wrap: wrap; gap: 12px; }}
    button, .button-link {{
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 14px 18px;
      font-size: 0.95rem;
      cursor: pointer;
      text-decoration: none;
      color: white;
      background: var(--accent);
    }}
    .button-secondary {{ background: var(--accent-2); }}
    .message {{ font-size: 1rem; line-height: 1.5; }}
        .samples-block {{
            margin-top: 6px;
            border-top: 1px solid rgba(28,26,23,0.1);
            padding-top: 14px;
        }}
        .samples-title {{
            margin: 0 0 8px;
            font-size: 0.92rem;
            color: var(--muted);
            letter-spacing: 0.02em;
        }}
        .samples {{
            margin: 0;
            padding-left: 20px;
            max-height: 220px;
            overflow: auto;
            line-height: 1.45;
        }}
        .samples li {{ margin-bottom: 2px; }}
    .footer {{ font-size: 0.88rem; color: var(--muted); }}
    @media (max-width: 640px) {{
      body {{ padding: 16px; }}
      .hero, .content {{ padding-left: 20px; padding-right: 20px; }}
      .actions {{ flex-direction: column; }}
      button, .button-link {{ width: 100%; text-align: center; }}
    }}
  </style>
</head>
<body>
  <main class=\"card\">
        <section class=\"hero\">
            <h1>Ordliste i Edge</h1>
                        <p>Leser søkeord fra SearchWords!D3 eller manuelt felt. Bruk * for mange tegn og ? for ett tegn.</p>
                        <p style=\"margin-top:8px;font-size:.85rem;opacity:.8;\">UI {UI_VERSION}</p>
    </section>
    <section class=\"content\">
      <section class=\"status {status_class}\">
        <div class=\"pill\">{status_label}</div>
        <div class=\"message\">{safe_message}</div>
        <div class=\"grid\">
          <div class=\"metric\"><strong>Søkeord</strong><span>{safe_query or '&nbsp;'}</span></div>
          <div class=\"metric\"><strong>Normalisert</strong><span>{safe_normalized or '&nbsp;'}</span></div>
          <div class=\"metric\"><strong>Kilde</strong><span>{source}</span></div>
                    <div class=\"metric\"><strong>Treff</strong><span>{match_count}</span></div>
          <div class=\"metric\"><strong>Indekserte ord</strong><span>{total_words}</span></div>
          <div class=\"metric\"><strong>Sist indeksert</strong><span>{indexed_at}</span></div>
        </div>
      </section>

      <form method=\"get\" action=\"/\">
        <div>
          <label for=\"term\">Manuelt søk</label>
          <input id=\"term\" name=\"term\" type=\"text\" value=\"\" placeholder=\"Skriv inn ordet du vil sjekke\">
        </div>
                <div>
                    <label for=\"limit\">Maks treff i liste (0 = alle)</label>
                    <input id=\"limit\" name=\"limit\" type=\"number\" min=\"0\" value=\"{result.sample_limit}\">
                </div>
        <div class=\"actions\">
          <button type=\"submit\">Søk i ordlisten</button>
                    <a class=\"button-link button-secondary\" href=\"/?source=sheet&limit={result.sample_limit}\">Les SearchWords!D3</a>
                    <a class=\"button-link\" href=\"/rebuild?limit={result.sample_limit}\">Bygg indeks på nytt</a>
        </div>
                <div class=\"samples-block\">
                    <p class=\"samples-title\">Treffliste (viser inntil {sample_limit} ord)</p>
                    <ul class=\"samples\">{safe_samples or '<li>Ingen treff å vise</li>'}</ul>
                </div>
      </form>

    <div class=\"footer\">Excel-fil: {html.escape(str(EXCEL_PATH))} | UI {UI_VERSION}</div>
    </section>
  </main>
</body>
</html>
"""

    def result_from_sheet_or_error(self, sample_limit: int = DEFAULT_SAMPLE_LIMIT) -> SearchResult:
        try:
            query = self.index.read_search_cell()
        except Exception as exc:
            return SearchResult(
                query="",
                normalized_query="",
                found=False,
                wildcard_used=False,
                match_count=0,
                sample_matches=[],
                sample_limit=sample_limit,
                total_words=self.index.count_words(),
                source=f"{SEARCH_SHEET_CANDIDATES[0]}!{SEARCH_CELL}",
                indexed_at=self.index.indexed_at(),
                message=f"Klarte ikke lese søkecellen {SEARCH_SHEET_CANDIDATES[0]}!{SEARCH_CELL}: {exc}",
            )
        source_sheet = self.index.active_search_sheet or SEARCH_SHEET_CANDIDATES[0]
        return self.make_result(query, f"{source_sheet}!{SEARCH_CELL}", sample_limit=sample_limit)


def make_handler(app: SearchApp) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            raw_limit = params.get("limit", [str(DEFAULT_SAMPLE_LIMIT)])[0]
            try:
                sample_limit = max(0, int(raw_limit))
            except ValueError:
                sample_limit = DEFAULT_SAMPLE_LIMIT

            if parsed.path == "/rebuild":
                try:
                    if app.index.db_path.exists():
                        app.index.db_path.unlink()
                    wal_path = app.index.db_path.with_suffix(app.index.db_path.suffix + "-wal")
                    shm_path = app.index.db_path.with_suffix(app.index.db_path.suffix + "-shm")
                    if wal_path.exists():
                        wal_path.unlink()
                    if shm_path.exists():
                        shm_path.unlink()
                    app.index._ensure_schema()
                    result = app.result_from_sheet_or_error(sample_limit=sample_limit)
                except Exception as exc:
                    result = SearchResult(
                        query="",
                        normalized_query="",
                        found=False,
                        wildcard_used=False,
                        match_count=0,
                        sample_matches=[],
                        sample_limit=sample_limit,
                        total_words=0,
                        source="rebuild",
                        indexed_at=None,
                        message=f"Klarte ikke bygge indeksen på nytt: {exc}",
                    )
                self._send_html(app.render_page(result))
                return

            source = params.get("source", [""])[0]
            if source == "sheet":
                result = app.result_from_sheet_or_error(sample_limit=sample_limit)
            else:
                query = params.get("term", [""])[0]
                result = app.make_result(query, "manuell input", sample_limit=sample_limit)
            self._send_html(app.render_page(result))

        def log_message(self, format: str, *args: object) -> None:
            return

        def _send_html(self, body: str) -> None:
            encoded = body.encode("utf-8")
            try:
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                # Browser-tab refresh/close can abort local HTTP responses; ignore quietly.
                return

    return Handler


def open_in_edge(url: str) -> None:
    edge_path = find_edge_executable()
    if edge_path is not None:
        webbrowser.register(
            "edge-local",
            None,
            webbrowser.BackgroundBrowser(str(edge_path)),
            preferred=True,
        )
        webbrowser.get("edge-local").open(url)
        return
    webbrowser.open(url)


def main() -> int:
    index = WordIndex(EXCEL_PATH, DB_PATH)
    app = SearchApp(index)
    handler = make_handler(app)
    server = HTTPServer((HOST, PORT), handler)
    url = f"http://{HOST}:{PORT}/?source=sheet"

    print(f"Excel-fil i bruk: {EXCEL_PATH}")
    print("Sjekker om indeksen er oppdatert ...")
    try:
        if index.rebuild_if_needed():
            print("Indeksen ble oppdatert ved oppstart.")
        else:
            print("Indeksen er allerede oppdatert.")
    except Exception as exc:
        print(f"Kunne ikke forhåndsbygge indeks: {exc}")

    print(f"Starter lokal server på {url}")
    print("Trykk Ctrl+C for å stoppe serveren.")

    try:
        open_in_edge(url)
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopper serveren.")
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())