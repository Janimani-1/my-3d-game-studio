# Changelog

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
