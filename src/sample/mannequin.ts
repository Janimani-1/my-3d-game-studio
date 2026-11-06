/**
 * Procedural "Test Mannequin" GLB generator (original work, CC0).
 * Produces a skinned, textured humanoid made of boxes with 15 joints,
 * two materials (textured suit + skin colour) and four animation clips.
 * glTF conventions: +Y up, character faces +Z, metres.
 */

export type V3 = [number, number, number];

interface JointDef {
  name: string;
  parent: number; // -1 root
  t: V3; // local translation (bind pose)
}

const J: JointDef[] = [
  { name: 'Hips', parent: -1, t: [0, 1.0, 0] }, // 0
  { name: 'Spine', parent: 0, t: [0, 0.15, 0] }, // 1
  { name: 'Chest', parent: 1, t: [0, 0.25, 0] }, // 2
  { name: 'Neck', parent: 2, t: [0, 0.25, 0] }, // 3
  { name: 'Head', parent: 3, t: [0, 0.1, 0] }, // 4
  { name: 'LeftUpperArm', parent: 2, t: [0.22, 0.2, 0] }, // 5
  { name: 'LeftLowerArm', parent: 5, t: [0, -0.3, 0] }, // 6
  { name: 'LeftHand', parent: 6, t: [0, -0.28, 0] }, // 7
  { name: 'RightUpperArm', parent: 2, t: [-0.22, 0.2, 0] }, // 8
  { name: 'RightLowerArm', parent: 8, t: [0, -0.3, 0] }, // 9
  { name: 'RightHand', parent: 9, t: [0, -0.28, 0] }, // 10
  { name: 'LeftUpperLeg', parent: 0, t: [0.1, -0.05, 0] }, // 11
  { name: 'LeftLowerLeg', parent: 11, t: [0, -0.45, 0] }, // 12
  { name: 'RightUpperLeg', parent: 0, t: [-0.1, -0.05, 0] }, // 13
  { name: 'RightLowerLeg', parent: 13, t: [0, -0.45, 0] }, // 14
];

function worldPos(i: number): V3 {
  let p: V3 = [0, 0, 0];
  for (let j = i; j >= 0; j = J[j].parent) p = [p[0] + J[j].t[0], p[1] + J[j].t[1], p[2] + J[j].t[2]];
  return p;
}

export interface BoxDef {
  c: V3;
  s: V3;
  joint: number;
  skin?: boolean; // legacy: true = material 1
  mat?: number; // material index (overrides skin)
  uvRow: number; // texture row 0..3 for variety
}

const BOXES: BoxDef[] = [
  { c: [0, 1.02, 0], s: [0.32, 0.18, 0.18], joint: 0, skin: false, uvRow: 0 },
  { c: [0, 1.28, 0], s: [0.34, 0.3, 0.19], joint: 1, skin: false, uvRow: 1 },
  { c: [0, 1.5, 0], s: [0.42, 0.26, 0.22], joint: 2, skin: false, uvRow: 1 },
  { c: [0, 1.69, 0], s: [0.09, 0.09, 0.09], joint: 3, skin: true, uvRow: 0 },
  { c: [0, 1.86, 0.0], s: [0.22, 0.25, 0.24], joint: 4, skin: true, uvRow: 0 },
  { c: [0, 1.86, 0.125], s: [0.14, 0.03, 0.02], joint: 4, skin: false, uvRow: 3 }, // visor (shows facing direction)
  { c: [0.22, 1.45, 0], s: [0.1, 0.3, 0.1], joint: 5, skin: false, uvRow: 2 },
  { c: [0.22, 1.16, 0], s: [0.09, 0.28, 0.09], joint: 6, skin: false, uvRow: 2 },
  { c: [0.22, 0.97, 0], s: [0.08, 0.1, 0.06], joint: 7, skin: true, uvRow: 0 },
  { c: [-0.22, 1.45, 0], s: [0.1, 0.3, 0.1], joint: 8, skin: false, uvRow: 2 },
  { c: [-0.22, 1.16, 0], s: [0.09, 0.28, 0.09], joint: 9, skin: false, uvRow: 2 },
  { c: [-0.22, 0.97, 0], s: [0.08, 0.1, 0.06], joint: 10, skin: true, uvRow: 0 },
  { c: [0.1, 0.72, 0], s: [0.14, 0.44, 0.14], joint: 11, skin: false, uvRow: 3 },
  { c: [0.1, 0.27, 0], s: [0.12, 0.44, 0.12], joint: 12, skin: false, uvRow: 3 },
  { c: [0.1, 0.04, 0.05], s: [0.12, 0.08, 0.24], joint: 12, skin: false, uvRow: 0 },
  { c: [-0.1, 0.72, 0], s: [0.14, 0.44, 0.14], joint: 13, skin: false, uvRow: 3 },
  { c: [-0.1, 0.27, 0], s: [0.12, 0.44, 0.12], joint: 14, skin: false, uvRow: 3 },
  { c: [-0.1, 0.04, 0.05], s: [0.12, 0.08, 0.24], joint: 14, skin: false, uvRow: 0 },
];

// Six faces: normal, u axis, v axis
const FACES: [V3, V3, V3][] = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
];

interface PrimData {
  pos: number[];
  nrm: number[];
  uv: number[];
  joints: number[];
  weights: number[];
  idx: number[];
}

const matOf = (b: BoxDef) => b.mat ?? (b.skin ? 1 : 0);

function buildPrim(boxes: BoxDef[], mat: number): PrimData {
  const d: PrimData = { pos: [], nrm: [], uv: [], joints: [], weights: [], idx: [] };
  for (const b of boxes.filter((x) => matOf(x) === mat)) {
    const h: V3 = [b.s[0] / 2, b.s[1] / 2, b.s[2] / 2];
    for (const [n, u, v] of FACES) {
      const base = d.pos.length / 3;
      const corners: [number, number][] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (const [cu, cv] of corners) {
        for (let k = 0; k < 3; k++) d.pos.push(b.c[k] + (n[k] + u[k] * cu + v[k] * cv) * h[k]);
        d.nrm.push(...n);
        // texture: 4 rows; u spans 0..1 horizontally
        d.uv.push((cu + 1) / 2, (b.uvRow + (cv + 1) / 2) / 4);
        d.joints.push(b.joint, 0, 0, 0);
        d.weights.push(1, 0, 0, 0);
      }
      d.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return d;
}

// --- Texture (64x64 RGBA) ---------------------------------------------------
export function makeTexturePixels(): Uint8Array {
  const W = 64;
  const px = new Uint8Array(W * W * 4);
  const rows: [number, number, number][] = [
    [40, 46, 64],
    [32, 92, 140],
    [24, 120, 160],
    [52, 58, 82],
  ];
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      // PNG row 0 is top; glTF UV v=0 is top as well.
      const row = Math.min(3, Math.floor(y / 16));
      const [r, g, b] = rows[row];
      const checker = ((x >> 3) + (y >> 3)) & 1 ? 1.0 : 0.82;
      const seam = y % 16 === 0 || x === 0 ? 0.55 : 1;
      const accent = row === 1 && y % 16 >= 6 && y % 16 <= 9 ? [230, 200, 90] : null;
      const o = (y * W + x) * 4;
      if (accent) {
        px[o] = accent[0];
        px[o + 1] = accent[1];
        px[o + 2] = accent[2];
      } else {
        px[o] = Math.round(r * checker * seam);
        px[o + 1] = Math.round(g * checker * seam);
        px[o + 2] = Math.round(b * checker * seam);
      }
      px[o + 3] = 255;
    }
  }
  return px;
}

let CRC: Uint32Array | null = null;
function crc32(buf: Uint8Array): number {
  if (!CRC) {
    CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Encode RGBA pixels as PNG. `deflate` must produce a zlib stream (e.g. Node zlib.deflateSync). */
export function encodePng(w: number, h: number, rgba: Uint8Array, deflate: (d: Uint8Array) => Uint8Array): Uint8Array {
  const raw = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const png = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    png.set(p, o);
    o += p.length;
  }
  return png;
}

// --- Animation helpers --------------------------------------------------------
function quat(axis: V3, deg: number): [number, number, number, number] {
  const a = (deg * Math.PI) / 180 / 2;
  const s = Math.sin(a);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(a)];
}

export interface Track {
  joint: number;
  path: 'rotation' | 'translation';
  times: number[];
  values: number[][];
}

export interface Clip {
  name: string;
  tracks: Track[];
}

export const X: V3 = [1, 0, 0];
export const Z: V3 = [0, 0, 1];
export const Yax: V3 = [0, 1, 0];

export function rot(joint: number, axis: V3, keys: [number, number][]): Track {
  return { joint, path: 'rotation', times: keys.map((k) => k[0]), values: keys.map((k) => quat(axis, k[1])) };
}

const CLIPS: Clip[] = [
  {
    name: 'Idle_Breathe',
    tracks: [
      { joint: 0, path: 'translation', times: [0, 1, 2], values: [[0, 1, 0], [0, 0.985, 0], [0, 1, 0]] },
      rot(2, X, [[0, 0], [1, 3], [2, 0]]),
      rot(5, Z, [[0, 6], [1, 9], [2, 6]]),
      rot(8, Z, [[0, -6], [1, -9], [2, -6]]),
    ],
  },
  {
    name: 'Punch_Right',
    tracks: [
      rot(8, X, [[0, 0], [0.18, -40], [0.3, -90], [0.6, -90], [1.0, 0]]),
      rot(9, X, [[0, -60], [0.18, -70], [0.3, 0], [0.6, 0], [1.0, -60]]),
      rot(1, Yax, [[0, 0], [0.3, 25], [0.6, 25], [1.0, 0]]),
      rot(5, X, [[0, -30], [0.5, -40], [1.0, -30]]),
      rot(6, X, [[0, -100], [1.0, -100]]),
    ],
  },
  {
    name: 'Kick_Front_Right',
    tracks: [
      rot(13, X, [[0, 0], [0.3, -50], [0.5, -95], [0.8, -95], [1.2, 0]]),
      rot(14, X, [[0, 0], [0.3, 80], [0.5, 0], [0.8, 0], [1.0, 60], [1.2, 0]]),
      rot(2, X, [[0, 0], [0.5, 10], [1.2, 0]]),
      rot(5, Z, [[0, 8], [0.5, 35], [1.2, 8]]),
      rot(8, Z, [[0, -8], [0.5, -35], [1.2, -8]]),
    ],
  },
  {
    name: 'Wave_Left',
    tracks: [
      rot(5, Z, [[0, 0], [0.4, 150], [2.0, 150], [2.4, 0]]),
      rot(6, Z, [[0, 0], [0.4, 20], [0.8, -20], [1.2, 20], [1.6, -20], [2.0, 20], [2.4, 0]]),
      rot(4, Z, [[0, 0], [0.8, 8], [1.6, -4], [2.4, 0]]),
    ],
  },
];

// --- GLB assembly -----------------------------------------------------------------
class BinWriter {
  parts: Uint8Array[] = [];
  length = 0;
  add(bytes: Uint8Array): number {
    const pad = (4 - (this.length % 4)) % 4;
    if (pad) {
      this.parts.push(new Uint8Array(pad));
      this.length += pad;
    }
    const off = this.length;
    this.parts.push(bytes);
    this.length += bytes.length;
    return off;
  }
  concat(): Uint8Array {
    const pad = (4 - (this.length % 4)) % 4;
    const out = new Uint8Array(this.length + pad);
    let o = 0;
    for (const p of this.parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
}

export interface CharacterDesign {
  meshName: string;
  rigName: string;
  generator: string;
  imageName: string;
  boxes: BoxDef[];
  materials: any[]; // glTF materials; a baseColorTexture refers to texture 0
  texture: () => Uint8Array; // 64x64 RGBA, 4 horizontal rows used as an atlas
  magFilter: number;
  extraClips?: Clip[];
}

export const MANNEQUIN: CharacterDesign = {
  meshName: 'Mannequin',
  rigName: 'MannequinRig',
  generator: 'My 3D Game Studio – procedural Test Mannequin (CC0)',
  imageName: 'SuitAtlas',
  boxes: BOXES,
  materials: [
    { name: 'Suit_Textured', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0.1, roughnessFactor: 0.7 } },
    { name: 'Skin_Mask', pbrMetallicRoughness: { baseColorFactor: [0.85, 0.72, 0.6, 1], metallicFactor: 0, roughnessFactor: 0.8 } },
  ],
  texture: makeTexturePixels,
  magFilter: 9728,
};

export function buildMannequinGlb(deflate: (d: Uint8Array) => Uint8Array): Uint8Array {
  return buildCharacterGlb(deflate, MANNEQUIN);
}

export function buildCharacterGlb(deflate: (d: Uint8Array) => Uint8Array, design: CharacterDesign): Uint8Array {
  const bin = new BinWriter();
  const bufferViews: any[] = [];
  const accessors: any[] = [];

  const addView = (bytes: Uint8Array, target?: number) => {
    const off = bin.add(bytes);
    bufferViews.push({ buffer: 0, byteOffset: off, byteLength: bytes.length, ...(target ? { target } : {}) });
    return bufferViews.length - 1;
  };
  const addAcc = (data: number[], type: string, componentType: number, comps: number, minmax = false, target?: number) => {
    let bytes: Uint8Array;
    if (componentType === 5126) bytes = new Uint8Array(new Float32Array(data).buffer);
    else if (componentType === 5123) bytes = new Uint8Array(new Uint16Array(data).buffer);
    else bytes = new Uint8Array(new Uint8Array(data).buffer);
    const bv = addView(bytes, target);
    const acc: any = { bufferView: bv, componentType, count: data.length / comps, type };
    if (minmax) {
      const mn = new Array(comps).fill(Infinity);
      const mx = new Array(comps).fill(-Infinity);
      for (let i = 0; i < data.length; i++) {
        mn[i % comps] = Math.min(mn[i % comps], data[i]);
        mx[i % comps] = Math.max(mx[i % comps], data[i]);
      }
      acc.min = mn;
      acc.max = mx;
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  const primitives: any[] = [];
  design.materials.forEach((_m, mi) => {
    if (!design.boxes.some((b) => matOf(b) === mi)) return;
    const p = buildPrim(design.boxes, mi);
    primitives.push({
      attributes: {
        POSITION: addAcc(p.pos, 'VEC3', 5126, 3, true, 34962),
        NORMAL: addAcc(p.nrm, 'VEC3', 5126, 3, false, 34962),
        TEXCOORD_0: addAcc(p.uv, 'VEC2', 5126, 2, false, 34962),
        JOINTS_0: addAcc(p.joints, 'VEC4', 5121, 4, false, 34962),
        WEIGHTS_0: addAcc(p.weights, 'VEC4', 5126, 4, false, 34962),
      },
      indices: addAcc(p.idx, 'SCALAR', 5123, 1, false, 34963),
      material: mi,
      mode: 4,
    });
  });

  // Inverse bind matrices (bind pose is pure translation): column-major
  const ibm: number[] = [];
  for (let i = 0; i < J.length; i++) {
    const w = worldPos(i);
    ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -w[0], -w[1], -w[2], 1);
  }
  const ibmAcc = addAcc(ibm, 'MAT4', 5126, 16);

  // Texture image
  const png = encodePng(64, 64, design.texture(), deflate);
  const imgView = addView(png);

  // Nodes: 0 = mesh node, 1 = armature root, joints start at 2
  const JOFF = 2;
  const nodes: any[] = [
    { name: design.meshName + '_Mesh', mesh: 0, skin: 0 },
    { name: 'Armature', children: [JOFF] },
  ];
  J.forEach((j, i) => {
    const children = J.map((c, ci) => (c.parent === i ? ci + JOFF : -1)).filter((x) => x >= 0);
    nodes.push({ name: j.name, translation: j.t, ...(children.length ? { children } : {}) });
  });

  const animations = [...CLIPS, ...(design.extraClips ?? [])].map((clip) => {
    const samplers: any[] = [];
    const channels: any[] = [];
    for (const tr of clip.tracks) {
      const input = addAcc(tr.times, 'SCALAR', 5126, 1, true);
      const comps = tr.path === 'rotation' ? 4 : 3;
      const output = addAcc(tr.values.flat(), tr.path === 'rotation' ? 'VEC4' : 'VEC3', 5126, comps);
      samplers.push({ input, output, interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: tr.joint + JOFF, path: tr.path } });
    }
    return { name: clip.name, samplers, channels };
  });

  const json = {
    asset: { version: '2.0', generator: design.generator, copyright: 'CC0 1.0 – generated by My 3D Game Studio' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0, 1] }],
    nodes,
    meshes: [{ name: design.meshName, primitives }],
    skins: [{ name: design.rigName, joints: J.map((_, i) => i + JOFF), inverseBindMatrices: ibmAcc, skeleton: JOFF }],
    materials: design.materials,
    textures: [{ sampler: 0, source: 0 }],
    samplers: [{ magFilter: design.magFilter, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ name: design.imageName, mimeType: 'image/png', bufferView: imgView }],
    animations,
    accessors,
    bufferViews,
    buffers: [{ byteLength: 0 }],
  };

  const binBytes = bin.concat();
  json.buffers[0].byteLength = binBytes.length;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (jsonBytes.length % 4)) % 4;
  if (jpad) {
    const p = new Uint8Array(jsonBytes.length + jpad).fill(0x20);
    p.set(jsonBytes);
    jsonBytes = p;
  }
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  const bo = 20 + jsonBytes.length;
  dv.setUint32(bo, binBytes.length, true);
  dv.setUint32(bo + 4, 0x004e4942, true);
  out.set(binBytes, bo + 8);
  return out;
}

export const MANNEQUIN_INFO = { joints: J.length, boxes: BOXES.length, clips: CLIPS.map((c) => c.name) };
