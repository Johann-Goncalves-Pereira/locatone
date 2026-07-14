"use strict";

/**
 * Offline lat/lng → IANA timezone + best-effort locale.
 * Uses geographic bounding regions (nearest-zone fallback via longitude).
 */
const LocatoneTZ = (() => {
  // [timezone, locale, label, minLat, maxLat, minLng, maxLng]
  const ZONES = [
    ["Europe/Tallinn", "et-EE", "Tallinn", 57.5, 59.8, 21.5, 28.5],
    ["Europe/Helsinki", "fi-FI", "Helsinki", 59.5, 70.1, 20.5, 31.6],
    ["Europe/Riga", "lv-LV", "Riga", 55.6, 58.1, 20.9, 28.3],
    ["Europe/Vilnius", "lt-LT", "Vilnius", 53.8, 56.5, 20.9, 26.9],
    ["Europe/Stockholm", "sv-SE", "Stockholm", 55.2, 69.1, 10.9, 24.2],
    ["Europe/Oslo", "nb-NO", "Oslo", 57.9, 71.2, 4.5, 31.1],
    ["Europe/Copenhagen", "da-DK", "Copenhagen", 54.5, 57.8, 8.0, 15.2],
    ["Europe/Berlin", "de-DE", "Berlin", 47.2, 55.1, 5.8, 15.1],
    ["Europe/Paris", "fr-FR", "Paris", 41.3, 51.1, -5.2, 9.6],
    ["Europe/London", "en-GB", "London", 49.8, 60.9, -8.7, 1.8],
    ["Europe/Dublin", "en-IE", "Dublin", 51.4, 55.5, -10.5, -5.9],
    ["Europe/Amsterdam", "nl-NL", "Amsterdam", 50.7, 53.6, 3.3, 7.3],
    ["Europe/Brussels", "nl-BE", "Brussels", 49.4, 51.6, 2.5, 6.5],
    ["Europe/Madrid", "es-ES", "Madrid", 35.9, 43.8, -9.4, 4.4],
    ["Europe/Lisbon", "pt-PT", "Lisbon", 36.9, 42.2, -9.6, -6.1],
    ["Europe/Rome", "it-IT", "Rome", 36.6, 47.1, 6.6, 18.6],
    ["Europe/Zurich", "de-CH", "Zurich", 45.8, 47.9, 5.9, 10.5],
    ["Europe/Vienna", "de-AT", "Vienna", 46.3, 49.1, 9.5, 17.2],
    ["Europe/Prague", "cs-CZ", "Prague", 48.5, 51.1, 12.0, 18.9],
    ["Europe/Warsaw", "pl-PL", "Warsaw", 49.0, 54.9, 14.1, 24.2],
    ["Europe/Budapest", "hu-HU", "Budapest", 45.7, 48.6, 16.1, 22.9],
    ["Europe/Bucharest", "ro-RO", "Bucharest", 43.6, 48.3, 20.2, 29.8],
    ["Europe/Sofia", "bg-BG", "Sofia", 41.2, 44.3, 22.3, 28.7],
    ["Europe/Athens", "el-GR", "Athens", 34.8, 41.8, 19.3, 29.7],
    ["Europe/Istanbul", "tr-TR", "Istanbul", 35.8, 42.2, 25.6, 45.0],
    ["Europe/Moscow", "ru-RU", "Moscow", 54.0, 62.0, 30.0, 45.0],
    ["Europe/Kyiv", "uk-UA", "Kyiv", 44.3, 52.4, 22.1, 40.3],
    ["Atlantic/Reykjavik", "is-IS", "Reykjavik", 63.2, 66.6, -24.6, -13.4],
    ["America/New_York", "en-US", "New York", 36.5, 47.5, -80.0, -66.9],
    ["America/Chicago", "en-US", "Chicago", 25.8, 49.4, -104.0, -85.0],
    ["America/Denver", "en-US", "Denver", 31.3, 49.0, -114.1, -102.0],
    ["America/Los_Angeles", "en-US", "Los Angeles", 32.5, 49.0, -124.5, -114.0],
    ["America/Toronto", "en-CA", "Toronto", 41.6, 56.9, -95.2, -74.3],
    ["America/Vancouver", "en-CA", "Vancouver", 48.0, 60.0, -139.1, -114.0],
    ["America/Mexico_City", "es-MX", "Mexico City", 14.5, 32.8, -118.5, -86.7],
    ["America/Sao_Paulo", "pt-BR", "São Paulo", -33.8, -7.2, -53.2, -34.7],
    ["America/Buenos_Aires", "es-AR", "Buenos Aires", -55.1, -21.7, -73.6, -53.5],
    ["America/Santiago", "es-CL", "Santiago", -56.0, -17.5, -75.7, -66.3],
    ["America/Bogota", "es-CO", "Bogotá", -4.3, 13.5, -79.1, -66.8],
    ["America/Lima", "es-PE", "Lima", -18.4, -0.0, -81.4, -68.6],
    ["Pacific/Honolulu", "en-US", "Honolulu", 18.9, 22.3, -160.3, -154.7],
    ["Asia/Tokyo", "ja-JP", "Tokyo", 24.0, 45.6, 122.9, 145.9],
    ["Asia/Seoul", "ko-KR", "Seoul", 33.1, 38.7, 124.5, 132.0],
    ["Asia/Shanghai", "zh-CN", "Shanghai", 18.1, 53.6, 73.5, 135.1],
    ["Asia/Hong_Kong", "zh-HK", "Hong Kong", 22.1, 22.6, 113.8, 114.5],
    ["Asia/Singapore", "en-SG", "Singapore", 1.1, 1.5, 103.6, 104.1],
    ["Asia/Bangkok", "th-TH", "Bangkok", 5.6, 20.5, 97.3, 105.7],
    ["Asia/Jakarta", "id-ID", "Jakarta", -11.1, 6.1, 95.0, 141.1],
    ["Asia/Manila", "en-PH", "Manila", 4.5, 21.2, 116.9, 126.7],
    ["Asia/Kolkata", "en-IN", "Kolkata", 6.6, 35.6, 68.1, 97.5],
    ["Asia/Dubai", "ar-AE", "Dubai", 22.6, 26.1, 51.5, 56.5],
    ["Asia/Riyadh", "ar-SA", "Riyadh", 16.3, 32.2, 34.5, 55.7],
    ["Asia/Tehran", "fa-IR", "Tehran", 25.0, 39.8, 44.0, 63.4],
    ["Asia/Jerusalem", "he-IL", "Jerusalem", 29.4, 33.4, 34.2, 35.9],
    ["Australia/Sydney", "en-AU", "Sydney", -37.6, -28.1, 140.9, 153.7],
    ["Australia/Melbourne", "en-AU", "Melbourne", -39.2, -33.9, 140.9, 150.0],
    ["Australia/Perth", "en-AU", "Perth", -35.2, -13.6, 112.9, 129.1],
    ["Pacific/Auckland", "en-NZ", "Auckland", -47.4, -34.3, 166.4, 178.7],
    ["Africa/Cairo", "ar-EG", "Cairo", 22.0, 31.7, 24.6, 37.0],
    ["Africa/Johannesburg", "en-ZA", "Johannesburg", -35.0, -22.1, 16.4, 33.0],
    ["Africa/Lagos", "en-NG", "Lagos", 4.2, 13.9, 2.6, 14.7],
    ["Africa/Nairobi", "en-KE", "Nairobi", -4.8, 5.1, 33.9, 42.0],
    ["Africa/Casablanca", "ar-MA", "Casablanca", 27.6, 35.9, -13.3, -0.9],
  ];

  // Approximate fixed offsets (minutes west of UTC, like getTimezoneOffset) for fallback
  // when no zone box matches — used only for Date offset spoofing via Intl when possible.
  const OFFSET_FALLBACKS = [
    { timezone: "Pacific/Midway", locale: "en-US", label: "Midway", maxLng: -165 },
    { timezone: "Pacific/Honolulu", locale: "en-US", label: "Hawaii", maxLng: -150 },
    { timezone: "America/Anchorage", locale: "en-US", label: "Alaska", maxLng: -135 },
    { timezone: "America/Los_Angeles", locale: "en-US", label: "Pacific", maxLng: -120 },
    { timezone: "America/Denver", locale: "en-US", label: "Mountain", maxLng: -105 },
    { timezone: "America/Chicago", locale: "en-US", label: "Central", maxLng: -90 },
    { timezone: "America/New_York", locale: "en-US", label: "Eastern", maxLng: -75 },
    { timezone: "America/Halifax", locale: "en-CA", label: "Atlantic", maxLng: -52.5 },
    { timezone: "America/Sao_Paulo", locale: "pt-BR", label: "Brasília", maxLng: -37.5 },
    { timezone: "Atlantic/Azores", locale: "pt-PT", label: "Azores", maxLng: -22.5 },
    { timezone: "UTC", locale: "en-US", label: "UTC", maxLng: -7.5 },
    { timezone: "Europe/London", locale: "en-GB", label: "London", maxLng: 7.5 },
    { timezone: "Europe/Berlin", locale: "de-DE", label: "Central Europe", maxLng: 22.5 },
    { timezone: "Europe/Helsinki", locale: "fi-FI", label: "Eastern Europe", maxLng: 37.5 },
    { timezone: "Europe/Moscow", locale: "ru-RU", label: "Moscow", maxLng: 52.5 },
    { timezone: "Asia/Dubai", locale: "ar-AE", label: "Gulf", maxLng: 67.5 },
    { timezone: "Asia/Kolkata", locale: "en-IN", label: "India", maxLng: 82.5 },
    { timezone: "Asia/Bangkok", locale: "th-TH", label: "Indochina", maxLng: 97.5 },
    { timezone: "Asia/Shanghai", locale: "zh-CN", label: "China", maxLng: 112.5 },
    { timezone: "Asia/Tokyo", locale: "ja-JP", label: "Japan", maxLng: 127.5 },
    { timezone: "Australia/Sydney", locale: "en-AU", label: "Sydney", maxLng: 142.5 },
    { timezone: "Pacific/Auckland", locale: "en-NZ", label: "New Zealand", maxLng: 180 },
  ];

  function contains(z, lat, lng) {
    return lat >= z[3] && lat <= z[4] && lng >= z[5] && lng <= z[6];
  }

  function centerDist(z, lat, lng) {
    const clat = (z[3] + z[4]) / 2;
    const clng = (z[5] + z[6]) / 2;
    const dlat = lat - clat;
    const dlng = (lng - clng) * Math.cos((lat * Math.PI) / 180);
    return dlat * dlat + dlng * dlng;
  }

  /**
   * @param {number} lat
   * @param {number} lng
   * @returns {{ timezone: string, locale: string, label: string }}
   */
  function fromCoords(lat, lng) {
    const hits = ZONES.filter((z) => contains(z, lat, lng));
    if (hits.length === 1) {
      return { timezone: hits[0][0], locale: hits[0][1], label: hits[0][2] };
    }
    if (hits.length > 1) {
      hits.sort((a, b) => centerDist(a, lat, lng) - centerDist(b, lat, lng));
      return { timezone: hits[0][0], locale: hits[0][1], label: hits[0][2] };
    }

    // Nearest zone center within ~15°
    let best = null;
    let bestD = Infinity;
    for (const z of ZONES) {
      const d = centerDist(z, lat, lng);
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    if (best && bestD < 15 * 15) {
      return { timezone: best[0], locale: best[1], label: best[2] };
    }

    for (const f of OFFSET_FALLBACKS) {
      if (lng <= f.maxLng) {
        return { timezone: f.timezone, locale: f.locale, label: f.label };
      }
    }
    return { timezone: "UTC", locale: "en-US", label: "UTC" };
  }

  /**
   * Parse IANA short/long offset label → minutes east of UTC (web probe convention).
   */
  function parseGmtOffsetMinutesEast(label) {
    if (!label || typeof label !== "string") return null;
    if (label === "GMT" || label === "UTC") return 0;
    const match = /(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?/.exec(label);
    if (!match) return null;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 60 + mins);
  }

  /**
   * Minutes to add to local time to get UTC (same sign as Date#getTimezoneOffset).
   * Prefers shortOffset so it matches ./web tz_offset_conflict expectations.
   */
  function getTimezoneOffsetMinutes(timezone, date = new Date()) {
    try {
      for (const timeZoneName of ["shortOffset", "longOffset"]) {
        const dtf = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          timeZoneName,
        });
        const parts = dtf.formatToParts(date);
        const tzName = parts.find((p) => p.type === "timeZoneName");
        if (!tzName) continue;
        const east = parseGmtOffsetMinutesEast(tzName.value);
        if (east !== null) {
          // getTimezoneOffset: west of UTC is positive
          return -east;
        }
      }
    } catch {
      /* fall through */
    }

    // Fallback: format both UTC and zone local components
    try {
      const fmt = (tz) =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).formatToParts(date);

      const toMap = (parts) => {
        const o = {};
        for (const p of parts) o[p.type] = p.value;
        return o;
      };
      const u = toMap(fmt("UTC"));
      const z = toMap(fmt(timezone));
      const asUtc = Date.UTC(
        +u.year,
        +u.month - 1,
        +u.day,
        +(u.hour === "24" ? 0 : u.hour),
        +u.minute,
        +u.second
      );
      const asZ = Date.UTC(
        +z.year,
        +z.month - 1,
        +z.day,
        +(z.hour === "24" ? 0 : z.hour),
        +z.minute,
        +z.second
      );
      return Math.round((asUtc - asZ) / 60000);
    } catch {
      return 0;
    }
  }

  /** Country / city hints for IP mock payloads */
  function geoHints(timezone, locale, label) {
    const country = (locale.split("-")[1] || "US").toUpperCase();
    const countryNames = {
      EE: "Estonia",
      FI: "Finland",
      LV: "Latvia",
      LT: "Lithuania",
      SE: "Sweden",
      NO: "Norway",
      DK: "Denmark",
      DE: "Germany",
      FR: "France",
      GB: "United Kingdom",
      IE: "Ireland",
      NL: "Netherlands",
      BE: "Belgium",
      ES: "Spain",
      PT: "Portugal",
      IT: "Italy",
      CH: "Switzerland",
      AT: "Austria",
      CZ: "Czechia",
      PL: "Poland",
      HU: "Hungary",
      RO: "Romania",
      BG: "Bulgaria",
      GR: "Greece",
      TR: "Turkey",
      RU: "Russia",
      UA: "Ukraine",
      IS: "Iceland",
      US: "United States",
      CA: "Canada",
      MX: "Mexico",
      BR: "Brazil",
      AR: "Argentina",
      CL: "Chile",
      CO: "Colombia",
      PE: "Peru",
      JP: "Japan",
      KR: "South Korea",
      CN: "China",
      HK: "Hong Kong",
      SG: "Singapore",
      TH: "Thailand",
      ID: "Indonesia",
      PH: "Philippines",
      IN: "India",
      AE: "United Arab Emirates",
      SA: "Saudi Arabia",
      IR: "Iran",
      IL: "Israel",
      AU: "Australia",
      NZ: "New Zealand",
      EG: "Egypt",
      ZA: "South Africa",
      NG: "Nigeria",
      KE: "Kenya",
      MA: "Morocco",
    };
    return {
      city: label || timezone.split("/").pop().replace(/_/g, " "),
      region: label || "",
      country,
      countryName: countryNames[country] || country,
      timezone,
      locale,
    };
  }

  return {
    fromCoords,
    getTimezoneOffsetMinutes,
    parseGmtOffsetMinutesEast,
    geoHints,
    ZONES,
  };
})();

if (typeof window !== "undefined") {
  window.LocatoneTZ = LocatoneTZ;
}
