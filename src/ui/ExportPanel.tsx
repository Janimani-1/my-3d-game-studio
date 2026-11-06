import { useRef, useState } from 'react';
import type { AppApi } from './App';
import { useI18n, useUi, ComingLater, downloadBlob, isFramed } from './common';
import * as db from '../core/db';
import { buildBackupZip, parseBackupZip, newId, type Project } from '../core/project';
import { formatBytes, sha256Hex } from '../core/files';

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}
function slug(s: string) {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'project';
}

export function ExportPanel({ api }: { api: AppApi }) {
  const { t, n } = useI18n();
  const ui = useUi();
  const [verify, setVerify] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [withWeapon, setWithWeapon] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);
  const c = api.current;

  async function blobsFor(p: Project) {
    if (c && c.project.id === p.id) return c.blobs;
    return db.getProjectBlobs(p);
  }

  async function downloadOriginal(fileId: string) {
    if (!c) return;
    const f = c.project.files.find((x) => x.id === fileId)!;
    const blob = c.saved ? await db.getFileBlob(f.id) : c.blobs.get(f.id)!;
    downloadBlob(blob, f.name);
  }

  async function doVerify() {
    if (!c) return;
    const r: Record<string, boolean> = {};
    for (const f of c.project.files) {
      const blob = c.saved ? await db.getFileBlob(f.id) : c.blobs.get(f.id)!;
      r[f.id] = (await sha256Hex(await blob.arrayBuffer())) === f.sha256;
    }
    setVerify(r);
  }

  async function backup(projects: Project[], fileName: string) {
    setBusy(true);
    try {
      const items = [];
      for (const p of projects) {
        const blobs = await blobsFor(p);
        const files = [];
        for (const f of p.files) files.push({ meta: f, data: new Uint8Array(await blobs.get(f.id)!.arrayBuffer()) });
        items.push({ project: p, files });
      }
      const zip = buildBackupZip(items, __APP_VERSION__);
      downloadBlob(new Blob([zip], { type: 'application/zip' }), fileName);
    } catch (e: any) {
      ui.toast(t('err.generic', { msg: e?.message ?? String(e) }), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function backupAll() {
    try {
      const all = await db.listProjects();
      if (!all.length) return ui.toast(t('projects.empty'), 'warn');
      await backup(all, `my3dstudio-backup-all-${stamp()}.zip`);
    } catch (e: any) {
      ui.toast(e?.code === 'unavailable' ? t('err.storageUnavailable') : t('err.generic', { msg: e?.message ?? String(e) }), 'error');
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const items = parseBackupZip(new Uint8Array(await file.arrayBuffer()));
      const existing = new Set((await db.listProjects()).map((p) => p.id));
      for (const { project, files } of items) {
        // Integrity check against stored fingerprints
        for (const f of files) {
          if ((await sha256Hex(f.data)) !== f.meta.sha256) throw new Error(`SHA-256 mismatch: ${f.meta.name}`);
        }
        // Always assign fresh ids so a restore never overwrites existing data
        const idMap = new Map(files.map((f) => [f.meta.id, newId()]));
        const p: Project = {
          ...project,
          id: existing.has(project.id) ? newId() : project.id,
          files: project.files.map((f) => ({ ...f, id: idMap.get(f.id)! })),
          source: 'restore',
        };
        const blobs = new Map(files.map((f) => [idMap.get(f.meta.id)!, new Blob([f.data], { type: f.meta.type })]));
        await db.createProject(p, blobs);
      }
      api.bumpProjects();
      ui.toast(t('export.restored', { n: n(items.length) }), 'ok');
    } catch (e: any) {
      ui.toast(t('export.restoreFailed', { msg: e?.code === 'quota' ? t('err.quota') : e?.message ?? String(e) }), 'error');
    } finally {
      setBusy(false);
      if (restoreRef.current) restoreRef.current.value = '';
    }
  }

  async function exportNew() {
    if (!api.viewer || !c) return;
    setBusy(true);
    try {
      const buf = await api.viewer.exportGlb(withWeapon);
      await downloadBlob(new Blob([buf], { type: 'model/gltf-binary' }), `${slug(c.project.name)}-export-${stamp()}.glb`);
      ui.toast(t('exp.exported'), 'ok');
    } catch (e: any) {
      ui.toast(t('err.generic', { msg: e?.message ?? String(e) }), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h2>{t('export.title')}</h2>
      {isFramed && <div className="alert alert-warn small">{t('export.downloadNote')}</div>}
      {!c ? (
        <div className="card muted">{t('export.noProject')}</div>
      ) : (
        <>
          <section className="card">
            <h3>{t('export.original')}</h3>
            <p className="muted small">{t('export.originalNote')}</p>
            <ul className="file-list">
              {c.project.files.map((f) => (
                <li key={f.id} className="file-row">
                  <div>
                    <span className="mono">{f.name}</span> <span className="muted small">{formatBytes(f.size)}</span>
                    <div className="mono tiny muted hash" data-testid="sha">SHA-256: {f.sha256}</div>
                    {verify[f.id] !== undefined && (
                      <div className={`small ${verify[f.id] ? 'ok-text' : 'err-text'}`} data-testid="verify-result">
                        {verify[f.id] ? t('export.verified') : t('export.mismatch')}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-primary" onClick={() => downloadOriginal(f.id)} data-testid="download-original">⬇</button>
                </li>
              ))}
            </ul>
            <button className="btn" onClick={doVerify} data-testid="verify">{t('export.verify')}</button>
          </section>
          <section className="card">
            <h3>{t('export.backup')}</h3>
            <p className="muted small">{t('export.backupNote')}</p>
            <button className="btn btn-primary" disabled={busy} onClick={() => backup([c.project], `my3dstudio-${slug(c.project.name)}-${stamp()}.zip`)} data-testid="backup-one">
              {t('export.backup')}
            </button>
          </section>
        </>
      )}
      <section className="card">
        <div className="row wrap">
          <button className="btn" disabled={busy} onClick={backupAll} data-testid="backup-all">{t('export.backupAll')}</button>
          <button className="btn" disabled={busy} onClick={() => restoreRef.current?.click()} data-testid="restore">{t('export.restore')}</button>
          <input ref={restoreRef} type="file" hidden onChange={(e) => restore(e.target.files?.[0])} data-testid="restore-input" />
        </div>
        {busy && <div className="progress"><div className="spinner" /> {t('loading')}</div>}
      </section>
      {c && c.project.files.some((f) => f.role === 'main') && (
        <section className="card">
          <h3>{t('exp.newGlb')}</h3>
          <p className="muted small">{t('exp.newGlbNote')}</p>
          <label className="toggle"><input type="checkbox" checked={withWeapon} onChange={(e) => setWithWeapon(e.target.checked)} /><span>{t('exp.includeWeapon')}</span></label>
          <button className="btn btn-primary" disabled={!api.viewer || busy} onClick={exportNew} data-testid="export-glb">⬇ {t('exp.newGlb')}</button>
          {!api.viewer && <p className="muted tiny">{t('viewer.noModel')}</p>}
        </section>
      )}
      <section className="card">
        <h3>{t('export.engines')}</h3>
        <p className="small">{t('exp.compat')}</p>
        <p className="small">{t('export.enginesNote')}</p>
      </section>
      <ComingLater items={[t('export.optimized'), t('export.fbx')]} />
    </div>
  );
}
