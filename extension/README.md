# Locatone

Firefox extension that spoofs where websites think you are — **without requiring a VPN**. Paste decimal coordinates, DMS, or a Google Maps link; Locatone overrides the Geolocation API, timezone/locale, `Date#toString` / Worker Intl, Intl number/currency priors, regional font probes, WebRTC ICE, sensors / deviceorientation, and common client-side IP-geo APIs (including Cloudflare `/cdn-cgi/trace`). Optionally route traffic through your own HTTP/SOCKS5 proxy so the real public IP matches.

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
[web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/).

## Competition fixture

| Role | Place | Decimal |
| --- | --- | --- |
| Truth | Mandirituba - PR | `-25.872917, -49.410583` |
| Spoof | Tallinn, Estonia | `59.457528, 24.697444` |

## Usage

1. Click the Locatone toolbar icon to open the popup, then paste one of:
   - `59.457528, 24.697444`
   - `59°27'27.1"N 24°41'50.8"E`
   - a Google Maps link for Tallinn
2. Click **Apply** (enables spoofing)
3. Reload open tabs so content scripts pick up the new location
4. Optional: set **Proxy** to HTTP or SOCKS5 with a Tallinn-exit if you want server-side `edge_geo` to match

When spoofing is on and proxy is Off, the popup warns that Vercel `edge_geo` still sees your real IP.

## Coverage (vs `./web` forensics)

| Signal | How Locatone handles it |
| --- | --- |
| GPS / Wi‑Fi / Cell (Geolocation API) | Overrides `navigator.geolocation`; coarse accuracy when `enableHighAccuracy: false` |
| Permission state | `permissions.query({ name: "geolocation" })` → `granted` |
| Timezone / locale | Overrides `Date#getTimezoneOffset`, `Intl.DateTimeFormat#resolvedOptions`, `navigator.language(s)` — offset matches IANA shortOffset (no `tz_offset_conflict`) |
| `Date#toString` / `toTimeString` | Rebuilds GMT label + long zone name from spoofed IANA zone |
| Worker Intl / language | Rewrites blob `Worker` / `SharedWorker` scripts with a TZ/locale prelude |
| Currency / numbering (`intl_currency`) | Spoofs `Intl.NumberFormat` default locale + `resolvedOptions`; country region drives EUR/… priors (e.g. Tallinn → `et-EE` → EUR / EE) |
| Regional fonts (`font_locale`) | Best-effort: `CanvasRenderingContext2D#measureText` hides script/emoji probes that conflict with the spoofed country (cannot invent missing OS fonts) |
| Client-side IP lookup APIs | Rewrites responses (ipinfo, ip-api, ipapi.co, geojs, ipwho, …) with plausible country IPs (not TEST-NET) |
| Cloudflare `/cdn-cgi/trace` | Rewrites plain-text `loc` / `ip` / `colo` to spoofed country |
| IP sanity (`ip_sanity`) | Avoids documentation ranges so the site’s TEST-NET detector stays quiet |
| WebRTC ICE / STUN | Privacy `webRTCIPHandlingPolicy=disable_non_proxied_udp` + drop public ICE candidates on `RTCPeerConnection` prototype |
| RTT lateration landmarks | Redirects landmark hosts to packaged `lib/empty.txt` so RTT settles without real region latency (no hard-cancel hang) |
| Keyboard layout | Soft ambiguous QWERTY `getLayoutMap` |
| Prefers-color-scheme | Forced from solar elevation at spoofed lat/lng |
| Magnetometer / barometer / orientation sensors | Constructors stubbed → unsupported |
| Legacy `deviceorientation` | `window.addEventListener` swallows orientation events |
| Session GPS echo | Clears `sessionStorage` key `locatone:last-gps` on apply |
| Server-side IP / Vercel `edge_geo` | **Not fakeable in-browser** — use the optional proxy with a Tallinn exit |

## Proxy notes

- Mode **Off** (default): client forensics (GPS + TZ + IP API rewrite + WebRTC filter) only; your real ISP IP remains visible to servers that do their own geo (including Locatone’s `/api/edge-geo`).
- **HTTP** / **SOCKS5**: when spoofing is enabled, all browser requests use your proxy (`browser.proxy.onRequest`).
- Provide a proxy exit near the spoofed coordinates if you need IP city and GPS city to agree on *server-side* checkers.
- Auth fields are optional; connection failures show up as normal network errors in the tab.

## Test checklist (against `./web`)

1. Apply `59.457528, 24.697444` → popup status shows Tallinn / `Europe/Tallinn` / locale `et-EE` / currency EUR / country EE
2. Start `./web` (`cd web && pnpm dev`), reload the tab after Apply
3. Run **Revelar origem**:
   - `gps` / `network_geo` pins near Tallinn (`network_geo` coarser accuracy)
   - `ip_cloudflare.loc` → `EE`; ipwho / geojs city/coords spoofed; no TEST-NET in `ip_sanity`
   - `timezone` → `Europe/Tallinn` with EE prior
   - `locale` → `et-EE` with EE prior
   - `date_string_tz` → Eastern European label / GMT aligned with Tallinn
   - `worker_intl` → Worker matches page (`Europe/Tallinn` / `et-EE`)
   - `intl_currency` → EUR with EE in country hints
   - `font_locale` → no strong conflicting CJK / Cyrillic / flag priors (JP, BR, …)
   - `webrtc_stun` → no public IP / no real-country pin
   - `orientation_leak` / `compass` → no live heading sample
   - `storage_gps_conflict` → not conflicted (session echo cleared)
   - `tz_offset_conflict` → `mismatch: false`
   - `ip_vs_tz` → not conflicted; fusion **aligned** (client signals)
   - `edge_geo` → unsupported locally; on Vercel deploy without proxy → likely `BR` (site ace)
4. In the page console:
   - `Intl.DateTimeFormat().resolvedOptions().timeZone` → `Europe/Tallinn`
   - `navigator.language` → `et-EE`
   - `new Date().toString()` → GMT+0x00 with Eastern European name
5. (Optional) Point SOCKS5 at a Tallinn exit → confirm `edge_geo` country `EE`

## Limitations

- Cross-origin iframes may not inherit every override equally.
- Already-running page scripts that cached the real timezone need a refresh.
- Obscure IP-geo vendors are not all covered; extend [`lib/ip-mock.js`](lib/ip-mock.js).
- Timezone is inferred from offline geographic regions (good for major areas, not cadastral-perfect).
- True RTT geometry and exit IP still need a nearby proxy; landmark redirects to an empty extension resource stop the `./web` lateration probe from measuring real region latency (without hard-cancel or `data:` CORS stalls).
- Font masking only suppresses conflicting regional probes; it cannot install locale-native fonts the OS lacks.
- Does not change OS location for native apps.
- Same-origin Vercel `edge_geo` cannot be forged without a matching proxy exit.

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
