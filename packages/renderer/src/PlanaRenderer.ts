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
import { collectWallSegments, computeWallEndCapHiding, type WallEndCaps } from "./walls.js";

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
  return `${base}|s${wallOpts.hideStartCap ? 1 : 0}|e${wallOpts.hideEndCap ? 1 : 0}`;
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

  private pointerDown: { x: number; y: number } | null = null;

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
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    this.scene.add(this.root);

    const grid = new THREE.GridHelper(20, 40, "#27272a", "#18181b");
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(3.2, 3.0, 1.0);
    this.controls.maxPolarAngle = Math.PI * 0.495;

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
    // Wall edge topology depends on selection (junction caps vs full bounds).
    const touched = new Set([...prev, ...selection.selectedIds]);
    for (const id of touched) {
      const object = this.document.objects[id];
      const runtime = this.runtimes.get(id);
      if (!object || !runtime || object.type !== "wall") continue;
      this.disposeRuntimeMeshes(runtime);
      this.rebuildMeshes(runtime, object);
      runtime.geometryKey = geometryKey(object, this.wallMeshOptions(object.id));
    }
    this.syncStyles(this.document);
  }

  setDocument(document: PlanaDocument) {
    this.document = document;
    this.wallCaps = computeWallEndCapHiding(collectWallSegments(document));
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
    if (!this.document?.objects[id] || this.document.objects[id].type !== "wall") return undefined;
    const selected = this.selection.selectedIds.includes(id);
    if (selected) return { hideStartCap: false, hideEndCap: false };
    const caps = this.wallCaps.get(id);
    if (!caps) return { hideStartCap: false, hideEndCap: false };
    return { hideStartCap: caps.hideStart, hideEndCap: caps.hideEnd };
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

    const face = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    face.userData.planaId = object.id;
    runtime.group.add(face);
    runtime.face = face;

    if (mesh.edges) {
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute("position", new THREE.BufferAttribute(mesh.edges, 3));
      const edge = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ transparent: true }),
      );
      edge.userData.planaId = object.id;
      runtime.group.add(edge);
      runtime.edge = edge;
    }
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
      const mat = runtime.face.material as THREE.MeshBasicMaterial;
      mat.color = colorFromRgba(style.face.color);
      const opacity = style.face.visible ? style.face.opacity : 0;
      mat.opacity = selected && opacity > 0 ? Math.min(1, opacity + 0.12) : opacity;
      mat.transparent = true;
      mat.depthWrite = false;
      mat.colorWrite = opacity > 0.001;
      runtime.face.visible = true;
      runtime.face.raycast =
        opacity > 0.001 || object.type === "wall"
          ? THREE.Mesh.prototype.raycast
          : () => undefined;
    }

    if (runtime.edge && style.edge) {
      const mat = runtime.edge.material as THREE.LineBasicMaterial;
      if (selected) {
        const accent = selectionEdgeColor(style.edge.color, this.nearbyEdgeColors(document, object.id));
        mat.color = colorFromRgba(accent);
        mat.linewidth = Math.max(style.edge.width, 1.6);
      } else {
        mat.color = colorFromRgba(style.edge.color);
      }
      mat.opacity = style.edge.opacity;
      mat.visible = style.edge.visible;
      runtime.edge.visible = style.edge.visible;
      // Selected walls draw on top so overlapping bounds stay readable.
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

    const rect = this.webgl.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.runtimes.values()].map((r) => r.group),
      true,
    );
    let node: THREE.Object3D | null = hits[0]?.object ?? null;
    while (node && !node.userData.planaId) node = node.parent;
    this.onSelect(node?.userData.planaId);
  };

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
    for (const runtime of this.runtimes.values()) this.disposeRuntimeMeshes(runtime);
    this.runtimes.clear();
    this.webgl.dispose();
  }
}
