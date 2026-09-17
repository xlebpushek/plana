import type { Geometry, ObjectId, PlanaDocument, PlanaObject } from "@plana/core";
import * as THREE from "three";

import {
  WORLD_FROM_MM,
  buildUnitBoxMesh,
  buildUnitCylinderMesh,
  buildUnitLeafMesh,
  type RenderMesh,
} from "./mesh";

export type InstanceProto = "box" | "cylinder" | "leaf";

const _local = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _corner = new THREE.Vector3();

const unitGeos: Partial<Record<InstanceProto, THREE.BufferGeometry>> = {};
const unitEdges: Partial<Record<InstanceProto, Float32Array>> = {};

export function protoOf(geometry: Geometry | undefined): InstanceProto | null {
  if (!geometry) return null;
  if (geometry.type === "box" || geometry.type === "cylinder" || geometry.type === "leaf") {
    return geometry.type;
  }
  return null;
}

export function instanceScaleOf(geometry: Geometry, target: THREE.Vector3) {
  if (geometry.type === "box") {
    return target.set(geometry.size[0] / 1000, geometry.size[1] / 1000, geometry.size[2] / 1000);
  }
  if (geometry.type === "cylinder") {
    const r = geometry.radius / 1000;
    return target.set(r, r, geometry.height / 1000);
  }
  if (geometry.type === "leaf") {
    const w = geometry.width / 1000;
    return target.set(w, w, geometry.length / 1000);
  }
  return target.set(1, 1, 1);
}

export function toBufferGeometry(mesh: RenderMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  if (mesh.normals) geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  if (mesh.indices) geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function unitGeometry(proto: InstanceProto): THREE.BufferGeometry {
  let geo = unitGeos[proto];
  if (geo) return geo;
  const mesh =
    proto === "box"
      ? buildUnitBoxMesh()
      : proto === "cylinder"
        ? buildUnitCylinderMesh()
        : buildUnitLeafMesh();
  geo = toBufferGeometry(mesh);
  unitGeos[proto] = geo;
  if (mesh.edges) unitEdges[proto] = mesh.edges;
  return geo;
}

export function unitEdgePositions(proto: InstanceProto): Float32Array | undefined {
  unitGeometry(proto);
  return unitEdges[proto];
}

export function localMatrixOf(object: PlanaObject, target = _local) {
  const [x, y, z] = object.transform.position;
  const [qx, qy, qz, qw] = object.transform.rotation;
  const [sx, sy, sz] = object.transform.scale;
  _pos.set(x * WORLD_FROM_MM, y * WORLD_FROM_MM, z * WORLD_FROM_MM);
  _quat.set(qx, qy, qz, qw);
  _scale.set(sx, sy, sz);
  return target.compose(_pos, _quat, _scale);
}

export function compileWorldMatrices(
  document: PlanaDocument,
  out: Map<ObjectId, THREE.Matrix4>,
) {
  const visit = (id: ObjectId, parent: THREE.Matrix4) => {
    const object = document.objects[id];
    if (!object) return;
    let world = out.get(id);
    if (!world) {
      world = new THREE.Matrix4();
      out.set(id, world);
    }
    world.multiplyMatrices(parent, localMatrixOf(object));
    for (const childId of object.children ?? []) visit(childId, world);
  };
  visit(document.root, new THREE.Matrix4());
  return out;
}

export function transformEdges(
  edges: Float32Array,
  matrix: THREE.Matrix4,
  out: number[],
  colors: number[],
  color: THREE.Color,
) {
  for (let i = 0; i < edges.length; i += 3) {
    _corner.set(edges[i], edges[i + 1], edges[i + 2]).applyMatrix4(matrix);
    out.push(_corner.x, _corner.y, _corner.z);
    colors.push(color.r, color.g, color.b);
  }
}
