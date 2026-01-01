// #region INIT VARIABLER
const infobox = document.getElementById("infobox");
const sokInput = document.getElementById("sokInput");
const visInfoBtn = document.getElementById("visInfoBtn");

let steder = [];
let aktivMarker = null;
let landssnitt = null;
let aktivIndex = -1;
// #endregion

// #region INIT KART
const map = L.map('map').setView([65.0, 12.0], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);
// #endregion

// #region LAST TETTSTEDER
async function lastTettsteder() {
  try {
    const res = await fetch("tettsteder_3.json");
    steder = await res.json();
  } catch (err) {
    infobox.innerHTML = `<p>Feil ved lasting av tettsteder: ${err}</p>`;
  }
}
// #endregion

// #region LANDSSNITT
async function hentLandssnitt() {
  // ... henter og beregner landssnitt
}
// #endregion

// #region VIS TETTSTED
async function visTettsted(entry) {
  if (aktivMarker) {
    map.removeLayer(aktivMarker);
    aktivMarker = null;
  }
  aktivMarker = L.circleMarker([entry.lat_decimal, entry.lon_decimal], {
    radius: 10,
    color: "blue",
    fillColor: "blue",
    fillOpacity: 0.8
  }).addTo(map)
    .bindTooltip(entry.tettsted, { permanent: true, direction: "top" })
    .openTooltip();

  map.setView([entry.lat_decimal, entry.lon_decimal], 10);
}
// #endregion

// #region SØK
function normaliser(str) {
  return (str || "").trim().toLowerCase();
}

async function søkTettsted() {
  const sok = normaliser(sokInput.value);
  const entry = steder.find(e => normaliser(e.tettsted) === sok);
  if (entry) {
    visTettsted(entry);
  } else {
    infobox.innerHTML = `<p>Fant ikke "${sok}" i lokal liste.</p>`;
  }
}
// #endregion

// #region AUTOCOMPLETE
const forslagBox = document.createElement("div");
forslagBox.id = "forslagBox";
document.body.appendChild(forslagBox);

sokInput.addEventListener("input", () => {
  const query = sokInput.value.toLowerCase();
  forslagBox.innerHTML = "";
  aktivIndex = -1;

  if (query.length > 1) {
    const treff = steder.filter(e =>
      e.tettsted.toLowerCase().startsWith(query) ||
      (e.fylke && e.fylke.toLowerCase().startsWith(query))
    ).slice(0, 10);

    treff.forEach(e => {
      const div = document.createElement("div");
      div.textContent = e.tettsted + (e.fylke ? ` (${e.fylke})` : "");
      div.className = "forslag";
      div.onclick = () => {
        sokInput.value = e.tettsted;
        forslagBox.innerHTML = "";
        visTettsted(e);
      };
      forslagBox.appendChild(div);
    });

    const rect = sokInput.getBoundingClientRect();
    forslagBox.style.top = rect.bottom + window.scrollY + "px";
    forslagBox.style.left = rect.left + window.scrollX + "px";
    forslagBox.style.width = rect.width + "px";
  }
});
// #endregion

// #region TASTATURKONTROLL
sokInput.addEventListener("keydown", (e) => {
  const forslag = forslagBox.querySelectorAll(".forslag");
  if (forslag.length === 0) return;

  if (e.key === "ArrowDown") {
    aktivIndex = (aktivIndex + 1) % forslag.length;
    oppdaterAktiv(forslag);
    e.preventDefault();
  } else if (e.key === "ArrowUp") {
    aktivIndex = (aktivIndex - 1 + forslag.length) % forslag.length;
    oppdaterAktiv(forslag);
    e.preventDefault();
  } else if (e.key === "Enter" && aktivIndex >= 0) {
    forslag[aktivIndex].click();
    e.preventDefault();
  }
});

function oppdaterAktiv(forslag) {
  forslag.forEach(f => f.classList.remove("aktiv"));
  if (aktivIndex >= 0) {
    forslag[aktivIndex].classList.add("aktiv");
  }
}
// #endregion

// #region DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
  await hentLandssnitt();
  await lastTettsteder();
  console.log("Antall steder lastet:", steder.length);

  if (sokInput && visInfoBtn) {
    visInfoBtn.addEventListener("click", søkTettsted);
    sokInput.addEventListener("keyup", e => {
      if (e.key === "Enter") søkTettsted();
    });
  }
});
// #endregion