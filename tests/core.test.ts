import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, createZip, readZip } from '../src/core/zip';
import { buildBackupZip, parseBackupZip, duplicateName, migrateProject, SCHEMA_VERSION, DEFAULT_VIEWER, type Project } from '../src/core/project';
import { classify, checkSize, pickMainFile, safeName, sha256Hex, MAX_FILE_BYTES } from '../src/core/files';
import { DICTS, LANGS, translate } from '../src/core/i18n';

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('zip round-trip preserves bytes exactly, incl. Unicode names', () => {
  const bin = new Uint8Array(70000).map((_, i) => (i * 31) & 255);
  const entries = [
    { name: 'a.txt', data: new TextEncoder().encode('hello') },
    { name: 'dir/مدل.glb', data: bin },
    { name: 'empty.bin', data: new Uint8Array(0) },
  ];
  const z = createZip(entries);
  const back = readZip(z);
  assert.equal(back.length, 3);
  assert.equal(back[1].name, 'dir/مدل.glb');
  assert.deepEqual(back[1].data, bin);
  assert.equal(back[2].data.length, 0);
});

test('zip is readable by the system unzip tool (if installed)', () => {
  let hasUnzip = true;
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
  } catch {
    hasUnzip = false;
  }
  if (!hasUnzip) return;
  const dir = mkdtempSync(join(tmpdir(), 'z-'));
  const f = join(dir, 't.zip');
  writeFileSync(f, createZip([{ name: 'x/y.txt', data: new TextEncoder().encode('ok') }]));
  const out = execFileSync('unzip', ['-t', f]).toString();
  assert.match(out, /No errors/);
  execFileSync('unzip', ['-o', '-q', f, '-d', dir]);
  assert.ok(existsSync(join(dir, 'x/y.txt')));
});

test('zip reader rejects corruption and non-zip input', () => {
  const z = createZip([{ name: 'a', data: new Uint8Array([1, 2, 3, 4]) }]);
  const bad = z.slice();
  bad[30 + 1] ^= 0xff; // flip a data byte
  assert.throws(() => readZip(bad), /CRC/);
  assert.throws(() => readZip(new Uint8Array(100)), /Not a ZIP/);
});

test('zip rejects duplicate names', () => {
  assert.throws(() => createZip([{ name: 'a', data: new Uint8Array(1) }, { name: 'a', data: new Uint8Array(1) }]), /Duplicate/);
});

function sampleProject(): Project {
  return {
    id: 'p1',
    schemaVersion: SCHEMA_VERSION,
    name: 'Ninja test',
    createdAt: 1,
    updatedAt: 2,
    files: [
      { id: 'f1', name: 'hero.gltf', size: 3, type: 'model/gltf+json', sha256: 'x', role: 'main' },
      { id: 'f2', name: '../evil/hero.bin', size: 2, type: 'application/octet-stream', sha256: 'y', role: 'resource' },
    ],
    stats: null,
    viewer: { ...DEFAULT_VIEWER, grid: false },
    tags: [],
    source: 'import',
  };
}

test('backup zip round-trip restores project and original bytes', () => {
  const p = sampleProject();
  const z = buildBackupZip([{ project: p, files: [{ meta: p.files[0], data: new Uint8Array([1, 2, 3]) }, { meta: p.files[1], data: new Uint8Array([9, 8]) }] }], 'test');
  const names = readZip(z).map((e) => e.name);
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('projects/p1/files/f2/hero.bin'), 'path traversal stripped');
  const back = parseBackupZip(z);
  assert.equal(back.length, 1);
  assert.equal(back[0].project.name, 'Ninja test');
  assert.equal(back[0].project.viewer.grid, false);
  assert.deepEqual([...back[0].files[0].data], [1, 2, 3]);
  assert.deepEqual([...back[0].files[1].data], [9, 8]);
});

test('backup parser rejects foreign zips and missing files', () => {
  assert.throws(() => parseBackupZip(createZip([{ name: 'x.txt', data: new Uint8Array(1) }])), /manifest/);
  const p = sampleProject();
  const z = buildBackupZip([{ project: p, files: [{ meta: p.files[0], data: new Uint8Array([1, 2, 3]) }] }], 'test');
  assert.throws(() => parseBackupZip(z), /missing file/);
});

test('migrateProject fills defaults and refuses future schemas', () => {
  const p = migrateProject({ id: 'a', name: 'Old', viewer: { grid: false } });
  assert.equal(p.schemaVersion, SCHEMA_VERSION);
  assert.equal(p.viewer.grid, false);
  assert.equal(p.viewer.speed, 1);
  assert.deepEqual(p.files, []);
  assert.throws(() => migrateProject({ schemaVersion: SCHEMA_VERSION + 1 }), /newer/);
});

test('duplicateName produces unique names', () => {
  assert.equal(duplicateName('Hero', []), 'Hero (copy)');
  assert.equal(duplicateName('Hero', ['Hero (copy)']), 'Hero (copy 2)');
  assert.equal(duplicateName('Hero (copy)', ['Hero (copy)', 'Hero (copy 2)']), 'Hero (copy 3)');
  assert.equal(duplicateName('قهرمان', [], 'کپی'), 'قهرمان (کپی)');
});

test('file helpers', async () => {
  assert.equal(classify('A.GLB'), 'glb');
  assert.equal(classify('tex.jpeg'), 'image');
  assert.equal(classify('readme'), 'unknown');
  assert.equal(pickMainFile(['a.bin', 'b.gltf', 'c.glb']), 'c.glb');
  assert.equal(pickMainFile(['a.png']), null);
  assert.equal(checkSize(0).ok, false);
  assert.equal(checkSize(MAX_FILE_BYTES + 1).ok, false);
  assert.equal(checkSize(60 * 1024 * 1024).warn, true);
  assert.equal(safeName('../../etc/passwd'), 'passwd');
  assert.equal(safeName('C:\\x\\..\\a?.glb'), 'a_.glb');
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('i18n: every language has every key, placeholders preserved', () => {
  const keys = Object.keys(DICTS.fa);
  for (const l of LANGS) {
    assert.deepEqual(Object.keys(DICTS[l]).sort(), [...keys].sort(), `keys of ${l}`);
    for (const k of keys) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      assert.equal(ph((DICTS as any)[l][k]), ph((DICTS.fa as any)[k]), `placeholders ${l}.${k}`);
      assert.ok((DICTS as any)[l][k].length > 0);
    }
  }
  assert.equal(translate('en', 'projects.confirmDelete', { name: 'X' }), 'Permanently delete project “X” and its stored files from this device?');
});
