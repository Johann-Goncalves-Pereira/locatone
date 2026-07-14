/* global LocatoneParse, LocatoneTZ, LocatoneIpMock */
"use strict";

const DEFAULT_STATE = {
  enabled: false,
  lat: null,
  lng: null,
  accuracy: 10,
  timezone: "UTC",
  locale: "en-US",
  label: "",
  input: "",
  proxy: {
    mode: "none", // none | http | socks5
    host: "",
    port: "",
    username: "",
    password: "",
  },
};

let state = { ...DEFAULT_STATE, proxy: { ...DEFAULT_STATE.proxy } };

async function loadState() {
  const stored = await browser.storage.local.get("locatone");
  if (stored.locatone) {
    state = {
      ...DEFAULT_STATE,
      ...stored.locatone,
      proxy: { ...DEFAULT_STATE.proxy, ...(stored.locatone.proxy || {}) },
    };
  }
  await applyProxy();
  await applyWebRtcPrivacy();
}

async function saveState(partial) {
  state = {
    ...state,
    ...partial,
    proxy: { ...state.proxy, ...(partial.proxy || {}) },
  };
  await browser.storage.local.set({ locatone: state });
  await applyProxy();
  await applyWebRtcPrivacy();
  return state;
}

function proxyActive() {
  return (
    state.enabled &&
    state.proxy &&
    state.proxy.mode !== "none" &&
    state.proxy.host &&
    state.proxy.port
  );
}

async function applyProxy() {
  try {
    if (!browser.proxy || !browser.proxy.onRequest) return;

    if (browser.proxy.onRequest.hasListener(proxyHandler)) {
      browser.proxy.onRequest.removeListener(proxyHandler);
    }

    if (proxyActive()) {
      browser.proxy.onRequest.addListener(proxyHandler, {
        urls: ["<all_urls>"],
      });
    }
  } catch (err) {
    console.warn("Locatone proxy setup failed:", err);
  }
}

/**
 * Prefer privacy API for WebRTC IP handling — content-script constructor
 * wrapping is fragile because exportFunction cannot be used as `new`.
 * disable_non_proxied_udp blocks STUN srflx without a matching proxy.
 */
async function applyWebRtcPrivacy() {
  try {
    if (
      !browser.privacy ||
      !browser.privacy.network ||
      !browser.privacy.network.webRTCIPHandlingPolicy
    ) {
      return;
    }
    const api = browser.privacy.network.webRTCIPHandlingPolicy;
    if (state.enabled && state.lat != null) {
      await api.set({ value: "disable_non_proxied_udp" });
    } else {
      await api.clear({});
    }
  } catch (err) {
    console.warn("Locatone WebRTC privacy policy failed:", err);
  }
}

function proxyHandler(_details) {
  if (!proxyActive()) return { type: "direct" };

  const port = parseInt(String(state.proxy.port), 10);
  const info = {
    type: state.proxy.mode === "socks5" ? "socks" : "http",
    host: state.proxy.host.trim(),
    port: port,
    proxyDNS: state.proxy.mode === "socks5",
  };

  if (state.proxy.username) {
    info.username = state.proxy.username;
    info.password = state.proxy.password || "";
  }

  return info;
}

async function resolveMapsUrl(url) {
  // Follow redirects to capture a Google Maps URL that embeds coordinates
  let current = url;

  const tryParse = (candidate, html) => {
    if (candidate) {
      const fromUrl = LocatoneParse.parseMapsUrl(candidate);
      if (fromUrl) return fromUrl;
    }
    if (html) {
      const d = html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (d) return { lat: parseFloat(d[1]), lng: parseFloat(d[2]) };
      const at = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
      const ll = html.match(
        /[?&](?:q|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i,
      );
      if (ll) return { lat: parseFloat(ll[1]), lng: parseFloat(ll[2]) };
      const mapsHref = html.match(
        /https:\/\/(?:www\.)?google\.[^/"'\s]+\/maps[^"'\s]*/i,
      );
      if (mapsHref) {
        const fromHref = LocatoneParse.parseMapsUrl(
          mapsHref[0].replace(/&amp;/g, "&"),
        );
        if (fromHref) return fromHref;
      }
    }
    return null;
  };

  for (let i = 0; i < 8; i++) {
    const early = tryParse(current);
    if (early) return early;

    let resp;
    try {
      resp = await fetch(current, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
      });
    } catch (err) {
      throw new Error(
        "Network error resolving Maps link: " + (err.message || err),
      );
    }

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("Location");
      if (!loc) break;
      current = new URL(loc, current).href;
      continue;
    }

    // Fallback: let fetch follow redirects and inspect final URL + body
    let followed;
    try {
      followed = await fetch(current, {
        method: "GET",
        redirect: "follow",
        credentials: "omit",
      });
    } catch (err) {
      throw new Error(
        "Network error resolving Maps link: " + (err.message || err),
      );
    }

    current = followed.url || current;
    const text = await followed.text();
    const found = tryParse(current, text.slice(0, 200000));
    if (found) return found;

    const meta = text.match(/content=["']0;\s*url=["']?([^"'>\s]+)/i);
    if (meta) {
      current = new URL(meta[1], current).href;
      continue;
    }
    break;
  }

  const last = tryParse(current);
  if (last) return last;
  throw new Error("Could not resolve coordinates from Maps link");
}

async function resolveInput(input) {
  const result = LocatoneParse.parse(input);
  if (result.error) throw new Error(result.error);

  let coords;
  if (result.needsResolve) {
    coords = await resolveMapsUrl(result.url);
  } else {
    coords = { lat: result.lat, lng: result.lng };
  }

  const enriched = LocatoneParse.enrich(coords.lat, coords.lng, {
    accuracy: state.accuracy || 10,
    input,
  });
  return enriched;
}

// --- IP API / Cloudflare trace response rewriting ---
function onIpHeaders(details) {
  if (!state.enabled || state.lat == null) return {};

  const match = LocatoneIpMock.matchKind(details.url);
  if (!match) return {};

  const filter = browser.webRequest.filterResponseData(details.requestId);
  const encoder = new TextEncoder();

  // Discard real body (possibly gzipped); write uncompressed spoofed body.
  filter.ondata = () => {};
  filter.onstop = () => {
    try {
      const body = LocatoneIpMock.bodyFor(match.kind, state);
      filter.write(encoder.encode(body));
    } catch (e) {
      console.warn("Locatone IP mock write failed", e);
    }
    try {
      filter.close();
    } catch {
      /* already closed */
    }
  };
  filter.onerror = () => {
    try {
      filter.close();
    } catch {
      /* already closed */
    }
  };

  return {
    responseHeaders: LocatoneIpMock.sanitizeResponseHeaders(
      details.responseHeaders,
      match.kind,
    ),
  };
}

/**
 * Neutralize RTT landmarks without hard-cancel or data: CORS traps.
 * Redirect to an extension-packaged empty file so fetch settles quickly
 * without measuring real geo latency (may still CORS-fail → undefined RTT).
 */
function onRttLandmark(details) {
  if (!state.enabled || state.lat == null) return {};
  try {
    return { redirectUrl: browser.runtime.getURL("lib/empty.txt") };
  } catch (e) {
    console.warn("Locatone RTT redirect failed", e);
    return {};
  }
}

function setupIpRewrite() {
  const urls = LocatoneIpMock.urlsForListener();
  if (browser.webRequest.onHeadersReceived.hasListener(onIpHeaders)) {
    browser.webRequest.onHeadersReceived.removeListener(onIpHeaders);
  }
  browser.webRequest.onHeadersReceived.addListener(onIpHeaders, { urls }, [
    "blocking",
    "responseHeaders",
  ]);
}

function setupRttNeutralize() {
  const urls = LocatoneIpMock.rttNeutralizeUrls();
  if (browser.webRequest.onBeforeRequest.hasListener(onRttLandmark)) {
    browser.webRequest.onBeforeRequest.removeListener(onRttLandmark);
  }
  browser.webRequest.onBeforeRequest.addListener(onRttLandmark, { urls }, [
    "blocking",
  ]);
}

/** Build Accept-Language from spoofed locale (e.g. et-EE → et-EE,et;q=0.9,…). */
function acceptLanguageFromLocale(locale) {
  const loc = String(locale || "en-US").replace(/_/g, "-");
  const base = loc.split("-")[0] || "en";
  if (base.toLowerCase() === "en" && loc.toLowerCase().startsWith("en")) {
    return `${loc},en;q=0.9`;
  }
  return `${loc},${base};q=0.9,en-US;q=0.8,en;q=0.7`;
}

function onAcceptLanguageHeaders(details) {
  if (!state.enabled || !state.locale) return {};
  const headers = details.requestHeaders || [];
  const next = headers.filter(
    (h) => String(h.name).toLowerCase() !== "accept-language"
  );
  next.push({
    name: "Accept-Language",
    value: acceptLanguageFromLocale(state.locale),
  });
  return { requestHeaders: next };
}

function setupAcceptLanguageRewrite() {
  if (browser.webRequest.onBeforeSendHeaders.hasListener(onAcceptLanguageHeaders)) {
    browser.webRequest.onBeforeSendHeaders.removeListener(
      onAcceptLanguageHeaders
    );
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    onAcceptLanguageHeaders,
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
  );
}

/**
 * Pending Service Worker script URLs to prepend with Intl/locale prelude.
 * Content script marks URLs on register(); also always covers Locatone probe.
 */
const swRewriteUntil = new Map();

function markServiceWorkerScript(url) {
  if (!url) return;
  swRewriteUntil.set(String(url), Date.now() + 30_000);
}

function shouldRewriteServiceWorker(url) {
  const u = String(url || "");
  if (u.includes("locatone-sw-intl-probe")) return true;
  const until = swRewriteUntil.get(u);
  if (until == null) return false;
  if (Date.now() > until) {
    swRewriteUntil.delete(u);
    return false;
  }
  return true;
}

function serviceWorkerPrelude() {
  const tz = JSON.stringify(state.timezone || "UTC");
  const locale = JSON.stringify(state.locale || "en-US");
  let offset = 0;
  try {
    if (typeof LocatoneTZ !== "undefined" && LocatoneTZ.getTimezoneOffsetMinutes) {
      offset = LocatoneTZ.getTimezoneOffsetMinutes(
        state.timezone || "UTC",
        new Date()
      );
    }
  } catch {
    offset = 0;
  }
  return (
    "(function(){try{" +
    "var TZ=" +
    tz +
    ",LOCALE=" +
    locale +
    ",OFFSET=" +
    offset +
    ";" +
    "try{var o=Intl.DateTimeFormat.prototype.resolvedOptions;" +
    "Intl.DateTimeFormat.prototype.resolvedOptions=function(){" +
    "var r=o.call(this);try{r.timeZone=TZ;r.locale=LOCALE;}catch(e){}" +
    "return r;};}catch(e){}" +
    "try{Date.prototype.getTimezoneOffset=function(){return OFFSET;};}catch(e){}" +
    "try{Object.defineProperty(self.navigator,'language',{configurable:true,get:function(){return LOCALE;}});" +
    "Object.defineProperty(self.navigator,'languages',{configurable:true,get:function(){return [LOCALE,String(LOCALE).split('-')[0]];}});}catch(e){}" +
    "}catch(e){}})();\n"
  );
}

function onServiceWorkerHeaders(details) {
  if (!state.enabled || state.lat == null) return {};
  if (!shouldRewriteServiceWorker(details.url)) return {};

  const filter = browser.webRequest.filterResponseData(details.requestId);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");
  let chunks = [];

  filter.ondata = (event) => {
    chunks.push(new Uint8Array(event.data));
  };
  filter.onstop = () => {
    try {
      let total = 0;
      for (const c of chunks) total += c.length;
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      const body = decoder.decode(merged);
      filter.write(encoder.encode(serviceWorkerPrelude() + body));
    } catch (e) {
      console.warn("Locatone SW rewrite failed", e);
      try {
        for (const c of chunks) filter.write(c);
      } catch {
        /* ignore */
      }
    }
    try {
      filter.close();
    } catch {
      /* already closed */
    }
    swRewriteUntil.delete(details.url);
  };
  filter.onerror = () => {
    try {
      filter.close();
    } catch {
      /* already closed */
    }
  };

  const headers = (details.responseHeaders || []).filter(
    (h) => String(h.name).toLowerCase() !== "content-encoding"
  );
  return { responseHeaders: headers };
}

function setupServiceWorkerRewrite() {
  if (browser.webRequest.onHeadersReceived.hasListener(onServiceWorkerHeaders)) {
    browser.webRequest.onHeadersReceived.removeListener(onServiceWorkerHeaders);
  }
  browser.webRequest.onHeadersReceived.addListener(
    onServiceWorkerHeaders,
    { urls: ["<all_urls>"], types: ["script"] },
    ["blocking", "responseHeaders"]
  );
}

browser.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;

  if (msg.type === "locatone:getState") {
    return Promise.resolve(state);
  }

  if (msg.type === "locatone:markSwScript") {
    markServiceWorkerScript(msg.url);
    return Promise.resolve({ ok: true });
  }

  if (msg.type === "locatone:resolve") {
    return resolveInput(msg.input)
      .then((enriched) => ({ ok: true, data: enriched }))
      .catch((err) => ({ ok: false, error: err.message || String(err) }));
  }

  if (msg.type === "locatone:save") {
    return saveState(msg.data).then((s) => ({ ok: true, state: s }));
  }

  if (msg.type === "locatone:setEnabled") {
    return saveState({ enabled: !!msg.enabled }).then((s) => ({
      ok: true,
      state: s,
    }));
  }

  if (msg.type === "locatone:applyLocation") {
    return resolveInput(msg.input)
      .then(async (enriched) => {
        const next = await saveState({
          ...enriched,
          enabled: msg.enable !== false,
          proxy: msg.proxy || state.proxy,
        });
        return { ok: true, state: next };
      })
      .catch((err) => ({ ok: false, error: err.message || String(err) }));
  }
});

loadState().then(() => {
  setupIpRewrite();
  setupRttNeutralize();
  setupAcceptLanguageRewrite();
  setupServiceWorkerRewrite();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.locatone) {
    state = {
      ...DEFAULT_STATE,
      ...changes.locatone.newValue,
      proxy: {
        ...DEFAULT_STATE.proxy,
        ...((changes.locatone.newValue && changes.locatone.newValue.proxy) ||
          {}),
      },
    };
    applyProxy();
    applyWebRtcPrivacy();
  }
});
