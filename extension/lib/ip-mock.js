/* global LocatoneTZ */
"use strict";

/**
 * Fake response bodies for common client-side IP geolocation APIs
 * and Cloudflare /cdn-cgi/trace.
 */
const LocatoneIpMock = (() => {
  const HOST_PATTERNS = [
    { host: /ipinfo\.io$/i, kind: "ipinfo" },
    { host: /ipapi\.co$/i, kind: "ipapi" },
    { host: /ip-api\.com$/i, kind: "ipapi_com" },
    { host: /geojs\.io$/i, kind: "geojs" },
    { host: /freeipapi\.com$/i, kind: "freeipapi" },
    { host: /ipwho\.is$/i, kind: "ipwhois" },
    { host: /ipwhois\.app$/i, kind: "ipwhois" },
    { host: /reallyfreegeoip\.org$/i, kind: "freegeoip" },
    { host: /freegeoip\.app$/i, kind: "freegeoip" },
    { host: /geolocation-db\.com$/i, kind: "geolocationdb" },
    { host: /api\.db-ip\.com$/i, kind: "dbip" },
    { host: /ipgeolocation\.io$/i, kind: "ipgeolocation" },
  ];

  /** Plausible Cloudflare colo codes by ISO country. */
  const COLO_BY_COUNTRY = {
    EE: "TLL",
    FI: "HEL",
    LV: "RIX",
    LT: "VNO",
    SE: "ARN",
    NO: "OSL",
    DK: "CPH",
    DE: "FRA",
    FR: "CDG",
    GB: "LHR",
    IE: "DUB",
    NL: "AMS",
    BE: "BRU",
    ES: "MAD",
    PT: "LIS",
    IT: "MXP",
    CH: "ZRH",
    AT: "VIE",
    PL: "WAW",
    US: "SJC",
    CA: "YYZ",
    BR: "GRU",
    AR: "EZE",
    JP: "NRT",
    KR: "ICN",
    CN: "HKG",
    AU: "SYD",
    NZ: "AKL",
    IN: "BOM",
    SG: "SIN",
    AE: "DXB",
    ZA: "JNB",
  };

  function matchKind(url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    if (
      /(?:^|\.)cloudflare\.com$/i.test(u.hostname) &&
      /\/cdn-cgi\/trace\/?$/i.test(u.pathname)
    ) {
      return { kind: "cloudflare_trace", url: u, contentType: "text/plain" };
    }
    for (const p of HOST_PATTERNS) {
      if (p.host.test(u.hostname)) {
        return { kind: p.kind, url: u, contentType: "application/json" };
      }
    }
    return null;
  }

  function fakeIp() {
    return "203.0.113.42";
  }

  function hintsFromConfig(cfg) {
    const h =
      typeof LocatoneTZ !== "undefined"
        ? LocatoneTZ.geoHints(cfg.timezone, cfg.locale, cfg.label)
        : {
            city: "Unknown",
            region: "",
            country: "US",
            countryName: "United States",
            timezone: cfg.timezone || "UTC",
            locale: cfg.locale || "en-US",
          };
    return {
      ...h,
      lat: cfg.lat,
      lng: cfg.lng,
      ip: fakeIp(),
    };
  }

  function cloudflareTraceBody(cfg) {
    const h = hintsFromConfig(cfg);
    const colo = COLO_BY_COUNTRY[h.country] || "SJC";
    const lines = [
      "fl=locatone1",
      "h=www.cloudflare.com",
      "ip=" + h.ip,
      "ts=" + (Date.now() / 1000).toFixed(3),
      "visit_scheme=https",
      "uag=Mozilla/5.0",
      "colo=" + colo,
      "sliver=none",
      "http=http/2",
      "loc=" + h.country,
      "tls=TLSv1.3",
      "sni=plaintext",
      "warp=off",
      "gateway=off",
      "rbi=off",
      "kex=X25519",
    ];
    return lines.join("\n") + "\n";
  }

  function bodyFor(kind, cfg) {
    if (kind === "cloudflare_trace") {
      return cloudflareTraceBody(cfg);
    }

    const h = hintsFromConfig(cfg);
    switch (kind) {
      case "ipinfo":
        return JSON.stringify({
          ip: h.ip,
          city: h.city,
          region: h.region,
          country: h.country,
          loc: `${h.lat},${h.lng}`,
          org: "AS0000 Locatone Spoof",
          postal: "00000",
          timezone: h.timezone,
        });
      case "ipapi":
        return JSON.stringify({
          ip: h.ip,
          city: h.city,
          region: h.region,
          region_code: h.country,
          country: h.countryName,
          country_code: h.country,
          country_code_iso3: h.country,
          continent_code: "EU",
          latitude: h.lat,
          longitude: h.lng,
          timezone: h.timezone,
          utc_offset: "+0000",
          currency: "EUR",
          languages: h.locale,
          asn: "AS0000",
          org: "Locatone Spoof",
        });
      case "ipapi_com":
        return JSON.stringify({
          status: "success",
          country: h.countryName,
          countryCode: h.country,
          region: h.region,
          regionName: h.region,
          city: h.city,
          zip: "00000",
          lat: h.lat,
          lon: h.lng,
          timezone: h.timezone,
          isp: "Locatone Spoof",
          org: "Locatone Spoof",
          as: "AS0000 Locatone",
          query: h.ip,
        });
      case "geojs":
        return JSON.stringify({
          organization_name: "Locatone Spoof",
          region: h.region,
          accuracy: 10,
          asn: 0,
          organization: "AS0000 Locatone Spoof",
          timezone: h.timezone,
          longitude: String(h.lng),
          country_code3: h.country,
          area_code: "0",
          ip: h.ip,
          city: h.city,
          country: h.countryName,
          country_code: h.country,
          continent_code: "EU",
          latitude: String(h.lat),
        });
      case "freeipapi":
        return JSON.stringify({
          ipAddress: h.ip,
          continentCode: "EU",
          continentName: "Europe",
          countryCode: h.country,
          countryName: h.countryName,
          cityName: h.city,
          regionName: h.region,
          latitude: h.lat,
          longitude: h.lng,
          timeZones: [h.timezone],
          zipCode: "00000",
        });
      case "ipwhois":
        return JSON.stringify({
          success: true,
          ip: h.ip,
          type: "IPv4",
          continent: "Europe",
          continent_code: "EU",
          country: h.countryName,
          country_code: h.country,
          region: h.region,
          city: h.city,
          latitude: h.lat,
          longitude: h.lng,
          timezone: {
            id: h.timezone,
            utc: "+00:00",
          },
          connection: { isp: "Locatone Spoof" },
        });
      case "freegeoip":
        return JSON.stringify({
          ip: h.ip,
          country_code: h.country,
          country_name: h.countryName,
          region_code: "",
          region_name: h.region,
          city: h.city,
          zip_code: "00000",
          time_zone: h.timezone,
          latitude: h.lat,
          longitude: h.lng,
          metro_code: 0,
        });
      case "geolocationdb":
        return JSON.stringify({
          country_code: h.country,
          country_name: h.countryName,
          city: h.city,
          postal: "00000",
          latitude: h.lat,
          longitude: h.lng,
          IPv4: h.ip,
          state: h.region,
        });
      case "dbip":
        return JSON.stringify({
          ipAddress: h.ip,
          continentCode: "EU",
          continentName: "Europe",
          countryCode: h.country,
          countryName: h.countryName,
          stateProv: h.region,
          city: h.city,
        });
      case "ipgeolocation":
        return JSON.stringify({
          ip: h.ip,
          continent_code: "EU",
          continent_name: "Europe",
          country_code2: h.country,
          country_name: h.countryName,
          state_prov: h.region,
          city: h.city,
          latitude: String(h.lat),
          longitude: String(h.lng),
          time_zone: { name: h.timezone },
        });
      default:
        return JSON.stringify({
          ip: h.ip,
          city: h.city,
          country: h.country,
          lat: h.lat,
          lon: h.lng,
          timezone: h.timezone,
        });
    }
  }

  function contentTypeFor(kind) {
    if (kind === "cloudflare_trace") {
      return "text/plain; charset=utf-8";
    }
    return "application/json; charset=utf-8";
  }

  function sanitizeResponseHeaders(responseHeaders, kind) {
    const drop = new Set([
      "content-type",
      "content-length",
      "content-encoding",
      "transfer-encoding",
    ]);
    const headers = (responseHeaders || []).filter(
      (h) => !drop.has(h.name.toLowerCase())
    );
    headers.push({ name: "Content-Type", value: contentTypeFor(kind) });
    return headers;
  }

  function urlsForListener() {
    return [
      "*://ipinfo.io/*",
      "*://*.ipinfo.io/*",
      "*://ipapi.co/*",
      "*://*.ipapi.co/*",
      "*://ip-api.com/*",
      "*://*.ip-api.com/*",
      "*://get.geojs.io/*",
      "*://*.geojs.io/*",
      "*://freeipapi.com/*",
      "*://*.freeipapi.com/*",
      "*://ipwho.is/*",
      "*://*.ipwho.is/*",
      "*://ipwhois.app/*",
      "*://*.ipwhois.app/*",
      "*://reallyfreegeoip.org/*",
      "*://freegeoip.app/*",
      "*://geolocation-db.com/*",
      "*://*.geolocation-db.com/*",
      "*://api.db-ip.com/*",
      "*://api.ipgeolocation.io/*",
      "*://cloudflare.com/*",
      "*://*.cloudflare.com/*",
    ];
  }

  /** Landmark hosts used by ./web RTT lateration — redirect while spoofing. */
  function rttNeutralizeUrls() {
    return [
      "*://www.gov.br/*",
      "*://gov.br/*",
      "*://www.nasa.gov/*",
      "*://nasa.gov/*",
      "*://www.bund.de/*",
      "*://bund.de/*",
      "*://www.digital.go.jp/*",
      "*://digital.go.jp/*",
      "*://www.gov.uk/*",
      "*://gov.uk/*",
    ];
  }

  return {
    matchKind,
    bodyFor,
    contentTypeFor,
    sanitizeResponseHeaders,
    urlsForListener,
    rttNeutralizeUrls,
    hintsFromConfig,
  };
})();

if (typeof window !== "undefined") {
  window.LocatoneIpMock = LocatoneIpMock;
}
