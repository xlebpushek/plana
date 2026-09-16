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

## Develop

```bash
pnpm install
pnpm --filter @plana/core test
pnpm --filter @plana/editor dev
```

Preview build:

```bash
pnpm --filter @plana/editor preview:build
pnpm --filter @plana/editor preview
```
