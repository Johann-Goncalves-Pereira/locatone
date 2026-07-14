# Locatone

Firefox extension that spoofs where websites think you are — **without requiring a VPN**. Paste decimal coordinates, DMS, or a Google Maps link; Locatone overrides the Geolocation API, timezone/locale, WebRTC ICE, sensors, and common client-side IP-geo APIs (including Cloudflare `/cdn-cgi/trace`). Optionally route traffic through your own HTTP/SOCKS5 proxy so the real public IP matches.

## Install (temporary)

1. Open Firefox → `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select [`manifest.json`](manifest.json) in this folder
4. Click the Locatone toolbar icon

Temporary add-ons are removed when Firefox restarts. For a permanent install, pack/sign via [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) or AMO.

## Usage

1. Paste one of:
   - `59.456619, 24.697315`
   - `59°27'23.8"N 24°41'50.2"E`
   - `https://maps.app.goo.gl/nqMeL4mzgyiVegbk9`
2. Click **Apply** (enables spoofing)
3. Reload open tabs so content scripts pick up the new location
4. Optional: set **Proxy** to HTTP or SOCKS5 if you want the network IP to match the spoofed place

## Coverage (vs `./web` forensics)

| Signal | How Locatone handles it |
| --- | --- |
| GPS / Wi‑Fi / Cell (Geolocation API) | Overrides `navigator.geolocation`; coarse accuracy when `enableHighAccuracy: false` |
| Permission state | `permissions.query({ name: "geolocation" })` → `granted` |
| Timezone / locale | Overrides `Date#getTimezoneOffset`, `Intl.DateTimeFormat#resolvedOptions`, `navigator.language(s)` — offset matches IANA shortOffset (no `tz_offset_conflict`) |
| Client-side IP lookup APIs | Rewrites responses (ipinfo, ip-api, ipapi.co, geojs, ipwho, …) |
| Cloudflare `/cdn-cgi/trace` | Rewrites plain-text `loc` / `ip` / `colo` to spoofed country |
| WebRTC ICE / STUN | Privacy `webRTCIPHandlingPolicy=disable_non_proxied_udp` + drop public ICE candidates on `RTCPeerConnection` prototype |
| RTT lateration landmarks | Cancels requests to gov.br / nasa.gov / bund.de / digital.go.jp / gov.uk |
| Keyboard layout | Soft ambiguous QWERTY `getLayoutMap` |
| Prefers-color-scheme | Forced from solar elevation at spoofed lat/lng |
| Magnetometer / barometer / orientation | Constructors stubbed → unsupported |
| Server-side IP geo | **Not fakeable in-browser** — use the optional proxy |

## Proxy notes

- Mode **Off** (default): client forensics (GPS + TZ + IP API rewrite + WebRTC filter) only; your real ISP IP remains visible to servers that do their own geo.
- **HTTP** / **SOCKS5**: when spoofing is enabled, all browser requests use your proxy (`browser.proxy.onRequest`).
- Provide a proxy exit near the spoofed coordinates if you need IP city and GPS city to agree on *server-side* checkers.
- Auth fields are optional; connection failures show up as normal network errors in the tab.

## Test checklist (against `./web`)

1. Apply `59.456619, 24.697315` → popup status shows Tallinn / `Europe/Tallinn`
2. Start `./web` (`cd web && pnpm dev`), reload the tab after Apply
3. Run **Revelar origem**:
   - `gps` / `network_geo` pins near Tallinn (`network_geo` coarser accuracy)
   - `ip_cloudflare.loc` → `EE`; ipwho / geojs city/coords spoofed
   - `webrtc_stun` → no public IP / no real-country pin
   - `tz_offset_conflict` → `mismatch: false` (Relógio vs fuso IANA consistent)
   - `ip_vs_tz` → not conflicted; fusion **aligned**
4. In the page console: `Intl.DateTimeFormat().resolvedOptions().timeZone` → `Europe/Tallinn`
5. (Optional) Point SOCKS5 at a matching exit → confirm public IP geo on a server-side checker

## Limitations

- Cross-origin iframes may not inherit every override equally.
- Already-running page scripts that cached the real timezone need a refresh.
- Obscure IP-geo vendors are not all covered; extend [`lib/ip-mock.js`](lib/ip-mock.js).
- Timezone is inferred from offline geographic regions (good for major areas, not cadastral-perfect).
- True RTT geometry and exit IP still need a nearby proxy; landmark cancel only stops the `./web` lateration probe from leaking region.
- Does not change OS location for native apps.

## Layout

```
manifest.json
background.js
content/content.js
lib/parse-location.js
lib/timezone.js
lib/ip-mock.js
popup/
icons/
```
