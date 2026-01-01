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
// Load CSV (semicolon-separated)
// -----------------------------
async function loadCSV() {
    try {
        const response = await fetch('data/dnt_hytter.csv');
        const text = await response.text();

        const rows = text.split('\n').map(r => r.trim()).filter(r => r.length > 0);
        const headers = rows[0].split(';');

        cabinData = rows.slice(1).map(row => {
            const cols = row.split(';');
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

    cabinData.forEach(hytte => {
        const lat = parseFloat(hytte['@lat']);
        const lon = parseFloat(hytte['@lon']);

        if (isNaN(lat) || isNaN(lon)) return;

        const marker = L.marker([lat, lon]).addTo(map);

        // koble data til markøren
        marker.hytte = hytte;

        marker.bindPopup(`
            <strong>${hytte.name || "Ukjent hytte"}</strong><br>
            Operatør: ${hytte.operator || "Ukjent"}<br>
            Klassifisering: ${hytte["dnt:classification"] || "?"}<br>
            <a href="${hytte.website}" target="_blank">Nettside</a>
        `);

        markers.push(marker);
    });
}

// -----------------------------
// Search
// -----------------------------
function setupSearch() {
    const input = document.getElementById('search');

    if (!input) {
        console.error("Fant ikke søkefeltet (#search)");
        return;
    }

    input.addEventListener('input', () => {
        const q = input.value.toLowerCase();

        markers.forEach(marker => {
            const h = marker.hytte;

            const match =
                h.name?.toLowerCase().includes(q) ||
                h.operator?.toLowerCase().includes(q) ||
                h["dnt:classification"]?.toLowerCase().includes(q);

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