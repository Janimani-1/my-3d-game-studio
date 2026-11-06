# Test results — v0.3.0

Run: 2026-11-06T18:10:00.088Z. **Environment:** headless Chromium (Playwright) with **real WebGL 2 via SwiftShader**, emulating Galaxy Z Flip 5 (412×915 CSS px, DPR 2.625, touch, Android UA). External network blocked except localhost (proves offline-capable bundle). **Not a physical phone** → TEST_PLAN_ANDROID_FA.md.

| Check | Result |
|---|---|
| TypeScript strict (core, viewer, samples) | ✅ 0 errors |
| Unit tests | ✅ 29/29 |
| Build | ✅ self-contained (Three.js bundled, combat pack generated) |
| End-to-end | ✅ 33/33 |
| Backend `main.py` | syntax only (no GPU / pip here) |
| Free Hugging Face image-to-3D | ❌ not reachable from build environment → not tested → marked unavailable |

## E2E steps
| Step | Result | Time |
|---|---|---|
| 01 app loads in Persian RTL, 6 sections | ✅ PASS | 440 ms |
| 02 language switch EN/DE (LTR) and back | ✅ PASS | 53 ms |
| 03 invalid file rejected with Persian error | ✅ PASS | 23 ms |
| 04 .gltf without .bin blocked; with .bin imports | ✅ PASS | 117 ms |
| 05 .gltf + external .bin renders in 3D | ✅ PASS | 533 ms |
| 06 load bundled robot sample and save project | ✅ PASS | 691 ms |
| 07 REAL WebGL rendering: robot drawn, 3237 triangles, draw calls > 0 | ✅ PASS | 1986 ms |
| 08 camera presets change the image (front vs back vs top) | ✅ PASS | 3597 ms |
| 09 skeleton: 43 bones listed, humanoid bones detected, skeleton overlay draws | ✅ PASS | 1330 ms |
| 10 animation library: 14 clips, play Running → pixels change over time | ✅ PASS | 3118 ms |
| 11 clip switching with crossfade (Running → Punch) + speed ×0.5 | ✅ PASS | 2487 ms |
| 12 combo editor: demo combo plays step by step with projectile event | ✅ PASS | 10753 ms |
| 13 build & save own combo (add 2 steps, save, persists in project) | ✅ PASS | 2496 ms |
| 14 VFX: fire projectile, ice beam, lightning — particles rendered | ✅ PASS | 10259 ms |
| 15 weapon attached to hand bone (sword, fire element) | ✅ PASS | 3973 ms |
| 16 two-character arena: opponent drawn, boxes, hit registration | ✅ PASS | 10143 ms |
| 17 import animations from another GLB (bone-name matched) | ✅ PASS | 1765 ms |
| 18 reload → project, combo and imported clips persist | ✅ PASS | 1321 ms |
| 19 export original: byte-identical + SHA-256 verified | ✅ PASS | 494 ms |
| 20 export NEW GLB with all clips → re-import check | ✅ PASS | 113 ms |
| 21 backup ZIP valid; restore adds project | ✅ PASS | 1405 ms |
| 22 duplicate / rename / delete with confirmation | ✅ PASS | 368 ms |
| 23 Image→3D: 2400×1600 photo stored unchanged; Generate disabled offline | ✅ PASS | 1496 ms |
| 23b gallery/camera inputs + video → full-resolution frames | ✅ PASS | 2902 ms |
| 24 Image→3D client protocol against test-only mock backend | ✅ PASS | 5123 ms |
| 25 Z Flip landscape & cover screen layouts (no overflow, nav ≥44px) | ✅ PASS | 1306 ms |
| 26 WebGL context loss → automatic recovery, still rendering | ✅ PASS | 4119 ms |
| 27 offline: reload without network → app + 3D engine + robot render | ✅ PASS | 2492 ms |
| 29 combat pack: 17 original clips retargeted to robot skeleton; kick moves the leg | ✅ PASS | 3453 ms |
| 30 chain weapon: thrown, travels > 0.8 body heights, returns to the hand | ✅ PASS | 5476 ms |
| 31 sword light trail renders during a spinning attack | ✅ PASS | 2400 ms |
| 32 combo with chain event + export GLB with retargeted clips → re-import & play | ✅ PASS | 3750 ms |
| 28 no unexpected console errors | ✅ PASS | 1 ms |

Engine-ready export (step 32): 974836 bytes, 31 animations; re-imported as a new project, rendered and played `Backflip`.

## Visual proof
- `docs/proof-combat-moves.gif` — robot performing the 17 retargeted pack moves, chain weapon throw (slow-mo), sword trail, fireball, ice beam, lightning (real WebGL renders).
- `docs/test-screenshots/` — per-step screenshots.

## Bugs found and fixed in v0.3 testing
1. Side detection failed for three.js-sanitized bone names (`UpperArmL`) → only 7/17 bones mapped.
2. Retargeted clips' last frame wrapped to frame 0 (Fall_Back ended standing).
3. Robot's IK feet stayed planted (feet not children of the legs) → rigid-follow for detached hands/feet.
4. Chain throw target too far to see → 1.1 body heights; slow-mo option added.

## Not verified here
Physical phone GPU/touch/install, real Godot/Unity/GDevelop import, Draco models, real TripoSR generation.
