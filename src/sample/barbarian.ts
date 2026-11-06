/**
 * "Barbarian_Test" — a simplified, original low-poly test character (CC0), styled after the
 * owner's own barbarian concept: bare muscular torso, fur shoulder pad on the left shoulder,
 * diagonal strap, belt with metal buckle, layered leather kilt, wrist wraps, fur knee cuffs,
 * laced boots, long dark hair and beard. Built from boxes on the standard 15-joint test rig,
 * so every test clip plays on it. NOT a reconstruction of any image or existing model.
 */
import { buildCharacterGlb, rot, X, Z, type BoxDef, type CharacterDesign, type Clip } from './mannequin';

const LEATHER = 0;
const SKIN = 1;
const HAIR = 2;
const METAL = 3;
// atlas rows of material 0
const R_LEATHER = 0;
const R_FUR = 1;
const R_STRAP = 2;
const R_BOOT = 3;

const B = (c: [number, number, number], s: [number, number, number], joint: number, mat: number, uvRow = 0): BoxDef => ({ c, s, joint, mat, uvRow });

const boxes: BoxDef[] = [
  // --- torso (bare, broad) ---
  B([0, 1.28, 0], [0.36, 0.3, 0.21], 1, SKIN),
  B([0, 1.5, 0], [0.44, 0.28, 0.25], 2, SKIN),
  B([0, 1.52, 0.128], [0.34, 0.12, 0.01], 2, SKIN), // pectoral shelf
  B([0, 1.69, 0], [0.12, 0.09, 0.11], 3, SKIN),
  // diagonal-ish strap (stepped) across the chest
  ...[0, 1, 2, 3, 4, 5, 6].map((i) =>
    B([0.15 - i * 0.045, 1.62 - i * 0.068, i < 3 ? 0.137 : 0.112], [0.07, 0.09, 0.012], i < 3 ? 2 : 1, LEATHER, R_STRAP),
  ),
  // fur pad on the character's left shoulder (+X)
  B([0.24, 1.64, 0], [0.26, 0.12, 0.3], 2, LEATHER, R_FUR),
  B([0.15, 1.53, 0.06], [0.16, 0.14, 0.2], 2, LEATHER, R_FUR),
  // --- head ---
  B([0, 1.86, 0], [0.2, 0.24, 0.22], 4, SKIN),
  B([0, 1.78, 0.1], [0.16, 0.09, 0.05], 4, HAIR), // beard
  B([0, 1.835, 0.112], [0.1, 0.02, 0.02], 4, HAIR), // moustache
  B([0, 1.99, -0.01], [0.23, 0.06, 0.25], 4, HAIR), // top
  B([0, 1.8, -0.115], [0.25, 0.34, 0.06], 4, HAIR), // long back hair
  B([0.115, 1.81, -0.01], [0.04, 0.3, 0.19], 4, HAIR), // side locks
  B([-0.115, 1.81, -0.01], [0.04, 0.3, 0.19], 4, HAIR),
  // --- arms ---
  ...[1, -1].flatMap((sx) => {
    const ua = sx > 0 ? 5 : 8;
    const la = sx > 0 ? 6 : 9;
    const hd = sx > 0 ? 7 : 10;
    return [
      B([0.3 * sx, 1.46, 0], [0.14, 0.3, 0.14], ua, SKIN),
      B([0.3 * sx, 1.18, 0], [0.12, 0.26, 0.12], la, SKIN),
      B([0.3 * sx, 1.1, 0], [0.135, 0.12, 0.135], la, LEATHER, R_STRAP), // wrist wrap
      B([0.3 * sx, 1.38, 0], [0.15, 0.04, 0.15], ua, LEATHER, R_STRAP), // arm band
      B([0.3 * sx, 0.97, 0], [0.09, 0.11, 0.07], hd, SKIN),
    ];
  }),
  // --- belt & kilt ---
  B([0, 1.1, 0], [0.4, 0.07, 0.24], 0, LEATHER, R_STRAP),
  B([0, 1.1, 0.125], [0.08, 0.055, 0.02], 0, METAL),
  B([0, 1.0, 0], [0.37, 0.15, 0.225], 0, LEATHER, R_LEATHER),
  B([0, 0.82, 0.105], [0.22, 0.27, 0.03], 0, LEATHER, R_LEATHER), // front flap
  B([0, 0.83, -0.105], [0.26, 0.26, 0.03], 0, LEATHER, R_LEATHER), // back flap
  // --- legs ---
  ...[1, -1].flatMap((sx) => {
    const ul = sx > 0 ? 11 : 13;
    const ll = sx > 0 ? 12 : 14;
    return [
      B([0.12 * sx, 0.86, 0], [0.17, 0.2, 0.18], ul, LEATHER, R_LEATHER), // side kilt panel
      B([0.1 * sx, 0.68, 0], [0.155, 0.36, 0.155], ul, SKIN),
      B([0.1 * sx, 0.47, 0], [0.18, 0.1, 0.18], ll, LEATHER, R_FUR), // fur knee cuff
      B([0.1 * sx, 0.25, 0], [0.145, 0.36, 0.145], ll, LEATHER, R_BOOT),
      B([0.1 * sx, 0.04, 0.05], [0.14, 0.08, 0.26], ll, LEATHER, R_LEATHER),
    ];
  }),
];

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function texture(): Uint8Array {
  const W = 64;
  const px = new Uint8Array(W * W * 4);
  const set = (x: number, y: number, r: number, g: number, b: number) => {
    const o = (y * W + x) * 4;
    px[o] = Math.max(0, Math.min(255, r));
    px[o + 1] = Math.max(0, Math.min(255, g));
    px[o + 2] = Math.max(0, Math.min(255, b));
    px[o + 3] = 255;
  };
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      const row = y >> 4;
      const ly = y & 15;
      const n = hash(x, y, row) - 0.5;
      if (row === R_LEATHER) {
        // worn brown leather with darker patches and a frayed lower edge
        const patch = hash(x >> 3, y >> 2, 7) > 0.7 ? -28 : 0;
        set(x, y, 118 + n * 30 + patch, 74 + n * 20 + patch * 0.7, 40 + n * 14 + patch * 0.5);
        if (ly >= 14 && hash(x, 0, 3) > 0.5) set(x, y, 70, 44, 24);
      } else if (row === R_FUR) {
        // cream fur: vertical strands
        const strand = hash(x, ly >> 2, 11) * 40 - 20;
        set(x, y, 214 + strand + n * 20, 200 + strand + n * 18, 172 + strand + n * 16);
      } else if (row === R_STRAP) {
        // dark strap with stitch lines near the edges
        const stitch = (ly === 2 || ly === 13) && x % 4 < 2;
        if (stitch) set(x, y, 168, 140, 100);
        else set(x, y, 72 + n * 16, 46 + n * 10, 28 + n * 8);
      } else {
        // boot leather with cross lacing
        const u = x % 16;
        const lace = Math.abs(u - ly) <= 0.6 || Math.abs(15 - u - ly) <= 0.6;
        if (lace && x > 8 && x < 56) set(x, y, 206, 186, 150);
        else set(x, y, 96 + n * 22, 60 + n * 14, 34 + n * 10);
      }
    }
  return px;
}

const flexRoar: Clip = {
  name: 'Flex_Roar',
  tracks: [
    rot(5, Z, [[0, 0], [0.5, 85], [1.5, 85], [2.0, 0]]),
    rot(8, Z, [[0, 0], [0.5, -85], [1.5, -85], [2.0, 0]]),
    rot(6, Z, [[0, 0], [0.5, 80], [1.0, 95], [1.5, 80], [2.0, 0]]),
    rot(9, Z, [[0, 0], [0.5, -80], [1.0, -95], [1.5, -80], [2.0, 0]]),
    rot(4, X, [[0, 0], [0.6, -18], [1.4, -18], [2.0, 0]]),
    rot(2, X, [[0, 0], [0.6, -8], [1.4, -8], [2.0, 0]]),
  ],
};

export const BARBARIAN: CharacterDesign = {
  meshName: 'Barbarian_Test',
  rigName: 'BarbarianRig',
  generator: 'My 3D Game Studio – procedural Barbarian_Test (CC0)',
  imageName: 'BarbarianAtlas',
  boxes,
  materials: [
    { name: 'Leather_Fur_Atlas', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.85 } },
    { name: 'Skin', pbrMetallicRoughness: { baseColorFactor: [0.86, 0.58, 0.42, 1], metallicFactor: 0, roughnessFactor: 0.6 } },
    { name: 'Hair_Beard', pbrMetallicRoughness: { baseColorFactor: [0.07, 0.05, 0.04, 1], metallicFactor: 0, roughnessFactor: 0.7 } },
    { name: 'Metal_Buckle', pbrMetallicRoughness: { baseColorFactor: [0.62, 0.62, 0.64, 1], metallicFactor: 0.9, roughnessFactor: 0.35 } },
  ],
  texture,
  magFilter: 9729,
  extraClips: [flexRoar],
};

export const BARBARIAN_INFO = { boxes: boxes.length, materials: 4 };

export function buildBarbarianGlb(deflate: (d: Uint8Array) => Uint8Array): Uint8Array {
  return buildCharacterGlb(deflate, BARBARIAN);
}
