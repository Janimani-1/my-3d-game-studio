# MY 3D GAME STUDIO — CLAUDE MASTER BUILD SPECIFICATION

> **Read this entire document as the authoritative product requirements and implementation contract.**
> Build a real, working, modular application. Do not claim a feature is implemented unless it is functional and tested. Do not waste messages asking questions already answered here.

## 0. Instructions to Claude

You are the lead software architect, full-stack engineer, 3D graphics engineer, technical animator, and QA engineer for this project. The user is a non-programmer working primarily on a Samsung Android phone using Chrome. Deliver an actual usable project, not mockups or pseudocode.

**Primary task:** Implement Phase 1 now, in full, with source code and instructions. Keep the entire roadmap in `PROJECT_PLAN.md` for subsequent sessions. Prefer creating downloadable project files/ZIP where your environment supports them. If you cannot write files directly, output a clearly labeled, complete file tree and the full content of each Phase 1 file. Avoid huge one-file prototypes; prefer maintainable modules.

**User-facing UI language:** Persian (RTL) by default, with German and English toggles. Technical filenames, code, API names, and developer documentation should be English. Make the UI touch-friendly and responsive on a Samsung Android device.

**Budget:** Personal-use, free-first, no mandatory subscriptions or paid APIs. Clearly distinguish free software from potentially paid compute/hosting. Never secretly require tokens, accounts, or external services. Do not promise zero-cost cloud GPUs or permanently available free services.

**Priority:** Functionality, correctness, asset preservation, portability, and easy setup. Keep a working app at the end of each phase. If scope exceeds a response, finish Phase 1 and record exact next tasks, not pretend the entire system is complete.

## 1. Product vision and boundaries

Create **My 3D Game Studio**, a personal mobile-first PWA that allows the user to import images and 3D assets, view and manage textured characters, rig them when feasible, preview and combine combat animations, equip weapons, author stylized VFX, and export assets for GDevelop, Godot, and Unity.

The long-term app should support image-to-3D through an **optional** open-source backend; a browser-only phone app cannot reliably perform high-quality image-to-3D, automatic rigging, or complex motion synthesis entirely offline. The first working phase must operate without any AI service using user-provided GLB/GLTF assets.

Preserve original uploaded files unchanged. A single image cannot guarantee a perfectly faithful unseen backside or identical geometry; make this limitation explicit. Offer quality controls and side-by-side comparison rather than falsely promising lossless image-to-3D conversion.

## 2. Required technology and architecture

- Frontend: TypeScript, Vite, React (or a clearly justified similarly maintainable alternative), Three.js, React Three Fiber optional.
- PWA: installable manifest and service worker; cache the application shell, not enormous assets without user consent.
- Data: IndexedDB for local projects and metadata, with blobs and explicit export/import backups. Account for browser storage limits and eviction.
- 3D: Three.js GLTFLoader, OrbitControls, AnimationMixer, animation clips, material/texture inspection, camera and lighting controls.
- Rendering: WebGL with context-loss recovery and mobile GPU fallback messages; no assumed WebGPU support.
- Animation: skeleton/bone viewer, transform controls where feasible, clip preview, timeline sequencing, blending, and retargeting as future modules.
- Backend (optional, later): Python FastAPI and adapter interfaces for licensed open-source image-to-3D, rigging, and motion pipelines. Check actual model licenses and deployment requirements before integration.
- File formats: GLB/GLTF for import/export first; FBX only if a working, tested conversion path exists. Clearly disclose whether animations and textures are embedded.
- Game compatibility: validate output in target engines; do not claim universal support for custom shaders, particles, constraints, or physics.
- Security: no hardcoded API secrets, no arbitrary remote code execution, local-first privacy, validate file types/sizes.

## 3. Phase 1 — mandatory runnable MVP (implement now)

Deliver a mobile-friendly application with:

1. Persian RTL UI, language switch to German/English, accessible touch targets, dark theme.
2. Import local GLB/GLTF (including linked resources if technically supported); drag/drop on desktop and file picker on Android.
3. 3D viewport with orbit/zoom, reset camera, front/back/side/top presets, floor grid toggle, lighting and background adjustments.
4. Inspect model mesh counts, triangles, vertices, materials, textures, skeletons, and available animation clips.
5. Play/pause/stop an existing animation, playback speed, loop toggle, animation selection.
6. Save project locally in IndexedDB, reopen it, rename, duplicate, delete with confirmation.
7. Preserve original asset bytes; allow exporting the original asset and project backup ZIP or JSON+assets bundle (document exactly what is exported).
8. Working loading/progress indicators and meaningful errors, especially WebGL/context loss and storage quota.
9. Clear buttons for **implemented** features only. Future modules should be visibly marked 'Coming later', not simulated.
10. A working example using a properly licensed sample GLB/GLTF with attribution, or a procedural test character if a distributable sample cannot be bundled.
11. Offline operation after first load for local asset management, subject to browser capabilities.
12. Setup and test instructions for Android Chrome, plus desktop fallback.

**Acceptance tests:** Import a GLB, rotate and zoom, play an embedded animation if present, save project, reload page, reopen project, export preserved original file, switch language, and recover gracefully from an invalid file. All must work before Phase 1 is declared complete.

## 4. Image-to-3D and quality workflow (Phase 2)

- Upload JPG/PNG/WebP reference images; background removal and cropping tools where feasible.
- Optional adapter to open-source image-to-3D inference such as TripoSR or Stable Fast 3D **only after checking availability, license, weights, compute requirements, and current compatibility**.
- Distinguish single-image reconstruction from multi-view workflows. Unseen surfaces are estimates.
- Provide clear status and errors when the backend is unavailable; no fake generation.
- Keep high-resolution source references, original generated meshes/textures, and independently optimized mobile derivatives.
- Adjustable triangle budgets, texture resolution, material quality, LOD, and preview comparisons.
- Do not destructively overwrite original geometry or textures.

## 5. Rigging and animation system (Phase 3)

- Inspect skeleton and bone hierarchy, preview joints, verify skin weights, inspect bind poses.
- Manual bone placement and transform correction where practical; A-pose/T-pose calibration.
- Optional external rigging adapter, not an invented automatic-rigging promise.
- Support named humanoid bone mapping, animation retargeting with validation, and clip imports.
- Explicitly detect missing or mismatched bones; do not distort limbs silently.
- Preview animations from front, back, left, right, and free orbit.
- Provide a per-joint correction workflow, including chin/head, shoulders, elbows, wrists, hips, knees, and ankles.
- Handle asymmetric characters, uneven poses, and attached clothing or props.

## 6. Complete combat animation catalog (Phase 4)

The following are **required catalog entries and future authoring/import targets**, not a claim that animations can be generated from text offline. Each entry needs a unique ID, human-readable names in FA/DE/EN, category, required rig type, loop flag, root-motion policy, duration, and optional impact markers. Support importing clips from legal sources and creating/editing clips with tools where implemented.

### 6.1 Punches
- Left/right straight jab; alternating rapid punches.
- Hook punches, uppercuts, spinning backfist.
- Jump punch; crouching punch; double-fist heavy strike.
- Running punch; three-, four-, and five-hit punch combinations.
- Guard, feint, dodge, block, and counterpunch.

### 6.2 Kicks
- Front kick, side kick, back kick, high kick.
- Standing spinning kick, low/crouched spinning kick, half-crouched kick.
- Jump kick, flying side kick aimed at opponent head, flying front kick.
- Double-foot airborne kick; 360-degree and 540-degree spin kicks.
- Scissor-style airborne kick similar to a football bicycle/scissor kick.
- Forward kick followed by backward somersault and stable standing landing.
- Running kick; multi-hit kick combos; low sweep.

### 6.3 Acrobatics and movement
- Idle/breathing, walk, jog, sprint, turn, strafe, crouch, kneel, crawl.
- Vertical jump, long jump, forward/back/left/right jumps.
- Front flip, backflip, standing back somersault, flip-with-kick.
- Ground roll, dive roll, evasive roll, sidestep, dodge around opponent.
- Get up from prone/supine, quick recovery, controlled landing.

### 6.4 Defense, reactions, knockdowns
- Hand guard, kick block, sword block, stagger from light/heavy hits.
- Fall forward/backward/sideways; collapse and roll; prone/supine rest.
- Knockout, death/fall animations, recover and stand.
- Different reaction variants based on hit location and intensity.

### 6.5 Grappling and special stances
- Two-hand forward grab, single-hand grab, hold/release, push, throw (non-graphic).
- Two-hand forward power-casting stance; one-hand projectile-casting stance.
- Martial arts ready stances and transitions.

## 7. Weapons and attachments (Phase 5)

Create modular weapon assets and a weapon attachment interface for:

- Short/long sword, two-handed sword, axe, battle axe, dagger, dual daggers.
- Ninja throwing stars, spear, war hammer.
- Ice/fire/electric fantasy weapon variants.
- Chain-attached sword and chain-attached axe that launch toward an opponent and return to the hand.

Functional requirements:

- Attach to a named hand bone/socket; swap hands; draw/sheath, equip/unequip.
- Swing, block, throw, return, and catch animations.
- Projectile trajectory, trail, impact, cooldown, and return timing.
- Visible animated chain using a lightweight segmented curve or constrained simulation appropriate to mobile devices.
- Collision hooks, weapon hitboxes, animation events, and VFX triggers.
- Weapon geometry/materials must be original or properly licensed.

## 8. Original fantasy ninja costumes and archetypes

- Ice-themed masked warrior, electric-themed masked warrior, fire-themed masked warrior.
- Original masks, hoods, light/heavy armor, cloaks, animated fabric approximations.
- Color/material customization and detachable equipment.
- **Do not copy recognizable copyrighted characters, logos, costumes, or names**, including direct reproductions of Sub-Zero or other fighting-game characters. Design distinct original archetypes.

## 9. Visual effects (Phase 5)

Provide modular editable VFX presets for:

- Energy beam from one hand; energy beam from two extended hands.
- Energy projectile, shockwave, energy explosion, hit flash.
- Fire, ice, freezing, lightning, smoke, dust, sparks, sword trails.
- Fast-motion afterimage/trail, impact shockwave, ice shatter, fire burst.
- Chain weapon throw/return trails and impact.

Editable parameters: color, brightness, scale, duration, velocity, direction, emission rate, start/end event, target bone/socket, and performance quality. Use Three.js particles/meshes/shaders as appropriate. Export compatibility must be explicit: offer sprite-sheet or engine-specific recreation data if shader-based VFX cannot transfer as GLB.

## 10. Multi-animation timeline and combos (Phase 4)

The user must be able to select **multiple clips**, arrange them, and play them as one sequence.

Examples:
- Idle → run → jump → spinning kick → backflip → land → idle.
- Draw sword → attack → throw chained sword → impact → return/catch → block.
- Two-hand charging pose → energy projectile → opponent hit reaction → recovery.

Required editor concepts:
- Timeline with draggable clips, trim, speed, loop, root motion, transition durations.
- Crossfades and blending; upper/lower-body layers only when the rig supports them.
- Event markers for hit frames, foot contacts, weapon release/catch, projectile spawn, VFX start/stop.
- Preview from all angles; save named combos; export individual clips or sequences where technically supported.
- Correctly handle incompatible skeletons, coordinate systems, and root-motion offsets.

## 11. Two-character combat sandbox (Phase 6)

- Spawn two characters; assign attacker/defender, facing and distance.
- Show hitboxes/hurtboxes, attack timing, collisions, and reactions.
- Test weapon/projectile/VFX alignment, knockdown and recovery.
- Camera presets and debug overlays for animation synchronization.
- This is an **animation testing sandbox**, not a full commercial game.

## 12. Scene editor and capture

- Floor grid, simple environment, lights, shadows, background, camera controls.
- Front/side/back/top/free camera views and third-person camera.
- Save scene setup, screenshot capture; video capture only if browser API and performance support it.
- Adjustable mobile performance settings and frame-rate monitoring.

## 13. Export targets and compatibility (Phase 7)

- GLB/GLTF with meshes, materials, textures, skeleton and supported clips.
- Original asset download without modification; optimized variant separate.
- FBX only with a tested converter and documented limitations.
- Export one clip, multiple clips, or combined sequence as supported.
- For GDevelop, Godot and Unity, provide explicit import steps, axis/unit conventions, bone mapping, root motion, and clip naming.
- Particle/shader VFX cannot always be embedded portably in GLB: export texture atlases/sprite sheets and configuration as alternatives.
- Validate sample exports by reimporting and testing playback.

## 14. Project management and persistence

- Auto-save when safe, explicit manual save, rename, duplicate, delete confirmation.
- Per-character folders/collections, tags, animation libraries, weapon/VFX presets.
- Backup and restore, versioned project schema, migration support.
- Local-first storage with quota warnings; original assets never overwritten.
- Never upload user files without clear opt-in.

## 15. UI layout

Mobile bottom navigation:
1. **Projects** — saved characters and projects.
2. **Import / Create** — GLB/GLTF and optional image workflow.
3. **Viewer** — interactive 3D, camera and materials.
4. **Animate** — clips, skeleton, timeline, combos.
5. **Weapons & VFX** — attachments and effects.
6. **Export** — original, GLB/GLTF, backup, engine-specific guidance.

Use concise Persian labels, clear icons, large touch targets, no misleading paywalls or fake actions. Show feature availability and backend requirements explicitly.

## 16. Quality, tests, and nonfunctional requirements

- Support Android Chrome and modern desktop browsers.
- Test on narrow portrait screen and landscape orientation.
- Recover from WebGL context loss, malformed files, oversized models, memory pressure, storage quota errors.
- Avoid blocking main thread on large processing; use Web Workers where appropriate.
- Provide sample assets with legal provenance and credits.
- Include unit tests for data/model logic and smoke tests for import/save/reopen/export.
- Document known limitations and actual measured capabilities.
- Never claim that all combat animations, auto-rigging, or high-quality 3D generation are working until each is independently implemented and tested.

## 17. Deliverables and persistent project documentation

Create:

- Runnable source project with package manifest and dependency lockfile.
- `README.md`: install, run, Android usage, troubleshooting.
- `PROJECT_PLAN.md`: complete roadmap and status checklist, preserving **all requirements** from this specification.
- `CHANGELOG.md`: implemented changes and remaining work.
- `ARCHITECTURE.md`: components, interfaces, storage format, optional backend.
- `TEST_PLAN.md`: manual and automated acceptance criteria.
- `LICENSES.md`: licenses for dependencies, AI models, and bundled assets.
- An optional ZIP artifact containing all project files.

## 18. Exact execution instructions

1. Summarize the implementation plan in **no more than 12 concise lines**.
2. Implement the complete Phase 1 MVP immediately, with real working code and no placeholders masquerading as functionality.
3. Run any available tests/build checks; report which checks were actually executed and which could not be executed.
4. Package the runnable files if your environment supports it.
5. Explain the shortest way for a nontechnical Android user to open/test the app. If hosting is required for reliable PWA behavior, give a free-first deployment option and clarify the hosting tradeoffs.
6. Preserve the full requirements in `PROJECT_PLAN.md` so later sessions can resume without repeating prompts.
7. Stop after delivering a functional Phase 1 and its documentation; do not spend tokens fabricating unfinished advanced modules.

**Definition of done for Phase 1:** A user can import a textured 3D model, inspect and orbit it, preview any embedded animation, save/reopen the project, and export the unchanged source file on Android Chrome. Everything else is a tracked later phase.

---

## Short Persian explanation for the owner

این فایل شامل دو بخش اصلی درخواست شماست: (۱) ساخت اپ شخصی سه‌بعدی‌سازی و مدیریت مدل روی موبایل، (۲) کتابخانه کامل انیمیشن‌های رزمی، سلاح‌ها، زنجیر، افکت‌های یخی/برقی/آتشین و ترکیب چند حرکت. متن فنی به انگلیسی نوشته شده تا Claude بتواند آن را مستقیماً به مشخصات مهندسی و کد تبدیل کند. ساخت مدل سه‌بعدی از عکس و انیمیشن‌های پیچیده به موتورهای جداگانه و گاهی پردازش سنگین نیاز دارد؛ بنابراین ابتدا نسخه پایه قابل اجرا ساخته می‌شود و بقیه قابلیت‌ها مرحله‌به‌مرحله اضافه خواهند شد.
