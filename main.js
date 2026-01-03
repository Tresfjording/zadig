//03.01.2026  - 06:42:33
// Last data
function toNumber(value) {
  if (!value) return null;
  return parseFloat(String(value).replace(",", "."));
}
// Hent dagens dato
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}/${month}-${day}`;
}

// Hent strømpris for alle soner
function fetchStrømpriserForAlleSoner() {
  const dato = getTodayDateString();
  const soner = ["NO1", "NO2", "NO3", "NO4", "NO5"];
  const promises = soner.map(sone =>
    fetch(`https://www.hvakosterstrommen.no/api/v1/prices/${dato}_${sone}.json`)
      .then(r => r.json())
      .then(priser => {
        const snitt = priser.reduce((sum, p) => sum + p.NOK_per_kWh, 0) / priser.length;
        return { sone, snitt };
      })
      .catch(() => ({ sone, snitt: null }))
  );
  return Promise.all(promises).then(resultat => {
    const strøm = {};
    resultat.forEach(({ sone, snitt }) => strøm[sone] = snitt);
    return strøm;
  });
}
// main.js

// Hjelpefunksjon: konverterer tall med komma til punktum
function toNumber(value) {
  if (!value) return null;
  return parseFloat(String(value).replace(",", "."));
}

// Hjelpefunksjon: lager dagens dato-streng til strømpris-API
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}/${month}-${day}`;
}

// … resten av koden med Promise.all og initMap …
// Last alle data
Promise.all([
  fetch("samlet.json").then(r => r.json()),
  fetch("facts_all.json").then(r => r.json()),
  fetchStrømpriserForAlleSoner()
]).then(([samlet, facts, strøm]) => {
  initMap(samlet, facts, strøm);
});
function getTodayPriceUrl(zone) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${zone}.json`;
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