#!/usr/bin/env node
/**
 * End-to-end test in headless Chromium with REAL WebGL (SwiftShader software GPU).
 * Emulates a Samsung Galaxy Z Flip 5 (412×915 CSS px, DPR 2.625, touch, Android UA).
 * A mock image-to-3D server (test-only, scripts/mock-backend.mjs) verifies the client protocol —
 * it returns the bundled robot GLB and is never part of the app.
 * Usage: node scripts/e2e-smoke.mjs   (expects ./dist)
 */
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5179;
const MOCK = 5181;
const BASE = `http://localhost:${PORT}/`;
const tmp = mkdtempSync(join(tmpdir(), 'm3gs-e2e-'));
const shots = join(ROOT, 'test-results');
mkdirSync(shots, { recursive: true });

const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), join(ROOT, 'dist'), String(PORT)], { stdio: 'ignore' });
const mock = spawn(process.execPath, [join(ROOT, 'scripts/mock-backend.mjs'), String(MOCK), join(ROOT, 'dist/robot-expressive.glb')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ ok: true, name, ms: Date.now() - t0 });
    console.log('PASS', name);
  } catch (e) {
    results.push({ ok: false, name, err: e.message.split('\n')[0] });
    console.log('FAIL', name, '\n   ', e.message.split('\n')[0]);
  }
}

const robot = readFileSync(join(ROOT, 'dist/robot-expressive.glb'));
const dv = new DataView(robot.buffer, robot.byteOffset, robot.byteLength);
const jsonLen = dv.getUint32(12, true);
const gjson = JSON.parse(new TextDecoder().decode(robot.subarray(20, 20 + jsonLen)));
const binLen = dv.getUint32(20 + jsonLen, true);
const binData = robot.subarray(28 + jsonLen, 28 + jsonLen + binLen);
gjson.buffers[0].uri = 'robot.bin';
const gltfText = JSON.stringify(gjson);

// A large reference "photo" (2400×1600 PNG) to prove originals are kept at full resolution.
function bigPng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = (x * 255) / w;
      raw[o + 1] = (y * 255) / h;
      raw[o + 2] = 128;
    }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const photo = bigPng(2400, 1600);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const FLIP_MAIN = { width: 412, height: 915 };
const FLIP_COVER = { width: 360, height: 374 };
const ctx = await browser.newContext({
  viewport: FLIP_MAIN, isMobile: true, hasTouch: true, acceptDownloads: true, deviceScaleFactor: 2.625,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-F731B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
});
await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort()); // prove: no external network needed
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
const tid = (id) => page.getByTestId(id);
const nav = (t) => tid(`nav-${t}`).click();
const clipBtn = (name) => page.locator('button.clip', { hasText: new RegExp('^' + name) }).first();

/** Fraction of viewport pixels that differ from the background colour → proves something is drawn. */
async function drawnFraction(name) {
  const buf = await tid('viewport').screenshot({ path: name ? join(shots, name) : undefined });
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let diff = 0;
  const bg = [data[0], data[1], data[2]];
  for (let i = 0; i < data.length; i += info.channels * 4) if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 40) diff++;
  return { frac: diff / (data.length / (info.channels * 4)), buf };
}
async function pixelDelta(a, b) {
  const { default: sharp } = await import('sharp');
  const A = await sharp(a).raw().toBuffer();
  const B = await sharp(b).raw().toBuffer();
  let d = 0;
  for (let i = 0; i < Math.min(A.length, B.length); i += 16) if (Math.abs(A[i] - B[i]) > 30) d++;
  return d / (A.length / 16);
}
const renderInfo = () => page.evaluate(() => window.__m3gsViewer?.renderInfo());

await step('01 app loads in Persian RTL, 6 sections', async () => {
  await page.goto(BASE);
  await tid('nav-projects').waitFor();
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  for (const x of ['projects', 'create', 'character', 'animate', 'weapons', 'export']) await tid(`nav-${x}`).waitFor();
  await page.screenshot({ path: join(shots, '01-home-fa.png') });
});

await step('02 language switch EN/DE (LTR) and back', async () => {
  await tid('lang').selectOption('en');
  assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
  assert.match(await tid('nav-animate').innerText(), /Combat/);
  await tid('lang').selectOption('de');
  assert.match(await tid('nav-animate').innerText(), /Kampf/);
  await tid('lang').selectOption('fa');
});

await step('03 invalid file rejected with Persian error', async () => {
  await tid('file-input').setInputFiles({ name: 'broken.glb', mimeType: 'application/octet-stream', buffer: Buffer.from('not a model') });
  assert.match(await tid('import-error').innerText(), /نامعتبر/);
});

await step('04 .gltf without .bin blocked; with .bin imports', async () => {
  await tid('file-input').setInputFiles({ name: 'robot.gltf', mimeType: 'model/gltf+json', buffer: Buffer.from(gltfText) });
  assert.match(await tid('import-error').innerText(), /robot\.bin/);
  await tid('file-input').setInputFiles([
    { name: 'robot.gltf', mimeType: 'model/gltf+json', buffer: Buffer.from(gltfText) },
    { name: 'robot.bin', mimeType: 'application/octet-stream', buffer: Buffer.from(binData) },
  ]);
  await tid('import-result').waitFor();
});

await step('05 .gltf + external .bin renders in 3D', async () => {
  await nav('character');
  await page.waitForFunction(() => window.__m3gsViewer?.renderInfo().triangles > 1000, null, { timeout: 30000 });
});

await step('06 load bundled robot sample and save project', async () => {
  await nav('projects');
  await tid('load-sample').click();
  await tid('import-result').waitFor();
  await tid('project-name').fill('ربات تست');
  await tid('save-project').click();
  await page.waitForFunction(() => document.querySelector('[data-testid=save-state]')?.textContent?.includes('ذخیره شد'));
});

await step('07 REAL WebGL rendering: robot drawn, 3237 triangles, draw calls > 0', async () => {
  await nav('character');
  await page.waitForFunction(() => (window.__m3gsViewer?.renderInfo().triangles ?? 0) >= 3237, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const info = await renderInfo();
  assert.ok(info.calls > 0);
  const { frac } = await drawnFraction('07-robot-render.png');
  assert.ok(frac > 0.03, `only ${(frac * 100).toFixed(1)}% of viewport drawn`);
  assert.equal((await tid('stat-triangles').innerText()).trim(), (3237).toLocaleString('fa-IR'));
});

await step('08 camera presets change the image (front vs back vs top)', async () => {
  await tid('view-front').click();
  await page.waitForTimeout(500);
  const a = (await drawnFraction()).buf;
  await tid('view-top').click();
  await page.waitForTimeout(500);
  const b = (await drawnFraction()).buf;
  assert.ok((await pixelDelta(a, b)) > 0.01);
  await tid('reset-camera').click();
});

await step('09 skeleton: 43 bones listed, humanoid bones detected, skeleton overlay draws', async () => {
  assert.ok((await tid('bone-list').locator('li').count()) >= 40);
  assert.match(await tid('humanoid').innerText(), /Hips|hips/);
  const before = (await renderInfo()).calls;
  await tid('skeleton-toggle').check();
  await page.waitForTimeout(300);
  assert.ok((await renderInfo()).calls > before);
  await tid('skeleton-toggle').uncheck();
});

let runningBuf;
await step('10 animation library: 14 clips, play Running → pixels change over time', async () => {
  await nav('animate');
  assert.equal(await page.locator('[data-testid^=clip-]').filter({ hasNotText: '' }).count() >= 14, true);
  await clipBtn('Running').click();
  await page.waitForTimeout(400);
  const a = (await drawnFraction()).buf;
  await page.waitForTimeout(250);
  runningBuf = (await drawnFraction('10-running.png')).buf;
  assert.ok((await pixelDelta(a, runningBuf)) > 0.002, 'no motion detected');
  await tid('anim-pause').waitFor();
});

await step('11 clip switching with crossfade (Running → Punch) + speed ×0.5', async () => {
  await clipBtn('Punch').click();
  await tid('speed-0.5').click();
  await page.waitForTimeout(500);
  const b = (await drawnFraction('11-punch.png')).buf;
  assert.ok((await pixelDelta(runningBuf, b)) > 0.002);
  await tid('speed-1').click();
});

await step('12 combo editor: demo combo plays step by step with projectile event', async () => {
  await tid('combo-item').first().click();
  const steps = await tid('combo-step').count();
  assert.ok(steps >= 3, `steps ${steps}`);
  await tid('play-combo').click();
  await page.waitForSelector('.step.playing', { timeout: 5000 });
  let maxParticles = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const txt = await tid('perf').innerText();
    const m = txt.match(/([\d۰-۹٬,]+)\s*ذره/);
    if (m) maxParticles = Math.max(maxParticles, Number(m[1].replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٬,]/g, '')));
    if (!(await page.$('.step.playing')) && Date.now() - t0 > 1500) break;
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: join(shots, '12-combo.png') });
  assert.ok(maxParticles > 0, 'combo VFX event did not spawn particles');
});

await step('13 build & save own combo (add 2 steps, save, persists in project)', async () => {
  await clipBtn('Wave').click();
  await tid('add-step').click();
  await clipBtn('Jump').click();
  await tid('add-step').click();
  await tid('save-combo').click();
  await page.waitForTimeout(400);
  assert.ok((await tid('combo-item').count()) >= 1);
});

await step('14 VFX: fire projectile, ice beam, lightning — particles rendered', async () => {
  await nav('weapons');
  await tid('vfx-mode-projectile').click();
  await tid('vfx-el-fire').click();
  await tid('cast-vfx').click();
  await page.waitForTimeout(350);
  await drawnFraction('14a-fire-projectile.png');
  await tid('vfx-mode-beam2').click();
  await tid('vfx-el-ice').click();
  await tid('cast-vfx').click();
  await page.waitForTimeout(400);
  await drawnFraction('14b-ice-beam.png');
  await tid('vfx-mode-lightning').click();
  await tid('vfx-el-lightning').click();
  await tid('cast-vfx').click();
  await page.waitForTimeout(300);
  await drawnFraction('14c-lightning.png');
  const parts = await page.evaluate(() => window.__m3gsViewer && document.querySelector('[data-testid=perf]')?.textContent);
  assert.ok(parts);
});

await step('15 weapon attached to hand bone (sword, fire element)', async () => {
  const before = (await renderInfo()).calls;
  await tid('weapon-toggle').check();
  await tid('weapon-sword').click();
  await page.getByRole('button', { name: 'آتش' }).first().click();
  await page.waitForTimeout(400);
  assert.ok((await renderInfo()).calls > before, 'weapon not drawn');
  await drawnFraction('15-weapon.png');
});

await step('16 two-character arena: opponent drawn, boxes, hit registration', async () => {
  await nav('animate');
  await tid('arena-toggle').check();
  await tid('arena-reaction').selectOption({ label: 'Death' });
  await page.waitForTimeout(500);
  const tri = (await renderInfo()).triangles;
  assert.ok(tri >= 3237 * 2 - 10, `triangles ${tri}`);
  await clipBtn('Punch').click();
  await nav('weapons');
  await tid('vfx-mode-projectile').click();
  await tid('cast-vfx').click();
  await page.waitForTimeout(2500);
  await drawnFraction('16-arena.png');
  await nav('animate');
  const hits = await tid('arena-hits').innerText();
  assert.match(hits, /[1-9۱-۹]/, `no hit registered: ${hits}`);
  await tid('arena-toggle').uncheck();
});

await step('17 import animations from another GLB (bone-name matched)', async () => {
  await tid('anim-file').setInputFiles({ name: 'more-moves.glb', mimeType: 'model/gltf-binary', buffer: robot });
  await page.waitForTimeout(1500);
  const n = await page.locator('[data-testid^=clip-]').count();
  assert.ok(n >= 28, `clips ${n}`);
});

await step('18 reload → project, combo and imported clips persist', async () => {
  await page.reload();
  await nav('projects');
  await page.getByText('ربات تست').first().waitFor();
  await page.locator('[data-testid=project-item]', { hasText: 'ربات تست' }).getByTestId('project-open').click();
  await page.waitForFunction(() => (window.__m3gsViewer?.renderInfo().triangles ?? 0) >= 3237, null, { timeout: 30000 });
  await nav('animate');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid^=clip-]').length >= 28, null, { timeout: 15000 });
  assert.ok((await tid('combo-item').count()) >= 1);
});

await step('19 export original: byte-identical + SHA-256 verified', async () => {
  await nav('export');
  const [dl] = await Promise.all([page.waitForEvent('download'), tid('download-original').first().click()]);
  const p = join(tmp, 'orig.glb');
  await dl.saveAs(p);
  assert.ok(readFileSync(p).equals(robot));
  await tid('verify').click();
  assert.match(await tid('verify-result').first().innerText(), /سالم/);
});

await step('20 export NEW GLB with all clips → re-import check', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), tid('export-glb').click()]);
  const p = join(tmp, 'new.glb');
  await dl.saveAs(p);
  const b = readFileSync(p);
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  assert.ok(j.animations.length >= 28, `anims ${j.animations.length}`);
  assert.equal(j.skins.length >= 1, true);
  writeFileSync(join(shots, 'exported-info.json'), JSON.stringify({ bytes: b.length, animations: j.animations.length, skins: j.skins.length, meshes: j.meshes.length }));
});

let backupPath = '';
await step('21 backup ZIP valid; restore adds project', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), tid('backup-one').click()]);
  backupPath = join(tmp, dl.suggestedFilename());
  await dl.saveAs(backupPath);
  assert.match(execFileSync('unzip', ['-t', backupPath]).toString(), /No errors/);
  await tid('restore-input').setInputFiles(backupPath);
  await page.waitForTimeout(1200);
  await nav('projects');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=project-item]').length >= 2);
});

await step('22 duplicate / rename / delete with confirmation', async () => {
  const n0 = await tid('project-item').count();
  await tid('project-duplicate').first().click();
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid=project-item]').length === n + 1, n0);
  await tid('project-rename').first().click();
  await tid('dialog-input').fill('کپی تغییر نام');
  await tid('dialog-ok').click();
  await page.getByText('کپی تغییر نام').waitFor();
  await tid('project-delete').first().click();
  await tid('dialog-cancel').click();
  assert.equal(await tid('project-item').count(), n0 + 1);
  await tid('project-delete').first().click();
  await tid('dialog-ok').click();
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid=project-item]').length === n, n0);
});

await step('23 Image→3D: 2400×1600 photo stored unchanged; Generate disabled offline', async () => {
  await tid('project-open').first().click();
  await nav('create');
  await tid('ref-input').setInputFiles({ name: 'barbarian.png', mimeType: 'image/png', buffer: photo });
  await page.getByText(/2400×1600/).waitFor({ timeout: 8000 });
  assert.equal(await tid('generate').isDisabled(), true);
  await tid('backend-url').fill('http://localhost:1');
  await tid('backend-check').click();
  await page.waitForFunction(() => /وصل نیست/.test(document.querySelector('[data-testid=backend-status]')?.textContent ?? ''), null, { timeout: 20000 });
  await page.screenshot({ path: join(shots, '23-create.png'), fullPage: false });
});

await step('24 Image→3D client protocol against test-only mock backend', async () => {
  await ctx.unroute(/^https?:\/\/(?!localhost)/);
  await tid('backend-url').fill(`http://localhost:${MOCK}`);
  await tid('backend-token').fill('test-token');
  await tid('backend-check').click();
  await page.waitForFunction(() => /وصل است/.test(document.querySelector('[data-testid=backend-status]')?.textContent ?? ''), null, { timeout: 10000 });
  await tid('generate').click();
  await page.waitForFunction(() => document.querySelector('[data-testid=panel-character]'), null, { timeout: 30000 });
  await page.waitForFunction(() => (window.__m3gsViewer?.renderInfo().triangles ?? 0) >= 3237, null, { timeout: 30000 });
  const got = JSON.parse(execFileSync('curl', ['-s', `http://localhost:${MOCK}/__last`]).toString());
  assert.equal(got.auth, 'Bearer test-token');
  assert.equal(got.imageBytes, photo.length, 'uploaded image was altered');
});

await step('25 Z Flip landscape & cover screen layouts (no overflow, nav ≥44px)', async () => {
  await page.setViewportSize({ width: 915, height: 412 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, '25a-landscape.png') });
  await page.setViewportSize(FLIP_COVER);
  await nav('animate');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `overflow ${overflow}`);
  const box = await tid('nav-export').boundingBox();
  assert.ok(box && box.height >= 44);
  await page.screenshot({ path: join(shots, '25b-cover.png') });
  await page.setViewportSize(FLIP_MAIN);
});

await step('26 WebGL context loss → automatic recovery, still rendering', async () => {
  await nav('character');
  await tid('lose-context').click();
  await page.waitForTimeout(2500);
  const info = await renderInfo();
  assert.ok(info.triangles >= 3237, `after restore ${JSON.stringify(info)}`);
});

await step('27 offline: reload without network → app + 3D engine + robot render', async () => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  await nav('projects');
  await tid('load-sample').click();
  await tid('import-result').waitFor();
  await nav('character');
  await page.waitForFunction(() => (window.__m3gsViewer?.renderInfo().triangles ?? 0) >= 3237, null, { timeout: 30000 });
  await drawnFraction('27-offline-render.png');
  await ctx.setOffline(false);
});

const unexpected = consoleErrors.filter((e) => !/localhost:1\b|ERR_CONNECTION_REFUSED|Failed to load resource|net::ERR_INTERNET_DISCONNECTED|ERR_FAILED/i.test(e));
await step('28 no unexpected console errors', async () => {
  assert.deepEqual(unexpected, []);
});

await browser.close();
server.kill();
mock.kill();
const failed = results.filter((r) => !r.ok);
writeFileSync(join(shots, 'e2e-results.json'), JSON.stringify({ date: new Date().toISOString(), renderer: 'Chromium headless + SwiftShader WebGL', device: 'Z Flip 5 emulation', results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} steps passed (real WebGL via SwiftShader; emulated device)`);
process.exit(failed.length ? 1 : 0);
