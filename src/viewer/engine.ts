/**
 * Imperative Three.js viewer / animation runtime.
 * Three.js r169 is vendored and bundled (lazy chunk) — no CDN, works offline.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { VfxSystem, type VfxMode, type VfxParams } from './vfx';
import { buildWeapon, disposeObject, type WeaponElement, type WeaponType } from './weapons';
import { detectHumanoid, trackCompatibility, type Slot } from '../core/rig';

export type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top';

export interface EngineEvents {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onTime?: (time: number, duration: number, playing: boolean) => void;
  onCameraChange?: () => void;
  onStats?: (fps: number, particles: number) => void;
  onSequenceStep?: (index: number) => void;
  onSequenceEnd?: () => void;
  onHit?: (count: number) => void;
}

export interface LoadedFile {
  name: string;
  blob: Blob;
}

export interface ClipInfo {
  name: string;
  duration: number;
  source: string; // 'model' or imported file name
}

export interface BoneInfo {
  name: string;
  depth: number;
}

export interface SequenceStep {
  clip: number;
  speed: number; // 0.1..3
  fade: number; // crossfade into this step, seconds
  trimStart: number; // 0..1
  trimEnd: number; // 0..1
  eventAt: number; // 0..1, -1 = none
  eventVfx: VfxMode | 'none';
}

export interface WeaponConfig {
  type: WeaponType;
  element: WeaponElement;
  hand: 'R' | 'L';
  rot: [number, number, number]; // degrees
  scale: number;
}

export interface ArenaConfig {
  distance: number; // in character heights
  opponentClip: number; // idle/stance clip for the defender
  reactionClip: number; // played on hit (-1 none)
  showBoxes: boolean;
}

let THREE: any = null;
let GLTFLoaderCls: any = null;
let OrbitControlsCls: any = null;
let DRACOLoaderCls: any = null;
let MeshoptDecoder: any = null;
let SkeletonUtils: any = null;
let GLTFExporterCls: any = null;
let engineLoad: Promise<void> | null = null;

export function loadEngine(): Promise<void> {
  if (engineLoad) return engineLoad;
  engineLoad = (async () => {
    const [t, g, o, d, m, s, e] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/loaders/DRACOLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
      import('three/addons/utils/SkeletonUtils.js'),
      import('three/addons/exporters/GLTFExporter.js'),
    ]);
    THREE = t;
    GLTFLoaderCls = (g as any).GLTFLoader;
    OrbitControlsCls = (o as any).OrbitControls;
    DRACOLoaderCls = (d as any).DRACOLoader;
    MeshoptDecoder = (m as any).MeshoptDecoder;
    SkeletonUtils = s;
    GLTFExporterCls = (e as any).GLTFExporter;
  })();
  engineLoad.catch(() => (engineLoad = null));
  return engineLoad;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const HAND_RE = { R: [/^(mixamorig:)?righthand$/i, /hand[._ ]?r$|r[._ ]?hand$|right.?hand/i, /palm2?[._ ]?r$/i, /(lower.?arm|forearm)[._ ]?r$|right.?forearm/i], L: [/^(mixamorig:)?lefthand$/i, /hand[._ ]?l$|l[._ ]?hand$|left.?hand/i, /palm2?[._ ]?l$/i, /(lower.?arm|forearm)[._ ]?l$|left.?forearm/i] };
const FOOT_RE = [/foot|ankle/i];

export class Viewer {
  private renderer: any;
  private scene: any;
  private camera: any;
  private controls: any;
  private clock: any;
  private grid: any;
  private keyLight: any;
  private ambient: any;
  private model: any = null;
  private skeletonHelper: any = null;
  private mixer: any = null;
  private clips: any[] = [];
  private clipSources: string[] = [];
  private action: any = null;
  private blobUrls: string[] = [];
  private raf = 0;
  private resizeObs: ResizeObserver | null = null;
  private disposed = false;
  private frame = { center: [0, 1, 0], radius: 1 };
  private height = 1.8;
  private lastTimeEmit = 0;
  private fullRes = false;
  private fpsFrames = 0;
  private fpsT = 0;
  private bones: any[] = [];
  private boneMarker: any = null;
  private markedBone: any = null;
  private weapon: any = null;
  private vfx: VfxSystem | null = null;
  private seq: { steps: SequenceStep[]; idx: number; elapsed: number; dur: number; fired: boolean; action: any; loop: boolean } | null = null;
  private arena: { cfg: ArenaConfig; opp: any; mixer: any; box: any; helper: any; markers: any[]; hits: number; cooldown: number; flash: number; mats: any[]; idleAction: any } | null = null;
  private lastVfx: VfxParams | null = null;
  speed = 1;
  loop = true;
  playing = false;

  constructor(private container: HTMLElement, private events: EngineEvents = {}) {
    if (!THREE) throw new Error('Engine not loaded');
    const canvas = document.createElement('canvas');
    canvas.className = 'viewport-canvas';
    canvas.addEventListener('webglcontextlost', this.handleLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleRestored, false);
    container.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
    this.applyPixelRatio();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1b1e27');
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.camera.position.set(0, 1.4, 4);

    this.controls = new OrbitControlsCls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 1, 0);
    this.controls.addEventListener('end', () => this.events.onCameraChange?.());

    this.ambient = new THREE.HemisphereLight(0xdde6ff, 0x30302a, 0.8);
    this.scene.add(this.ambient);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.keyLight.position.set(3, 5, 4);
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.4);
    rim.position.set(-3, 2, -4);
    this.scene.add(rim);
    this.grid = new THREE.GridHelper(10, 20, 0x5a6378, 0x343a4a);
    this.scene.add(this.grid);

    this.vfx = new VfxSystem(THREE, this.scene);
    this.clock = new THREE.Clock();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.loop_();
  }

  // ---------------------------------------------------------------- basics
  private handleLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
    this.events.onContextLost?.();
  };

  private handleRestored = () => {
    this.scene.traverse((o: any) => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        m.needsUpdate = true;
        for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].needsUpdate = true;
      }
    });
    this.events.onContextRestored?.();
    this.loop_();
  };

  simulateContextLoss(): boolean {
    const ext = this.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 1500);
    return true;
  }

  private targetRatio() {
    const dpr = window.devicePixelRatio || 1;
    return this.fullRes ? Math.min(dpr, 4) : Math.min(dpr, 2);
  }
  private applyPixelRatio() {
    this.renderer.setPixelRatio(this.targetRatio());
  }
  setFullResolution(on: boolean) {
    this.fullRes = on;
    this.applyPixelRatio();
    this.resize();
  }

  private resize() {
    if (this.renderer.getPixelRatio() !== this.targetRatio()) this.applyPixelRatio();
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vfx?.setViewportHeight(h * this.renderer.getPixelRatio());
  }

  private loop_ = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop_);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.updateSequence(dt);
    if (this.mixer) this.mixer.update(dt);
    this.updateArena(dt);
    this.vfx?.update(dt);
    if (this.boneMarker && this.markedBone) this.markedBone.getWorldPosition(this.boneMarker.position);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const now = performance.now();
    if (this.action && this.events.onTime && now - this.lastTimeEmit > 100) {
      this.lastTimeEmit = now;
      this.events.onTime(this.action.time, this.action.getClip().duration, this.playing && !this.action.paused);
    }
    this.fpsFrames++;
    this.fpsT += dt;
    if (this.fpsT >= 1) {
      this.events.onStats?.(Math.round(this.fpsFrames / this.fpsT), this.vfx?.activeCount ?? 0);
      this.fpsFrames = 0;
      this.fpsT = 0;
    }
  };

  /** Number of rendered draw calls in the last frame (used by tests to prove rendering). */
  renderInfo() {
    return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
  }

  // ---------------------------------------------------------------- loading
  private makeLoader(urlByName?: Map<string, string>, mainUrl?: string) {
    const manager = new THREE.LoadingManager();
    if (urlByName) {
      manager.setURLModifier((url: string) => {
        if (url.startsWith('data:') || url === mainUrl) return url;
        let clean = url.split(/[?#]/)[0];
        try {
          clean = decodeURIComponent(clean);
        } catch {
          /* keep raw */
        }
        const base = clean.split('/').pop()!.toLowerCase();
        return urlByName.get(clean.toLowerCase()) ?? urlByName.get(base) ?? url;
      });
    }
    const loader = new GLTFLoaderCls(manager);
    const draco = new DRACOLoaderCls();
    draco.setDecoderPath(new URL('./', location.href).href);
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  }

  async load(files: LoadedFile[], mainName: string): Promise<{ clips: ClipInfo[]; materialNames: string[]; bones: BoneInfo[]; humanoid: Partial<Record<Slot, string>> }> {
    this.clearModel();
    const urlByName = new Map<string, string>();
    for (const f of files) {
      const u = URL.createObjectURL(f.blob);
      this.blobUrls.push(u);
      urlByName.set(f.name.toLowerCase(), u);
    }
    const mainUrl = urlByName.get(mainName.toLowerCase());
    if (!mainUrl) throw new Error('Main file missing');
    const loader = this.makeLoader(urlByName, mainUrl);
    const gltf: any = await new Promise((resolve, reject) => loader.load(mainUrl, resolve, undefined, reject));
    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) throw new Error('No scene in file');
    this.model = root;
    this.scene.add(root);

    const materialNames = new Set<string>();
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy?.() ?? 1);
    this.bones = [];
    const boneInfo: BoneInfo[] = [];
    root.traverse((o: any) => {
      if (o.isMesh) {
        o.frustumCulled = !o.isSkinnedMesh;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue;
          materialNames.add(m.name || '(unnamed)');
          for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].anisotropy = aniso;
        }
      }
      if (o.isBone) {
        this.bones.push(o);
        let d = 0;
        for (let p = o.parent; p && p.isBone; p = p.parent) d++;
        boneInfo.push({ name: o.name, depth: d });
      }
    });

    this.skeletonHelper = new THREE.SkeletonHelper(root);
    this.skeletonHelper.visible = false;
    this.scene.add(this.skeletonHelper);

    this.clips = [...(gltf.animations ?? [])];
    this.clipSources = this.clips.map(() => 'model');
    this.mixer = new THREE.AnimationMixer(root);
    this.mixer.addEventListener('finished', (e: any) => {
      if (e.action === this.action && !this.seq) {
        this.playing = false;
        this.events.onTime?.(this.action?.time ?? 0, this.action?.getClip().duration ?? 0, false);
      }
    });

    this.computeFrame();
    this.resetCamera();
    return { clips: this.clipInfo(), materialNames: [...materialNames], bones: boneInfo, humanoid: detectHumanoid(boneInfo.map((b) => b.name)) };
  }

  clipInfo(): ClipInfo[] {
    return this.clips.map((c, i) => ({ name: c.name || `Clip ${i + 1}`, duration: c.duration, source: this.clipSources[i] }));
  }

  /** Import animation clips from another GLB/GLTF. Only clips whose tracks target bones that exist here are added. */
  async importClips(blob: Blob, sourceName: string): Promise<{ added: string[]; rejected: { name: string; reason: string }[] }> {
    if (!this.model) throw new Error('No model');
    const url = URL.createObjectURL(blob);
    try {
      const gltf: any = await new Promise((res, rej) => this.makeLoader().load(url, res, undefined, rej));
      const names: string[] = [];
      this.model.traverse((o: any) => o.name && names.push(o.name));
      const added: string[] = [];
      const rejected: { name: string; reason: string }[] = [];
      for (const clip of gltf.animations ?? []) {
        const targets = clip.tracks.map((t: any) => t.name.split('.')[0]);
        const c = trackCompatibility(targets, names);
        if (c.total === 0 || c.matched / c.total < 0.6) {
          rejected.push({ name: clip.name, reason: `${c.matched}/${c.total}` });
          continue;
        }
        const kept = clip.clone();
        if (c.missing.length) kept.tracks = kept.tracks.filter((t: any) => !c.missing.includes(t.name.split('.')[0]));
        let nm = kept.name || 'Imported';
        while (this.clips.some((x) => x.name === nm)) nm += '+';
        kept.name = nm;
        this.clips.push(kept);
        this.clipSources.push(sourceName);
        added.push(nm);
      }
      if (!(gltf.animations ?? []).length) rejected.push({ name: sourceName, reason: '0' });
      return { added, rejected };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private computeFrame() {
    const box = new THREE.Box3().setFromObject(this.model);
    if (box.isEmpty()) {
      this.frame = { center: [0, 0, 0], radius: 1 };
      return;
    }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.height = Math.max(box.max.y - box.min.y, 0.001);
    this.frame = { center: [sphere.center.x, sphere.center.y, sphere.center.z], radius: Math.max(sphere.radius, 0.001) };
    const s = Math.max(1, Math.pow(10, Math.ceil(Math.log10(sphere.radius * 4))));
    this.grid.scale.setScalar(s / 10);
    this.grid.position.y = box.min.y;
    this.camera.near = Math.max(0.001, sphere.radius / 1000);
    this.camera.far = sphere.radius * 1000;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = sphere.radius * 50;
    this.vfx?.setUnit(this.height);
  }

  // ---------------------------------------------------------------- camera & look
  /** Default: three-quarter view, so effects travelling forward are clearly visible. */
  resetCamera() {
    const [cx, cy, cz] = this.frame.center;
    const d = (this.frame.radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.15;
    this.controls.target.set(cx, cy, cz);
    this.camera.position.set(cx + d * 0.62, cy + d * 0.18, cz + d * 0.76);
    this.camera.lookAt(cx, cy, cz);
    this.controls.update();
    this.events.onCameraChange?.();
  }

  setView(v: ViewPreset, tilt = 0) {
    let [cx, cy, cz] = this.frame.center;
    let radius = this.frame.radius;
    if (this.arena) {
      cz += (this.arena.cfg.distance * this.height) / 2;
      radius += (this.arena.cfg.distance * this.height) / 2;
    }
    const d = (radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.1;
    const dir: Record<ViewPreset, [number, number, number]> = { front: [0, 0, 1], back: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0], top: [0, 1, 0.0001] };
    const [x, y, z] = this.arena && v === 'front' ? [1, 0, 0] : dir[v];
    const up = tilt ? 0.18 : 0;
    this.controls.target.set(cx, cy, cz);
    this.camera.position.set(cx + x * d, cy + y * d + up * d, cz + z * d);
    this.camera.lookAt(cx, cy, cz);
    this.controls.update();
    this.events.onCameraChange?.();
  }

  getCamera(): { position: [number, number, number]; target: [number, number, number] } {
    const p = this.camera.position;
    const t = this.controls.target;
    return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }
  setCamera(c: { position: [number, number, number]; target: [number, number, number] }) {
    this.camera.position.set(...c.position);
    this.controls.target.set(...c.target);
    this.controls.update();
  }
  setGrid(on: boolean) {
    this.grid.visible = on;
  }
  setBackground(hex: string) {
    this.scene.background = new THREE.Color(hex);
  }
  setLight(key: number, ambient: number) {
    this.keyLight.intensity = key;
    this.ambient.intensity = ambient;
  }
  setSkeleton(on: boolean) {
    if (this.skeletonHelper) this.skeletonHelper.visible = on;
  }

  highlightBone(name: string | null) {
    this.markedBone = name ? this.bones.find((b) => b.name === name) ?? null : null;
    if (!this.boneMarker) {
      this.boneMarker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f, depthTest: false, transparent: true, opacity: 0.9 }));
      this.boneMarker.renderOrder = 20;
      this.scene.add(this.boneMarker);
    }
    this.boneMarker.scale.setScalar(this.height * 0.02);
    this.boneMarker.visible = !!this.markedBone;
  }

  async screenshot(): Promise<Blob | null> {
    this.renderer.render(this.scene, this.camera);
    return new Promise((res) => this.renderer.domElement.toBlob((b: Blob | null) => res(b), 'image/png'));
  }

  // ---------------------------------------------------------------- animation
  private applyLoop() {
    if (!this.action) return;
    this.action.setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    this.action.clampWhenFinished = !this.loop;
  }

  /** Select a clip; if something is playing, crossfade to it. */
  selectClip(index: number, fade = 0.25) {
    if (!this.mixer) return;
    this.stopSequence(false);
    const next = index >= 0 && this.clips[index] ? this.mixer.clipAction(this.clips[index]) : null;
    if (!next) {
      this.mixer.stopAllAction();
      this.action = null;
      return;
    }
    const prev = this.action;
    const wasPlaying = this.playing && prev && prev !== next && prev.isRunning();
    this.action = next;
    this.applyLoop();
    if (wasPlaying) {
      next.reset();
      next.play();
      prev.crossFadeTo(next, fade, false);
      this.playing = true;
    } else {
      this.mixer.stopAllAction();
      this.playing = false;
    }
  }
  play() {
    if (!this.action) return;
    if (!this.action.isRunning()) {
      if (!this.loop && this.action.time >= this.action.getClip().duration - 1e-3) this.action.reset();
      this.action.play();
    }
    this.action.paused = false;
    this.action.enabled = true;
    this.action.setEffectiveWeight(1);
    this.playing = true;
  }
  pause() {
    if (this.action) this.action.paused = true;
    if (this.seq) this.seq.action && (this.seq.action.paused = true);
    this.playing = false;
  }
  stop() {
    this.stopSequence(false);
    this.mixer?.stopAllAction();
    this.playing = false;
    this.mixer?.update(0);
    this.events.onTime?.(0, this.action?.getClip().duration ?? 0, false);
  }
  setSpeed(s: number) {
    this.speed = s;
    if (this.mixer && !this.seq) this.mixer.timeScale = s;
  }
  setLoop(l: boolean) {
    this.loop = l;
    this.applyLoop();
  }
  seek(t: number) {
    if (!this.action) return;
    if (!this.action.isRunning()) {
      this.action.play();
      this.action.paused = true;
    }
    this.action.time = t;
    this.mixer.update(0);
  }

  // ---------------------------------------------------------------- sequences / combos
  playSequence(steps: SequenceStep[], loop = false) {
    if (!this.mixer || !steps.length) return;
    this.stopSequence(false);
    this.mixer.stopAllAction();
    this.mixer.timeScale = 1;
    this.seq = { steps, idx: -1, elapsed: 0, dur: 0, fired: false, action: null, loop };
    this.startStep(0);
    this.playing = true;
  }

  private startStep(i: number) {
    const s = this.seq!;
    const step = s.steps[i];
    const clip = this.clips[step.clip];
    if (!clip) {
      this.stopSequence(true);
      return;
    }
    const a = this.mixer.clipAction(clip);
    const t0 = Math.max(0, Math.min(1, step.trimStart)) * clip.duration;
    const t1 = Math.max(step.trimStart + 0.01, Math.min(1, step.trimEnd)) * clip.duration;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = Math.max(0.05, step.speed);
    a.time = t0;
    a.play();
    if (s.action && s.action !== a && step.fade > 0) s.action.crossFadeTo(a, step.fade, false);
    else if (s.action && s.action !== a) s.action.stop();
    s.action = a;
    s.idx = i;
    s.elapsed = 0;
    s.dur = (t1 - t0) / a.timeScale;
    s.fired = false;
    this.action = a;
    this.events.onSequenceStep?.(i);
  }

  private updateSequence(dt: number) {
    const s = this.seq;
    if (!s || (s.action && s.action.paused)) return;
    s.elapsed += dt;
    const step = s.steps[s.idx];
    if (!s.fired && step.eventAt >= 0 && s.elapsed >= step.eventAt * s.dur) {
      s.fired = true;
      if (step.eventVfx !== 'none' && this.lastVfx) this.castVfx(step.eventVfx, this.lastVfx);
    }
    const next = s.idx + 1 < s.steps.length ? s.idx + 1 : s.loop ? 0 : -1;
    const fade = next >= 0 ? Math.min(s.steps[next].fade, s.dur * 0.5) : 0;
    if (s.elapsed >= s.dur - fade) {
      if (next >= 0) this.startStep(next);
      else if (s.elapsed >= s.dur) this.stopSequence(true);
    }
  }

  stopSequence(emit = true) {
    if (!this.seq) return;
    this.seq = null;
    this.playing = false;
    this.mixer.timeScale = this.speed;
    if (emit) this.events.onSequenceEnd?.();
  }

  get sequencePlaying() {
    return !!this.seq;
  }

  // ---------------------------------------------------------------- bones, sockets, weapons
  private findBone(patterns: RegExp[]): any {
    for (const re of patterns) {
      const b = this.bones.find((x) => re.test(x.name));
      if (b) return b;
    }
    return null;
  }
  handBone(side: 'R' | 'L') {
    return this.findBone(HAND_RE[side]);
  }

  setWeapon(cfg: WeaponConfig | null) {
    if (this.weapon) {
      this.weapon.parent?.remove(this.weapon);
      disposeObject(this.weapon);
      this.weapon = null;
    }
    if (!cfg || !this.model) return false;
    const bone = this.handBone(cfg.hand);
    if (!bone) return false;
    const wrap = new THREE.Group();
    wrap.name = 'WeaponSocket';
    wrap.add(buildWeapon(THREE, cfg.type, cfg.element, this.height));
    const ws = new THREE.Vector3();
    bone.getWorldScale(ws);
    wrap.scale.setScalar((cfg.scale || 1) / (ws.x || 1));
    wrap.rotation.set(...(cfg.rot.map((d) => (d * Math.PI) / 180) as [number, number, number]));
    bone.add(wrap);
    this.weapon = wrap;
    return true;
  }

  // ---------------------------------------------------------------- VFX
  private forward(): any {
    const q = new THREE.Quaternion();
    this.model?.getWorldQuaternion(q);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  }
  private handPos(side: 'R' | 'L'): any {
    const b = this.handBone(side);
    const p = new THREE.Vector3();
    if (b) b.getWorldPosition(p);
    else p.set(this.frame.center[0], this.frame.center[1] + this.height * 0.1, this.frame.center[2]).addScaledVector(this.forward(), this.height * 0.15);
    return p;
  }

  castVfx(mode: VfxMode, p: VfxParams) {
    if (!this.vfx || !this.model) return;
    this.lastVfx = p;
    const fwd = () => this.forward();
    if (mode === 'projectile') this.vfx.projectile(this.handPos('R').addScaledVector(this.forward(), this.height * 0.05), this.forward(), p);
    else if (mode === 'beam') this.vfx.beam(() => this.handPos('R'), fwd, p);
    else if (mode === 'beam2') this.vfx.beam(() => this.handPos('R').add(this.handPos('L')).multiplyScalar(0.5), fwd, p, true);
    else this.vfx.lightning(() => this.handPos('R'), fwd, p);
  }
  setVfxParams(p: VfxParams) {
    this.lastVfx = p;
  }
  setAura(on: boolean, p: VfxParams, side: 'R' | 'L' = 'R') {
    this.vfx?.setAura(on ? this.handBone(side) ?? this.model : null, on ? p : null);
  }

  // ---------------------------------------------------------------- arena (2 characters)
  setArena(cfg: ArenaConfig | null) {
    if (this.arena) {
      this.scene.remove(this.arena.opp, this.arena.helper, ...this.arena.markers);
      this.arena.mixer.stopAllAction();
      for (const m of this.arena.mats) m.dispose();
      this.arena = null;
      if (this.vfx) this.vfx.hitTest = null;
    }
    if (!cfg || !this.model) return;
    const opp = SkeletonUtils.clone(this.model);
    const mats: any[] = [];
    opp.traverse((o: any) => {
      if (o.isMesh) {
        o.material = Array.isArray(o.material) ? o.material.map((m: any) => m.clone()) : o.material.clone();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.push(m);
      }
    });
    const dz = cfg.distance * this.height;
    opp.position.set(0, 0, dz);
    opp.rotation.y = Math.PI;
    this.scene.add(opp);
    const box = new THREE.Box3().setFromObject(this.model);
    box.translate(new THREE.Vector3(0, 0, dz));
    box.expandByScalar(-this.height * 0.05);
    const helper = new THREE.Box3Helper(box, 0xff5a5a);
    helper.visible = cfg.showBoxes;
    this.scene.add(helper);
    const markers = [0, 1, 2, 3].map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(this.height * 0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5aff8a, wireframe: true }));
      m.visible = cfg.showBoxes;
      this.scene.add(m);
      return m;
    });
    const mixer = new THREE.AnimationMixer(opp);
    const arena = { cfg, opp, mixer, box, helper, markers, hits: 0, cooldown: 0, flash: 0, mats, idleAction: null as any };
    this.arena = arena;
    this.playOpponentIdle();
    mixer.addEventListener('finished', () => this.playOpponentIdle());
    if (this.vfx) this.vfx.hitTest = (p: any) => arena.box.containsPoint(p) && this.registerHit();
    this.setView('front');
  }

  private playOpponentIdle() {
    const a = this.arena;
    if (!a) return;
    const clip = this.clips[a.cfg.opponentClip];
    a.mixer.stopAllAction();
    if (!clip) return;
    a.idleAction = a.mixer.clipAction(clip);
    a.idleAction.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }

  private registerHit(): boolean {
    const a = this.arena;
    if (!a || a.cooldown > 0) return false;
    a.hits++;
    a.cooldown = 0.6;
    a.flash = 0.3;
    this.events.onHit?.(a.hits);
    const r = this.clips[a.cfg.reactionClip];
    if (r) {
      a.mixer.stopAllAction();
      const act = a.mixer.clipAction(r);
      act.reset().setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
      act.play();
    }
    return true;
  }

  private updateArena(dt: number) {
    const a = this.arena;
    if (!a) return;
    a.mixer.update(dt);
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.flash = Math.max(0, a.flash - dt);
    for (const m of a.mats) if (m.emissive) m.emissive.setRGB(a.flash > 0 ? 0.8 : 0, 0, 0);
    const attackers = [this.handBone('R'), this.handBone('L'), ...this.bones.filter((b) => FOOT_RE[0].test(b.name)).slice(0, 2)];
    const p = new THREE.Vector3();
    attackers.forEach((b, i) => {
      const mk = a.markers[i];
      if (!b || !mk) return;
      b.getWorldPosition(p);
      mk.position.copy(p);
      mk.visible = a.cfg.showBoxes;
      // only count strikes while an attack/sequence is actually playing
      if (this.playing && a.box.distanceToPoint(p) < this.height * 0.03) this.registerHit();
    });
    a.helper.visible = a.cfg.showBoxes;
  }

  get arenaConfig(): ArenaConfig | null {
    return this.arena ? { ...this.arena.cfg } : null;
  }
  get arenaHits(): number {
    return this.arena?.hits ?? 0;
  }

  setArenaOptions(cfg: ArenaConfig) {
    if (!this.arena) return this.setArena(cfg);
    const prevDist = this.arena.cfg.distance;
    if (prevDist !== cfg.distance) return this.setArena(cfg);
    const idleChanged = this.arena.cfg.opponentClip !== cfg.opponentClip;
    this.arena.cfg = cfg;
    if (idleChanged) this.playOpponentIdle();
  }

  // ---------------------------------------------------------------- export
  /** Export the current character as a NEW GLB, including imported clips (original file untouched). */
  async exportGlb(includeWeapon: boolean): Promise<ArrayBuffer> {
    if (!this.model) throw new Error('No model');
    this.stop();
    this.mixer.stopAllAction();
    this.mixer.update(0);
    const detached = !includeWeapon && this.weapon ? this.weapon.parent : null;
    if (detached) detached.remove(this.weapon);
    try {
      const exporter = new GLTFExporterCls();
      return await new Promise((res, rej) => exporter.parse(this.model, (r: any) => res(r as ArrayBuffer), rej, { binary: true, animations: this.clips, onlyVisible: true }));
    } finally {
      if (detached) detached.add(this.weapon);
    }
  }

  // ---------------------------------------------------------------- cleanup
  private clearModel() {
    this.setArena(null);
    this.stopSequence(false);
    this.vfx?.clear();
    this.setWeapon(null);
    this.highlightBone(null);
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model);
    }
    this.mixer = null;
    this.action = null;
    this.clips = [];
    this.clipSources = [];
    this.bones = [];
    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper);
      this.skeletonHelper.dispose?.();
      this.skeletonHelper = null;
    }
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((o: any) => {
        o.geometry?.dispose?.();
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].dispose();
          m.dispose?.();
        }
      });
      this.model = null;
    }
    for (const u of this.blobUrls) URL.revokeObjectURL(u);
    this.blobUrls = [];
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.clearModel();
    this.vfx?.dispose();
    this.resizeObs?.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
