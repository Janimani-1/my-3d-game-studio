# PROJECT PLAN — My 3D Game Studio

> **Resume in a new session:** give Claude this file + `docs/EXECUTION_BRIEF.md` (latest brief, authoritative) + `docs/ORIGINAL_SPEC.md` (full original spec) + `FEATURE_STATUS.md`. Repo: https://github.com/Janimani-1/my-3d-game-studio (only this repo may be touched). Live: https://janimani-1.github.io/my-3d-game-studio/. Reply to the owner in **Persian**. The owner wants a Meshy-like workflow (photo → mesh → rig → animate → export) built independently — never copy Meshy code/assets.

## v0.2.0 delivered (2026-11-06) — see FEATURE_STATUS.md for the full matrix
Bundled Three.js + offline; RobotExpressive CC0 demo (14 clips); animation library + crossfade + clip import; combo editor with VFX events; 61-move catalog; fire/ice/energy/lightning VFX; 7 weapons on hand sockets; 2-character arena; bone inspector + humanoid detection; image→3D client + FastAPI/TripoSR backend; new-GLB export; schema v2. 27 unit + 28 e2e (real WebGL) tests.

## Next priorities (in order)
1. Owner's on-device results (TEST_PLAN_ANDROID_FA.md) → fix issues first.
2. **Auto-rigging backend adapter** (evaluate UniRig / other open-source riggers: license, VRAM, quality) + in-app "Rig" step; fallback: template humanoid skeleton fitting with distance-based skin weights for A/T-pose meshes.
3. **Retargeting** between skeletons (humanoid slot map → SkeletonUtils.retargetClip), mirroring L/R.
4. Free CC0 animation packs (e.g. Quaternius) as importable libraries; fill combat catalog.
5. Chain weapon (throw/recall, segmented chain), sword trails, draw/sheath.
6. TRELLIS adapter (higher quality, 16–24 GB VRAM), multi-view input, texture upscaling, remesh/LOD as separate files.
7. Ninja costume/mask system (original designs), material editor.
8. Engine export guides (Godot/Unity/GDevelop), sprite-sheet VFX export, FBX only with a tested converter.
9. Web Worker parsing for large files; package-lock.json committed via CI.

Paid GPU services or APIs: **only with the owner's explicit approval**.

---

# Original Phase-1 plan (kept for reference)

> **How to resume in a new session:** give Claude this file, `docs/ORIGINAL_SPEC.md` (the full original specification, verbatim and authoritative), `TEST_PLAN.md` and the source ZIP. Say which phase to implement. Reply language to the owner: **Persian**.
>
> Legend: ✅ done & tested · 🟡 done, needs on-device verification · ⬜ not started · ⏳ shown as "Coming later" in the UI

## Ground rules (from spec §0, §1, §2, §16 — apply to every phase)
- Owner is a non-programmer on a **Samsung Galaxy Z Flip 5, Android Chrome**. Deliver working software, not mockups.
- UI Persian RTL by default + German + English; code/docs in English; touch-friendly.
- Free-first; no mandatory subscriptions, tokens, accounts or paid APIs; distinguish free software from paid compute/hosting; never promise free cloud GPUs.
- Original uploaded files are **never modified**; derivatives are stored separately.
- Never claim a feature works unless implemented and tested; future modules visibly "Coming later".
- Image-to-3D from one image cannot faithfully reproduce unseen sides; say so; offer comparisons and quality controls.
- No copyrighted characters/logos/costumes (e.g. no Sub-Zero reproductions); all assets original or properly licensed.
- Security: no hardcoded secrets, no remote code execution, validate file types/sizes, local-first, no uploads without explicit opt-in.
- Keep a working app at the end of every phase. Update `CHANGELOG.md`, this file and `TEST_PLAN.md` each phase.

## Technology decisions (spec §2)
| Requirement | Decision | Status |
|---|---|---|
| TypeScript, React | React 19 + TS | ✅ |
| Vite | esbuild used (offline build env; Vite uses esbuild internally) — may switch to Vite later | ✅ justified in ARCHITECTURE.md |
| Three.js, GLTFLoader, OrbitControls, AnimationMixer | Three.js 0.169.0 pinned via import map/CDN, SW-cached | 🟡 |
| PWA manifest + service worker; cache shell, not big assets without consent | ✅ |
| IndexedDB projects + blobs, export/import backups, quota/eviction awareness | ✅ |
| WebGL with context-loss recovery, no WebGPU assumption | 🟡 |
| Optional Python FastAPI backend with adapters | ⬜ Phase 2 |
| GLB/GLTF first; FBX only with tested converter | GLB/GLTF ✅ · FBX ⬜ |
| Web Workers for heavy processing | ⬜ (needed from Phase 2) |

---

## Phase 1 — Runnable MVP (spec §3) — **DELIVERED v0.1.0**
1. ✅ Persian RTL UI, German/English switch, accessible touch targets, dark theme
2. ✅ Import GLB/GLTF incl. linked resources; Android picker; desktop drag & drop
3. 🟡 Viewport: orbit/zoom, reset, front/back/side/top presets, grid toggle, light & background
4. ✅ Inspect meshes, triangles, vertices, materials, textures, skeletons, clips
5. 🟡 Play/pause/stop, speed, loop, clip selection
6. ✅ Save in IndexedDB, reopen, rename, duplicate, delete with confirmation
7. ✅ Preserve original bytes; export original; backup ZIP (format documented in ARCHITECTURE.md)
8. ✅ Loading indicators and meaningful errors (WebGL, context loss, quota, invalid files)
9. ✅ Only implemented features have active buttons; future modules "Coming later"
10. ✅ Procedural CC0 test character with skeleton, texture, 4 clips
11. ✅ Offline after first load (shell + projects verified; Three.js cache 🟡)
12. ✅ Android Chrome + desktop instructions (`INSTALL_ANDROID_FA.md`, `README.md`)

Acceptance tests (spec §3): import GLB ✅ · rotate/zoom 🟡 · play embedded animation 🟡 · save ✅ · reload ✅ · reopen ✅ · export unchanged original ✅ · switch language ✅ · recover from invalid file ✅.
**Phase 1 is complete once the owner confirms items 3/5 on the phone (TEST_PLAN.md §C).**

### Phase 1 follow-ups (do first next session)
- [ ] Fix anything reported from the on-device manual test.
- [ ] Run `E2E_OFFLINE_CDN=0 npm run test:e2e` with internet to verify rendering automatically; add a pixel check (canvas not blank).
- [ ] Generate and commit `package-lock.json` (`npm install`).
- [ ] Add `@types/react` and type-check UI components.
- [ ] Screenshot capture button (spec §12) — small, high value.
- [ ] Optional: move glTF parsing + hashing to a Web Worker for files > 20 MB.
- [ ] Optional: KTX2/Basis texture support (KTX2Loader + transcoder caching).

---

## Phase 2 — Image-to-3D & quality workflow (spec §4) ⏳
- [ ] Upload JPG/PNG/WebP references; keep high-res originals unchanged.
- [ ] Background removal & cropping where feasible (try in-browser first; disclose quality).
- [ ] Optional FastAPI backend + adapter interface; candidates TripoSR, Stable Fast 3D — **verify availability, code & weight licenses, compute needs, current compatibility before integrating**.
- [ ] Clear distinction single-image vs multi-view; label unseen surfaces as estimates.
- [ ] Clear status/errors when backend unavailable; never fake generation.
- [ ] Store: source references, original generated mesh/textures, separate optimized mobile derivatives.
- [ ] Controls: triangle budget, texture resolution, material quality, LOD; side-by-side preview comparison.
- [ ] Never overwrite original geometry/textures.
- [ ] Cost disclosure: local GPU vs rented GPU; no promise of free cloud GPUs.

## Phase 3 — Rigging & skeleton (spec §5) ⏳
- [ ] Bone hierarchy tree, joint preview, skin-weight visualisation, bind-pose inspection.
- [ ] Manual bone placement & transform correction; A-pose/T-pose calibration.
- [ ] Optional external auto-rig adapter (no invented auto-rigging promise).
- [ ] Named humanoid bone mapping; retargeting with validation; clip import.
- [ ] Detect missing/mismatched bones explicitly; never silently distort limbs.
- [ ] Preview front/back/left/right/free orbit.
- [ ] Per-joint correction: chin/head, shoulders, elbows, wrists, hips, knees, ankles.
- [ ] Asymmetric characters, uneven poses, attached clothing/props.

## Phase 4 — Combat animation catalog (spec §6) + timeline & combos (spec §10) ⏳
Catalog entry fields: unique ID, names FA/DE/EN, category, required rig type, loop flag, root-motion policy, duration, optional impact markers. Entries are **catalog/import/authoring targets, not offline text-to-animation**.
- **6.1 Punches:** left/right jab; alternating rapid punches; hook; uppercut; spinning backfist; jump punch; crouching punch; double-fist heavy strike; running punch; 3-, 4-, 5-hit combos; guard; feint; dodge; block; counterpunch.
- **6.2 Kicks:** front, side, back, high; standing spinning; low/crouched spinning; half-crouched; jump kick; flying side kick at head height; flying front kick; double-foot airborne; 360° and 540° spin kicks; scissor/bicycle airborne kick; forward kick → backward somersault → stable landing; running kick; multi-hit kick combos; low sweep.
- **6.3 Acrobatics/movement:** idle/breathing, walk, jog, sprint, turn, strafe, crouch, kneel, crawl; vertical jump, long jump, forward/back/left/right jumps; front flip, backflip, standing back somersault, flip-with-kick; ground roll, dive roll, evasive roll, sidestep, dodge around opponent; get up prone/supine, quick recovery, controlled landing.
- **6.4 Defense/reactions/knockdowns:** hand guard, kick block, sword block; stagger light/heavy; fall forward/backward/sideways; collapse and roll; prone/supine rest; knockout; death/fall; recover and stand; reaction variants by hit location & intensity.
- **6.5 Grappling & stances:** two-hand grab, one-hand grab, hold/release, push, throw (non-graphic); two-hand power-casting stance; one-hand projectile-casting stance; martial-arts ready stances & transitions.

Timeline (spec §10):
- [ ] Select multiple clips, arrange, play as one sequence (e.g. idle→run→jump→spinning kick→backflip→land→idle; draw sword→attack→throw chained sword→impact→return/catch→block; two-hand charge→projectile→hit reaction→recovery).
- [ ] Draggable clips, trim, speed, loop, root motion, transition durations; crossfades/blending; upper/lower layers only if rig supports.
- [ ] Event markers: hit frames, foot contacts, weapon release/catch, projectile spawn, VFX start/stop.
- [ ] Preview all angles; save named combos; export clips/sequences where supported.
- [ ] Handle incompatible skeletons, coordinate systems, root-motion offsets.

## Phase 5 — Weapons & attachments (spec §7) + VFX (spec §9) + costumes (spec §8) ⏳
Weapons: short/long sword, two-handed sword, axe, battle axe, dagger, dual daggers, throwing stars, spear, war hammer; ice/fire/electric variants; chain-sword and chain-axe that launch and return.
- [ ] Attach to named hand bone/socket; swap hands; draw/sheath; equip/unequip.
- [ ] Swing, block, throw, return, catch animations.
- [ ] Projectile trajectory, trail, impact, cooldown, return timing.
- [ ] Visible chain: lightweight segmented curve or constrained sim (mobile-friendly).
- [ ] Collision hooks, hitboxes, animation events, VFX triggers.
- [ ] Original/licensed geometry & materials only.

Costumes (spec §8): ice-, electric-, fire-themed masked warriors (original designs); masks, hoods, light/heavy armour, cloaks, fabric approximations; colour/material customisation; detachable equipment; **no copies of recognisable characters/logos/names**.

VFX presets (spec §9): one-hand beam, two-hand beam, projectile, shockwave, energy explosion, hit flash, fire, ice, freezing, lightning, smoke, dust, sparks, sword trails, afterimage, impact shockwave, ice shatter, fire burst, chain throw/return trails & impact.
- [ ] Parameters: colour, brightness, scale, duration, velocity, direction, emission rate, start/end event, target bone/socket, performance quality.
- [ ] Three.js particles/meshes/shaders; explicit export compatibility (sprite sheets / engine recreation data when not GLB-portable).

## Phase 6 — Two-character combat sandbox (spec §11) ⏳
- [ ] Spawn two characters; attacker/defender; facing & distance.
- [ ] Hitboxes/hurtboxes, timing, collisions, reactions.
- [ ] Weapon/projectile/VFX alignment, knockdown & recovery tests.
- [ ] Camera presets, debug overlays for sync. (Testing sandbox, not a commercial game.)

## Scene editor & capture (spec §12) — spread across phases
- ✅ grid, lights, background, camera controls, front/side/back/top/free views
- [ ] simple environment, shadows, third-person camera, save scene setup
- [ ] screenshot capture (Phase 1 follow-up); video capture only if browser API & performance allow
- [ ] mobile performance settings & FPS monitor (partial: full-res toggle ✅)

## Phase 7 — Export targets (spec §13) ⏳
- [ ] GLB/GLTF export with meshes, materials, textures, skeleton, supported clips (GLTFExporter).
- ✅ Original asset download unmodified · [ ] optimized variant stored separately.
- [ ] FBX only with tested converter + documented limits.
- [ ] Export one clip / multiple clips / combined sequence.
- [ ] GDevelop, Godot, Unity: import steps, axis/unit conventions, bone mapping, root motion, clip naming.
- [ ] VFX: texture atlases/sprite sheets + config as alternatives.
- [ ] Validate exports by re-import and playback.

## Project management (spec §14)
- ✅ manual save, rename, duplicate, delete confirmation · [ ] auto-save when safe
- [ ] per-character folders/collections, tags UI (field exists), animation libraries, weapon/VFX presets
- ✅ backup/restore, versioned schema + migration
- ✅ local-first, quota warnings, originals never overwritten, no uploads

## UI layout (spec §15)
✅ Bottom nav: Projects · Import/Create · Viewer · Animate · Weapons & VFX · Export — concise Persian labels, icons, large targets, no fake actions, backend requirements shown.

## Quality (spec §16)
- ✅ Android Chrome (emulated) & desktop Chromium; ⬜ Firefox/Safari smoke run
- ✅ portrait, landscape, Z Flip cover screen (emulated)
- 🟡 context loss · ✅ malformed files · ✅ oversized files · ✅ quota errors · ⬜ memory-pressure test with large models
- ⬜ Web Workers for heavy processing
- ✅ sample assets with provenance · ✅ unit tests · ✅ smoke tests
- ✅ limitations documented
