# Locatone

Firefox extension that spoofs where websites think you are. Paste decimal
coordinates, DMS, or a Google Maps link; Locatone overrides the Geolocation API,
timezone/locale, `Date#toString` / Worker + Service Worker Intl,
`Accept-Language`, speech voices, iframe Intl, Intl number/currency priors,
regional font probes, WebRTC ICE, sensors / deviceorientation, and common
client-side IP-geo APIs (including Cloudflare `/cdn-cgi/trace`). Optionally route
traffic through your own HTTP/SOCKS5 proxy (or use a system VPN) so the real
public exit IP matches the spoofed place.

## Install (Zen Browser)

Sideload permanently into your Zen profile (unsigned local add-on):

```bash
./extension/sync-zen.sh
```

That builds an unpacked copy, points the profile at it, and **restarts Zen** if it is
running (required — replacing an open `.xpi` leaves a stale JAR and the toolbar
popup shows “File not found”).

The Locatone toolbar icon opens the **native browser_action popup** (anchored under
the icon, like other extensions). If you see “File not found” instead, re-run
`./extension/sync-zen.sh` so Zen restarts with a fresh unpacked install — do not
work around it by opening a separate window.

After you change code:

```bash
./extension/sync-zen.sh            # rebuild + restart Zen when open
./extension/sync-zen.sh --no-restart  # write files only; restart Zen yourself
```

Options:

```bash
./extension/sync-zen.sh --profile /path/prof  # force a profile path
ZEN_PROFILE=/path/prof ./extension/sync-zen.sh
```

The script sets `xpinstall.signatures.required=false` (and related prefs) in the
profile’s `user.js` so Zen can load this local unsigned add-on.

## Install (temporary Firefox / Zen)

1. Open the browser → `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select [`manifest.json`](manifest.json) in this folder
4. Click the Locatone toolbar icon — the UI opens as a **toolbar popup**, not a separate window

Temporary add-ons are removed when the browser restarts. For AMO/signing, pack via
[web-ext](https://extensionworkshop.com/documentation/developing/getting-started-with-web-ext/).

## Usage

1. Click the Locatone toolbar icon
2. Paste decimal coords, DMS, or a Google Maps link (example: `59.457528, 24.697444`)
3. Click **Apply** (enables spoofing)
4. Reload open tabs so content scripts pick up the new location
5. Optional: set **Proxy** to HTTP or SOCKS5 with an exit near the spoofed coordinates
   if you need server-side `edge_geo` to match (or use a system VPN to that region)

When spoofing is on and proxy is Off, the popup warns that Vercel `edge_geo` still
sees your real ISP exit unless a matching VPN/proxy is already in use.

## Coverage (vs `./web` forensics)

| Signal | How Locatone handles it |
| --- | --- |
| GPS / Wi‑Fi / Cell (Geolocation API) | Overrides `navigator.geolocation`; coarse accuracy when `enableHighAccuracy: false` |
| Permission state | `permissions.query({ name: "geolocation" })` → `granted` |
| Timezone / locale | Overrides `Date#getTimezoneOffset`, `Intl.DateTimeFormat#resolvedOptions`, `navigator.language(s)` — offset matches IANA shortOffset (no `tz_offset_conflict`) |
| `Date#toString` / `toTimeString` | Rebuilds GMT label + long zone name from spoofed IANA zone |
| Worker Intl / language | Rewrites blob `Worker` / `SharedWorker` via tracked blob source + prelude; HTTP(S) Workers marked for `filterResponseData` rewrite |
| Service Worker Intl | Marks SW script URLs + `filterResponseData` prelude; synthesizes spoofed Intl `message` on `ServiceWorker#postMessage` when Firefox skips the rewrite |
| Iframe Intl | Hardens `appendChild` / `contentWindow` so `about:blank` races get spoofed Intl |
| `Accept-Language` | Rewrites request header from spoofed locale via `webRequest.onBeforeSendHeaders` |
| Speech voices | Filters `speechSynthesis.getVoices()` to spoof + English locales |
| Currency / numbering (`intl_currency`) | Spoofs `Intl.NumberFormat` default locale + `resolvedOptions` |
| Regional fonts (`font_locale`) | Best-effort: `CanvasRenderingContext2D#measureText` hides script/emoji probes that conflict with the spoofed country (cannot invent missing OS fonts) |
| Client-side IP lookup APIs | Rewrites responses (ipinfo, ip-api, ipapi.co, geojs, ipwho, seeip, geoiplookup, …) with plausible country IPs (not TEST-NET) |
| Cloudflare `/cdn-cgi/trace` | Rewrites plain-text `loc` / `ip` / `colo` to spoofed country |
| IP sanity (`ip_sanity`) | Avoids documentation ranges so the site’s TEST-NET detector stays quiet |
| WebRTC ICE / STUN | Privacy `webRTCIPHandlingPolicy=disable_non_proxied_udp` + drop public ICE candidates on `RTCPeerConnection` prototype |
| RTT lateration landmarks | Redirects landmark hosts (gov.br, bcb, serpro, camara, nasa, bund, …) to packaged `lib/empty.txt` so RTT settles without real region latency |
| Keyboard layout | Soft ambiguous QWERTY `getLayoutMap` |
| Prefers-color-scheme | Forced from solar elevation at spoofed lat/lng |
| Magnetometer / barometer / orientation sensors | Constructors stubbed → unsupported |
| Legacy `deviceorientation` | `window.addEventListener` swallows orientation events |
| Session GPS echo | Clears `sessionStorage` key `locatone:last-gps` on apply |
| Server-side IP / Vercel `edge_geo` | **Not fakeable in-browser** — use a VPN or the optional proxy with an exit near the spoof |

## Proxy notes

- Mode **Off** (default): client forensics only; your real ISP IP remains visible to
  servers that do their own geo (including Locatone’s `/api/edge-geo`) unless you
  already exit via a matching system VPN.
- **HTTP** / **SOCKS5**: when spoofing is enabled, all browser requests use your proxy (`browser.proxy.onRequest`).
- Provide a proxy exit near the spoofed coordinates if you need IP city and GPS city to agree on *server-side* checkers without a system VPN.
- Auth fields are optional; connection failures show up as normal network errors in the tab.

## Test checklist (against `./web`)

1. Apply any spoofed coordinates (example: `59.457528, 24.697444`) → popup shows enriched timezone / locale / country
2. Start `./web` (`cd web && pnpm dev`), reload the tab after Apply
3. Run **Revelar origem** and confirm GPS / Intl / Accept-Language / Worker / Service Worker / speech / IP mocks align with the spoof; `edge_geo` matches only with a matching VPN/proxy exit
4. In the page console, check `Intl.DateTimeFormat().resolvedOptions().timeZone` and `navigator.language` match the spoof

## Limitations

- Cross-origin iframes may not inherit every override equally.
- Already-running page scripts that cached the real timezone need a refresh.
- Obscure IP-geo vendors are not all covered; extend [`lib/ip-mock.js`](lib/ip-mock.js).
- Timezone is inferred from offline geographic regions (good for major areas, not cadastral-perfect).
- True RTT geometry and exit IP still need a nearby VPN/proxy; landmark redirects to an empty extension resource stop the `./web` lateration probe from measuring real region latency (without hard-cancel or `data:` CORS stalls).
- Font masking only suppresses conflicting regional probes; it cannot install locale-native fonts the OS lacks.
- Does not change OS location for native apps.
- Same-origin Vercel `edge_geo` cannot be forged without a matching exit IP (VPN or proxy).

## Layout

```
manifest.json
sync-zen.sh          # install/update into Zen Browser
background.js
content/content.js
lib/parse-location.js
lib/timezone.js
lib/ip-mock.js
popup/
icons/
```
