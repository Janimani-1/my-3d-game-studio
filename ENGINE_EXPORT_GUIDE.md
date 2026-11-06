# Using exported characters in game engines

**Export → “Export new GLB”** writes a new binary glTF (the original import stays untouched) containing mesh, materials, textures, skeleton and **every clip** of the character — including clips imported from other files and the retargeted Studio Combat Pack. Clip names are kept (e.g. `Front_Kick_R`, `Backflip`). Units: metres; +Y up; character faces +Z (glTF convention). VFX, chain links and trails are runtime effects of this app and are **not** inside the GLB.

Verified automatically: the exported file re-imports into the app, renders and plays its retargeted clips (TEST_RESULTS.md, step 32). Not verified here: the engines themselves (not available in the test environment).

## Godot 4.x
1. Copy the `.glb` into your project folder → Godot imports it as a scene.
2. Instance it; the `AnimationPlayer` node lists all clips by name. `animation_player.play("Front_Kick_R")`.
3. Root motion: clips with travel (Backflip, Roll_Forward, Fall_Back/Get_Up) move the `Hips` bone; in-place clips keep the hips near the origin. To use root motion, set the AnimationTree `root_motion_track` to the hips position track.

## Unity (2021+)
1. Install the free **glTFast** package (Package Manager → Add by name: `com.unity.cloud.gltfast`).
2. Drop the `.glb` into `Assets/`. glTFast creates the model and animation clips (legacy Animation by default; enable Mecanim/Animator import in glTFast settings if you need an Animator Controller).
3. Unity’s Humanoid avatar retargeting is not needed for the clips stored in the file — they already match the file’s own skeleton.

## GDevelop
1. Add a **3D model** object and choose the `.glb`.
2. In the object’s animations list, add animations by clip name (`Spin_Kick_360`, …) and play them from events.

## Limits
- Retargeted clips are baked at 30 fps per bone (quaternions + hips position).
- Bone twist around the bone axis is approximated by the retargeter; finger bones are not animated by the combat pack.
- FBX export is not available (no tested free converter in the browser).
