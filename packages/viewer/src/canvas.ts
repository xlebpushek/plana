import type { Camera, PlanaDocument, SceneObject } from "./model";
import { getWorldTransform, walkVisible } from "./model";

export type RenderOptions = {
  selectedIds?: string[];
  mode?: "edit" | "view";
  showGrid?: boolean;
};

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
) {
  const step = 40;
  const zoom = camera.zoom;
  const offsetX = (-camera.x * zoom) % (step * zoom);
  const offsetY = (-camera.y * zoom) % (step * zoom);

  ctx.save();
  ctx.strokeStyle = "rgba(24, 24, 27, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = offsetX; x < width; x += step * zoom) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = offsetY; y < height; y += step * zoom) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  doc: PlanaDocument,
  obj: SceneObject,
  selected: boolean,
) {
  const t = getWorldTransform(doc, obj.id);
  ctx.save();
  ctx.globalAlpha = obj.style.opacity;
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.scale(t.scaleX, t.scaleY);

  ctx.fillStyle = obj.style.fill;
  ctx.strokeStyle = obj.style.stroke;
  ctx.lineWidth = obj.style.strokeWidth;

  if (obj.type === "rect") {
    const r = Math.min(obj.cornerRadius, obj.width / 2, obj.height / 2);
    if (r > 0) {
      roundRect(ctx, 0, 0, obj.width, obj.height, r);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(0, 0, obj.width, obj.height);
      ctx.strokeRect(0, 0, obj.width, obj.height);
    }
  } else if (obj.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(obj.width / 2, obj.height / 2, obj.width / 2, obj.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (selected && obj.type !== "group") {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5 / Math.max(t.scaleX, 0.0001);
    ctx.setLineDash([6 / t.scaleX, 4 / t.scaleX]);
    const pad = 4 / t.scaleX;
    if (obj.type === "rect" || obj.type === "ellipse") {
      ctx.strokeRect(-pad, -pad, obj.width + pad * 2, obj.height + pad * 2);
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  doc: PlanaDocument,
  width: number,
  height: number,
  options: RenderOptions = {},
) {
  const { selectedIds = [], showGrid = true } = options;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, width, height);

  if (showGrid) drawGrid(ctx, doc.camera, width, height);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(doc.camera.zoom, doc.camera.zoom);
  ctx.translate(-doc.camera.x, -doc.camera.y);

  for (const obj of walkVisible(doc)) {
    drawObject(ctx, doc, obj, selectedIds.includes(obj.id));
  }

  ctx.restore();
}

export function screenToWorld(
  camera: Camera,
  screenX: number,
  screenY: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: (screenX - width / 2) / camera.zoom + camera.x,
    y: (screenY - height / 2) / camera.zoom + camera.y,
  };
}
