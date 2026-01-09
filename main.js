
console.log("main.js er lastet");

// --------------------------------------------------
// GLOBALE VARIABLER - 09.01.2026  - 21:36:58
// --------------------------------------------------
let map;
let allCabins = [];
let allPlaces = [];
let searchIndex = [];
let suggestionActiveIndex = -1;

// --------------------------------------------------
// OPPSTART
// --------------------------------------------------

let places = [];

fetch("tettsteder_3.json")
  .then(res => res.json())
  .then(data => {
    places = data;
    console.log("Tettsteder lastet:", places.length);

    visAlleSteder(); // valgfritt: vis alle hytter/tettsteder på kartet
  })
  .catch(err => {
    console.error("Klarte ikke å laste tettsteder_3.json:", err);
  });

// --------------------------------------------------
// KART (Leaflet – tilpass om du bruker noe annet)
// --------------------------------------------------
function visAlleSteder() {
  places.forEach(p => {
    if (p.lat && p.lon) {
      L.marker([p.lat, p.lon]).addTo(map)
        .bindPopup(p.name || p.title || p.navn || "Uten navn");
    }
  });
}
  // Kartlag
  const standardLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  });

  const topoLayer = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: "© OpenTopoMap contributors"
  });

  const positronLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", {
    attribution: "© CartoDB"
  });

  const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles © Esri" }
  );

  // Initialiser kartet med terreng som default
  map = L.map("map", {
    center: [62.566, 7.475], // Tresfjord
    zoom: 12,
    layers: [topoLayer]
  });

  // Lagvelger
  const baseMaps = {
    "Standard": standardLayer,
    "Terreng": topoLayer,
    "Lys moderne": positronLayer,
    "Satelitt": satelliteLayer
  };

  L.control.layers(baseMaps).addTo(map);


// --------------------------------------------------
// DATAINNLESSING – TILPASS STIER TIL DINE JSON-FILER
// --------------------------------------------------
async function loadData() {
  // Tilpass URL-er til dine faktiske filer
  const cabinsRes = await fetch("dnt_hytter.json");
  const placesRes = await fetch("tettsteder_3.json");

  if (!cabinsRes.ok || !placesRes.ok) {
    throw new Error("Kunne ikke laste datafiler");
  }

  allCabins = await cabinsRes.json();
  allPlaces = await placesRes.json();

  console.log("places:", allPlaces.length);
  console.log("cabins:", allCabins.length);
}

// --------------------------------------------------
// STRØMPRISER / RANDOM FACT – STUBS DU KAN ERSTATTE
// --------------------------------------------------
async function initPrices() {
  // Her kan du hente strømpriser og oppdatere #power-price
  console.log("initPrices: stub");
}

function setRandomFact() {
  const facts = [
    "Visste du at Norge har over 400 000 hytter?",
    "Møre og Romsdal har noen av de fineste fjordene i verden.",
    "Tresfjordbrua kortet ned reisetida mellom Vestnes og Ålesund betydelig."
  ];
  const fact = facts[Math.floor(Math.random() * facts.length)];
  const factEl = document.getElementById("random-fact");
  if (factEl) factEl.textContent = fact;
}

// --------------------------------------------------
// SØKEINDEKS
// --------------------------------------------------
function buildSearchIndex() {
  searchIndex = [];

  // Hytter
  if (Array.isArray(allCabins)) {
    searchIndex.push(
      ...allCabins
        .filter(c => typeof c.name === "string" && c.name.trim() !== "")
        .map(c => ({
          label: c.name.trim(),
          type: "hytte",
          ref: c
        }))
    );
  }

  // Tettsteder
  if (Array.isArray(allPlaces)) {
    searchIndex.push(
      ...allPlaces
        .filter(p => typeof p.name === "string" && p.name.trim() !== "")
        .map(p => ({
          label: p.name.trim(),
          type: "sted",
          ref: p
        }))
    );
  }

  console.log("searchIndex bygget, antall:", searchIndex.length);
}

// --------------------------------------------------
// SØK
// --------------------------------------------------
function initSearch() {
  const searchInput = document.getElementById("searchBox");
  if (!searchInput) {
    console.warn("Fant ikke søkefeltet med ID 'searchBox'");
    return;
  }

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = searchInput.value.trim().toLowerCase();
      handleSearch(query);
    }
  });

  console.log("Søkefunksjon aktivert");
}

    // Finn treff i searchIndex
    searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const query = searchInput.value.trim().toLowerCase();
    handleSearch(query);
  }
});

  // Enter / piltaster
  searchInput.addEventListener("keydown", (e) => {
    const suggestionsEl = document.getElementById("autocomplete");
    if (!suggestionsEl) return;

    const items = Array.from(
      suggestionsEl.querySelectorAll(".suggestion-item")
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      suggestionActiveIndex =
        (suggestionActiveIndex + 1) % items.length;
      updateSuggestionHighlight(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      suggestionActiveIndex =
        (suggestionActiveIndex - 1 + items.length) % items.length;
      updateSuggestionHighlight(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        suggestionActiveIndex >= 0 &&
        suggestionActiveIndex < items.length
      ) {
        const label = items[suggestionActiveIndex].dataset.label;
        handleSearch(label);
      } else {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          handleSearch(query);
        }
      }
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  });


// --------------------------------------------------
// VIS FORSLAG
// --------------------------------------------------
function renderSuggestions(matches) {
  const suggestionsEl = document.getElementById("autocomplete");
  if (!suggestionsEl) return;

  suggestionsEl.innerHTML = "";

  if (!matches || matches.length === 0) {
    suggestionsEl.style.display = "none";
    suggestionActiveIndex = -1;
    return;
  }

  suggestionsEl.style.display = "block";
  suggestionActiveIndex = -1;

  matches.slice(0, 10).forEach((item) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = `${item.label} (${item.type})`;
    div.dataset.label = item.label;

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
  const suggestionsEl = document.getElementById("autocomplete");
  if (!suggestionsEl) return;
  suggestionsEl.innerHTML = "";
  suggestionsEl.style.display = "none";
  suggestionActiveIndex = -1;
}

// --------------------------------------------------
// HANDLE SEARCH
// --------------------------------------------------
function initSearch() {
  const searchInput = document.getElementById("searchBox");
  if (!searchInput) {
    console.warn("Fant ikke søkefeltet med ID 'searchBox'");
    return;
  }

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = searchInput.value.trim().toLowerCase();
      handleSearch(query);
    }
  });

  console.log("Søkefunksjon aktivert");
}
function handleSearch(query) {
  if (!query || query.length < 2) {
    console.warn("Ugyldig søkestreng:", query);
    return;
  }
}
  const match = places.find(p =>
    p.name?.toLowerCase() === query ||
    p.title?.toLowerCase() === query
  );

  if (!match) {
    console.warn("Fant ikke sted:", query);

  }

  console.log("Fant sted:", match.name || match.title);
  map.setView([match.lat, match.lon], 12);
  L.marker([match.lat, match.lon]).addTo(map)
    .bindPopup(match.name || match.title)
    .openPopup();


  // Søk ved Enter
 searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const query = searchInput.value.trim().toLowerCase();
    handleSearch(query);
  }
});

// --------------------------------------------------
// INFOBOKS
// --------------------------------------------------
function showInfo(place) {
  const infoBox = document.getElementById("infoBox");
  const titleEl = document.getElementById("info-title");
  const contentEl = document.getElementById("info-content");

  if (!infoBox || !titleEl || !contentEl) {
    console.warn("Infoboks-elementer mangler i DOM");
    return;
  }

  const name = place.name || "Uten navn";
  const municipality = place.municipality || "Ukjent kommune";
  const county = place.county || "Ukjent fylke";
  const website = place.website || null;

  titleEl.textContent = name;

  let html = `<p><strong>Kommune:</strong> ${municipality}</p>
              <p><strong>Fylke:</strong> ${county}</p>`;

  if (website) {
    html += `<p><a href="${website}" target="_blank">Nettside</a></p>`;
  }

  contentEl.innerHTML = html;

  infoBox.style.display = "block";
}
document.addEventListener("DOMContentLoaded", () => {
  initMap();
});