# Locatone

Browser location forensics: run dozens of independent probes (GPS, network geo,
IP providers, WebRTC/STUN, Intl priors, RTT lateration, fonts, keyboard,
compass, magnetometer, barometer, solar theme, clock skew, and conflict checks),
fuse the ones with coordinates, and plot every method on a full-bleed map beside
a transparent evidence panel.

## Stack

- React 19 + TypeScript (strict + `noUncheckedIndexedAccess`)
- Vite (`rolldown-vite`) + React Compiler
- TanStack Router + TanStack Query
- Effect — Schema, Effects, `@effect-atom/atom-react`
- Leaflet + react-leaflet (map)
- Tailwind CSS v4
- Vitest + Testing Library

## Getting started

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` to override STUN / IP lookup bases. Only use the
`VITE_` prefix for values safe to expose in the browser. Locatone v1 is
client-only and uses public APIs (Cloudflare trace, ipwho.is, geojs.io, public
STUN).

## Map & geolocation features

The product lives in `src/features/location/`: Effect Schema signals → probe
runners → weighted fusion → Leaflet map + forensics panel. Optional `?panel=`
(`open` | `closed`) is owned by the page/route; selected probes and scan run id
use Effect Atoms.

### Map (Leaflet)

- Full-viewport dark Carto basemap (OpenStreetMap attribution)
- One colored pin per probe that yields coordinates (or a country-centroid
  fallback marked as approximate)
- Accuracy circles around probes and the fused estimate (large circles only when
  the probe is selected)
- Distinct “fusion” marker for the weighted multi-signal estimate
- Click a pin / circle or a panel card to select/deselect probes; multi-select
  fits the camera to those points
- Auto camera: fly/fit to priority (accurate) points + fusion; Approximate /
  very coarse points stay out of the default fit
- Collapsible “Métodos no mapa” legend (auto-collapsed when the panel opens)
- Scan progress line while probes are collecting

### Signal fusion

- Weighted average of OK signals that have `lat`/`lng` (weight =
  `confidence / accuracyMeters`)
- Soft RTT lateration only enters fusion when its confidence is meaningful
- Falls back to country-centroid intersection when no coordinates exist
- Agreement label: **aligned** | **conflicted** | **sparse**, with confidence
  and contributing `sourceIds`

### Probe catalog

Probes are grouped the same way as the forensics panel.

#### Coordinates

| Probe          | What it does                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `gps`          | High-accuracy Geolocation API (GNSS); may take two samples and keep the better accuracy; persists last OK fix for `storage_echo`   |
| `network_geo`  | Coarse Geolocation (`enableHighAccuracy: false`) — browser Wi‑Fi / cell triangulation, labeled honestly (not a separate Wi‑Fi API) |
| `ip_ipwho`     | ipwho.is geo lookup → lat/lng, city, ISP, timezone hints                                                                           |
| `ip_geojs`     | geojs.io geo JSON → lat/lng + region hints                                                                                         |
| `webrtc_stun`  | WebRTC ICE against configurable STUN; collects reflexive IPv4 + IPv6, then geo-looks up candidates                                 |
| `rtt_probe`    | Multi-endpoint RTT to regional landmarks → soft lateration (weak confidence)                                                       |
| `storage_echo` | Echo of the previous successful GPS fix stored in this session                                                                     |

#### Regional priors

| Probe                | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `ip_cloudflare`      | Cloudflare `/cdn-cgi/trace` edge country / colo (coarse prior)        |
| `timezone`           | IANA timezone → inferred country codes                                |
| `locale`             | `navigator.languages` / resolved locale → language region priors      |
| `intl_currency`      | `Intl` currency / numbering system → regional prior                   |
| `intl_calendar`      | `Intl` calendar system → regional prior                               |
| `font_locale`        | Detect installed regional / emoji font stacks as locale hints         |
| `keyboard_layout`    | Keyboard layout / layout map → region prior                           |
| `referrer_tld`       | Document referrer TLD as a weak origin hint                           |
| `color_scheme_solar` | Preferred color scheme vs expected solar day/night at inferred region |

#### Conflicts

| Probe                | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `magnetometer`       | Device magnetic field vs World Magnetic Model (WMM) bands |
| `tz_offset_conflict` | System clock offset vs claimed IANA timezone              |
| `ip_vs_tz`           | Cross-check IP country(ies) × timezone × locale           |

#### Metadata / sensors

| Probe              | What it does                                                     |
| ------------------ | ---------------------------------------------------------------- |
| `compass`          | Device orientation / heading                                     |
| `barometer`        | Ambient pressure sensor, compared to GPS altitude when available |
| `clock_skew`       | Local clock drift vs remote time                                 |
| `network_info`     | Network Information API connection type (when available)         |
| `permission_state` | Geolocation permission state                                     |

Each signal carries `status` (`ok` | `denied` | `unsupported` | `error`),
`confidence` (0–1), optional coordinates / accuracy, `regionHints`, `summary`,
and `raw` evidence for the panel.

### Forensics UI

- Hero CTA (“Revelar origem”) kicks off a full parallel probe scan
- Panel groups: Coordenadas, Priors regionais, Conflitos, Metadados, Negados
- Per-signal cards with status badge, confidence, accuracy, and expandable raw
- Selecting cards syncs highlight + camera focus on the map
- Panel open/closed persists in the URL via `?panel=`

## Scripts

| Script              | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Local development with HMR + Compiler         |
| `pnpm validate`     | Typecheck + lint + format check + test        |
| `pnpm build`        | `validate` + production build + bundle budget |
| `pnpm check:bundle` | Fail if any JS chunk exceeds 500 kB           |
| `pnpm test`         | Run tests once                                |
| `pnpm test:watch`   | Run tests in watch mode                       |
| `pnpm lint`         | ESLint with zero warnings allowed             |
| `pnpm lint:fix`     | Auto-fix lint issues                          |
| `pnpm format`       | Prettier formatting                           |
| `pnpm format:check` | Prettier check (no write)                     |
| `pnpm tsc`          | TypeScript project check                      |
| `pnpm preview`      | Preview production build                      |

## Project structure

```
src/
├── app/           # App bootstrap, providers, router
├── features/      # Domain modules (api, atoms, components, hooks)
├── components/    # Shared UI primitives
├── lib/           # env validation, api client, external fetch, query client
├── layout/        # Root layout shell
├── pages/         # Thin page composition (owns route wiring)
├── routes/        # TanStack Router file routes (wiring only)
└── test/          # Test utilities
```

Location module layout:

```
src/features/location/
├── api/        # Schemas, IP Effects, query keys/options, search panel param
├── atoms/      # Scan run id + selected signal ids (UI outside the URL)
├── components/ # Map, hero, forensics panel, signal cards
├── hooks/      # useLocationForensics orchestration
├── lib/        # Fusion, map points, RTT lateration, WMM/solar/barometric helpers
└── probes/     # One runner per probe + runAllProbes
```

## Typing conventions

- **Effect Schema first**: define schemas, infer types with `typeof Schema.Type`
- **No duplication**: never create interfaces that mirror schemas
- **Boundaries**: validate env and API responses at the edges
- **Forbidden**: `any`, `enum`, type assertions (`as Type`), Zod, Zustand
- **Allowed**: `as const` (const assertions) and `satisfies`

## State management

| Layer        | Tool                                    |
| ------------ | --------------------------------------- |
| Server/async | TanStack Query + `runApiPromise`        |
| UI/client    | `@effect-atom/atom-react` (`*.atom.ts`) |
| URL          | TanStack Router search params           |

URL/search state belongs in route search params, not Effect Atoms.

## Quality philosophy

- It must be easier to do the right thing than to bypass checks.
- Forbidden: `@ts-ignore`, `eslint-disable`, skipped/focused tests, shipping
  unfinished TODO/FIXME debt.
- Do not change `eslint.config.js` or `tsconfig*.json` to dodge type/lint errors
  unless the user explicitly asks — fix application code instead.
- Code identifiers (variables, types, files, folders) are English only;
  Portuguese is allowed only in UI strings.
- Every task finishes at 100%: types + lint + tests + affected docs +
  `pnpm validate` green.
- If work cannot be completed now, stop and ask — do not accumulate debt.

## AI guidelines

- **Cursor rules**: `.cursor/rules/` (always read `core-standards.mdc`,
  `code-style.mdc`, `no-shortcuts.mdc`, and `english-identifiers.mdc`)
- **Agents**: `AGENTS.md`

## Creating a new feature

1. Create `src/features/<name>/api/<name>.schema.ts` with Effect Schema
2. Add `api/<name>.api.ts` using `@lib/api-client` or `@lib/external-fetch`
3. Add `api/<name>.query-keys.ts` and `api/<name>.queries.ts`
4. Add `atoms/<name>.atom.ts` for non-URL UI state if needed
5. Build components and hooks; export public API from `index.ts`
6. Wire in a page or route — composition only, no business logic

## Quality gates

- GitHub Actions CI: frozen install + `pnpm validate` + production
  `vite build` + `pnpm check:bundle`
- `pnpm validate` = `tsc` + lint + Prettier check + tests
- `pnpm build` also runs validate, then production build + **500 kB per JS
  chunk** budget (`pnpm check:bundle`)
- Vendor libs are split via Rolldown `advancedChunks` (react / tanstack / effect
  / leaflet)
- Husky pre-commit: lint-staged (Prettier + ESLint on staged files)
- Husky pre-push: full `pnpm validate`
- ESLint: `--max-warnings 0`, bans `@ts-*` comments, `eslint-disable`,
  focused/skipped tests, `enum`, TODO/FIXME comments, and Zod/Zustand imports
- Generated `src/routeTree.gen.ts` is ESLint-ignored (TanStack codegen)

## Notes

- Requires Node `^20.19 || ^22.12 || >=24` (see `package.json` `engines`).
- Use Corepack so the pinned `packageManager` (pnpm) is respected.
- Browsers do not expose Wi‑Fi vs cell triangulation separately; Locatone probes
  GPS (high accuracy) and network/coarse geolocation and labels them honestly.
- Public STUN / IP endpoints are rate-limited and opaque; treat IP and RTT
  estimates as weak evidence, not ground truth.
