import { useRef, useState } from 'react';
import type { AppApi } from './App';
import { useI18n, useUi } from './common';
import { formatBytes } from '../core/files';
import type { Project } from '../core/project';
import { buildProjectFromFiles, type ImportResult } from './importLogic';

export function ImportPanel({ api }: { api: AppApi }) {
  const { t, n } = useI18n();
  const ui = useUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [name, setName] = useState('');

  async function handleFiles(list: File[], source: Project['source'] = 'import') {
    setError('');
    setResult(null);
    if (!list.length) return;
    setBusy(true);
    try {
      const r = await buildProjectFromFiles(list, source, t);
      setName(r.project.name);
      setResult(r);
      api.openProject(r.project, r.blobs, false);
      ui.toast(t('import.ok'), 'ok');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function loadSample() {
    setBusy(true);
    try {
      const r = await fetch('./robot-expressive.glb');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const b = await r.blob();
      setBusy(false);
      await handleFiles([new File([b], 'RobotExpressive.glb', { type: 'model/gltf-binary' })], 'sample');
    } catch (e: any) {
      setBusy(false);
      setError(t('err.generic', { msg: e?.message ?? String(e) }));
    }
  }

  async function save() {
    if (!result) return;
    const ok = await api.saveCurrent(name.trim() || result.project.name);
    if (ok) setResult(null);
  }

  const isCurrentDraft = result && api.current?.project.id === result.project.id && !api.current.saved;

  return (
    <div className="stack">
      <section
        className={`card dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles([...e.dataTransfer.files]);
        }}
      >
        <h2>{t('import.title')}</h2>
        <p className="muted small">{t('import.hint')}</p>
        {/* No accept filter: Android Chrome often greys out .glb files when one is set. Files are validated after selection. */}
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => handleFiles([...(e.target.files ?? [])])} data-testid="file-input" />
        <div className="row wrap">
          <button className="btn btn-primary btn-big" onClick={() => inputRef.current?.click()} disabled={busy}>
            {t('import.pick')}
          </button>
          <button className="btn btn-big" onClick={loadSample} disabled={busy} data-testid="load-sample">
            🤖 {t('import.sampleRobot')}
          </button>
        </div>
        <p className="muted tiny">{t('import.sampleRobotNote')}</p>
        <p className="muted small desktop-only">{t('import.drop')}</p>
      </section>

      {busy && (
        <div className="card progress" role="progressbar" aria-busy="true">
          <div className="spinner" /> {t('loading')}
        </div>
      )}
      {error && (
        <div className="card alert alert-error" role="alert" data-testid="import-error">
          <strong>{t('error')}:</strong> {error}
        </div>
      )}

      {result && isCurrentDraft && (
        <section className="card" data-testid="import-result">
          <h3>{t('import.selected')}</h3>
          <ul className="file-list">
            {result.project.files.map((f) => (
              <li key={f.id}>
                <span className="mono">{f.name}</span> <span className="muted">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
          <p className="small">
            {t('stats.triangles')}: {n(result.stats.triangles)} · {t('stats.joints')}: {n(result.stats.joints)} · {t('stats.animations')}: {n(result.stats.animations.length)}
          </p>
          {result.warnings.map((w, i) => (
            <div key={i} className="alert alert-warn small">
              {w}
            </div>
          ))}
          <label className="field">
            <span>{t('import.projectName')}</span>
            <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-testid="project-name" />
          </label>
          <div className="row">
            <button className="btn btn-primary" onClick={save} data-testid="save-project">
              {t('import.saveProject')}
            </button>
            <button className="btn" onClick={() => api.setTab('character')} data-testid="open-viewer">
              {t('import.openViewer')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
