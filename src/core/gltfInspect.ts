/**
 * Pure glTF 2.0 / GLB inspector. Runs without WebGL or Three.js so that
 * validation and statistics work even if the 3D engine cannot load.
 */

export const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export type InspectErrorCode =
  | 'empty'
  | 'notGltf'
  | 'badVersion'
  | 'truncated'
  | 'badJson'
  | 'noAsset';

export class InspectError extends Error {
  constructor(public code: InspectErrorCode, message: string) {
    super(message);
    this.name = 'InspectError';
  }
}

export interface AnimationInfo {
  index: number;
  name: string;
  channels: number;
  duration: number; // seconds (from sampler input accessor max)
  targets: string[]; // translation/rotation/scale/weights
}

export interface ModelStats {
  container: 'glb' | 'gltf';
  generator: string;
  version: string;
  scenes: number;
  nodes: number;
  meshes: number;
  primitives: number;
  vertices: number;
  triangles: number;
  materials: number;
  materialNames: string[];
  textures: number;
  images: number;
  embeddedImages: number;
  skins: number;
  joints: number;
  animations: AnimationInfo[];
  extensionsUsed: string[];
  extensionsRequired: string[];
  /** Relative URIs (buffers/images) that must be supplied as separate files. */
  externalUris: string[];
  hasBinChunk: boolean;
  warnings: string[];
}

interface Json {
  [k: string]: any;
}

function isDataUri(u: string): boolean {
  return /^data:/i.test(u);
}

export function parseContainer(bytes: Uint8Array, fileName = ''): { json: Json; container: 'glb' | 'gltf'; bin: Uint8Array | null } {
  if (bytes.length === 0) throw new InspectError('empty', 'File is empty');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 4 && dv.getUint32(0, true) === GLB_MAGIC) {
    if (bytes.length < 20) throw new InspectError('truncated', 'GLB header incomplete');
    const version = dv.getUint32(4, true);
    if (version !== 2) throw new InspectError('badVersion', `GLB version ${version} is not supported (need 2)`);
    const length = dv.getUint32(8, true);
    if (length > bytes.length) throw new InspectError('truncated', `GLB declares ${length} bytes but file has ${bytes.length}`);
    let off = 12;
    let json: Json | null = null;
    let bin: Uint8Array | null = null;
    while (off + 8 <= length) {
      const clen = dv.getUint32(off, true);
      const ctype = dv.getUint32(off + 4, true);
      const start = off + 8;
      if (start + clen > length) throw new InspectError('truncated', 'GLB chunk exceeds file length');
      if (ctype === CHUNK_JSON && !json) {
        try {
          json = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + clen)));
        } catch {
          throw new InspectError('badJson', 'GLB JSON chunk is not valid JSON');
        }
      } else if (ctype === CHUNK_BIN && !bin) {
        bin = bytes.subarray(start, start + clen);
      }
      off = start + clen;
    }
    if (!json) throw new InspectError('badJson', 'GLB has no JSON chunk');
    return { json, container: 'glb', bin };
  }
  // Try JSON .gltf
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 64))).trimStart();
  if (!head.startsWith('{')) {
    throw new InspectError('notGltf', `"${fileName || 'file'}" is not a glTF/GLB file`);
  }
  let json: Json;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InspectError('badJson', 'glTF JSON could not be parsed');
  }
  return { json, container: 'gltf', bin: null };
}

function trianglesFor(mode: number, count: number): number {
  switch (mode) {
    case 4:
      return Math.floor(count / 3);
    case 5:
    case 6:
      return Math.max(0, count - 2);
    default:
      return 0; // points/lines
  }
}

export function inspectGltf(bytes: Uint8Array, fileName = ''): ModelStats {
  const { json, container, bin } = parseContainer(bytes, fileName);
  if (!json || typeof json !== 'object' || !json.asset) throw new InspectError('noAsset', 'Missing required "asset" object');
  const warnings: string[] = [];
  const ver = String(json.asset.version ?? '');
  if (!ver.startsWith('2')) throw new InspectError('badVersion', `glTF version "${ver}" is not supported (need 2.x)`);

  const arr = (k: string): any[] => (Array.isArray(json[k]) ? json[k] : []);
  const accessors = arr('accessors');
  const meshes = arr('meshes');
  let primitives = 0;
  let vertices = 0;
  let triangles = 0;
  for (const m of meshes) {
    for (const p of Array.isArray(m.primitives) ? m.primitives : []) {
      primitives++;
      const posAcc = accessors[p.attributes?.POSITION];
      const vcount = posAcc?.count ?? 0;
      vertices += vcount;
      const mode = p.mode ?? 4;
      const idxCount = p.indices !== undefined ? accessors[p.indices]?.count ?? 0 : vcount;
      triangles += trianglesFor(mode, idxCount);
      if (!posAcc) warnings.push('A mesh primitive has no POSITION attribute');
    }
  }

  const skins = arr('skins');
  const joints = new Set<number>();
  for (const s of skins) for (const j of s.joints ?? []) joints.add(j);

  const animations: AnimationInfo[] = arr('animations').map((a: any, i: number) => {
    let duration = 0;
    const targets = new Set<string>();
    for (const s of a.samplers ?? []) {
      const inp = accessors[s.input];
      const mx = Array.isArray(inp?.max) ? Number(inp.max[0]) : 0;
      if (Number.isFinite(mx)) duration = Math.max(duration, mx);
    }
    for (const c of a.channels ?? []) if (c.target?.path) targets.add(c.target.path);
    return {
      index: i,
      name: typeof a.name === 'string' && a.name ? a.name : `Animation ${i + 1}`,
      channels: (a.channels ?? []).length,
      duration,
      targets: [...targets],
    };
  });

  const externalUris: string[] = [];
  let embeddedImages = 0;
  for (const b of arr('buffers')) {
    if (typeof b.uri === 'string') {
      if (!isDataUri(b.uri)) externalUris.push(decodeURIComponent(b.uri));
    } else if (container === 'gltf') {
      warnings.push('A buffer has no URI in a .gltf file');
    } else if (!bin) {
      warnings.push('GLB references a binary chunk but none exists');
    }
  }
  for (const im of arr('images')) {
    if (typeof im.uri === 'string') {
      if (isDataUri(im.uri)) embeddedImages++;
      else externalUris.push(decodeURIComponent(im.uri));
    } else if (im.bufferView !== undefined) embeddedImages++;
  }

  const extensionsRequired: string[] = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  const SUPPORTED_REQUIRED = new Set([
    'KHR_draco_mesh_compression',
    'EXT_meshopt_compression',
    'KHR_texture_transform',
    'KHR_materials_unlit',
    'KHR_mesh_quantization',
    'KHR_texture_basisu',
    'EXT_texture_webp',
  ]);
  for (const e of extensionsRequired) if (!SUPPORTED_REQUIRED.has(e)) warnings.push(`Required extension may be unsupported: ${e}`);

  return {
    container,
    generator: String(json.asset.generator ?? ''),
    version: ver,
    scenes: arr('scenes').length,
    nodes: arr('nodes').length,
    meshes: meshes.length,
    primitives,
    vertices,
    triangles,
    materials: arr('materials').length,
    materialNames: arr('materials').map((m: any, i: number) => (m?.name ? String(m.name) : `Material ${i + 1}`)),
    textures: arr('textures').length,
    images: arr('images').length,
    embeddedImages,
    skins: skins.length,
    joints: joints.size,
    animations,
    extensionsUsed: Array.isArray(json.extensionsUsed) ? json.extensionsUsed : [],
    extensionsRequired,
    externalUris,
    hasBinChunk: !!bin,
    warnings,
  };
}

/** Return the external URIs that are not present in the supplied file names (case-insensitive, basename match allowed). */
export function findMissingResources(stats: ModelStats, suppliedNames: string[]): string[] {
  const names = new Set(suppliedNames.map((n) => n.toLowerCase()));
  const base = (p: string) => p.split(/[\\/]/).pop()!.toLowerCase();
  const bases = new Set(suppliedNames.map(base));
  return stats.externalUris.filter((u) => !names.has(u.toLowerCase()) && !bases.has(base(u)));
}
