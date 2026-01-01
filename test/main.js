// -----------------------------
// Global variables
// -----------------------------
let map;
let markers = [];
let cabinData = [];

// -----------------------------
// Initialize map
// -----------------------------
function initMap() {
    map = L.map('map').setView([62.566, 7.5], 9);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// -----------------------------
// Load CSV
// -----------------------------
async function loadCSV() {
    try {
        const response = await fetch('data/cabins.csv');
        const text = await response.text();

        const rows = text.split('\n').map(r => r.trim()).filter(r => r.length > 0);
        const headers = rows[0].split(',');

        cabinData = rows.slice(1).map(row => {
            const cols = row.split(',');
            let obj = {};
            headers.forEach((h, i) => obj[h.trim()] = cols[i]?.trim());
            return obj;
        });

        placeMarkers();
    } catch (err) {
        console.error("CSV-feil:", err);
    }
}

// -----------------------------
// Place markers
// -----------------------------
function placeMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    cabinData.forEach(cabin => {
        const lat = parseFloat(cabin.lat);
        const lon = parseFloat(cabin.lon);

        if (isNaN(lat) || isNaN(lon)) return;

        const marker = L.marker([lat, lon]).addTo(map);

// legg cabin-objektet direkte på markøren
marker.cabin = cabin;

marker.bindPopup(`
    <strong>${cabin.name || "Ukjent hytte"}</strong><br>
    Eier: ${cabin.owner || "Ukjent"}<br>
    Kommune: ${cabin.kommune || "?"}
`);

markers.push(marker);

    });
}

// -----------------------------
// Search
// -----------------------------
ffunction setupSearch() {
    const input = document.getElementById('search');

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase();

        markers.forEach(marker => {
            const cabin = marker.cabin;

            const match =
                cabin.name?.toLowerCase().includes(q) ||
                cabin.owner?.toLowerCase().includes(q) ||
                cabin.kommune?.toLowerCase().includes(q);

            if (match) {
                marker.addTo(map);
            } else {
                map.removeLayer(marker);
            }
        });
    });
}

// -----------------------------
// Init everything
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadCSV();
    setupSearch();
});