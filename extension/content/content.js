/* global LocatoneTZ */
"use strict";

/**
 * Locatone content script — overrides page geolocation, timezone, language,
 * WebRTC ICE, sensors, keyboard, and prefers-color-scheme via Firefox
 * wrappedJSObject / exportFunction (CSP-safe).
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
    RTCPeerConnection: null,
    iceCandidateDesc: null,
    addEventListener: null,
    matchMedia: null,
    keyboardGetLayoutMap: null,
    Magnetometer: null,
    Barometer: null,
    AbsoluteOrientationSensor: null,
    RelativeOrientationSensor: null,
    captured: false,
    languagePatched: false,
    webrtcPatched: false,
    sensorsPatched: false,
    matchMediaPatched: false,
    keyboardPatched: false,
  };

  const IPV4_PATTERN =
    /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\b/;

  function isPrivateIpv4(ip) {
    return (
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
      ip.startsWith("127.") ||
      ip.startsWith("169.254.") ||
      ip.startsWith("0.")
    );
  }

  function stripIpv6Brackets(ip) {
    if (ip.startsWith("[") && ip.endsWith("]")) return ip.slice(1, -1);
    return ip;
  }

  function isPrivateOrLocalIpv6(ip) {
    const lower = stripIpv6Brackets(ip).toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return true;
    return false;
  }

  function looksLikeIpv6(ip) {
    const cleaned = stripIpv6Brackets(ip);
    if (!cleaned.includes(":") || cleaned.includes(".")) return false;
    return /^[0-9a-fA-F:]+$/.test(cleaned) && /[0-9a-fA-F]/.test(cleaned);
  }

  function candidateHasPublicIp(candidateLine, address) {
    if (typeof address === "string" && address.length > 0) {
      if (address.endsWith(".local")) return false;
      if (IPV4_PATTERN.test(address) && IPV4_PATTERN.exec(address)[0] === address) {
        return !isPrivateIpv4(address);
      }
      if (looksLikeIpv6(address) && !isPrivateOrLocalIpv6(address)) {
        return true;
      }
    }

    const line = candidateLine || "";
    if (/\.local\b/i.test(line)) return false;

    const v4 = IPV4_PATTERN.exec(line);
    if (v4 && !isPrivateIpv4(v4[0])) return true;

    const bracket = /\[([0-9a-fA-F:]+)\]/.exec(line);
    if (bracket && looksLikeIpv6(bracket[1]) && !isPrivateOrLocalIpv6(bracket[1])) {
      return true;
    }

    for (const part of line.split(" ")) {
      const cleaned = stripIpv6Brackets(part);
      if (looksLikeIpv6(cleaned) && !isPrivateOrLocalIpv6(cleaned)) return true;
    }
    return false;
  }

  function getOffsetMinutes(timezone, ms) {
    if (typeof LocatoneTZ !== "undefined" && LocatoneTZ.getTimezoneOffsetMinutes) {
      return LocatoneTZ.getTimezoneOffsetMinutes(timezone, new Date(ms));
    }
    try {
      const date = new Date(ms);
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "shortOffset",
      });
      const parts = fmt.formatToParts(date);
      const label = parts.find((p) => p.type === "timeZoneName");
      if (label) {
        const value = label.value;
        if (value === "GMT" || value === "UTC") return 0;
        const match = /(?:GMT|UTC)?([+-])(\d{1,2})(?::?(\d{2}))?/.exec(value);
        if (match) {
          const sign = match[1] === "-" ? -1 : 1;
          const hours = Number(match[2]);
          const minutes = Number(match[3] || "0");
          // east-of-UTC minutes → invert for Date#getTimezoneOffset
          return -(sign * (hours * 60 + minutes));
        }
      }
    } catch {
      /* fall through */
    }
    return 0;
  }

  /** Approximate solar elevation degrees (same idea as ./web solar-elevation). */
  function solarElevationDegrees(lat, lng, date) {
    const rad = Math.PI / 180;
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const now = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    );
    const dayOfYear = (now - start) / 86400000;
    const declination = 23.44 * Math.sin(rad * ((360 / 365) * (dayOfYear - 81)));
    const hourUtc =
      date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const lst = (hourUtc * 15 + lng + 360) % 360;
    const hourAngle = lst - 180;
    const sinElev =
      Math.sin(lat * rad) * Math.sin(declination * rad) +
      Math.cos(lat * rad) *
        Math.cos(declination * rad) *
        Math.cos(hourAngle * rad);
    return Math.asin(Math.min(1, Math.max(-1, sinElev))) / rad;
  }

  function prefersDarkFromSpoof() {
    if (config.lat == null || config.lng == null) return false;
    const elev = solarElevationDegrees(config.lat, config.lng, new Date());
    return elev < -6;
  }

  let hostDefaultTimeZone = null;

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
      try {
        hostDefaultTimeZone = originals.resolvedOptions.call(
          new win.Intl.DateTimeFormat()
        ).timeZone;
      } catch {
        hostDefaultTimeZone = null;
      }
      if (typeof win.RTCPeerConnection === "function") {
        originals.RTCPeerConnection = win.RTCPeerConnection;
        try {
          originals.iceCandidateDesc = Object.getOwnPropertyDescriptor(
            win.RTCPeerConnection.prototype,
            "onicecandidate"
          );
          originals.addEventListener = win.RTCPeerConnection.prototype.addEventListener;
        } catch {
          originals.iceCandidateDesc = null;
          originals.addEventListener = null;
        }
      }
      if (typeof win.matchMedia === "function") {
        originals.matchMedia = win.matchMedia.bind(win);
      }
      if (win.navigator.keyboard && typeof win.navigator.keyboard.getLayoutMap === "function") {
        originals.keyboardGetLayoutMap = win.navigator.keyboard.getLayoutMap;
      }
      originals.Magnetometer = win.Magnetometer;
      originals.Barometer = win.Barometer;
      originals.AbsoluteOrientationSensor = win.AbsoluteOrientationSensor;
      originals.RelativeOrientationSensor = win.RelativeOrientationSensor;
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
        if (originals.getCurrentPosition) {
          geo.getCurrentPosition = originals.getCurrentPosition;
        }
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
      if (originals.RTCPeerConnection) {
        try {
          const proto = originals.RTCPeerConnection.prototype;
          if (originals.iceCandidateDesc) {
            Object.defineProperty(proto, "onicecandidate", originals.iceCandidateDesc);
          }
          if (originals.addEventListener) {
            proto.addEventListener = originals.addEventListener;
          }
        } catch {
          /* ignore */
        }
      }
      if (originals.matchMedia) {
        win.matchMedia = originals.matchMedia;
      }
      if (originals.keyboardGetLayoutMap && win.navigator.keyboard) {
        win.navigator.keyboard.getLayoutMap = originals.keyboardGetLayoutMap;
      }
      if ("Magnetometer" in win) win.Magnetometer = originals.Magnetometer;
      if ("Barometer" in win) win.Barometer = originals.Barometer;
      if ("AbsoluteOrientationSensor" in win) {
        win.AbsoluteOrientationSensor = originals.AbsoluteOrientationSensor;
      }
      if ("RelativeOrientationSensor" in win) {
        win.RelativeOrientationSensor = originals.RelativeOrientationSensor;
      }
      originals.webrtcPatched = false;
      originals.sensorsPatched = false;
      originals.matchMediaPatched = false;
      originals.keyboardPatched = false;
    } catch (e) {
      console.warn("Locatone restore failed", e);
    }
  }

  function accuracyForOptions(options) {
    const base = config.accuracy != null ? config.accuracy : 10;
    const high = !options || options.enableHighAccuracy !== false;
    if (high) return base;
    return Math.max(3000, base * 300);
  }

  function installWebRtcFilter(win) {
    if (!originals.RTCPeerConnection || originals.webrtcPatched) return;
    const NativePC = originals.RTCPeerConnection;
    const proto = NativePC.prototype;

    function shouldDropCandidate(cand) {
      if (!cand) return false;
      const line = cand.candidate || "";
      const address = cand.address;
      if (/\styp\s+srflx\b/i.test(line) || /\styp\s+relay\b/i.test(line)) {
        return true;
      }
      return candidateHasPublicIp(line, address);
    }

    function wrapHandler(handler) {
      if (typeof handler !== "function") return handler;
      const wrapped = function (event) {
        try {
          if (event && event.candidate && shouldDropCandidate(event.candidate)) {
            return;
          }
        } catch {
          /* forward on filter errors */
        }
        return handler.call(this, event);
      };
      return exportFunction(wrapped, win);
    }

    // Patch prototype — exportFunction cannot replace RTCPeerConnection as a
    // constructible class. Background privacy policy is the primary leak block.
    try {
      const iceDesc = Object.getOwnPropertyDescriptor(proto, "onicecandidate");
      if (iceDesc && iceDesc.set) {
        Object.defineProperty(proto, "onicecandidate", {
          configurable: true,
          enumerable: true,
          get: iceDesc.get
            ? exportFunction(function () {
                return iceDesc.get.call(this);
              }, win)
            : undefined,
          set: exportFunction(function (handler) {
            iceDesc.set.call(this, wrapHandler(handler));
          }, win),
        });
      }
    } catch (e) {
      console.warn("Locatone onicecandidate proto wrap failed", e);
    }

    try {
      const origAdd = proto.addEventListener;
      if (typeof origAdd === "function") {
        proto.addEventListener = exportFunction(function (
          type,
          listener,
          options
        ) {
          if (type === "icecandidate" && typeof listener === "function") {
            return origAdd.call(this, type, wrapHandler(listener), options);
          }
          return origAdd.call(this, type, listener, options);
        }, win);
      }
    } catch (e) {
      console.warn("Locatone addEventListener proto wrap failed", e);
    }

    originals.webrtcPatched = true;
  }

  function installMatchMedia(win) {
    if (!originals.matchMedia || originals.matchMediaPatched) return;
    const nativeMatchMedia = originals.matchMedia;

    win.matchMedia = exportFunction(function (query) {
      const mql = nativeMatchMedia(query);
      const q = String(query || "").toLowerCase().replace(/\s+/g, " ");
      if (
        q.includes("prefers-color-scheme") &&
        (q.includes("dark") || q.includes("light"))
      ) {
        const wantDark = prefersDarkFromSpoof();
        const matchesDarkQuery = q.includes("dark");
        const spoofMatches = matchesDarkQuery ? wantDark : !wantDark;
        try {
          Object.defineProperty(mql, "matches", {
            configurable: true,
            enumerable: true,
            get: exportFunction(function () {
              return spoofMatches;
            }, win),
          });
        } catch {
          /* some engines freeze MediaQueryList */
        }
      }
      return mql;
    }, win);

    originals.matchMediaPatched = true;
  }

  function installKeyboard(win) {
    if (!win.navigator.keyboard || originals.keyboardPatched) {
      return;
    }

    const softMap = exportFunction(function () {
      // Ambiguous QWERTY sample → web keyboard prior stays soft / weak.
      try {
        const map = new win.Map();
        map.set("KeyA", "a");
        map.set("KeyQ", "q");
        map.set("KeyW", "w");
        map.set("KeyZ", "z");
        map.set("Digit1", "1");
        map.set("Minus", "-");
        map.set("Equal", "=");
        map.set("BracketLeft", "[");
        map.set("BracketRight", "]");
        map.set("Semicolon", ";");
        map.set("Quote", "'");
        map.set("Backslash", "\\");
        map.set("Comma", ",");
        map.set("Period", ".");
        map.set("Slash", "/");
        return win.Promise.resolve(map);
      } catch (e) {
        // Never hang the page probe — fail fast instead.
        return win.Promise.reject(e);
      }
    }, win);

    try {
      Object.defineProperty(win.navigator.keyboard, "getLayoutMap", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: softMap,
      });
      originals.keyboardPatched = true;
    } catch (e) {
      try {
        win.navigator.keyboard.getLayoutMap = softMap;
        originals.keyboardPatched = true;
      } catch (err) {
        console.warn("Locatone keyboard override failed", err || e);
        // Last resort: leave native API alone but it may hang; we tried.
      }
    }
  }

  function installSensorStubs(win) {
    if (originals.sensorsPatched) return;

    function unsupportedCtor(name) {
      return exportFunction(function SensorStub() {
        const err = new win.Error(name + " is unavailable");
        err.name = "NotSupportedError";
        throw err;
      }, win);
    }

    try {
      if ("Magnetometer" in win) {
        win.Magnetometer = unsupportedCtor("Magnetometer");
      }
      if ("Barometer" in win) {
        win.Barometer = unsupportedCtor("Barometer");
      }
      if ("AbsoluteOrientationSensor" in win) {
        win.AbsoluteOrientationSensor = unsupportedCtor(
          "AbsoluteOrientationSensor"
        );
      }
      if ("RelativeOrientationSensor" in win) {
        win.RelativeOrientationSensor = unsupportedCtor(
          "RelativeOrientationSensor"
        );
      }
      originals.sensorsPatched = true;
    } catch (e) {
      console.warn("Locatone sensor stubs failed", e);
    }
  }

  function applyOverrides() {
    if (
      typeof exportFunction !== "function" ||
      typeof wrappedJSObject === "undefined"
    ) {
      return;
    }

    const win = wrappedJSObject;
    captureOriginals(win);

    if (!config.enabled || config.lat == null || config.lng == null) {
      restoreOriginals();
      return;
    }

    function successPayload(options) {
      const coords = {
        latitude: config.lat,
        longitude: config.lng,
        accuracy: accuracyForOptions(options),
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      };
      const pos = {
        coords: coords,
        timestamp: Date.now(),
      };
      if (typeof cloneInto === "function") {
        return cloneInto(pos, win, { cloneFunctions: false });
      }
      const coordsObj = new win.Object();
      coordsObj.latitude = coords.latitude;
      coordsObj.longitude = coords.longitude;
      coordsObj.accuracy = coords.accuracy;
      coordsObj.altitude = null;
      coordsObj.altitudeAccuracy = null;
      coordsObj.heading = null;
      coordsObj.speed = null;
      const posObj = new win.Object();
      posObj.coords = coordsObj;
      posObj.timestamp = Date.now();
      return posObj;
    }

    const getCurrentPosition = function (success, error, options) {
      // Always complete — do not rely on native timeout when we own the method.
      const finishOk = () => {
        try {
          if (typeof success === "function") {
            success(successPayload(options));
          }
        } catch (err) {
          if (typeof error === "function") {
            try {
              error(err);
            } catch {
              /* ignore secondary throw */
            }
          }
        }
      };
      try {
        win.setTimeout(finishOk, 1);
      } catch {
        finishOk();
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
      originals.languagePatched = true;
    } catch (e) {
      console.warn("Locatone language override failed", e);
    }

    try {
      win.Date.prototype.getTimezoneOffset = exportFunction(function () {
        // Prefer numeric coercion: exportFunction often breaks this.getTime().
        const ms = Number(this);
        return getOffsetMinutes(
          config.timezone || "UTC",
          Number.isFinite(ms) ? ms : Date.now()
        );
      }, win);
    } catch (e) {
      console.warn("Locatone Date override failed", e);
    }

    try {
      const origResolved =
        originals.resolvedOptions ||
        win.Intl.DateTimeFormat.prototype.resolvedOptions;

      win.Intl.DateTimeFormat.prototype.resolvedOptions = exportFunction(
        function () {
          const o = origResolved.call(this);
          if (!config.enabled || !config.timezone) return o;

          // Spoof default formatters (native zone == OS default). Leave
          // explicit `{ timeZone }` alone so shortOffset for that IANA id
          // stays accurate when callers inspect resolvedOptions.
          const isDefault =
            hostDefaultTimeZone == null ||
            o.timeZone === hostDefaultTimeZone ||
            o.timeZone === config.timezone;
          if (isDefault) {
            o.timeZone = config.timezone;
            if (config.locale) {
              try {
                o.locale = String(config.locale);
              } catch {
                /* keep native locale */
              }
            }
          }
          return o;
        },
        win
      );
    } catch (e) {
      console.warn("Locatone Intl override failed", e);
    }

    try {
      installWebRtcFilter(win);
    } catch (e) {
      console.warn("Locatone WebRTC override failed", e);
    }

    try {
      installMatchMedia(win);
    } catch (e) {
      console.warn("Locatone matchMedia override failed", e);
    }

    try {
      installKeyboard(win);
    } catch (e) {
      console.warn("Locatone keyboard install failed", e);
    }

    try {
      installSensorStubs(win);
    } catch (e) {
      console.warn("Locatone sensor install failed", e);
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
