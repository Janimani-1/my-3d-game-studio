/** Procedural, original weapon models (CC0) built from Three.js primitives.
 *  Origin = grip centre; blade/head extends along +Y. Sizes are in units of character height. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type WeaponType = 'sword' | 'greatsword' | 'axe' | 'dagger' | 'spear' | 'hammer' | 'shuriken';
export type WeaponElement = 'none' | 'fire' | 'ice' | 'electric';
export const WEAPON_TYPES: WeaponType[] = ['sword', 'greatsword', 'axe', 'dagger', 'spear', 'hammer', 'shuriken'];
export const WEAPON_ELEMENTS: WeaponElement[] = ['none', 'fire', 'ice', 'electric'];

const ELEMENT_EMISSIVE: Record<WeaponElement, number> = { none: 0x000000, fire: 0xff4a10, ice: 0x40c8ff, electric: 0x8a7bff };

export function buildWeapon(T: any, type: WeaponType, element: WeaponElement, H: number): any {
  const g = new T.Group();
  g.name = `Weapon_${type}`;
  const metal = new T.MeshStandardMaterial({
    color: element === 'ice' ? 0xcdefff : 0xc9ced6,
    metalness: 0.9,
    roughness: 0.25,
    emissive: ELEMENT_EMISSIVE[element],
    emissiveIntensity: element === 'none' ? 0 : 0.9,
  });
  const leather = new T.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.9 });
  const gold = new T.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.8, roughness: 0.35 });
  const add = (geo: any, mat: any, y = 0, x = 0, z = 0) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const grip = (len: number) => add(new T.CylinderGeometry(H * 0.012, H * 0.012, len, 10), leather);

  switch (type) {
    case 'sword':
    case 'greatsword':
    case 'dagger': {
      const k = type === 'greatsword' ? 1.5 : type === 'dagger' ? 0.45 : 1;
      const bl = H * 0.36 * k;
      const bw = H * 0.032 * Math.sqrt(k);
      grip(H * 0.09 * Math.max(0.7, k * 0.9));
      add(new T.BoxGeometry(H * 0.12 * Math.sqrt(k), H * 0.014, H * 0.024), gold, H * 0.05);
      add(new T.BoxGeometry(bw, bl, H * 0.007), metal, H * 0.057 + bl / 2);
      const tip = add(new T.ConeGeometry(bw / Math.SQRT2, bw * 1.4, 4), metal, H * 0.057 + bl + bw * 0.7);
      tip.rotation.y = Math.PI / 4;
      tip.scale.z = 0.22;
      add(new T.SphereGeometry(H * 0.017, 10, 8), gold, -H * 0.05 * Math.max(0.7, k * 0.9));
      break;
    }
    case 'axe': {
      const hl = H * 0.42;
      add(new T.CylinderGeometry(H * 0.012, H * 0.014, hl, 10), leather, hl * 0.3);
      const shape = new T.Shape();
      shape.moveTo(0, -H * 0.03);
      shape.quadraticCurveTo(H * 0.08, -H * 0.09, H * 0.13, -H * 0.08);
      shape.quadraticCurveTo(H * 0.1, 0, H * 0.13, H * 0.08);
      shape.quadraticCurveTo(H * 0.08, H * 0.09, 0, H * 0.03);
      shape.lineTo(0, -H * 0.03);
      const head = add(new T.ExtrudeGeometry(shape, { depth: H * 0.012, bevelEnabled: true, bevelSize: H * 0.004, bevelThickness: H * 0.004, bevelSegments: 1 }), metal, hl * 0.72);
      head.position.z = -H * 0.006;
      break;
    }
    case 'spear': {
      const sl = H * 0.95;
      add(new T.CylinderGeometry(H * 0.011, H * 0.011, sl, 10), leather, sl * 0.25);
      add(new T.ConeGeometry(H * 0.03, H * 0.13, 4), metal, sl * 0.75 + H * 0.06);
      break;
    }
    case 'hammer': {
      const hl = H * 0.4;
      add(new T.CylinderGeometry(H * 0.013, H * 0.013, hl, 10), leather, hl * 0.3);
      add(new T.BoxGeometry(H * 0.16, H * 0.09, H * 0.09), metal, hl * 0.78);
      break;
    }
    case 'shuriken': {
      const s = new T.Shape();
      const R = H * 0.05;
      const r = H * 0.014;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 ? r : R;
        if (i === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      s.closePath();
      const m = add(new T.ExtrudeGeometry(s, { depth: H * 0.004, bevelEnabled: false }), metal, H * 0.03);
      m.rotation.x = Math.PI / 2;
      break;
    }
  }
  return g;
}

export function disposeObject(o: any) {
  o.traverse((c: any) => {
    c.geometry?.dispose?.();
    const mats = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
    for (const m of mats) m.dispose?.();
  });
}
