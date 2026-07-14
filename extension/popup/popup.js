"use strict";

const $ = (id) => document.getElementById(id);

const REGION_CURRENCY = {
  BR: "BRL",
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  GB: "GBP",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  AU: "AUD",
  NZ: "NZD",
  AR: "ARS",
  CL: "CLP",
  CO: "COP",
  PE: "PEN",
  IN: "INR",
  AE: "AED",
  TR: "TRY",
  RU: "RUB",
  ZA: "ZAR",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  PL: "PLN",
  TH: "THB",
  ID: "IDR",
  PH: "PHP",
  SG: "SGD",
  HK: "HKD",
  TW: "TWD",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  PT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  EE: "EUR",
  LT: "EUR",
  LV: "EUR",
  SK: "EUR",
  SI: "EUR",
  HR: "EUR",
};

const els = {
  input: $("input"),
  apply: $("apply"),
  enabled: $("enabled"),
  resolved: $("resolved"),
  lat: $("lat"),
  lng: $("lng"),
  timezone: $("timezone"),
  locale: $("locale"),
  currency: $("currency"),
  country: $("country"),
  proxyToggle: $("proxyToggle"),
  proxyBody: $("proxyBody"),
  proxyBadge: $("proxyBadge"),
  proxyMode: $("proxyMode"),
  proxyDetails: $("proxyDetails"),
  proxyHost: $("proxyHost"),
  proxyPort: $("proxyPort"),
  proxyUser: $("proxyUser"),
  proxyPass: $("proxyPass"),
  status: $("status"),
  edgeWarn: $("edgeWarn"),
  error: $("error"),
};

let proxyExpanded = false;

function showError(msg) {
  if (!msg) {
    els.error.hidden = true;
    els.error.textContent = "";
    return;
  }
  els.error.hidden = false;
  els.error.textContent = msg;
}

function proxyFromForm() {
  return {
    mode: els.proxyMode.value || "none",
    host: els.proxyHost.value.trim(),
    port: els.proxyPort.value.trim(),
    username: els.proxyUser.value.trim(),
    password: els.proxyPass.value,
  };
}

function proxyModeLabel(mode) {
  if (mode === "http") return "HTTP";
  if (mode === "socks5") return "SOCKS5";
  return "Off";
}

function syncProxyUi() {
  const mode = els.proxyMode.value || "none";
  const on = mode !== "none";
  els.proxyDetails.hidden = !on;
  els.proxyBadge.textContent = proxyModeLabel(mode);
  els.proxyBadge.classList.toggle("on", on);
  els.proxyBody.hidden = !proxyExpanded;
  els.proxyToggle.setAttribute("aria-expanded", proxyExpanded ? "true" : "false");
}

function setProxyExpanded(expanded) {
  proxyExpanded = !!expanded;
  syncProxyUi();
}

function fillProxy(proxy = {}) {
  const mode = proxy.mode || "none";
  els.proxyMode.value = mode;
  els.proxyHost.value = proxy.host || "";
  els.proxyPort.value = proxy.port || "";
  els.proxyUser.value = proxy.username || "";
  els.proxyPass.value = proxy.password || "";
  // Expand when a real proxy is configured; keep collapsed when Off.
  proxyExpanded = mode !== "none";
  syncProxyUi();
}

function countryFromLocale(locale) {
  const parts = String(locale || "").replace("_", "-").split("-");
  if (parts.length >= 2 && parts[1]) return parts[1].toUpperCase();
  return "—";
}

function currencyFromLocale(locale) {
  const country = countryFromLocale(locale);
  if (country === "—") return "—";
  return REGION_CURRENCY[country] || "USD";
}

function showResolved(state) {
  if (state.lat == null || state.lng == null) {
    els.resolved.hidden = true;
    return;
  }
  els.resolved.hidden = false;
  els.lat.textContent = Number(state.lat).toFixed(6);
  els.lng.textContent = Number(state.lng).toFixed(6);
  els.timezone.textContent = state.timezone || "—";
  els.locale.textContent = state.locale || "—";
  els.country.textContent = countryFromLocale(state.locale);
  els.currency.textContent = currencyFromLocale(state.locale);
}

function statusLine(state) {
  if (!state.enabled || state.lat == null) {
    els.status.classList.remove("on");
    els.status.textContent = "Spoofing off";
    if (els.edgeWarn) els.edgeWarn.hidden = true;
    return;
  }
  const place = state.label || state.timezone || "custom";
  const proxyOn =
    state.proxy && state.proxy.mode !== "none" && state.proxy.host;
  const proxy = proxyOn
    ? `Proxy ${state.proxy.mode} ${state.proxy.host}:${state.proxy.port}`
    : "Proxy off";
  els.status.classList.add("on");
  els.status.textContent = `Spoofing ${place} · ${state.timezone} · ${proxy}`;
  if (els.edgeWarn) {
    els.edgeWarn.hidden = !!proxyOn;
  }
}

function applyStateToForm(state) {
  if (state.input) els.input.value = state.input;
  els.enabled.checked = !!state.enabled;
  fillProxy(state.proxy);
  showResolved(state);
  statusLine(state);
}

async function load() {
  const state = await browser.runtime.sendMessage({ type: "locatone:getState" });
  applyStateToForm(state || {});
}

async function onApply() {
  showError("");
  const input = els.input.value.trim();
  if (!input) {
    showError("Paste coordinates or a Google Maps link");
    return;
  }

  const proxy = proxyFromForm();
  if (proxy.mode !== "none" && (!proxy.host || !proxy.port)) {
    showError("Proxy host and port are required when proxy mode is on");
    return;
  }

  els.apply.disabled = true;
  try {
    const res = await browser.runtime.sendMessage({
      type: "locatone:applyLocation",
      input,
      enable: true,
      proxy,
    });
    if (!res || !res.ok) {
      showError((res && res.error) || "Failed to apply location");
      return;
    }
    els.enabled.checked = true;
    applyStateToForm(res.state);
    els.apply.classList.remove("flash");
    void els.apply.offsetWidth;
    els.apply.classList.add("flash");
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    els.apply.disabled = false;
  }
}

async function onToggle() {
  showError("");
  const proxy = proxyFromForm();
  const res = await browser.runtime.sendMessage({
    type: "locatone:save",
    data: {
      enabled: els.enabled.checked,
      proxy,
      input: els.input.value.trim(),
    },
  });
  if (res && res.ok) {
    statusLine(res.state);
    showResolved(res.state);
  }
}

async function onProxyChange() {
  const proxy = proxyFromForm();
  if (proxy.mode !== "none") {
    proxyExpanded = true;
  }
  syncProxyUi();
  if (proxy.mode !== "none" && (!proxy.host || !proxy.port)) {
    return;
  }
  const res = await browser.runtime.sendMessage({
    type: "locatone:save",
    data: { proxy },
  });
  if (res && res.ok) statusLine(res.state);
}

els.apply.addEventListener("click", onApply);
els.enabled.addEventListener("change", onToggle);
els.proxyToggle.addEventListener("click", () => {
  setProxyExpanded(!proxyExpanded);
});
els.proxyMode.addEventListener("change", onProxyChange);
["proxyHost", "proxyPort", "proxyUser", "proxyPass"].forEach((id) => {
  $(id).addEventListener("change", onProxyChange);
});

els.input.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onApply();
});

load();
