let map;
let places = [];
let cabins = [];
let facts = [];
let searchIndex = [];

document.addEventListener("DOMContentLoaded", async () => {
    initMap();

    try {
        await loadData();
        buildSearchIndex();
    } catch (err) {
        console.error("loadData feilet, men vi fortsetter:", err);
    }

    initSearch();
    renderAllHytteMarkers();
    setRandomFact();
});

// -------- Kart --------
function initMap() {
    map = L.map("map").setView([63.0, 11.0], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
    }).addTo(map);
}

// -------- Data --------
async function loadData() {
    try {
        const [samletResp, factsResp] = await Promise.all([
            fetch("https://www.tresfjording.no/samlet.json"),
            fetch("facts_all.json")
        ]);

        if (!samletResp.ok || !factsResp.ok) {
            console.error("Kunne ikke hente en eller begge filer");
            return;
        }

        const samletData = await samletResp.json();
        facts = await factsResp.json();

        places = samletData.filter(d => d.t_knavn);
        cabins = samletData.filter(d => d.h_navn);

        console.log("Tettsteder:", places.length);
        console.log("Hytter:", cabins.length);
    } catch (err) {
        console.error("Feil i loadData:", err);
    }
}

// -------- Søk --------
function buildSearchIndex() {
    searchIndex = [];

    places.forEach(t => {
        if (t.t_knavn) {
            searchIndex.push({ type: "t", label: t.t_knavn, ref: t });
        }
    });

    cabins.forEach(h => {
        if (h.h_navn) {
            searchIndex.push({ type: "h", label: h.h_navn, ref: h });
        }
    });

    searchIndex.sort((a, b) => a.label.localeCompare(b.label));
    console.log("Søkeindeks bygget:", searchIndex.length);
}

function initSearch() {
    console.log("initSearch kjører!");

    const searchInput = document.getElementById("place-search");
    const suggestionsEl = document.getElementById("search-suggestions");

    if (!searchInput || !suggestionsEl) return;

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
        console.log("searchIndex:", searchIndex);
        const matches = searchIndex.filter(item =>
            item.label.toLowerCase().includes(query)
        );
        renderSuggestions(matches);
    });

    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const first = suggestionsEl.querySelector(".suggestion-item");
            if (first) {
                first.click();
            } else {
                handleSearch(searchInput.value);
            }
        }
    });
}

function renderSuggestions(matches) {
    const suggestionsEl = document.getElementById("search-suggestions");
    suggestionsEl.innerHTML = "";

    if (!matches || matches.length === 0) return;

    matches.slice(0, 10).forEach(item => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.textContent = item.label;

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

    if (match.type === "t") {
        focusOnPlace(match.ref);
        updateInfoBoxWithPlace(match.ref);
    } else if (match.type === "h") {
        focusOnCabin(match.ref);
        updateInfoBoxWithCabin(match.ref);
    }

    document.getElementById("search-suggestions").innerHTML = "";
}

// -------- Kartfokus --------
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

// -------- Infoboks --------
function updateInfoBoxWithPlace(place) {
    const titleEl = document.getElementById("info-title");
    const contentEl = document.getElementById("info-content");

    titleEl.textContent = place.t_knavn || "Ukjent sted";
    contentEl.innerHTML = `
        <p><strong>Fylke:</strong> ${place.t_fnavn}</p>
        <p><strong>Innbyggere:</strong> ${place.k_innbyggere}</p>
        <p><strong>Språk:</strong> ${place.k_språk}</p>
        <p><strong>Slagord:</strong> ${place.k_slagord}</p>
    `;
}

function updateInfoBoxWithCabin(hytte) {
    const titleEl = document.getElementById("info-title");
    const contentEl = document.getElementById("info-content");

    titleEl.textContent = hytte.h_navn || "Ukjent hytte";
    contentEl.innerHTML = `
        <p><strong>Type:</strong> ${hytte.h_type}</p>
        <p><strong>Operatør:</strong> ${hytte.h_operatør}</p>
        <p><a href="${hytte.h_url}" target="_blank">Se mer på UT.no</a></p>
    `;
}

// -------- Hytte-markører --------
function renderAllHytteMarkers() {
    if (!cabins || cabins.length === 0) return;

    cabins.forEach(h => {
        const lat = parseFloat(String(h.h_lat).replace(",", "."));
        const lon = parseFloat(String(h.h_lon).replace(",", "."));
        if (!lat || !lon) return;

        const marker = L.marker([lat, lon], { title: h.h_navn });
        marker.on("mouseover", () => updateInfoBoxWithCabin(h));
        marker.addTo(map);
    });
}

// -------- Trivia --------
function setRandomFact() {
    const el = document.getElementById("random-fact");
    if (!el || !facts || facts.length === 0) return;

    const random = facts[Math.floor(Math.random() * facts.length)];
    el.textContent = random;
}