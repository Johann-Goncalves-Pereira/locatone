"use strict";

/**
 * Locatone content script — overrides page geolocation, timezone, and language
 * via Firefox wrappedJSObject / exportFunction (CSP-safe).
 */
(() => {
  const config = {
    enabled: false,
    lat: null,
    lng: null,
    accuracy: 10,
    timezone: "UTC",
    locale: "en-US",
  };

  const originals = {
    getCurrentPosition: null,
    watchPosition: null,
    clearWatch: null,
    permissionsQuery: null,
    getTimezoneOffset: null,
    resolvedOptions: null,
    languageDesc: null,
    languagesDesc: null,
    captured: false,
  };

  function getOffsetMinutes(timezone, ms) {
    try {
      const date = new Date(ms);
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

  function captureOriginals(win) {
    if (originals.captured) return;
    try {
      const geo = win.navigator.geolocation;
      if (geo) {
        originals.getCurrentPosition = geo.getCurrentPosition;
        originals.watchPosition = geo.watchPosition;
        originals.clearWatch = geo.clearWatch;
      }
      if (win.navigator.permissions && win.navigator.permissions.query) {
        originals.permissionsQuery = win.navigator.permissions.query;
      }
      originals.getTimezoneOffset = win.Date.prototype.getTimezoneOffset;
      originals.resolvedOptions = win.Intl.DateTimeFormat.prototype.resolvedOptions;
      originals.captured = true;
    } catch (e) {
      console.warn("Locatone could not capture originals", e);
    }
  }

  function restoreOriginals() {
    if (typeof wrappedJSObject === "undefined" || !originals.captured) return;
    const win = wrappedJSObject;
    try {
      const geo = win.navigator.geolocation;
      if (geo) {
        if (originals.getCurrentPosition) geo.getCurrentPosition = originals.getCurrentPosition;
        if (originals.watchPosition) geo.watchPosition = originals.watchPosition;
        if (originals.clearWatch) geo.clearWatch = originals.clearWatch;
      }
      if (originals.permissionsQuery && win.navigator.permissions) {
        win.navigator.permissions.query = originals.permissionsQuery;
      }
      if (originals.getTimezoneOffset) {
        win.Date.prototype.getTimezoneOffset = originals.getTimezoneOffset;
      }
      if (originals.resolvedOptions) {
        win.Intl.DateTimeFormat.prototype.resolvedOptions = originals.resolvedOptions;
      }
    } catch (e) {
      console.warn("Locatone restore failed", e);
    }
  }

  function applyOverrides() {
    if (typeof exportFunction !== "function" || typeof wrappedJSObject === "undefined") {
      return;
    }

    const win = wrappedJSObject;
    captureOriginals(win);

    if (!config.enabled || config.lat == null || config.lng == null) {
      restoreOriginals();
      return;
    }

    function successPayload() {
      const coords = new win.Object();
      coords.latitude = config.lat;
      coords.longitude = config.lng;
      coords.accuracy = config.accuracy != null ? config.accuracy : 10;
      coords.altitude = null;
      coords.altitudeAccuracy = null;
      coords.heading = null;
      coords.speed = null;

      const pos = new win.Object();
      pos.coords = coords;
      pos.timestamp = Date.now();
      return pos;
    }

    const getCurrentPosition = function (success, error, _options) {
      if (typeof success === "function") {
        const pos = successPayload();
        win.setTimeout(() => {
          try {
            success(pos);
          } catch (err) {
            if (typeof error === "function") error(err);
          }
        }, 1);
      }
    };

    const watchIds = new win.Map();
    const watchPosition = function (success, error, options) {
      getCurrentPosition(success, error, options);
      const id = Math.floor(Math.random() * 1e9) + 1;
      const timer = win.setInterval(() => {
        getCurrentPosition(success, error, options);
      }, 5000);
      watchIds.set(id, timer);
      return id;
    };

    const clearWatch = function (id) {
      const timer = watchIds.get(id);
      if (timer != null) {
        win.clearInterval(timer);
        watchIds.delete(id);
      }
    };

    try {
      const geo = win.navigator.geolocation;
      if (geo) {
        geo.getCurrentPosition = exportFunction(getCurrentPosition, win);
        geo.watchPosition = exportFunction(watchPosition, win);
        geo.clearWatch = exportFunction(clearWatch, win);
      }
    } catch (e) {
      console.warn("Locatone geolocation override failed", e);
    }

    try {
      if (win.navigator.permissions && win.navigator.permissions.query) {
        const origQuery = (
          originals.permissionsQuery || win.navigator.permissions.query
        ).bind(win.navigator.permissions);
        const query = function (desc) {
          if (desc && desc.name === "geolocation") {
            const status = new win.Object();
            status.state = "granted";
            status.onchange = null;
            return win.Promise.resolve(status);
          }
          return origQuery(desc);
        };
        win.navigator.permissions.query = exportFunction(query, win);
      }
    } catch (e) {
      console.warn("Locatone permissions override failed", e);
    }

    try {
      Object.defineProperty(win.navigator, "language", {
        configurable: true,
        enumerable: true,
        get: exportFunction(function () {
          return config.locale || "en-US";
        }, win),
      });
      Object.defineProperty(win.navigator, "languages", {
        configurable: true,
        enumerable: true,
        get: exportFunction(function () {
          const locale = config.locale || "en-US";
          const arr = new win.Array();
          arr.push(locale);
          arr.push(locale.split("-")[0]);
          return arr;
        }, win),
      });
    } catch (e) {
      console.warn("Locatone language override failed", e);
    }

    try {
      win.Date.prototype.getTimezoneOffset = exportFunction(function () {
        return getOffsetMinutes(config.timezone || "UTC", this.getTime());
      }, win);
    } catch (e) {
      console.warn("Locatone Date override failed", e);
    }

    try {
      const origResolved =
        originals.resolvedOptions || win.Intl.DateTimeFormat.prototype.resolvedOptions;

      win.Intl.DateTimeFormat.prototype.resolvedOptions = exportFunction(function () {
        const o = origResolved.call(this);
        if (config.enabled && config.timezone) {
          o.timeZone = config.timezone;
        }
        return o;
      }, win);
    } catch (e) {
      console.warn("Locatone Intl override failed", e);
    }
  }

  function mergeConfig(src) {
    if (!src) return;
    config.enabled = !!src.enabled;
    config.lat = src.lat;
    config.lng = src.lng;
    config.accuracy = src.accuracy != null ? src.accuracy : 10;
    config.timezone = src.timezone || "UTC";
    config.locale = src.locale || "en-US";
  }

  browser.storage.local.get("locatone").then((stored) => {
    mergeConfig(stored.locatone);
    applyOverrides();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.locatone) {
      mergeConfig(changes.locatone.newValue);
      applyOverrides();
    }
  });
})();
