from __future__ import annotations

import html
import os
import sqlite3
import threading
import time
import webbrowser
from collections import defaultdict
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from importlib import import_module
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urlparse

from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string

try:
    pythoncom = import_module("pythoncom")
    win32_client = import_module("win32com.client")
except ImportError:
    pythoncom = None
    win32_client = None


ORDLISTE_SHEET_CANDIDATES = ["Ordliste", "AlleOrd", "Kolonner"]
SEARCH_SHEET_CANDIDATES = ["data"]
SEARCH_CELL = "A1"
COLUMN_START = "A"
COLUMN_END = "AC"
DB_PATH = Path(__file__).with_name("ordliste_cache.sqlite3")
SYNONYMS_DB_PATH = Path(__file__).with_name("ordliste_synonyms.sqlite3")
HOST = "127.0.0.1"
PORT = 8765
UI_VERSION = "v2026-03-26-wildcards-limitfix"
DEFAULT_SAMPLE_LIMIT = 0
SEARCH_CELL_LABEL = f"{SEARCH_SHEET_CANDIDATES[0]}!{SEARCH_CELL}"

def do_GET(self) -> None:
    self.send_response(200)
    self.send_header("Content-Type", "text/html; charset=utf-8")
    self.end_headers()
    self.wfile.write(b"<h1>Serveren svarer!</h1>")

def resolve_excel_path() -> Path:
    env_path = os.environ.get("ORDLISTE_XLSM")
    candidates = []

    if env_path:
        candidates.append(Path(env_path))

    # Prioriter den faktiske hovedfilen i dette prosjektet. Det finnes flere
    # varianter av samme arbeidsbok, men den generiske "G-Ordliste.xlsm" er den
    # mest sannsynlige kilden når den finnes i prosjektmappen.
    candidates.extend(
        [
           # Path.cwd() / "G-Ordliste.xlsm",
           # Path.cwd() / "G-Ordliste - vbo.xlsm",
           # Path.cwd() / "G-Ordliste - vbo-2.xlsm",
           # Path.cwd() / "G-Ordliste reserve.xlsm",
           # Path.cwd() / "G-Ordliste_importert.xlsm",
           # Path.cwd() / "Ordliste_Norsk_ny.xlsx",
           # Path.cwd() / "Ordlista HovedFil.xlsm",
           # Path.cwd() / "Ordliste Norsk.xlsm",
           # Path.cwd() / "Ordliste Norsk v. 30.6.xlsm",
           # Originale OneDrive-steder som fallback
            Path(r"C:\Users\ØyvindGranberg\Projects\zadig\Ordlista HovedFil.xlsm"),
           # Path(r"C:\Users\ØyvindGranberg\OneDrive\Dokumenter\Annet\Ordliste Norsk.xlsm"),
        ]
    )

    seen: set[Path] = set()
    for candidate in candidates:
        normalized = candidate.expanduser().resolve(strict=False)
        if normalized in seen:
            continue
        seen.add(normalized)
        if candidate.is_file():
            return candidate

    if candidates:
        return candidates[0]
    return Path.cwd() / "G-Ordliste.xlsm"


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
    length: int | None
    total_words: int
    source: str
    indexed_at: str | None
    message: str
    synonyms: list[str] | None = None


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

    def _read_search_cell_via_excel(self) -> str:
        if pythoncom is None or win32_client is None:
            raise RuntimeError("pywin32 er ikke tilgjengelig")

        pythoncom.CoInitialize()
        excel = None
        workbook = None

        try:
            target_path = str(self.excel_path.resolve()).lower()
            try:
                excel = win32_client.GetActiveObject("Excel.Application")
                print(f"Leser {SEARCH_CELL_LABEL} fra aktiv Excel-instans ...")
            except Exception:
                print(f"Ingen aktiv Excel-instans funnet. Starter skjult Excel for lesing av {SEARCH_CELL_LABEL} ...")
                excel = win32_client.DispatchEx("Excel.Application")
                excel.Visible = False

            excel.DisplayAlerts = False
            excel.EnableEvents = False

            for candidate in list(excel.Workbooks):
                try:
                    if str(candidate.FullName).lower() == target_path:
                        workbook = candidate
                        break
                except Exception:
                    continue

            opened_here = False
            if workbook is None:
                workbook = excel.Workbooks.Open(str(self.excel_path), UpdateLinks=0, ReadOnly=True)
                opened_here = True

            try:
                sheet = None
                actual_name = None
                for candidate_name in SEARCH_SHEET_CANDIDATES:
                    for worksheet in workbook.Worksheets:
                        if worksheet.Name.strip().casefold() == candidate_name.strip().casefold():
                            sheet = worksheet
                            actual_name = worksheet.Name
                            break
                    if sheet is not None:
                        break

                if sheet is None or actual_name is None:
                    available = ", ".join(worksheet.Name for worksheet in workbook.Worksheets)
                    wanted = ", ".join(SEARCH_SHEET_CANDIDATES)
                    raise KeyError(f"Fant ikke søkeark. Prøvde: {wanted}. Tilgjengelige ark: {available}")

                self.active_search_sheet = actual_name
                value = sheet.Range(SEARCH_CELL).Value
                return "" if value is None else str(value)
            finally:
                if opened_here:
                    workbook.Close(SaveChanges=False)
                workbook = None

        finally:
            if excel is not None:
                try:
                    if excel.Workbooks.Count == 0:
                        excel.Quit()
                except Exception:
                    pass
            pythoncom.CoUninitialize()

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
        return self._rebuild_from_excel(force=False)

    def rebuild_from_excel(self) -> bool:
        return self._rebuild_from_excel(force=True)

    def _rebuild_from_excel(self, force: bool) -> bool:
        if not self.excel_path.is_file():
            raise FileNotFoundError(f"Fant ikke Excel-filen: {self.excel_path}")

        stat = self.excel_path.stat()
        signature = f"{stat.st_mtime_ns}:{stat.st_size}"
        cached_signature = self._get_metadata("excel_signature")
        if not force and cached_signature == signature:
            return False

        with self._lock:
            cached_signature = self._get_metadata("excel_signature")
            if not force and cached_signature == signature:
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

    def find_wildcard_matches(self, query: str, limit: int = 50, length: int | None = None) -> tuple[int, list[str]]:
        normalized = normalize_word(query)
        if not normalized:
            return 0, []

        like_pattern = wildcard_to_sql_like(normalized)
        length_clause = " AND LENGTH(word) = ?" if length and length > 0 else ""
        params = (like_pattern, length) if length and length > 0 else (like_pattern,)

        with self._connect() as connection:
            count_row = connection.execute(
                f"SELECT COUNT(*) FROM words WHERE word LIKE ? ESCAPE '\\'{length_clause}",
                params,
            ).fetchone()
            if limit <= 0:
                sample_rows = connection.execute(
                    f"SELECT word FROM words WHERE word LIKE ? ESCAPE '\\'{length_clause} ORDER BY LENGTH(word), word",
                    params,
                ).fetchall()
            else:
                sample_rows = connection.execute(
                    f"SELECT word FROM words WHERE word LIKE ? ESCAPE '\\'{length_clause} ORDER BY LENGTH(word), word LIMIT ?",
                    params + (limit,) if length and length > 0 else params + (limit,),
                ).fetchall()

        total = int(count_row[0]) if count_row else 0
        samples = [row[0] for row in sample_rows]
        return total, samples

    def get_synonyms(self, word: str) -> list[str]:
        """Get synonyms for a word from the synonym database."""
        if not SYNONYMS_DB_PATH.is_file():
            return []
        
        normalized = normalize_word(word)
        if not normalized:
            return []
        
        try:
            conn = sqlite3.connect(str(SYNONYMS_DB_PATH), check_same_thread=False)
            conn.execute("PRAGMA encoding = 'UTF-8'")
            conn.row_factory = sqlite3.Row
            
            # Find the lemma for this word
            lemma_row = conn.execute(
                "SELECT lemma FROM variants WHERE variant = ? LIMIT 1",
                (normalized,)
            ).fetchone()
            
            if not lemma_row:
                conn.close()
                return []
            
            lemma = lemma_row[0]
            
            # Get all variants for this lemma
            variant_rows = conn.execute(
                "SELECT variant FROM variants WHERE lemma = ? ORDER BY variant",
                (lemma,)
            ).fetchall()
            
            conn.close()
            
            # Return synonyms (excluding the original word)
            synonyms = [row[0] for row in variant_rows if row[0] != normalized]
            return synonyms
        except Exception as e:
            print(f"Feil ved henting av synonymer: {e}")
            return []

    def read_search_cell(self) -> str:
        if pythoncom is not None and win32_client is not None:
            try:
                return self._read_search_cell_via_excel()
            except Exception as exc:
                print(f"COM-lesing av {SEARCH_CELL_LABEL} feilet, faller tilbake til openpyxl: {exc}")

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
    def __init__(self, index: WordIndex):
        self.index = index

    def make_result(self, query: str, source: str, sample_limit: int = DEFAULT_SAMPLE_LIMIT, length: int | None = None) -> SearchResult:
        normalized_query = normalize_word(query)
        wildcard_used = '*' in normalized_query or '?' in normalized_query
        found = False
        match_count = 0
        sample_matches = []
        message = ""
        synonyms: list[str] | None = None
        
        if normalized_query:
            match_count, sample_matches = self.index.find_wildcard_matches(
                normalized_query,
                limit=sample_limit,
                length=length,
            )
            found = match_count > 0
            if not found:
                message = f"Fant ingen treff for '{query}'."
            else:
                # Get synonyms for the first match (if it's an exact match)
                if not wildcard_used and match_count > 0:
                    synonyms = self.index.get_synonyms(query)
        else:
            message = "Skriv inn et søkeord. Bruk * og ? for jokertegn om ønskelig."
        
        return SearchResult(
            query=query,
            normalized_query=normalized_query,
            found=found,
            wildcard_used=wildcard_used,
            match_count=match_count,
            sample_matches=sample_matches,
            sample_limit=sample_limit,
            length=length,
            total_words=self.index.count_words(),
            source=source,
            indexed_at=self.index.indexed_at(),
            message=message,
            synonyms=synonyms,
        )

    def result_from_sheet_or_error(self, sample_limit=DEFAULT_SAMPLE_LIMIT, length: int | None = None):
        try:
            query = self.index.read_search_cell()
            return self.make_result(
                query,
                f"Excel {SEARCH_CELL_LABEL}",
                sample_limit=sample_limit,
                length=length,
            )
        except Exception as exc:
            return SearchResult(
                query="",
                normalized_query="",
                found=False,
                wildcard_used=False,
                match_count=0,
                sample_matches=[],
                sample_limit=sample_limit,
                length=length,
                total_words=self.index.count_words(),
                source="sheet",
                indexed_at=self.index.indexed_at(),
                message=f"Klarte ikke lese fra {SEARCH_CELL_LABEL}: {exc}",
                synonyms=None,
            )

    def render_page(self, result: SearchResult) -> str:
        safe_query = html.escape(result.query or "")
        grouped = defaultdict(list)
        for word in result.sample_matches or []:
            grouped[len(word)].append(word)
        safe_samples = ""
        for length in sorted(grouped.keys()):
            safe_samples += f"<h3>{length} bokstaver:</h3><ul>"
            for word in grouped[length]:
                safe_samples += f"<li>{html.escape(word)}</li>"
            safe_samples += "</ul>"
        if not safe_samples:
            safe_samples = '<li>Ingen treff å vise</li>'
        samples_style = "" if result.found else "color: #7c4a03;"
        sample_limit = "alle" if result.sample_limit == 0 else f"{result.sample_limit:,}".replace(",", " ")
        # Vis kun feilmelding hvis source er 'sheet' og det faktisk er en feilmelding
        show_message = bool(result.message and result.source == "sheet")
        message = html.escape(result.message) if show_message else ""
        
        # Build synonyms section grouped by word length
        synonyms_html = ""
        if result.synonyms:
            grouped_synonyms = defaultdict(list)
            for synonym in result.synonyms:
                grouped_synonyms[len(synonym)].append(synonym)

            synonyms_rows = ""
            for length in sorted(grouped_synonyms.keys()):
                synonyms_rows += f"<h3>{length} bokstaver:</h3><ul>"
                for synonym in grouped_synonyms[length]:
                    synonyms_rows += f"<li>{html.escape(synonym)}</li>"
                synonyms_rows += "</ul>"

            synonyms_html = f"""
                <div class=\"synonyms-block\">
                    <p class=\"synonyms-title\">Synonymer:</p>
                    {synonyms_rows}
                </div>
            """

        return f"""<!doctype html>
<html lang=\"no\">
<head>
    <meta charset=\"utf-8\">
    <title>Ordliste-søk</title>
    <style>
        body {{ font-family: Arial, sans-serif; background: #fff8e1; margin: 0; padding: 0; }}
        .card {{ background: #fff3e0; max-width: 600px; margin: 40px auto; padding: 24px 32px; border-radius: 12px; box-shadow: 0 2px 8px rgba(140, 70, 0, 0.10); }}
        .hero {{ margin-bottom: 18px; }}
        .actions {{ display: flex; gap: 10px; margin-top: 12px; margin-bottom: 12px; }}
        .button-link, button {{ border: none; border-radius: 999px; padding: 14px 18px; font-size: 0.95rem; cursor: pointer; text-decoration: none; color: #fffbe6; background: #e65100; transition: background 0.2s; }}
        .button-link:hover, button:hover {{ background: #ff9800; color: #4e2600; }}
        .button-secondary {{ background: #a1887f; color: #fffbe6; }}
        .button-secondary:hover {{ background: #bcaaa4; color: #4e2600; }}
        .message {{ font-size: 1rem; line-height: 1.5; color: #b71c1c; margin-bottom: 10px; }}
        .samples-block {{ margin-top: 6px; border-top: 1px solid #bcaaa4; padding-top: 14px; }}
        .samples-title {{ margin: 0 0 8px; font-size: 0.92rem; color: #a1887f; letter-spacing: 0.02em; }}
        .samples {{ margin: 0; padding-left: 20px; {samples_style} }}
        .samples li {{ margin-bottom: 2px; }}
        .synonyms-block {{ margin-top: 12px; padding-top: 12px; border-top: 1px solid #d4af85; }}
        .synonyms-title {{ margin: 0 0 8px; font-size: 0.92rem; color: #a1887f; letter-spacing: 0.02em; font-weight: bold; }}
        .synonyms {{ margin: 0; padding-left: 20px; }}
        .synonyms li {{ margin-bottom: 2px; color: #6d4c41; }}
        .footer {{ font-size: 0.88rem; color: #a1887f; margin-top: 18px; }}
        .match-count {{ font-size: 1.05rem; color: #e65100; font-weight: bold; margin-bottom: 6px; }}
        input[type="text"], input[type="number"] {{ border: 1px solid #ff9800; border-radius: 6px; padding: 6px 10px; background: #fffbe6; color: #4e2600; margin-right: 8px; }}
        input[type="text"]:focus, input[type="number"]:focus {{ outline: 2px solid #e65100; }}
        h1 {{ color: #e65100; }}
        h3 {{ color: #e65100; font-size: 1.1rem; margin-top: 20px; margin-bottom: 5px; }}
        label {{ color: #7c4a03; }}
        @media (max-width: 640px) {{ body {{ padding: 16px; }} .hero, .card {{ padding-left: 10px; padding-right: 10px; }} .actions {{ flex-direction: column; }} button, .button-link {{ width: 100%; text-align: center; }} }}
    </style>
</head>
<body>
    <main class=\"card\">
        <section class=\"hero\">
            <h1>Ordliste-søk</h1>
            <form method=\"get\" action=\"/\">
                <label for=\"term\">Søk etter ord:</label>
                <input type=\"text\" id=\"term\" name=\"term\" value=\"{safe_query}\" autocomplete=\"off\" autofocus>
                <br><label for=\"length\">Lengde på ord (bokstaver, 0 = alle):</label>
                <input type=\"number\" id=\"length\" name=\"length\" value=\"{result.length or 0}\" min=\"0\" max=\"100\">
                <div class=\"actions\">
                    <button type=\"submit\">Søk i ordlisten</button>
                    <a class=\"button-link button-secondary\" href=\"/?source=sheet&length={result.length or 0}\">Les {SEARCH_CELL_LABEL}</a>
                    <a class=\"button-link\" href=\"/rebuild?length={result.length or 0}\">Bygg indeks på nytt</a>
                </div>
                <div class=\"samples-block\">
                    <div class=\"match-count\">Antall treff: {result.match_count:,}</div>
                    <p class=\"samples-title\">Treffliste (viser inntil {result.total_words} ord)</p>
                    <ul class=\"samples\">{safe_samples or '<li>Ingen treff å vise</li>'}</ul>
                </div>
                {synonyms_html}
            </form>
            {f'<div class="message">{message}</div>' if message else ''}
            <div class=\"footer\">Excel-fil: {html.escape(str(EXCEL_PATH))} </div>
        </section>
    </main>
</body>
</html>"""


def make_handler(app: SearchApp) -> type[BaseHTTPRequestHandler]:


    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            print(f"do_GET: Forespørsel mottatt: {self.path}")
            try:
                app = self.server.app  # type: ignore[attr-defined]
                print("do_GET: Parsed app OK")
                from urllib.parse import urlparse, parse_qs
                parsed = urlparse(self.path)
                print(f"do_GET: Parsed URL: {parsed}")
                params = parse_qs(parsed.query)
                print(f"do_GET: Params: {params}")
                sample_limit = 0
                length: int | None = None
                try:
                    if "length" in params:
                        length_val = int(params["length"][0])
                        if length_val > 0:
                            length = length_val
                except Exception as e:
                    print(f"do_GET: Feil ved parsing av length: {e}")
                    length = None

                if parsed.path == "/rebuild":
                    print("do_GET: Rebuild path")
                    try:
                        app.index.rebuild_from_excel()
                        message = "Indeksen ble bygget på nytt fra Excel."
                    except Exception as exc:
                        print(f"do_GET: Feil ved rebuild: {exc}")
                        result = SearchResult(
                            query="",
                            normalized_query="",
                            found=False,
                            wildcard_used=False,
                            match_count=0,
                            sample_matches=[],
                            sample_limit=sample_limit,
                            length=length,
                            total_words=0,
                            source="rebuild",
                            indexed_at=None,
                            message=f"Klarte ikke bygge indeksen på nytt: {exc}",
                            synonyms=None,
                        )
                        self._send_html(app.render_page(result))
                        return
                    result = app.make_result("", "rebuild", sample_limit=sample_limit, length=length)
                    self._send_html(app.render_page(result))
                    return

                source = params.get("source", [""])[0]
                print(f"do_GET: source={source}")
                if source == "sheet":
                    print("do_GET: Henter fra sheet")
                    result = app.result_from_sheet_or_error(sample_limit=sample_limit, length=length)
                else:
                    query = params.get("term", [""])[0]
                    print(f"do_GET: Henter fra manuell input, query={query}")
                    result = app.make_result(query, "manuell input", sample_limit=sample_limit, length=length)
                print("do_GET: Sender HTML-svar")
                self._send_html(app.render_page(result))
            except Exception as e:
                print(f"do_GET: Uventet feil: {e}")
                self.send_response(500)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(f"Serverfeil: {e}".encode("utf-8"))

        def log_message(self, format: str, *args: object) -> None:
            return

        def _send_html(self, body: str) -> None:
            encoded = body.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

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
    server.app = app  # Attach the app to the server for handler access
    url = f"http://{HOST}:{PORT}/"

    print(f"Excel-fil i bruk: {EXCEL_PATH}")
    print("Sjekker om indeksen er oppdatert ...")
    try:
        if index.rebuild_if_needed():
            print("Indeksen ble oppdatert ved oppstart.")
        else:
            print("Indeksen er allerede oppdatert.")
    except Exception as exc:
        print(f"Kunne ikke forhåndsbygge indeks: {exc}")

    print(f"Antall ord i SQLite-indeksen: {index.count_words():,}")
    print(f"Starter lokal server på {url}")
    print("Trykk Ctrl+C for å stoppe serveren.")

    try:
        open_in_edge(url)
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopper serveren.")
    finally:
        server.server_close()

    # return 0

if __name__ == "__main__":
        raise SystemExit(main())