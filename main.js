let map;
let places = [];
let cabins = [];
let facts = [];
let searchIndex = [];

// 12.01.2026  - 15:39:55

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadData()
    .then(() => {
      buildSearchIndex();
      initSearch();
      renderAllHytteMarkers();
      updateBox4();
    })
    
console.log("Antall hytter:", cabins.length);
console.log("Eksempelhytte:", cabins[0]);
    });
;

// -------------------- KART --------------------

function initMap() {
  map = L.map("map").setView([63.0, 11.0], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);
}

// -------------------- DATA --------------------

async function loadData() {
  const [tettstederResp, hytterResp, factsResp] = await Promise.all([
    fetch("tettsteder_3.json"),
    fetch("dnt_hytter.json"),
    fetch("facts_all.json")
  ]);

  places = await tettstederResp.json();
  cabins = await hytterResp.json();
  facts = await factsResp.json();

  window.cabins = cabins; // ← nå er den fylt!
}

// -------------------- SØK --------------------

function buildSearchIndex() {
  searchIndex = [];

  places.forEach(t => {
    if (t.tettsted) {
      searchIndex.push({ type: "t", label: t.tettsted, ref: t });
    }
  });

  cabins.forEach(h => {
    if (h.name) {
      searchIndex.push({ type: "h", label: h.name, ref: h });
    }
  });

  searchIndex = searchIndex.filter(item => typeof item.label === "string");
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
  const lat = parseFloat(place.lat);
  const lon = parseFloat(place.lon);
  if (!lat || !lon) return;
  map.setView([lat, lon], 11);
}

function focusOnCabin(hytte) {
  const lat = parseFloat(hytte.h_lat);
  const lon = parseFloat(hytte.h_lon);
  if (!lat || !lon) return;
  map.setView([lat, lon], 13);
}

// -------------------- INFOBOKSER --------------------
function showInfoBox(cabin) {
  const name = cabin.name || "svukurisetUkjent hytte";
  const operator = cabin.operator || "Ukjent operatør";
  const classification = cabin["dnt:classification"] || "Ukjent type";
  const website = cabin.website || "#";

  const html = `
    <h3>${name}</h3>
    <p><strong>Operatør:</strong> ${operator}</p>
    <p><strong>Type:</strong> ${classification}</p>
    <p><a href="${website}" target="_blank">Mer info</a></p>
  `;

  document.getElementById("infobox").innerHTML = html;
}

async function updateBox1(t) {
  const el = document.getElementById("box1");
  if (!el || !t) return;

  const prisområder = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const nå = new Date();
  const år = nå.getFullYear();
  const måned = String(nå.getMonth() + 1).padStart(2, "0");
  const dag = String(nå.getDate()).padStart(2, "0");
  const time = nå.getHours();

  const priser = await Promise.all(prisområder.map(async sone => {
    try {
      const url = `https://www.hvakosterstrommen.no/api/v1/prices/${år}/${måned}-${dag}_${sone}.json`;
      const res = await fetch(url);
      const data = await res.json();
      return data[time]?.NOK_per_kWh || null;
    } catch {
      return null;
    }
  }));

  const gyldige = priser.filter(p => typeof p === "number");
  const snitt = gyldige.reduce((a, b) => a + b, 0) / gyldige.length;

  const lokal = priser[prisområder.indexOf(t.t_sone)];
  const farge = lokal < snitt - 0.05 ? "green" : lokal > snitt + 0.05 ? "red" : "orange";

  el.innerHTML = `
    <p><strong>📍 ${t.tettsted}</strong></p>
    <p>Sone: ${t.t_sone}</p>
    <p>⚡ Strømpris nå: <span style="color:${farge}">${lokal?.toFixed(2) ?? "?"} kr/kWh</span></p>
    <p>Snittpris nasjonalt: ${snitt?.toFixed(2) ?? "?"} kr/kWh</p>
  `;
}

function updateBox2(h) {
  const el = document.getElementById("box2");
  if (!el || !h) return;

  el.innerHTML = `
    <p><strong>🏕️ ${h.h_navn}</strong></p>
    <p>Type: ${h.h_type || "ukjent"}</p>
    <p>Operatør: ${h.h_operatør || "ukjent"}</p>
    ${h.h_url ? `<p><a href="${h.h_url}" target="_blank">🔗 UT.no</a></p>` : ""}
  `;
}

function updateBox3(t) {
  const el = document.getElementById("box3");
  if (!el || !t) return;

  el.innerHTML = `
    <p><strong>K.nr:</strong> ${t.k_nr}</p>
    <p><strong>Fylke:</strong> ${t.fylke}</p>
    <p><strong>Innbyggere:</strong> ${t.antall}</p>
    <p><strong>Areal:</strong> ${t.areal} km²</p>
    <p><strong>Tilskudd:</strong> ${t.tilskudd} kr</p>
    <p><strong>Språk:</strong> ${t.språk}</p>
    <p><em>${t.k_slagord || ""}</em></p>
    <p><em>${t.f_slagord || ""}</em></p>
  `;
}

function updateBox4() {
  const el = document.getElementById("box4");
  if (!el || !facts.length) return;

  const random = facts[Math.floor(Math.random() * facts.length)];
  el.innerHTML = `<p><em>💡 ${random.fact || random}</em></p>`;
}

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



function renderAllHytteMarkers() {

  
  if (!cabins || cabins.length === 0) {
    console.warn("Ingen hytter å vise");
    return;
  }

  cabins.forEach(h => {
    const lat = parseFloat(String(h.h_lat).replace(",", "."));
    const lon = parseFloat(String(h.h_lon).replace(",", "."));

    if (!lat || !lon) {
      console.warn("Ugyldige koordinater:", h.h_navn, h.h_lat, h.h_lon);
      return;
    }

    const marker = L.marker([lat, lon]).addTo(map);
    marker.bindTooltip(h.h_navn || "Ukjent hytte");
  });

  console.log("Tegnet", cabins.length, "hytter");
}