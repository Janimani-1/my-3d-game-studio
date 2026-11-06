#!/usr/bin/env node
/**
 * Build script (esbuild). Produces a static, deployable, fully self-contained PWA in ./dist.
 * Three.js (vendored, MIT) is bundled into a lazily-loaded chunk — no CDN at runtime.
 * Usage: node scripts/build.mjs
 */
import { build } from 'esbuild';
import { mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const VENDOR = join(ROOT, 'vendor/three');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const nodePaths = [join(ROOT, 'node_modules'), '/opt/npm-tools/node_modules'];

function hashDir(dir, h = createHash('sha256')) {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) hashDir(p, h);
    else h.update(relative(ROOT, p)).update(readFileSync(p));
  }
  return h;
}
const srcHash = hashDir(join(ROOT, 'public'), hashDir(join(ROOT, 'src'))).digest('hex').slice(0, 8);
const APP_VERSION = `${pkg.version}+${srcHash}`;

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

/** Resolve `three` and `three/addons/*` to the vendored copy (pinned r169). */
const threeVendor = {
  name: 'three-vendor',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(VENDOR, 'build/three.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(VENDOR, 'examples/jsm', a.path.slice('three/addons/'.length)) }));
  },
};

await build({
  entryPoints: { app: join(ROOT, 'src/main.tsx') },
  outdir: DIST,
  bundle: true,
  splitting: true,
  format: 'esm',
  chunkNames: 'chunk-[hash]',
  target: ['chrome90', 'firefox100', 'safari15'],
  minify: true,
  jsx: 'automatic',
  nodePaths,
  plugins: [threeVendor],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION), 'process.env.NODE_ENV': '"production"' },
  legalComments: 'eof',
  logLevel: 'warning',
});

// Draco decoder (Apache-2.0) for compressed models — served locally, works offline.
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) copyFileSync(join(VENDOR, 'examples/jsm/libs/draco/gltf', f), join(DIST, f));
// Demo character: RobotExpressive by Tomás Laulhé (Quaternius), CC0 1.0.
copyFileSync(join(ROOT, 'assets/robot-expressive.glb'), join(DIST, 'robot-expressive.glb'));

// Icons
const { deflateSync } = await import('node:zlib');
const tmp = join(ROOT, '.build-tmp');
mkdirSync(tmp, { recursive: true });
await build({ entryPoints: [join(ROOT, 'src/sample/mannequin.ts')], outfile: join(tmp, 'png.mjs'), bundle: true, format: 'esm', platform: 'node', logLevel: 'warning' });
const { encodePng } = await import(join(tmp, 'png.mjs') + `?t=${Date.now()}`);
function icon(size) {
  const px = new Uint8Array(size * size * 4);
  const s = size / 512, cx = 256 * s, cy = 270 * s, r = 150 * s;
  const top = [[cx, cy - r], [cx + r * 0.87, cy - r / 2], [cx, cy], [cx - r * 0.87, cy - r / 2]];
  const left = [[cx - r * 0.87, cy - r / 2], [cx, cy], [cx, cy + r], [cx - r * 0.87, cy + r / 2]];
  const right = [[cx, cy], [cx + r * 0.87, cy - r / 2], [cx + r * 0.87, cy + r / 2], [cx, cy + r]];
  const inside = (poly, x, y) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let col = [26, 29, 39];
      if (inside(top, x, y)) col = [120, 180, 255];
      else if (inside(left, x, y)) col = [61, 139, 253];
      else if (inside(right, x, y)) col = [36, 92, 190];
      px.set([...col, 255], (y * size + x) * 4);
    }
  return encodePng(size, size, px, (d) => new Uint8Array(deflateSync(d)));
}
writeFileSync(join(DIST, 'icon-192.png'), icon(192));
writeFileSync(join(DIST, 'icon-512.png'), icon(512));
rmSync(tmp, { recursive: true, force: true });
writeFileSync(join(DIST, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#1a1d27"/><path d="M256 120l130 75-130 75-130-75z" fill="#78b4ff"/><path d="M126 195l130 75v150l-130-75z" fill="#3d8bfd"/><path d="M386 195l-130 75v150l130-75z" fill="#245cbe"/></svg>`);

const repl = (s) => s.replaceAll('__APP_VERSION__', APP_VERSION);
writeFileSync(join(DIST, 'index.html'), repl(readFileSync(join(ROOT, 'public/index.html'), 'utf8')));
copyFileSync(join(ROOT, 'public/manifest.webmanifest'), join(DIST, 'manifest.webmanifest'));
writeFileSync(join(DIST, '.nojekyll'), '');

// Service worker precaches every built file (app shell, engine chunk, decoders, demo model).
const files = readdirSync(DIST).filter((f) => !f.startsWith('.') && f !== 'sw.js');
const shell = ['./', ...files.map((f) => './' + f)];
writeFileSync(join(DIST, 'sw.js'), repl(readFileSync(join(ROOT, 'public/sw.js'), 'utf8')).replace('__SHELL_FILES__', JSON.stringify(shell)));

const total = files.reduce((s, f) => s + statSync(join(DIST, f)).size, 0);
const js = files.filter((f) => f.endsWith('.js')).map((f) => `${f} ${(statSync(join(DIST, f)).size / 1024).toFixed(0)}KB`);
console.log(`Built ${APP_VERSION} → dist/ (${files.length} files, ${(total / 1048576).toFixed(2)} MB): ${js.join(', ')}`);
