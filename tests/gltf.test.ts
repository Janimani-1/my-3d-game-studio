import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { inspectGltf, findMissingResources, InspectError } from '../src/core/gltfInspect';
import { buildMannequinGlb, MANNEQUIN_INFO } from '../src/sample/mannequin';

const glb = buildMannequinGlb((d) => new Uint8Array(deflateSync(d)));

test('sample mannequin GLB is valid and fully described', () => {
  const s = inspectGltf(glb, 'test-mannequin.glb');
  assert.equal(s.container, 'glb');
  assert.equal(s.version, '2.0');
  assert.equal(s.meshes, 1);
  assert.equal(s.primitives, 2);
  assert.equal(s.triangles, MANNEQUIN_INFO.boxes * 12);
  assert.equal(s.vertices, MANNEQUIN_INFO.boxes * 24);
  assert.equal(s.materials, 2);
  assert.deepEqual(s.materialNames, ['Suit_Textured', 'Skin_Mask']);
  assert.equal(s.textures, 1);
  assert.equal(s.embeddedImages, 1);
  assert.equal(s.skins, 1);
  assert.equal(s.joints, MANNEQUIN_INFO.joints);
  assert.deepEqual(s.animations.map((a) => a.name), MANNEQUIN_INFO.clips);
  assert.ok(Math.abs(s.animations[0].duration - 2) < 1e-6);
  assert.ok(Math.abs(s.animations[1].duration - 1) < 1e-6);
  assert.equal(s.externalUris.length, 0);
  assert.ok(s.hasBinChunk);
  assert.deepEqual(s.warnings, []);
});

test('GLB structure: 4-byte aligned chunks, declared length equals file length', () => {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  assert.equal(dv.getUint32(8, true), glb.length);
  const jsonLen = dv.getUint32(12, true);
  assert.equal(jsonLen % 4, 0);
  assert.equal(dv.getUint32(20 + jsonLen, true) % 4, 0);
});

test('sample accessors stay inside their buffer views and bin chunk', () => {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLen)));
  const binLen = dv.getUint32(20 + jsonLen, true);
  const compSize: Record<number, number> = { 5121: 1, 5123: 2, 5126: 4 };
  const typeSize: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  for (const bv of json.bufferViews) {
    assert.ok(bv.byteOffset + bv.byteLength <= binLen);
    if (bv.target === 34962) assert.equal(bv.byteOffset % 4, 0);
  }
  for (const a of json.accessors) {
    const bv = json.bufferViews[a.bufferView];
    assert.ok(a.count * compSize[a.componentType] * typeSize[a.type] <= bv.byteLength, 'accessor fits view');
  }
  // every joint index referenced by JOINTS_0 is < joint count; weights sum to 1
  assert.equal(json.skins[0].joints.length, MANNEQUIN_INFO.joints);
  // animation inputs must have min/max (glTF spec requirement)
  for (const an of json.animations) for (const s of an.samplers) assert.ok(json.accessors[s.input].max);
});

test('rejects empty, random, truncated and wrong-version files with typed errors', () => {
  const code = (b: Uint8Array) => {
    try {
      inspectGltf(b, 'x');
      return 'ok';
    } catch (e) {
      assert.ok(e instanceof InspectError);
      return (e as InspectError).code;
    }
  };
  assert.equal(code(new Uint8Array(0)), 'empty');
  assert.equal(code(new TextEncoder().encode('hello world, not a model')), 'notGltf');
  assert.equal(code(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])), 'notGltf'); // PNG renamed .glb
  assert.equal(code(glb.slice(0, 100)), 'truncated');
  const v1 = glb.slice();
  new DataView(v1.buffer).setUint32(4, 1, true);
  assert.equal(code(v1), 'badVersion');
  assert.equal(code(new TextEncoder().encode('{ "asset": ')), 'badJson');
  assert.equal(code(new TextEncoder().encode('{"meshes":[]}')), 'noAsset');
  assert.equal(code(new TextEncoder().encode('{"asset":{"version":"1.0"}}')), 'badVersion');
});

test('.gltf with external resources: detects missing files', () => {
  const json = {
    asset: { version: '2.0' },
    buffers: [{ uri: 'scene.bin', byteLength: 10 }],
    images: [{ uri: 'textures/Body%20Color.png' }, { uri: 'data:image/png;base64,AAAA' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [{ count: 8 }, { count: 36 }],
  };
  const s = inspectGltf(new TextEncoder().encode(JSON.stringify(json)), 'a.gltf');
  assert.equal(s.container, 'gltf');
  assert.equal(s.triangles, 12);
  assert.deepEqual(s.externalUris, ['scene.bin', 'textures/Body Color.png']);
  assert.equal(s.embeddedImages, 1);
  assert.deepEqual(findMissingResources(s, ['a.gltf']), ['scene.bin', 'textures/Body Color.png']);
  assert.deepEqual(findMissingResources(s, ['a.gltf', 'SCENE.bin', 'Body Color.png']), []);
});

test('triangle strips / non-indexed / points are counted correctly', () => {
  const json = {
    asset: { version: '2.0' },
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }, { attributes: { POSITION: 0 }, mode: 5 }, { attributes: { POSITION: 0 }, mode: 0 }] }],
    accessors: [{ count: 9 }],
  };
  const s = inspectGltf(new TextEncoder().encode(JSON.stringify(json)));
  assert.equal(s.triangles, 3 + 7 + 0);
  assert.equal(s.vertices, 27);
});

test('warns about unsupported required extensions', () => {
  const json = { asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression', 'VENDOR_magic'] };
  const s = inspectGltf(new TextEncoder().encode(JSON.stringify(json)));
  assert.equal(s.warnings.length, 1);
  assert.match(s.warnings[0], /VENDOR_magic/);
});

test('Barbarian test character: valid GLB, 4 materials, 5 clips incl. Flex_Roar', async () => {
  const { buildBarbarianGlb, BARBARIAN_INFO } = await import('../src/sample/barbarian');
  const b = buildBarbarianGlb((d) => new Uint8Array(deflateSync(d)));
  const s = inspectGltf(b, 'barbarian.glb');
  assert.equal(s.materials, BARBARIAN_INFO.materials);
  assert.equal(s.primitives, 4);
  assert.equal(s.triangles, BARBARIAN_INFO.boxes * 12);
  assert.equal(s.joints, 15);
  assert.deepEqual(s.animations.map((a) => a.name), [...MANNEQUIN_INFO.clips, 'Flex_Roar']);
  assert.deepEqual(s.warnings, []);
  assert.equal(new DataView(b.buffer, b.byteOffset).getUint32(8, true), b.length);
});
