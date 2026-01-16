// nowcast.js – enkel værmodul for MET Nowcast 2.0
export async function hentNowcast(lat, lon, visningsNodeId = "vaermelding") {
  const url = `https://api.met.no/weatherapi/nowcast/2.0/complete.json?lat=${lat}&lon=${lon}`;
  const headers = {
    "User-Agent": "selsomt.no (kontakt@din-epost.no)"
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error("Klarte ikke hente værdata");

    const data = await response.json();

    const radar = data.properties.meta.radar_coverage;
    const oppdatert = data.properties.meta.updated_at;

    const serie = data.properties.timeseries?.[0];
    const detaljer = serie?.data?.instant?.details;
    const symbol = serie?.data?.next_1_hours?.summary?.symbol_code;
    const nedbor = serie?.data?.next_1_hours?.details?.precipitation_amount;

    const temp = detaljer?.air_temperature;
    const vind = detaljer?.wind_speed;
    const retning = detaljer?.wind_from_direction;

    const ikon = velgIkon(symbol);

    const tekst = `
      <strong>Værmelding</strong><br>
      ${ikon} ${symbol?.replace("_", " ")} – ${nedbor?.toFixed(1)} mm/h<br>
      🌡️ ${temp?.toFixed(1)}°C | 💨 ${vind?.toFixed(1)} m/s fra ${vindRetning(retning)}<br>
      🕒 ${formatTid(oppdatert)} | Radar: ${radar}
    `;

    document.getElementById(visningsNodeId).innerHTML = tekst;

  } catch (err) {
    document.getElementById(visningsNodeId).innerHTML =
      "⚠️ Klarte ikke hente værdata.";
    console.error("Nowcast-feil:", err);
  }
}

// Hjelpefunksjoner
function velgIkon(symbol) {
  if (!symbol) return "❓";
  if (symbol.includes("rain")) return "🌧️";
  if (symbol.includes("snow")) return "❄️";
  if (symbol.includes("clearsky")) return "☀️";
  if (symbol.includes("cloudy")) return "☁️";
  return "🌦️";
}

function vindRetning(grader) {
  const retninger = [
    "nord", "nordøst", "øst", "sørøst",
    "sør", "sørvest", "vest", "nordvest"
  ];
  const index = Math.round(((grader % 360) / 45)) % 8;
  return retninger[index];
}

function formatTid(isoTid) {
  const tid = new Date(isoTid);
  return tid.toLocaleTimeString("no-NO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

