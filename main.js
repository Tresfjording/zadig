let map;
let places = [];
let cabins = [];
let facts = [];
let searchIndex = [];

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadData()
    .then(() => {
      buildSearchIndex();
      initSearch();
      renderAllHytteMarkers();
      updateBox4();
    })
    .catch(err => {
      console.error("Feil ved lasting:", err);
      renderAllHytteMarkers();
      updateBox4();
    });
});

// -------------------- KART --------------------

function initMap() {
  map = L.map("map").setView([63.0, 11.0], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);
}

// -------------------- DATA --------------------

async function loadData() {
  const [samletResp, factsResp] = await Promise.all([
    fetch("https://www.tresfjording.no/samlet.json"),
    fetch("facts_all.json")
  ]);

  const samletData = await samletResp.json();
  facts = await factsResp.json();

  places = samletData.filter(d => d.t_knavn);
  cabins = samletData.filter(d => d.h_navn);
}

// -------------------- SØK --------------------

function buildSearchIndex() {
  searchIndex = [];

  places.forEach(t => {
    if (t.t_knavn) searchIndex.push({ type: "t", label: t.t_knavn, ref: t });
  });

  cabins.forEach(h => {
    if (h.h_navn) searchIndex.push({ type: "h", label: h.h_navn, ref: h });
  });

  searchIndex.sort((a, b) => a.label.localeCompare(b.label));
}

function initSearch() {
  const searchInput = document.getElementById("place-search");
  const suggestionsEl = document.getElementById("search-suggestions");
  let activeIndex = -1;

  if (!searchInput || !suggestionsEl) return;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    const matches = searchIndex.filter(item =>
      item.label.toLowerCase().includes(query)
    );
    renderSuggestions(matches);
    activeIndex = -1;
  });

  searchInput.addEventListener("keydown", (e) => {
    const items = suggestionsEl.querySelectorAll(".suggestion-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        items[activeIndex].click();
      } else {
        handleSearch(searchInput.value);
      }
    }

    items.forEach((item, index) => {
      item.classList.toggle("active", index === activeIndex);
    });
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

  matches.slice(0, 10).forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = item.label;
    div.dataset.index = index;
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
  const suggestionsEl = document.getElementById("search-suggestions");
  suggestionsEl.innerHTML = "";
  suggestionsEl.style.display = "none";

  if (match.type === "t") {
    focusOnPlace(match.ref);
    updateBox1(match.ref);
    updateBox3(match.ref);
    updateBox4();
  } else if (match.type === "h") {
    focusOnCabin(match.ref);
    updateBox2(match.ref);
    updateBox4();
  }
}

// -------------------- KARTFOKUS --------------------

function focusOnPlace(place) {
  const lat = parseFloat(String(place.k_lat_decimal).replace(",", "."));
  const lon = parseFloat(String(place.k_lon_decimal).replace(",", "."));
  if (!lat || !lon) return;
  map.setView([lat, lon], 11);
}

function focusOnCabin(hytte) {
  const lat = parseFloat(String(hytte.h_lat).replace(",", "."));
  const lon = parseFloat(String(hytte.h_lon).replace(",", "."));
  if (!lat || !lon) return;
  map.setView([lat, lon], 13);
}

// -------------------- INFOBOKSER --------------------

function updateBox1(place) {
  const el = document.getElementById("box1");
  if (!el || !place) return;

  fetchCurrentPowerPrice(place.t_sone).then(pris => {
    el.innerHTML = `
      <p><strong>Tettsted:</strong> ${place.t_knavn}</p>
      <p><strong>Sone:</strong> ${place.t_sone}</p>
      <p><strong>Strømpris nå:</strong> ${pris?.toFixed(2) ?? "?"} kr/kWh</p>
    `;
  });
}

function updateBox2(hytte) {
  const el = document.getElementById("box2");
  if (!el || !hytte) return;

  el.innerHTML = `
    <p><strong>Navn:</strong> ${hytte.h_navn}</p>
    <p><strong>Type:</strong> ${hytte.h_type}</p>
    <p><a href="${hytte.h_url}" target="_blank">Se mer på UT.no</a></p>
  `;
}

function updateBox3(place) {
  const el = document.getElementById("box3");
  if (!el || !place) return;

  el.innerHTML = `
    <p><strong>K.nr:</strong> ${place["t_k.nr"]}</p>
    <p><strong>Fylke:</strong> ${place.t_fnavn}</p>
    <p><strong>Antall ansatte:</strong> ${place.k_ansatte}</p>
    <p><strong>Areal:</strong> ${place.k_areal} km²</p>
    <p><strong>Tilskudd:</strong> ${place.k_tilskudd} kr</p>
    <p><strong>Språk:</strong> ${place.k_språk}</p>
    <p><em>${place.k_slagord}</em></p>
    <p><em>${place.f_slagord}</em></p>
  `;
}

function updateBox4() {
  const el = document.getElementById("box4");
  if (!el || !facts.length) return;
  const random = facts[Math.floor(Math.random() * facts.length)];
  el.textContent = random.fact;
}

// -------------------- STRØMPRIS --------------------

function buildPriceUrl(priceArea) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${priceArea}.json`;
}

async function fetchCurrentPowerPrice(priceArea) {
  const url = buildPriceUrl(priceArea);
  try {
    const response = await fetch(url);
    const data = await response.json();
    const hour = new Date().getHours();
    const entry = data[hour];
    return entry?.NOK_per_kWh ?? null;
  } catch (err) {
    console.error("Feil ved henting av strømpris:", err);
    return null;
  }
}

// -------------------- HYTTE-MARKØRER --------------------

async function renderAllHytteMarkers() {
  const prisområder = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const strømpriser = {};
  const nå = new Date();
  const år = nå.getFullYear();
  const måned = String(nå.getMonth() + 1).padStart(2, "0");
  const dag = String(nå.getDate()).padStart(2, "0");
  const time = nå.getHours();

  await Promise.all(prisområder.map(async sone => {
    const url = `https://www.h