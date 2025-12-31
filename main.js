// --------------------------
// INIT KART
// --------------------------
const map = L.map('map').setView([65.0, 12.0], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

const infobox = document.getElementById("infobox");
let steder = [];
let aktivMarker = null;
let landssnitt = null;

// --------------------------
// HENT LANDSSNITT
// --------------------------
async function hentLandssnitt() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const soner = ["NO1","NO2","NO3","NO4","NO5"];
  let alleVerdier = [];

  for (const sone of soner) {
    const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      alleVerdier.push(...data.map(p => p.NOK_per_kWh));
    } catch (err) {
      console.error("Feil ved henting av sone", sone, err);
    }
  }

  if (alleVerdier.length > 0) {
    landssnitt = (alleVerdier.reduce((a,b)=>a+b,0) / alleVerdier.length).toFixed(2);
    console.log("Landssnitt:", landssnitt);
  }
}

// --------------------------
// HENT SPOTPRIS FOR SONE
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
async function oppdaterFelter(entry, pris) {
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

  if (entry.sone && pris != null) {
    html += `<p><strong>Strømpris (${entry.sone}):</strong> ${pris} kr/kWh (snitt i dag)</p>`;
    if (landssnitt) {
      html += `<p><strong>Landssnitt:</strong> ${landssnitt} kr/kWh</p>`;
    }
  }

  infobox.innerHTML = html;
}

// --------------------------
// VIS TETTSTED MED FARGE
// --------------------------
async function visTettsted(entry) {
  if (aktivMarker) {
    map.removeLayer(aktivMarker);
    aktivMarker = null;
  }

  const pris = await hentSpotpris(entry.sone);
  let farge = "blue";

  if (landssnitt && pris) {
    if (pris < landssnitt) farge = "green";
    else if (pris > landssnitt) farge = "red";
    else farge = "orange";
  }

  aktivMarker = L.circleMarker([entry.lat_decimal, entry.lon_decimal], {
    radius: 10,
    color: farge,
    fillColor: farge,
    fillOpacity: 0.8
  }).addTo(map)
    .bindTooltip(entry.tettsted, { permanent: true, direction: "top" })
    .openTooltip();

  await oppdaterFelter(entry, pris);
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
  await hentLandssnitt();
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

// --------------------------
// LAST TETTSTEDER (kun data)
// --------------------------
async function lastTettsteder() {
  try {
    const res = await fetch("tettsteder_3.json");
    steder = await res.json();
  } catch (err) {
    infobox.innerHTML = `<p>Feil ved lasting av tettsteder: ${err}</p>`;
  }
}