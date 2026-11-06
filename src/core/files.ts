/** File type classification, size limits and hashing. */

export const MAX_FILE_BYTES = 300 * 1024 * 1024; // hard reject
export const WARN_FILE_BYTES = 50 * 1024 * 1024; // warn: may be slow on phones

export type FileKind = 'glb' | 'gltf' | 'bin' | 'image' | 'zip' | 'unknown';

export function extOf(name: string): string {
  const m = /\.([^./\\]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

export function classify(name: string): FileKind {
  switch (extOf(name)) {
    case 'glb':
      return 'glb';
    case 'gltf':
      return 'gltf';
    case 'bin':
      return 'bin';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'ktx2':
      return 'image';
    case 'zip':
      return 'zip';
    default:
      return 'unknown';
  }
}

export function mimeFor(name: string): string {
  switch (extOf(name)) {
    case 'glb':
      return 'model/gltf-binary';
    case 'gltf':
      return 'model/gltf+json';
    case 'bin':
      return 'application/octet-stream';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'ktx2':
      return 'image/ktx2';
    case 'zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
}

export interface SizeCheck {
  ok: boolean;
  warn: boolean;
}

export function checkSize(bytes: number): SizeCheck {
  return { ok: bytes > 0 && bytes <= MAX_FILE_BYTES, warn: bytes > WARN_FILE_BYTES };
}

/** Pick the main model file from a multi-file selection. */
export function pickMainFile(names: string[]): string | null {
  return names.find((n) => classify(n) === 'glb') ?? names.find((n) => classify(n) === 'gltf') ?? null;
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  const h = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatBytes(n: number, locale = 'en'): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(v)} ${units[i]}`;
}

/** Make a file name safe for ZIP paths (no directories, no traversal). */
export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, '_').replace(/^\.+/, '_') || 'file';
}
