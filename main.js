// Antatt struktur for Samlet.json (tilpass hvis nødvendig):
// [
//   {
//     "t_id": "...",
//     "t_navn": "...",
//     "t_lat": 62.5,
//     "t_lng": 7.0,
//     "t_sone": "NO3",
//     ...
//   },
//   {
//     "h_id": "...",
//     "h_navn": "...",
//     "h_lat": 62.6,
//     "h_lng": 7.1,
//     "h_operatør": "...",
//     "h_type": "...",
//     "h_url": "https://...",
//     "h_sone": "NO3",
//     "t_id": "..."
//   }
// ]
//
// Antatt struktur for facts_all.json:
// ["Faktasetning 1", "Faktasetning 2", ...]


// --------- Globale variabler ---------
let map;
let samletData = [];
let tettsteder = [];
let hytter = [];
let hytteMarkers = [];
let valgtTettsted = null;
let aktivHytte = null;
let strømCache = {}; // cache per dato og prisområde
let facts = [];

const searchInput = document.getElementById("place-search");
const suggestionsEl = document.getElementById("search-suggestions");
const infoTitleEl = document.getElementById("info-title");
const infoContentEl = document.getElementById("info-content");
const powerPriceEl = document.getElementById("power-price");
const randomFactEl = document.getElementById("random-fact");


// --------- Init ---------
document.addEventListener("DOMContentLoaded", async () => {
  initMap();
 try {
    await loadData();
} catch (err) {
    console.error("loadData feilet, men vi fortsetter:", err);
}
  initSearch();
  renderAllHytteMarkers();
  setRandomFact();
});


// --------- Kart ---------
function initMap() {
  map = L.map("map", {
    minZoom: 3,
    maxZoom: 10,
    worldCopyJump: true
  }).setView([64.5, 12], 4.3); // grovt sentrum over Norge

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap-bidragsytere"
  }).addTo(map);
}


// --------- Last data ---------
async function loadData() {
  try {
    const [samletResp, factsResp] = await Promise.all([
      fetch("samlet.json"),
      fetch("facts_all.json")
    ]);

    samletData = await samletResp.json();
    facts = await factsResp.json();

    // Del opp i tettsteder og hytter.
    // Juster logikken til faktisk struktur hvis nødvendig.
    tettsteder = samletData.filter(item => item.t_navn && item.t_lat && item.t_lng);
    hytter = samletData.filter(item => item.h_navn && item.h_lat && item.h_lng);
  } catch (err) {
    console.error("Feil ved lasting av data:", err);
  }
}


// --------- Søk / autocomplete ---------
console.log("initSearch kjører!");
function initSearch() {
  searchInput.addEventListener("input", onSearchInput);
  searchInput.addEventListener("focus", onSearchInput);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      hideSuggestions();
    }
  });
}

function onSearchInput() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    hideSuggestions();
    return;
  }

  const forslag = [];

  // Tettsteder
  tettsteder.forEach(t => {
    if (t.t_navn && t.t_navn.toLowerCase().includes(query)) {
      forslag.push({
        type: "tettsted",
        label: t.t_navn,
        data: t
      });
    }
  });

  // Hytter
  hytter.forEach(h => {
    if (h.h_navn && h.h_navn.toLowerCase().includes(query)) {
      forslag.push({
        type: "hytte",
        label: h.h_navn,
        data: h
      });
    }
  });

  renderSuggestions(forslag.slice(0, 30));
}

function renderSuggestions(list) {
  suggestionsEl.innerHTML = "";

  if (!list.length) {
    suggestionsEl.classList.add("hidden");
    return;
  }

  list.forEach(item => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "suggestion-label";
    label.textContent = item.label;

    const type = document.createElement("span");
    type.className = "suggestion-type";
    type.textContent = item.type === "tettsted" ? "tettsted" : "hytte";

    li.appendChild(label);
    li.appendChild(type);

    li.addEventListener("click", () => {
      searchInput.value = item.label;
      hideSuggestions();

      if (item.type === "tettsted") {
        velgTettsted(item.data);
      } else {
        // Ved valg av hytte: bruk tilhørende tettsted hvis mulig
        velgHytteDirekte(item.data);
      }
    });

    suggestionsEl.appendChild(li);
  });

  suggestionsEl.classList.remove("hidden");
}

function hideSuggestions() {
  suggestionsEl.classList.add("hidden");
}


// --------- Markører ---------
function renderAllHytteMarkers() {
  // Fjern gamle
  hytteMarkers.forEach(m => map.removeLayer(m));
  hytteMarkers = [];

  hytter.forEach(h => {
    const marker = L.marker([h.h_lat, h.h_lng], {
      icon: L.divIcon({
        className: "hytte-marker",
        iconSize: [0, 0]
      })
    }).addTo(map);

    marker.on("mouseover", () => {
      aktivHytte = h;
      updateInfoPanelForHytte(h);
      L.popup({
        offset: [0, -10],
        closeButton: false,
        autoClose: true,
        className: "hytte-popup"
      })
        .setLatLng([h.h_lat, h.h_lng])
        .setContent(`<strong>${h.h_navn}</strong>`)
        .openOn(map);
    });

    marker.on("mouseout", () => {
      aktivHytte = null;
      // Gå tilbake til valgt tettsted om vi har ett, ellers blank
      if (valgtTettsted) {
        updateInfoPanelForTettsted(valgtTettsted);
      } else {
        clearInfoPanel();
      }
    });

    hytteMarkers.push(marker);
  });
}

let tettstedMarker = null;

function setTettstedMarker(lat, lng, colorClass) {
  if (tettstedMarker) {
    map.removeLayer(tettstedMarker);
  }

  tettstedMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: "tettsted-marker",
      iconSize: [16, 16]
    })
  }).addTo(map);

  // Fargeringen (prisindikator) håndteres hovedsakelig i infoboks,
  // så markøren kan være nøytral. Hvis du vil, kan du variere farge med CSS-klasser her.
}


// --------- Velg tettsted / hytte ---------
async function velgTettsted(t) {
  valgtTettsted = t;
  aktivHytte = null;

  map.flyTo([t.t_lat, t.t_lng], 8, {
    duration: 0.8
  });
}
 // Strømpris
async function loadPowerPrice(area = "NO3") {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${area}.json`;

        const response = await fetch(url);

        if (!response.ok) {
            console.warn("Klarte ikke hente JSON:", response.status);
            return null;
        }

        let data;
        try {
            data = await response.json();
        } catch (err) {
            console.error("JSON-parsing feilet:", err);
            return null;
        }

        const hour = now.getHours();
        if (!data[hour]) return null;

        return data[hour].NOK_per_kWh;

    } catch (err) {
        console.error("loadPowerPrice feilet:", err);
        return null;
    }
}

const POWER_AREAS = ["NO1", "NO2", "NO3", "NO4", "NO5"];

async function loadNationalAveragePrice() {
    const prices = [];

    for (const area of POWER_AREAS) {
        const price = await loadPowerPrice(area);
        if (price != null) prices.push(price);
    }

    if (!prices.length) return null;

    const sum = prices.reduce((a, b) => a + b, 0);
    return sum / prices.length;
}

// --------- Infoboks ---------
function clearInfoPanel() {
  infoTitleEl.textContent = "Ingen sted valgt";
  infoContentEl.innerHTML = `<p class="info-placeholder">Velg et tettsted eller hold musepekeren over en hytte.</p>`;
  powerPriceEl.innerHTML = "";
}

function updateInfoPanelForTettsted(t, strømInfo) {
  infoTitleEl.textContent = t.t_navn || "Tettsted";

  const rows = [];

  // Legg inn de t_-feltene du faktisk har / vil vise
  if (t.t_id) {
    rows.push(row("t_id", t.t_id));
  }
  if (t.t_kommune) {
    rows.push(row("t_kommune", t.t_kommune));
  }
  if (t.t_fylke) {
    rows.push(row("t_fylke", t.t_fylke));
  }
  if (t.t_sone) {
    rows.push(row("t_sone", t.t_sone));
  }

  infoContentEl.innerHTML = rows.join("");

  renderStrømInfo(strømInfo, t.t_sone);
}

function updateInfoPanelForHytte(h) {
  infoTitleEl.textContent = h.h_navn || "Hytte";

  const rows = [];

  rows.push(row("h_id", h.h_id));
  rows.push(row("h_navn", h.h_navn));
  rows.push(row("h_operatør", h.h_operatør));
  rows.push(row("h_type", h.h_type));

  if (h.h_url) {
    rows.push(
      `<div class="info-row">
        <span class="info-label">h_url</span>
        <span class="info-value"><a href="${h.h_url}" target="_blank" rel="noopener noreferrer">${h.h_url}</a></span>
      </div>`
    );
  } else {
    rows.push(row("h_url", ""));
  }

  infoContentEl.innerHTML = rows.join("");

  // Strømpris baseres på hyttens sone om den finnes, ellers fall-back til valgt tettsteds sone
  const sone = h.h_sone || (valgtTettsted && valgtTettsted.t_sone) || null;
  if (sone) {
    hentStrømInfoForSone(sone).then(strømInfo => {
      renderStrømInfo(strømInfo, sone);
    });
  } else {
    powerPriceEl.innerHTML = "";
  }
}

function row(label, value) {
  if (value === undefined || value === null) value = "";
  return `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value">${value}</span>
    </div>
  `;
}


// --------- Strømpris fra hvakosterstrommen.no ---------
// Enkel implementasjon: henter dagens priser for alle områder, beregner landsgjennomsnitt,
// og plukker ut aktuell sone og gjeldende time.
async function hentStrømInfoForSone(sone) {
  if (!sone) return null;

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datoKey = `${y}-${m}-${d}`;

  if (!strømCache[datoKey]) {
    strømCache[datoKey] = {};
  }

  if (!strømCache[datoKey].all) {
    try {
      // Antatt API-endepunkt – tilpass hvis dere allerede har noe implementert!
      // Eksempel fra dokumentasjon: /api/v1/prices/2024/01-31_NO3.json
      const areas = ["NO1", "NO2", "NO3", "NO4", "NO5"];
      const allData = {};

      await Promise.all(
        areas.map(async area => {
          const url = `https://www.hvakosterstrommen.no/api/v1/prices/${y}/${m}-${d}_${area}.json`;
          try {
            const resp = await fetch(url);
            if (!resp.ok) return;
            const data = await resp.json();
            allData[area] = data;
          } catch (err) {
            console.warn("Kunne ikke hente strømdata for", area, err);
          }
        })
      );

      strømCache[datoKey].all = allData;
    } catch (err) {
      console.error("Feil ved henting av strømpriser:", err);
      return null;
    }
  }

  const allData = strømCache[datoKey].all;
  const hour = now.getHours();

  // Finn pris for valgt sone i aktuell time
  const zoneData = allData[sone];
  if (!zoneData || !zoneData.length) return null;

  const currentZone = zoneData.find(e => {
    const from = new Date(e.time_start);
    return from.getHours() === hour;
  }) || zoneData[0];

  const priceZone = currentZone.NOK_per_kWh;

  // Landsgjennomsnitt: gj.snitt av tilgjengelige soner i aktuell time
  let prices = [];
  Object.keys(allData).forEach(area => {
    const data = allData[area];
    if (!Array.isArray(data) || !data.length) return;
    const entry =
      data.find(e => new Date(e.time_start).getHours() === hour) || data[0];
    if (entry && typeof entry.NOK_per_kWh === "number") {
      prices.push(entry.NOK_per_kWh);
    }
  });

  if (!prices.length) return null;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

  let relativeColor = "yellow";
  if (priceZone > avg * 1.02) {
    relativeColor = "red";
  } else if (priceZone < avg * 0.98) {
    relativeColor = "green";
  }

  return {
    priceZone,
    avg,
    zone: sone,
    relativeColor
  };
}

function renderStrømInfo(info, sone) {
  if (!info) {
    powerPriceEl.innerHTML = "";
    return;
  }

  const formattedZone = info.priceZone.toFixed(3).replace(".", ",");
  const formattedAvg = info.avg.toFixed(3).replace(".", ",");

  powerPriceEl.innerHTML = `
    <div class="power-price-line">
      <span class="info-label">Strømpris nå (${sone})</span>
      <span class="power-pill">
        <span class="power-dot ${info.relativeColor}"></span>
        <span>${formattedZone} kr/kWh</span>
      </span>
    </div>
    <div class="power-price-line">
      <span class="info-label">Landsgjennomsnitt</span>
      <span class="info-value">${formattedAvg} kr/kWh</span>
    </div>
  `;
}


// --------- Random fact nederst i infoboksen ---------
function setRandomFact() {
  if (!Array.isArray(facts) || !facts.length) {
    randomFactEl.textContent = "";
    return;
  }
  const idx = Math.floor(Math.random() * facts.length);
  randomFactEl.textContent = facts[idx];
}