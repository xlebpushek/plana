# Plana

Цельная библиотека для 3D-плана квартиры.

- `@plana/core` — документ и геометрия без React.
- `@plana/react` — единственная точка импорта UI: viewer и editor плюс общий Effector-стор внутри пакета.

Viewer отдаёт экран через `ViewerProvider` и контролы вида. Editor отдаёт сайдбары и кнопки манипуляции объектами; ему обязателен `ViewerProvider`. Общий стор не экспортируется: он живёт внутри `@plana/react` (fork на каждый провайдер).

`apps/demo` — пример хоста и сборка для GitHub Pages. Сцена квартиры лежит в `apps/demo/apartment.json` и не генерируется скриптом.

```tsx
import {
  ViewerProvider,
  Viewport,
  FrameButton,
  ViewHint,
  EditorProvider,
  Hierarchy,
  Inspector,
  HistoryButtons,
  ImportExportButtons,
  CreateObjectButton,
} from "@plana/react";
import "@plana/react/styles.css";

<ViewerProvider document={apartment}>
  <EditorProvider>
    <Hierarchy />
    <Viewport />
    <Inspector />
  </EditorProvider>
</ViewerProvider>
```

```bash
pnpm install
pnpm dev
```
