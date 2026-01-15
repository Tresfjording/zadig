// 15.01.2026  - 17:30:00
let map;
let kommuner = [];
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
    const [kommunerResp, hytterResp, factsResp] = await Promise.all([
      fetch("data/kommuner.json"),
      fetch("dnt_hytter.json"),
      fetch("facts_all.json")
    ]);

    if (!kommunerResp.ok || !hytterResp.ok || !factsResp.ok) {
      throw new Error("En eller flere datafiler kunne ikke hentes");
    }

    const kommunerData = await kommunerResp.json();
    const hytterData = await hytterResp.json();
    const factsData = await factsResp.json();

    // Håndter både liste og GeoJSON-format
    if (Array.isArray(kommunerData)) {
      kommuner = kommunerData;
    } else if (kommunerData.features) {
      // GeoJSON format - konverter til liste med navn og sentralkoordinater
      kommuner = kommunerData.features.map(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates[0][0]; // Få første polygon ring, første punkt for eksempel
        // Bruk første punkt som marker, eller beregn sentrum
        const allCoords = feature.geometry.coordinates[0]; // Alle punkter i første ring
        const lon = allCoords.reduce((sum, c) => sum + c[0], 0) / allCoords.length;
        const lat = allCoords.reduce((sum, c) => sum + c[1], 0) / allCoords.length;
        return {
          ...props,
          t_knavn: props.kommunenavn,
          k_lat_decimal: lat,
          k_lon_decimal: lon
        };
      });
    } else {
      kommuner = (kommunerData.places || kommunerData.kommuner || []);
    }
    
    hytter = Array.isArray(hytterData)
      ? hytterData
      : (hytterData.cabins || hytterData.hytter || []);
    
    facts = Array.isArray(factsData)
      ? factsData
      : (factsData.facts || []);

    console.log(`Lastet: ${kommuner.length} kommuner, ${hytter.length} hytter, ${facts.length} fakta`);
  } catch (err) {
    console.error("Feil ved dataloading:", err);
    throw err;
  }
}

// -------------------- SEARCH --------------------
function buildSearchIndex() {
  searchIndex = [];

  kommuner.forEach(k => {
    const navn = k.t_tettsted || k.t_knavn || k.tettsted || k.name;
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

  if (match.type === "k") {
    focusOnKommune(match.ref);
    updateInfoBoxKommune(match.ref);
  } else if (match.type === "h") {
    focusOnCabin(match.ref);
    updateInfoBoxCabin(match.ref);
  }
}

// -------------------- MAP FOCUS --------------------
function focusOnKommune(k) {
  const lat = parseFloat(String(k.t_lat || k.k_lat_decimal || "").replace(",", "."));
  const lon = parseFloat(String(k.t_lon || k.k_lon_decimal || "").replace(",", "."));
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
async function updateInfoBoxKommune(k) {
  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");

  if (!titleEl || !contentEl) return;

  const placeName = k.t_tettsted || k.t_knavn || k.tettsted || k.name || "Ukjent";
  titleEl.textContent = placeName;

  const zone = k.t_sone || k.sone || "NO1";
  const currentPrice = await fetchPriceForZone(zone);
  const nationalAvg = await fetchNationalAverage();

  const priceColor = getPriceColor(currentPrice, nationalAvg);

  const fylke = k.t_fylke || k.t_fnavn || k.fylke || "?";
  const kommune = k.t_tettsted || k.t_knavn || k.kommune || "?";
  const innbyggere = k.t_antall || k.t_innbyggere || k.k_antall || "?";
  const areal = k.t_areal || k.k_areal || "?";

  contentEl.innerHTML = `
    <p><strong>Kommune:</strong> ${placeName}</p>
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
  renderKommuneMarkers();
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

function renderKommuneMarkers() {
  if (!kommuner || kommuner.length === 0) return;

  kommuner.forEach(k => {
    const lat = parseFloat(String(k.t_lat || k.k_lat_decimal || "").replace(",", "."));
    const lon = parseFloat(String(k.t_lon || k.k_lon_decimal || "").replace(",", "."));

    if (!isNaN(lat) && !isNaN(lon)) {
      const zone = k.t_sone || k.sone || "NO1";
      const marker = L.circleMarker([lat, lon], {
        radius: 5,
        color: "#333",
        fillColor: "#0077cc",
        fillOpacity: 0.7,
        weight: 1
      });
      const name = k.t_tettsted || k.t_knavn || k.tettsted || k.name || "Ukjent";
      marker.bindTooltip(name, { direction: "top" });
      marker.on("mouseover", () => updateInfoBoxKommune(k));
      marker.addTo(map);
    }
  });

  console.log(`Tegnet ${kommuner.length} kommunemarkører`);
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
