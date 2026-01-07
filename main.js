// --------------------------
// INIT KART - 07.01.2026  - 23:54:41
// --------------------------
const map = L.map("map").setView([65.0, 12.0], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

const infobox = document.getElementById("infobox");
const searchInput = document.getElementById("sokInput");
const searchButton = document.getElementById("visInfoBtn");
const autocompleteList = document.getElementById("autocompleteList");

let steder = [];
let hytter = [];
let landssnitt = null;
let aktivMarker = null;
let aktivAnimertRing = null;
let sisteValg = null;

// --------------------------
// HJELPEFUNKSJONER
// --------------------------
function normaliser(str) {
  return (str || "").toString().trim().toLowerCase();
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// --------------------------
// HENT LANDSSNITT
// --------------------------
async function hentLandssnitt() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const soner = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  let alleVerdier = [];

  for (const sone of soner) {
    const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const verdier = data
        .map(p => safeNumber(p.NOK_per_kWh))
        .filter(v => v !== null);
      alleVerdier.push(...verdier);
    } catch (err) {
      console.error("Feil ved henting av sone", sone, err);
    }
  }

  if (alleVerdier.length > 0) {
    const snitt =
      alleVerdier.reduce((sum, v) => sum + v, 0) / alleVerdier.length;
    landssnitt = snitt.toFixed(2);
    console.log("Landssnitt:", landssnitt);
  } else {
    console.warn("Fant ingen gyldige verdier for landssnitt");
  }
}

// --------------------------
// HENT PRIS FOR NÅVÆRENDE TIME
// --------------------------
async function hentPrisNaa(sone) {
  if (!sone) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = now.getHours();

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data.find(p => {
      const startHour = new Date(p.time_start).getHours();
      return startHour === hour;
    });
    const verdi = entry ? safeNumber(entry.NOK_per_kWh) : null;
    return verdi !== null ? verdi.toFixed(2) : null;
  } catch (err) {
    console.error("Feil ved henting av pris nå:", err);
    return null;
  }
}

// --------------------------
// PRISFARGE
// --------------------------
function prisTilFarge(pris, land) {
  const p = safeNumber(pris);
  const l = safeNumber(land);
  if (p === null || l === null) return "blue";

  if (p < l) return "green";
  if (p > l) return "red";
  return "orange";
}

// --------------------------
// OPPDATER INFOBOKS
// --------------------------
async function oppdaterInfoboks(entry, type) {
  if (!entry) {
    infobox.innerHTML = "<p>Ingen data å vise.</p>";
    return;
  }

  const prisNaa = entry.sone ? await hentPrisNaa(entry.sone) : null;

  let tittel = "";
  if (type === "tettsted") {
    tittel = entry.tettsted || "Ukjent tettsted";
  } else if (type === "hytte") {
    tittel = entry.navn || entry.tettsted || "Ukjent hytte";
  } else {
    tittel = entry.navn || entry.tettsted || "Ukjent sted";
  }

  let html = `<h2>${tittel}</h2><ul>`;

  for (const key in entry) {
    if (
      ["lat", "lon", "lat_decimal", "lon_decimal"].includes(key) ||
      entry[key] === null ||
      entry[key] === undefined ||
      entry[key] === ""
    ) {
      continue;
    }
    html += `<li><strong>${key}:</strong> ${entry[key]}</li>`;
  }
  html += "</ul>";

  if (entry.sone && prisNaa != null) {
    const farge = prisTilFarge(prisNaa, landssnitt);
    html += `<p><strong>Pris nå (${entry.sone}):</strong> <span style="color:${farge}">${prisNaa} kr/kWh ekskl. MVA</span></p>`;
    if (landssnitt) {
      html += `<p><strong>Landssnitt:</strong> ${landssnitt} kr/kWh ekskl. MVA</p>`;
    }
  } else if (entry.sone) {
    html += `<p><strong>Pris nå (${entry.sone}):</strong> ikke tilgjengelig</p>`;
    if (landssnitt) {
      html += `<p><strong>Landssnitt:</strong> ${landssnitt} kr/kWh ekskl. MVA</p>`;
    }
  }

  infobox.innerHTML = html;
}

// --------------------------
// ANIMASJON RUNDT VALGT PUNKT
// --------------------------
function startAnimasjon(lat, lon, baseColor) {
  if (aktivAnimertRing) {
    map.removeLayer(aktivAnimertRing);
    aktivAnimertRing = null;
  }

  let radius = 12;
  let growing = true;

  aktivAnimertRing = L.circleMarker([lat, lon], {
    radius,
    color: baseColor,
    weight: 3,
    fillOpacity: 0,
    opacity: 0.9
  }).addTo(map);

  const interval = setInterval(() => {
    if (!aktivAnimertRing) {
      clearInterval(interval);
      return;
    }

    if (growing) {
      radius += 0.7;
      if (radius > 20) growing = false;
    } else {
      radius -= 0.7;
      if (radius < 12) growing = true;
    }

    aktivAnimertRing.setStyle({ radius });
  }, 70);

  // stopp animasjon etter 15 sek for sikkerhet
  setTimeout(() => {
    if (aktivAnimertRing) {
      map.removeLayer(aktivAnimertRing);
      aktivAnimertRing = null;
    }
    clearInterval(interval);
  }, 15000);
}

// --------------------------
// VIS TETTSTED
// --------------------------
async function visTettsted(entry) {
  if (!entry) return;

  if (aktivMarker) {
    map.removeLayer(aktivMarker);
    aktivMarker = null;
  }

  if (!entry.lat_decimal || !entry.lon_decimal) {
    console.warn("Mangler koordinater for tettsted", entry);
    return;
  }

  const prisNaa = entry.sone ? await hentPrisNaa(entry.sone) : null;
  const farge = prisTilFarge(prisNaa, landssnitt);

  aktivMarker = L.circleMarker([entry.lat_decimal, entry.lon_decimal], {
    radius: 10,
    color: farge,
    fillColor: farge,
    fillOpacity: 0.8
  })
    .addTo(map)
    .bindTooltip(
      `${entry.tettsted || "Tettsted"} – ${
        prisNaa ? prisNaa + " kr/kWh ekskl. MVA" : "pris ikke tilgjengelig"
      }`,
      { permanent: true, direction: "top" }
    )
    .openTooltip();

  startAnimasjon(entry.lat_decimal, entry.lon_decimal, farge);
  await oppdaterInfoboks(entry, "tettsted");
  map.setView([entry.lat_decimal, entry.lon_decimal], 10, {
    animate: true
  });
  sisteValg = { type: "tettsted", id: entry.id || entry.tettsted };
}

// --------------------------
// VIS HYTTE
// --------------------------
async function visHytte(entry) {
  if (!entry) return;

  if (aktivMarker) {
    map.removeLayer(aktivMarker);
    aktivMarker = null;
  }

  const lat = entry["@lat"];
  const lon = entry["@lon"];
  if (!lat || !lon) {
    console.warn("Mangler koordinater for hytte", entry);
    return;
  }

  const prisNaa = entry.sone ? await hentPrisNaa(entry.sone) : null;
  const farge = prisTilFarge(prisNaa, landssnitt);

  aktivMarker = L.marker([lat, lon])
    .addTo(map)
    .bindTooltip(
      `${entry.name || "Hytte"} – ${
        prisNaa ? prisNaa + " kr/kWh ekskl. MVA" : "pris ikke tilgjengelig"
      }`,
      { permanent: true, direction: "top" }
    )
    .openTooltip();

  startAnimasjon(lat, lon, farge);
  await oppdaterInfoboks(entry, "hytte");
  map.setView([lat, lon], 12, { animate: true });
  sisteValg = { type: "hytte", id: entry["@id"] || entry.name };
}

  // const hytteIcon = L.icon({
    // iconUrl: "hytte_icon.png", // bytt til faktisk ikon-fil
    // iconSize: [24, 24],
    // iconAnchor: [12, 24],
    //popupAnchor: [0, -24]
  //});

  const marker = L.marker([h["@lat"], h["@lon"]])
  .addTo(map)
  .bindTooltip(h.name || "Hytte", {
    permanent: false,
    direction: "top"
  })

    .addTo(map)
    .bindTooltip(
      `${entry.navn || "Hytte"} – ${
        prisNaa ? prisNaa + " kr/kWh ekskl. MVA ekskl. MVA" : "pris ikke tilgjengelig"
      }`,
      { permanent: true, direction: "top" }
    )
    .openTooltip();

  startAnimasjon(entry.lat_decimal, entry.lon_decimal, farge);
  await oppdaterInfoboks(entry, "hytte");
  map.setView([entry.lat_decimal, entry.lon_decimal], 12, {
    animate: true
  });
  sisteValg = { type: "hytte", id: entry.id || entry.navn };
}

// --------------------------
// LAST DATA
// --------------------------
async function lastTettsteder() {
  try {
    const res = await fetch("tettsteder_3.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    steder = await res.json();
    console.log("Lastet tettsteder:", steder.length);
  } catch (err) {
    console.error("Feil ved lasting av tettsteder:", err);
    infobox.innerHTML =
      "<p>Feil ved lasting av tettsteder. Prøv å laste siden på nytt.</p>";
  }
}
function plasserAlleHytter() {
  if (!hytter || hytter.length === 0) return;

  hytter.forEach(h => {
    const lat = h["@lat"];
    const lon = h["@lon"];
    if (!lat || !lon) return;

    const marker = L.marker([lat, lon])
      .addTo(map)
      .bindTooltip(h.name || "Hytte", {
        permanent: false,
        direction: "top"
      });

    marker.on("click", () => visHytte(h));
  });
}

async function lastHytter() {
  try {
    const res = await fetch("dnt_hytter.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    hytter = await res.json();
    console.log("Lastet hytter:", hytter.length);
  } catch (err) {
    console.error("Feil ved lasting av hytter:", err);
    // Ikke krasj – bare logg og vis kort info
  }
}
await lastHytter();
plasserAlleHytter();


// --------------------------
// AUTOCOMPLETE
// --------------------------
function byggForslagListe(sok) {
  if (!autocompleteList) return;
  autocompleteList.innerHTML = "";

  const q = normaliser(sok);
  if (!q) {
    autocompleteList.style.display = "none";
    return;
  }

  const forslag = [];

  for (const s of steder) {
    const navn = s.tettsted || "";
    if (normaliser(navn).includes(q)) {
      forslag.push({
        type: "tettsted",
        label: navn,
        ref: s
      });
    }
  }

  for (const h of hytter) {
    const navn = h.navn || "";
    if (normaliser(navn).includes(q)) {
      forslag.push({
        type: "hytte",
        label: navn,
        ref: h
      });
    }
  }

  forslag.slice(0, 15).forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.label + (item.type === "hytte" ? " (hytte)" : "");
    li.className = "autocomplete-item";
    li.addEventListener("click", () => {
      searchInput.value = item.label;
      autocompleteList.innerHTML = "";
      autocompleteList.style.display = "none";
      if (item.type === "tettsted") visTettsted(item.ref);
      else visHytte(item.ref);
    });
    autocompleteList.appendChild(li);
  });

  autocompleteList.style.display =
    forslag.length > 0 ? "block" : "none";
}

// --------------------------
// SØK
// --------------------------
function finnTettstedEllerHytte(sok) {
  const q = normaliser(sok);
  if (!q) return null;

  // eksakt match først
  let entry =
    steder.find(e => normaliser(e.tettsted) === q) ||
    hytter.find(e => normaliser(e.navn) === q);

  if (entry) {
    return {
      type: steder.includes(entry) ? "tettsted" : "hytte",
      entry
    };
  }

  // inneholder
  entry =
    steder.find(e => normaliser(e.tettsted).includes(q)) ||
    hytter.find(e => normaliser(e.navn).includes(q));

  if (!entry) return null;

  return {
    type: steder.includes(entry) ? "tettsted" : "hytte",
    entry
  };
}

async function søk() {
  const sok = searchInput ? searchInput.value : "";
  const funn = finnTettstedEllerHytte(sok);

  if (!funn) {
    infobox.innerHTML = `<p>Fant ikke "${sok}" i tettsteder eller hytter.</p>`;
    return;
  }

  if (funn.type === "tettsted") await visTettsted(funn.entry);
  else await visHytte(funn.entry);
}

// --------------------------
// INIT
// --------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await hentLandssnitt();
  await lastTettsteder();
  await lastHytter();

  if (searchButton) {
    searchButton.addEventListener("click", () => {
      søk();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keyup", e => {
      byggForslagListe(searchInput.value);
      if (e.key === "Enter") {
        søk();
        autocompleteList.style.display = "none";
      }
    });

    searchInput.addEventListener("focus", () => {
      if (searchInput.value) byggForslagListe(searchInput.value);
    });

    document.addEventListener("click", e => {
      if (
        e.target !== searchInput &&
        e.target !== autocompleteList &&
        !autocompleteList.contains(e.target)
      ) {
        autocompleteList.style.display = "none";
      }
    });
  }
});