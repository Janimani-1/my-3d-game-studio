# Test results — v0.2.0

Run: 2026-11-06T15:40:26.554Z in the build sandbox. **Environment:** headless Chromium (Playwright 1.63) with **real WebGL 2 via SwiftShader** (software GPU), emulating a Galaxy Z Flip 5 (412×915 CSS px, DPR 2.625, touch, Android UA). External network blocked during the run except localhost. **Not a physical phone** — see TEST_PLAN_ANDROID_FA.md for the on-device checklist.

| Check | Result |
|---|---|
| TypeScript strict type-check (core, viewer, sample) | ✅ 0 errors (React UI compiled by esbuild; no @types/react offline) |
| Unit tests | ✅ 27/27 |
| Production build | ✅ 20 files, 2.33 MB, self-contained |
| Backend `main.py` | ✅ syntax check only — FastAPI/PyTorch not installable here, no GPU |
| End-to-end | ✅ 28/28 |

## E2E steps
| Step | Result | Time |
|---|---|---|
| 01 app loads in Persian RTL, 6 sections | ✅ PASS | 500 ms |
| 02 language switch EN/DE (LTR) and back | ✅ PASS | 58 ms |
| 03 invalid file rejected with Persian error | ✅ PASS | 61 ms |
| 04 .gltf without .bin blocked; with .bin imports | ✅ PASS | 148 ms |
| 05 .gltf + external .bin renders in 3D | ✅ PASS | 510 ms |
| 06 load bundled robot sample and save project | ✅ PASS | 726 ms |
| 07 REAL WebGL rendering: robot drawn, 3237 triangles, draw calls > 0 | ✅ PASS | 1885 ms |
| 08 camera presets change the image (front vs back vs top) | ✅ PASS | 3687 ms |
| 09 skeleton: 43 bones listed, humanoid bones detected, skeleton overlay draws | ✅ PASS | 1413 ms |
| 10 animation library: 14 clips, play Running → pixels change over time | ✅ PASS | 3323 ms |
| 11 clip switching with crossfade (Running → Punch) + speed ×0.5 | ✅ PASS | 2671 ms |
| 12 combo editor: demo combo plays step by step with projectile event | ✅ PASS | 10430 ms |
| 13 build & save own combo (add 2 steps, save, persists in project) | ✅ PASS | 2703 ms |
| 14 VFX: fire projectile, ice beam, lightning — particles rendered | ✅ PASS | 10717 ms |
| 15 weapon attached to hand bone (sword, fire element) | ✅ PASS | 4130 ms |
| 16 two-character arena: opponent drawn, boxes, hit registration | ✅ PASS | 10603 ms |
| 17 import animations from another GLB (bone-name matched) | ✅ PASS | 1775 ms |
| 18 reload → project, combo and imported clips persist | ✅ PASS | 1448 ms |
| 19 export original: byte-identical + SHA-256 verified | ✅ PASS | 528 ms |
| 20 export NEW GLB with all clips → re-import check | ✅ PASS | 111 ms |
| 21 backup ZIP valid; restore adds project | ✅ PASS | 1401 ms |
| 22 duplicate / rename / delete with confirmation | ✅ PASS | 417 ms |
| 23 Image→3D: 2400×1600 photo stored unchanged; Generate disabled offline | ✅ PASS | 1655 ms |
| 24 Image→3D client protocol against test-only mock backend | ✅ PASS | 5820 ms |
| 25 Z Flip landscape & cover screen layouts (no overflow, nav ≥44px) | ✅ PASS | 1502 ms |
| 26 WebGL context loss → automatic recovery, still rendering | ✅ PASS | 3299 ms |
| 27 offline: reload without network → app + 3D engine + robot render | ✅ PASS | 2647 ms |
| 28 no unexpected console errors | ✅ PASS | 6 ms |

Exported GLB (step 20): 827684 bytes, 28 animations, 4 skin(s), 19 mesh(es).

## Evidence
Screenshots of real renders in `docs/test-screenshots/` (robot render, running, punch, combo, fire projectile, ice beam, lightning, weapon, arena, offline render, layouts).

## Bugs found and fixed by these tests
1. Arena UI state reset when switching tabs while the opponent stayed visible.
2. Catalog did not match "Running" to the *run* move (3-letter keyword rule).
3. Projectiles left the frame too fast to be seen; default speed halved, default camera now 3/4.
4. Lightning was a 1-px line (WebGL limit) — glow particles added along the bolt.

## Not verified here
Physical Samsung GPU performance/heat, real touch gestures, Android install prompt, real TripoSR generation (needs GPU), Draco-compressed models, very large (>100 MB) files.
