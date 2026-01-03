// main.js

// Hjelpefunksjon: konverterer tall med komma til punktum
function toNumber(value) {
  if (!value) return null;
  return parseFloat(String(value).replace(",", "."));
}

// Oppdater infoboks for kommune
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

// Oppdater infoboks for hytte
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

// Tøm infoboksen
function clearInfo() {
  document.getElementById("info-box").innerHTML = "";
}

// Initier kartet
function initMap(data, strøm, facts) {
  const map = L.map("map").setView([65, 13], 5);

  const kommuneLayer = L.layerGroup().addTo(map);
  const hytteLayer = L.layerGroup().addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // Kommuner
  data.forEach(entry => {
    const lat = toNumber(entry.k_lat_decimal || entry.h_lat);
    const lon = toNumber(entry.k_lon_decimal || entry.h_lon);

    if (!isNaN(lat) && !isNaN(lon) && entry.t_knavn) {
      const pris = strøm[entry.t_sone] || 0;
      let fillColor = "green";
      if (pris > 1.0) fillColor = "orange";
      if (pris > 2.0) fillColor = "red";

      const marker = L.circleMarker([lat, lon], {
        radius: 6,
        color: "black",
        weight: 1,
        fillColor: fillColor,
        fillOpacity: 0.8
      }).bindTooltip(entry.t_knavn);

      marker.on("mouseover", () => updateInfo(entry, facts, pris));
      marker.on("mouseout", () => clearInfo());
      kommuneLayer.addLayer(marker);
    }
  });

  // Hytter
  data.forEach(entry => {
    const lat = toNumber(entry.k_lat_decimal || entry.h_lat);
    const lon = toNumber(entry.k_lon_decimal || entry.h_lon);

    if (!isNaN(lat) && !isNaN(lon) && entry.h_navn) {
      const marker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "hytte-icon",
          html: "▲",
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
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

    searchIndex
      .filter(name => name.toLowerCase().includes(val))
      .slice(0, 5)
      .forEach(name => {
        const li = document.createElement("li");
        li.textContent = name;

        li.onclick = () => {
          input.value = name;
          const entry = data.find(e => e.t_knavn === name || e.h_navn === name);

          if (entry) {
            const lat = toNumber(entry.k_lat_decimal || entry.h_lat);
            const lon = toNumber(entry.k_lon_decimal || entry.h_lon);

            if (!isNaN(lat) && !isNaN(lon)) {
              map.setView([lat, lon], 10);

              if (entry.t_knavn) {
                const pris = strøm[entry.t_sone] || 0;
                updateInfo(entry, facts, pris);
              } else if (entry.h_navn) {
                updateHytteInfo(entry, facts);
              }
            }
          }
        };

        suggestions.appendChild(li);
      });
  });
}

// 🚀 Last inn data og start kartet
Promise.all([
  fetch("samlet.json").then(r => r.json()),
  fetch("strompris.json").then(r => r.json()), // henter fra PHP
  fetch("facts.json").then(r => r.json())
]).then(([data, strøm, facts]) => {
  initMap(data, strøm, facts);
});