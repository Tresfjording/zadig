// 15.01.2026  - 17:30:00
let map;
let kommuner = []; // Kommune-info fra tettsteder.json
let kommunerGeometri = []; // Kommune-grenser fra kommuner.json
let hytter = [];
let fjelltopper = []; // Fjelltopper fra fjelltopper.json
let fjellmarkører = []; // Lagre markører for toggle
let tettstedMarkører = []; // Lagre tettsteds-markører for toggle
let hytteMarkører = []; // Lagre hytte-markører for toggle
let kommunePolygoner = []; // Lagre kommune-grenser for toggle
let facts = [];
let searchIndex = [];
let currentTileLayer = null; // Lagre gjeldende tile layer

const hytteIcon = L.icon({
  iconUrl: "image/cabin16.png",
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// Tile layer definisjoner
const tileLayers = {
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors"
  },
  sat: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri, DigitalGlobe, Earthstar Geographics"
  },
  topo: {
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap contributors"
  }
};

// -------------------- STARTUP --------------------
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadData()
    .then(() => {
      console.log("Data lastet!");
      buildSearchIndex();
      initSearch();
      initToggleControls();
      renderAllMarkers();
      setRandomFact();
    })
    .catch(err => {
      console.error("Feil ved dataloading:", err);
      renderAllMarkers();
      setRandomFact();
    });
});

// -------------------- MAP --------------------
function initMap() {
  map = L.map("map").setView([63.0, 11.0], 6);
  
  // Last OSM som standard
  currentTileLayer = L.tileLayer(tileLayers.osm.url, {
    attribution: tileLayers.osm.attribution
  }).addTo(map);
  
  // Lukk forslagslisten når det klikkes på tomme områder på kartet
  map.on("click", () => {
    closeSuggestions();
  });
  
  // Init layout selector
  initLayoutSelector();
  
  console.log("Kart initialisert");
}

// -------------------- LAYOUT SELECTOR --------------------
function initLayoutSelector() {
  const layoutDropdown = document.getElementById("map-layout");
  
  if (!layoutDropdown) {
    console.error("Layout dropdown ikke funnet i HTML");
    return;
  }
  
  layoutDropdown.addEventListener("change", (e) => {
    changeMapLayout(e.target.value);
  });
}

function changeMapLayout(layoutKey) {
  if (!tileLayers[layoutKey]) {
    console.error("Ukjent kartkart:", layoutKey);
    return;
  }
  
  // Fjern gammelt tile layer
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer);
  }
  
  // Legg til nytt tile layer
  currentTileLayer = L.tileLayer(tileLayers[layoutKey].url, {
    attribution: tileLayers[layoutKey].attribution
  }).addTo(map);
  
  console.log("Kartkart byttet til:", layoutKey);
}

// -------------------- DATA LOADING --------------------
async function loadData() {
  try {
    const [tettstederResp, kommunerGeoResp, hytterResp, factsResp, fjellResp] = await Promise.all([
      fetch("tettsteder.json"),
      fetch("kommuner.json"),
      fetch("dnt_hytter.json"),
      fetch("facts_all.json"),
      fetch("fjelltopper.json")
    ]);

    if (!tettstederResp.ok || !kommunerGeoResp.ok || !hytterResp.ok || !factsResp.ok) {
      throw new Error("En eller flere datafiler kunne ikke hentes");
    }

    const tettstederData = await tettstederResp.json();
    const kommunerGeoData = await kommunerGeoResp.json();
    const hytterData = await hytterResp.json();
    const factsData = await factsResp.json();
    const fjellData = fjellResp.ok ? await fjellResp.json() : [];

    // Last kommune-info fra tettsteder.json
    kommuner = Array.isArray(tettstederData) ? tettstederData : [];

    // Last kommune-geometri fra kommuner.json
    if (kommunerGeoData.features) {
      kommunerGeometri = kommunerGeoData.features.map(feature => ({
        navn: feature.properties.kommunenavn,
        nummer: feature.properties.kommunenummer,
        geometry: feature.geometry
      }));
    }
    hytter = Array.isArray(hytterData)
      ? hytterData
      : (hytterData.cabins || hytterData.hytter || []);
    
    facts = Array.isArray(factsData)
      ? factsData
      : (factsData.facts || []);

    // Last fjelltopper
    fjelltopper = Array.isArray(fjellData) ? fjellData : [];

    console.log(`Lastet: ${kommuner.length} kommuner, ${kommunerGeometri.length} kommune-grenser, ${hytter.length} hytter, ${fjelltopper.length} fjelltopper, ${facts.length} fakta`);
  } catch (err) {
    console.error("Feil ved dataloading:", err);
    throw err;
  }
}

// -------------------- SEARCH --------------------
function buildSearchIndex() {
  searchIndex = [];

  kommuner.forEach(k => {
    const navn = k.t_tettsted || k.name;
    if (navn) {
      searchIndex.push({ type: "k", label: navn, ref: k });
    }
  });

  hytter.forEach(h => {
    const navn = h.h_navn || h.h_name;
    if (navn) {
      searchIndex.push({ type: "h", label: navn, ref: h });
    }
  });

  fjelltopper.forEach(f => {
    const navn = f.Namn || f.Name;
    if (navn) {
      searchIndex.push({ type: "f", label: navn, ref: f });
    }
  });

  searchIndex.sort((a, b) => a.label.localeCompare(b.label));
  console.log(`Søkeindeks bygget med ${searchIndex.length} elementer`);
}

function initSearch() {
  const searchInput = document.getElementById("place-search");
  const suggestionsEl = document.getElementById("search-suggestions");

  if (!searchInput || !suggestionsEl) {
    console.error("Søkeelementer ikke funnet i HTML");
    return;
  }

  let currentIndex = -1;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    const matches = searchIndex.filter(item =>
      item.label.toLowerCase().includes(query)
    );
    renderSuggestions(matches);
    currentIndex = -1;
  });

  searchInput.addEventListener("keydown", (e) => {
    const items = suggestionsEl.querySelectorAll(".suggestion-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      currentIndex = (currentIndex + 1) % items.length;
      updateSuggestionHighlight(items, currentIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      currentIndex = (currentIndex - 1 + items.length) % items.length;
      updateSuggestionHighlight(items, currentIndex);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentIndex >= 0 && items[currentIndex]) {
        // Velg aktiv item
        items[currentIndex].click();
      } else if (items.length > 0) {
        // Hvis ingen er valgt, velg første item
        items[0].click();
      } else if (searchInput.value) {
        // Hvis ingen forslag, søk på det som er skrevet
        handleSearch(searchInput.value);
      }
    }
  });
}

function updateSuggestionHighlight(items, index) {
  items.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  // Scroll aktiv item til synlig område
  if (items[index]) {
    items[index].scrollIntoView({ block: "nearest" });
  }
}

function closeSuggestions() {
  const suggestionsEl = document.getElementById("search-suggestions");
  suggestionsEl.innerHTML = "";
  suggestionsEl.style.display = "none";
}

function renderSuggestions(matches) {
  const suggestionsEl = document.getElementById("search-suggestions");
  suggestionsEl.innerHTML = "";

  if (!matches || matches.length === 0) {
    suggestionsEl.style.display = "none";
    return;
  }

  suggestionsEl.style.display = "block";

  matches.slice(0, 10).forEach(item => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = item.label;
    div.addEventListener("mousedown", () => {
      handleSearch(item.label);
    });
    div.addEventListener("click", () => {
      handleSearch(item.label);
    });
    suggestionsEl.appendChild(div);
  });
}

function handleSearch(label) {
  const match = searchIndex.find(item =>
    item.label.toLowerCase() === label.toLowerCase()
  );

  if (!match) return;

  document.getElementById("place-search").value = label;
  closeSuggestions();

  if (match.type === "k") {
    focusOnKommune(match.ref);
    updateInfoBoxKommune(match.ref);
  } else if (match.type === "h") {
    focusOnCabin(match.ref);
    updateInfoBoxCabin(match.ref);
  } else if (match.type === "f") {
    focusOnMountain(match.ref);
    updateInfoBoxMountain(match.ref);
  }
}

// -------------------- MAP FOCUS --------------------
function focusOnKommune(k) {
  const lat = parseFloat(String(k.t_lat || "").replace(",", "."));
  const lon = parseFloat(String(k.t_lon || "").replace(",", "."));
  if (!isNaN(lat) && !isNaN(lon)) {
    map.setView([lat, lon], 11);
  }
}

function focusOnCabin(cabin) {
  const lat = parseFloat(String(cabin.h_lat || "").replace(",", "."));
  const lon = parseFloat(String(cabin.h_lon || "").replace(",", "."));
  if (!isNaN(lat) && !isNaN(lon)) {
    map.setView([lat, lon], 13);
  }
}

function focusOnMountain(fjell) {
  const lat = parseFloat(String(fjell.Lat || "").replace(",", "."));
  const lon = parseFloat(String(fjell.Lon || "").replace(",", "."));
  if (!isNaN(lat) && !isNaN(lon)) {
    map.setView([lat, lon], 12);
  }
}

// -------------------- INFO BOX --------------------
async function updateInfoBoxKommune(k) {
  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");

  if (!titleEl || !contentEl) return;

  const placeName = k.t_tettsted || "Ukjent";
  titleEl.textContent = placeName;

  const zone = k.t_sone || "NO1";
  const currentPrice = await fetchPriceForZone(zone);
  const nationalAvg = await fetchNationalAverage();

  const priceColor = getPriceColor(currentPrice, nationalAvg);

  const fylke = k.t_fylke || "?";
  const innbyggere = k.t_antall || "?";
  const areal = k.t_areal || "?";

  contentEl.innerHTML = `
    <p><strong>Kommune:</strong> ${placeName}</p>
    <p><strong>Sone:</strong> ${zone}</p>
    <p><strong>Fylke:</strong> ${fylke}</p>
    <p><strong>Innbyggere:</strong> ${innbyggere}</p>
    <p><strong>Areal:</strong> ${areal} km²</p>
    <p><strong>Strømpris nå:</strong> <span style="color: ${priceColor};">${currentPrice ? currentPrice.toFixed(2) : "?"} kr/kWh ekskl. moms</span></p>
    <p><strong>Landsnitt:</strong> ${nationalAvg ? nationalAvg.toFixed(2) : "?"} kr/kWh ekskl. moms</p>
  `;
}

async function updateInfoBoxCabin(cabin) {
  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");

  if (!titleEl || !contentEl) return;

  const cabinName = cabin.h_navn || cabin.h_name || "Ukjent hytte";
  titleEl.textContent = cabinName;

  const operator = cabin.h_operatør || cabin["h_dnt:operator"] || "?";
  const classification = cabin.h_type || cabin["h_dnt:classification"] || "?";
  const website = cabin.h_website || cabin.h_url || cabin.h_link || "";

  let html = `
    <p><strong>Hytte:</strong> ${cabinName}</p>
    <p><strong>Type:</strong> ${classification}</p>
    <p><strong>Operatør:</strong> ${operator}</p>
  `;

  if (website) {
    html += `<p><a href="${website}" target="_blank">Besøk hjemmeside</a></p>`;
  }

  contentEl.innerHTML = html;
}

function updateInfoBoxMountain(fjell) {
  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");

  if (!titleEl || !contentEl) return;

  const navn = fjell.Namn || fjell.Name || "Ukjent fjell";
  const høyde = fjell["Høgde over havet"] || "?";
  const kommune = fjell.Kommune || "?";
  const fylke = fjell.Fylke || "?";

  titleEl.textContent = navn;

  contentEl.innerHTML = `
    <p><strong>Fjell:</strong> ${navn}</p>
    <p><strong>Høyde:</strong> ${høyde} m</p>
    <p><strong>Kommune:</strong> ${kommune}</p>
    <p><strong>Fylke:</strong> ${fylke}</p>
  `;
}

// -------------------- PRICE --------------------
function buildPriceUrl(zone) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${zone}.json`;
}

async function fetchPriceForZone(zone) {
  try {
    const url = buildPriceUrl(zone);
    const response = await fetch(url);
    const data = await response.json();
    const hour = new Date().getHours();
    return data[hour]?.NOK_per_kWh ?? null;
  } catch (err) {
    console.error(`Feil ved henting av pris for sone ${zone}:`, err);
    return null;
  }
}

async function fetchNationalAverage() {
  const zones = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const prices = await Promise.all(zones.map(z => fetchPriceForZone(z)));
  const validPrices = prices.filter(p => typeof p === "number");
  if (!validPrices.length) return null;
  return validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
}

function getPriceColor(price, national) {
  if (!price || !national) return "gray";
  const diff = price - national;
  if (diff < -0.05) return "green";
  if (diff > 0.05) return "red";
  return "orange";
}

// -------------------- MARKERS --------------------
function renderAllMarkers() {
  renderKommunePolygons();
  renderCabinMarkers();
  renderKommuneMarkers();
}

function renderKommunePolygons() {
  if (!kommunerGeometri || kommunerGeometri.length === 0) return;

  kommunePolygoner = []; // Reset liste

  kommunerGeometri.forEach(geom => {
    if (geom.geometry && geom.geometry.coordinates) {
      const coords = geom.geometry.coordinates[0]; // Første ring av polygon
      const latLngs = coords.map(c => [c[1], c[0]]); // Konverter fra [lon, lat] til [lat, lon]
      const polygon = L.polygon(latLngs, {
        color: "#0077cc",
        weight: 2,
        opacity: 0.6,
        fillOpacity: 0.1
      });
      polygon.bindTooltip(geom.navn, { direction: "center" });
      
      // Finn tilsvarende kommune-info fra tettsteder.json
      const kommune = kommuner.find(k => k.t_tettsted === geom.navn);
      if (kommune) {
        polygon.on("mouseover", () => updateInfoBoxKommune(kommune));
      }
      
      polygon.addTo(map);
      kommunePolygoner.push(polygon); // Lagre for toggle
    }
  });

  console.log(`Tegnet ${kommunePolygoner.length} kommunegrenser`);
}

function renderCabinMarkers() {
  if (!hytter || hytter.length === 0) return;

  hytteMarkører = []; // Reset liste

  hytter.forEach(h => {
    const lat = parseFloat(String(h.h_lat || "").replace(",", "."));
    const lon = parseFloat(String(h.h_lon || "").replace(",", "."));

    if (!isNaN(lat) && !isNaN(lon)) {
      const marker = L.marker([lat, lon], { icon: hytteIcon });
      const name = h.h_navn || h.h_name || "Ukjent";
      const type = h.h_type || h["h_dnt:classification"] || "";
      marker.bindTooltip(`${name} - ${type}`, { direction: "top" });
      marker.on("mouseover", () => updateInfoBoxCabin(h));
      marker.addTo(map);
      hytteMarkører.push(marker); // Lagre for toggle
    }
  });

  console.log(`Tegnet ${hytteMarkører.length} hyttemarkører`);
}

function renderKommuneMarkers() {
  if (!kommuner || kommuner.length === 0) return;

  tettstedMarkører = []; // Reset liste

  kommuner.forEach(k => {
    const lat = parseFloat(String(k.t_lat || "").replace(",", "."));
    const lon = parseFloat(String(k.t_lon || "").replace(",", "."));

    if (!isNaN(lat) && !isNaN(lon)) {
      const zone = k.t_sone || "NO1";
      const marker = L.circleMarker([lat, lon], {
        radius: 5,
        color: "#333",
        fillColor: "#0077cc",
        fillOpacity: 0.7,
        weight: 1
      });
      const name = k.t_tettsted || "Ukjent";
      marker.bindTooltip(name, { direction: "top" });
      marker.on("mouseover", () => updateInfoBoxKommune(k));
      marker.addTo(map);
      tettstedMarkører.push(marker); // Lagre for toggle
    }
  });

  console.log(`Tegnet ${tettstedMarkører.length} kommunemarkører`);
}

// -------------------- FACTS --------------------
function setRandomFact() {
  const el = document.getElementById("random-fact");
  if (!el || !facts || facts.length === 0) return;

  let fact;
  if (Array.isArray(facts)) {
    // Hvis facts er en liste med objekter med "fact" felt
    if (facts[0] && facts[0].fact) {
      fact = facts[Math.floor(Math.random() * facts.length)].fact;
    } else {
      // Hvis facts er en liste med strings
      fact = facts[Math.floor(Math.random() * facts.length)];
    }
  }

  if (fact) {
    el.innerHTML = `<p><strong>Visste du:</strong> ${fact}</p>`;
  }
}

// -------------------- TOGGLE CONTROLS --------------------
function initToggleControls() {
  const toggleMountains = document.getElementById("toggle-mountains");
  const toggleCommunities = document.getElementById("toggle-communities");
  const toggleCabins = document.getElementById("toggle-cabins");
  const toggleBorders = document.getElementById("toggle-borders");

  if (toggleMountains) {
    toggleMountains.addEventListener("change", (e) => {
      if (e.target.checked) {
        renderMountainMarkers();
      } else {
        clearMountainMarkers();
      }
    });
  }

  if (toggleCommunities) {
    toggleCommunities.addEventListener("change", (e) => {
      if (e.target.checked) {
        renderKommuneMarkers();
      } else {
        clearKommuneMarkers();
      }
    });
  }

  if (toggleCabins) {
    toggleCabins.addEventListener("change", (e) => {
      if (e.target.checked) {
        renderCabinMarkers();
      } else {
        clearCabinMarkers();
      }
    });
  }

  if (toggleBorders) {
    toggleBorders.addEventListener("change", (e) => {
      if (e.target.checked) {
        renderKommunePolygons();
      } else {
        clearKommunePolygons();
      }
    });
  }
}

function clearKommuneMarkers() {
  tettstedMarkører.forEach(marker => map.removeLayer(marker));
  tettstedMarkører = [];
  console.log("Tettsteder skjult");
}

function clearCabinMarkers() {
  hytteMarkører.forEach(marker => map.removeLayer(marker));
  hytteMarkører = [];
  console.log("Hytter skjult");
}

function clearKommunePolygons() {
  kommunePolygoner.forEach(polygon => map.removeLayer(polygon));
  kommunePolygoner = [];
  console.log("Kommune-grenser skjult");
}

// -------------------- FJELLTOPPER --------------------
function initMountainToggle() {
  const toggle = document.getElementById("toggle-mountains");
  if (!toggle) return;

  toggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      renderMountainMarkers();
    } else {
      clearMountainMarkers();
    }
  });

  // Tegn fjellene ved oppstart hvis toggle er av
  if (toggle.checked) {
    renderMountainMarkers();
  }
}

function renderMountainMarkers() {
  if (!fjelltopper || fjelltopper.length === 0) return;

  fjelltopper.forEach(fjell => {
    const lat = parseFloat(String(fjell.Lat || "").replace(",", "."));
    const lon = parseFloat(String(fjell.Lon || "").replace(",", "."));

    if (!isNaN(lat) && !isNaN(lon)) {
      const marker = L.circleMarker([lat, lon], {
        radius: 4,
        color: "#8B4513",
        fillColor: "#D2B48C",
        fillOpacity: 0.8,
        weight: 1.5
      });

      const navn = fjell.Namn || fjell.Name || "Ukjent";
      const høyde = fjell["Høgde over havet"] || "?";
      marker.bindTooltip(`${navn} - ${høyde} m`, { direction: "top" });
      marker.addTo(map);
      fjellmarkører.push(marker);
    }
  });

  console.log(`Tegnet ${fjellmarkører.length} fjelltopper`);
}

function clearMountainMarkers() {
  fjellmarkører.forEach(marker => map.removeLayer(marker));
  fjellmarkører = [];
  console.log("Fjelltopper skjult");
}
