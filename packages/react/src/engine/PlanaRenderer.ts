import {
  type Color,
  type ObjectId,
  type PlanaDocument,
  type PlanaObject,
  isCadGhostType,
  resolveObjectStyle,
  selectionEdgeColor,
} from "@plana/core";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
  compileWorldMatrices,
  instanceScaleOf,
  protoOf,
  toBufferGeometry,
  transformEdges,
  unitEdgePositions,
  unitGeometry,
  type InstanceProto,
} from "./batch";
import { hatchSegments } from "./hatch";
import { WORLD_FROM_MM, buildRenderMesh, type WallMeshOptions } from "./mesh";
import { defaultSettings, hatchRuleForType, type ProjectSettings } from "../model/settings";
import {
  clipEdgesInsideWalls,
  collectWallSegments,
  computeRoomCornerVerticals,
  computeWallEndCapHiding,
  type WallEndCaps,
  type WallWorldSegment,
} from "./walls";

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

type InstanceBatch = {
  key: string;
  proto: InstanceProto;
  mesh: THREE.InstancedMesh;
  ids: ObjectId[];
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

function batchKey(proto: InstanceProto, object: PlanaObject): string {
  const style = resolveObjectStyle(object.type, object.style);
  const face = style.face!;
  const opacity = face.visible ? face.opacity : 0;
  const opaque = object.geometry?.type === "leaf" || opacity >= 0.95;
  const ghost = isCadGhostType(object.type) || (!opaque && opacity < 0.2);
  return [
    proto,
    ghost ? "g" : "s",
    opaque ? "o" : "t",
    face.color.r,
    face.color.g,
    face.color.b,
    ghost ? 0 : Math.round(opacity * 100),
  ].join(":");
}

const _raySphere = new THREE.Sphere();
const _rayMatrix = new THREE.Matrix4();
const _rayPoint = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _instance = new THREE.Matrix4();
const _scaleMat = new THREE.Matrix4();
const _color = new THREE.Color();
const _hatchMin = new THREE.Vector3();
const _hatchMax = new THREE.Vector3();
const _hatchPt = new THREE.Vector3();
const LEAF_FILL = 1;
const _jitter = new THREE.Matrix4();
const _filled = new THREE.Matrix4();

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function instancedSphereRaycast(
  this: THREE.InstancedMesh,
  raycaster: THREE.Raycaster,
  intersects: THREE.Intersection[],
) {
  const sphere = this.geometry.boundingSphere;
  if (!sphere) return;
  const limit = (this.userData.pickCount as number | undefined) ?? this.count;
  for (let i = 0; i < limit; i += 1) {
    this.getMatrixAt(i, _rayMatrix);
    _raySphere.center.copy(sphere.center).applyMatrix4(_rayMatrix);
    _raySphere.radius = sphere.radius * _rayMatrix.getMaxScaleOnAxis();
    if (!raycaster.ray.intersectSphere(_raySphere, _rayPoint)) continue;
    const distance = raycaster.ray.origin.distanceTo(_rayPoint);
    if (distance < raycaster.near || distance > raycaster.far) continue;
    intersects.push({
      distance,
      point: _rayPoint.clone(),
      object: this,
      instanceId: i,
    });
  }
}

export class PlanaRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly webgl: THREE.WebGLRenderer;
  readonly controls: OrbitControls;

  private readonly root = new THREE.Group();
  private readonly runtimes = new Map<ObjectId, ObjectRuntime>();
  private readonly worlds = new Map<ObjectId, THREE.Matrix4>();
  private readonly batches = new Map<string, InstanceBatch>();
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
  private instanceEdges?: THREE.LineSegments;
  private hatchLines?: THREE.LineSegments;
  private gridHelper: THREE.GridHelper;
  private axesHelper: THREE.AxesHelper;
  private view: ProjectSettings = defaultSettings();
  private framed = false;
  private framedDistance = 12;
  private identity = new THREE.Matrix4();
  private onViewChange?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(8, -7, 6);

    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.webgl.setClearColor("#09090b", 1);
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.sortObjects = true;

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

    this.gridHelper = new THREE.GridHelper(20, 40, "#27272a", "#18181b");
    this.gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(this.gridHelper);
    this.axesHelper = new THREE.AxesHelper(1.5);
    this.axesHelper.visible = false;
    this.scene.add(this.axesHelper);
    this.applyCanvasSettings();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.addEventListener("change", () => this.onViewChange?.());

    this.raycaster.params.Line = { threshold: 0.02 };

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    this.loop();
  }

  setSelectHandler(handler?: (id?: ObjectId) => void) {
    this.onSelect = handler;
  }

  setViewChangeHandler(handler?: () => void) {
    this.onViewChange = handler;
  }

  getZoomPercent() {
    const dist = this.camera.position.distanceTo(this.controls.target);
    if (dist < 1e-4) return 100;
    return Math.round((this.framedDistance / dist) * 100);
  }

  zoomBy(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const next = Math.min(80, Math.max(1.2, offset.length() * factor));
    this.camera.position.copy(this.controls.target).add(offset.setLength(next));
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.onViewChange?.();
  }

  pickObjectAt(clientX: number, clientY: number): ObjectId | undefined {
    if (!this.document) return undefined;
    const rect = this.webgl.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const pick: THREE.Object3D[] = [];
    for (const runtime of this.runtimes.values()) {
      if (runtime.face) pick.push(runtime.face);
    }
    for (const batch of this.batches.values()) pick.push(batch.mesh);
    const hits = this.raycaster.intersectObjects(pick, false);
    if (!hits.length) return undefined;
    const idOf = (hit: THREE.Intersection): ObjectId | undefined => {
      const direct = hit.object.userData.planaId as ObjectId | undefined;
      if (direct) return direct;
      const key = hit.object.userData.planaBatch as string | undefined;
      if (key == null || hit.instanceId == null) return undefined;
      return this.batches.get(key)?.ids[hit.instanceId];
    };
    const typeOf = (hit: THREE.Intersection) =>
      this.document?.objects[String(idOf(hit) ?? "")]?.type ?? "";
    const nonFloor = hits.filter((h) => typeOf(h) !== "floor");
    const pool = nonFloor.length > 0 ? nonFloor : hits;
    pool.sort((a, b) => {
      const distDelta = a.distance - b.distance;
      if (Math.abs(distDelta) > 0.08) return distDelta;
      return hitPriority(typeOf(a)) - hitPriority(typeOf(b));
    });
    return idOf(pool[0]);
  }

  setSettings(settings: ProjectSettings) {
    this.view = settings;
    this.applyCanvasSettings();
    if (this.document) this.rebuildHatch(this.document);
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
    this.syncSpecialStyles(this.document);
    this.rebuildInstanceBatches(this.document);
  }

  setDocument(document: PlanaDocument) {
    this.document = document;
    this.wallSegments = collectWallSegments(document);
    this.wallCaps = computeWallEndCapHiding(this.wallSegments);
    this.rebuildRoomCorners(document);
    compileWorldMatrices(document, this.worlds);

    const keep = new Set<ObjectId>();
    const visit = (id: ObjectId) => {
      const object = document.objects[id];
      if (!object) return;
      keep.add(id);
      if (object.geometry && !protoOf(object.geometry)) {
        this.upsertSpecial(object);
      }
      for (const childId of object.children ?? []) visit(childId);
    };
    visit(document.root);

    for (const [id, runtime] of this.runtimes) {
      if (keep.has(id) && document.objects[id]?.geometry && !protoOf(document.objects[id].geometry)) {
        continue;
      }
      runtime.group.removeFromParent();
      this.disposeRuntimeMeshes(runtime);
      this.runtimes.delete(id);
    }

    this.rebuildInstanceBatches(document);
    this.rebuildHatch(document);

    if (!this.framed && (this.runtimes.size > 0 || this.batches.size > 0)) {
      this.framed = true;
      this.frameDocument();
    }
  }

  /**
   * Orbit around the middle of the plan, wherever it sits in world space.
   * Walls and floors define the centre; furniture must not drag it around.
   */
  frameDocument() {
    const box = new THREE.Box3();
    let anchored = false;
    for (const [id, runtime] of this.runtimes) {
      const type = this.document?.objects[id]?.type;
      if (type !== "wall" && type !== "floor") continue;
      if (!runtime.face) continue;
      runtime.group.updateWorldMatrix(true, false);
      box.expandByObject(runtime.face);
      anchored = true;
    }
    if (!anchored) box.setFromObject(this.root);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const target = new THREE.Vector3(center.x, center.y, box.min.z + size.z * 0.45);

    const offset = this.camera.position.clone().sub(this.controls.target);
    if (offset.lengthSq() < 1e-6) offset.set(6, -6, 5);
    const radius = Math.max(size.x, size.y, size.z) / 2;
    const distance = Math.max(radius, 1) / Math.sin((this.camera.fov * Math.PI) / 360);

    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset.setLength(distance));
    this.framedDistance = distance;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.onViewChange?.();
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

  private upsertSpecial(object: PlanaObject) {
    const key = geometryKey(object, this.wallMeshOptions(object.id));
    let runtime = this.runtimes.get(object.id);
    if (!runtime) {
      runtime = this.createRuntime(object);
      this.runtimes.set(object.id, runtime);
    } else if (runtime.geometryKey !== key) {
      this.disposeRuntimeMeshes(runtime);
      this.rebuildMeshes(runtime, object);
      runtime.geometryKey = key;
    }
    if (runtime.group.parent !== this.root) this.root.add(runtime.group);
    const world = this.worlds.get(object.id) ?? this.identity;
    runtime.group.matrixAutoUpdate = false;
    runtime.group.matrix.copy(world);
    runtime.group.matrixWorldNeedsUpdate = true;
    if (this.document) this.applyStyle(runtime, object, this.document);
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

    const geometry = toBufferGeometry(mesh);
    const ghost = isCadGhostType(object.type) || object.type === "wall" || object.type === "floor";
    const face = new THREE.Mesh(
      geometry,
      ghost
        ? new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: true,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshLambertMaterial({
            transparent: true,
            depthWrite: true,
            depthTest: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
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
        new THREE.LineBasicMaterial({
          transparent: true,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -8,
          polygonOffsetUnits: -8,
        }),
      );
      edge.userData.planaId = object.id;
      edge.raycast = () => undefined;
      runtime.group.add(edge);
      runtime.edge = edge;
    }
  }

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

  private nearbyEdgeColors(document: PlanaDocument, objectId: ObjectId): Color[] {
    const colors: Color[] = [];
    for (const runtime of this.runtimes.values()) {
      if (runtime.objectId === objectId) continue;
      const object = document.objects[runtime.objectId];
      if (!object?.geometry) continue;
      const style = resolveObjectStyle(object.type, object.style);
      if (style.edge?.color) colors.push(style.edge.color);
      if (colors.length >= 12) break;
    }
    return colors;
  }

  private applyStyle(runtime: ObjectRuntime, object: PlanaObject, document: PlanaDocument) {
    const selected = this.selection.selectedIds.includes(object.id);
    const style = resolveObjectStyle(object.type, object.style);

    if (runtime.face && style.face) {
      const mat = runtime.face.material as THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
      mat.color = colorFromRgba(style.face.color);
      const opacity = style.face.visible ? style.face.opacity : 0;
      const opaque = opacity >= 0.95;
      mat.opacity = selected && opacity > 0 && !opaque ? Math.min(1, opacity + 0.08) : opacity;
      mat.transparent = !opaque;
      mat.depthWrite = true;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = 1;
      mat.polygonOffsetUnits = 1;
      mat.colorWrite = opacity > 0.001 || object.type === "wall";
      if (object.type === "wall" && opacity < 0.001) mat.opacity = 0.001;
      runtime.face.visible = true;
      runtime.face.raycast = THREE.Mesh.prototype.raycast;
    }

    if (runtime.edge && style.edge) {
      const mat = runtime.edge.material as THREE.LineBasicMaterial;
      if (selected) {
        mat.color = colorFromRgba(
          selectionEdgeColor(style.edge.color, this.nearbyEdgeColors(document, object.id)),
        );
      } else {
        mat.color = colorFromRgba(style.edge.color);
      }
      mat.opacity = style.edge.opacity;
      mat.visible = style.edge.visible;
      runtime.edge.visible = style.edge.visible;
      runtime.edge.renderOrder = selected ? 10 : 2;
    }
  }

  private syncSpecialStyles(document: PlanaDocument) {
    for (const [id, runtime] of this.runtimes) {
      const object = document.objects[id];
      if (object) this.applyStyle(runtime, object, document);
    }
  }

  private rebuildInstanceBatches(document: PlanaDocument) {
    const buckets = new Map<
      string,
      { proto: InstanceProto; objects: PlanaObject[]; ghost: boolean; opaque: boolean; opacity: number }
    >();

    const visit = (id: ObjectId) => {
      const object = document.objects[id];
      if (!object) return;
      const proto = protoOf(object.geometry);
      if (proto && object.geometry) {
        const key = batchKey(proto, object);
        let bucket = buckets.get(key);
        if (!bucket) {
          const style = resolveObjectStyle(object.type, object.style);
          const opacity = style.face!.visible ? style.face!.opacity : 0;
          const opaque = object.geometry.type === "leaf" || opacity >= 0.95;
          bucket = {
            proto,
            objects: [],
            ghost: isCadGhostType(object.type) || (!opaque && opacity < 0.2),
            opaque,
            opacity: opaque ? 1 : opacity,
          };
          buckets.set(key, bucket);
        }
        bucket.objects.push(object);
      }
      for (const childId of object.children ?? []) visit(childId);
    };
    visit(document.root);

    for (const key of [...this.batches.keys()]) {
      if (!buckets.has(key)) {
        this.disposeBatch(this.batches.get(key)!);
        this.batches.delete(key);
      }
    }

    const edgePos: number[] = [];
    const edgeCol: number[] = [];

    for (const [key, bucket] of buckets) {
      let batch = this.batches.get(key);
      const n = bucket.objects.length;
      const copies = bucket.proto === "leaf" ? LEAF_FILL : 1;
      const total = n * copies;
      if (!batch || (batch.mesh.userData.capacity as number) < total) {
        if (batch) this.disposeBatch(batch);
        const geo = unitGeometry(bucket.proto);
        const mat = bucket.ghost
          ? new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: bucket.opacity,
              depthWrite: true,
              depthTest: true,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              side: THREE.DoubleSide,
            })
          : new THREE.MeshLambertMaterial({
              color: 0xffffff,
              transparent: !bucket.opaque,
              opacity: bucket.opaque ? 1 : bucket.opacity,
              depthWrite: true,
              depthTest: true,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              side: THREE.DoubleSide,
            });
        const mesh = new THREE.InstancedMesh(geo, mat, total);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
        mesh.userData.planaBatch = key;
        mesh.userData.capacity = total;
        mesh.userData.pickCount = n;
        mesh.frustumCulled = true;
        mesh.raycast = instancedSphereRaycast;
        this.root.add(mesh);
        batch = { key, proto: bucket.proto, mesh, ids: [] };
        this.batches.set(key, batch);
      } else {
        const mat = batch.mesh.material as THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
        mat.depthWrite = true;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = 1;
        mat.polygonOffsetUnits = 1;
      }

      const ids: ObjectId[] = new Array(total);
      batch.mesh.count = total;
      batch.mesh.userData.pickCount = n;
      const selectedSet = new Set(this.selection.selectedIds);
      const rng = bucket.proto === "leaf" ? mulberry32(0x51eaf00d) : undefined;

      for (let i = 0; i < n; i += 1) {
        const object = bucket.objects[i];
        const world = this.worlds.get(object.id) ?? this.identity;
        instanceScaleOf(object.geometry!, _scale);
        _scaleMat.makeScale(_scale.x, _scale.y, _scale.z);
        _instance.multiplyMatrices(world, _scaleMat);
        batch.mesh.setMatrixAt(i, _instance);
        ids[i] = object.id;

        const style = resolveObjectStyle(object.type, object.style);
        const selected = selectedSet.has(object.id);
        if (selected) {
          _color.setRGB(1, 0.55, 0.42);
        } else {
          const c = style.face!.color;
          _color.setRGB(c.r / 255, c.g / 255, c.b / 255);
        }
        batch.mesh.setColorAt(i, _color);

        if (bucket.proto !== "leaf" && style.edge?.visible) {
          const edges = unitEdgePositions(bucket.proto);
          if (edges) {
            if (selected) {
              _color.setRGB(1, 0.45, 0.38);
            } else {
              const c = style.edge.color;
              _color.setRGB(c.r / 255, c.g / 255, c.b / 255);
            }
            transformEdges(edges, _instance, edgePos, edgeCol, _color);
          }
        }

        if (rng) {
          for (let c = 1; c < copies; c += 1) {
            const slot = i + c * n;
            _jitter.makeTranslation(
              (rng() - 0.5) * 0.09,
              (rng() - 0.5) * 0.09,
              (rng() - 0.5) * 0.055,
            );
            const s = 0.82 + rng() * 0.32;
            _scaleMat.makeScale(s, s, s);
            _filled.multiplyMatrices(_instance, _scaleMat);
            _filled.multiply(_jitter);
            batch.mesh.setMatrixAt(slot, _filled);
            batch.mesh.setColorAt(slot, _color);
            ids[slot] = object.id;
          }
        }
      }
      batch.ids = ids;

      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
      batch.mesh.renderOrder = bucket.opaque ? 0 : 1;
    }

    this.rebuildInstanceEdges(edgePos, edgeCol);
  }

  private applyCanvasSettings() {
    const canvas = this.view.canvas;
    this.controls.zoomSpeed = canvas.zoomSpeed;
    this.controls.rotateSpeed = canvas.rotateSpeed;
    this.controls.panSpeed = canvas.panSpeed;
    this.controls.enableDamping = canvas.damping;
    const bg = new THREE.Color(canvas.background);
    this.webgl.setClearColor(bg, 1);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg.getHex(), 20, 50);
    this.gridHelper.visible = canvas.showGrid;
    this.axesHelper.visible = canvas.showAxes;
    this.gridHelper.scale.setScalar(Math.max(0.25, canvas.gridSize / 20));
  }

  private hatchRect(object: PlanaObject, world: THREE.Matrix4) {
    const geo = object.geometry;
    if (!geo) return null;
    _hatchMin.set(Infinity, Infinity, Infinity);
    _hatchMax.set(-Infinity, -Infinity, -Infinity);
    const feed = (x: number, y: number, z: number) => {
      _hatchPt.set(x, y, z).applyMatrix4(world);
      _hatchMin.min(_hatchPt);
      _hatchMax.max(_hatchPt);
    };
    if (geo.type === "box") {
      const hx = (geo.size[0] * WORLD_FROM_MM) / 2;
      const hy = (geo.size[1] * WORLD_FROM_MM) / 2;
      const hz = geo.size[2] * WORLD_FROM_MM;
      for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [0, hz]) feed(x, y, z);
    } else if (geo.type === "cylinder") {
      const r = geo.radius * WORLD_FROM_MM;
      const h = geo.height * WORLD_FROM_MM;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        feed(Math.cos(a) * r, Math.sin(a) * r, 0);
        feed(Math.cos(a) * r, Math.sin(a) * r, h);
      }
    } else if (geo.type === "floor") {
      for (const [x, y] of geo.outline) feed(x * WORLD_FROM_MM, y * WORLD_FROM_MM, (geo.baseZ ?? 0) * WORLD_FROM_MM);
    } else if (geo.type === "wall") {
      const t = (geo.thickness * WORLD_FROM_MM) / 2;
      const h = Math.max(geo.height.start, geo.height.end) * WORLD_FROM_MM;
      const z0 = geo.baseZ * WORLD_FROM_MM;
      for (const p of geo.path.points) {
        feed(p[0] * WORLD_FROM_MM - t, p[1] * WORLD_FROM_MM - t, z0);
        feed(p[0] * WORLD_FROM_MM + t, p[1] * WORLD_FROM_MM + t, z0 + h);
      }
    } else {
      return null;
    }
    if (!Number.isFinite(_hatchMin.x)) return null;
    return {
      minX: _hatchMin.x,
      maxX: _hatchMax.x,
      minY: _hatchMin.y,
      maxY: _hatchMax.y,
      z: _hatchMax.z + 0.004,
    };
  }

  private rebuildHatch(document: PlanaDocument) {
    if (this.hatchLines) {
      this.hatchLines.geometry.dispose();
      (this.hatchLines.material as THREE.Material).dispose();
      this.hatchLines.removeFromParent();
      this.hatchLines = undefined;
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const visit = (id: ObjectId) => {
      const object = document.objects[id];
      if (!object) return;
      const rule = hatchRuleForType(this.view, object.type);
      if (rule && object.geometry) {
        const world = this.worlds.get(id) ?? this.identity;
        const rect = this.hatchRect(object, world);
        if (rect) {
          const segs = hatchSegments(
            rect,
            rule.spacing * WORLD_FROM_MM,
            rule.angle,
            rule.pattern,
          );
          const style = resolveObjectStyle(object.type, object.style);
          const col = rule.inheritColor ? (style.edge?.color ?? style.face?.color) : rule.color;
          const r = (col?.r ?? 228) / 255;
          const g = (col?.g ?? 228) / 255;
          const b = (col?.b ?? 231) / 255;
          for (let i = 0; i < segs.length; i += 3) {
            positions.push(segs[i], segs[i + 1], segs[i + 2]);
            colors.push(r, g, b);
          }
        }
      }
      for (const child of object.children ?? []) visit(child);
    };
    visit(document.root);
    if (!positions.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.raycast = () => undefined;
    lines.renderOrder = 4;
    this.root.add(lines);
    this.hatchLines = lines;
  }

  private rebuildInstanceEdges(positions: number[], colors: number[]) {
    if (this.instanceEdges) {
      this.instanceEdges.geometry.dispose();
      (this.instanceEdges.material as THREE.Material).dispose();
      this.instanceEdges.removeFromParent();
      this.instanceEdges = undefined;
    }
    if (!positions.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.raycast = () => undefined;
    lines.renderOrder = 3;
    lines.frustumCulled = true;
    this.root.add(lines);
    this.instanceEdges = lines;
  }

  private disposeBatch(batch: InstanceBatch) {
    batch.mesh.removeFromParent();
    (batch.mesh.material as THREE.Material).dispose();
    batch.mesh.dispose();
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
    this.onSelect(this.pickObjectAt(event.clientX, event.clientY));
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
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
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
    if (this.instanceEdges) {
      this.instanceEdges.geometry.dispose();
      (this.instanceEdges.material as THREE.Material).dispose();
      this.instanceEdges.removeFromParent();
      this.instanceEdges = undefined;
    }
    if (this.hatchLines) {
      this.hatchLines.geometry.dispose();
      (this.hatchLines.material as THREE.Material).dispose();
      this.hatchLines.removeFromParent();
      this.hatchLines = undefined;
    }
    for (const runtime of this.runtimes.values()) this.disposeRuntimeMeshes(runtime);
    this.runtimes.clear();
    for (const batch of this.batches.values()) this.disposeBatch(batch);
    this.batches.clear();
    this.webgl.dispose();
  }
}
