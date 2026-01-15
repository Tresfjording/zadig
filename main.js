// 15.01.2026  - 17:30:00
let map;
let tettsteder = [];
let hytter = [];
let facts = [];
let searchIndex = [];

const hytteIcon = L.icon({
  iconUrl: "image/cabin16.png",
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

// -------------------- STARTUP --------------------
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadData()
    .then(() => {
      console.log("Data lastet!");
      buildSearchIndex();
      initSearch();
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
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);
  console.log("Kart initialisert");
}

// -------------------- DATA LOADING --------------------
async function loadData() {
  try {
    const [tettstederResp, hytterResp, factsResp] = await Promise.all([
      fetch("tettsteder.json"),
      fetch("dnt_hytter.json"),
      fetch("facts_all.json")
    ]);

    if (!tettstederResp.ok || !hytterResp.ok || !factsResp.ok) {
      throw new Error("En eller flere datafiler kunne ikke hentes");
    }

    const tettstederData = await tettstederResp.json();
    const hytterData = await hytterResp.json();
    const factsData = await factsResp.json();

    // Håndter både liste og objekt-format
    tettsteder = Array.isArray(tettstederData)
      ? tettstederData
      : (tettstederData.places || tettstederData.tettsteder || []);
    
    hytter = Array.isArray(hytterData)
      ? hytterData
      : (hytterData.cabins || hytterData.hytter || []);
    
    facts = Array.isArray(factsData)
      ? factsData
      : (factsData.facts || []);

    console.log(`Lastet: ${tettsteder.length} tettsteder, ${hytter.length} hytter, ${facts.length} fakta`);
  } catch (err) {
    console.error("Feil ved dataloading:", err);
    throw err;
  }
}

// -------------------- SEARCH --------------------
function buildSearchIndex() {
  searchIndex = [];

  tettsteder.forEach(t => {
    const navn = t.t_tettsted || t.t_knavn || t.tettsted || t.name;
    if (navn) {
      searchIndex.push({ type: "t", label: navn, ref: t });
    }
  });

  hytter.forEach(h => {
    const navn = h.h_navn || h.h_name;
    if (navn) {
      searchIndex.push({ type: "h", label: navn, ref: h });
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
        items[currentIndex].click();
      } else if (searchInput.value) {
        handleSearch(searchInput.value);
      }
    }
  });
}

function updateSuggestionHighlight(items, index) {
  items.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });
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
    suggestionsEl.appendChild(div);
  });
}

function handleSearch(label) {
  const match = searchIndex.find(item =>
    item.label.toLowerCase() === label.toLowerCase()
  );

  if (!match) return;

  document.getElementById("place-search").value = label;
  document.getElementById("search-suggestions").innerHTML = "";
  document.getElementById("search-suggestions").style.display = "none";

  if (match.type === "t") {
    focusOnPlace(match.ref);
    updateInfoBoxPlace(match.ref);
  } else if (match.type === "h") {
    focusOnCabin(match.ref);
    updateInfoBoxCabin(match.ref);
  }
}

// -------------------- MAP FOCUS --------------------
function focusOnPlace(place) {
  const lat = parseFloat(String(place.t_lat || place.k_lat_decimal || "").replace(",", "."));
  const lon = parseFloat(String(place.t_lon || place.k_lon_decimal || "").replace(",", "."));
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

// -------------------- INFO BOX --------------------
async function updateInfoBoxPlace(place) {
  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");

  if (!titleEl || !contentEl) return;

  const placeName = place.t_tettsted || place.t_knavn || place.tettsted || place.name || "Ukjent";
  titleEl.textContent = placeName;

  const zone = place.t_sone || place.sone || "NO1";
  const currentPrice = await fetchPriceForZone(zone);
  const nationalAvg = await fetchNationalAverage();

  const priceColor = getPriceColor(currentPrice, nationalAvg);

  const fylke = place.t_fylke || place.t_fnavn || place.fylke || "?";
  const kommune = place.t_tettsted || place.t_knavn || place.kommune || "?";
  const innbyggere = place.t_antall || place.t_innbyggere || place.k_antall || "?";
  const areal = place.t_areal || place.k_areal || "?";

  contentEl.innerHTML = `
    <p><strong>Tettsted:</strong> ${placeName}</p>
    <p><strong>Sone:</strong> ${zone}</p>
    <p><strong>Fylke:</strong> ${fylke}</p>
    <p><strong>Kommune:</strong> ${kommune}</p>
    <p><strong>Innbyggere:</strong> ${innbyggere}</p>
    <p><strong>Areal:</strong> ${areal} km²</p>
    <p><strong>Strømpris nå:</strong> <span style="color: ${priceColor};">${currentPrice ? currentPrice.toFixed(2) : "?"} kr/kWh</span></p>
    <p><strong>Landsnitt:</strong> ${nationalAvg ? nationalAvg.toFixed(2) : "?"} kr/kWh</p>
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
  renderCabinMarkers();
  renderPlaceMarkers();
}

function renderCabinMarkers() {
  if (!hytter || hytter.length === 0) return;

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
    }
  });

  console.log(`Tegnet ${hytter.length} hyttemarkører`);
}

function renderPlaceMarkers() {
  if (!tettsteder || tettsteder.length === 0) return;

  tettsteder.forEach(t => {
    const lat = parseFloat(String(t.t_lat || t.k_lat_decimal || "").replace(",", "."));
    const lon = parseFloat(String(t.t_lon || t.k_lon_decimal || "").replace(",", "."));

    if (!isNaN(lat) && !isNaN(lon)) {
      const zone = t.t_sone || t.sone || "NO1";
      const marker = L.circleMarker([lat, lon], {
        radius: 5,
        color: "#333",
        fillColor: "#0077cc",
        fillOpacity: 0.7,
        weight: 1
      });
      const name = t.t_tettsted || t.t_knavn || t.tettsted || t.name || "Ukjent";
      marker.bindTooltip(name, { direction: "top" });
      marker.on("mouseover", () => updateInfoBoxPlace(t));
      marker.addTo(map);
    }
  });

  console.log(`Tegnet ${tettsteder.length} tettstedmarkører`);
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
