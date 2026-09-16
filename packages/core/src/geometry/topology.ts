/** Topology types — generated on demand, not stored for simple parametric solids. */

export type TopologyVertex = {
  id: string;
  position: [number, number, number];
};

export type TopologyEdge = {
  id: string;
  start: string;
  end: string;
};

export type TopologyLoop = {
  id: string;
  edges: string[];
};

export type TopologyFace = {
  id: string;
  outer: string;
  holes?: string[];
};

export type TopologySolid = {
  id: string;
  faces: string[];
};
