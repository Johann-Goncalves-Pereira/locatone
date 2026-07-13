/* global LocatoneTZ */
"use strict";

/**
 * Parse decimal, DMS, or Google Maps URL location strings into { lat, lng }.
 * Background/popup share this via classic script globals.
 */
const LocatoneParse = (() => {
  function clampLat(n) {
    return Math.max(-90, Math.min(90, n));
  }
  function clampLng(n) {
    let x = n;
    while (x > 180) x -= 360;
    while (x < -180) x += 360;
    return x;
  }

  function dmsToDecimal(deg, min, sec, hemi) {
    let val = Math.abs(deg) + min / 60 + sec / 3600;
    const h = (hemi || "").toUpperCase();
    if (h === "S" || h === "W") val = -val;
    else if (deg < 0) val = -val;
    return val;
  }

  /**
   * @param {string} input
   * @returns {{ lat: number, lng: number } | null}
   */
  function parseDecimal(input) {
    const s = input.trim();
    // 59.456619, 24.697315  |  59.456619 24.697315  |  lat=.. lng=..
    let m = s.match(
      /(?:lat(?:itude)?\s*[:=]\s*)?([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*(?:lng|lon(?:gitude)?\s*[:=]\s*)?([+-]?\d+(?:\.\d+)?)/i
    );
    if (!m) return null;
    const lat = clampLat(parseFloat(m[1]));
    const lng = clampLng(parseFloat(m[2]));
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(parseFloat(m[2])) > 180) return null;
    return { lat, lng };
  }

  /**
   * @param {string} input
   * @returns {{ lat: number, lng: number } | null}
   */
  function parseDms(input) {
    const s = input
      .trim()
      .replace(/\u00B0/g, "°")
      .replace(/[′ʹ]/g, "'")
      .replace(/[″ʺ"]/g, '"')
      .replace(/\bdeg\b/gi, "°");

    // 59°27'23.8"N 24°41'50.2"E
    const re =
      /(\d{1,3})\s*°\s*(\d{1,2})\s*['']\s*(\d{1,2}(?:\.\d+)?)\s*["']?\s*([NS])\s*[,;\s]+(\d{1,3})\s*°\s*(\d{1,2})\s*['']\s*(\d{1,2}(?:\.\d+)?)\s*["']?\s*([EW])/i;
    const m = s.match(re);
    if (!m) return null;

    const lat = clampLat(
      dmsToDecimal(+m[1], +m[2], +m[3], m[4])
    );
    const lng = clampLng(
      dmsToDecimal(+m[5], +m[6], +m[7], m[8])
    );
    return { lat, lng };
  }

  /**
   * Extract coords from a (possibly already expanded) Google Maps URL.
   * @param {string} url
   * @returns {{ lat: number, lng: number } | null}
   */
  function parseMapsUrl(url) {
    let u;
    try {
      u = new URL(url.trim());
    } catch {
      return null;
    }

    const href = u.href;
    const path = decodeURIComponent(u.pathname + u.search + u.hash);

    // Prefer place pin (!3dlat!4dlng) over camera center (@lat,lng)
    const patterns = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      /!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/, // lng then lat
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /[?&](?:q|ll|center|destination|query)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i,
      /\/search\/(-?\d+\.\d+)\s*,\s*\+?(-?\d+\.\d+)/,
      /\/place\/[^/]+\/(-?\d+\.\d+),(-?\d+\.\d+)/,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const m = href.match(patterns[i]) || path.match(patterns[i]);
      if (!m) continue;
      let lat = parseFloat(m[1]);
      let lng = parseFloat(m[2]);
      // pattern index 1 is !2d(lng)!3d(lat)
      if (i === 1) {
        lng = parseFloat(m[1]);
        lat = parseFloat(m[2]);
      }
      if (
        !Number.isNaN(lat) &&
        !Number.isNaN(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
      ) {
        return { lat: clampLat(lat), lng: clampLng(lng) };
      }
    }
    return null;
  }

  function isUrl(input) {
    const s = input.trim();
    return /^https?:\/\//i.test(s) || /^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|www\.google\.[^/]+\/maps)/i.test(s);
  }

  function normalizeUrl(input) {
    const s = input.trim();
    if (/^https?:\/\//i.test(s)) return s;
    return "https://" + s;
  }

  /**
   * Sync parse (no network). For short links, returns { needsResolve: true, url }.
   * @param {string} input
   * @returns {{ lat: number, lng: number } | { needsResolve: true, url: string } | { error: string }}
   */
  function parse(input) {
    if (!input || !String(input).trim()) {
      return { error: "Enter a location" };
    }
    const raw = String(input).trim();

    const dms = parseDms(raw);
    if (dms) return dms;

    if (isUrl(raw) || /goo\.gl|maps\.app|google\.[^/]+\/maps/i.test(raw)) {
      const url = normalizeUrl(raw);
      const fromUrl = parseMapsUrl(url);
      if (fromUrl) return fromUrl;
      // Short links need background redirect resolve
      if (/maps\.app\.goo\.gl|goo\.gl\//i.test(url)) {
        return { needsResolve: true, url };
      }
      return { error: "Could not find coordinates in that Maps URL" };
    }

    const dec = parseDecimal(raw);
    if (dec) return dec;

    return {
      error:
        'Unrecognized format. Try 59.456619, 24.697315 or 59°27\'23.8"N 24°41\'50.2"E or a Google Maps link.',
    };
  }

  /**
   * Build full config fields from lat/lng.
   */
  function enrich(lat, lng, extras = {}) {
    const tz =
      typeof LocatoneTZ !== "undefined"
        ? LocatoneTZ.fromCoords(lat, lng)
        : { timezone: "UTC", locale: "en-US", label: "UTC" };
    return {
      lat,
      lng,
      accuracy: extras.accuracy != null ? extras.accuracy : 10,
      timezone: tz.timezone,
      locale: tz.locale,
      label: tz.label,
      ...extras,
    };
  }

  return {
    parse,
    parseDecimal,
    parseDms,
    parseMapsUrl,
    normalizeUrl,
    isUrl,
    enrich,
  };
})();

if (typeof window !== "undefined") {
  window.LocatoneParse = LocatoneParse;
}
