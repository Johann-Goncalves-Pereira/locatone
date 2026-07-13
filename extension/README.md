# Locatone

Firefox extension that spoofs where websites think you are — **without requiring a VPN**. Paste decimal coordinates, DMS, or a Google Maps link; Locatone overrides the Geolocation API, timezone/locale, and common client-side IP-geo APIs. Optionally route traffic through your own HTTP/SOCKS5 proxy so the real public IP matches.

## Install (temporary)

1. Open Firefox → `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `[manifest.json](manifest.json)` in this folder
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



## Coverage


| Signal                               | How Locatone handles it                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| GPS / Wi‑Fi / Cell (Geolocation API) | Overrides `navigator.geolocation` + `permissions.query`                                         |
| Timezone / locale                    | Overrides `Date#getTimezoneOffset`, `Intl.DateTimeFormat#resolvedOptions`, `navigator.language` |
| Client-side IP lookup APIs           | Rewrites responses from known hosts (ipinfo, ip-api, ipapi.co, geojs, …)                        |
| Server-side IP geo                   | **Not fakeable in-browser** — use the optional proxy                                            |




## Proxy notes

- Mode **Off** (default): Geolocation + timezone + IP-API rewrite only; your real ISP IP remains visible to servers.
- **HTTP** / **SOCKS5**: when spoofing is enabled, all browser requests use your proxy (`browser.proxy.onRequest`).
- Provide a proxy exit near the spoofed coordinates if you need IP city and GPS city to agree.
- Auth fields are optional; connection failures show up as normal network errors in the tab.



## Test checklist

1. Apply `59.456619, 24.697315` → status shows Tallinn / `Europe/Tallinn`
2. Open a [geolocation tester](https://browserleaks.com/geo) → lat/lng match
3. In the page console: `Intl.DateTimeFormat().resolvedOptions().timeZone` → `Europe/Tallinn`
4. Hit a client-side demo that calls `ipinfo.io` / `ip-api.com` → city/coords spoofed
5. (Optional) Point SOCKS5 at a matching exit → confirm public IP geo on a server-side checker



## Limitations

- Cross-origin iframes may not inherit overrides.
- Already-running page scripts that cached the real timezone need a refresh.
- Obscure IP-geo vendors are not all covered; extend `[lib/ip-mock.js](lib/ip-mock.js)`.
- Timezone is inferred from offline geographic regions (good for major areas, not cadastral-perfect).
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

