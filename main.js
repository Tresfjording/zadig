// ------------------------------------------------------
// GLOBAL STATE 09.01.2026  - 12:00:11
// ------------------------------------------------------
let map;

let places = [];
let cabins = [];
let facts = [];
let searchIndex = [];

let selectedPlaceMarker = null;
let selectedCabinMarker = null;

let nationalAveragePrice = null;
let suggestionActiveIndex = -1;

// Hytteikon
const hytteIcon = L.icon({
  iconUrl: "/image/cabin16.png",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -8]
});

function normalizePlace(p) {
  return {
    // Navn
    


    
    t_sone: p.sone,

    // Tall
    k_innbyggere: p.antall,
    k_areal: p.areal,
    k_ansatte: p.sysselsatte,
    k_tilskudd: p.tilskudd,
    k_språk: p.språk,

    // Slagord
    k_slagord: p.k_slagord,
    f_slagord: p.f_slagord,

    // Koordinater
    k_lat_decimal: p.lat_decimal,
    k_lon_decimal: p.lon_decimal,

    // Behold originalen også
    ...p
  };
}


// ------------------------------------------------------
// PRISFARGER
// ------------------------------------------------------
function getPriceColor(price, avg) {
  if (price == null || avg == null) return "gray";
  const diff = price - avg;
  const rel = diff / avg;

  if (rel > 0.1) return "red";
  if (rel < -0.1) return "green";
  return "gold";
}

// ------------------------------------------------------
// MARKØR: HYTTE
// ------------------------------------------------------
function setSelectedCabinMarker(hytte) {
  const lat = hytte["@lat"];
  const lon = hytte["@lon"];
  if (!lat || !lon) return;

  if (selectedCabinMarker) map.removeLayer(selectedCabinMarker);

  selectedCabinMarker = L.marker([lat, lon], { icon: hytteIcon });
  selectedCabinMarker.addTo(map);
}

// ------------------------------------------------------
// MARKØR: TETTSTED
// ------------------------------------------------------
function setSelectedPlaceMarker(place) {
  const lat = parseFloat(String(place.k_lat_decimal).replace(",", "."));
  const lon = parseFloat(String(place.k_lon_decimal).replace(",", "."));
  if (!lat || !lon) return;

  if (selectedPlaceMarker) map.removeLayer(selectedPlaceMarker);

  selectedPlaceMarker = L.circleMarker([lat, lon], {
    radius: 10,
    color: "#0044aa",
    weight: 3,
    fillColor: "#66aaff",
    fillOpacity: 0.6,
  });

  selectedPlaceMarker.addTo(map);
}

// ------------------------------------------------------
// OPPSTART
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initMap();

  
    loadData().then(async () => {
      buildSearchIndex();
      initSearch();
      await initPrices();
      renderAllHytteMarkers();
      setRandomFact();
    })
    .catch((err) => {
      console.error("loadData feilet:", err);
      setRandomFact();
    });
});

// ------------------------------------------------------
// KART
// ------------------------------------------------------
function initMap() {
  map = L.map("map").setView([63.0, 11.0], 6);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);
}

// ------------------------------------------------------
// DATA
// ------------------------------------------------------
async function loadData() {
  try {
    const [samletResp, factsResp, hytterResp] = await Promise.all([
      fetch("tettsteder_3.json"),
      fetch("facts_all.json"),
      fetch("dnt_hytter.json"),
    ]);

    const samlet = await samletResp.json();
    facts = await factsResp.json();
    cabins = await hytterResp.json();

    const samletArray = Array.isArray(samlet) ? samlet : Object.values(samlet);

    // Normaliser tettstedene slik at de matcher resten av appen
    places = samletArray.map(normalizePlace);

    console.log("places:", places.length);
    console.log("cabins:", cabins.length);
  } catch (err) {
    console.error("Feil i loadData:", err);
  }
}

// ------------------------------------------------------
// STRØMPRISER
// ------------------------------------------------------
async function fetchZonePrices(priceArea) {
  if (!priceArea) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${priceArea}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return data;
  } catch {
    return null;
  }
}

async function fetchCurrentPowerPrice(priceArea) {
  const prices = await fetchZonePrices(priceArea);
  if (!prices) return null;

  const hour = new Date().getHours();
  const entry = prices[hour];

  return entry?.NOK_per_kWh ?? null;
}

async function initPrices() {
  const zones = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const allZoneData = [];

  for (const z of zones) {
    const data = await fetchZonePrices(z);
    if (data) allZoneData.push(data);
  }

  if (allZoneData.length === 0) return;

  const hour = new Date().getHours();
  let sum = 0;
  let count = 0;

  for (const zoneData of allZoneData) {
    const entry = zoneData[hour];
    if (entry && typeof entry.NOK_per_kWh === "number") {
      sum += entry.NOK_per_kWh;
      count++;
    }
  }

  if (count > 0) nationalAveragePrice = sum / count;
}

// ------------------------------------------------------
// HYTTEMARKØRER
// ------------------------------------------------------
function renderAllHytteMarkers() {
  if (!cabins || cabins.length === 0) return;

  cabins.forEach((h) => {
    const lat = h["@lat"];
    const lon = h["@lon"];
    if (!lat || !lon) return;

    const marker = L.marker([lat, lon], {
      title: h.name,
      icon: hytteIcon,
    });

    marker.bindTooltip(
      `${h.name} (${h["dnt:classification"] ?? "ukjent type"})`,
      {
        direction: "top",
        permanent: false,
        sticky: true,
        opacity: 1
      }
    );

    marker.on("mouseover", () => {
      updateInfoBoxWithCabin(h);
    });

    marker.addTo(map);
  });
}

// ------------------------------------------------------
// SØK
// ------------------------------------------------------
function buildSearchIndex() {
  searchIndex = [];

  places.forEach((t) => {
    if (t.t_knavn) searchIndex.push({ type: "t", label: t.t_knavn, ref: t });
  });

  cabins.forEach((h) => {
    if (h.name) searchIndex.push({ type: "h", label: h.name, ref: h });
  });

  searchIndex.sort((a, b) => a.label.localeCompare(b.label));
}

function initSearch() {
  // Støtt begge felt: hovedsøket og info-boksen
  const mainSearchInput = document.getElementById("place-search");
  const infoSearchInput = document.getElementById("infoSearch");
  const suggestionsEl = document.getElementById("search-suggestions");

  if (!suggestionsEl || (!mainSearchInput && !infoSearchInput)) return;

  function attachSearchListeners(inputEl) {
    inputEl.addEventListener("input", () => {
      const query = inputEl.value.toLowerCase();
      suggestionActiveIndex = -1;

      if (!query) {
        clearSuggestions();
        return;
      }

      const matches = searchIndex.filter((item) =>
        item.label.toLowerCase().includes(query)
      );

      renderSuggestions(matches);
    });

    inputEl.addEventListener("keydown", (e) => {
      const items = suggestionsEl.querySelectorAll(".suggestion-item");
      const maxIndex = items.length - 1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (maxIndex < 0) return;
        suggestionActiveIndex =
          suggestionActiveIndex < maxIndex ? suggestionActiveIndex + 1 : 0;
        updateSuggestionHighlight(items);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (maxIndex < 0) return;
        suggestionActiveIndex =
          suggestionActiveIndex > 0 ? suggestionActiveIndex - 1 : maxIndex;
        updateSuggestionHighlight(items);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (suggestionActiveIndex >= 0 && items[suggestionActiveIndex]) {
          items[suggestionActiveIndex].dispatchEvent(
            new MouseEvent("mousedown")
          );
        } else {
          handleSearch(inputEl.value);
        }
      } else if (e.key === "Escape") {
        clearSuggestions();
      }
    });
  }

  if (mainSearchInput) attachSearchListeners(mainSearchInput);
  if (infoSearchInput) attachSearchListeners(infoSearchInput);
}

function renderSuggestions(matches) {
  const suggestionsEl = document.getElementById("search-suggestions");
  suggestionsEl.innerHTML = "";

  if (!matches || matches.length === 0) {
    suggestionsEl.style.display = "none";
    return;
  }

  suggestionsEl.style.display = "block";

  matches.slice(0, 10).forEach((item) => {
    const div = document.createElement("li");
    div.className = "suggestion-item";
    div.textContent = item.label;

    div.addEventListener("mousedown", () => {
      handleSearch(item.label);
    });

    suggestionsEl.appendChild(div);
  });
}

function updateSuggestionHighlight(items) {
  items.forEach((item, index) => {
    if (index === suggestionActiveIndex) item.classList.add("active");
    else item.classList.remove("active");
  });
}

function clearSuggestions() {
  const suggestionsEl = document.getElementById("search-suggestions");
  suggestionsEl.innerHTML = "";
  suggestionsEl.style.display = "none";
  suggestionActiveIndex = -1;
}

function handleSearch(label) {
  if (!label) {
    console.log("handleSearch: tom label");
    return;
  }

  console.log("handleSearch: søker etter =", label);

  const match = searchIndex.find(
    (item) => item.label.toLowerCase() === label.toLowerCase()
  );

  console.log("handleSearch: match =", match);

  if (!match) {
    clearSuggestions && clearSuggestions();
    return;
  }

  // Sett verdien tilbake i infoSearch (og place-search hvis den finnes)
  const mainSearchInput = document.getElementById("place-search");
  const infoSearchInput = document.getElementById("infoSearch");

  if (mainSearchInput) mainSearchInput.value = match.label;
  if (infoSearchInput) infoSearchInput.value = match.label;

  if (match.type === "t") {
    focusOnPlace(match.ref);
    updateInfoBoxWithPlace(match.ref);
    setSelectedPlaceMarker(match.ref);
  } else if (match.type === "h") {
    focusOnCabin(match.ref);
    updateInfoBoxWithCabin(match.ref);
    setSelectedCabinMarker(match.ref);
  }

  if (typeof clearSuggestions === "function") {
    clearSuggestions();
  }
}

// ------------------------------------------------------
// KARTFOKUS
// ------------------------------------------------------
function focusOnPlace(place) {
  const lat = parseFloat(String(place.k_lat_decimal).replace(",", "."));
  const lon = parseFloat(String(place.k_lon_decimal).replace(",", "."));
  if (!lat || !lon) return;

  map.setView([lat, lon], 11);
}

function focusOnCabin(hytte) {
  const lat = hytte["@lat"];
  const lon = hytte["@lon"];
  if (!lat || !lon) return;

  map.setView([lat, lon], 13);
}

// ------------------------------------------------------
// INFOBOKS
// ------------------------------------------------------
async function updateInfoBoxWithPlace(place) {
  setSelectedPlaceMarker(place);
  if (!place) return;

  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");
  if (!titleEl || !contentEl) return;

  const priceArea = place.t_sone?.toUpperCase();
  const strømpris = await fetchCurrentPowerPrice(priceArea);

  const priceText =
    strømpris != null ? `${strømpris.toFixed(2)} kr/kWh` : "Ikke tilgjengelig";

  let avgText = "Ukjent";
  if (nationalAveragePrice != null)
    avgText = `${nationalAveragePrice.toFixed(2)} kr/kWh`;

  const color = getPriceColor(strømpris, nationalAveragePrice);

  titleEl.textContent = place.navn || "Ukjent tettsted";

  contentEl.innerHTML = `
    <div class="info-row">
      <div class="info-col">
        <p><strong>Tettsted:</strong> ${place.tettsted ?? ""}</p>
        <p><strong>Kommune nr:</strong> ${place.k_nr ?? ""}</p>
        <p><strong>Kommune</strong> ${place.name ?? ""}</p>
        <p><strong>Fylke:</strong> ${place.fylke ?? ""}</p>
        <p><strong>Sone:</strong> ${place.sone ?? ""}</p>
      </div>
      <div class="info-col">
        <p><strong>Areal:</strong> ${place.areal ?? ""}</p>
        <p><strong>Ansatte:</strong> ${place.sysselsatte ?? ""}</p>
        <p><strong>Tilskudd:</strong> ${place.tilskudd ?? ""}</p>
        <p><strong>Språk:</strong> ${place.k_slagord ?? ""}</p>
        <p><strong>Slagord:</strong> ${place.f_slagord ?? ""}</p>
      </div>
    </div>



    <div class="info-row price-row">
      <p><strong>Strømpris nå:</strong>
        <span class="price-badge price-${color}">${priceText}</span>
      </p>
      <p><strong>Landsgjennomsnitt nå:</strong> ${avgText}</p>
    </div>
  `;
}

async function updateInfoBoxWithCabin(hytte) {
  setSelectedCabinMarker(hytte);
  if (!hytte) return;

  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");
  if (!titleEl || !contentEl) return;

  const priceArea = hytte.t_sone?.toUpperCase();
  const strømpris = await fetchCurrentPowerPrice(priceArea);

  const priceText =
    strømpris != null ? `${strømpris.toFixed(2)} kr/kWh` : "Ikke tilgjengelig";

  let avgText = "Ukjent";
  if (nationalAveragePrice != null)
    avgText = `${nationalAveragePrice.toFixed(2)} kr/kWh`;

  const color = getPriceColor(strømpris, nationalAveragePrice);

  titleEl.textContent = hytte.name || "Ukjent hytte";

  contentEl.innerHTML = `
    <div class="info-row">
      <div class="info-col">
        <p><strong>Hytte:</strong> ${hytte.name}</p>
        <p><strong>Type:</strong> ${hytte["dnt:classification"] ?? ""}</p>
        <p><strong>Operatør:</strong> ${hytte.operator ?? ""}</p>
        <p><strong>Kommune:</strong> ${hytte.k_navn ?? ""}</p>
        <p><strong>Fylke:</strong> ${hytte.t_fnavn ?? ""}</p>
      </div>
      <div class="info-col">
        <p><strong>Sone:</strong> ${hytte.t_sone ?? ""}</p>
        <p><strong>Innbyggere:</strong> ${hytte.k_innbyggere ?? ""}</p>
        <p><strong>Areal:</strong> ${hytte.k_areal ?? ""}</p>
        <p><strong>Tilskudd:</strong> ${hytte.k_tilskudd ?? ""}</p>
        <p><strong>Språk:</strong> ${hytte.k_språk ?? ""}</p>
      </div>
    </div>

    <div class="info-row">
      <p><strong>Kommune-slagord:</strong> ${hytte.k_slagord ?? ""}</p>
      <p><strong>Fylkes-slagord:</strong> ${hytte.f_slagord ?? ""}</p>
    </div>

    <div class="info-row price-row">
      <p><strong>Strømpris nå:</strong>
        <span class="price-badge price-${color}">${priceText}</span>
      </p>
      <p><strong>Landsgjennomsnitt nå:</strong> ${avgText}</p>
    </div>

    <p>
      <a href="${hytte.website}" target="_blank" rel="noopener noreferrer">
        Se mer på UT.no
      </a>
    </p>
  `;
}

// ------------------------------------------------------
// TRIVIA / FUNFACTS
// ------------------------------------------------------
function setRandomFact() {
  const el = document.getElementById("random-fact");
  if (!el || !facts || facts.length === 0) return;

  const random = facts[Math.floor(Math.random() * facts.length)];

  if (typeof random === "string") {
    el.textContent = random;
  } else if (random && typeof random === "object" && random.fact) {
    el.textContent = random.fact;
  } else {
    el.textContent = "Visste du at Norge er et ganske fint land?";
  }
}