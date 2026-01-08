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

function leggTilAutocomplete() {
  const input = document.getElementById("sokInput");
  const list = document.getElementById("autocompleteList");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = "";
    if (!q) {
      list.style.display = "none";
      return;
    }

    const treffTettsteder = tettsteder.filter(t =>
      (t.tettsted || "").toLowerCase().includes(q)
    );

    const treffHytter = hytter.filter(h =>
      (h.name || "").toLowerCase().includes(q)
    );

    const alleTreff = [
      ...treffTettsteder.map(t => ({ type: "tettsted", data: t })),
      ...treffHytter.map(h => ({ type: "hytte", data: h }))
    ];

    if (alleTreff.length === 0) {
      list.style.display = "none";
      return;
    }

    alleTreff.slice(0, 20).forEach(item => {
      const li = document.createElement("li");
      li.className = "autocomplete-item";
      li.textContent =
        item.type === "tettsted"
          ? item.data.tettsted
          : item.data.name;

      li.addEventListener("click", () => {
        input.value = li.textContent;
        list.style.display = "none";
        if (item.type === "tettsted") {
          visTettsted(item.data);
        } else {
          visHytte(item.data);
        }
      });

      list.appendChild(li);
    });

    list.style.display = "block";
  });

  document.addEventListener("click", e => {
    if (!list.contains(e.target) && e.target !== input) {
      list.style.display = "none";
    }
  });
}

  // Skjul listen når man klikker utenfor
  document.addEventListener("click", e => {
    if (!list.contains(e.target) && e.target !== input) {
      list.style.display = "none";
    }
  });



let tettsteder = [];
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

function safeNumber(val) {
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

// --------------------------
// HENT LANDSSNITT
// --------------------------
async function hentLandssnitt() {
  const soner = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  let alle = [];

  for (const sone of soner) {
    const pris = await hentPrisNaa(sone);
    if (pris !== null) alle.push(parseFloat(pris));
  }

  if (alle.length === 0) {
    console.warn("Fant ingen gyldige verdier for landssnitt");
    return null;
  }

  const snitt = alle.reduce((a, b) => a + b, 0) / alle.length;
  return snitt.toFixed(2);
}

// --------------------------
// HENT PRIS FOR NÅVÆRENDE TIME
// --------------------------
async function hentPrisNaa(sone) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();

    const verdier = data
      .map(p => parseFloat(p.NOK_per_kWh))
      .filter(v => !isNaN(v));

    if (verdier.length === 0) return null;

    const snitt = verdier.reduce((a, b) => a + b, 0) / verdier.length;
    return snitt.toFixed(2);
  } catch {
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
  const prisNaa = entry.sone ? await hentPrisNaa(entry.sone) : null;

  let tittel = "";
  if (type === "tettsted") {
    tittel = entry.tettsted || "Ukjent tettsted";
  } else if (type === "hytte") {
    tittel = entry.name || entry.tettsted || "Ukjent hytte";
  } else {
    tittel = entry.name || entry.tettsted || "Ukjent sted";
  }

  let html = `<h2>${tittel}</h2><ul>`;

  if (entry.operator)
    html += `<li><strong>Driftet av:</strong> ${entry.operator}</li>`;

  if (entry["dnt:classification"])
    html += `<li><strong>Type:</strong> ${entry["dnt:classification"]}</li>`;

  if (entry.website)
    html += `<li><strong>Nettside:</strong> <a href="${entry.website}" target="_blank">Besøk</a></li>`;

  if (prisNaa)
    html += `<li><strong>Pris nå:</strong> ${prisNaa} kr/kWh</li>`;

  html += "</ul>";

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

 async function hentPrisNaa(sone) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}/${day}_${sone}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const verdier = data
      .map(p => safeNumber(p.NOK_per_kWh))
      .filter(v => v != null);
    if (verdier.length === 0) return null;
    const snitt = verdier.reduce((a, b) => a + b, 0) / verdier.length;
    return snitt.toFixed(2);
  } catch {
    return null;
  }
}

// --------------------------
// VIS HYTTE
// --------------------------
async function visHytte(entry) {
    const prisNaa = await hentPrisNaa(entry.sone);
  if (!entry) return;

  if (aktivMarker) {
    map.removeLayer(aktivMarker);
    aktivMarker = null;
  }

async function visHytte(entry) {
  const lat = parseFloat(entry["@lat"]);
  const lon = parseFloat(entry["@lon"]);
  if (isNaN(lat) || isNaN(lon)) return;

  map.setView([lat, lon], 12);
  await oppdaterInfoboks(entry, "hytte");
}


// --------------------------
// LAST DATA
// --------------------------
let tettsteder = [];


async function lastTettsteder() {
  try {
    const res = await fetch("tettsteder_3.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    tettsteder = await res.json();
    console.log("Lastet tettsteder:", steder.length);
  } catch (err) {
    console.error("Feil ved lasting av tettsteder:", err);
    infobox.innerHTML =
      "<p>Feil ved lasting av tettsteder. Prøv å laste siden på nytt.</p>";
  }
}
function plasserAlleHytter() {
  hytter.forEach(h => {
    const lat = parseFloat(h["@lat"]);
    const lon = parseFloat(h["@lon"]);
    if (isNaN(lat) || isNaN(lon)) return;

    const marker = L.marker([lat, lon])
      .addTo(map)
      .bindTooltip(h.name || "Hytte", { direction: "top" });

    marker.on("click", () => visHytte(h));
  });
}

async function lastHytter() {
  try {
let hytter = [];

async function lastHytter() {
  const res = await fetch("dnt_hytter.json");
  hytter = await res.json();
}
    console.log("Lastet hytter:", hytter.length);
  } catch (err) {
    console.error("Feil ved lasting av hytter:", err);
    // Ikke krasj – bare logg og vis kort info
  }
}
await lastHytter();
plasserAlleHytter();
}

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
  await lastTettsteder();
  await lastHytter();
  await hentLandssnitt();
  plasserAlleHytter();
  leggTilAutocomplete();


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