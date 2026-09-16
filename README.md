# Plana

Низкоуровневый 3D engine + React UI для планировок квартир/домов.

## Packages

```
editor → viewer → renderer → core
```

- `@plana/core` — document/object/geometry/style/serialization (Zod, mm, без Three/React)
- `@plana/renderer` — Three.js CAD renderer (transparent faces + colored edges)
- `@plana/viewer` — React viewport (orbit/pan/zoom/selection)
- `@plana/editor` — editor shell поверх Viewer

## Demo (GitHub Pages)

Постоянная ссылка:

**https://xlebpushek.github.io/plana/**

Деплой: каждый push в `main` → GitHub Actions → Pages.

В настройках репозитория один раз: **Settings → Pages → Source: GitHub Actions**.  
Для публичного доступа без логина репозиторий должен быть **Public** (или GitHub Pro для Pages из private).

## Develop

```bash
pnpm install
pnpm --filter @plana/core test
pnpm --filter @plana/editor dev
```
