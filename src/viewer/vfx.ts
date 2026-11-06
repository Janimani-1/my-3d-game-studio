/**
 * Real-time elemental VFX built from Three.js primitives:
 *  - GPU particle pool (custom shader: per-particle size/colour/alpha, additive blending)
 *  - projectile (glowing core + light + particle trail) with impact burst & shockwave ring
 *  - beam from one or two hands, lightning arcs, hand aura
 * All parameters are editable. These effects are runtime-only (not exportable inside GLB).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Element = 'fire' | 'ice' | 'energy' | 'lightning';
export type VfxMode = 'projectile' | 'beam' | 'beam2' | 'lightning';

export interface VfxParams {
  element: Element;
  color: string; // core colour (hex)
  size: number; // multiplier 0.2..3
  speed: number; // multiplier 0.2..3
  duration: number; // seconds (beam/lightning length, projectile max flight)
  intensity: number; // 0.2..3 (brightness & emission rate)
}

export const ELEMENT_PRESETS: Record<Element, { color: string; edge: string; drift: number; spread: number }> = {
  fire: { color: '#ff7a1a', edge: '#ff2a00', drift: 1.2, spread: 0.35 },
  ice: { color: '#9fe8ff', edge: '#3aa8ff', drift: -0.2, spread: 0.2 },
  energy: { color: '#b07bff', edge: '#4b6bff', drift: 0, spread: 0.25 },
  lightning: { color: '#e8f4ff', edge: '#6ab8ff', drift: 0, spread: 0.5 },
};

export const DEFAULT_VFX: VfxParams = { element: 'fire', color: ELEMENT_PRESETS.fire.color, size: 1, speed: 1, duration: 1.2, intensity: 1 };

const MAX_PARTICLES = 3000;

export class VfxSystem {
  private T: any;
  private scene: any;
  private unit = 1; // world size reference (character height)
  private points: any;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grow: Float32Array;
  private next = 0;
  private effects: { update: (dt: number) => boolean; dispose: () => void }[] = [];
  private auraTarget: any = null;
  private auraParams: VfxParams | null = null;
  private auraAcc = 0;
  /** Called when a projectile reaches its end point or hits the target. */
  onImpact: ((p: any) => void) | null = null;
  /** Optional target test: returns true if a world point is inside the target hurtbox. */
  hitTest: ((p: any) => boolean) | null = null;
  activeCount = 0;

  constructor(THREE: any, scene: any) {
    this.T = THREE;
    this.scene = scene;
    const n = MAX_PARTICLES;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    this.grow = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `
        attribute float psize; attribute float palpha; attribute vec3 color;
        varying vec3 vColor; varying float vAlpha; uniform float uScale;
        void main() {
          vColor = color; vAlpha = palpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * uScale / max(0.001, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5; float r = length(d);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.0, r);
          gl_FragColor = vec4(vColor * (0.6 + a), a * a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  setUnit(u: number) {
    this.unit = Math.max(0.01, u);
  }
  setViewportHeight(px: number) {
    this.points.material.uniforms.uScale.value = px * 0.9;
  }

  private emit(p: any, v: [number, number, number], color: any, size: number, life: number, grow = 0) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_PARTICLES;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set(v, i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size;
    this.alpha[i] = 1;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grow[i] = grow;
  }

  private colors(p: VfxParams) {
    const T = this.T;
    const pre = ELEMENT_PRESETS[p.element];
    return { core: new T.Color(p.color), edge: new T.Color(pre.edge), pre };
  }

  private rand(s: number) {
    return (Math.random() - 0.5) * 2 * s;
  }

  burst(at: any, p: VfxParams, scale = 1) {
    const T = this.T;
    const { core, edge } = this.colors(p);
    const u = this.unit;
    const n = Math.round(120 * p.intensity * scale);
    for (let k = 0; k < n; k++) {
      const dir = new T.Vector3(this.rand(1), this.rand(1), this.rand(1)).normalize().multiplyScalar(u * (0.3 + Math.random() * 0.9) * p.speed * scale);
      this.emit(at, [dir.x, dir.y, dir.z], k % 3 ? core : edge, u * 0.05 * p.size * scale * (0.5 + Math.random()), 0.4 + Math.random() * 0.5);
    }
    // ice: real shard meshes that fly out, fall and fade
    if (p.element === 'ice') {
      const shardGeo = new T.TetrahedronGeometry(u * 0.025 * p.size * scale, 0);
      const shardMat = new T.MeshStandardMaterial({ color: 0xcff4ff, emissive: 0x4ab8ff, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.95 });
      const shards = Array.from({ length: 14 }, () => {
        const m = new T.Mesh(shardGeo, shardMat);
        m.position.copy(at);
        m.userData.v = new T.Vector3(this.rand(1), Math.random() * 1.2, this.rand(1)).normalize().multiplyScalar(u * (0.6 + Math.random()) * p.speed);
        m.userData.r = new T.Vector3(this.rand(8), this.rand(8), this.rand(8));
        this.scene.add(m);
        return m;
      });
      let st = 0;
      this.effects.push({
        update: (dt) => {
          st += dt;
          for (const m of shards) {
            m.userData.v.y -= u * 2.5 * dt;
            m.position.addScaledVector(m.userData.v, dt);
            m.rotation.x += m.userData.r.x * dt;
            m.rotation.y += m.userData.r.y * dt;
          }
          shardMat.opacity = Math.max(0, 0.95 * (1 - st / 0.9));
          return st < 0.9;
        },
        dispose: () => {
          for (const m of shards) this.scene.remove(m);
          shardGeo.dispose();
          shardMat.dispose();
        },
      });
    }
    // fire: rising embers
    if (p.element === 'fire') {
      for (let k = 0; k < 40 * p.intensity; k++) this.emit(at, [this.rand(u * 0.15), u * (0.3 + Math.random() * 0.6), this.rand(u * 0.15)], new T.Color('#ffb347'), u * 0.015 * p.size, 0.8 + Math.random() * 0.6);
    }
    // flash light
    const light = new T.PointLight(core, 4 * p.intensity, u * 3);
    light.position.copy(at);
    this.scene.add(light);
    // shockwave ring
    const ring = new T.Mesh(
      new T.RingGeometry(0.9, 1, 48),
      new T.MeshBasicMaterial({ color: edge, transparent: true, opacity: 0.9, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false }),
    );
    ring.position.copy(at);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);
    let t = 0;
    this.effects.push({
      update: (dt) => {
        t += dt;
        const k = t / 0.5;
        light.intensity = Math.max(0, 4 * p.intensity * (1 - k));
        const r = u * 0.05 + u * 0.6 * p.size * scale * k;
        ring.scale.setScalar(r);
        ring.material.opacity = Math.max(0, 0.9 * (1 - k));
        return k < 1;
      },
      dispose: () => {
        this.scene.remove(light, ring);
        ring.geometry.dispose();
        ring.material.dispose();
      },
    });
  }

  projectile(from: any, dir: any, p: VfxParams) {
    const T = this.T;
    const { core, edge, pre } = this.colors(p);
    const u = this.unit;
    const radius = u * 0.06 * p.size;
    const mesh = new T.Mesh(
      p.element === 'ice' ? new T.OctahedronGeometry(radius, 0) : new T.SphereGeometry(radius, 16, 12),
      new T.MeshBasicMaterial({ color: core, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false }),
    );
    const glow = new T.PointLight(core, 2.5 * p.intensity, u * 2);
    mesh.add(glow);
    mesh.position.copy(from);
    this.scene.add(mesh);
    const v = dir.clone().normalize().multiplyScalar(u * 1.1 * p.speed);
    let t = 0;
    let acc = 0;
    let done = false;
    this.effects.push({
      update: (dt) => {
        if (done) return false;
        t += dt;
        mesh.position.addScaledVector(v, dt);
        mesh.rotation.x += dt * 6;
        mesh.rotation.y += dt * 4;
        acc += dt * 160 * p.intensity;
        while (acc > 1) {
          acc -= 1;
          const jitter = pre.spread * u * 0.15;
          this.emit(
            mesh.position,
            [this.rand(jitter) - v.x * 0.15, this.rand(jitter) + pre.drift * u * 0.25, this.rand(jitter) - v.z * 0.15],
            Math.random() < 0.6 ? core : edge,
            radius * (0.8 + Math.random() * 1.2),
            0.25 + Math.random() * 0.35,
            -0.6,
          );
        }
        const hit = this.hitTest?.(mesh.position) ?? false;
        if (hit || t > p.duration * 1.5) {
          done = true;
          this.burst(mesh.position.clone(), p, hit ? 1.2 : 0.8);
          this.onImpact?.(mesh.position.clone());
          return false;
        }
        return true;
      },
      dispose: () => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      },
    });
  }

  /** Beam from a start point (updated each frame through getStart) along direction. */
  beam(getStart: () => any, getDir: () => any, p: VfxParams, wide = false) {
    const T = this.T;
    const { core, edge } = this.colors(p);
    const u = this.unit;
    const len = u * 1.8 * p.speed;
    const r = u * (wide ? 0.07 : 0.035) * p.size;
    const geo = new T.CylinderGeometry(r, r * 0.6, 1, 16, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2); // along +Z
    const inner = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
    const outer = new T.Mesh(geo, new T.MeshBasicMaterial({ color: core, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    outer.scale.set(2.2, 2.2, 1);
    const g = new T.Group();
    g.add(inner, outer);
    this.scene.add(g);
    let t = 0;
    const target = new T.Vector3();
    this.effects.push({
      update: (dt) => {
        t += dt;
        const s = getStart();
        const d = getDir().clone().normalize();
        g.position.copy(s);
        target.copy(s).addScaledVector(d, len);
        g.lookAt(target);
        const k = Math.min(1, t / 0.15);
        const fade = t > p.duration ? Math.max(0, 1 - (t - p.duration) / 0.25) : 1;
        g.scale.set(fade * (0.85 + Math.random() * 0.3), fade * (0.85 + Math.random() * 0.3), len * k);
        inner.material.opacity = 0.9 * fade;
        outer.material.opacity = 0.5 * fade;
        for (let i = 0; i < 6 * p.intensity; i++) {
          const q = s.clone().addScaledVector(d, Math.random() * len * k);
          this.emit(q, [this.rand(u * 0.2), this.rand(u * 0.2), this.rand(u * 0.2)], Math.random() < 0.5 ? core : edge, r * 1.5, 0.3);
        }
        if (fade === 0) return false;
        if (t > p.duration - 0.05 && t - dt <= p.duration - 0.05) this.burst(target.clone(), p, 0.7);
        return true;
      },
      dispose: () => {
        this.scene.remove(g);
        geo.dispose();
        inner.material.dispose();
        outer.material.dispose();
      },
    });
  }

  lightning(getStart: () => any, getDir: () => any, p: VfxParams) {
    const T = this.T;
    const { core } = this.colors(p);
    const u = this.unit;
    const SEG = 14;
    const geo = new T.BufferGeometry();
    const arr = new Float32Array((SEG + 1) * 3 * 3);
    geo.setAttribute('position', new T.BufferAttribute(arr, 3));
    const mat = new T.LineBasicMaterial({ color: core, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    const line = new T.LineSegments(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    let t = 0;
    let rebuild = 0;
    this.effects.push({
      update: (dt) => {
        t += dt;
        rebuild -= dt;
        if (rebuild <= 0) {
          rebuild = 0.05;
          const s = getStart();
          const d = getDir().clone().normalize();
          const len = u * 1.6 * p.speed;
          let k = 0;
          for (let b = 0; b < 3; b++) {
            let prev = s.clone();
            for (let i = 1; i <= SEG / 1; i++) {
              if (k + 6 > arr.length) break;
              const q = s.clone().addScaledVector(d, (len * i) / SEG);
              const amp = u * 0.12 * p.size * Math.sin((Math.PI * i) / SEG);
              q.x += this.rand(amp);
              q.y += this.rand(amp);
              q.z += this.rand(amp);
              arr.set([prev.x, prev.y, prev.z, q.x, q.y, q.z], k);
              k += 6;
              // glow particles along the bolt (WebGL lines are always 1px wide)
              if (b === 0) this.emit(q, [0, 0, 0], core, u * 0.035 * p.size, 0.08);
              prev = q;
            }
          }
          geo.attributes.position.needsUpdate = true;
          geo.setDrawRange(0, k / 3);
          const end = s.clone().addScaledVector(d, len);
          this.emit(end, [this.rand(u * 0.4), this.rand(u * 0.4), this.rand(u * 0.4)], core, u * 0.05 * p.size, 0.25);
        }
        mat.opacity = t > p.duration ? 0 : 0.6 + Math.random() * 0.4;
        return t <= p.duration;
      },
      dispose: () => {
        this.scene.remove(line);
        geo.dispose();
        mat.dispose();
      },
    });
  }

  setAura(target: any | null, p: VfxParams | null) {
    this.auraTarget = target;
    this.auraParams = p;
  }

  update(dt: number) {
    // aura
    if (this.auraTarget && this.auraParams) {
      const p = this.auraParams;
      const { core, edge, pre } = this.colors(p);
      const wp = new this.T.Vector3();
      this.auraTarget.getWorldPosition(wp);
      this.auraAcc += dt * 90 * p.intensity;
      const u = this.unit;
      while (this.auraAcc > 1) {
        this.auraAcc -= 1;
        const q = wp.clone().add(new this.T.Vector3(this.rand(u * 0.04), this.rand(u * 0.04), this.rand(u * 0.04)));
        this.emit(q, [this.rand(u * 0.05), u * 0.2 * (pre.drift + 0.3), this.rand(u * 0.05)], Math.random() < 0.6 ? core : edge, u * 0.035 * p.size, 0.4 + Math.random() * 0.3, -0.5);
      }
    }
    // effects
    this.effects = this.effects.filter((e) => {
      const keep = e.update(dt);
      if (!keep) e.dispose();
      return keep;
    });
    // particles
    let active = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      active++;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 0.97;
      this.vel[i * 3 + 1] *= 0.97;
      this.vel[i * 3 + 2] *= 0.97;
      this.size[i] = Math.max(0, this.size[i] * (1 + this.grow[i] * dt));
      this.alpha[i] = k;
    }
    this.activeCount = active + this.effects.length;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.psize.needsUpdate = true;
    g.attributes.palpha.needsUpdate = true;
  }

  clear() {
    for (const e of this.effects) e.dispose();
    this.effects = [];
    this.life.fill(0);
    this.auraTarget = null;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
