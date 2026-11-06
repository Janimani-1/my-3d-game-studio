/**
 * "Studio Combat Pack" — 17 original, hand-keyframed combat animations (CC0, authored for this project).
 * Authored on the 15-joint studio mannequin rig (rest pose: arms down, all joint rotations identity,
 * +Y up, character faces +Z, character-left = +X). The app retargets these clips to other humanoid
 * skeletons (Mixamo / Blender / Unreal / Meshy naming) at import time.
 */
import { buildCharacterGlb, MANNEQUIN, type CharacterDesign, type Clip, type Track } from './mannequin';

type E = [number, number, number]; // Euler XYZ degrees
interface Pose {
  r?: Partial<Record<number, E>>; // joint index → rotation (0 = Hips)
  h?: E; // hips translation offset from rest (metres)
  noBase?: boolean;
}

// joint indices of the mannequin rig
const HIPS = 0, SPINE = 1, CHEST = 2, NECK = 3, HEAD = 4, LUA = 5, LLA = 6, RUA = 8, RLA = 9, LUL = 11, LLL = 12, RUL = 13, RLL = 14;
const HIPS_REST: E = [0, 1.0, 0];

/** Fighting guard used as the default for unspecified joints. */
const BASE: Record<number, E> = {
  [HIPS]: [0, 0, 0], [SPINE]: [0, 0, 0], [CHEST]: [5, 0, 0], [NECK]: [0, 0, 0], [HEAD]: [-5, 0, 0],
  [LUA]: [-45, 0, 12], [LLA]: [-115, 0, 0], [RUA]: [-35, 0, -12], [RLA]: [-120, 0, 0],
  [LUL]: [-18, 0, 4], [LLL]: [28, 0, 0], [RUL]: [8, 0, -4], [RLL]: [18, 0, 0],
};
const BASE_H: E = [0, -0.05, 0];

function q(axis: 0 | 1 | 2, deg: number): [number, number, number, number] {
  const a = (deg * Math.PI) / 360;
  const v: [number, number, number, number] = [0, 0, 0, Math.cos(a)];
  v[axis] = Math.sin(a);
  return v;
}
function mul(a: number[], b: number[]): [number, number, number, number] {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}
/** Euler XYZ (same convention as THREE.Euler 'XYZ') → quaternion. */
export function eulerQuat([x, y, z]: E): [number, number, number, number] {
  return mul(mul(q(0, x), q(1, y)), q(2, z));
}

function clip(name: string, keys: [number, Pose][]): Clip {
  const joints = new Set<number>(Object.keys(BASE).map(Number));
  for (const [, p] of keys) for (const j of Object.keys(p.r ?? {})) joints.add(Number(j));
  const times = keys.map((k) => k[0]);
  const tracks: Track[] = [];
  for (const j of [...joints].sort((a, b) => a - b)) {
    const values: number[][] = [];
    let prev: number[] | null = null;
    for (const [, p] of keys) {
      let v: number[] = eulerQuat(p.r?.[j] ?? (p.noBase ? [0, 0, 0] : BASE[j] ?? [0, 0, 0]));
      // keep quaternion signs continuous for smooth interpolation
      if (prev && v[0] * prev[0] + v[1] * prev[1] + v[2] * prev[2] + v[3] * prev[3] < 0) v = v.map((x) => -x);
      values.push(v);
      prev = v;
    }
    tracks.push({ joint: j, path: 'rotation', times, values });
  }
  tracks.push({ joint: HIPS, path: 'translation', times, values: keys.map(([, p]) => { const h = p.h ?? BASE_H; return [HIPS_REST[0] + h[0], HIPS_REST[1] + h[1], HIPS_REST[2] + h[2]]; }) });
  return { name, tracks };
}

const crouch = (d: number): Partial<Record<number, E>> => ({ [LUL]: [-40 * d, 0, 4], [LLL]: [85 * d, 0, 0], [RUL]: [-35 * d, 0, -4], [RLL]: [80 * d, 0, 0] });
const tuck: Partial<Record<number, E>> = { [LUL]: [-110, 0, 4], [LLL]: [130, 0, 0], [RUL]: [-110, 0, -4], [RLL]: [130, 0, 0] };
const curl: Partial<Record<number, E>> = { [SPINE]: [35, 0, 0], [CHEST]: [35, 0, 0], [NECK]: [25, 0, 0], [LUA]: [-90, 0, 10], [RUA]: [-90, 0, -10], [LLA]: [-60, 0, 0], [RLA]: [-60, 0, 0] };
const lying: Pose = {
  r: { [HIPS]: [-90, 0, 0], [LUL]: [-20, 0, 6], [LLL]: [10, 0, 0], [RUL]: [-15, 0, -6], [RLL]: [10, 0, 0], [LUA]: [-20, 0, 80], [RUA]: [-20, 0, -80], [LLA]: [-10, 0, 0], [RLA]: [-10, 0, 0], [HEAD]: [15, 0, 0], [CHEST]: [0, 0, 0] },
  h: [0, -0.85, -0.65],
};

export const COMBAT_CLIPS: Clip[] = [
  clip('Fight_Stance', [[0, {}], [0.8, { h: [0, -0.08, 0], r: { [CHEST]: [9, 0, 0] } }], [1.6, {}]]),
  clip('Jab_L', [[0, {}], [0.12, { r: { [LUA]: [-88, 0, 4], [LLA]: [-5, 0, 0], [CHEST]: [5, -15, 0] }, h: [0, -0.05, 0.04] }], [0.25, { r: { [LUA]: [-88, 0, 4], [LLA]: [-5, 0, 0], [CHEST]: [5, -15, 0] }, h: [0, -0.05, 0.04] }], [0.5, {}]]),
  clip('Cross_R', [[0, {}], [0.15, { r: { [RUA]: [-90, 0, -3], [RLA]: [-5, 0, 0], [SPINE]: [0, 20, 0], [CHEST]: [5, 10, 0], [RUL]: [5, 0, -4] }, h: [0, -0.06, 0.06] }], [0.3, { r: { [RUA]: [-90, 0, -3], [RLA]: [-5, 0, 0], [SPINE]: [0, 20, 0], [CHEST]: [5, 10, 0] }, h: [0, -0.06, 0.06] }], [0.6, {}]]),
  clip('Hook_R', [[0, {}], [0.15, { r: { [RUA]: [-60, 0, -60], [RLA]: [-60, 0, 0], [SPINE]: [0, -15, 0] } }], [0.32, { r: { [RUA]: [-85, 0, -25], [RLA]: [-75, 0, 0], [SPINE]: [0, 35, 0], [CHEST]: [5, 10, 0] } }], [0.42, { r: { [RUA]: [-85, 0, -25], [RLA]: [-75, 0, 0], [SPINE]: [0, 35, 0], [CHEST]: [5, 10, 0] } }], [0.7, {}]]),
  clip('Uppercut_R', [[0, {}], [0.15, { h: [0, -0.15, 0], r: { ...crouch(0.6), [RUA]: [-20, 0, -10], [RLA]: [-100, 0, 0], [SPINE]: [0, -10, 0] } }], [0.32, { h: [0, 0, 0.02], r: { [RUA]: [-160, 0, -5], [RLA]: [-70, 0, 0], [SPINE]: [0, 20, 0], [CHEST]: [-10, 0, 0] } }], [0.42, { h: [0, 0, 0.02], r: { [RUA]: [-160, 0, -5], [RLA]: [-70, 0, 0], [SPINE]: [0, 20, 0], [CHEST]: [-10, 0, 0] } }], [0.7, {}]]),
  clip('Spinning_Backfist', [
    [0, {}],
    [0.2, { r: { [HIPS]: [0, -90, 0] } }],
    [0.4, { r: { [HIPS]: [0, -180, 0], [RUA]: [-80, 0, -80], [RLA]: [-10, 0, 0] } }],
    [0.55, { r: { [HIPS]: [0, -270, 0], [RUA]: [-80, 0, -80], [RLA]: [-10, 0, 0] } }],
    [0.7, { r: { [HIPS]: [0, -360, 0], [RUA]: [-85, 0, -40], [RLA]: [-10, 0, 0] } }],
    [0.9, { r: { [HIPS]: [0, -360, 0] } }],
  ]),
  clip('Front_Kick_R', [
    [0, {}],
    [0.2, { r: { [RUL]: [-95, 0, 0], [RLL]: [110, 0, 0], [LUL]: [-5, 0, 4], [LLL]: [15, 0, 0], [CHEST]: [-5, 0, 0] } }],
    [0.38, { r: { [RUL]: [-100, 0, 0], [RLL]: [0, 0, 0], [LUL]: [-5, 0, 4], [LLL]: [10, 0, 0], [CHEST]: [-12, 0, 0], [SPINE]: [-5, 0, 0] } }],
    [0.5, { r: { [RUL]: [-100, 0, 0], [RLL]: [0, 0, 0], [LUL]: [-5, 0, 4], [LLL]: [10, 0, 0], [CHEST]: [-12, 0, 0], [SPINE]: [-5, 0, 0] } }],
    [0.65, { r: { [RUL]: [-95, 0, 0], [RLL]: [110, 0, 0], [LUL]: [-5, 0, 4], [LLL]: [15, 0, 0] } }],
    [0.9, {}],
  ]),
  clip('Side_Kick_R', [
    [0, {}],
    [0.2, { r: { [HIPS]: [0, 80, 0], [RUL]: [-60, 0, -20], [RLL]: [100, 0, 0], [SPINE]: [0, 0, -15] } }],
    [0.42, { r: { [HIPS]: [0, 85, 0], [RUL]: [0, 0, -95], [RLL]: [0, 0, 0], [SPINE]: [0, 0, -30], [CHEST]: [0, 0, -10], [LLL]: [10, 0, 0] } }],
    [0.6, { r: { [HIPS]: [0, 85, 0], [RUL]: [0, 0, -95], [RLL]: [0, 0, 0], [SPINE]: [0, 0, -30], [CHEST]: [0, 0, -10], [LLL]: [10, 0, 0] } }],
    [0.78, { r: { [HIPS]: [0, 80, 0], [RUL]: [-60, 0, -20], [RLL]: [100, 0, 0], [SPINE]: [0, 0, -15] } }],
    [1.0, {}],
  ]),
  clip('Spin_Kick_360', [
    [0, {}],
    [0.25, { r: { [HIPS]: [0, -90, 0] } }],
    [0.45, { r: { [HIPS]: [0, -180, 0], [RUL]: [-30, 0, -85], [RLL]: [10, 0, 0], [SPINE]: [0, 0, -25] } }],
    [0.65, { r: { [HIPS]: [0, -270, 0], [RUL]: [-30, 0, -85], [RLL]: [10, 0, 0], [SPINE]: [0, 0, -25] } }],
    [0.85, { r: { [HIPS]: [0, -360, 0], [RUL]: [-20, 0, -40], [RLL]: [40, 0, 0] } }],
    [1.2, { r: { [HIPS]: [0, -360, 0] } }],
  ]),
  clip('Jump_Kick_Front', [
    [0, {}],
    [0.15, { h: [0, -0.2, 0], r: crouch(1) }],
    [0.4, { h: [0, 0.45, 0.12], r: { [LUL]: [-90, 0, 4], [LLL]: [120, 0, 0], [RUL]: [-95, 0, 0], [RLL]: [0, 0, 0], [CHEST]: [-10, 0, 0], [LUA]: [-20, 0, 40], [RUA]: [-20, 0, -40] } }],
    [0.55, { h: [0, 0.42, 0.15], r: { [LUL]: [-90, 0, 4], [LLL]: [120, 0, 0], [RUL]: [-95, 0, 0], [RLL]: [0, 0, 0], [CHEST]: [-10, 0, 0], [LUA]: [-20, 0, 40], [RUA]: [-20, 0, -40] } }],
    [0.8, { h: [0, -0.18, 0.05], r: crouch(1) }],
    [1.1, {}],
  ]),
  clip('Backflip', [
    [0, {}],
    [0.2, { h: [0, -0.25, 0], r: { ...crouch(1.1), [LUA]: [30, 0, 10], [RUA]: [30, 0, -10], [LLA]: [-10, 0, 0], [RLA]: [-10, 0, 0] } }],
    [0.4, { h: [0, 0.35, -0.05], r: { [HIPS]: [-60, 0, 0], [LUA]: [-170, 0, 10], [RUA]: [-170, 0, -10], [LLA]: [0, 0, 0], [RLA]: [0, 0, 0], [LUL]: [-10, 0, 4], [LLL]: [10, 0, 0], [RUL]: [-10, 0, -4], [RLL]: [10, 0, 0] } }],
    [0.55, { h: [0, 0.75, -0.2], r: { [HIPS]: [-150, 0, 0], ...tuck, [LUA]: [-90, 0, 10], [RUA]: [-90, 0, -10] } }],
    [0.7, { h: [0, 0.7, -0.35], r: { [HIPS]: [-240, 0, 0], ...tuck, [LUA]: [-90, 0, 10], [RUA]: [-90, 0, -10] } }],
    [0.85, { h: [0, 0.3, -0.45], r: { [HIPS]: [-320, 0, 0], [LUL]: [-40, 0, 4], [LLL]: [40, 0, 0], [RUL]: [-40, 0, -4], [RLL]: [40, 0, 0], [LUA]: [-60, 0, 30], [RUA]: [-60, 0, -30] } }],
    [1.0, { h: [0, -0.2, -0.5], r: { [HIPS]: [-360, 0, 0], ...crouch(1) } }],
    [1.3, { h: [0, -0.05, -0.5], r: { [HIPS]: [-360, 0, 0] } }],
  ]),
  clip('Roll_Forward', [
    [0, {}],
    [0.2, { h: [0, -0.45, 0.1], r: { [HIPS]: [40, 0, 0], ...tuck, ...curl } }],
    [0.4, { h: [0, -0.55, 0.4], r: { [HIPS]: [130, 0, 0], ...tuck, ...curl } }],
    [0.6, { h: [0, -0.55, 0.75], r: { [HIPS]: [220, 0, 0], ...tuck, ...curl } }],
    [0.8, { h: [0, -0.5, 1.0], r: { [HIPS]: [310, 0, 0], ...tuck, ...curl } }],
    [0.95, { h: [0, -0.4, 1.15], r: { [HIPS]: [360, 0, 0], ...crouch(1.2) } }],
    [1.2, { h: [0, -0.05, 1.2], r: { [HIPS]: [360, 0, 0] } }],
  ]),
  clip('Hit_React', [[0, {}], [0.1, { h: [0, -0.05, -0.08], r: { [SPINE]: [-15, 0, 0], [CHEST]: [-15, 0, 0], [HEAD]: [-25, 0, 0], [LUA]: [-20, 0, 30], [RUA]: [-20, 0, -30], [LLA]: [-40, 0, 0], [RLA]: [-40, 0, 0] } }], [0.25, { h: [0, -0.05, -0.1], r: { [SPINE]: [-12, 0, 0], [CHEST]: [-12, 0, 0], [HEAD]: [-20, 0, 0], [LUA]: [-20, 0, 30], [RUA]: [-20, 0, -30], [LLA]: [-40, 0, 0], [RLA]: [-40, 0, 0] } }], [0.6, {}]]),
  clip('Fall_Back', [
    [0, {}],
    [0.15, { h: [0, -0.08, -0.1], r: { [SPINE]: [-15, 0, 0], [CHEST]: [-15, 0, 0], [HEAD]: [-25, 0, 0] } }],
    [0.45, { h: [0, -0.5, -0.35], r: { [HIPS]: [-45, 0, 0], [LUL]: [-60, 0, 4], [LLL]: [60, 0, 0], [RUL]: [-50, 0, -4], [RLL]: [50, 0, 0], [LUA]: [-120, 0, 30], [RUA]: [-120, 0, -30] } }],
    [0.7, { h: [0, -0.82, -0.6], r: { [HIPS]: [-90, 0, 0], [LUL]: [-60, 0, 4], [LLL]: [30, 0, 0], [RUL]: [-50, 0, -4], [RLL]: [30, 0, 0], [LUA]: [-90, 0, 60], [RUA]: [-90, 0, -60] } }],
    [0.85, { h: [0, -0.78, -0.62], r: { [HIPS]: [-88, 0, 0], [LUL]: [-40, 0, 4], [LLL]: [20, 0, 0], [RUL]: [-30, 0, -4], [RLL]: [20, 0, 0], [LUA]: [-60, 0, 70], [RUA]: [-60, 0, -70] } }],
    [1.4, lying],
  ]),
  clip('Get_Up', [
    [0, lying],
    [0.4, { h: [0, -0.75, -0.6], r: { [HIPS]: [-30, 0, 0], [SPINE]: [30, 0, 0], [CHEST]: [20, 0, 0], [LUL]: [-100, 0, 6], [LLL]: [120, 0, 0], [RUL]: [-90, 0, -6], [RLL]: [110, 0, 0], [LUA]: [-30, 0, 20], [RUA]: [-30, 0, -20], [LLA]: [-20, 0, 0], [RLA]: [-20, 0, 0] } }],
    [0.8, { h: [0, -0.45, -0.55], r: { [HIPS]: [20, 0, 0], [LUL]: [-100, 0, 6], [LLL]: [140, 0, 0], [RUL]: [-80, 0, -6], [RLL]: [130, 0, 0], [LUA]: [-60, 0, 15], [RUA]: [-60, 0, -15] } }],
    [1.2, { h: [0, -0.2, -0.6], r: { [HIPS]: [5, 0, 0], [LUL]: [-40, 0, 4], [LLL]: [60, 0, 0], [RUL]: [-30, 0, -4], [RLL]: [50, 0, 0] } }],
    [1.6, { h: [0, -0.05, -0.65] }],
  ]),
  clip('Block_High', [[0, {}], [0.15, { h: [0, -0.1, -0.03], r: { [LUA]: [-100, 0, 25], [LLA]: [-100, 0, 0], [RUA]: [-100, 0, -25], [RLA]: [-100, 0, 0], [HEAD]: [10, 0, 0] } }], [0.6, { h: [0, -0.1, -0.03], r: { [LUA]: [-100, 0, 25], [LLA]: [-100, 0, 0], [RUA]: [-100, 0, -25], [RLA]: [-100, 0, 0], [HEAD]: [10, 0, 0] } }], [0.8, {}]]),
  clip('Dodge_Side', [[0, {}], [0.2, { h: [0.35, -0.2, 0], r: { [HIPS]: [0, 0, -15], [LUL]: [-10, 0, 25], [RUL]: [0, 0, 5], [SPINE]: [0, 0, 10] } }], [0.45, { h: [0.35, -0.2, 0], r: { [HIPS]: [0, 0, -15], [LUL]: [-10, 0, 25], [RUL]: [0, 0, 5], [SPINE]: [0, 0, 10] } }], [0.8, {}]]),
];

export const COMBAT_PACK: CharacterDesign = {
  ...MANNEQUIN,
  meshName: 'StudioCombatPack',
  rigName: 'StudioHumanoid',
  generator: 'My 3D Game Studio – Studio Combat Pack, 17 original clips (CC0)',
  clips: COMBAT_CLIPS,
};

export function buildCombatPackGlb(deflate: (d: Uint8Array) => Uint8Array): Uint8Array {
  return buildCharacterGlb(deflate, COMBAT_PACK);
}
