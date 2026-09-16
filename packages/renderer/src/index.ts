export {
  buildFloorMesh,
  buildRenderMesh,
  buildWallMesh,
  WORLD_FROM_MM,
} from "./mesh.js";
export type { EdgeKind, RenderMesh, WallMeshOptions } from "./mesh.js";
export { PlanaRenderer } from "./PlanaRenderer.js";
export type { RendererSelection } from "./PlanaRenderer.js";
export {
  collectWallSegments,
  computeWallEndCapHiding,
  pointInWallFootprint,
} from "./walls.js";
export type { WallEndCaps, WallWorldSegment } from "./walls.js";
