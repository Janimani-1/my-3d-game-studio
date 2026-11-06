# CLAUDE EXECUTION BRIEF — MY 3D GAME STUDIO

## Your mission
You are the lead engineer. Turn the existing `my-3d-game-studio-phase1-v0.1.0.zip` into the most complete **working, mobile-first 3D character creation and animation studio** achievable using free/open-source components. The owner uses an Android Samsung Z Flip phone and has an existing GitHub account. Deliver a working HTTPS URL usable in Chrome, a downloadable ZIP, source code, and reproducible documentation. **Do not stop at a proposal, mockup, placeholder buttons, or a sample blocky character.** Work autonomously as far as your tools and authorized access permit. Only interrupt for necessary authentication/permissions, unavoidable external actions, or genuinely blocking issues. Never claim a feature works without testing it.

## Background and target
The owner has photos of a high-quality fantasy forest barbarian originally modeled in Meshy, but **does not have the GLB** because Meshy export requires payment. Do not claim screenshots/PNG images are equivalent to a real 3D mesh. The old blocky prototype was unacceptable; replace it with a realistic/stylized high-quality demo asset from a legally usable source if possible. The owner needs many distinct characters, not one preset animation, and expects a Meshy-like workflow, with more combat moves and elemental VFX. This is for personal use, but check each model/library license independently (personal use does not automatically permit copying proprietary assets or software).

## Non-negotiable reality and transparency
1. A browser-only viewer cannot generate a faithful detailed 3D model from one photo by itself. Real image-to-3D requires an actual inference engine and generally GPU compute. Do not pretend that a Three.js primitive is an AI-generated 3D model.
2. Use only legally available, properly licensed open-source libraries, pretrained weights, sample characters, and animations. Do not scrape or clone Meshy's proprietary code, assets, service endpoints, branding, or paid content. Build **similar user-facing functionality independently**.
3. Free GPU hosting (including Colab) is quota-limited, not guaranteed always available, and may require the owner to start a session. Design graceful fallback. Never ask for passwords or publish tokens in a repository.
4. Never publish the owner's private photos, character models, backups, API keys, or project data to public GitHub. Public repo must contain only app code and explicitly licensed sample assets. Project data stays local by default; upload to a remote backend only with informed opt-in.
5. Preserve original imported GLB/GLTF bytes unchanged and verifiable; any optimized/edited export must be clearly a *new* file. Warn when formats/extensions or engine limitations prevent lossless export.
6. No fake rigging, animations, AI generation, or VFX. Clearly distinguish built/tested, implemented-but-untested, unavailable, and future features.

## Product UX
- Responsive installable PWA, Persian RTL as default, switchable German and English, dark mode, large touch targets, phone-first UI, useful desktop mode.
- Six clear navigation areas: Home/Projects, Image-to-3D, Character/Rig, Animation/Combat, Weapons/VFX, Export/Settings. Keep UI usable even when inference backend is offline.
- Import PNG/JPEG/WebP, GLB, GLTF with external bin/textures, and animation clips where supported. File validation, size limits, helpful Persian errors.
- Full 3D preview with orbit/pan/zoom, camera presets (front/back/left/right/top), lighting, ground, skeleton overlay, model stats, animation selector and playback speed/loop controls.
- IndexedDB local project storage, backups and restore, file hash, rename/duplicate/delete, safe storage quota handling, responsive handling of WebGL context loss.
- Installable over HTTPS, offline shell and locally cached assets after initial installation. **Bundle the Three.js runtime and dependencies in the build** instead of relying on CDN caching for offline correctness.

## Real image-to-3D pipeline
- Integrate a real, legally usable open-source image-to-3D model such as TripoSR or Stable Fast 3D **only after verifying current code/weight licenses and deployment feasibility**. Do not assume their output is rigged or fully textured. Research whether a stronger freely available alternative is appropriate, but do not use a paid service without owner approval.
- Create a modular backend adapter (e.g. Python/FastAPI) with job submission, progress, failure handling, image preprocessing, output GLB/GLTF retrieval, and an optional self-hosted/Colab execution guide. Support backend URL configuration and clear connection status.
- If no GPU is accessible, provide a genuinely usable standalone studio for importing, viewing, animating and exporting existing models, and a real but clearly disabled 'Generate 3D' action explaining what must be connected. Do not generate blocky approximations and present them as faithful image-to-3D results.
- Preserve best available resolution; optionally create a separate game-optimized version. Never promise identical reconstruction of unseen body surfaces from one photo.

## Character and rigging
- Import skinned/rigged GLB with skeleton and animations; inspect bone hierarchy; preview A/T pose and bone transforms.
- Support standard humanoid rigs, mapping/retargeting where feasible (Mixamo-like and glTF rigs), and clearly document skeleton incompatibilities.
- Implement practical automatic rigging **only if an actual rigging backend is integrated** and tested. Otherwise provide manual bone mapping, animation import, and export rather than claiming auto-rigging.
- Character equipment sockets for hands/back, customizable appearance/materials, hair, outfits, armor and masked elemental ninjas with original designs (not direct copyrighted Mortal Kombat characters).

## Combat animation library — independent, reusable clips
Every move must be selectable independently per character, not hardwired into one hero. Provide categorized searchable UI, animation import and retargeting, speed, mirroring where valid, loop, blend, transitions, timeline sequencing and saveable combo presets.

**Locomotion and stance:** idle, breathing, fighting stance, walk, run, sprint, turn, crouch, kneel, sit, crawl, prone, lie face-up/face-down, stand up, jump, forward/back/side jumps, land.

**Punches:** left/right straight jab, cross, hook, uppercut, spinning backfist, spinning punch, jumping punch, crouching punch, double-hand power strike, running punch, fast combos.

**Kicks:** front kick, side kick, back kick, standing roundhouse, crouching spinning sweep, standing spinning kick, rising kick, jumping front/side kick, flying head-height side kick, double-foot jump kick, 360/540 spinning kicks, football bicycle/scissor-style kick, forward striking kick into backward flip and controlled landing, running kick, multi-kick combos.

**Acrobatics and evasion:** forward/back flips, standing backflip, cartwheel, aerial flip with kick, ground roll, dive-roll, dodge, sidestep, recovery, knockback.

**Grapple/defense/damage:** forward two-hand grab, grab/hold/release, blocks, parry, guard, stagger, hit reactions, fall front/back/side, knockdown, unconscious, death and get-up variants.

**Weapons:** one/two-handed sword, axe, dagger/dual daggers, throwing knives, shuriken, spear, hammer, fantasy ice/fire/electric weapons; draw/sheath, grip, swing, combo, block, throw, recall. Use bone sockets, object animation and optional physics.

**Chained weapon:** chain-attached axe/sword thrown toward opponent then recalled, animated flexible chain/rope with reasonable performance and impact timing.

**Elemental powers and VFX:** fireball/fire beam, ice blast/freeze/shatter, lightning/electric arcs, energy beam from one hand and two outstretched hands, shockwave, smoke, dust, impact sparks, sword trails, explosions, motion streaks. Use real Three.js particle/mesh/shader effects; tune color, size, duration, direction, speed, intensity; attach effects to bones and trigger via timeline events.

**Combo editor:** drag/select clips in a timeline, per-clip trim/speed, blend transitions, synchronized impact markers, animation events, weapon throw/recall and VFX triggers. Example: run -> jump -> spinning kick -> backflip -> land -> guard. Another: draw chained axe -> throw -> impact -> recall -> block.

**Two-character test arena:** place attacker and defender, select independent rigs and animations, position/orient them, simple hitbox/hurtbox visualization, attack timing, reactions, camera orbit. This is an animation test sandbox, not a promise of a full fighting game.

## Important delivery priority: working beats breadth
It is NOT credible to guarantee all listed advanced moves, auto-rigging and image-to-3D in one response without GPU, assets and extensive testing. Deliver the **largest truly working subset**, with the entire long-term specification preserved. At minimum, deliver:
1. Functional Android-hosted PWA with real 3D rendering and local persistence.
2. A polished, legally distributable rigged humanoid demo asset and **multiple actually playable distinct clips**, not a primitive placeholder. If licensing/asset download blocks this, document it transparently and make the app work with user-imported GLB.
3. Real independent animation selection, preview, clip switching and basic two-or-more clip sequence/combo editor.
4. At least one working projectile/VFX (fire, ice or energy) attached to the character with configurable controls, and a weapon attachment demo if feasible.
5. Working import/export, preserving originals, and clearly labeled export compatibility limits.
6. An operational, configurable backend interface for image-to-3D, with actual inference integration if a GPU is available; otherwise runnable backend instructions and a truthful status in UI.
7. Full project source, reproducible build, and honest tests.

Do not replace functionality with screenshots or decorative controls. If resources are limited, implement fewer features correctly rather than a huge nonfunctional interface. Keep all unimplemented features as an explicit backlog, not as fake working buttons.

## Deployment and security
- Start from the existing Phase 1 ZIP, inspect source and tests, fix actual issues, and preserve working features. Do not silently rebuild from scratch.
- If you have authorized GitHub integration/access, create a **new, separate repository**, commit source code, use GitHub Actions to build and publish static frontend to GitHub Pages. Request explicit authorization if needed. Do not touch existing game repos.
- Backend GPU inference cannot run on GitHub Pages: deploy it separately only where permitted, or supply self-host/Colab instructions. Never claim GitHub Pages hosts GPU models.
- Set appropriate repository visibility, licensing, dependency pinning, lockfile, README, no secrets, basic security checks, CORS guidance and privacy warnings.
- If no GitHub write access, provide a complete deploy-ready ZIP and exact simple phone-first steps; never pretend deployment occurred.
- Verify the live HTTPS URL and at least one model + animation on real WebGL-capable browser if tools permit. Distinguish browser emulation from physical Android testing.

## Testing and evidence
- Build/test with pinned dependencies; unit tests, browser smoke tests, import/export round trip, invalid GLB, IndexedDB reload, animation clip switch, combo sequencing, VFX toggle, mobile responsive, offline service worker, WebGL context loss.
- Include TEST_PLAN_ANDROID_FA.md with simple numbered manual tests for the owner's phone and screenshots/error collection guidance.
- Provide a test matrix: each feature, actual implementation, automated test, real-device test, limitations.
- Never claim tests passed if unavailable. Clearly identify external dependency failures.

## Final deliverables (do not finish with just a plan)
- Working Android-accessible HTTPS URL, if GitHub permissions allow deployment.
- Installable PWA, build output and downloadable ZIP.
- Full source repo and GitHub commit/link if created.
- `README_FA.md`, `INSTALL_ANDROID_FA.md`, `PROJECT_PLAN.md`, `ARCHITECTURE.md`, `TEST_PLAN_ANDROID_FA.md`, `TEST_RESULTS.md`, `CHANGELOG.md`, `LICENSES.md`, `FEATURE_STATUS.md`.
- Exact instructions for importing the user's own barbarian photos, plus explanation that these photos are not yet a mesh and a real GPU generation backend is required.
- Clear next steps for adding the remaining animation library, retargeting, automatic rigging, and optional paid-quality GPU services later **only with explicit approval**.

## Operating instructions to Claude
Work continuously and proactively as far as your environment allows. Inspect files, implement, build, test, debug, deploy if authorized, and provide the finished working result. Avoid repeated confirmation requests or wasting context on lengthy plans. Preserve this brief in `PROJECT_PLAN.md` so work can resume in future sessions. Ask the owner only for essential authentication or files. **Do not say 'finished' until you can show what actually runs, where it runs, and what remains unsupported.**
