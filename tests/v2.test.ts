import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectHumanoid, missingSlots, sideOf, trackCompatibility } from '../src/core/rig';
import { MOVES, MOVE_CATEGORIES, clipsForMove, categoryOfClip } from '../src/core/catalog';
import { normaliseUrl } from '../src/core/backend';
import { migrateProject, SCHEMA_VERSION } from '../src/core/project';
import { defaultCombos } from '../src/ui/importLogic';
import { inspectGltf, parseContainer } from '../src/core/gltfInspect';

const ROBOT = new Uint8Array(readFileSync(new URL('../assets/robot-expressive.glb', import.meta.url)));

test('humanoid detection: bundled robot (Blender .L/.R naming)', () => {
  const { json } = parseContainer(ROBOT);
  const joints = new Set(json.skins.flatMap((s: any) => s.joints));
  const names = json.nodes.filter((_: any, i: number) => joints.has(i)).map((n: any) => n.name);
  const map = detectHumanoid(names);
  assert.equal(map.hips, 'Hips');
  assert.equal(map.head, 'Head');
  assert.equal(map.leftUpperArm, 'UpperArm.L');
  assert.equal(map.rightLowerLeg, 'LowerLeg.R');
  assert.equal(map.rightFoot, 'Foot.R');
});

test('humanoid detection: Mixamo and Unreal naming', () => {
  const mixamo = ['mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head', 'mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand', 'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand', 'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot', 'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot'];
  const m = detectHumanoid(mixamo);
  assert.deepEqual(missingSlots(m), []);
  assert.equal(m.leftUpperArm, 'mixamorig:LeftArm');
  assert.equal(m.rightLowerArm, 'mixamorig:RightForeArm');
  assert.equal(m.leftUpperLeg, 'mixamorig:LeftUpLeg');
  assert.equal(m.leftLowerLeg, 'mixamorig:LeftLeg');
  const ue = detectHumanoid(['pelvis', 'spine_01', 'spine_02', 'neck_01', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'thigh_r', 'calf_r', 'foot_r']);
  assert.equal(ue.hips, 'pelvis');
  assert.equal(ue.leftHand, 'hand_l');
  assert.equal(ue.rightUpperLeg, 'thigh_r');
  assert.equal(sideOf('Hand.R'), 'R');
  assert.equal(sideOf('LeftHand'), 'L');
});

test('humanoid detection: three.js-sanitized names (dots removed)', () => {
  const m = detectHumanoid(['Hips', 'Abdomen', 'Torso', 'Neck', 'Head', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'Palm2L', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'Palm2R', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR']);
  assert.equal(m.leftUpperArm, 'UpperArmL');
  assert.equal(m.rightLowerArm, 'LowerArmR');
  assert.equal(m.leftHand, 'Palm2L');
  assert.equal(m.rightUpperLeg, 'UpperLegR');
  assert.equal(m.leftFoot, 'FootL');
  assert.ok(missingSlots(m).length <= 1, JSON.stringify(missingSlots(m)));
  // mannequin (combat pack source) names
  const k = detectHumanoid(['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftUpperArm', 'LeftLowerArm', 'LeftHand', 'RightUpperArm', 'RightLowerArm', 'RightHand', 'LeftUpperLeg', 'LeftLowerLeg', 'RightUpperLeg', 'RightLowerLeg']);
  assert.equal(missingSlots(k).join(), 'leftFoot,rightFoot');
});

test('track compatibility detects mismatched skeletons', () => {
  assert.deepEqual(trackCompatibility(['Hips', 'Hips', 'Head'], ['Hips', 'Head', 'Foo']), { matched: 2, total: 2, missing: [] });
  assert.equal(trackCompatibility(['mixamorig:Hips'], ['Hips']).matched, 0);
});

test('catalog: every spec category present, unique ids, 3 languages', () => {
  const ids = new Set(MOVES.map((m) => m.id));
  assert.equal(ids.size, MOVES.length);
  for (const c of MOVE_CATEGORIES) assert.ok(MOVES.some((m) => m.cat === c), c);
  for (const m of MOVES) assert.ok(m.fa && m.de && m.en);
  assert.ok(MOVES.length >= 55);
});

test('catalog matching against robot clips', () => {
  const clips = inspectGltf(ROBOT).animations.map((a) => a.name);
  assert.equal(clips.length, 14);
  const byId = (id: string) => MOVES.find((m) => m.id === id)!;
  assert.deepEqual(clipsForMove(byId('run'), clips), ['Running']);
  assert.deepEqual(clipsForMove(byId('death'), clips), ['Death']);
  assert.deepEqual(clipsForMove(byId('backflip'), clips), []);
  assert.equal(categoryOfClip('Punch'), 'punch');
  assert.equal(categoryOfClip('Walking'), 'locomotion');
});

test('backend URL validation requires HTTPS except localhost', () => {
  assert.equal(normaliseUrl(' https://abc.trycloudflare.com/ '), 'https://abc.trycloudflare.com');
  assert.equal(normaliseUrl('http://localhost:8000'), 'http://localhost:8000');
  assert.throws(() => normaliseUrl('http://example.com'), /HTTPS/);
  assert.throws(() => normaliseUrl('not a url'), /invalid/);
  assert.throws(() => normaliseUrl(''), /empty/);
});

test('schema v1 → v2 migration adds combos, weapon and vfx defaults', () => {
  const p = migrateProject({ id: 'x', schemaVersion: 1, name: 'old', files: [], viewer: {} });
  assert.equal(p.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(p.combos, []);
  assert.equal(p.weapon.enabled, false);
  assert.equal(p.vfx.mode, 'projectile');
});

test('starter combo uses only clips that exist', () => {
  const c = defaultCombos(['Idle', 'Running', 'Jump', 'Punch', 'Wave']);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].steps.map((s) => s.clip), ['Idle', 'Running', 'Jump', 'Punch', 'Idle']);
  assert.equal(c[0].steps[3].eventVfx, 'projectile');
  assert.deepEqual(defaultCombos(['Dance']), []);
});

test('Studio Combat Pack: 17 clips, valid GLB, catalog coverage', async () => {
  const { deflateSync } = await import('node:zlib');
  const { buildCombatPackGlb, COMBAT_CLIPS } = await import('../src/sample/combatPack');
  const b = buildCombatPackGlb((d) => new Uint8Array(deflateSync(d)));
  const s = inspectGltf(b, 'combat-pack.glb');
  assert.equal(s.animations.length, 17);
  assert.deepEqual(s.warnings, []);
  assert.equal(s.joints, 15);
  const names = COMBAT_CLIPS.map((c) => c.name);
  for (const id of ['jab_l', 'jab_r', 'hook', 'uppercut', 'backfist', 'front_kick', 'side_kick', 'spin_kick', 'jump_kick', 'backflip', 'roll', 'hit', 'fall', 'recover', 'block', 'dodge', 'stance'])
    assert.ok(clipsForMove(MOVES.find((m) => m.id === id)!, names).length > 0, `catalog move ${id} not covered`);
  // quaternion tracks are unit length
  const { json, bin } = parseContainer(b);
  const acc = json.accessors[json.animations[6].samplers[0].output];
  const bv = json.bufferViews[acc.bufferView];
  const f = new Float32Array(bin!.buffer.slice(bin!.byteOffset + bv.byteOffset, bin!.byteOffset + bv.byteOffset + acc.count * 16));
  for (let i = 0; i < acc.count; i++) assert.ok(Math.abs(Math.hypot(f[i * 4], f[i * 4 + 1], f[i * 4 + 2], f[i * 4 + 3]) - 1) < 1e-4);
});
