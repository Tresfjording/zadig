import kommuner from "./data/to_kommuner.js";
// -------------------- MARKØRER --------------------

function tegnAlleHyttemarkorer() {
  if (!hytter || hytter.length === 0) {
    console.warn("Ingen hytter å vise");
    return;
  }

  hytter.forEach(h => {
    const lat = parseFloat(String(h.h_lat).replace(",", "."));
    const lon = parseFloat(String(h.h_lon).replace(",", "."));

    if (!lat || !lon) {
      console.warn("Ugyldige koordinater for hytte:", h.h_name, h.h_lat, h.h_lon);
      return;
    }

    const markor = L.circleMarker([lat, lon], {
      radius: 6,
      color: "#228B22",
      fillColor: "#90EE90",
      fillOpacity: 0.8,
      weight: 1
    });

    markor.bindTooltip(
      `${h.h_name || "Ukjent hytte"} – ${h["h_dnt:classification"] || "Ukjent type"}`,
      { direction: "top", offset: [0, -6] }
    );

    markor.on("mouseover", () => oppdaterInfoboksHytte(h));
    markor.addTo(kart);
  });

  console.log("Tegnet", hytter.length, "hytter");
}

function tegnAlleTettstedmarkorer() {
  if (!tettsteder || tettsteder.length === 0) {
    console.warn("Ingen tettsteder å vise");
    return;
  }

  tettsteder.forEach(t => {
    const lat = parseFloat(t.t_lat);
    const lon = parseFloat(t.t_lon);

    if (!lat || !lon) {
      console.warn("Ugyldige koordinater for tettsted:", t.t_tettsted || t.tettsted, t.t_lat, t.t_lon);
      return;
    }

    const markor = L.circleMarker([lat, lon], {
      radius: 6,
      color: "#0077cc",
      fillColor: "#66ccff",
      fillOpacity: 0.8,
      weight: 1
    });

    const navn = t.t_tettsted || t.tettsted || "Ukjent tettsted";

    markor.bindTooltip(navn, {
      direction: "top",
      offset: [0, -6]
    });

    markor.on("mouseover", () => oppdaterInfoboksTettsted(t));

    markor.addTo(kart);
  });

  console.log("Tegnet", tettsteder.length, "tettsteder");
}

// -------------------- GEOJSON --------------------

async function loadGeoJson(url) {
  try {
    const response = await fetch(url);
// -------------------- GLOBALE VARIABLER --------------------

let kart;
let tettsteder = [];
let hytter = [];
let sitat = "";
let sokeIndeks = [];

// 13.01.2026  - 21:54:05 (ren og ryddig versjon)


const legendHTML = `
  <div class="legend">
    <span class="legend-item">
      <span class="legend-circle legend-hytte"></span> Hytte
    </span>
    <span class="legend-item">
      <span class="legend-circle legend-tettsted"></span> Tettsted
    </span>
  </div>
`;

// -------------------- OPPSTART --------------------

document.addEventListener("DOMContentLoaded", () => {
  initKart();

  lastData()
    .then(() => {
      byggSokeindeks();
      initSok();
      tegnAlleHyttemarkorer();
      tegnAlleTettstedmarkorer();


    })
    .catch(err => {
      console.error("Feil under lasting av data:", err);
    });
});

// -------------------- KART --------------------

function initKart() {
kart = L.map('map').setView([63.1, 7.7], 6);


  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(kart);

  renderGeoJsonLayer(kommuner);
}

// -------------------- DATA --------------------

async function lastData() {
  // 1. Last kommuner separat
 const kommuneResp = await fetch("./data/kommuner.json");
 const kommuneData = await kommuneResp.json();
 renderGeoJsonLayer(kommuneData);

  console.log("GeoJSON type:", kommuneData.type);
  console.log("Har features:", Array.isArray(kommuneData.features));
  console.log("Antall features:", kommuneData.features?.length);
  renderGeoJsonLayer(kommuneData);

  // 2. Last resten parallelt
  const [tettstederResp, hytterResp, faktaResp] = await Promise.all([
    fetch("tettsteder_3.json"),
    fetch("dnt_hytter.json"),
    fetch("facts_all.json")
  ]);

  const tettstederData = await tettstederResp.json();
  const hytterData = await hytterResp.json();
  const faktaData = await faktaResp.json();

  // 3. Lagre dataene - Støtt både ren liste og { places: [...] } / { tettsteder: [...] }
  tettsteder = Array.isArray(tettstederData)
    ? tettstederData
    : (tettstederData.places || tettstederData.tettsteder || []);

  hytter = Array.isArray(hytterData)
    ? hytterData
    : (hytterData.hytter || hytterData.cabins || []);

  sitat = faktaData.sitat || faktaData.quote || "";

  console.log("Tettsteder lastet:", tettsteder.length);
  console.log("Hytter lastet:", hytter.length);
  console.log("Sitat lastet:", sitat);
}

// -------------------- SØK --------------------

function byggSokeindeks() {
  sokeIndeks = [];

  // Tettsteder
  tettsteder.forEach(t => {
    const navn = t.t_tettsted || t.tettsted;
    if (typeof navn === "string" && navn.trim() !== "") {
      sokeIndeks.push({ type: "t", etikett: navn, ref: t });
    }
  });

  // Hytter
  hytter.forEach(h => {
    if (typeof h.h_name === "string" && h.h_name.trim() !== "") {
      sokeIndeks.push({ type: "h", etikett: h.h_name, ref: h });
    }
  });

  sokeIndeks.sort((a, b) => a.etikett.localeCompare(b.etikett));

  console.log("Søkeindeks bygget, antall elementer:", sokeIndeks.length);
}

function initSok() {
  const sokInput = document.getElementById("place-search");
  const forslagEl = document.getElementById("search-suggestions");
  let aktivIndeks = -1;

  if (!sokInput || !forslagEl) return;

  sokInput.addEventListener("input", () => {
    const sporring = sokInput.value.toLowerCase();
    const treff = sokeIndeks.filter(item =>
      item.etikett.toLowerCase().includes(sporring)
    );
    visForslag(treff);
    aktivIndeks = -1;
  });

  sokInput.addEventListener("keydown", (e) => {
    const elementer = forslagEl.querySelectorAll(".suggestion-item");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (elementer.length === 0) return;
      aktivIndeks = (aktivIndeks + 1) % elementer.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (elementer.length === 0) return;
      aktivIndeks = (aktivIndeks - 1 + elementer.length) % elementer.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (aktivIndeks >= 0 && elementer[aktivIndeks]) {
        elementer[aktivIndeks].click();
      } else {
        handterSok(sokInput.value);
      }
    }

    elementer.forEach((item, indeks) => {
      item.classList.toggle("active", indeks === aktivIndeks);
    });
  });
}

function visForslag(treff) {
  const forslagEl = document.getElementById("search-suggestions");
  forslagEl.innerHTML = "";

  if (!treff || treff.length === 0) {
    forslagEl.style.display = "none";
    return;
  }

  forslagEl.style.display = "block";

  treff.slice(0, 10).forEach((item, indeks) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = item.etikett;
    div.dataset.index = indeks;
    div.addEventListener("mousedown", () => {
      handterSok(item.etikett);
    });
    forslagEl.appendChild(div);
  });
}

function handterSok(etikett) {
  const treff = sokeIndeks.find(item =>
    item.etikett.toLowerCase() === etikett.toLowerCase()
  );

  if (!treff) return;

  const sokInput = document.getElementById("place-search");
  if (sokInput) {
    sokInput.value = etikett;
  }

  const forslagEl = document.getElementById("search-suggestions");
  forslagEl.innerHTML = "";
  forslagEl.style.display = "none";

  if (treff.type === "t") {
    fokuserPaTettsted(treff.ref);
    oppdaterInfoboksTettsted(treff.ref);
  } else if (treff.type === "h") {
    fokuserPaHytte(treff.ref);
    oppdaterInfoboksHytte(treff.ref);
  }
}

// -------------------- KARTFOKUS --------------------

function fokuserPaTettsted(tettsted) {
  const lat = parseFloat(tettsted.t_lat);
  const lon = parseFloat(tettsted.t_lon);
  if (!lat || !lon) return;
  kart.setView([lat, lon], 11);
}

function fokuserPaHytte(hytte) {
  const lat = parseFloat(String(hytte.h_lat).replace(",", "."));
  const lon = parseFloat(String(hytte.h_lon).replace(",", "."));
  if (!lat || !lon) return;
  kart.setView([lat, lon], 13);
}

// -------------------- INFOBOKSER --------------------

// Tettsted (med strømpris)
async function oppdaterInfoboksTettsted(t) {
  const innholdEl = document.getElementById("info-content");
  const tittelEl = document.getElementById("info-title");
  if (!innholdEl || !tittelEl || !t) return;

  const navn = t.t_tettsted || t.tettsted || "Ukjent tettsted";
  tittelEl.textContent = navn;

  const lokalPris = await hentPrisForSone(t.t_sone);
  const snittPris = await hentNasjonaltSnitt();
  const farge = prisFarge(lokalPris, snittPris);

  const kommuneTekst =
    t.t_kommune && String(t.t_kommune).trim() !== ""
      ? t.t_kommune
      : "Ukjent";

  const fylkeTekst =
    t.t_fylke && String(t.t_fylke).trim() !== ""
      ? t.t_fylke
      : "Ukjent";

  const innbyggereTekst =
    t.t_innbyggere !== undefined && t.t_innbyggere !== null && String(t.t_innbyggere).trim() !== ""
      ? t.t_innbyggere
      : "?";

  const arealTekst =
    t.t_areal !== undefined && t.t_areal !== null && String(t.t_areal).trim() !== ""
      ? t.t_areal
      : "?";

  const prisTekst =
    typeof lokalPris === "number" ? lokalPris.toFixed(2) : "?";

  const snittTekst =
    typeof snittPris === "number" ? snittPris.toFixed(2) : "?";

  innholdEl.innerHTML = `
    <p><strong>Kommune:</strong> ${kommuneTekst}</p>
    <p><strong>Fylke:</strong> ${fylkeTekst}</p>
    <p><strong>Innbyggere:</strong> ${innbyggereTekst}</p>
    <p><strong>Areal:</strong> ${arealTekst} km²</p>
    <p><strong>Koordinater:</strong> ${t.t_lat}, ${t.t_lon}</p>
    <p><strong>Strømpris nå:</strong> <span style="color:${farge}">${prisTekst} kr/kWh</span></p>
    <p>Snittpris nasjonalt: ${snittTekst} kr/kWh</p>
  `;

  if (!innholdEl.innerHTML.includes("legend")) {
    innholdEl.innerHTML += legendHTML;
  }

  if (sitat) {
    innholdEl.innerHTML += `<p class="sitat">📝 ${sitat}</p>`;
  }
}

// Hytte (uten strømpris)
function oppdaterInfoboksHytte(h) {
  const innholdEl = document.getElementById("info-content");
  const tittelEl = document.getElementById("info-title");
  if (!innholdEl || !tittelEl || !h) return;

  tittelEl.textContent = h.h_name || "Ukjent hytte";

  innholdEl.innerHTML = `
    <p><strong>Operatør:</strong> ${h["h_dnt:operator"] || h.h_operator || "Ukjent"}</p>
    <p><strong>Type:</strong> ${h["h_dnt:classification"] || "Ukjent"}</p>
    <p><strong>Koordinater:</strong> ${h.h_lat}, ${h.h_lon}</p>
    <p><a href="${h.h_link || h.h_website || "#"}" target="_blank">Besøk UT.no</a></p>
  `;

  if (!innholdEl.innerHTML.includes("legend")) {
    innholdEl.innerHTML += legendHTML;
  }

  if (sitat) {
    innholdEl.innerHTML += `<p class="sitat">📝 ${sitat}</p>`;
  }
}

// -------------------- STRØMPRIS --------------------

function byggStromprisUrl(sone) {
  const nå = new Date();
  const år = nå.getFullYear();
  const måned = String(nå.getMonth() + 1).padStart(2, "0");
  const dag = String(nå.getDate()).padStart(2, "0");
  return `https://www.hvakosterstrommen.no/api/v1/prices/${år}/${måned}-${dag}_${sone}.json`;
}

async function hentPrisForSone(sone) {
  if (!sone) return null;
  const url = byggStromprisUrl(sone);
  try {
    const respons = await fetch(url);
    const data = await respons.json();
    const time = new Date().getHours();
    const rad = data[time];
    if (rad && typeof rad.NOK_per_kWh === "number") {
      return rad.NOK_per_kWh;
    }
    return null;
  } catch (err) {
    console.error("Feil ved henting av strømpris:", err);
    return null;
  }
}

async function hentNasjonaltSnitt() {
  const soner = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const priser = await Promise.all(soner.map(s => hentPrisForSone(s)));
  const gyldige = priser.filter(p => typeof p === "number");
  if (!gyldige.length) return null;
  const sum = gyldige.reduce((a, b) => a + b, 0);
  return sum / gyldige.length;
}

function prisFarge(pris, snitt) {
  if (pris === null || snitt === null) return "black";
  if (pris < snitt - 0.05) return "green";
  if (pris > snitt + 0.05) return "red";
  return "orange";
}
    if (!response.ok) throw new Error("Kunne ikke laste GeoJSON");
    return await response.json();
  } catch (err) {
    console.error("Feil ved lasting av GeoJSON:", err);
    return null;
  }
}

function renderGeoJsonLayer(data) {
  if (!data) return;

  // Håndter FeatureCollection
  const features =
    data.type === "FeatureCollection"
      ? data.features
      : Array.isArray(data)
      ? data
      : [];

  if (!features.length) {
    console.warn("Ingen features funnet i GeoJSON");
    return;
  }

  L.geoJSON(features, {
    style: {
      color: "#555",
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.1
    },
    onEachFeature: (feature, layer) => {
      layer.on("click", () => {
        visKommuneInfo(feature.properties);
      });
    }
  }).addTo(kart);
}