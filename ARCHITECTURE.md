# Architecture (v0.2)

```
index.html → app.js (React UI, i18n, IndexedDB, glTF inspector)
               └─ lazy: engine chunk = vendored Three.js r169 + GLTFLoader/Draco/meshopt/SkeletonUtils/GLTFExporter
sw.js       → precaches every built file (shell, engine chunk, Draco, demo GLB) → offline
backend/    → optional FastAPI image-to-3D server (TripoSR) on a GPU machine/Colab, reached over HTTPS
```

## Modules
| File | Responsibility |
|---|---|
| `src/core/gltfInspect.ts` | GLB/glTF parsing, validation (typed errors), stats, missing resources — no WebGL needed |
| `src/core/project.ts` | Schema v2: files (main/resource/reference/animation, SHA-256), viewer, combos, weapon, vfx; migration; backup ZIP format |
| `src/core/db.ts` | IndexedDB stores `projects`, `files` (original blobs); add/duplicate/delete; quota/persist |
| `src/core/rig.ts` | Humanoid slot detection from bone names; track/skeleton compatibility |
| `src/core/catalog.ts` | 61 combat moves (FA/DE/EN, category, loop, root-motion, rig) + clip matching |
| `src/core/backend.ts` | Image→3D client: URL validation (HTTPS), health, submit, poll, result, bearer token |
| `src/viewer/engine.ts` | Renderer, camera presets, context-loss recovery, loading (URL modifier for .gltf resources), clip crossfade, sequences with events, clip import, bone highlight, weapon sockets, VFX casting, arena (SkeletonUtils clone, Box3 hurtbox, bone hit points), screenshot, GLB export |
| `src/viewer/vfx.ts` | GPU particle pool (custom shader, additive), projectile/beam/lightning/aura/burst/shockwave |
| `src/viewer/weapons.ts` | Procedural original weapons, element emissive |
| `src/ui/*` | Panels; `importLogic.ts` shared import/validation; `App.tsx` state + engine lifecycle |

## Data rules
- Original bytes are stored as Blobs built from the exact imported bytes; never rewritten. Export "original" = stored Blob; "new GLB" = GLTFExporter output (separate file).
- Combos reference clips **by name** (stable across reloads and imports).
- Imported animation files are stored as originals (`role: animation`) and re-applied on load.
- Reference photos (`role: reference`) are stored unchanged at full resolution; uploaded only on Generate.

## Backend API v1
`GET /health` · `POST /v1/jobs` (multipart image, remove_bg, mc_resolution) · `GET /v1/jobs/{id}` · `GET /v1/jobs/{id}/result` (GLB). Optional `Authorization: Bearer`. CORS allow-list regex (default GitHub Pages + localhost). One GPU worker thread, in-memory queue.

## Known limitations
Retargeting between different skeletons, mirroring, auto-rigging, chain weapons, costumes, FBX export, LOD/optimization, KTX2 textures, Web Worker parsing — backlog (PROJECT_PLAN.md).
