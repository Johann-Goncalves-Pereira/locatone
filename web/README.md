# Locatone

Forense de localização no navegador: coleta múltiplos sinais (GPS, rede, IP,
WebRTC, Intl, latência e outros) e mostra um ponto fundido no mapa com um painel
transparente de cada método.

## Stack

- React 19 + TypeScript (strict + `noUncheckedIndexedAccess`)
- Vite (`rolldown-vite`) + React Compiler
- TanStack Router + TanStack Query
- Effect — Schema, Effects, `@effect-atom/atom-react`
- Leaflet + react-leaflet (mapa)
- Tailwind CSS v4
- Vitest + Testing Library

## Getting started

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` to override STUN / IP lookup bases. Only use the
`VITE_` prefix for values safe to expose in the browser. Locatone v1 is
client-only and uses public APIs (Cloudflare trace, ipwho.is, public STUN).

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

See `src/features/location/` for the location forensics feature: Effect Schema
signals → probe runners → fusion → map + forensics panel. Optional `?panel=`
search param is owned by the page/route.

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
