import { inspectGltf, findMissingResources, InspectError, type ModelStats } from '../core/gltfInspect';
import { checkSize, classify, formatBytes, mimeFor, pickMainFile, sha256Hex, MAX_FILE_BYTES } from '../core/files';
import { DEFAULT_VFX_SETTINGS, DEFAULT_VIEWER, DEFAULT_WEAPON, SCHEMA_VERSION, newId, newStep, type AssetFileMeta, type Combo, type Project } from '../core/project';
import type { MsgKey } from '../core/i18n';

type T = (k: MsgKey, v?: Record<string, string | number>) => string;

export interface ImportResult {
  project: Project;
  blobs: Map<string, Blob>;
  stats: ModelStats;
  warnings: string[];
}

export async function fileMeta(f: Blob, name: string, role: AssetFileMeta['role'], bytes?: Uint8Array): Promise<{ meta: AssetFileMeta; blob: Blob }> {
  const data = bytes ?? new Uint8Array(await f.arrayBuffer());
  const type = (f as File).type || mimeFor(name);
  const id = newId();
  return { meta: { id, name, size: data.length, type, sha256: await sha256Hex(data), role }, blob: new Blob([data], { type }) };
}

export function emptyProject(name: string, source: Project['source']): Project {
  const now = Date.now();
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    name,
    createdAt: now,
    updatedAt: now,
    files: [],
    stats: null,
    viewer: { ...DEFAULT_VIEWER },
    tags: [],
    source,
    combos: [],
    weapon: { ...DEFAULT_WEAPON },
    vfx: { ...DEFAULT_VFX_SETTINGS },
  };
}

/** Validate a model selection (GLB, or GLTF + resources) and build a draft project. Throws translated errors. */
export async function buildProjectFromFiles(list: File[], source: Project['source'], t: T): Promise<ImportResult> {
  if (!list.length) throw new Error(t('import.noModel'));
  for (const f of list) {
    if (!checkSize(f.size).ok) throw new Error(f.size === 0 ? t('import.invalid', { msg: 'empty file' }) : t('import.tooBig', { name: f.name, max: formatBytes(MAX_FILE_BYTES) }));
  }
  const mainName = pickMainFile(list.map((f) => f.name));
  if (!mainName) throw new Error(t('import.noModel'));
  const main = list.find((f) => f.name === mainName)!;
  const bytes = new Uint8Array(await main.arrayBuffer());
  let stats: ModelStats;
  try {
    stats = inspectGltf(bytes, main.name);
  } catch (e) {
    throw new Error(t('import.invalid', { msg: e instanceof InspectError ? e.message : String((e as any)?.message ?? e) }));
  }
  const warnings: string[] = [...stats.warnings];
  const missing = findMissingResources(stats, list.map((f) => f.name));
  const missingBuffers = missing.filter((m) => classify(m) !== 'image');
  if (missingBuffers.length) throw new Error(`${t('import.missing', { list: missing.join(', ') })} ${t('import.missingBuffer')}`);
  if (missing.length) warnings.push(`${t('import.missing', { list: missing.join(', ') })} ${t('import.missingImage')}`);
  const total = list.reduce((s, f) => s + f.size, 0);
  if (checkSize(total).warn) warnings.push(t('import.big', { size: formatBytes(total) }));

  const keep = stats.container === 'glb' ? [main] : list.filter((f) => f === main || classify(f.name) !== 'unknown');
  const project = emptyProject(main.name.replace(/\.(glb|gltf)$/i, ''), source);
  const blobs = new Map<string, Blob>();
  for (const f of keep) {
    const { meta, blob } = await fileMeta(f, f.name, f === main ? 'main' : 'resource', f === main ? bytes : undefined);
    project.files.push(meta);
    blobs.set(meta.id, blob);
  }
  project.stats = stats;
  project.combos = defaultCombos(stats.animations.map((a) => a.name));
  return { project, blobs, stats, warnings };
}

/** A starter combo built only from clips that really exist in the model. */
export function defaultCombos(clipNames: string[]): Combo[] {
  const find = (re: RegExp) => clipNames.find((n) => re.test(n));
  const seq = [find(/^idle/i), find(/run/i), find(/^jump$/i) ?? find(/jump/i), find(/punch|attack|kick/i), find(/^idle/i)].filter(Boolean) as string[];
  if (seq.length < 3) return [];
  const steps = seq.map((c) => newStep(c));
  const strike = steps.findIndex((s) => /punch|attack|kick/i.test(s.clip));
  if (strike >= 0) {
    steps[strike].eventAt = 0.45;
    steps[strike].eventVfx = 'projectile';
  }
  return [{ id: 'demo', name: seq.join(' → '), steps }];
}
