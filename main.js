let map;
let places = [];
let cabins = [];
let facts = [];
let searchIndex = [];
// hytteikon
//const hyttikon = L.icon({
  //  iconUrl: "img/hytteikon.png",
  //  iconSize: [18, 18],
  //  iconAnchor: [9, 9]
//});
// -------------------- OPPSTART --------------------
document.addEventListener("DOMContentLoaded", () => {
    initMap();

    loadData()
        .then(() => {
            console.log("Data lastet!");

            buildSearchIndex();   // 1. Bygg søkeindeks
            initSearch();         // 2. Aktiver søk
            renderAllHytteMarkers(); // 3. Tegn hytter
            setRandomFact();      // 4. Vis funfact
        })
        .catch(err => {
            console.error("loadData feilet, men vi fortsetter:", err);

            // Kart og fakta kan fortsatt vises
            renderAllHytteMarkers();
            setRandomFact();
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

// -------------------- SØK --------------------
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
                document.getElementById("place-search").value = label;
                const suggestionsEl = document.getElementById("search-suggestions");
                suggestionsEl.innerHTML = "";
                suggestionsEl.style.display = "none";
                sggestionsEl.innerHTML = "";
                suggestionsEl.style.display = "none";
            }
        }
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

    // Oppdater inputfeltet med korrekt verdi
    document.getElementById("place-search").value = label;

    // Fokus på kart og infoboks
    if (match.type === "t") {
        focusOnPlace(match.ref);
        updateInfoBoxWithPlace(match.ref);
    } else if (match.type === "h") {
        focusOnCabin(match.ref);
        updateInfoBoxWithCabin(match.ref);
    }

    // Lukk forslagslista
    const suggestionsEl = document.getElementById("search-suggestions");
    suggestionsEl.innerHTML = "";
    suggestionsEl.style.display = "none";
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

// -------------------- INFOBOKS --------------------
function updateInfoBoxWithPlace(place) {
    const titleEl = document.getElementById("info-title");
    const contentEl = document.getElementById("info-content");
    const priceArea = place.t_sone.replace("N", "NO");
    const strømpris = await fetchCurrentPowerPrice(priceArea);
    titleEl.textContent = place.t_knavn || "Ukjent sted";
    contentEl.innerHTML = `
<p><strong>Strømpris nå:</strong> <span style="color:${getPriceColor(strømpris)};">
  ${strømpris.toFixed(2)} kr/kWh
</span></p>
        <p><strong>Fylke:</strong> ${place.t_knavn}</p>
        <p><strong>Fylke:</strong> ${place.t_fnavn}</p>
        <p><strong>Innbyggere:</strong> ${place.k_innbyggere}</p>
        <p><strong>Areal:</strong> ${place.areal}</p>
        <p><strong>Ansatte:</strong> ${place.k_ansatte}</p>
        <p><strong>Språk:</strong> ${place.k_språk}</p>
        <p><strong>Slagord:</strong> ${place.k_slagord}</p>
        <p><strong>Tilskudd:</strong> ${place.tilskudd}</p>
        <p><strong>Slagord:</strong> ${place.k_slagord}</p>
    `;
}

function updateInfoBoxWithCabin(hytte) {
    const titleEl = document.getElementById("info-title");
    const contentEl = document.getElementById("info-content");

    titleEl.textContent = hytte.h_navn || "Ukjent hytte";
    contentEl.innerHTML = `
        <p><strong>Strømpris nå:</strong> ${
  strømpris ? strømpris.toFixed(2) + " kr/kWh" : "Ikke tilgjengelig"
}</p>
        <p><strong>Fylke:</strong> ${hytte.t_knavn}</p>
        <p><strong>Type:</strong> ${hytte.h_type}</p>
        <p><strong>Operatør:</strong> ${hytte.h_operatør}</p>
        <p><strong>Kommune:</strong> ${hytte.h_operatør}</p>
        <p><a href="${hytte.h_url}" target="_blank">Se mer på UT.no</a></p>
    `;
}

// -------------------- HYTTE-MARKØRER --------------------
function renderAllHytteMarkers() {
    if (!cabins || cabins.length === 0) return;

    cabins.forEach(h => {
        const lat = parseFloat(String(h.h_lat).replace(",", "."));
        const lon = parseFloat(String(h.h_lon).replace(",", "."));
        if (!lat || !lon) return;

        const marker = L.marker([lat, lon], {
            title: h.h_navn,
            icon: hyttikon   // ← bruk trekanten her
        });

        marker.on("mouseover", () => updateInfoBoxWithCabin(h));
        marker.addTo(map);
    });
}

// -------------------- TRIVIA --------------------
function setRandomFact() {
    const el = document.getElementById("random-fact");
    if (!el || !facts || facts.length === 0) return;

    const random = facts[Math.floor(Math.random() * facts.length)];
    el.textContent = random;
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
function getPriceColor(price) {
  if (price < 0.5) return "green";
  if (price < 1.0) return "orange";
  return "red";
}