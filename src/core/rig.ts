/** Humanoid bone detection (pure, unit-tested). Works with Mixamo ("mixamorig:LeftHand"),
 *  Blender (".L/.R"), Unreal ("hand_l") and VRM-like ("leftHand") naming. */

export type Slot =
  | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'leftUpperArm' | 'leftLowerArm' | 'leftHand' | 'rightUpperArm' | 'rightLowerArm' | 'rightHand'
  | 'leftUpperLeg' | 'leftLowerLeg' | 'leftFoot' | 'rightUpperLeg' | 'rightLowerLeg' | 'rightFoot';

export const SLOTS: Slot[] = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

function norm(n: string): string {
  return n.replace(/^.*[:|]/, '').toLowerCase();
}

const PART_WORDS = '(arm|hand|leg|foot|shoulder|palm\\d?|thigh|calf|shin|knee|ankle|wrist|clavicle|upleg|elbow)';
const TRAIL_L = new RegExp(`${PART_WORDS}l$`);
const TRAIL_R = new RegExp(`${PART_WORDS}r$`);

export function sideOf(name: string): 'L' | 'R' | null {
  const n = norm(name);
  // sanitized Blender names lose the dot: "UpperArm.L" → "UpperArmL"
  if (TRAIL_L.test(n)) return 'L';
  if (TRAIL_R.test(n)) return 'R';
  if (/(^|[^a-z])(left|l)([^a-z]|$)|left|\.l$|_l$|^l_/.test(n) && !/(^|[^a-z])r([^a-z]|$)|right/.test(n)) return 'L';
  if (/(^|[^a-z])(right|r)([^a-z]|$)|right|\.r$|_r$|^r_/.test(n)) return 'R';
  return null;
}

const PART: [Exclude<Slot, `left${string}` | `right${string}`> | 'upperArm' | 'lowerArm' | 'hand' | 'upperLeg' | 'lowerLeg' | 'foot', RegExp][] = [
  ['hand', /hand|palm|wrist/],
  ['lowerArm', /forearm|lowerarm|lower_arm|elbow/],
  ['upperArm', /upperarm|upper_arm|(^|[^a-z])arm([^a-z]|$)|(left|right)arm$|shoulder(?!.*blade)/],
  ['foot', /foot|ankle/],
  ['lowerLeg', /lowerleg|lower_leg|calf|shin|knee|(left|right)leg$|(^|[^a-z])leg([^a-z]|$)/],
  ['upperLeg', /upperleg|upper_leg|thigh|upleg/],
  ['hips', /hips|pelvis/],
  ['head', /head(?!top|_end)/],
  ['neck', /neck/],
  ['chest', /chest|torso|spine2|spine_02|upperchest/],
  ['spine', /spine|abdomen/],
];

/** Map bone names to humanoid slots. First match by hierarchy order wins. */
export function detectHumanoid(boneNames: string[]): Partial<Record<Slot, string>> {
  const out: Partial<Record<Slot, string>> = {};
  for (const name of boneNames) {
    const n = norm(name);
    if (/end$|_end|nub|finger|thumb|index|middle|ring|pinky|toe|eye|jaw|pole|ik|target/.test(n)) continue;
    for (const [part, re] of PART) {
      if (!re.test(n)) continue;
      let slot: Slot;
      if (['hand', 'lowerArm', 'upperArm', 'foot', 'lowerLeg', 'upperLeg'].includes(part)) {
        const s = sideOf(name);
        if (!s) break;
        slot = ((s === 'L' ? 'left' : 'right') + part[0].toUpperCase() + part.slice(1)) as Slot;
      } else slot = part as Slot;
      // shoulder bones often precede upper arms: prefer a later "arm" match for upperArm
      if (part === 'upperArm' && /shoulder|clavicle/.test(n) && out[slot]) break;
      if (!out[slot] || (part === 'upperArm' && /shoulder|clavicle/.test(norm(out[slot]!)))) out[slot] = name;
      break;
    }
  }
  return out;
}

export function missingSlots(map: Partial<Record<Slot, string>>): Slot[] {
  return SLOTS.filter((s) => !map[s]);
}

/** Compare animation track targets with a model's node names. */
export function trackCompatibility(trackNodeNames: string[], modelNodeNames: string[]): { matched: number; total: number; missing: string[] } {
  const have = new Set(modelNodeNames);
  const uniq = [...new Set(trackNodeNames)];
  const missing = uniq.filter((n) => !have.has(n));
  return { matched: uniq.length - missing.length, total: uniq.length, missing };
}
