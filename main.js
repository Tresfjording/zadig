// Last data
Promise.all([
  fetch("samlet.json").then(r => r.json()),
  fetch("facts_all.json").then(r => r.json()),
  fetch("https://www.hvakosterstrommen.no/api/v1/prices/current").then(r => r.json())
]).then(([samlet, facts, strøm]) => {
  initMap(samlet, facts, strøm);
});

function initMap(data, facts, strøm) {
  const map = L.map("map").setView([64.5, 11], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  const kommuneLayer = L.layerGroup().addTo(map);
  const hytteLayer = L.layerGroup().addTo(map);

  // Beregn landsgjennomsnitt
  const priser = Object.values(strøm).map(p => p.NOK_per_kWh);
  const snitt = priser.reduce((a,b)=>a+b,0)/priser.length;

  // Legg til markører
  data.forEach(entry => {
    // Kommune
    if (entry.k_lat_decimal && entry.k_lon_decimal) {
      const pris = strøm[entry.t_sone]?.NOK_per_kWh || snitt;
      const farge = pris > snitt ? "red" : (pris < snitt ? "green" : "yellow");

      const marker = L.circleMarker([entry.k_lat_decimal, entry.k_lon_decimal], {
        color: farge, radius: 8
      }).bindTooltip(`${entry.t_knavn} – ${pris.toFixed(2)} kr/kWh`);
      marker.on("click", () => updateInfo(entry, facts, pris));
      kommuneLayer.addLayer(marker);
    }

    // Hytte
    if (entry.h_lat && entry.h_lon) {
      const marker = L.marker([entry.h_lat, entry.h_lon], {
        icon: L.divIcon({ className: "hytte-icon", html: "▲", iconSize: [12,12], iconAnchor:[6,6] })
      }).bindTooltip(entry.h_navn);
      marker.on("mouseover", () => updateHytteInfo(entry, facts));
      marker.on("mouseout", () => clearInfo());
      hytteLayer.addLayer(marker);
    }
  });

  // Søkefunksjon
  const searchIndex = [
    ...data.map(e => e.t_knavn).filter(Boolean),
    ...data.map(e => e.h_navn).filter(Boolean)
  ];
  const input = document.getElementById("search");
  const suggestions = document.getElementById("suggestions");

  input.addEventListener("input", () => {
    const val = input.value.toLowerCase();
    suggestions.innerHTML = "";
    searchIndex.filter(name => name.toLowerCase().includes(val)).slice(0,5).forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      li.onclick = () => {
        input.value = name;
        const entry = data.find(e => e.t_knavn === name || e.h_navn === name);
        if (entry) {
          const lat = parseFloat(entry.k_lat_decimal || entry.h_lat);
          const lon = parseFloat(entry.k_lon_decimal || entry.h_lon);
          map.setView([lat, lon], 10);
        }
      };
      suggestions.appendChild(li);
    });
  });
}

function updateInfo(entry, facts, pris) {
  document.getElementById("info-box").innerHTML = `
    <h3>${entry.t_knavn}</h3>
    <p>Fylke: ${entry.t_fnavn}</p>
    <p>Sone: ${entry.t_sone}</p>
    <p>Strømpris: ${pris.toFixed(2)} kr/kWh</p>
    <p>Innbyggere: ${entry.k_innbyggere}</p>
    <p>Ansatte: ${entry.k_ansatte}</p>
    <p>Tilskudd: ${entry.k_tilskudd}</p>
    <hr>
    <em>${facts[Math.floor(Math.random()*facts.length)]}</em>
  `;
}

function updateHytteInfo(entry, facts) {
  document.getElementById("info-box").innerHTML = `
    <h3>${entry.h_navn}</h3>
    <p>ID: ${entry.h_id}</p>
    <p>Operatør: ${entry.h_operatør || "ukjent"}</p>
    <p>Type: ${entry.h_type}</p>
    <a href="${entry.h_url}" target="_blank">Mer info</a>
    <hr>
    <em>${facts[Math.floor(Math.random()*facts.length)]}</em>
  `;
}

function clearInfo() {
  document.getElementById("info-box").innerHTML = "";
}