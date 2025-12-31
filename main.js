// --------------------------
// INIT KART
// --------------------------
const map = L.map('map').setView([65.0, 12.0], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

const infobox = document.getElementById("infobox");

// --------------------------
// LAST TETTSTEDER
// --------------------------
let steder = [];

async function lastTettsteder() {
  try {
    const res = await fetch("tettsteder_3.json");
    steder = await res.json();

    // Lag markører for alle tettsteder
    steder.forEach(sted => {
      if (typeof sted.lat_decimal === "number" && typeof sted.lon_decimal === "number") {
        L.marker([sted.lat_decimal, sted.lon_decimal])
          .addTo(map)
          .on("click", () => oppdaterFelter(sted, null));
      }
    });
  } catch (err) {
    console.error("Feil ved lasting av tettsteder:", err);
  }
}

// --------------------------
// HENT SPOTPRIS FRA HVAKOSTERSTROMMEN.NO
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
    console.error("Feil ved henting av spotpris:", err);
    return null;
  }
}

// --------------------------
// OPPDATER INFOBOKS
// --------------------------
async function oppdaterFelter(entry, pris) {
  if (!infobox) return;

  if (!entry) {
    infobox.innerHTML = "<p>Ingen data å vise.</p>";
    return;
  }

  // Bygg HTML med alle felter fra entry
  let html = `<h2>${entry.tettsted || "Ukjent tettsted"}</h2><ul>`;
  for (const key in entry) {
    if (entry[key] !== undefined && entry[key] !== null) {
      html += `<li><strong>${key}:</strong> ${entry[key]}</li>`;
    }
  }
  html += "</ul>";

  // Hent strømpris hvis sone finnes
  if (entry.sone) {
    const spotpris = await hentSpotpris(entry.sone);
    if (spotpris != null) {
      html += `<p><strong>Strømpris (${entry.sone}):</strong> ${spotpris} kr/kWh (snitt i dag)</p>`;
    } else {
      html += `<p>Ingen strømpris tilgjengelig for sone ${entry.sone}.</p>`;
    }
  }

  infobox.innerHTML = html;
}

// --------------------------
// SØK OG VIS TETTSTED
// --------------------------
function normaliser(str) {
  return (str || "").trim().toLowerCase();
}

async function visTettsted(map) {
  const inputEl = document.getElementById("sokInput");
  if (!inputEl) return;

  const sok = normaliser(inputEl.value);
  if (!sok) {
    infobox.innerHTML = "<p>Skriv inn et stedsnavn først.</p>";
    return;
  }

  let entry = steder.find(e => normaliser(e.tettsted) === sok);

  if (entry) {
    await oppdaterFelter(entry, null);
    if (typeof entry.lat_decimal === "number" && typeof entry.lon_decimal === "number") {
      L.marker([entry.lat_decimal, entry.lon_decimal]).addTo(map);
    }
    return;
  }

  infobox.innerHTML = `<p>Fant ikke "${sok}" i lokal liste.</p>`;
}

// --------------------------
// KOBLE SØK TIL KNAPP
// --------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await lastTettsteder();

  const sokInput = document.getElementById("sokInput");
  const visInfoBtn = document.getElementById("visInfoBtn");

  if (sokInput && visInfoBtn) {
    visInfoBtn.addEventListener("click", () => visTettsted(map));
    sokInput.addEventListener("keyup", e => {
      if (e.key === "Enter") visTettsted(map);
    });
  }
});