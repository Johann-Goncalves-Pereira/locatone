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
    { host: /seeip\.org$/i, kind: "seeip" },
    { host: /geoiplookup\.io$/i, kind: "geoiplookup" },
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

  /** Plausible public IPv4 lookalikes by ISO country (not TEST-NET). */
  const FAKE_IP_BY_COUNTRY = {
    EE: "90.190.142.88",
    FI: "91.153.128.40",
    LV: "62.85.20.50",
    LT: "78.60.120.30",
    SE: "83.255.40.20",
    NO: "84.208.50.15",
    DK: "80.198.30.12",
    DE: "91.65.80.44",
    FR: "90.84.120.66",
    GB: "81.2.69.142",
    IE: "87.198.40.22",
    NL: "85.17.150.80",
    BE: "91.183.60.18",
    ES: "88.26.40.55",
    PT: "85.240.30.41",
    IT: "79.40.120.33",
    CH: "85.1.40.28",
    AT: "84.112.50.19",
    PL: "83.24.60.70",
    US: "72.14.201.10",
    CA: "99.224.50.30",
    BR: "187.45.112.40",
    AR: "190.210.40.22",
    JP: "126.40.50.60",
    KR: "211.234.40.20",
    CN: "123.125.40.18",
    AU: "110.142.40.25",
    IN: "117.205.40.33",
    SG: "116.87.40.22",
  };

  const EU_COUNTRIES = new Set([
    "EE",
    "FI",
    "LV",
    "LT",
    "SE",
    "NO",
    "DK",
    "DE",
    "FR",
    "GB",
    "IE",
    "NL",
    "BE",
    "ES",
    "PT",
    "IT",
    "CH",
    "AT",
    "PL",
    "CZ",
    "HU",
    "RO",
    "BG",
    "GR",
    "SK",
    "SI",
    "HR",
  ]);

  function fakeIp(country) {
    return FAKE_IP_BY_COUNTRY[country] || FAKE_IP_BY_COUNTRY.EE;
  }

  function utcOffsetString(timezone) {
    try {
      if (typeof LocatoneTZ !== "undefined" && LocatoneTZ.getTimezoneOffsetMinutes) {
        const west = LocatoneTZ.getTimezoneOffsetMinutes(timezone, new Date());
        const east = -west;
        const sign = east >= 0 ? "+" : "-";
        const abs = Math.abs(east);
        const h = String(Math.floor(abs / 60)).padStart(2, "0");
        const m = String(abs % 60).padStart(2, "0");
        return sign + h + m;
      }
    } catch {
      /* fall through */
    }
    return "+0000";
  }

  function continentFor(country) {
    if (EU_COUNTRIES.has(country)) {
      return { code: "EU", name: "Europe" };
    }
    if (["US", "CA", "MX"].includes(country)) {
      return { code: "NA", name: "North America" };
    }
    if (["BR", "AR", "CL", "CO", "PE"].includes(country)) {
      return { code: "SA", name: "South America" };
    }
    if (["JP", "KR", "CN", "HK", "SG", "TH", "ID", "PH", "IN", "AE", "SA", "IL"].includes(country)) {
      return { code: "AS", name: "Asia" };
    }
    if (["AU", "NZ"].includes(country)) {
      return { code: "OC", name: "Oceania" };
    }
    if (["EG", "ZA", "NG", "KE", "MA"].includes(country)) {
      return { code: "AF", name: "Africa" };
    }
    return { code: "EU", name: "Europe" };
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
    const continent = continentFor(h.country);
    const utcOffset = utcOffsetString(h.timezone);
    return {
      ...h,
      lat: cfg.lat,
      lng: cfg.lng,
      ip: fakeIp(h.country),
      continentCode: continent.code,
      continentName: continent.name,
      utcOffset,
      utcOffsetColon:
        utcOffset.slice(0, 3) + ":" + utcOffset.slice(3),
      asn: "AS3249",
      org: h.country === "EE" ? "Telia Eesti AS" : "Locatone Transit",
      isp: h.country === "EE" ? "Telia Eesti" : "Locatone Transit",
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
          org: h.asn + " " + h.org,
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
          continent_code: h.continentCode,
          latitude: h.lat,
          longitude: h.lng,
          timezone: h.timezone,
          utc_offset: h.utcOffset,
          currency: h.country === "BR" ? "BRL" : "EUR",
          languages: h.locale,
          asn: h.asn,
          org: h.org,
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
          isp: h.isp,
          org: h.org,
          as: h.asn + " " + h.org,
          query: h.ip,
        });
      case "geojs":
        return JSON.stringify({
          organization_name: h.org,
          region: h.region,
          accuracy: 10,
          asn: Number(String(h.asn).replace(/^AS/i, "")) || 3249,
          organization: h.asn + " " + h.org,
          timezone: h.timezone,
          longitude: String(h.lng),
          country_code3: h.country,
          area_code: "0",
          ip: h.ip,
          city: h.city,
          country: h.countryName,
          country_code: h.country,
          continent_code: h.continentCode,
          latitude: String(h.lat),
        });
      case "freeipapi":
        return JSON.stringify({
          ipAddress: h.ip,
          continentCode: h.continentCode,
          continentName: h.continentName,
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
          continent: h.continentName,
          continent_code: h.continentCode,
          country: h.countryName,
          country_code: h.country,
          region: h.region,
          city: h.city,
          latitude: h.lat,
          longitude: h.lng,
          timezone: {
            id: h.timezone,
            utc: h.utcOffsetColon,
          },
          connection: { isp: h.isp, org: h.org, asn: h.asn },
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
          continentCode: h.continentCode,
          continentName: h.continentName,
          countryCode: h.country,
          countryName: h.countryName,
          stateProv: h.region,
          city: h.city,
        });
      case "ipgeolocation":
        return JSON.stringify({
          ip: h.ip,
          continent_code: h.continentCode,
          continent_name: h.continentName,
          country_code2: h.country,
          country_name: h.countryName,
          state_prov: h.region,
          city: h.city,
          latitude: String(h.lat),
          longitude: String(h.lng),
          time_zone: { name: h.timezone, offset: h.utcOffsetColon },
        });
      case "seeip":
        return JSON.stringify({
          ip: h.ip,
          country: h.countryName,
          country_code: h.country,
          city: h.city,
          region: h.region,
          region_code: "",
          latitude: h.lat,
          longitude: h.lng,
          timezone: h.timezone,
          organization: h.org,
        });
      case "geoiplookup":
        return JSON.stringify({
          ip: h.ip,
          country_code: h.country,
          country_name: h.countryName,
          region: h.region,
          city: h.city,
          latitude: h.lat,
          longitude: h.lng,
          timezone_name: h.timezone,
          isp: h.isp,
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
      (h) => !drop.has(h.name.toLowerCase()),
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
      "*://api.seeip.org/*",
      "*://*.seeip.org/*",
      "*://json.geoiplookup.io/*",
      "*://*.geoiplookup.io/*",
      "*://cloudflare.com/*",
      "*://*.cloudflare.com/*",
    ];
  }

  /** Landmark hosts used by ./web RTT lateration — redirect while spoofing. */
  function rttNeutralizeUrls() {
    return [
      "*://www.gov.br/*",
      "*://gov.br/*",
      "*://www.bcb.gov.br/*",
      "*://bcb.gov.br/*",
      "*://www.serpro.gov.br/*",
      "*://serpro.gov.br/*",
      "*://www.camara.leg.br/*",
      "*://camara.leg.br/*",
      "*://www.nasa.gov/*",
      "*://nasa.gov/*",
      "*://www.bund.de/*",
      "*://bund.de/*",
      "*://www.digital.go.jp/*",
      "*://digital.go.jp/*",
      "*://www.gov.uk/*",
      "*://gov.uk/*",
      "*://www.riigiteataja.ee/*",
      "*://riigiteataja.ee/*",
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
