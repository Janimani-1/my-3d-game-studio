# Feature status — v0.2.0 (2026-11-06)

Legend: ✅ built & automatically tested (real WebGL, emulated Z Flip 5) · 🟡 built, needs physical-phone confirmation · 🔌 built, needs an external GPU server · ⏳ not built (backlog) — shown as "Coming later" in the UI.

| Area | Feature | Status | Automated test | Physical Android test | Limits |
|---|---|---|---|---|---|
| App | PWA, Persian RTL default, DE/EN, dark, 6 sections | ✅ | e2e 01–02 | 🟡 | — |
| App | Offline after first visit (Three.js bundled, SW precache) | ✅ | e2e 27 (network off → render) | 🟡 | First visit must be online |
| App | Z Flip main/landscape/cover layouts | ✅ | e2e 25 | 🟡 | Cover screen needs Good Lock/MultiStar for Chrome |
| Import | GLB, GLTF + .bin + textures, validation, Persian errors | ✅ | unit + e2e 03–05 | 🟡 | 300 MB/file limit |
| Import | Draco / meshopt compressed GLB | 🟡 | decoder bundled, not exercised | — | KTX2 textures not decoded |
| Viewer | Real 3D render, orbit/zoom/pan, 5 presets, lights, background, grid, full-res | ✅ | e2e 07–08 | 🟡 | — |
| Viewer | Screenshot (PNG) | ✅ | button wired; download covered by export tests | 🟡 | — |
| Viewer | WebGL context loss recovery | ✅ | e2e 26 | 🟡 | — |
| Character | Bone list (tap-to-highlight), skeleton overlay, humanoid detection (Mixamo/Blender/Unreal names) | ✅ | unit + e2e 09 | 🟡 | Detection is name-based |
| Character | Automatic rigging (like Meshy) | ⏳ | — | — | Needs a rigging backend; import rigged models instead |
| Character | Retargeting between different skeletons | ⏳ | — | — | Same-bone-name clips only (below) |
| Animation | Library: search, categories, select, play/pause/stop, scrub, speed, loop | ✅ | e2e 10–11 | 🟡 | — |
| Animation | Crossfade between clips | ✅ | e2e 11 | 🟡 | — |
| Animation | Import clips from another GLB (bone-name matched, ≥60% tracks) | ✅ | unit + e2e 17, persists (e2e 18) | 🟡 | No retargeting/mirroring yet |
| Combo | Combo editor: steps, reorder, speed, blend, trim, VFX event, loop, save/load | ✅ | e2e 12–13, 18 | 🟡 | Event markers only trigger VFX (no audio) |
| Combo | Catalog of 61 required combat moves (FA/DE/EN) with availability per character | ✅ | unit | 🟡 | Moves are targets; most need importing |
| Arena | Two characters, distance, opponent clip, hit reaction, hit/hurt boxes, hit counter | ✅ | e2e 16 | 🟡 | Opponent = copy of current character; simple box hits |
| VFX | Fire / ice / energy / lightning: projectile, 1-hand beam, 2-hand beam, lightning, hand aura, impact burst + shockwave | ✅ | e2e 12, 14, 16 + screenshots | 🟡 | Runtime only — not exportable inside GLB |
| VFX | Parameters: colour, size, speed, duration, intensity | ✅ | UI wired | 🟡 | — |
| Weapons | 7 original procedural weapons, 4 elements, hand socket L/R, rotation, scale | ✅ | e2e 15 | 🟡 | Grip rotation may need manual adjustment per rig |
| Weapons | Chain weapon throw/recall, sword trails, costumes/masks | ⏳ | — | — | Backlog |
| Image→3D | Reference photos (JPG/PNG/WebP) stored byte-identical at full resolution | ✅ | e2e 23–24 (2400×1600 upload byte count verified) | 🟡 | — |
| Image→3D | Backend URL/token config, health check, job submit/poll/result, import as project | ✅ client · 🔌 server | e2e 24 vs test-only mock | — | Real generation needs GPU (TripoSR on Colab/PC) |
| Image→3D | TripoSR FastAPI server (`backend/`) | 🔌 | syntax-checked only (no GPU/pip here) | — | Output unrigged, quality below Meshy |
| Storage | IndexedDB projects, rename/duplicate/delete confirm, quota display, persist request | ✅ | e2e 18, 21–22 | 🟡 | Browser may evict if not persistent |
| Export | Original file byte-identical + SHA-256 verify | ✅ | e2e 19 | 🟡 | — |
| Export | New GLB with all (incl. imported) clips, optional weapon | ✅ | e2e 20 (re-parsed: 28 animations) | 🟡 | Effects not included |
| Export | Backup ZIP / restore | ✅ | unit + e2e 21 | 🟡 | — |
| Export | FBX, optimized/LOD variant, engine-specific packages | ⏳ | — | — | Backlog |
