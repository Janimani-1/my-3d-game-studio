# Licenses

| Component | License | Use |
|---|---|---|
| This project's code | MIT (see LICENSE) | — |
| Three.js r169 (core, GLTFLoader, OrbitControls, DRACOLoader, SkeletonUtils, GLTFExporter, BufferGeometryUtils, TextureUtils) | MIT — vendor/three/LICENSE | bundled |
| meshoptimizer decoder | MIT | bundled |
| Draco decoder | Apache-2.0 | bundled (dist/draco_*) |
| React 19 / React DOM / scheduler | MIT | bundled |
| **RobotExpressive.glb** — model by Tomás Laulhé (Quaternius), modifications by Don McCurdy | **CC0 1.0** — assets/robot-expressive.LICENSE.md | demo character |
| Procedural weapons, icons, test mannequin | CC0 (original work) | generated in code |
| Build/test tools: esbuild (MIT), TypeScript (Apache-2.0), tsx (MIT), Playwright (Apache-2.0), sharp (Apache-2.0) | — | not shipped |

## Backend / AI models (not shipped; installed by the user)
| Model | Code | Weights | Notes |
|---|---|---|---|
| TripoSR (Stability AI & Tripo AI) | MIT | MIT (huggingface.co/stabilityai/TripoSR, gated form) | default adapter, ~6–8 GB VRAM |
| TRELLIS (Microsoft) | MIT | MIT | planned adapter, 16–24 GB VRAM |
| Hunyuan3D 2.x (Tencent) | — | — | **excluded**: license does not apply in the EU/UK/South Korea |
| rembg (background removal) | MIT | U²-Net weights (Apache-2.0) | backend dependency |

Not used: Meshy code/assets/endpoints/branding; Mixamo-derived samples (redistribution terms unclear); Khronos CesiumMan (contains trademarked logo).

User content (photos, models) stays on the device and is never committed to the repository.
