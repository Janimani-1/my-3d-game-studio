# Changelog

## 0.3.0 — 2026-11-06
- **Retargeting between humanoid skeletons** (own implementation, rest-pose aware: world-space delta transfer with per-bone direction alignment; hips translation scaled by leg height; IK-style detached hands/feet follow their limbs). Works automatically when importing clips from a different skeleton.
- **Studio Combat Pack** — 17 original keyframed clips (CC0): Fight_Stance, Jab_L, Cross_R, Hook_R, Uppercut_R, Spinning_Backfist, Front_Kick_R, Side_Kick_R, Spin_Kick_360, Jump_Kick_Front, Backflip, Roll_Forward, Hit_React, Fall_Back, Get_Up, Block_High, Dodge_Side. One tap: retargeted to the current character.
- **Chain weapon**: equipped weapon is thrown on an animated chain (instanced links, sagging curve), hits (arena hit registration + impact burst) and returns to the hand; combo event “chain”; optional slow-motion.
- **Sword/weapon light trail** (ribbon from blade base to tip, element colour).
- VFX: ice impacts throw real ice shards; fire impacts emit rising embers.
- Humanoid detection fixed for three.js-sanitized names (`UpperArm.L` → `UpperArmL`).
- Bug fixed: retargeted clips' last frame wrapped to the first frame.
- Image→3D: free Hugging Face Space could not be reached/tested from the build environment → marked **unavailable** in the UI (personal free server still supported).
- ENGINE_EXPORT_GUIDE.md (Godot / Unity glTFast / GDevelop). Export verified by re-import + playback.
- Tests: 29 unit, 33 e2e (real WebGL). Proof GIF: docs/proof-combat-moves.gif.

## 0.2.1 — 2026-11-06
- Image→3D: separate **Gallery** button (opens Android photo picker for photos/videos) and **Camera** button (photo or video).
- Videos: original kept; 4–24 evenly spaced frames extracted at native resolution (PNG) as reference images.
- Model "Choose files" no longer shows camera options (non-image accept list that keeps .glb selectable).
- Shortcut from Projects to photo import; corrected empty-projects text.
- e2e: 29/29 (new step: real recorded WebM → 8 frames at 640×480).

## 0.2.0 — 2026-11-06
- **Three.js r169 vendored and bundled** (lazy chunk); no CDN; full offline incl. 3D engine and Draco decoder.
- New navigation: Projects · Image→3D · Character · Combat · Weapons & VFX · Export.
- Demo character replaced: **RobotExpressive** (CC0, 14 clips) instead of the blocky mannequin.
- Animation library with search/categories, crossfades, speed/loop/scrub; import clips from other GLBs (bone-name matched, persisted).
- Combo editor (reorder, speed, blend, trim, VFX event markers, loop, save per project).
- 61-move combat catalog (FA/DE/EN) with per-character availability.
- Elemental VFX (fire/ice/energy/lightning): projectile, 1-/2-hand beam, lightning, hand aura, impact burst & shockwave; configurable.
- 7 original procedural weapons with 4 elements on L/R hand sockets.
- Two-character test arena with hit/hurt boxes, reactions and hit counter.
- Character panel: bone list with highlight, humanoid detection (Mixamo/Blender/Unreal names), screenshot.
- Image→3D: full-resolution reference photos, backend config/health/job flow; FastAPI + TripoSR server with Colab guide.
- Export: new GLB with all clips (+optional weapon); compatibility notes.
- Project schema v2 (combos, weapon, VFX) with migration from v1.
- Tests: 27 unit tests, 28-step e2e with real WebGL. Fixed bugs found by tests: arena state lost on tab switch; catalog failed to match "Running"; projectiles too fast to see; 1-px lightning.

## 0.1.0 — 2026-11-06
Phase 1 MVP: import/inspect/view/animate/save/export originals/backup.
