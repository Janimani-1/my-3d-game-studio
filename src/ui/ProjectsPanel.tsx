import { useEffect, useState } from 'react';
import type { AppApi } from './App';
import { useI18n, useUi } from './common';
import * as db from '../core/db';
import { duplicateName, type Project } from '../core/project';
import { formatBytes } from '../core/files';
import { NUM_LOCALE } from '../core/i18n';

export function ProjectsPanel({ api }: { api: AppApi }) {
  const { t, lang } = useI18n();
  const ui = useUi();
  const [list, setList] = useState<Project[] | null>(null);
  const [error, setError] = useState('');
  const [storage, setStorage] = useState<db.StorageInfo | null>(null);

  async function refresh() {
    try {
      setList(await db.listProjects());
      setError('');
    } catch (e: any) {
      setList([]);
      setError(e?.code === 'unavailable' ? t('err.storageUnavailable') : t('err.generic', { msg: e?.message ?? String(e) }));
    }
    setStorage(await db.storageInfo());
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.projectsVersion, lang]);

  const errMsg = (e: any) => (e?.code === 'quota' ? t('err.quota') : t('err.generic', { msg: e?.message ?? String(e) }));

  async function open(p: Project) {
    try {
      const blobs = await db.getProjectBlobs(p);
      api.openProject(p, blobs, true);
      api.setTab(p.files.some((f) => f.role === 'main') ? 'character' : 'create');
    } catch (e) {
      ui.toast(errMsg(e), 'error');
    }
  }

  async function rename(p: Project) {
    const v = await ui.prompt(t('projects.newName'), p.name);
    if (v === null || !v.trim() || v.trim() === p.name) return;
    try {
      if (api.current?.project.id === p.id && api.current.saved) {
        await api.saveCurrent(v.trim());
      } else {
        await db.saveProjectMeta({ ...p, name: v.trim(), updatedAt: Date.now() });
      }
      ui.toast(t('projects.renamed'), 'ok');
      refresh();
    } catch (e) {
      ui.toast(errMsg(e), 'error');
    }
  }

  async function duplicate(p: Project) {
    try {
      await db.duplicateProject(p, duplicateName(p.name, (list ?? []).map((x) => x.name), t('projects.copyWord')));
      ui.toast(t('projects.duplicated'), 'ok');
      refresh();
    } catch (e) {
      ui.toast(errMsg(e), 'error');
    }
  }

  async function remove(p: Project) {
    const ok = await ui.confirm(t('projects.confirmDelete', { name: p.name }), { danger: true, okLabel: t('projects.delete') });
    if (!ok) return;
    try {
      await db.deleteProject(p.id);
      api.closeIfCurrent(p.id);
      ui.toast(t('projects.deleted'), 'ok');
      refresh();
    } catch (e) {
      ui.toast(errMsg(e), 'error');
    }
  }

  async function persist() {
    await db.requestPersist();
    setStorage(await db.storageInfo());
  }

  const df = new Intl.DateTimeFormat(NUM_LOCALE[lang], { dateStyle: 'medium', timeStyle: 'short' });
  const size = (p: Project) => p.files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="stack">
      <h2>{t('projects.title')}</h2>
      {error && <div className="card alert alert-error">{error}</div>}
      {list === null && <div className="card progress"><div className="spinner" /> {t('loading')}</div>}
      {list?.length === 0 && !error && <div className="card muted" data-testid="projects-empty">{t('projects.empty')}</div>}
      <ul className="project-list" data-testid="project-list">
        {list?.map((p) => (
          <li key={p.id} className="card project-item" data-testid="project-item">
            <div className="project-head">
              <strong className="project-name">{p.name}</strong>
              {api.current?.project.id === p.id && <span className="badge badge-ok">{t('projects.current')}</span>}
            </div>
            <div className="muted small">
              {t('projects.updated')}: {df.format(p.updatedAt)} · {formatBytes(size(p), NUM_LOCALE[lang])}
              {p.stats ? ` · ${t('stats.animations')}: ${p.stats.animations.length}` : ''}
            </div>
            <div className="row wrap">
              <button className="btn btn-primary" onClick={() => open(p)} data-testid="project-open">{t('projects.open')}</button>
              <button className="btn" onClick={() => rename(p)} data-testid="project-rename">{t('projects.rename')}</button>
              <button className="btn" onClick={() => duplicate(p)} data-testid="project-duplicate">{t('projects.duplicate')}</button>
              <button className="btn btn-danger-outline" onClick={() => remove(p)} data-testid="project-delete">{t('projects.delete')}</button>
            </div>
          </li>
        ))}
      </ul>

      <section className="card">
        <h3>{t('storage.title')}</h3>
        <p className="small">
          {storage?.usage != null && storage?.quota
            ? t('storage.usage', { used: formatBytes(storage.usage, NUM_LOCALE[lang]), quota: formatBytes(storage.quota, NUM_LOCALE[lang]) })
            : t('storage.unknown')}
        </p>
        {storage?.usage != null && storage?.quota ? (
          <div className="meter"><div style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }} /></div>
        ) : null}
        <p className="small muted">{storage?.persisted ? t('storage.persisted') : t('storage.notPersisted')}</p>
        {!storage?.persisted && <button className="btn" onClick={persist}>{t('storage.persist')}</button>}
      </section>

      <section className="card small muted">
        <h3>{t('about.credits')}</h3>
        <p>{t('about.text')}</p>
        <p>{t('diag.version')}: {__APP_VERSION__}</p>
      </section>
    </div>
  );
}
