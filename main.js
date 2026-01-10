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

// 🧭 Vis alle hytter med hover
function visAlleHytter() {
  const box = document.getElementById("box2");
  if (!box) return;

  const gyldige = allCabins.filter(h => h.lat && h.lon);
  console.log("🏕️ Gyldige hytter:", gyldige.length);

  gyldige.forEach(hytte => {
    const marker = L.marker([hytte.lat, hytte.lon], { icon: cabinIcon }).addTo(map);

    marker.on("mouseover", () => {
      visHytteInfo(hytte);
    });

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