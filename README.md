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

**https://xlebpushek.github.io/plana/**

Один раз в Settings → Pages:
1. **Source:** Deploy from a branch
2. **Branch:** `gh-pages`
3. **Folder:** `/ (root)`
4. Save

Дальше каждый push в `main` обновляет `gh-pages` через Actions.

## Develop

```bash
pnpm install
pnpm --filter @plana/core test
pnpm --filter @plana/editor dev
```
