"use strict";

const $ = (id) => document.getElementById(id);

const els = {
  input: $("input"),
  apply: $("apply"),
  enabled: $("enabled"),
  resolved: $("resolved"),
  lat: $("lat"),
  lng: $("lng"),
  timezone: $("timezone"),
  locale: $("locale"),
  proxyMode: $("proxyMode"),
  proxyHost: $("proxyHost"),
  proxyPort: $("proxyPort"),
  proxyUser: $("proxyUser"),
  proxyPass: $("proxyPass"),
  status: $("status"),
  error: $("error"),
};

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

function fillProxy(proxy = {}) {
  els.proxyMode.value = proxy.mode || "none";
  els.proxyHost.value = proxy.host || "";
  els.proxyPort.value = proxy.port || "";
  els.proxyUser.value = proxy.username || "";
  els.proxyPass.value = proxy.password || "";
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
}

function statusLine(state) {
  if (!state.enabled || state.lat == null) {
    els.status.classList.remove("on");
    els.status.textContent = "Spoofing off";
    return;
  }
  const place = state.label || state.timezone || "custom";
  const proxy =
    state.proxy && state.proxy.mode !== "none"
      ? `Proxy ${state.proxy.mode} ${state.proxy.host}:${state.proxy.port}`
      : "Proxy off";
  els.status.classList.add("on");
  els.status.textContent = `Spoofing ${place} · ${state.timezone} · ${proxy}`;
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
  if (proxy.mode !== "none" && (!proxy.host || !proxy.port)) {
    // Don't save incomplete proxy; wait until Apply or toggle
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
els.proxyMode.addEventListener("change", onProxyChange);
["proxyHost", "proxyPort", "proxyUser", "proxyPass"].forEach((id) => {
  $(id).addEventListener("change", onProxyChange);
});

els.input.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onApply();
});

load();
