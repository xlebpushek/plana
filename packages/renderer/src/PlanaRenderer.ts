import {
  type Color,
  type ObjectId,
  type PlanaDocument,
  type PlanaObject,
  resolveObjectStyle,
  selectionEdgeColor,
} from "@plana/core";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { WORLD_FROM_MM, buildRenderMesh, type WallMeshOptions } from "./mesh.js";
import {
  clipEdgesInsideWalls,
  collectWallSegments,
  computeRoomCornerVerticals,
  computeWallEndCapHiding,
  type WallEndCaps,
  type WallWorldSegment,
} from "./walls.js";

export type RendererSelection = {
  selectedIds: ObjectId[];
  activeId?: ObjectId;
};

type ObjectRuntime = {
  objectId: ObjectId;
  group: THREE.Group;
  geometryKey: string;
  face?: THREE.Mesh;
  edge?: THREE.LineSegments;
};

function colorFromRgba(color: { r: number; g: number; b: number }) {
  return new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
}

function geometryKey(object: PlanaObject, wallOpts?: WallMeshOptions): string {
  const base = object.geometry ? JSON.stringify(object.geometry) : "";
  if (!wallOpts) return base;
  return `${base}|m${wallOpts.mode ?? "corners"}|s${wallOpts.hideStartSeam ? 1 : 0}|e${wallOpts.hideEndSeam ? 1 : 0}`;
}

function hitPriority(type: string): number {
  if (type === "door" || type === "window" || type === "opening") return 0;
  if (
    type === "plant" ||
    type === "flower" ||
    type === "tree" ||
    type === "sofa" ||
    type === "table" ||
    type === "chair" ||
    type === "bed" ||
    type === "shelving" ||
    type === "furniture" ||
    type === "decor"
  ) {
    return 1;
  }
  if (type === "wall" || type === "floor") return 3;
  return 2;
}

export class PlanaRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly webgl: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private readonly root = new THREE.Group();
  private readonly runtimes = new Map<ObjectId, ObjectRuntime>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private frame = 0;
  private disposed = false;
  private selection: RendererSelection = { selectedIds: [] };
  private onSelect?: (id?: ObjectId) => void;
  private document: PlanaDocument | null = null;
  private wallCaps = new Map<string, WallEndCaps>();
  private wallSegments: WallWorldSegment[] = [];
  private pointerDown: { x: number; y: number } | null = null;
  private roomCorners?: THREE.LineSegments;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(8, -7, 6);

    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webgl.setClearColor("#09090b", 1);
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color("#09090b");
    this.scene.fog = new THREE.Fog("#09090b", 20, 50);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(4, -6, 10);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-6, 5, 3);
    this.scene.add(fill);
    this.scene.add(this.root);

    const grid = new THREE.GridHelper(20, 40, "#27272a", "#18181b");
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(3.2, 3.0, 1.0);
    this.controls.maxPolarAngle = Math.PI * 0.495;

    // Prefer face hits; threshold helps thin geometry.
    this.raycaster.params.Line = { threshold: 0.02 };

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    this.loop();
  }

  setSelectHandler(handler?: (id?: ObjectId) => void) {
    this.onSelect = handler;
  }

  setSelection(selection: RendererSelection) {
    const prev = this.selection.selectedIds;
    this.selection = selection;
    if (!this.document) return;
    const touched = new Set([...prev, ...selection.selectedIds]);
    for (const id of touched) {
      const object = this.document.objects[id];
      const runtime = this.runtimes.get(id);
      if (!object || !runtime) continue;
      if (object.type !== "wall" && object.geometry?.type !== "wall") continue;
      this.disposeRuntimeMeshes(runtime);
      this.rebuildMeshes(runtime, object);
      runtime.geometryKey = geometryKey(object, this.wallMeshOptions(object.id));
    }
    this.syncStyles(this.document);
  }

  setDocument(document: PlanaDocument) {
    this.document = document;
    this.wallSegments = collectWallSegments(document);
    this.wallCaps = computeWallEndCapHiding(this.wallSegments);
    this.rebuildRoomCorners(document);
    const keep = new Set<ObjectId>();

    const visit = (id: ObjectId, parent: THREE.Object3D) => {
      const object = document.objects[id];
      if (!object) return;
      keep.add(id);

      let runtime = this.runtimes.get(id);
      const key = geometryKey(object, this.wallMeshOptions(id));
      if (!runtime) {
        runtime = this.createRuntime(object);
        this.runtimes.set(id, runtime);
      } else if (runtime.geometryKey !== key) {
        this.disposeRuntimeMeshes(runtime);
        this.rebuildMeshes(runtime, object);
        runtime.geometryKey = key;
      }

      if (runtime.group.parent !== parent) parent.add(runtime.group);
      this.applyTransform(runtime.group, object);
      this.applyStyle(runtime, object, document);

      for (const childId of object.children ?? []) visit(childId, runtime.group);
    };

    visit(document.root, this.root);

    for (const [id, runtime] of this.runtimes) {
      if (keep.has(id)) continue;
      runtime.group.removeFromParent();
      this.disposeRuntimeMeshes(runtime);
      this.runtimes.delete(id);
    }
  }

  resize(width: number, height: number) {
    const w = Math.max(width, 1);
    const h = Math.max(height, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.webgl.setSize(w, h, false);
  }

  private wallMeshOptions(id: ObjectId): WallMeshOptions | undefined {
    const object = this.document?.objects[id];
    if (!object || object.geometry?.type !== "wall") return undefined;
    const selected = this.selection.selectedIds.includes(id);
    if (selected) return { mode: "full", hideStartSeam: false, hideEndSeam: false };
    const caps = this.wallCaps.get(id);
    return {
      mode: "corners",
      hideStartSeam: caps?.hideStartSeam ?? false,
      hideEndSeam: caps?.hideEndSeam ?? false,
    };
  }

  private createRuntime(object: PlanaObject): ObjectRuntime {
    const group = new THREE.Group();
    group.name = object.id;
    group.userData.planaId = object.id;
    const runtime: ObjectRuntime = {
      objectId: object.id,
      group,
      geometryKey: geometryKey(object, this.wallMeshOptions(object.id)),
    };
    this.rebuildMeshes(runtime, object);
    return runtime;
  }

  private rebuildMeshes(runtime: ObjectRuntime, object: PlanaObject) {
    if (!object.geometry) return;
    const mesh = buildRenderMesh(object.geometry, this.wallMeshOptions(object.id));
    if (!mesh) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    if (mesh.normals) geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    if (mesh.indices) geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const face = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      }),
    );
    face.userData.planaId = object.id;
    face.userData.planaPick = true;
    runtime.group.add(face);
    runtime.face = face;

    const edges =
      object.geometry.type === "wall" && mesh.edges
        ? this.clipWallEdges(mesh.edges, object)
        : mesh.edges;

    if (edges && edges.length > 0) {
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute("position", new THREE.BufferAttribute(edges, 3));
      const edge = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ transparent: true, depthTest: true }),
      );
      edge.userData.planaId = object.id;
      edge.raycast = () => undefined;
      runtime.group.add(edge);
      runtime.edge = edge;
    }
  }

  /** Wall edges are local metres; junctions are plan mm. */
  private clipWallEdges(edges: Float32Array, object: PlanaObject): Float32Array {
    if (this.wallSegments.length < 2) return edges;
    const [ox, oy, oz] = object.transform.position;
    const mm = new Float32Array(edges.length);
    for (let i = 0; i < edges.length; i += 3) {
      mm[i] = edges[i] / WORLD_FROM_MM + ox;
      mm[i + 1] = edges[i + 1] / WORLD_FROM_MM + oy;
      mm[i + 2] = edges[i + 2] / WORLD_FROM_MM + oz;
    }
    const clipped = clipEdgesInsideWalls(mm, object.id, this.wallSegments);
    const out = new Float32Array(clipped.length);
    for (let i = 0; i < clipped.length; i += 3) {
      out[i] = (clipped[i] - ox) * WORLD_FROM_MM;
      out[i + 1] = (clipped[i + 1] - oy) * WORLD_FROM_MM;
      out[i + 2] = (clipped[i + 2] - oz) * WORLD_FROM_MM;
    }
    return out;
  }

  private applyTransform(group: THREE.Group, object: PlanaObject) {
    const [x, y, z] = object.transform.position;
    const [qx, qy, qz, qw] = object.transform.rotation;
    const [sx, sy, sz] = object.transform.scale;
    group.position.set(x * WORLD_FROM_MM, y * WORLD_FROM_MM, z * WORLD_FROM_MM);
    group.quaternion.set(qx, qy, qz, qw);
    group.scale.set(sx, sy, sz);
  }

  private nearbyEdgeColors(document: PlanaDocument, objectId: ObjectId): Color[] {
    const colors: Color[] = [];
    for (const [id, object] of Object.entries(document.objects)) {
      if (id === objectId || id === document.root) continue;
      if (!object.geometry) continue;
      const style = resolveObjectStyle(object.type, object.style);
      if (style.edge?.color) colors.push(style.edge.color);
      if (colors.length >= 24) break;
    }
    return colors;
  }

  private applyStyle(runtime: ObjectRuntime, object: PlanaObject, document: PlanaDocument) {
    const selected = this.selection.selectedIds.includes(object.id);
    const style = resolveObjectStyle(object.type, object.style);

    if (runtime.face && style.face) {
      const mat = runtime.face.material as THREE.MeshLambertMaterial;
      mat.color = colorFromRgba(style.face.color);
      const opacity = style.face.visible ? style.face.opacity : 0;
      mat.opacity = selected && opacity > 0 ? Math.min(1, opacity + 0.12) : opacity;
      // Solid objects (furniture, plants) stay opaque so volume reads correctly.
      mat.transparent = opacity < 0.95;
      mat.depthWrite = opacity >= 0.95;
      // Keep a tiny alpha for raycast stability on "invisible" CAD walls.
      mat.colorWrite = opacity > 0.001 || object.type === "wall";
      if (object.type === "wall" && opacity < 0.001) mat.opacity = 0.001;
      runtime.face.visible = true;
      runtime.face.raycast = THREE.Mesh.prototype.raycast;
    }

    if (runtime.edge && style.edge) {
      const mat = runtime.edge.material as THREE.LineBasicMaterial;
      if (selected) {
        const accent = selectionEdgeColor(
          style.edge.color,
          this.nearbyEdgeColors(document, object.id),
        );
        mat.color = colorFromRgba(accent);
      } else {
        mat.color = colorFromRgba(style.edge.color);
      }
      mat.opacity = style.edge.opacity;
      mat.visible = style.edge.visible;
      runtime.edge.visible = style.edge.visible;
      runtime.edge.renderOrder = selected ? 10 : 0;
    }
  }

  private syncStyles(document: PlanaDocument) {
    for (const [id, runtime] of this.runtimes) {
      const object = document.objects[id];
      if (object) this.applyStyle(runtime, object, document);
    }
  }

  private disposeRuntimeMeshes(runtime: ObjectRuntime) {
    if (runtime.face) {
      runtime.face.geometry.dispose();
      (runtime.face.material as THREE.Material).dispose();
      runtime.face.removeFromParent();
      runtime.face = undefined;
    }
    if (runtime.edge) {
      runtime.edge.geometry.dispose();
      (runtime.edge.material as THREE.Material).dispose();
      runtime.edge.removeFromParent();
      runtime.edge = undefined;
    }
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.onSelect || !this.pointerDown || event.button !== 0) {
      this.pointerDown = null;
      return;
    }
    const dx = event.clientX - this.pointerDown.x;
    const dy = event.clientY - this.pointerDown.y;
    this.pointerDown = null;
    if (dx * dx + dy * dy > 25) return;
    if (!this.document) return;

    const rect = this.webgl.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const faces: THREE.Object3D[] = [];
    for (const runtime of this.runtimes.values()) {
      if (runtime.face) faces.push(runtime.face);
    }
    const hits = this.raycaster.intersectObjects(faces, false);
    if (!hits.length) {
      this.onSelect(undefined);
      return;
    }

    const typeOf = (hit: THREE.Intersection) =>
      this.document?.objects[String(hit.object.userData.planaId ?? "")]?.type ?? "";

    // Prefer non-floor hits: large slabs steal clicks under a downward camera.
    const nonFloor = hits.filter((h) => typeOf(h) !== "floor");
    const pool = nonFloor.length > 0 ? nonFloor : hits;

    pool.sort((a, b) => {
      const distDelta = a.distance - b.distance;
      // Within ~8 cm prefer openings/furniture over walls (coplanar overlaps).
      if (Math.abs(distDelta) > 0.08) return distDelta;
      return hitPriority(typeOf(a)) - hitPriority(typeOf(b));
    });

    const id = pool[0]?.object.userData.planaId as ObjectId | undefined;
    this.onSelect(id);
  };

  private rebuildRoomCorners(document: PlanaDocument) {
    if (this.roomCorners) {
      this.roomCorners.geometry.dispose();
      (this.roomCorners.material as THREE.Material).dispose();
      this.roomCorners.removeFromParent();
      this.roomCorners = undefined;
    }
    const corners = computeRoomCornerVerticals(this.wallSegments);
    if (!corners.length) return;
    const positions: number[] = [];
    for (const c of corners) {
      positions.push(c.x * WORLD_FROM_MM, c.y * WORLD_FROM_MM, c.z0 * WORLD_FROM_MM);
      positions.push(c.x * WORLD_FROM_MM, c.y * WORLD_FROM_MM, c.z1 * WORLD_FROM_MM);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(245 / 255, 245 / 255, 245 / 255),
      transparent: true,
      opacity: 0.95,
      depthTest: true,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.raycast = () => undefined;
    lines.renderOrder = 5;
    this.scene.add(lines);
    this.roomCorners = lines;
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    this.controls.update();
    this.webgl.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.webgl.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.webgl.domElement.removeEventListener("pointerup", this.handlePointerUp);
    this.controls.dispose();
    if (this.roomCorners) {
      this.roomCorners.geometry.dispose();
      (this.roomCorners.material as THREE.Material).dispose();
      this.roomCorners.removeFromParent();
      this.roomCorners = undefined;
    }
    for (const runtime of this.runtimes.values()) this.disposeRuntimeMeshes(runtime);
    this.runtimes.clear();
    this.webgl.dispose();
  }
}
