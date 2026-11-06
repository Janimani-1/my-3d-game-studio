import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LANGS, LANG_LABEL, RTL, detectInitialLang, type Lang } from '../core/i18n';
import { mainFile, modelFiles, type AssetFileMeta, type Project, type ViewerSettings } from '../core/project';
import * as db from '../core/db';
import type { Slot } from '../core/rig';
import { I18nCtx, UiProvider, makeI18n, useI18n, useUi, isFramed } from './common';
import { Viewer, loadEngine, webglAvailable, type BoneInfo, type ClipInfo } from '../viewer/engine';
import { ProjectsPanel } from './ProjectsPanel';
import { ImportPanel } from './ImportPanel';
import { CharacterPanel } from './CharacterPanel';
import { AnimatePanel } from './AnimatePanel';
import { WeaponsPanel } from './WeaponsPanel';
import { ExportPanel } from './ExportPanel';
import { CreatePanel } from './CreatePanel';
import { NavIcon } from './icons';

export type Tab = 'projects' | 'create' | 'character' | 'animate' | 'weapons' | 'export';
const TABS: Tab[] = ['projects', 'create', 'character', 'animate', 'weapons', 'export'];

export interface Current {
  project: Project;
  blobs: Map<string, Blob>; // fileId -> original blob
  saved: boolean;
  dirty: boolean;
  token: number;
}

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'nowebgl';

export interface PlayState {
  time: number;
  duration: number;
  playing: boolean;
}

export interface AppApi {
  current: Current | null;
  openProject: (p: Project, blobs: Map<string, Blob>, saved: boolean) => void;
  closeIfCurrent: (id: string) => void;
  updateViewer: (patch: Partial<ViewerSettings>, markDirty?: boolean) => void;
  updateProject: (patch: Partial<Project>, markDirty?: boolean) => void;
  addFiles: (files: { meta: AssetFileMeta; blob: Blob }[]) => Promise<boolean>;
  saveCurrent: (name?: string, patch?: Partial<Project>) => Promise<boolean>;
  setTab: (t: Tab) => void;
  viewer: Viewer | null;
  engine: EngineStatus;
  engineError: string;
  modelError: string;
  clips: ClipInfo[];
  setClips: (c: ClipInfo[]) => void;
  bones: BoneInfo[];
  humanoid: Partial<Record<Slot, string>>;
  materialNames: string[];
  play: PlayState;
  perf: { fps: number; particles: number };
  seqStep: number;
  hits: number;
  reloadViewer: () => void;
  projectsVersion: number;
  bumpProjects: () => void;
}

const LANG_KEY = 'm3gs.lang';

export function App() {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return detectInitialLang(localStorage.getItem(LANG_KEY));
    } catch {
      return 'fa';
    }
  });
  const i18n = useMemo(() => makeI18n(lang), [lang]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL[lang] ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* storage may be unavailable */
    }
    document.title = i18n.t('appName');
  }, [lang, i18n]);

  return (
    <I18nCtx.Provider value={i18n}>
      <UiProvider>
        <Shell lang={lang} setLang={setLang} />
      </UiProvider>
    </I18nCtx.Provider>
  );
}

function Shell({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const { t } = useI18n();
  const ui = useUi();
  const [tab, setTab] = useState<Tab>('projects');
  const [current, setCurrent] = useState<Current | null>(null);
  const [engine, setEngine] = useState<EngineStatus>('idle');
  const [engineError, setEngineError] = useState('');
  const [modelError, setModelError] = useState('');
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [bones, setBones] = useState<BoneInfo[]>([]);
  const [humanoid, setHumanoid] = useState<Partial<Record<Slot, string>>>({});
  const [materialNames, setMaterialNames] = useState<string[]>([]);
  const [play, setPlay] = useState<PlayState>({ time: 0, duration: 0, playing: false });
  const [perf, setPerf] = useState({ fps: 0, particles: 0 });
  const [seqStep, setSeqStep] = useState(-1);
  const [hits, setHits] = useState(0);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [viewerGen, setViewerGen] = useState(0);
  const [projectsVersion, setProjectsVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(t);
  tRef.current = t;

  const showViewport = tab === 'character' || tab === 'animate' || tab === 'weapons';
  const hasModel = !!(current && mainFile(current.project));

  useEffect(() => {
    if (!showViewport || !hasModel || viewer || engine === 'loading' || engine === 'failed' || engine === 'nowebgl') return;
    if (!webglAvailable()) {
      setEngine('nowebgl');
      return;
    }
    setEngine('loading');
    loadEngine()
      .then(() => {
        const v = new Viewer(containerRef.current!, {
          onContextLost: () => ui.toast(tRef.current('viewer.contextLost'), 'warn'),
          onContextRestored: () => ui.toast(tRef.current('viewer.contextRestored'), 'ok'),
          onTime: (time, duration, playing) => setPlay({ time, duration, playing }),
          onStats: (fps, particles) => setPerf({ fps, particles }),
          onSequenceStep: (i) => setSeqStep(i),
          onSequenceEnd: () => {
            setSeqStep(-1);
            setPlay((p) => ({ ...p, playing: false }));
          },
          onHit: (n) => setHits(n),
        });
        (window as any).__m3gsViewer = v; // exposed for automated tests
        setViewer(v);
        setEngine('ready');
      })
      .catch((e) => {
        setEngineError(String(e?.message ?? e));
        setEngine('failed');
      });
  }, [showViewport, hasModel, viewer, engine, ui, viewerGen]);

  const loadedToken = useRef<string>('');
  useEffect(() => {
    if (!viewer || !current) return;
    const key = current.project.id + ':' + current.token;
    if (loadedToken.current === key) return;
    loadedToken.current = key;
    const p = current.project;
    const main = mainFile(p);
    if (!main) return;
    setModelError('');
    const files = modelFiles(p).map((f) => ({ name: f.name, blob: current.blobs.get(f.id)! }));
    (async () => {
      try {
        const r = await viewer.load(files, main.name);
        for (const f of p.files.filter((x) => x.role === 'animation')) {
          const b = current.blobs.get(f.id);
          if (b) await viewer.importClips(b, f.name).catch(() => null);
        }
        const all = viewer.clipInfo();
        setClips(all);
        setBones(r.bones);
        setHumanoid(r.humanoid);
        setMaterialNames(r.materialNames);
        const s = p.viewer;
        viewer.setGrid(s.grid);
        viewer.setBackground(s.background);
        viewer.setLight(s.lightIntensity, s.ambientIntensity);
        viewer.setSkeleton(s.showSkeleton);
        viewer.setFullResolution(s.fullRes);
        viewer.setSpeed(s.speed);
        viewer.setLoop(s.loop);
        viewer.selectClip(all.length ? Math.min(Math.max(0, s.clipIndex), all.length - 1) : -1);
        if (s.camera) viewer.setCamera(s.camera);
        if (p.weapon.enabled) viewer.setWeapon(p.weapon);
        viewer.setVfxParams(p.vfx);
        if (p.vfx.aura) viewer.setAura(true, p.vfx);
        setPlay({ time: 0, duration: 0, playing: false });
        setHits(0);
      } catch (e: any) {
        setClips([]);
        setBones([]);
        setModelError(String(e?.message ?? e));
      }
    })();
  }, [viewer, current]);

  const openProject = useCallback((p: Project, blobs: Map<string, Blob>, saved: boolean) => {
    setCurrent((c) => ({ project: p, blobs, saved, dirty: !saved, token: (c?.token ?? 0) + 1 }));
    setClips([]);
    setBones([]);
    setHumanoid({});
    setMaterialNames([]);
    setModelError('');
    setSeqStep(-1);
  }, []);

  const closeIfCurrent = useCallback((id: string) => {
    setCurrent((c) => (c && c.project.id === id ? null : c));
  }, []);

  const updateViewer = useCallback((patch: Partial<ViewerSettings>, markDirty = true) => {
    setCurrent((c) => (c ? { ...c, dirty: c.dirty || markDirty, project: { ...c.project, viewer: { ...c.project.viewer, ...patch } } } : c));
  }, []);

  const updateProject = useCallback((patch: Partial<Project>, markDirty = true) => {
    setCurrent((c) => (c ? { ...c, dirty: c.dirty || markDirty, project: { ...c.project, ...patch } } : c));
  }, []);

  const currentRef = useRef(current);
  currentRef.current = current;

  const errMsg = (e: any) =>
    e?.code === 'quota' ? tRef.current('err.quota') : e?.code === 'unavailable' ? tRef.current('err.storageUnavailable') : tRef.current('err.generic', { msg: e?.message ?? String(e) });

  const saveCurrent = useCallback(
    async (name?: string, patch?: Partial<Project>) => {
      const c = currentRef.current;
      if (!c) return false;
      const cam = viewer && mainFile(c.project) ? viewer.getCamera() : c.project.viewer.camera;
      const project: Project = { ...c.project, ...(patch ?? {}), name: name ?? c.project.name, updatedAt: Date.now(), viewer: { ...c.project.viewer, camera: cam } };
      try {
        if (c.saved) await db.saveProjectMeta(project);
        else await db.createProject(project, c.blobs);
        setCurrent((cc) => (cc && cc.project.id === project.id ? { ...cc, project, saved: true, dirty: false } : cc));
        setProjectsVersion((v) => v + 1);
        ui.toast(tRef.current('saved'), 'ok');
        const info = await db.storageInfo();
        if (info.usage && info.quota && info.usage / info.quota > 0.85) ui.toast(tRef.current('storage.high'), 'warn');
        return true;
      } catch (e: any) {
        ui.toast(errMsg(e), 'error');
        return false;
      }
    },
    [viewer, ui],
  );

  /** Add new original files (reference images, animation GLBs) to the current project. Saved projects persist immediately. */
  const addFiles = useCallback(
    async (files: { meta: AssetFileMeta; blob: Blob }[]) => {
      const c = currentRef.current;
      if (!c) return false;
      const project: Project = { ...c.project, files: [...c.project.files, ...files.map((f) => f.meta)], updatedAt: Date.now() };
      const blobs = new Map(c.blobs);
      for (const f of files) blobs.set(f.meta.id, f.blob);
      try {
        if (c.saved) await db.addFiles(project, files);
        setCurrent((cc) => (cc && cc.project.id === project.id ? { ...cc, project, blobs } : cc));
        if (c.saved) setProjectsVersion((v) => v + 1);
        return true;
      } catch (e: any) {
        ui.toast(errMsg(e), 'error');
        return false;
      }
    },
    [ui],
  );

  const reloadViewer = useCallback(() => {
    viewer?.dispose();
    setViewer(null);
    loadedToken.current = '';
    setEngine((e) => (e === 'failed' || e === 'ready' ? 'idle' : e));
    setViewerGen((g) => g + 1);
  }, [viewer]);

  const api: AppApi = {
    current,
    openProject,
    closeIfCurrent,
    updateViewer,
    updateProject,
    addFiles,
    saveCurrent,
    setTab,
    viewer,
    engine,
    engineError,
    modelError,
    clips,
    setClips,
    bones,
    humanoid,
    materialNames,
    play,
    perf,
    seqStep,
    hits,
    reloadViewer,
    projectsVersion,
    bumpProjects: () => setProjectsVersion((v) => v + 1),
  };

  return (
    <div className={`app ${showViewport ? 'with-viewport' : ''}`}>
      <header className="topbar">
        <h1 className="app-title">{t('appName')}</h1>
        {current && (
          <span className={`save-state ${current.dirty ? 'dirty' : ''}`} data-testid="save-state">
            {current.project.name} · {current.dirty ? t('unsaved') : t('saved')}
          </span>
        )}
        <label className="lang-select">
          <span className="sr-only">{t('language')}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t('language')} data-testid="lang">
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
      </header>
      {isFramed && <div className="banner">{t('preview.banner')}</div>}

      <main className="main">
        <div className={`viewport-wrap ${showViewport ? '' : 'hidden'}`}>
          <div className="viewport" ref={containerRef} data-testid="viewport" />
          {showViewport && <ViewportOverlay api={api} />}
        </div>
        <div className="panel" data-testid={`panel-${tab}`}>
          {tab === 'projects' && (
            <div className="stack">
              <ImportPanel api={api} />
              <ProjectsPanel api={api} />
            </div>
          )}
          {tab === 'create' && <CreatePanel api={api} />}
          {tab === 'character' && <CharacterPanel api={api} />}
          {tab === 'animate' && <AnimatePanel key={current?.project.id ?? 'none'} api={api} />}
          {tab === 'weapons' && <WeaponsPanel api={api} />}
          {tab === 'export' && <ExportPanel api={api} />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="main">
        {TABS.map((x) => (
          <button key={x} className={`nav-btn ${tab === x ? 'active' : ''}`} onClick={() => setTab(x)} aria-current={tab === x} data-testid={`nav-${x}`}>
            <NavIcon name={x} />
            <span>{t(`nav.${x}` as any)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ViewportOverlay({ api }: { api: AppApi }) {
  const { t, n } = useI18n();
  let msg = '';
  let detail = '';
  let isErr = false;
  if (!api.current || !mainFile(api.current.project)) msg = t('viewer.noModel');
  else if (api.engine === 'nowebgl') {
    msg = t('viewer.noWebgl');
    isErr = true;
  } else if (api.engine === 'failed') {
    msg = t('viewer.engineFailed');
    detail = api.engineError;
    isErr = true;
  } else if (api.engine === 'loading' || api.engine === 'idle') msg = t('viewer.engineLoading');
  else if (api.modelError) {
    msg = t('viewer.loadFailed', { msg: '' }).replace(/[:：]\s*$/, '');
    detail = api.modelError;
    isErr = true;
  }
  if (!msg)
    return (
      <>
        <div className="viewport-hint">{t('viewer.hint')}</div>
        <div className="perf-badge mono" data-testid="perf">{t('anim.perf', { fps: n(api.perf.fps), p: n(api.perf.particles) })}</div>
      </>
    );
  return (
    <div className={`viewport-msg ${isErr ? 'err' : ''}`} data-testid="viewport-msg">
      <p>{msg}</p>
      {detail && <p className="msg-detail mono">{detail}</p>}
      {isErr && api.engine !== 'nowebgl' && (
        <button className="btn" onClick={api.reloadViewer}>
          {t('viewer.reload')}
        </button>
      )}
    </div>
  );
}
