/* global LocatoneTZ */
"use strict";

/**
 * Locatone content script — overrides page geolocation, timezone, language,
 * Date string TZ, Worker / Service Worker Intl, speech voices, iframe Intl,
 * Intl NumberFormat, canvas font probes, WebRTC ICE, sensors,
 * deviceorientation, keyboard, and prefers-color-scheme via Firefox
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

  /** Mirror ./web run-fonts.ts probes — hide scripts not matching spoof country. */
  const FONT_MASK_PROBES = [
    {
      fonts: ["Hiragino Sans", "Yu Gothic", "Microsoft YaHei", "Noto Sans CJK"],
      countryCodes: ["JP", "CN", "KR", "TW"],
    },
    {
      fonts: ["Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR"],
      countryCodes: ["KR"],
    },
    {
      fonts: ["Tahoma", "Arabic Typesetting", "Noto Naskh Arabic", "Geeza Pro"],
      countryCodes: ["SA", "EG", "AE"],
    },
    {
      fonts: ["Arial Hebrew", "Lucida Grande", "Noto Sans Hebrew"],
      countryCodes: ["IL"],
    },
    {
      fonts: ["Thonburi", "Leelawadee UI", "Noto Sans Thai"],
      countryCodes: ["TH"],
    },
    {
      fonts: [
        "Nirmala UI",
        "Devanagari Sangam MN",
        "Noto Sans Devanagari",
      ],
      countryCodes: ["IN"],
    },
    {
      fonts: ["PT Sans", "Segoe UI", "Arial"],
      countryCodes: ["RU"],
    },
  ];

  const EMOJI_MASK_PROBES = [
    { emoji: "🇧🇷", countryCodes: ["BR"] },
    { emoji: "🇯🇵", countryCodes: ["JP"] },
    { emoji: "🇩🇪", countryCodes: ["DE"] },
    { emoji: "💴", countryCodes: ["JP"] },
  ];

  const originals = {
    getCurrentPosition: null,
    watchPosition: null,
    clearWatch: null,
    permissionsQuery: null,
    getTimezoneOffset: null,
    resolvedOptions: null,
    numberFormatResolvedOptions: null,
    NumberFormat: null,
    measureText: null,
    RTCPeerConnection: null,
    iceCandidateDesc: null,
    addEventListener: null,
    matchMedia: null,
    keyboardGetLayoutMap: null,
    Magnetometer: null,
    Barometer: null,
    AbsoluteOrientationSensor: null,
    RelativeOrientationSensor: null,
    dateToString: null,
    dateToTimeString: null,
    dateToLocaleString: null,
    Worker: null,
    SharedWorker: null,
    windowAddEventListener: null,
    windowRemoveEventListener: null,
    captured: false,
    languagePatched: false,
    webrtcPatched: false,
    sensorsPatched: false,
    orientationPatched: false,
    dateStringPatched: false,
    workerPatched: false,
    blobTrackingPatched: false,
    speechPatched: false,
    iframePatched: false,
    serviceWorkerPatched: false,
    matchMediaPatched: false,
    keyboardPatched: false,
    numberFormatPatched: false,
    fontsPatched: false,
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
  let hostDefaultLocale = null;

  function targetCountryFromLocale(locale) {
    const parts = String(locale || "").replace("_", "-").split("-");
    if (parts.length >= 2 && parts[1]) {
      return parts[1].toUpperCase();
    }
    return "";
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
      try {
        hostDefaultTimeZone = originals.resolvedOptions.call(
          new win.Intl.DateTimeFormat()
        ).timeZone;
      } catch {
        hostDefaultTimeZone = null;
      }
      try {
        originals.NumberFormat = win.Intl.NumberFormat;
        originals.numberFormatResolvedOptions =
          win.Intl.NumberFormat.prototype.resolvedOptions;
        hostDefaultLocale = originals.numberFormatResolvedOptions.call(
          new win.Intl.NumberFormat()
        ).locale;
      } catch {
        originals.NumberFormat = null;
        originals.numberFormatResolvedOptions = null;
        hostDefaultLocale = null;
      }
      try {
        if (
          win.CanvasRenderingContext2D &&
          win.CanvasRenderingContext2D.prototype
        ) {
          originals.measureText =
            win.CanvasRenderingContext2D.prototype.measureText;
        }
      } catch {
        originals.measureText = null;
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
      originals.dateToString = win.Date.prototype.toString;
      originals.dateToTimeString = win.Date.prototype.toTimeString;
      originals.dateToLocaleString = win.Date.prototype.toLocaleString;
      originals.Worker = win.Worker;
      originals.SharedWorker = win.SharedWorker;
      originals.windowAddEventListener = win.addEventListener;
      originals.windowRemoveEventListener = win.removeEventListener;
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
      if (originals.dateToString) {
        win.Date.prototype.toString = originals.dateToString;
      }
      if (originals.dateToTimeString) {
        win.Date.prototype.toTimeString = originals.dateToTimeString;
      }
      if (originals.dateToLocaleString) {
        win.Date.prototype.toLocaleString = originals.dateToLocaleString;
      }
      if (originals.Worker) {
        win.Worker = originals.Worker;
      }
      if (originals.SharedWorker) {
        win.SharedWorker = originals.SharedWorker;
      }
      if (originals.windowAddEventListener) {
        win.addEventListener = originals.windowAddEventListener;
      }
      if (originals.windowRemoveEventListener) {
        win.removeEventListener = originals.windowRemoveEventListener;
      }
      originals.dateStringPatched = false;
      originals.workerPatched = false;
      originals.orientationPatched = false;
      if (originals.resolvedOptions) {
        win.Intl.DateTimeFormat.prototype.resolvedOptions = originals.resolvedOptions;
      }
      if (originals.numberFormatResolvedOptions) {
        win.Intl.NumberFormat.prototype.resolvedOptions =
          originals.numberFormatResolvedOptions;
      }
      if (
        originals.measureText &&
        win.CanvasRenderingContext2D &&
        win.CanvasRenderingContext2D.prototype
      ) {
        win.CanvasRenderingContext2D.prototype.measureText = originals.measureText;
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
      originals.numberFormatPatched = false;
      originals.fontsPatched = false;
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
      // Soft QWERTY prior — build Map in page world to avoid Xray denial.
      try {
        const map = new win.Map();
        const pairs = [
          ["KeyA", "a"],
          ["KeyQ", "q"],
          ["KeyW", "w"],
          ["KeyZ", "z"],
          ["Digit1", "1"],
          ["Minus", "-"],
          ["Equal", "="],
          ["BracketLeft", "["],
          ["BracketRight", "]"],
          ["Semicolon", ";"],
          ["Quote", "'"],
          ["Backslash", "\\"],
          ["Comma", ","],
          ["Period", "."],
          ["Slash", "/"],
        ];
        for (let i = 0; i < pairs.length; i++) {
          map.set(pairs[i][0], pairs[i][1]);
        }
        return win.Promise.resolve(map);
      } catch (e) {
        return win.Promise.reject(
          e || new win.Error("Locatone keyboard map unavailable")
        );
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

  function formatGmtLabel(offsetMinutesWest) {
    const east = -offsetMinutesWest;
    const sign = east >= 0 ? "+" : "-";
    const abs = Math.abs(east);
    const h = String(Math.floor(abs / 60)).padStart(2, "0");
    const m = String(abs % 60).padStart(2, "0");
    return "GMT" + sign + h + m;
  }

  function longTimeZoneName(timezone, date) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "long",
      }).formatToParts(date);
      const part = parts.find((p) => p.type === "timeZoneName");
      return (part && part.value) || timezone;
    } catch {
      return timezone;
    }
  }

  function formatPartsInZone(date, timezone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const map = {};
    for (const p of fmt.formatToParts(date)) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    const hour = map.hour === "24" ? "00" : map.hour;
    return {
      weekday: map.weekday || "Mon",
      month: map.month || "Jan",
      day: map.day || "01",
      year: map.year || "1970",
      time: hour + ":" + (map.minute || "00") + ":" + (map.second || "00"),
    };
  }

  function clearSessionGpsEcho(win) {
    try {
      if (win.sessionStorage) {
        win.sessionStorage.removeItem("locatone:last-gps");
      }
    } catch {
      /* private mode */
    }
  }

  function installDateStringOverrides(win) {
    if (originals.dateStringPatched || !originals.dateToString) return;
    try {
      win.Date.prototype.toTimeString = exportFunction(function () {
        if (!config.enabled || !config.timezone) {
          return originals.dateToTimeString.call(this);
        }
        const ms = Number(this);
        const date = new Date(Number.isFinite(ms) ? ms : Date.now());
        const parts = formatPartsInZone(date, config.timezone);
        const gmt = formatGmtLabel(
          getOffsetMinutes(config.timezone, date.getTime())
        );
        return parts.time + " " + gmt;
      }, win);

      win.Date.prototype.toString = exportFunction(function () {
        if (!config.enabled || !config.timezone) {
          return originals.dateToString.call(this);
        }
        const ms = Number(this);
        const date = new Date(Number.isFinite(ms) ? ms : Date.now());
        const parts = formatPartsInZone(date, config.timezone);
        const gmt = formatGmtLabel(
          getOffsetMinutes(config.timezone, date.getTime())
        );
        const longName = longTimeZoneName(config.timezone, date);
        return (
          parts.weekday +
          " " +
          parts.month +
          " " +
          parts.day +
          " " +
          parts.year +
          " " +
          parts.time +
          " " +
          gmt +
          " (" +
          longName +
          ")"
        );
      }, win);

      if (originals.dateToLocaleString) {
        win.Date.prototype.toLocaleString = exportFunction(function (
          locales,
          options
        ) {
          if (!config.enabled || !config.timezone) {
            return originals.dateToLocaleString.call(this, locales, options);
          }
          const opts = options ? Object.assign({}, options) : {};
          if (!opts.timeZone) opts.timeZone = config.timezone;
          const loc = locales != null ? locales : config.locale || undefined;
          return originals.dateToLocaleString.call(this, loc, opts);
        }, win);
      }
      originals.dateStringPatched = true;
    } catch (e) {
      console.warn("Locatone Date string overrides failed", e);
    }
  }

  /** blob: URL → JS source captured at createObjectURL (avoids sync XHR to blob). */
  const blobScriptByUrl = new Map();
  /** Blob → concatenated string parts (WeakMap so GC still works). */
  const blobStringParts = new WeakMap();

  function workerPreludeSource() {
    const tz = JSON.stringify(config.timezone || "UTC");
    const locale = JSON.stringify(config.locale || "en-US");
    const offset = getOffsetMinutes(config.timezone || "UTC", Date.now());
    return (
      "(function(){try{" +
      "var TZ=" +
      tz +
      ",LOCALE=" +
      locale +
      ",OFFSET=" +
      offset +
      ";" +
      "Date.prototype.getTimezoneOffset=function(){return OFFSET;};" +
      "var _ro=Intl.DateTimeFormat.prototype.resolvedOptions;" +
      "Intl.DateTimeFormat.prototype.resolvedOptions=function(){var o=_ro.call(this);o.timeZone=TZ;try{o.locale=LOCALE;}catch(e){}return o;};" +
      "try{Object.defineProperty(self.navigator,'language',{configurable:true,get:function(){return LOCALE;}});" +
      "Object.defineProperty(self.navigator,'languages',{configurable:true,get:function(){return [LOCALE,String(LOCALE).split('-')[0]];}});}catch(e){}" +
      "}catch(e){}})();\n"
    );
  }

  function extractBlobStringParts(parts) {
    if (!parts || typeof parts.length !== "number") return null;
    let text = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (typeof part === "string") {
        text += part;
        continue;
      }
      return null;
    }
    return text;
  }

  function rewriteBlobWorkerUrl(win, scriptURL) {
    const url = String(scriptURL);
    if (!url.startsWith("blob:")) return null;

    let source = blobScriptByUrl.get(url);
    if (typeof source !== "string") {
      try {
        const xhr = new win.XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.send(null);
        source = String(xhr.responseText || "");
      } catch (e) {
        console.debug("Locatone Worker blob XHR failed; cannot rewrite", e);
        return null;
      }
    }
    if (typeof source !== "string") return null;

    const rewritten = new win.Blob(
      [workerPreludeSource() + source],
      { type: "text/javascript" }
    );
    return win.URL.createObjectURL(rewritten);
  }

  function markHttpWorkerScript(win, scriptURL) {
    let abs = String(scriptURL);
    try {
      abs = new win.URL(String(scriptURL), win.location.href).href;
    } catch {
      /* keep relative */
    }
    if (!/^https?:/i.test(abs)) return;
    try {
      browser.runtime.sendMessage({
        type: "locatone:markWorkerScript",
        url: abs,
      });
    } catch {
      /* ignore */
    }
  }

  function installBlobUrlTracking(win) {
    if (originals.blobTrackingPatched) return;
    try {
      const NativeBlob = win.Blob;
      const nativeCreateObjectURL = win.URL.createObjectURL.bind(win.URL);
      const nativeRevokeObjectURL = win.URL.revokeObjectURL.bind(win.URL);

      win.Blob = exportFunction(function LocatoneBlob(parts, options) {
        const blob =
          options === undefined
            ? new NativeBlob(parts)
            : new NativeBlob(parts, options);
        const text = extractBlobStringParts(parts);
        if (text !== null) {
          try {
            blobStringParts.set(blob, text);
          } catch {
            /* WeakMap set can fail across compartments */
          }
        }
        return blob;
      }, win);

      win.URL.createObjectURL = exportFunction(function (obj) {
        const url = nativeCreateObjectURL(obj);
        try {
          const text = blobStringParts.get(obj);
          if (typeof text === "string") {
            blobScriptByUrl.set(url, text);
          }
        } catch {
          /* ignore */
        }
        return url;
      }, win);

      win.URL.revokeObjectURL = exportFunction(function (url) {
        blobScriptByUrl.delete(String(url));
        return nativeRevokeObjectURL(url);
      }, win);

      originals.blobTrackingPatched = true;
    } catch (e) {
      console.warn("Locatone Blob URL tracking failed", e);
    }
  }

  function installWorkerOverrides(win) {
    if (originals.workerPatched || !originals.Worker) return;
    const NativeWorker = originals.Worker;
    const NativeShared = originals.SharedWorker;

    function constructWorker(NativeCtor, scriptURL, options) {
      if (!config.enabled) {
        return options === undefined
          ? new NativeCtor(scriptURL)
          : new NativeCtor(scriptURL, options);
      }

      const url = String(scriptURL);
      if (url.startsWith("blob:")) {
        const rewrittenUrl = rewriteBlobWorkerUrl(win, url);
        if (rewrittenUrl) {
          return options === undefined
            ? new NativeCtor(rewrittenUrl)
            : new NativeCtor(rewrittenUrl, options);
        }
        console.debug(
          "Locatone Worker rewrite fell back to native blob Worker"
        );
        return options === undefined
          ? new NativeCtor(scriptURL)
          : new NativeCtor(scriptURL, options);
      }

      // http(s) / same-origin workers — mark for background filterResponseData.
      markHttpWorkerScript(win, scriptURL);
      return options === undefined
        ? new NativeCtor(scriptURL)
        : new NativeCtor(scriptURL, options);
    }

    try {
      installBlobUrlTracking(win);

      win.Worker = exportFunction(function LocatoneWorker(scriptURL, options) {
        return constructWorker(NativeWorker, scriptURL, options);
      }, win);

      if (NativeShared) {
        win.SharedWorker = exportFunction(function LocatoneSharedWorker(
          scriptURL,
          options
        ) {
          return constructWorker(NativeShared, scriptURL, options);
        }, win);
      }
      originals.workerPatched = true;
    } catch (e) {
      console.warn("Locatone Worker overrides failed", e);
    }
  }

  function countryFromLocaleTag(locale) {
    const parts = String(locale || "")
      .replace(/_/g, "-")
      .split("-");
    if (parts.length >= 2 && parts[1]) return parts[1].toUpperCase();
    return "";
  }

  function voiceMatchesSpoof(lang, spoofLocale) {
    const voice = String(lang || "")
      .replace(/_/g, "-")
      .toLowerCase();
    const spoof = String(spoofLocale || "")
      .replace(/_/g, "-")
      .toLowerCase();
    const spoofBase = spoof.split("-")[0];
    const spoofCountry = countryFromLocaleTag(spoof).toLowerCase();
    if (!voice) return false;
    if (voice === spoof || voice.startsWith(spoof + "-")) return true;
    if (spoofBase && (voice === spoofBase || voice.startsWith(spoofBase + "-")))
      return true;
    if (spoofCountry && voice.endsWith("-" + spoofCountry)) return true;
    // Always keep generic English voices as soft fallback.
    if (voice === "en" || voice.startsWith("en-") || voice.startsWith("en_"))
      return true;
    return false;
  }

  function installSpeechVoiceFilter(win) {
    if (originals.speechPatched) return;
    try {
      const synth = win.speechSynthesis;
      if (!synth || typeof synth.getVoices !== "function") return;
      const origGetVoices = synth.getVoices.bind(synth);
      synth.getVoices = exportFunction(function () {
        const voices = origGetVoices();
        if (!config.enabled || !config.locale) return voices;
        const spoof = String(config.locale);
        const filtered = [];
        for (let i = 0; i < voices.length; i++) {
          const v = voices[i];
          if (voiceMatchesSpoof(v && v.lang, spoof)) filtered.push(v);
        }
        // If filtering removed everything, fall back to English-only subset.
        if (filtered.length === 0) {
          for (let i = 0; i < voices.length; i++) {
            const v = voices[i];
            const lang = String((v && v.lang) || "").toLowerCase();
            if (lang === "en" || lang.startsWith("en-") || lang.startsWith("en_"))
              filtered.push(v);
          }
        }
        return filtered.length > 0 ? filtered : voices;
      }, win);
      originals.speechPatched = true;
    } catch (e) {
      console.warn("Locatone speech voices filter failed", e);
    }
  }

  function applyIntlToWindow(targetWin) {
    if (!targetWin || !config.enabled) return;
    try {
      const locale = config.locale || "en-US";
      const timezone = config.timezone || "UTC";
      Object.defineProperty(targetWin.navigator, "language", {
        configurable: true,
        enumerable: true,
        get: exportFunction(function () {
          return locale;
        }, targetWin),
      });
      Object.defineProperty(targetWin.navigator, "languages", {
        configurable: true,
        enumerable: true,
        get: exportFunction(function () {
          const arr = new targetWin.Array();
          arr.push(locale);
          arr.push(String(locale).split("-")[0]);
          return arr;
        }, targetWin),
      });
      const origResolved =
        targetWin.Intl.DateTimeFormat.prototype.resolvedOptions;
      targetWin.Intl.DateTimeFormat.prototype.resolvedOptions = exportFunction(
        function () {
          const o = origResolved.call(this);
          try {
            o.timeZone = timezone;
            o.locale = locale;
          } catch {
            /* keep */
          }
          return o;
        },
        targetWin
      );
      targetWin.Date.prototype.getTimezoneOffset = exportFunction(function () {
        const ms = Number(this);
        return getOffsetMinutes(
          timezone,
          Number.isFinite(ms) ? ms : Date.now()
        );
      }, targetWin);
    } catch (e) {
      console.warn("Locatone iframe window patch failed", e);
    }
  }

  function installIframeHardening(win) {
    if (originals.iframePatched) return;
    try {
      const proto = win.HTMLIFrameElement && win.HTMLIFrameElement.prototype;
      if (!proto) return;

      const patchFrame = function (iframe) {
        try {
          const cw = iframe.contentWindow;
          if (cw) applyIntlToWindow(cw);
        } catch {
          /* cross-origin */
        }
      };

      const origAppend = win.Node.prototype.appendChild;
      win.Node.prototype.appendChild = exportFunction(function (child) {
        const result = origAppend.call(this, child);
        try {
          if (
            child &&
            child.tagName &&
            String(child.tagName).toUpperCase() === "IFRAME"
          ) {
            patchFrame(child);
          }
        } catch {
          /* ignore */
        }
        return result;
      }, win);

      const origInsertBefore = win.Node.prototype.insertBefore;
      win.Node.prototype.insertBefore = exportFunction(function (
        child,
        reference
      ) {
        const result = origInsertBefore.call(this, child, reference);
        try {
          if (
            child &&
            child.tagName &&
            String(child.tagName).toUpperCase() === "IFRAME"
          ) {
            patchFrame(child);
          }
        } catch {
          /* ignore */
        }
        return result;
      }, win);

      try {
        const desc = Object.getOwnPropertyDescriptor(proto, "contentWindow");
        if (desc && desc.get) {
          const origGet = desc.get;
          Object.defineProperty(proto, "contentWindow", {
            configurable: true,
            enumerable: true,
            get: exportFunction(function () {
              const cw = origGet.call(this);
              if (cw && config.enabled) {
                try {
                  applyIntlToWindow(cw);
                } catch {
                  /* ignore */
                }
              }
              return cw;
            }, win),
          });
        }
      } catch {
        /* getter redefine may fail */
      }

      originals.iframePatched = true;
    } catch (e) {
      console.warn("Locatone iframe hardening failed", e);
    }
  }

  function installServiceWorkerOverride(win) {
    if (originals.serviceWorkerPatched) return;
    try {
      const container = win.navigator && win.navigator.serviceWorker;
      if (!container || typeof container.register !== "function") return;
      const origRegister = container.register.bind(container);

      /**
       * Return the native register() Promise to the page.
       * Wrapping with an async content-script Promise caused Firefox
       * "Permission denied to access property then" on page .then().
       * Intl spoofing relies on background filterResponseData prelude
       * (always on for locatone-sw-intl-probe; marked URLs otherwise).
       */
      container.register = exportFunction(function (scriptURL, options) {
        let abs = String(scriptURL);
        try {
          abs = new win.URL(String(scriptURL), win.location.href).href;
        } catch {
          /* keep relative */
        }

        if (config.enabled) {
          try {
            browser.runtime.sendMessage({
              type: "locatone:markSwScript",
              url: abs,
            });
          } catch {
            /* ignore */
          }
        }

        if (!config.enabled) {
          return options === undefined
            ? origRegister(scriptURL)
            : origRegister(scriptURL, options);
        }

        const opts = options ? Object.assign({}, options) : {};
        opts.updateViaCache = "none";
        return origRegister(scriptURL, opts);
      }, win);
      originals.serviceWorkerPatched = true;
    } catch (e) {
      console.warn("Locatone ServiceWorker override failed", e);
    }
  }

  function installOrientationStub(win) {
    if (originals.orientationPatched || !originals.windowAddEventListener) {
      return;
    }
    try {
      const origAdd = originals.windowAddEventListener.bind(win);
      const origRemove = originals.windowRemoveEventListener
        ? originals.windowRemoveEventListener.bind(win)
        : null;
      win.addEventListener = exportFunction(function (type, listener, options) {
        if (
          type === "deviceorientation" ||
          type === "deviceorientationabsolute"
        ) {
          return undefined;
        }
        return origAdd(type, listener, options);
      }, win);
      if (origRemove) {
        win.removeEventListener = exportFunction(function (
          type,
          listener,
          options
        ) {
          if (
            type === "deviceorientation" ||
            type === "deviceorientationabsolute"
          ) {
            return undefined;
          }
          return origRemove(type, listener, options);
        }, win);
      }
      try {
        Object.defineProperty(win, "ondeviceorientation", {
          configurable: true,
          enumerable: true,
          get: exportFunction(function () {
            return null;
          }, win),
          set: exportFunction(function () {
            /* swallow */
          }, win),
        });
      } catch {
        /* ignore */
      }
      originals.orientationPatched = true;
    } catch (e) {
      console.warn("Locatone orientation stub failed", e);
    }
  }

  function installNumberFormat(win) {
    if (
      !originals.numberFormatResolvedOptions ||
      originals.numberFormatPatched
    ) {
      return;
    }

    const NativeNF = originals.NumberFormat;
    const origResolved = originals.numberFormatResolvedOptions;

    try {
      win.Intl.NumberFormat.prototype.resolvedOptions = exportFunction(
        function () {
          const o = origResolved.call(this);
          if (!config.enabled || !config.locale) return o;
          const spoof = String(config.locale);
          const isDefault =
            hostDefaultLocale == null ||
            o.locale === hostDefaultLocale ||
            o.locale === spoof;
          if (isDefault) {
            try {
              o.locale = spoof;
            } catch {
              /* keep native */
            }
            if (NativeNF) {
              try {
                const tip = origResolved.call(new NativeNF(spoof));
                if (tip && tip.numberingSystem) {
                  o.numberingSystem = tip.numberingSystem;
                }
              } catch {
                /* keep native numbering */
              }
            }
          }
          return o;
        },
        win
      );
      originals.numberFormatPatched = true;
    } catch (e) {
      console.warn("Locatone NumberFormat resolvedOptions failed", e);
    }
  }

  function fontFamilyFromCss(fontCss) {
    const css = String(fontCss || "");
    const afterSize = css.replace(
      /^\s*(?:(?:italic|oblique|normal|bold|bolder|lighter|\d{1,3})\s+)*[\d.]+(?:px|pt|em|rem|%)?\s+/i,
      ""
    );
    const first = afterSize.split(",")[0] || "";
    return first.replace(/^["']|["']$/g, "").trim();
  }

  function textMatchesProbeScript(text, probeFonts) {
    // Cyrillic / CJK / Hangul / Arabic / Hebrew / Thai / Devanagari heuristics
    // keyed by distinctive probe families so Arial Latin metrics stay intact.
    const t = String(text || "");
    const joined = probeFonts.join(" ").toLowerCase();
    if (/hiragino|yu gothic|yahei|noto sans cjk/.test(joined)) {
      return /[\u3040-\u30ff\u3400-\u9fff]/.test(t);
    }
    if (/gothic neo|malgun|noto sans kr/.test(joined)) {
      return /[\uac00-\ud7af]/.test(t);
    }
    if (/arabic|geeza|naskh/.test(joined) || joined.includes("tahoma")) {
      return /[\u0600-\u06ff]/.test(t);
    }
    if (/hebrew|noto sans hebrew|arial hebrew/.test(joined)) {
      return /[\u0590-\u05ff]/.test(t);
    }
    if (/thonburi|leelawadee|noto sans thai/.test(joined)) {
      return /[\u0e00-\u0e7f]/.test(t);
    }
    if (/nirmala|devanagari/.test(joined)) {
      return /[\u0900-\u097f]/.test(t);
    }
    if (/pt sans|segoe ui|^arial$| arial /.test(" " + joined + " ")) {
      return /[\u0400-\u04ff]/.test(t);
    }
    return false;
  }

  function shouldMaskFontMeasure(family, text, targetCountry) {
    if (!targetCountry || !family) return false;
    const lower = family.toLowerCase();
    for (let i = 0; i < FONT_MASK_PROBES.length; i++) {
      const probe = FONT_MASK_PROBES[i];
      if (probe.countryCodes.indexOf(targetCountry) !== -1) continue;
      let fontHit = false;
      for (let j = 0; j < probe.fonts.length; j++) {
        if (probe.fonts[j].toLowerCase() === lower) {
          fontHit = true;
          break;
        }
      }
      if (fontHit && textMatchesProbeScript(text, probe.fonts)) {
        return true;
      }
    }
    return false;
  }

  function shouldMaskEmoji(text, targetCountry) {
    if (!targetCountry || !text) return false;
    for (let i = 0; i < EMOJI_MASK_PROBES.length; i++) {
      const probe = EMOJI_MASK_PROBES[i];
      if (probe.countryCodes.indexOf(targetCountry) !== -1) continue;
      if (String(text).indexOf(probe.emoji) !== -1) return true;
    }
    return false;
  }

  function installFontMask(win) {
    if (!originals.measureText || originals.fontsPatched) return;
    if (
      !win.CanvasRenderingContext2D ||
      !win.CanvasRenderingContext2D.prototype
    ) {
      return;
    }

    const nativeMeasure = originals.measureText;

    win.CanvasRenderingContext2D.prototype.measureText = exportFunction(
      function (text) {
        const target = targetCountryFromLocale(config.locale);
        const str = String(text == null ? "" : text);
        const family = fontFamilyFromCss(this.font);

        if (shouldMaskFontMeasure(family, str, target)) {
          const prev = this.font;
          try {
            this.font = "16px monospace";
            return nativeMeasure.call(this, str);
          } finally {
            this.font = prev;
          }
        }

        if (shouldMaskEmoji(str, target)) {
          return nativeMeasure.call(this, "\uFFFD");
        }

        return nativeMeasure.call(this, str);
      },
      win
    );

    originals.fontsPatched = true;
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
      const accuracy = accuracyForOptions(options);
      // Build in the page compartment so GeolocationPosition consumers can read fields.
      try {
        const coordsObj = new win.Object();
        coordsObj.latitude = config.lat;
        coordsObj.longitude = config.lng;
        coordsObj.accuracy = accuracy;
        coordsObj.altitude = null;
        coordsObj.altitudeAccuracy = null;
        coordsObj.heading = null;
        coordsObj.speed = null;
        const posObj = new win.Object();
        posObj.coords = coordsObj;
        posObj.timestamp = Date.now();
        return posObj;
      } catch {
        const plain = {
          coords: {
            latitude: config.lat,
            longitude: config.lng,
            accuracy: accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        };
        if (typeof cloneInto === "function") {
          return cloneInto(plain, win, { cloneFunctions: false });
        }
        return plain;
      }
    }

    function makePositionError(message) {
      try {
        const err = new win.Object();
        err.code = 2;
        err.message = message || "Position unavailable";
        err.PERMISSION_DENIED = 1;
        err.POSITION_UNAVAILABLE = 2;
        err.TIMEOUT = 3;
        return err;
      } catch {
        return { code: 2, message: message || "Position unavailable" };
      }
    }

    // Content-script timers — page win.setTimeout will not reliably invoke
    // privileged callbacks (causes eternal GPS hang / "Permission denied").
    const watchIds = new Map();

    const getCurrentPosition = function (success, error, options) {
      setTimeout(() => {
        let delivered = false;
        try {
          if (typeof success === "function") {
            success(successPayload(options));
            delivered = true;
          }
        } catch (err) {
          console.warn("Locatone geolocation success failed", err);
        }
        if (!delivered && typeof error === "function") {
          try {
            error(makePositionError("Locatone could not deliver position"));
          } catch (err2) {
            console.warn("Locatone geolocation error failed", err2);
          }
        }
      }, 1);
    };

    const watchPosition = function (success, error, options) {
      getCurrentPosition(success, error, options);
      const id = Math.floor(Math.random() * 1e9) + 1;
      const timer = setInterval(() => {
        getCurrentPosition(success, error, options);
      }, 5000);
      watchIds.set(id, timer);
      return id;
    };

    const clearWatch = function (id) {
      const timer = watchIds.get(id);
      if (timer != null) {
        clearInterval(timer);
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

    try {
      installOrientationStub(win);
    } catch (e) {
      console.warn("Locatone orientation install failed", e);
    }

    try {
      installDateStringOverrides(win);
    } catch (e) {
      console.warn("Locatone Date string install failed", e);
    }

    try {
      installWorkerOverrides(win);
    } catch (e) {
      console.warn("Locatone Worker install failed", e);
    }

    try {
      installSpeechVoiceFilter(win);
    } catch (e) {
      console.warn("Locatone speech install failed", e);
    }

    try {
      installIframeHardening(win);
    } catch (e) {
      console.warn("Locatone iframe install failed", e);
    }

    try {
      installServiceWorkerOverride(win);
    } catch (e) {
      console.warn("Locatone ServiceWorker install failed", e);
    }

    try {
      installNumberFormat(win);
    } catch (e) {
      console.warn("Locatone NumberFormat install failed", e);
    }

    try {
      installFontMask(win);
    } catch (e) {
      console.warn("Locatone font mask install failed", e);
    }

    clearSessionGpsEcho(win);
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
