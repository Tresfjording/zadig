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
// HENT PRIS FOR NÅVÆRENDE TIME
// --------------------------
async function hentPrisNaa(sone) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = now.getHours();

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const entry = data.find(p => {
      const startHour = new Date(p.time_start).getHours();
      return startHour === hour;
    });
    return entry ? entry.NOK_per_kWh.toFixed(2) : null;
  } catch (err) {
    console.error("Feil ved henting av pris nå:", err);
    return null;
  }
}

// --------------------------
// OPPDATER INFOBOKS
// --------------------------
async function oppdaterFelter(entry, prisNaa) {
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

  if (entry.sone && prisNaa != null) {
    html += `<p><strong>Pris nå (${entry.sone}):</strong> ${prisNaa} kr/kWh ekskl. MVA</p>`;
    if (landssnitt) {
      html += `<p><strong>Landssnitt:</strong> ${landssnitt} kr/kWh ekskl. MVA</p>`;
    }
  }

  infobox.innerHTML = html;
}

// --------------------------
// VIS TETTSTED (kun via søk)
// --------------------------
async function visTettsted(entry) {
  if (aktivMarker) {
    map.removeLayer(aktivMarker);
    aktivMarker = null;
  }

  const prisNaa = await hentPrisNaa(entry.sone);
  let farge = "blue";

  if (landssnitt && prisNaa) {
    if (prisNaa < landssnitt) farge = "green";
    else if (prisNaa > landssnitt) farge = "red";
    else farge = "orange";
  }

  aktivMarker = L.circleMarker([entry.lat_decimal, entry.lon_decimal], {
    radius: 10,
    color: farge,
    fillColor: farge,
    fillOpacity: 0.8
  }).addTo(map)
    .bindTooltip(
      `${entry.tettsted} – ${prisNaa ? prisNaa + " kr/kWh" : "pris ikke tilgjengelig"}`,
      { permanent: true, direction: "top" }
    )
    .openTooltip();

  await oppdaterFelter(entry, prisNaa);
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

// --------------------------
// AUTOCOMPLETE MED TASTATUR
// --------------------------
const forslagBox = document.createElement("div");
forslagBox.id = "forslagBox";
document.body.appendChild(forslagBox);

let aktivIndex = -1;

sokInput.addEventListener("input", () => {
  const query = sokInput.value.toLowerCase();
  forslagBox.innerHTML = "";
  aktivIndex = -1;

  if (query.length > 1) {
    const treff = steder.filter(e =>
      e.tettsted.toLowerCase().startsWith(query) ||
      (e.fylke && e.fylke.toLowerCase().startsWith(query))
    ).slice(0, 10);

    treff.forEach((e, idx) => {
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

// Tastaturkontroll
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