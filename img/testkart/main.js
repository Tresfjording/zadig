// Opprett kartet
const map = L.map('map').setView([62.566, 7.416], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Les inn CSV-fila med PapaParse
Papa.parse("https://tresfjording.no/dnt_hytter.csv", {
  download: true,
  delimiter: ";",   // ← viktig siden fila er semikolon-separert
  header: false,    // sett til true hvis du har kolonnenavn
  complete: function(results) {
    const features = results.data.map(row => ({
      type: "Feature",
      properties: {
        navn: row[1],
        forening: row[2],
        type: row[3],
        url: row[4]
      },
      geometry: {
        type: "Point",
        coordinates: [parseFloat(row[6]), parseFloat(row[5])]
      }
    }));

    const geojson = { type: "FeatureCollection", features };

    // Lag GeoJSON-laget
    const hytteLayer = L.geoJSON(geojson, {
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`<b>${p.navn}</b><br>${p.forening}<br>${p.type}<br><a href="${p.url}" target="_blank">Mer info</a>`);
      }
    }).addTo(map);

    // Legg til søkekontroll
    map.addControl(new L.Control.Search({
      layer: hytteLayer,
      propertyName: 'navn',
      marker: false,
      moveToLocation: function(latlng, title, map) {
        map.setView(latlng, 12);
      }
    }));
  }
});