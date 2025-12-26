// === GLOBALT DATASETT ===
let steder = []; // fylles når tettsteder_3.json lastes

// === STARTUP ===
document.addEventListener("DOMContentLoaded", () => {
  console.log("Init startet");

  const sokInput = document.getElementById("sokInput");
  const visInfoBtn = document.getElementById("visInfoBtn");
  const mapContainer = document.getElementById("map");

  if (!sokInput || !visInfoBtn || !mapContainer) {
    console.error("Mangler sokInput, visInfoBtn eller map i DOM");
    return;
  }

  // Opprett kartet (tomt kart ved oppstart)
  const map = L.map("map").setView([65.0, 15.0], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Last tettsteder fra lokal JSON
  fetch("tettsteder_3.json")
    .then(r => r.json())
    .then(data => {
      steder = data;
      console.log("Lastet tettsteder_3.json –", steder.length, "poster");
      settStatus("Klar. Søk etter et tettsted.", true);

      // Koble søk
      visInfoBtn.addEventListener("click", () => visTettsted(map));
      sokInput.addEventListener("keyup", e => {
        if (e.key === "Enter") visTettsted(map);
      });
    })
    .catch(err => {
      console.error("Feil ved lasting av tettsteder:", err);
      settStatus("Kunne ikke laste lokal tettstedsfil.", false);
    });
});

// === STATUSVISNING ===
function settStatus(tekst, ok) {
  const el = document.getElementById("statusDisplay");
  if (!el) return;
  el.textContent = tekst;
  el.className = ok ? "status-ok" : "status-error";
}

// === NORMALISERING ===
function normaliser(str) {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// === HOVEDFUNKSJON: VIS TETTSTED / STED ===
async function visTettsted(map) {
  const inputEl = document.getElementById("sokInput");
  if (!inputEl) return;

  const input = inputEl.value;
  const sok = normaliser(input);

  if (!sok) {
    settStatus("Skriv inn et stedsnavn først.", false);
    return;
  }

  if (!Array.isArray(steder) || steder.length === 0) {
    settStatus("Tettsteder er ikke lastet ennå.", false);
    return;
  }

  // 1) Prøv DIN lokale liste først
  let entry = steder.find(e => normaliser(e.tettsted || "") === sok);

  if (entry) {
    console.log("Fant tettsted i lokal liste:", entry);

    // Hvis vi mangler sone: ikke forsøk å hente pris
    if (!entry.sone) {
      settStatus(`Fant ${entry.tettsted}, men mangler prisområde (sone).`, false);
      oppdaterFelter(entry, null);
      visPåKart(map, {
        lat: entry.lat_decimal,
        lon: entry.lon_decimal,
        navn: entry.tettsted,
        fylke: entry.fylke,
        k_slagord: entry.k_slagord
      });
      return;
    }

    const pris = await hentSpotpris(entry.sone);

    if (pris == null) {
      settStatus(
        `Fant ${entry.tettsted}, men ingen strømpris for sone ${entry.sone}.`,
        false
      );
    } else {
      settStatus(`Fant ${entry.tettsted} (sone ${entry.sone}).`, true);
    }

    oppdaterFelter(entry, pris);
    visPåKart(map, {
      lat: entry.lat_decimal,
      lon: entry.lon_decimal,
      navn: entry.tettsted,
      fylke: entry.fylke,
      k_slagord: entry.k_slagord
    });

    return;
  }

  // 2) Ikke funnet lokalt → prøv Kartverket (SSR)
  console.log("Fant ikke i lokal liste, prøver Kartverket (SSR) for:", sok);
  const ssr = await hentStedFraSSR(sok);

  if (!ssr) {
    settStatus(
      `Fant verken lokalt tettsted eller stedsnavn i Kartverket for "${input}".`,
      false
    );
    oppdaterFelter(null, null);
    return;
  }

  console.log("Fant stedsnavn via Kartverket:", ssr);

  settStatus(
    `Fant "${ssr.navn}" via Kartverket (kommune ${ssr.kommune || "ukjent"}) – lokale tall og pris mangler.`,
    true
  );

  // Fake entry som passer til oppdaterFelter()
  const fakeEntry = {
    tettsted: ssr.navn,
    k_nr: ssr.kommune || "",
    fylke: ssr.fylke || "",
    sone: "–",
    antall: "",
    areal: "",
    sysselsatte: "",
    tilskudd: "",
    språk: "",
    k_slagord: "",
    f_slagord: ""
  };

  oppdaterFelter(fakeEntry, null);

  visPåKart(map, {
    lat: ssr.lat,
    lon: ssr.lon,
    navn: ssr.navn,
    fylke: ssr.fylke,
    k_slagord: ""
  });
}

// === VIS PÅ KART ===
function visPåKart(map, sted) {
  if (typeof sted.lat !== "number" || typeof sted.lon !== "number") {
    console.warn("Ugyldige koordinater for sted:", sted);
    return;
  }

  // Fjern gamle markører
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Legg til markør
  L.marker([sted.lat, sted.lon])
    .addTo(map)
    .bindPopup(
      `
      <strong>${sted.navn || ""}</strong><br>
      ${sted.fylke || ""}<br>
      ${sted.k_slagord || ""}
    `
    )
    .openPopup();

  // Zoom inn
  map.setView([sted.lat, sted.lon], 12, {
    animate: true,
    duration: 0.6
  });
}

// === HENT SPOTPRIS (HVAKOSTERSTROMMEN) ===
async function hentSpotpris(sone) {
  if (!sone || sone === "–") return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || !data.length) return null;

    const currentHour = now.getHours();
    const entry = data.find(
      e => new Date(e.time_start).getHours() === currentHour
    );

    return entry ? entry.NOK_per_kWh : null;
  } catch (err) {
    console.error("Feil ved henting av spotpris:", err);
    return null;
  }
}

// === HENT STED FRA KARTVERKET (SSR) ===
async function hentStedFraSSR(sok) {
  const url = `https://ws.geonorge.no/stedsnavn/v1/navn?sok=${encodeURIComponent(
    sok
  )}&treffPerSide=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("SSR svarte ikke OK:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data.navn || data.navn.length === 0) {
      console.warn("Ingen treff i SSR for:", sok);
      return null;
    }

    const n = data.navn[0];

    const lat = n.representasjonspunkt?.nord;
    const lon = n.representasjonspunkt?.aust;

    if (typeof lat !== "number" || typeof lon !== "number") {
      console.warn("SSR ga ugyldige koordinater for:", sok, n.representasjonspunkt);
      return null;
    }

    return {
      navn: n.skrivemåte,
      kommune:
        n.kommuner && n.kommuner[0] ? n.kommuner[0].kommunenavn : "",
      fylke: n.fylker && n.fylker[0] ? n.fylker[0].fylkesnavn : "",
      lat,
      lon,
      navnetype: n.navnetype
    };
  } catch (err) {
    console.error("Feil ved henting fra SSR:", err);
    return null;
  }
}

// === OPPDATER INFO-KORT ===
function settTekst(id, verdi) {
  const el = document.getElementById(id);
  if (!el) return;

  if (verdi == null || verdi === "") {
    el.textContent = "–";
  } else {
    el.textContent = verdi;
  }
}

function oppdaterFelter(entry, pris) {
  settTekst("tettstedDisplay", entry?.tettsted);
  settTekst("kNrDisplay", entry?.k_nr);
  settTekst("fylkeDisplay", entry?.fylke);
  settTekst("soneDisplay", entry?.sone);
  settTekst("antallDisplay", entry?.antall);
  settTekst("arealDisplay", entry?.areal);
  settTekst("sysselsatteDisplay", entry?.sysselsatte);
  settTekst("tilskuddDisplay", entry?.tilskudd);
  settTekst("sprakDisplay", entry?.språk);
  settTekst("kSlagordDisplay", entry?.k_slagord);
  settTekst("fSlagordDisplay", entry?.f_slagord);

  if (pris == null) {
    settTekst("prisDisplay", "Pris ikke tilgjengelig");
  } else {
    settTekst("prisDisplay", `${(pris * 100).toFixed(2)} øre/kWh`);
  }
}