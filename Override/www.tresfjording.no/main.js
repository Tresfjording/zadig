// --------------------------------------------------
// GLOBALE VARIABLER
// --------------------------------------------------
let map;
let allCabins = [];
let allPlaces = [];
let searchIndex = [];
let suggestionActiveIndex = -1;
let places;

const cabinIcon = L.icon({
  iconUrl: "/image/cabin16.png",
  iconSize: [18, 18],
  iconAnchor: [12, 18],
  popupAnchor: [0, -18],
});

// --------------------------------------------------
// OPPSTART – Laster både tettsteder og hytter
// --------------------------------------------------

Promise.all([
  fetch("tettsteder_3.json"),
  fetch("dnt_hytter.json"),
  fetch("facts_all.json")
])
  .then(async ([tettstederResp, hytterResp, faktaResp]) => {

    const tettstederData = await tettstederResp.json();
    const hytterData = await hytterResp.json();
    

    console.log("Tettsteder lastet:", tettstederData.length);
    console.log("Hytter lastet:", hytterData.length);

    // Her kan du fortsette med:
    // - validering
    // - bygging av søkeindeks
    // - visAlleSteder()
    // - visHytter()
  })
  .catch(err => {
    console.error("🚨 Klarte ikke å laste data:", err);
  });



Promise.all([
  fetch("tettsteder_3.json").then(res => res.json()),
  fetch("dnt_hytter.json").then(res => res.json())
])
  .then(([placesData, cabinsData]) => {
    allPlaces = placesData;
    allCabins = cabinsData;

    console.log("✅ Tettsteder lastet:", allPlaces.length);
    console.log("✅ Hytter lastet:", allCabins.length);

    buildSearchIndex();
    visAlleSteder(); // valgfritt
  })
  .catch(err => {
    console.error("🚨 Klarte ikke å laste data:", err);
  });
// --------------------------------------------------
// KART (Leaflet – tilpass om du bruker noe annet)
// --------------------------------------------------
  initMap();

function initMap() {
  map = L.map("map").setView([62.5, 7.5], 8); // Midt i Møre og Romsdal

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 14,
  }).addTo(map);

  console.log("Kart initialisert");
}



function visAlleSteder() {
  places.forEach(p => {
    if (p.h_lot && p.h_lon) {
      L.marker([p.h_lot, p.h_lon]).addTo(map)
        .bindPopup(p.navn || p.name || "Uten navn");
    }
  });
}

Promise.all([
  fetch("tettsteder_3.json"),
  fetch("dnt_hytter.json"),
  fetch("facts_all.json")
])
  .then(async ([tettstederResp, hytterResp, faktaResp]) => {
    const tettstederData = await tettstederResp.json();
    places = tettstederData;
    initMap();
    visAlleSteder();
  })
  .catch(err => {
    console.error("🚨 Klarte ikke å laste data:", err);
  });

  

  // Initialiser kartet med terreng som default
  map = L.map("map", {
    center: [62.501432, 7.1444801], // Tresfjord
    zoom: 10,
    layers: [positronLayer]
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

  const [tettstederResp, hytterResp, faktaResp] = await Promise.all([
    fetch("tettsteder_3.json"),
    fetch("dnt_hytter.json"),
    fetch("facts_all.json")
  ]);

  const tettstederData = await tettstederResp.json();
  const hytterData = await hytterResp.json();
  const faktaData = await faktaResp.json();

  console.log("Tettsteder:", tettstederData.length);
  console.log("Hytter:", hytterData.length);
}

loadData();


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
    const validCabins = allCabins.filter(c => typeof c.name === "string" && c.name.trim() !== "");
    console.log("Gyldige hytter:", validCabins.length);
    searchIndex.push(
      ...validCabins.map(c => ({
        label: c.name.trim(),
        type: "hytte",
        ref: c
      }))
    );
  } else {
    console.warn("⚠️ allCabins er ikke en array:", allCabins);
  }

  // Tettsteder
  if (Array.isArray(allPlaces)) {
    const validPlaces = allPlaces.filter(p => typeof p.name === "string" && p.name.trim() !== "");
    console.log("Gyldige tettsteder:", validPlaces.length);
    searchIndex.push(
      ...validPlaces.map(p => ({
        label: p.name.trim(),
        type: "sted",
        ref: p
      }))
    );
  } else {
    console.warn("⚠️ allPlaces er ikke en array:", allPlaces);
  }

  console.log("✅ Søkeindeks bygget:", searchIndex.length, "elementer");
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
    const suggestionsEl = document.getElementById("autocomplete");
    const items = suggestionsEl
      ? Array.from(suggestionsEl.querySelectorAll(".suggestion-item"))
      : [];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      suggestionActiveIndex = (suggestionActiveIndex + 1) % items.length;
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
        const query = searchInput.value.trim().toLowerCase();
        if (query.length >= 2) {
          handleSearch(query);
        }
      }
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  });

  console.log("Søkefunksjon aktivert");
}

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
function handleSearch(queryOrLabel) {
  if (!queryOrLabel || queryOrLabel.trim().length < 2) {
    console.warn("Ugyldig søkestreng:", queryOrLabel);
    return;
  }

  const query = queryOrLabel.trim().toLowerCase();

  const match = places.find(p =>
    p.name?.toLowerCase() === query ||
    p.title?.toLowerCase() === query ||
    p.navn?.toLowerCase() === query ||
    p.kommune?.toLowerCase() === query
  );

  if (!match) {
    console.warn("Fant ikke sted:", query);
    return;
  }

  const lat = match.lat;
  const lon = match.lon;

  if (typeof lat !== "number" || typeof lon !== "number") {
    console.warn("Ugyldige koordinater for:", match);
    return;
  }

  const navn = match.name || match.title || match.navn || "Uten navn";

  console.log("Fant sted:", navn);
  map.setView([lat, lon], 12);
  L.marker([lat, lon]).addTo(map)
    .bindPopup(navn)
    .openPopup();
}

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
