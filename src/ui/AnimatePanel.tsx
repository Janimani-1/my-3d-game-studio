import { useMemo, useRef, useState } from 'react';
import type { AppApi } from './App';
import { useI18n, useUi } from './common';
import { SaveBar } from './CharacterPanel';
import { MOVES, MOVE_CATEGORIES, categoryOfClip, clipsForMove, type MoveCategory } from '../core/catalog';
import { newId, newStep, type Combo, type ComboStep } from '../core/project';
import { checkSize, classify } from '../core/files';
import { fileMeta } from './importLogic';
import type { ArenaConfig, SequenceStep } from '../viewer/engine';

const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const EVENT_VFX: ComboStep['eventVfx'][] = ['none', 'projectile', 'beam', 'beam2', 'lightning', 'chain'];

export function AnimatePanel({ api }: { api: AppApi }) {
  const { t, n, lang } = useI18n();
  const ui = useUi();
  const c = api.current;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<MoveCategory | 'all' | 'other'>('all');
  const [draft, setDraft] = useState<Combo>(() => c?.project.combos[0] ? structuredClone(c.project.combos[0]) : { id: newId(), name: 'Combo 1', steps: [] });
  const [loopCombo, setLoopCombo] = useState(false);
  const [arena, setArena] = useState<ArenaConfig & { on: boolean }>(() => {
    const live = api.viewer?.arenaConfig;
    return live ? { ...live, on: true } : { on: false, distance: 0.9, opponentClip: 0, reactionClip: -1, showBoxes: true };
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const clipNames = api.clips.map((x) => x.name);

  const filtered = useMemo(
    () =>
      api.clips
        .map((x, i) => ({ ...x, i, cat: categoryOfClip(x.name) }))
        .filter((x) => (cat === 'all' || x.cat === cat) && (!q || x.name.toLowerCase().includes(q.toLowerCase()))),
    [api.clips, q, cat],
  );

  if (!c || !c.project.files.some((f) => f.role === 'main')) return <div className="card muted">{t('viewer.noModel')}</div>;
  const s = c.project.viewer;
  const v = api.viewer;
  const sel = Math.min(Math.max(0, s.clipIndex), Math.max(0, api.clips.length - 1));
  const ready = !!v && api.clips.length > 0;
  const dur = api.play.duration || api.clips[sel]?.duration || 0;

  function pick(i: number) {
    v?.selectClip(i);
    v?.play();
    api.updateViewer({ clipIndex: i });
  }

  async function addPack() {
    if (!v) return;
    try {
      const r = await fetch('./combat-pack.glb');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await importAnim([new File([await r.blob()], 'studio-combat-pack.glb', { type: 'model/gltf-binary' })]);
    } catch (e: any) {
      ui.toast(t('err.generic', { msg: e?.message ?? String(e) }), 'error');
    }
  }

  async function importAnim(list: File[]) {
    const f = list[0];
    if (!f || !v) return;
    if (!['glb', 'gltf'].includes(classify(f.name)) || !checkSize(f.size).ok) return ui.toast(t('import.noModel'), 'error');
    try {
      const r = await v.importClips(f, f.name);
      if (r.added.length) {
        const fm = await fileMeta(f, f.name, 'animation');
        await api.addFiles([fm]);
        api.setClips(v.clipInfo());
        ui.toast(t('anim.imported', { n: n(r.added.length) }) + (r.retargeted.length ? ` · ${t('anim.retargeted', { n: n(r.retargeted.length) })}` : ''), 'ok');
      }
      if (r.rejected.length) ui.toast(t('anim.rejected', { list: r.rejected.map((x) => `${x.name} (${x.reason})`).join(', ') }), 'warn');
    } catch (e: any) {
      ui.toast(t('err.generic', { msg: e?.message ?? String(e) }), 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const toEngine = (steps: ComboStep[]): SequenceStep[] =>
    steps.map((st) => ({ ...st, clip: clipNames.indexOf(st.clip) })).filter((st) => st.clip >= 0);

  function setStep(i: number, patch: Partial<ComboStep>) {
    setDraft((d) => ({ ...d, steps: d.steps.map((st, k) => (k === i ? { ...st, ...patch } : st)) }));
  }
  function move(i: number, dir: -1 | 1) {
    setDraft((d) => {
      const steps = [...d.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });
  }
  async function saveCombo() {
    const combos = [...c!.project.combos.filter((x) => x.id !== draft.id), draft];
    api.updateProject({ combos });
    if (c!.saved) await api.saveCurrent(undefined, { combos });
    ui.toast(t('anim.comboSaved'), 'ok');
  }
  function deleteCombo(id: string) {
    const combos = c!.project.combos.filter((x) => x.id !== id);
    api.updateProject({ combos });
    if (draft.id === id) setDraft({ id: newId(), name: `Combo ${combos.length + 1}`, steps: [] });
  }
  function applyArena(next: typeof arena) {
    setArena(next);
    if (!v) return;
    if (!next.on) v.setArena(null);
    else v.setArenaOptions({ distance: next.distance, opponentClip: next.opponentClip, reactionClip: next.reactionClip, showBoxes: next.showBoxes });
  }

  return (
    <div className="stack">
      <SaveBar api={api} />

      {/* ---------- library ---------- */}
      <section className="card">
        <h3>{t('anim.library')}</h3>
        {api.clips.length === 0 ? (
          <p className="muted" data-testid="no-anim">{t('anim.none')}</p>
        ) : (
          <>
            <input className="text-input" placeholder={t('anim.search')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="clip-search" />
            <div className="chips">
              {(['all', ...MOVE_CATEGORIES, 'other'] as const).map((k) => (
                <button key={k} className={`btn chip ${cat === k ? 'active' : ''}`} onClick={() => setCat(k)}>
                  {k === 'all' ? t('anim.all') : t(`anim.cat.${k}` as any)}
                </button>
              ))}
            </div>
            <ul className="clip-list" role="radiogroup">
              {filtered.map((x) => (
                <li key={x.i}>
                  <button className={`clip ${x.i === sel ? 'active' : ''}`} onClick={() => pick(x.i)} data-testid={`clip-${x.i}`}>
                    <span className="mono">{x.name}</span>
                    <span className="muted small">{x.source !== 'model' ? '⬇ ' : ''}{t('anim.seconds', { n: n(x.duration, 2) })}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="row transport">
              {api.play.playing ? (
                <button className="btn btn-primary btn-big" onClick={() => v?.pause()} disabled={!ready} data-testid="anim-pause">⏸ {t('anim.pause')}</button>
              ) : (
                <button className="btn btn-primary btn-big" onClick={() => v?.play()} disabled={!ready} data-testid="anim-play">▶ {t('anim.play')}</button>
              )}
              <button className="btn btn-big" onClick={() => v?.stop()} disabled={!ready} data-testid="anim-stop">⏹ {t('anim.stop')}</button>
            </div>
            <label className="field">
              <span>{n(api.play.time, 2)} / {t('anim.seconds', { n: n(dur, 2) })}</span>
              <input type="range" min={0} max={dur || 1} step={0.01} value={Math.min(api.play.time, dur || 1)} disabled={!ready} onChange={(e) => v?.seek(+e.target.value)} aria-label="time" />
            </label>
            <div className="field">
              <span>{t('anim.speed')}: ×{n(s.speed, 2)}</span>
              <div className="row wrap">
                {SPEEDS.map((x) => (
                  <button key={x} className={`btn chip ${s.speed === x ? 'active' : ''}`} onClick={() => { v?.setSpeed(x); api.updateViewer({ speed: x }); }} data-testid={`speed-${x}`}>×{n(x, 2)}</button>
                ))}
              </div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={s.loop} onChange={(e) => { v?.setLoop(e.target.checked); api.updateViewer({ loop: e.target.checked }); }} data-testid="anim-loop" />
              <span>{t('anim.loop')}</span>
            </label>
          </>
        )}
        <div className="divider" />
        <button className="btn btn-primary btn-big" onClick={addPack} disabled={!v || api.clips.some((x) => x.source.startsWith('studio-combat-pack'))} data-testid="add-pack">🥋 {t('anim.pack')}</button>
        <p className="muted tiny">{t('anim.packNote')}</p>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={!v} data-testid="import-anim">⬇ {t('anim.importClips')}</button>
        <input ref={fileRef} type="file" hidden onChange={(e) => importAnim([...(e.target.files ?? [])])} data-testid="anim-file" />
        <p className="muted tiny">{t('anim.importNote')}</p>
      </section>

      {/* ---------- combo editor ---------- */}
      <section className="card" data-testid="combo-editor">
        <h3>{t('anim.combo')}</h3>
        <label className="field">
          <span>{t('anim.comboName')}</span>
          <input className="text-input" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <button className="btn" disabled={!api.clips.length} onClick={() => setDraft({ ...draft, steps: [...draft.steps, newStep(api.clips[sel].name)] })} data-testid="add-step">
          ＋ {t('anim.addStep')} ({api.clips[sel]?.name ?? '—'})
        </button>
        {draft.steps.length === 0 && <p className="muted small">{t('anim.comboEmpty')}</p>}
        <ol className="steps">
          {draft.steps.map((st, i) => {
            const ok = clipNames.includes(st.clip);
            return (
              <li key={i} className={`step ${api.seqStep === i ? 'playing' : ''} ${ok ? '' : 'bad'}`} data-testid="combo-step">
                <div className="row wrap step-head">
                  <strong>{i + 1}.</strong>
                  <select value={st.clip} onChange={(e) => setStep(i, { clip: e.target.value })}>
                    {!ok && <option value={st.clip}>{st.clip} ⚠</option>}
                    {clipNames.map((nm) => <option key={nm} value={nm}>{nm}</option>)}
                  </select>
                  <button className="btn chip" onClick={() => move(i, -1)} aria-label={t('anim.up')}>▲</button>
                  <button className="btn chip" onClick={() => move(i, 1)} aria-label={t('anim.down')}>▼</button>
                  <button className="btn chip btn-danger-outline" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, k) => k !== i) })} aria-label={t('anim.remove')}>✕</button>
                </div>
                <div className="grid2">
                  <label className="field"><span>{t('anim.speed')} ×{n(st.speed, 2)}</span><input type="range" min={0.25} max={2.5} step={0.05} value={st.speed} onChange={(e) => setStep(i, { speed: +e.target.value })} /></label>
                  <label className="field"><span>{t('anim.fade')} {n(st.fade, 2)}s</span><input type="range" min={0} max={0.8} step={0.05} value={st.fade} onChange={(e) => setStep(i, { fade: +e.target.value })} /></label>
                  <label className="field"><span>{t('anim.trim')} {n(st.trimStart * 100)}%–{n(st.trimEnd * 100)}%</span>
                    <span className="row"><input type="range" min={0} max={0.9} step={0.05} value={st.trimStart} onChange={(e) => setStep(i, { trimStart: Math.min(+e.target.value, st.trimEnd - 0.05) })} /><input type="range" min={0.1} max={1} step={0.05} value={st.trimEnd} onChange={(e) => setStep(i, { trimEnd: Math.max(+e.target.value, st.trimStart + 0.05) })} /></span>
                  </label>
                  <label className="field"><span>{t('anim.event')} {st.eventAt >= 0 ? `${n(st.eventAt * 100)}%` : ''}</span>
                    <span className="row">
                      <select value={st.eventVfx} onChange={(e) => setStep(i, { eventVfx: e.target.value as ComboStep['eventVfx'], eventAt: e.target.value === 'none' ? -1 : st.eventAt < 0 ? 0.5 : st.eventAt })}>
                        {EVENT_VFX.map((m) => <option key={m} value={m}>{m === 'none' ? t('anim.eventNone') : m === 'chain' ? t('weap.chain') : t(`weap.modes.${m}` as any)}</option>)}
                      </select>
                      {st.eventVfx !== 'none' && <input type="range" min={0} max={1} step={0.05} value={Math.max(0, st.eventAt)} onChange={(e) => setStep(i, { eventAt: +e.target.value })} />}
                    </span>
                  </label>
                </div>
              </li>
            );
          })}
        </ol>
        <label className="toggle"><input type="checkbox" checked={loopCombo} onChange={(e) => setLoopCombo(e.target.checked)} /><span>{t('anim.loopCombo')}</span></label>
        <div className="row wrap">
          <button className="btn btn-primary" disabled={!ready || !toEngine(draft.steps).length} onClick={() => { v!.setVfxParams(c.project.vfx); v!.playSequence(toEngine(draft.steps), loopCombo); }} data-testid="play-combo">▶ {t('anim.playCombo')}</button>
          <button className="btn" disabled={!v} onClick={() => v?.stop()}>⏹ {t('anim.stopCombo')}</button>
          <button className="btn" disabled={!draft.steps.length} onClick={saveCombo} data-testid="save-combo">💾 {t('anim.saveCombo')}</button>
          <button className="btn" onClick={() => setDraft({ id: newId(), name: `Combo ${c.project.combos.length + 1}`, steps: [] })}>{t('anim.newCombo')}</button>
        </div>
        {c.project.combos.length > 0 && (
          <>
            <h4>{t('anim.combos')}</h4>
            <ul className="file-list">
              {c.project.combos.map((cb) => (
                <li key={cb.id} className="file-row">
                  <button className={`btn ${draft.id === cb.id ? 'btn-primary' : ''}`} onClick={() => setDraft(structuredClone(cb))} data-testid="combo-item">{cb.name} ({n(cb.steps.length)})</button>
                  <button className="btn chip btn-danger-outline" onClick={() => deleteCombo(cb.id)} aria-label={t('anim.deleteCombo')}>✕</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------- arena ---------- */}
      <section className="card" data-testid="arena">
        <h3>{t('anim.arena')}</h3>
        <label className="toggle"><input type="checkbox" checked={arena.on} disabled={!ready} onChange={(e) => applyArena({ ...arena, on: e.target.checked })} data-testid="arena-toggle" /><span>{t('anim.arenaOn')}</span></label>
        {arena.on && (
          <>
            <label className="field"><span>{t('anim.distance')}: {n(arena.distance, 2)}</span><input type="range" min={0.4} max={2.5} step={0.05} value={arena.distance} onChange={(e) => applyArena({ ...arena, distance: +e.target.value })} /></label>
            <label className="field"><span>{t('anim.defIdle')}</span>
              <select value={arena.opponentClip} onChange={(e) => applyArena({ ...arena, opponentClip: +e.target.value })}>{api.clips.map((x, i) => <option key={i} value={i}>{x.name}</option>)}</select>
            </label>
            <label className="field"><span>{t('anim.reaction')}</span>
              <select value={arena.reactionClip} onChange={(e) => applyArena({ ...arena, reactionClip: +e.target.value })} data-testid="arena-reaction">
                <option value={-1}>—</option>
                {api.clips.map((x, i) => <option key={i} value={i}>{x.name}</option>)}
              </select>
            </label>
            <label className="toggle"><input type="checkbox" checked={arena.showBoxes} onChange={(e) => applyArena({ ...arena, showBoxes: e.target.checked })} /><span>{t('anim.boxes')}</span></label>
            <p className="small" data-testid="arena-hits">{t('anim.hits', { n: n(api.hits) })}</p>
          </>
        )}
        <p className="muted tiny">{t('anim.arenaNote')}</p>
      </section>

      {/* ---------- catalog ---------- */}
      <section className="card">
        <h3>{t('anim.catalogTitle')}</h3>
        <p className="muted tiny">{t('anim.catalogNote')}</p>
        {MOVE_CATEGORIES.map((k) => {
          const moves = MOVES.filter((m) => m.cat === k);
          const have = moves.filter((m) => clipsForMove(m, clipNames).length).length;
          return (
            <details key={k} className="catalog-cat">
              <summary>{t(`anim.cat.${k}` as any)} <span className="muted small">({n(have)}/{n(moves.length)})</span></summary>
              <ul className="catalog-list">
                {moves.map((m) => {
                  const hits = clipsForMove(m, clipNames);
                  return (
                    <li key={m.id}>
                      <span className={`badge ${hits.length ? 'badge-ok' : ''}`}>{hits.length ? t('anim.available') : t('anim.needsImport')}</span> {m[lang]}
                      {hits.length > 0 && <span className="muted tiny mono"> → {hits.join(', ')}</span>}
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </section>
    </div>
  );
}
