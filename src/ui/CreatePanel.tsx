import { useEffect, useRef, useState } from 'react';
import type { AppApi } from './App';
import { useI18n, useUi, ComingLater } from './common';
import * as db from '../core/db';
import { checkSize, classify, formatBytes } from '../core/files';
import { checkHealth, generate, loadBackendConfig, normaliseUrl, saveBackendConfig, type BackendConfig, type Health } from '../core/backend';
import { buildProjectFromFiles, emptyProject, fileMeta } from './importLogic';

/** Workflow: 1 photos → 2 generate mesh (GPU backend) → 3 rig (planned) → 4 animate → 5 export. */
export function CreatePanel({ api }: { api: AppApi }) {
  const { t, n } = useI18n();
  const ui = useUi();
  const c = api.current;
  const fileRef = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState<BackendConfig>(loadBackendConfig);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [job, setJob] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeBg, setRemoveBg] = useState(true);
  const [res, setRes] = useState(256);
  const [thumbs, setThumbs] = useState<Record<string, { url: string; w: number; h: number }>>({});

  const refs = c?.project.files.filter((f) => f.role === 'reference') ?? [];

  useEffect(() => {
    const out: Record<string, { url: string; w: number; h: number }> = {};
    let alive = true;
    (async () => {
      for (const f of refs) {
        const b = c?.blobs.get(f.id);
        if (!b) continue;
        const url = URL.createObjectURL(b);
        const dim = await new Promise<{ w: number; h: number }>((r) => {
          const im = new Image();
          im.onload = () => r({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => r({ w: 0, h: 0 });
          im.src = url;
        });
        out[f.id] = { url, ...dim };
      }
      if (alive) setThumbs(out);
    })();
    return () => {
      alive = false;
      Object.values(out).forEach((x) => URL.revokeObjectURL(x.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.project.id, refs.length]);

  async function addImages(list: File[]) {
    const ok = list.filter((f) => classify(f.name) === 'image' && /\.(png|jpe?g|webp)$/i.test(f.name) && checkSize(f.size).ok);
    if (!ok.length) return ui.toast(t('import.invalid', { msg: 'JPG / PNG / WebP' }), 'error');
    const metas = await Promise.all(ok.map((f) => fileMeta(f, f.name, 'reference')));
    try {
      if (!c) {
        const p = emptyProject(t('create.newRefProject'), 'references');
        p.files = metas.map((m) => m.meta);
        const blobs = new Map(metas.map((m) => [m.meta.id, m.blob]));
        await db.createProject(p, blobs);
        api.openProject(p, blobs, true);
        api.bumpProjects();
      } else if (!(await api.addFiles(metas))) return;
      setSelected(metas[0].meta.id);
      ui.toast(t('create.refsSaved'), 'ok');
    } catch (e: any) {
      ui.toast(e?.code === 'quota' ? t('err.quota') : t('err.generic', { msg: e?.message ?? String(e) }), 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function check() {
    setHealth(null);
    setHealthErr('');
    try {
      const url = normaliseUrl(cfg.url);
      const next = { ...cfg, url };
      setCfg(next);
      saveBackendConfig(next);
      setHealth(await checkHealth(next));
    } catch (e: any) {
      setHealthErr(String(e?.message ?? e));
    }
  }

  async function run() {
    const f = refs.find((x) => x.id === selected);
    const blob = f && c?.blobs.get(f.id);
    if (!f || !blob || !health) return;
    setBusy(true);
    setJob('');
    try {
      const glb = await generate(cfg, blob, f.name, { removeBg, resolution: res }, (s) => setJob(t('create.job', { status: s.status, progress: `${n(Math.round(s.progress * 100))}%` })));
      const name = f.name.replace(/\.[^.]+$/, '') + '-3d.glb';
      const r = await buildProjectFromFiles([new File([glb], name, { type: 'model/gltf-binary' })], 'generated', t);
      const ref = await fileMeta(blob, f.name, 'reference');
      r.project.files.push(ref.meta);
      r.blobs.set(ref.meta.id, ref.blob);
      api.openProject(r.project, r.blobs, false);
      ui.toast(t('create.done'), 'ok');
      api.setTab('character');
    } catch (e: any) {
      setJob(t('create.failed', { msg: e?.message ?? String(e) }));
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { k: '1', label: t('create.refs'), done: refs.length > 0 },
    { k: '2', label: t('create.generate'), done: false },
    { k: '3', label: t('char.humanoid'), done: false },
    { k: '4', label: t('nav.animate'), done: false },
    { k: '5', label: t('nav.export'), done: false },
  ];

  return (
    <div className="stack">
      <h2>{t('create.title')}</h2>
      <ol className="wizard">
        {steps.map((s) => (
          <li key={s.k} className={s.done ? 'done' : ''}><span className="wnum">{s.done ? '✓' : s.k}</span><span className="wlabel">{s.label}</span></li>
        ))}
      </ol>
      <div className="alert alert-warn small">{t('create.limit')}</div>

      <section className="card">
        <h3>1 · {t('create.refs')}</h3>
        <p className="muted small">{t('create.refsNote')}</p>
        <button className="btn btn-primary btn-big" onClick={() => fileRef.current?.click()} data-testid="add-refs">🖼 {t('create.addRefs')}</button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => addImages([...(e.target.files ?? [])])} data-testid="ref-input" />
        {refs.length > 0 && (
          <ul className="ref-grid" data-testid="ref-grid">
            {refs.map((f) => (
              <li key={f.id}>
                <button className={`ref ${selected === f.id ? 'active' : ''}`} onClick={() => setSelected(f.id)}>
                  {thumbs[f.id] && <img src={thumbs[f.id].url} alt={f.name} />}
                  <span className="tiny mono">{thumbs[f.id] ? `${thumbs[f.id].w}×${thumbs[f.id].h} · ` : ''}{formatBytes(f.size)}</span>
                  {selected === f.id && <span className="badge badge-ok">{t('create.selected')}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" data-testid="backend-card">
        <h3>2 · {t('create.backend')}</h3>
        <label className="field">
          <span>{t('create.backendUrl')}</span>
          <input className="text-input mono" dir="ltr" placeholder="https://xxxx.trycloudflare.com" value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} data-testid="backend-url" />
        </label>
        <label className="field">
          <span>{t('create.token')}</span>
          <input className="text-input mono" dir="ltr" type="password" autoComplete="off" value={cfg.token} onChange={(e) => setCfg({ ...cfg, token: e.target.value })} data-testid="backend-token" />
          <span className="muted tiny">{t('create.tokenNote')}</span>
        </label>
        <button className="btn" onClick={check} data-testid="backend-check">{t('create.check')}</button>
        <p className={`small ${health ? 'ok-text' : healthErr ? 'err-text' : 'muted'}`} data-testid="backend-status">
          {health ? t('create.status.ok', { model: `${health.model} (${health.device})` }) : healthErr ? t('create.status.fail', { msg: healthErr }) : t('create.status.unknown')}
        </p>
        <label className="toggle"><input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} /><span>{t('create.removeBg')}</span></label>
        <label className="field"><span>{t('create.resolution', { n: n(res) })}</span><input type="range" min={128} max={512} step={32} value={res} onChange={(e) => setRes(+e.target.value)} /></label>
        <button className="btn btn-primary btn-big" disabled={!health || !selected || busy} onClick={run} data-testid="generate">🧊 {t('create.generate')}</button>
        {(!health || !selected) && <p className="muted tiny">{t('create.generateDisabled')}</p>}
        {busy && <div className="progress"><div className="spinner" /> {t('loading')}</div>}
        {job && <p className="small" data-testid="job-status">{job}</p>}
        <p className="muted tiny">{t('create.privacy')}</p>
        <p className="muted tiny">{t('create.guide')}</p>
      </section>

      <ComingLater items={[t('create.rigLater'), t('create.moreLater')]} />
    </div>
  );
}
