import { Fragment, useState } from 'react';
import type { AppApi } from './App';
import { useI18n, useUi, downloadBlob } from './common';
import type { ViewPreset } from '../viewer/engine';
import { SLOTS, missingSlots } from '../core/rig';

export function SaveBar({ api }: { api: AppApi }) {
  const { t } = useI18n();
  if (!api.current) return null;
  return (
    <div className="row savebar">
      <button className="btn btn-primary" onClick={() => api.saveCurrent()} disabled={!api.current.dirty} data-testid="save-btn">
        {t('save')}
      </button>
      <span className="muted small">{api.current.dirty ? t('unsaved') : t('saved')}</span>
    </div>
  );
}

export function CharacterPanel({ api }: { api: AppApi }) {
  const { t, n } = useI18n();
  const ui = useUi();
  const [bone, setBone] = useState<string | null>(null);
  const c = api.current;
  if (!c || !c.project.files.some((f) => f.role === 'main')) return <div className="card muted">{t('viewer.noModel')}</div>;
  const s = c.project.viewer;
  const v = api.viewer;
  const st = c.project.stats;
  const presets: ViewPreset[] = ['front', 'back', 'left', 'right', 'top'];
  const missing = missingSlots(api.humanoid);

  async function shot() {
    const b = await v?.screenshot();
    if (b) await downloadBlob(b, `${c!.project.name}-screenshot.png`);
  }

  return (
    <div className="stack">
      <SaveBar api={api} />
      <section className="card">
        <div className="row wrap">
          <button className="btn" onClick={() => v?.resetCamera()} disabled={!v} data-testid="reset-camera">{t('viewer.reset')}</button>
          {presets.map((p) => (
            <button key={p} className="btn" onClick={() => v?.setView(p)} disabled={!v} data-testid={`view-${p}`}>
              {t(`viewer.${p}` as any)}
            </button>
          ))}
          <button className="btn" onClick={shot} disabled={!v} data-testid="screenshot">📷 {t('char.screenshot')}</button>
        </div>
      </section>

      <section className="card controls">
        <label className="toggle">
          <input type="checkbox" checked={s.grid} onChange={(e) => { v?.setGrid(e.target.checked); api.updateViewer({ grid: e.target.checked }); }} />
          <span>{t('viewer.grid')}</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.showSkeleton} onChange={(e) => { v?.setSkeleton(e.target.checked); api.updateViewer({ showSkeleton: e.target.checked }); }} data-testid="skeleton-toggle" />
          <span>{t('viewer.skeleton')}</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={s.fullRes} onChange={(e) => { v?.setFullResolution(e.target.checked); api.updateViewer({ fullRes: e.target.checked }); }} />
          <span>{t('viewer.fullRes')}</span>
        </label>
        <label className="field">
          <span>{t('viewer.light')}: {n(s.lightIntensity, 1)}</span>
          <input type="range" min={0} max={4} step={0.1} value={s.lightIntensity} onChange={(e) => { const x = +e.target.value; v?.setLight(x, s.ambientIntensity); api.updateViewer({ lightIntensity: x }); }} />
        </label>
        <label className="field">
          <span>{t('viewer.ambient')}: {n(s.ambientIntensity, 1)}</span>
          <input type="range" min={0} max={3} step={0.1} value={s.ambientIntensity} onChange={(e) => { const x = +e.target.value; v?.setLight(s.lightIntensity, x); api.updateViewer({ ambientIntensity: x }); }} />
        </label>
        <div className="field">
          <span>{t('viewer.background')}</span>
          <div className="row">
            <input type="color" value={s.background} onChange={(e) => { v?.setBackground(e.target.value); api.updateViewer({ background: e.target.value }); }} />
            {['#1b1e27', '#000000', '#3a3f4b', '#8a94a6', '#e8ecf2'].map((col) => (
              <button key={col} className="swatch" style={{ background: col }} aria-label={col} onClick={() => { v?.setBackground(col); api.updateViewer({ background: col }); }} />
            ))}
          </div>
        </div>
      </section>

      <section className="card" data-testid="humanoid">
        <h3>{t('char.humanoid')}</h3>
        {api.bones.length === 0 ? (
          <p className="muted small">{t('char.noBones')}</p>
        ) : missing.length === 0 ? (
          <p className="ok-text small">{t('char.allFound')}</p>
        ) : (
          <p className="small">{t('char.missing', { list: missing.join(', ') })}</p>
        )}
        {api.bones.length > 0 && (
          <dl className="stats-grid small">
            {SLOTS.filter((sl) => api.humanoid[sl]).map((sl) => (
              <Fragment key={sl}><dt>{sl}</dt><dd className="mono">{api.humanoid[sl]}</dd></Fragment>
            ))}
          </dl>
        )}
      </section>

      {api.bones.length > 0 && (
        <section className="card">
          <h3>{t('char.bones')}</h3>
          <p className="muted small">{t('char.boneCount', { n: n(api.bones.length) })}</p>
          <ul className="bone-list" data-testid="bone-list">
            {api.bones.map((b) => (
              <li key={b.name}>
                <button className={`bone ${bone === b.name ? 'active' : ''}`} style={{ paddingInlineStart: `${0.5 + b.depth * 0.6}rem` }} onClick={() => { const nb = bone === b.name ? null : b.name; setBone(nb); v?.highlightBone(nb); }}>
                  <span className="mono">{b.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {st && (
        <section className="card" data-testid="stats">
          <h3>{t('viewer.stats')}</h3>
          <dl className="stats-grid">
            <dt>{t('stats.container')}</dt><dd className="mono">{st.container.toUpperCase()} {st.version}</dd>
            <dt>{t('stats.meshes')}</dt><dd data-testid="stat-meshes">{n(st.meshes)}</dd>
            <dt>{t('stats.triangles')}</dt><dd data-testid="stat-triangles">{n(st.triangles)}</dd>
            <dt>{t('stats.vertices')}</dt><dd>{n(st.vertices)}</dd>
            <dt>{t('stats.materials')}</dt><dd>{n(st.materials)}</dd>
            <dt>{t('stats.textures')}</dt><dd>{n(st.textures)}</dd>
            <dt>{t('stats.skins')}</dt><dd>{n(st.skins)}</dd>
            <dt>{t('stats.joints')}</dt><dd data-testid="stat-joints">{n(st.joints)}</dd>
            <dt>{t('stats.animations')}</dt><dd data-testid="stat-animations">{n(st.animations.length)}</dd>
            {st.generator && (<><dt>{t('stats.generator')}</dt><dd className="small">{st.generator}</dd></>)}
          </dl>
          {st.materialNames.length > 0 && <p className="small"><strong>{t('viewer.materials')}:</strong> <span className="mono">{st.materialNames.join(', ')}</span></p>}
        </section>
      )}

      <section className="card">
        <h3>{t('diag.title')}</h3>
        <div className="row wrap">
          <button className="btn" onClick={api.reloadViewer}>{t('viewer.reload')}</button>
          <button className="btn" disabled={!v} onClick={() => { if (!v?.simulateContextLoss()) ui.toast('WEBGL_lose_context unavailable', 'warn'); }} data-testid="lose-context">
            {t('diag.loseContext')}
          </button>
        </div>
      </section>
    </div>
  );
}
