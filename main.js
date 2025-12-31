// --------------------------
// INIT KART
// --------------------------
const map = L.map('map').setView([65.0, 12.0], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

const infobox = document.getElementById("infobox");
let steder = [];
let aktivMarker = null; // husker siste markør

// --------------------------
// LAST TETTSTEDER
// --------------------------
async function lastTettsteder() {
  try {
    const res = await fetch("tettsteder_3.json");
    steder = await res.json();
  } catch (err) {
    infobox.innerHTML = `<p>Feil ved lasting av tettsteder: ${err}</p>`;
  }
}

// --------------------------
// HENT SPOTPRIS
// --------------------------
async function hentSpotpris(sone) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const values = data.map(p => p.NOK_per_kWh);
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    return avg;
  } catch (err) {
    console.error("Feil ved henting av strømpris:", err);
    return null;
  }
}

// --------------------------
// OPPDATER INFOBOKS
// --------------------------
async function oppdaterFelter(entry) {
  if (!entry) {
    infobox.innerHTML = "<p>Ingen data å vise.</p>";
    return;
  }

  let html = `<h2>${entry.tettsted || "Ukjent tettsted"}</h2><ul>`;
  for (const key in entry) {
    if (!["lat", "lon", "lat_decimal", "lon_decimal"].includes(key)) {
      html += `<li><strong>${key}:</strong> ${entry[key]}</li>`;
    }
  }
  html += "</ul>";

  if (entry.sone) {
    const pris = await hentSpotpris(entry.sone);
    if (pris != null) {
      html += `<p><strong>Strømpris (${entry.sone}):</strong> ${pris} kr/kWh (snitt i dag)</p>`;
    } else {
      html += `<p>Ingen strømpris tilgjengelig for sone ${entry.sone}.</p>`;
    }
  }

  infobox.innerHTML = html;
}

// --------------------------
// VIS TETTSTED
// --------------------------
async function visTettsted(entry) {
  // Fjern gammel markør
  if (aktivMarker) {
    map.removeLayer(aktivMarker);
    aktivMarker = null;
  }

  // Lag ny synlig markør med label
  aktivMarker = L.marker([entry.lat_decimal, entry.lon_decimal])
    .addTo(map)
    .bindTooltip(entry.tettsted, { permanent: true, direction: "top" })
    .openTooltip();

  await oppdaterFelter(entry);
  map.setView([entry.lat_decimal, entry.lon_decimal], 10);
}

// --------------------------
// SØK
// --------------------------
function normaliser(str) {
  return (str || "").trim().toLowerCase();
}

async function søkTettsted() {
  const sok = normaliser(document.getElementById("sokInput").value);
  const entry = steder.find(e => normaliser(e.tettsted) === sok);
  if (entry) {
    visTettsted(entry);
  } else {
    infobox.innerHTML = `<p>Fant ikke "${sok}" i lokal liste.</p>`;
  }
}

// --------------------------
// INIT
// --------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await lastTettsteder();

  const sokInput = document.getElementById("sokInput");
  const visInfoBtn = document.getElementById("visInfoBtn");

  if (sokInput && visInfoBtn) {
    visInfoBtn.addEventListener("click", søkTettsted);
    sokInput.addEventListener("keyup", e => {
      if (e.key === "Enter") søkTettsted();
    });
  }
});