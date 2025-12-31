
  // Last lokal tettstedsliste
  await lastTettsteder();

  const sokInput = document.getElementById("sokInput");
  const visInfoBtn = document.getElementById("visInfoBtn");

  if (!sokInput || !visInfoBtn) {
    console.error("Fant ikke søkefelt eller knapp i DOM.");
    return;
  }

  // Koble søk til visTettsted (ALT A)
  visInfoBtn.addEventListener("click", () => visTettsted(map));
  sokInput.addEventListener("keyup", e => {
    if (e.key === "Enter") visTettsted(map);
  });

  settStatus("Skriv inn et tettsted for å starte.", true);
  const tettstedEl = document.getElementById("tettstedDisplay");
  const prisEl = document.getElementById("prisDisplay");

  // --------------------------
  // HOVEDFUNKSJON: VIS TETTSTED / STED
  // --------------------------
  async function visTettsted(map) {
  const inputEl = document.getElementById("sokInput");
  if (!inputEl) return;

  const input = inputEl.value;
  const sok = normaliser(input);

  console.log("🔍 Start visTettsted");
  console.log("Input fra bruker:", input);
  console.log("Normalisert søkestreng:", sok);

  if (!sok) {
    settStatus("Skriv inn et stedsnavn først.", false);
    return;
  }

  if (!Array.isArray(steder) || steder.length === 0) {
    settStatus("Tettsteder er ikke lastet ennå.", false);
    return;
  }

  // ----------------------------------------------------
  // 1) Prøv lokal liste først
  // ----------------------------------------------------
  let entry = steder.find(e => normaliser(e.tettsted || "") === sok);

  if (entry) {
    console.log("Fant tettsted i lokal liste:", entry);

    // Mangler sone → vis likevel, men uten pris
    if (!entry.sone) {
      settStatus(
        `Fant ${entry.tettsted}, men mangler prisområde (sone).`,
        false
      );

      oppdaterFelter(entry, null);

      visPåKart(map, {
        lat: entry.lat_decimal,
        lon: entry.lon_decimal,
        navn: entry.tettsted
      });

      if (
        typeof entry.lat_decimal === "number" &&
        typeof entry.lon_decimal === "number"
      ) {
        hentNowcast(entry.lat_decimal, entry.lon_decimal);
      }

      return;
    }

    // Har sone → hent pris
    const pris = await hentSpotpris(entry.sone);
    console.log("✅ Fant lokalt:", entry.tettsted, "Sone:", entry.sone);

    if (pris == null) {
      settStatus(
        `Fant ${entry.tettsted} (lokalt), men ingen strømpris for sone ${entry.sone}.`,
        false
      );
    } else {
      settStatus(
        `Fant ${entry.tettsted} (lokalt, sone ${entry.sone}).`,
        true
      );
    }

    oppdaterFelter(entry, pris);

    visPåKart(map, {
      lat: entry.lat_decimal,
      lon: entry.lon_decimal,
      navn: entry.tettsted,
      fylke: entry.fylke,
      k_slagord: entry.k_slagord
    });

    if (
      typeof entry.lat_decimal === "number" &&
      typeof entry.lon_decimal === "number"
    ) {
      hentNowcast(entry.lat_decimal, entry.lon_decimal);
    }

    return;
  }

  // ----------------------------------------------------
  // 2) Ikke funnet lokalt → prøv Kartverket (SSR)
  // ----------------------------------------------------
  console.log("Fant ikke i lokal liste, prøver Kartverket (SSR) for:", sok);

  const ssr = await hentStedFraSSR(sok);
  console.log("Resultat fra SSR:", ssr);

  if (!ssr) {
    settStatus(
      `Fant verken lokalt tettsted eller stedsnavn i Kartverket for "${input}".`,
      false
    );
    oppdaterFelter(null, null);
    return;
  }

  console.log("Fant stedsnavn via Kartverket:", ssr);

  // ----------------------------------------------------
  // Finn sone via kommune-nummer
  // ----------------------------------------------------
  let sone = null;
  if (ssr.k_nr && kommuneTilSone[ssr.k_nr]) {
    sone = kommuneTilSone[ssr.k_nr];
  }

  let pris = null;
  if (sone) {
    pris = await hentSpotpris(sone);
  }

  // ----------------------------------------------------
  // Koordinater + fallback
  // ----------------------------------------------------
  let lat = ssr.lat;
  let lon = ssr.lon;
  let fallbackBrukt = false;

  if (typeof lat !== "number" || typeof lon !== "number") {
    const fallback = finnFallbackKoordinaterForKommune(ssr.k_nr);
    if (fallback) {
      lat = fallback.lat_decimal;
      lon = fallback.lon_decimal;
      fallbackBrukt = true;
      console.log("Bruker kommune-fallback for koordinater:", fallback);
    }
  }

  console.log("Koordinater fra SSR:", lat, lon);
  console.log("Fallback brukt:", fallbackBrukt);

  // ----------------------------------------------------
  // Status-tekst
  // ----------------------------------------------------
  if (!sone && !fallbackBrukt) {
    settStatus(
      `Fant "${ssr.navn}" via Kartverket (kommune ${ssr.kommune || "ukjent"}), men mangler prisområde og koordinater.`,
      false
    );
  } else if (!sone && fallbackBrukt) {
    settStatus(
      `Fant "${ssr.navn}" via Kartverket – bruker kommunesenter ${ssr.kommune || ""}, men mangler prisområde.`,
      false
    );
  } else if (sone && !fallbackBrukt) {
    settStatus(
      `Fant "${ssr.navn}" via Kartverket (kommune ${ssr.kommune || ""}, sone ${sone}).`,
      true
    );
  } else if (sone && fallbackBrukt) {
    settStatus(
      `Fant "${ssr.navn}" via Kartverket – bruker kommunesenter ${ssr.kommune || ""} (sone ${sone}).`,
      true
    );
  }

  // ----------------------------------------------------
  // Oppdater infoboks
  // ----------------------------------------------------
  const entryFraSSR = {
    tettsted: ssr.navn,
    k_nr: ssr.k_nr || "",
    fylke: ssr.fylke || "",
    sone: sone || "–"
  };

  oppdaterFelter(entryFraSSR, pris);

  // ----------------------------------------------------
  // Vis på kart + vær
  // ----------------------------------------------------
  if (typeof lat === "number" && typeof lon === "number") {
    visPåKart(map, {
      lat,
      lon,
      navn: ssr.navn,
      fylke: ssr.fylke,
      k_slagord: ""
    });

    hentNowcast(lat, lon);
  }
};