import { useState } from 'react';
import type { AppApi } from './App';
import { useI18n, useUi, ComingLater } from './common';
import { SaveBar } from './CharacterPanel';
import { WEAPON_ELEMENTS, WEAPON_TYPES } from '../viewer/weapons';
import { ELEMENT_PRESETS, type Element } from '../viewer/vfx';
import type { VfxSettings, WeaponSettings } from '../core/project';

const MODES: VfxSettings['mode'][] = ['projectile', 'beam', 'beam2', 'lightning'];
const ELEMENTS: Element[] = ['fire', 'ice', 'energy', 'lightning'];

const TRAIL_COLORS: Record<WeaponSettings['element'], string> = { none: '#dfe8ff', fire: '#ff7a1a', ice: '#7fdcff', electric: '#a98bff' };

export function WeaponsPanel({ api }: { api: AppApi }) {
  const { t, n } = useI18n();
  const ui = useUi();
  const [trail, setTrail] = useState(false);
  const c = api.current;
  if (!c || !c.project.files.some((f) => f.role === 'main')) return <div className="card muted">{t('viewer.noModel')}</div>;
  const v = api.viewer;
  const w = c.project.weapon;
  const fx = c.project.vfx;

  function setW(patch: Partial<WeaponSettings>) {
    const next = { ...w, ...patch };
    api.updateProject({ weapon: next });
    if (!v) return;
    if (next.enabled) {
      if (!v.setWeapon(next)) ui.toast(t('weap.noHand'), 'warn');
    } else v.setWeapon(null);
  }
  function setFx(patch: Partial<VfxSettings>) {
    const next = { ...fx, ...patch };
    if (patch.element) next.color = ELEMENT_PRESETS[patch.element].color;
    api.updateProject({ vfx: next });
    v?.setVfxParams(next);
    v?.setAura(next.aura, next);
  }

  const slider = (label: string, key: 'size' | 'speed' | 'duration' | 'intensity', min: number, max: number, step: number, unit = '') => (
    <label className="field">
      <span>{label}: {n(fx[key], 2)}{unit}</span>
      <input type="range" min={min} max={max} step={step} value={fx[key]} onChange={(e) => setFx({ [key]: +e.target.value } as Partial<VfxSettings>)} data-testid={`vfx-${key}`} />
    </label>
  );

  return (
    <div className="stack">
      <SaveBar api={api} />
      <section className="card" data-testid="vfx-panel">
        <h3>{t('weap.vfx')}</h3>
        <div className="field">
          <span>{t('weap.mode')}</span>
          <div className="row wrap">
            {MODES.map((m) => (
              <button key={m} className={`btn chip ${fx.mode === m ? 'active' : ''}`} onClick={() => setFx({ mode: m })} data-testid={`vfx-mode-${m}`}>{t(`weap.modes.${m}` as any)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('weap.vfxElement')}</span>
          <div className="row wrap">
            {ELEMENTS.map((el) => (
              <button key={el} className={`btn chip ${fx.element === el ? 'active' : ''}`} onClick={() => setFx({ element: el })} data-testid={`vfx-el-${el}`}>{t(`weap.ve.${el}` as any)}</button>
            ))}
          </div>
        </div>
        <label className="field color-field">
          <span>{t('weap.color')}</span>
          <input type="color" value={fx.color} onChange={(e) => setFx({ color: e.target.value })} />
        </label>
        {slider(t('weap.size'), 'size', 0.3, 3, 0.1)}
        {slider(t('weap.speed'), 'speed', 0.3, 3, 0.1)}
        {slider(t('weap.duration'), 'duration', 0.3, 4, 0.1, 's')}
        {slider(t('weap.intensity'), 'intensity', 0.3, 3, 0.1)}
        <button className="btn btn-primary btn-big" disabled={!v} onClick={() => v?.castVfx(fx.mode, fx)} data-testid="cast-vfx">✨ {t('weap.cast')}</button>
        <label className="toggle">
          <input type="checkbox" checked={fx.aura} disabled={!v} onChange={(e) => setFx({ aura: e.target.checked })} data-testid="vfx-aura" />
          <span>{t('weap.aura')}</span>
        </label>
        <p className="muted tiny">{t('weap.vfxNote')}</p>
      </section>

      <section className="card" data-testid="weapon-panel">
        <h3>{t('weap.weapon')}</h3>
        <label className="toggle">
          <input type="checkbox" checked={w.enabled} disabled={!v} onChange={(e) => setW({ enabled: e.target.checked })} data-testid="weapon-toggle" />
          <span>{t('weap.enable')}</span>
        </label>
        <div className="field">
          <span>{t('weap.type')}</span>
          <div className="row wrap">
            {WEAPON_TYPES.map((x) => (
              <button key={x} className={`btn chip ${w.type === x ? 'active' : ''}`} onClick={() => setW({ type: x })} data-testid={`weapon-${x}`}>{t(`weap.types.${x}` as any)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('weap.element')}</span>
          <div className="row wrap">
            {WEAPON_ELEMENTS.map((x) => (
              <button key={x} className={`btn chip ${w.element === x ? 'active' : ''}`} onClick={() => setW({ element: x })}>{t(`weap.el.${x}` as any)}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('weap.hand')}</span>
          <div className="row">
            <button className={`btn chip ${w.hand === 'R' ? 'active' : ''}`} onClick={() => setW({ hand: 'R' })}>{t('weap.right')}</button>
            <button className={`btn chip ${w.hand === 'L' ? 'active' : ''}`} onClick={() => setW({ hand: 'L' })}>{t('weap.left')}</button>
          </div>
        </div>
        <div className="field">
          <span>{t('weap.rotation')}: {w.rot.map((d) => n(d)).join(' / ')}°</span>
          {[0, 1, 2].map((k) => (
            <input key={k} type="range" min={-180} max={180} step={5} value={w.rot[k]} onChange={(e) => { const rot = [...w.rot] as [number, number, number]; rot[k] = +e.target.value; setW({ rot }); }} aria-label={`rot-${'xyz'[k]}`} />
          ))}
        </div>
        <div className="row wrap">
          <button className="btn btn-primary" disabled={!v || !w.enabled} onClick={() => { if (!v?.throwChain()) ui.toast(t('weap.chainNeedsWeapon'), 'warn'); }} data-testid="throw-chain">⛓ {t('weap.chain')}</button>
          <label className="toggle">
            <input type="checkbox" checked={trail} disabled={!v || !w.enabled} onChange={(e) => { setTrail(e.target.checked); v?.setTrail(e.target.checked, TRAIL_COLORS[w.element]); }} data-testid="trail-toggle" />
            <span>{t('weap.trail')}</span>
          </label>
        </div>
        <p className="muted tiny">{t('weap.chainNote')}</p>
        <label className="field">
          <span>{t('weap.scale')}: ×{n(w.scale, 2)}</span>
          <input type="range" min={0.3} max={2.5} step={0.05} value={w.scale} onChange={(e) => setW({ scale: +e.target.value })} />
        </label>
      </section>
      <ComingLater items={[t('weap.laterV2')]} />
    </div>
  );
}
