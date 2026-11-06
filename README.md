# My 3D Game Studio — v0.2.0

Mobile-first PWA for game characters: import / view / animate / combo / weapons / elemental VFX / export, plus an optional image-to-3D GPU backend. Workflow inspired by tools like Meshy (photo → mesh → rig → animate → export); all code and design are original.

**Live app:** https://janimani-1.github.io/my-3d-game-studio/ · Persian docs: [README_FA.md](README_FA.md) · Status: [FEATURE_STATUS.md](FEATURE_STATUS.md)

## Quick start (developer)
```bash
npm install                  # no lockfile could be generated in the offline build sandbox; commit the one this creates
npm run build                # → dist/ (self-contained; Three.js r169 vendored in vendor/three and bundled)
npm run serve                # http://localhost:5173
npm test                     # unit tests (node:test + tsx)
npx playwright install chromium && npm run test:e2e   # 28-step browser test with real WebGL (SwiftShader)
```
`npm run check` = typecheck + unit + build + e2e. CI: `.github/workflows/ci.yml`.

## Layout
```
src/core      pure TS: glTF inspector, IndexedDB, ZIP, project schema v2, i18n, catalog, rig detection, backend client
src/viewer    Three.js runtime: engine (load, crossfade, sequences, clip import, bones, arena, export), vfx, weapons
src/ui        React panels: Projects, Image→3D, Character, Combat, Weapons & VFX, Export
backend/      optional FastAPI + TripoSR image-to-3D server (GPU) — see backend/README.md
vendor/three  Three.js r169 (MIT) build + used addons + Draco decoder
assets/       RobotExpressive.glb (CC0) demo character
scripts/      build, serve, e2e test, test-only mock backend
```

## Deploy
`gh-pages` branch = contents of `dist/` (GitHub Pages, branch `gh-pages`, root). Rebuild and push `dist/` to update. The GPU backend cannot run on GitHub Pages.

## Privacy & security
No secrets in the repo. Projects, photos and models stay in the browser (IndexedDB). Images go to a backend only when the user presses Generate, only to the URL they entered. Backend supports an optional bearer token and a CORS allow-list.

Docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [PROJECT_PLAN.md](PROJECT_PLAN.md) · [TEST_RESULTS.md](TEST_RESULTS.md) · [TEST_PLAN_ANDROID_FA.md](TEST_PLAN_ANDROID_FA.md) · [CHANGELOG.md](CHANGELOG.md) · [LICENSES.md](LICENSES.md)
