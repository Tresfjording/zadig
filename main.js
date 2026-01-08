let tettsteder = [];
let hytter = [];
let valgtMarker = null;

// 🔹 Last tettsteder
async function lastTettsteder() {
  try {
    const res = await fetch("tettsteder_3.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    tettsteder = await res.json();
    console.log("Lastet tettsteder:", tettsteder.length);
  } catch (err) {
    console.error("Feil ved lasting av tettsteder:", err);
    infobox.innerHTML =
      "<p>Feil ved lasting av tettsteder. Prøv å laste siden på nytt.</p>";
  }
}

// 🔹 Last hytter
async function lastHytter() {
  try {
    const res = await fetch("hytter.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    hytter = await res.json();
    console.log("Lastet hytter:", hytter.length);
  } catch (err) {
    console.error("Feil ved lasting av hytter:", err);
    infobox.innerHTML =
      "<p>Feil ved lasting av hytter. Prøv å laste siden på nytt.</p>";
  }
}

// 🔹 Hent strømpris for én sone
async function hentPrisNaa(sone) {
  if (!sone) return null;

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const url = `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${sone}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const verdier = data
      .map(p => parseFloat(p.NOK_per_kWh))
      .filter(v => !isNaN(v));

    if (verdier.length === 0) return null;

    const snitt = verdier.reduce((a, b) => a + b, 0) / verdier.length;
    return snitt.toFixed(2);
  } catch (err) {
    console.error("Feil ved henting av pris:", err);
    return null;
  }
}

// 🔹 Hent landssnitt
async function hentLandssnitt() {
  const soner = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  let alle = [];

  for (const sone of soner) {
    const pris = await hentPrisNaa(sone);
    if (pris !== null) alle.push(parseFloat(pris));
  }

  if (alle.length === 0) {
    console.warn("Fant ingen gyldige verdier for landssnitt");
    return null;
  }

  const snitt = alle.reduce((a, b) => a + b, 0) / alle.length;
  console.log("Landssnitt:", snitt.toFixed(2));
  return snitt.toFixed(2);
}

// 🔹 Oppdater infoboks
async function oppdaterInfoboks(entry, type) {
  const prisNaa = entry.sone ? await hentPrisNaa(entry.sone) : null;

  let tittel = "";
  if (type === "tettsted") {
    tittel = entry.tettsted || "Ukjent tettsted";
  } else if (type === "hytte") {
    tittel = entry.name || entry.tettsted || "Ukjent hytte";
  } else {
    tittel = entry.name || entry.tettsted || "Ukjent sted";
  }

  let html = `<h2>${tittel}</h2><ul>`;

  if (entry.operator)
    html += `<li><strong>Driftet av:</strong> ${entry.operator}</li>`;

  if (entry["dnt:classification"])
    html += `<li><strong>Type:</strong> ${entry["dnt:classification"]}</li>`;

  if (entry.website)
    html += `<li><strong>Nettside:</strong> <a href="${entry.website}" target="_blank">Besøk</a></li>`;

  if (prisNaa)
    html += `<li><strong>Pris nå:</strong> ${prisNaa} kr/kWh</li>`;

  html += "</ul>";
  infobox.innerHTML = html;
}

// 🔹 Plasser hytter på kartet
function plasserAlleHytter() {
  hytter.forEach(hytte => {
    const marker = L.marker([hytte.lat, hytte.lon]).addTo(map);
    marker.on("click", () => {
      if (valgtMarker) valgtMarker.setOpacity(1);
      valgtMarker = marker;
      valgtMarker.setOpacity(0.5);
      oppdaterInfoboks(hytte, "hytte");
    });
  });
}

// 🔹 Autocomplete
function leggTilAutocomplete() {
  const input = document.getElementById("search");
  input.addEventListener("input", () => {
    const søk = input.value.toLowerCase();
    const list = document.getElementById("suggestions");
    list.innerHTML = "";

    const treff = tettsteder.filter(t =>
      t.tettsted && t.tettsted.toLowerCase().includes(søk)
    );

    treff.slice(0, 10).forEach(t => {
      const item = document.createElement("li");
      item.textContent = t.tettsted;
      item.addEventListener("click", () => {
        map.setView([t.lat, t.lon], 12);
        oppdaterInfoboks(t, "tettsted");
        list.innerHTML = "";
        input.value = t.tettsted;
      });
      list.appendChild(item);
    });
  });
}

// 🔹 Oppstart
document.addEventListener("DOMContentLoaded", async () => {
  await lastTettsteder();
  await lastHytter();
  await hentLandssnitt();
  plasserAlleHytter();
  leggTilAutocomplete();
});