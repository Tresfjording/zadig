let map;
let allPlaces = [];
let allCabins = [];

// 🗺️ Initialiser Leaflet-kartet
function initMap() {
  if (map) {
    map.remove(); // 🔥 Fjern eksisterende kart hvis det finnes
  }

  map = L.map("map").setView([62.5, 7.5], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap-bidragsytere'
  }).addTo(map);

  console.log("🗺️ Kart initialisert");
}

// 🏕️ Egendefinert ikon for hytter
const cabinIcon = L.icon({
  iconUrl: "image/cabin16.png",
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});


async function renderAllHytteMarkers() {
  if (!cabins || cabins.length === 0) return;

  const prisområder = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const strømpriser = {};
  const nå = new Date();
  const år = nå.getFullYear();
  const måned = String(nå.getMonth() + 1).padStart(2, "0");
  const dag = String(nå.getDate()).padStart(2, "0");
  const time = nå.getHours();

  // 1. Hent strømpris for alle prisområder
  await Promise.all(prisområder.map(async sone => {
    const url = `https://www.hvakosterstrommen.no/api/v1/prices/${år}/${måned}-${dag}_${sone}.json`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      strømpriser[sone] = data;
    } catch (err) {
      console.warn(`⚠️ Klarte ikke å hente pris for ${sone}:`, err);
    }
  }));

  // 2. Beregn landsgjennomsnitt
  const priserNå = prisområder
    .map(sone => strømpriser[sone]?.[time]?.NOK_per_kWh)
    .filter(p => typeof p === "number");

  const snittpris = priserNå.reduce((a, b) => a + b, 0) / priserNå.length;
  console.log("⚡ Strømpris nå:", priserNå, "Snitt:", snittpris.toFixed(2));

  // 3. Tegn hytter med fargekodet ikon
  cabins.forEach(h => {
    const lat = parseFloat(String(h.h_lat).replace(",", "."));
    const lon = parseFloat(String(h.h_lon).replace(",", "."));
    const sone = h.t_sone;

    if (!lat || !lon || !sone || !strømpriser[sone]) return;

    const pris = strømpriser[sone][time]?.NOK_per_kWh;
    if (typeof pris !== "number") return;

    let farge = "orange";
    if (pris < snittpris - 0.05) farge = "green";
    else if (pris > snittpris + 0.05) farge = "red";

    const ikon = L.icon({
      iconUrl: `image/cabin16_${farge}.png`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    const marker = L.marker([lat, lon], {
      icon: ikon,
      title: `${h.h_navn} (${h.h_type || "ukjent"})`
    });

    marker.on("mouseover", () => updateInfoBoxWithCabin(h));
    marker.addTo(map);
  });
}

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
    <p><a href="${hytte.h_url}" target="_blank">Se mer</a></p>
  `;
}

function updateBox3(place) {
  const el = document.getElementById("box3");
  if (!el || !place) return;

  el.innerHTML = `
    <p><strong>K.nr:</strong> ${place["t_k.nr"]}</p>
    <p><strong>Fylke:</strong> ${place.t_fnavn}</p>
    <p><strong>Antall:</strong> ${place.k_ansatte}</p>
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


// 🧭 Vis alle hytter med hover
function visAlleHytter() {
  const box = document.getElementById("box2");
  if (!box) return;

  const gyldige = allCabins.filter(h => typeof h.lat === "number" && typeof h.lon === "number");
  console.log("🏕️ Gyldige hytter:", gyldige.length);

  gyldige.forEach(hytte => {
    const marker = L.marker([hytte.lat, hytte.lon], { icon: cabinIcon }).addTo(map);

    marker.on("mouseover", () => visHytteInfo(hytte));
    marker.on("mouseout", () => {
      box.classList.add("fade-out");
      setTimeout(() => {
        box.innerHTML = "";
        box.classList.remove("fade-out");
      }, 300);
    });
  });
}

// 🧾 Vis info om én hytte i #box2
function visHytteInfo(hytte) {
  const box = document.getElementById("box2");
  if (!box) return;

  box.classList.remove("fade-out");

  const navn = hytte.name || "Uten navn";
  const klassifisering = hytte["dnt:classification"] || "Ukjent type";
  const nettside = hytte.website
    ? `<a href="${hytte.website}" target="_blank">${hytte.website}</a>`
    : "Ingen nettside";

  box.innerHTML = `
    <h3>${navn}</h3>
    <p><strong>Type:</strong> ${klassifisering}</p>
    <p><strong>Nettside:</strong> ${nettside}</p>
  `;
}

// 🔍 Dummy-funksjon for søkeindeks (kan utvides senere)
function buildSearchIndex() {
  console.log("🔍 Søkeindeks ikke implementert ennå");
}

// 🌍 Valgfri: vis tettsteder (placeholder)
function visAlleSteder() {
  console.log("📍 visAlleSteder() er ikke implementert ennå");
}

// 🚀 Start når siden er klar
window.onload = () => {
  console.log("🚦 Starter app");

  initMap();

  Promise.all([
    fetch("tettsteder_3.json").then(res => res.json()),
    fetch("dnt_hytter.json").then(res => res.json())
  ])
  .then(([steder, hytter]) => {
    allPlaces = steder;
    allCabins = hytter;

    console.log("✅ Tettsteder:", allPlaces.length);
    console.log("✅ Hytter:", allCabins.length);

    buildSearchIndex();
    visAlleSteder(); // valgfritt
    visAlleHytter();
  })
  .catch(err => {
    console.error("❌ Klarte ikke å laste data:", err);
  });
};