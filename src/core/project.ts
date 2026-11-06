/** Project data model, schema versioning, and backup (ZIP) format. */
import type { ModelStats } from './gltfInspect';
import { createZip, readZip } from './zip';
import { safeName } from './files';

export const SCHEMA_VERSION = 2;
export const BACKUP_FORMAT = 'my3dstudio-backup';

export interface ViewerSettings {
  grid: boolean;
  background: string; // hex color
  lightIntensity: number; // 0..3
  ambientIntensity: number; // 0..3
  showSkeleton: boolean;
  fullRes: boolean; // render at native device pixel ratio
  clipIndex: number; // -1 = none
  speed: number;
  loop: boolean;
  camera: { position: [number, number, number]; target: [number, number, number] } | null;
}

export const DEFAULT_VIEWER: ViewerSettings = {
  grid: true,
  background: '#1b1e27',
  lightIntensity: 1.6,
  ambientIntensity: 0.8,
  showSkeleton: false,
  fullRes: false,
  clipIndex: 0,
  speed: 1,
  loop: true,
  camera: null,
};

export interface AssetFileMeta {
  id: string;
  name: string; // original file name, unchanged
  size: number;
  type: string;
  sha256: string;
  role: 'main' | 'resource' | 'reference' | 'animation' | 'video';
}

export interface ComboStep {
  clip: string; // clip name (stable across reloads)
  speed: number;
  fade: number;
  trimStart: number;
  trimEnd: number;
  eventAt: number; // 0..1 or -1
  eventVfx: 'none' | 'projectile' | 'beam' | 'beam2' | 'lightning' | 'chain';
}

export interface Combo {
  id: string;
  name: string;
  steps: ComboStep[];
}

export interface WeaponSettings {
  enabled: boolean;
  type: 'sword' | 'greatsword' | 'axe' | 'dagger' | 'spear' | 'hammer' | 'shuriken';
  element: 'none' | 'fire' | 'ice' | 'electric';
  hand: 'R' | 'L';
  rot: [number, number, number];
  scale: number;
}

export interface VfxSettings {
  mode: 'projectile' | 'beam' | 'beam2' | 'lightning';
  element: 'fire' | 'ice' | 'energy' | 'lightning';
  color: string;
  size: number;
  speed: number;
  duration: number;
  intensity: number;
  aura: boolean;
}

export const DEFAULT_WEAPON: WeaponSettings = { enabled: false, type: 'sword', element: 'none', hand: 'R', rot: [0, 0, 0], scale: 1 };
export const DEFAULT_VFX_SETTINGS: VfxSettings = { mode: 'projectile', element: 'fire', color: '#ff7a1a', size: 1, speed: 1, duration: 1.2, intensity: 1, aura: false };

export function newStep(clip: string): ComboStep {
  return { clip, speed: 1, fade: 0.25, trimStart: 0, trimEnd: 1, eventAt: -1, eventVfx: 'none' };
}

export interface Project {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: AssetFileMeta[];
  stats: ModelStats | null;
  viewer: ViewerSettings;
  tags: string[];
  source: 'import' | 'sample' | 'restore' | 'generated' | 'references';
  combos: Combo[];
  weapon: WeaponSettings;
  vfx: VfxSettings;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Bring older/partial project records up to the current schema. */
export function migrateProject(raw: any): Project {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid project record');
  const v = Number(raw.schemaVersion ?? 0);
  if (v > SCHEMA_VERSION) throw new Error(`Project schema v${v} is newer than this app (v${SCHEMA_VERSION}). Update the app.`);
  const p: Project = {
    id: String(raw.id ?? newId()),
    schemaVersion: SCHEMA_VERSION,
    name: String(raw.name ?? 'Untitled'),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
    files: Array.isArray(raw.files) ? raw.files : [],
    stats: raw.stats ?? null,
    viewer: { ...DEFAULT_VIEWER, ...(raw.viewer ?? {}) },
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    source: raw.source ?? 'import',
    combos: Array.isArray(raw.combos) ? raw.combos : [],
    weapon: { ...DEFAULT_WEAPON, ...(raw.weapon ?? {}) },
    vfx: { ...DEFAULT_VFX_SETTINGS, ...(raw.vfx ?? {}) },
  };
  return p;
}

export function mainFile(p: Project): AssetFileMeta | undefined {
  return p.files.find((f) => f.role === 'main');
}

export function modelFiles(p: Project): AssetFileMeta[] {
  return p.files.filter((f) => f.role === 'main' || f.role === 'resource');
}

/** "Name" -> "Name (copy)", "Name (copy)" -> "Name (copy 2)" avoiding existing names. */
export function duplicateName(name: string, existing: string[], copyWord = 'copy'): string {
  const set = new Set(existing);
  const base = name.replace(new RegExp(`\\s*\\(${copyWord}(?: \\d+)?\\)$`), '');
  let candidate = `${base} (${copyWord})`;
  let n = 2;
  while (set.has(candidate)) candidate = `${base} (${copyWord} ${n++})`;
  return candidate;
}

export interface BackupFile {
  meta: AssetFileMeta;
  data: Uint8Array;
}

/**
 * Backup ZIP layout (STORE, uncompressed):
 *   manifest.json                 - format, appVersion, exportedAt, projects[]
 *   projects/<projectId>/project.json
 *   projects/<projectId>/files/<fileId>/<originalName>   - exact original bytes
 *   README.txt
 */
export function buildBackupZip(items: { project: Project; files: BackupFile[] }[], appVersion: string, now = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const entries = [] as { name: string; data: Uint8Array }[];
  entries.push({
    name: 'manifest.json',
    data: enc.encode(
      JSON.stringify(
        {
          format: BACKUP_FORMAT,
          formatVersion: 1,
          schemaVersion: SCHEMA_VERSION,
          appVersion,
          exportedAt: now.toISOString(),
          projects: items.map((i) => ({ id: i.project.id, name: i.project.name })),
        },
        null,
        2,
      ),
    ),
  });
  for (const { project, files } of items) {
    const dir = `projects/${project.id}/`;
    entries.push({ name: dir + 'project.json', data: enc.encode(JSON.stringify(project, null, 2)) });
    for (const f of files) entries.push({ name: `${dir}files/${f.meta.id}/${safeName(f.meta.name)}`, data: f.data });
  }
  entries.push({
    name: 'README.txt',
    data: enc.encode(
      'My 3D Game Studio backup.\n' +
        'Restore it from the app: Export tab > Restore backup.\n' +
        'Original asset files are stored unmodified under projects/<id>/files/<fileId>/.\n' +
        'Each project.json lists the SHA-256 of every original file.\n',
    ),
  });
  return createZip(entries, now);
}

export function parseBackupZip(buf: Uint8Array): { project: Project; files: BackupFile[] }[] {
  const entries = readZip(buf);
  const byName = new Map(entries.map((e) => [e.name, e.data]));
  const manifestRaw = byName.get('manifest.json');
  if (!manifestRaw) throw new Error('Not a My 3D Game Studio backup (manifest.json missing)');
  const manifest = JSON.parse(new TextDecoder().decode(manifestRaw));
  if (manifest.format !== BACKUP_FORMAT) throw new Error('Not a My 3D Game Studio backup (wrong format id)');
  const out: { project: Project; files: BackupFile[] }[] = [];
  for (const ref of manifest.projects ?? []) {
    const pj = byName.get(`projects/${ref.id}/project.json`);
    if (!pj) throw new Error(`Backup is missing project ${ref.id}`);
    const project = migrateProject(JSON.parse(new TextDecoder().decode(pj)));
    const files: BackupFile[] = [];
    for (const meta of project.files) {
      const data = byName.get(`projects/${project.id}/files/${meta.id}/${safeName(meta.name)}`);
      if (!data) throw new Error(`Backup is missing file "${meta.name}"`);
      if (data.length !== meta.size) throw new Error(`Size mismatch for "${meta.name}"`);
      files.push({ meta, data });
    }
    out.push({ project, files });
  }
  return out;
}
