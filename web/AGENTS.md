# AGENTS.md

Guia para agentes de AI trabalhando neste repositório.

## Stack

- React 19 + TypeScript (strict)
- Vite (`rolldown-vite`) + React Compiler (dev + production Vite; plugin RC)
- TanStack Router + TanStack Query
- Effect (`effect/Schema` + `Effect` + `@effect-atom/atom-react`)
- Leaflet + react-leaflet
- Tailwind CSS v4
- Vitest + Testing Library

A feature `location` é o produto: forense multi-sinal (GPS, geo de rede, IP,
WebRTC/STUN, Intl, RTT, fontes, bússola, conflitos) com fusão no mapa e painel
de evidências. Densidade de UI local (painel selecionado, último GPS da sessão)
usa Atom; `?panel=` fica na URL.

## Comandos

```bash
pnpm dev # desenvolvimento (Compiler ligado)
pnpm validate # tsc + lint + format:check + test
pnpm build # validate + build de produção + check:bundle
pnpm format:check # Prettier --check
pnpm test # testes
pnpm lint:fix # corrigir lint
```

## Regras obrigatórias

Leia `.cursor/rules/` — especialmente `core-standards.mdc`, `code-style.mdc`,
`no-shortcuts.mdc` e `english-identifiers.mdc` (sempre ativas).

### Filosofia de qualidade

- É mais fácil fazer certo do que contornar tipagem, lint ou testes.
- Proibido: `@ts-ignore`, `eslint-disable`, pular testes, deixar dívida técnica.
- Não altere `eslint.config.js` / `tsconfig*.json` para manobrar erros — só se o
  usuário pedir explicitamente; corrija o código da aplicação.
- Identificadores no código só em inglês (português só em strings de UI).
- Toda tarefa termina a 100%: tipagem + lint + testes + docs afetadas +
  `pnpm validate` verde.
- Se não der para concluir agora, pare e pergunte — não deixe “para depois”.

### Nunca faça

- `any`, `enum`, type assertions (`as Type`), non-null assertion (`!`)
- `@ts-ignore` / `@ts-expect-error` / `eslint-disable`
- Afrouxar ESLint/tsconfig para “passar” tipagem sem pedido explícito
- Nomes de variáveis/funções/tipos/pastas em português
- Duplicar tipos que já existem em Effect Schema
- Introduzir Zod ou Zustand
- Lógica de negócio em `routes/` ou `pages/`
- Imports relativos `../` em routes, pages, app, layout
- Estado de servidor em Atoms (use TanStack Query)
- Estado de URL/search em Atoms (use search params da rota)
- Ignorar erros de ESLint ou TypeScript
- Entregar trabalho parcial com TODO/FIXME de dívida

### Sempre faça

- Schema Effect primeiro → `type X = typeof XSchema.Type`
- `as const` é permitido (const assertion); `as Foo` não
- Validar env (`@lib/env`) e API (`@lib/api-client` / `@lib/external-fetch`) nas
  fronteiras com Schema
- API como `Effect`; bridge para Query com `runApiPromise` (preserva AbortError)
- Colocar features em `src/features/<nome>/` com `index.ts` como API pública
- Query keys factory em `*.query-keys.ts` (chave estável; filtre com `select`)
- `queryOptions()` em `*.queries.ts`
- Atoms por feature só para estado de UI que **não** pertence à URL
- Página/rota possui wiring de search params; feature recebe props
- Rodar `pnpm validate` após mudanças

## Criar uma nova feature

1. `src/features/<nome>/api/<nome>.schema.ts` — Effect Schema
2. `api/<nome>.api.ts` — Effects HTTP com `Schema.decodeUnknown`
3. `api/<nome>.query-keys.ts` + `api/<nome>.queries.ts`
4. `atoms/<nome>.atom.ts` se houver estado de UI fora da URL
5. `components/`, `hooks/`, `index.ts`
6. Conectar em `pages/` ou rota — apenas composição

## Estrutura

```
src/
 app/ # bootstrap, providers, router
 features/ # domínio (api, atoms, components, hooks)
 components/ # UI compartilhada
 lib/ # env, api-client, external-fetch, query-client
 layout/ # shell visual
 pages/ # composição fina (wiring de URL)
 routes/ # wiring TanStack Router
```

## Qualidade remota

- CI (GitHub Actions): install com lockfile congelado + `pnpm validate` +
  `vite build` + `check:bundle`
- Husky: pre-commit = lint-staged; pre-push = `pnpm validate`
- `pnpm build` falha se algum chunk JS passar de 500 kB (`check:bundle`)
- Vendors separados via Rolldown `advancedChunks` (react / tanstack / effect /
  leaflet)
- `src/routeTree.gen.ts` é gerado e ignorado pelo ESLint
