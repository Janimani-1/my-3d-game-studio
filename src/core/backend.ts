/**
 * Client for the optional image-to-3D backend (see /backend). API contract v1:
 *   GET  /health                 → { status: "ok", model, device, version }
 *   POST /v1/jobs  (multipart)   → { id }           fields: image (file), remove_bg, mc_resolution, foreground_ratio
 *   GET  /v1/jobs/{id}           → { id, status: queued|running|done|failed, progress 0..1, error? }
 *   GET  /v1/jobs/{id}/result    → model/gltf-binary
 * Optional header: Authorization: Bearer <token>
 */

export interface BackendConfig {
  url: string;
  token: string;
}

export interface Health {
  status: string;
  model: string;
  device: string;
  version: string;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  error?: string;
}

const KEY = 'm3gs.backend';

export function loadBackendConfig(): BackendConfig {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { url: String(v.url ?? ''), token: String(v.token ?? '') };
  } catch {
    return { url: '', token: '' };
  }
}

export function saveBackendConfig(c: BackendConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
}

/** Validate and normalise a backend URL. HTTPS is required except for localhost. */
export function normaliseUrl(raw: string): string {
  const s = raw.trim().replace(/\/+$/, '');
  if (!s) throw new Error('empty URL');
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error('invalid URL');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new Error('HTTPS required (http only for localhost)');
  return u.origin + u.pathname.replace(/\/+$/, '');
}

function headers(c: BackendConfig): HeadersInit {
  return c.token ? { Authorization: `Bearer ${c.token}` } : {};
}

async function req(c: BackendConfig, path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(normaliseUrl(c.url) + path, { ...init, headers: { ...headers(c), ...(init.headers ?? {}) }, signal: ctl.signal, mode: 'cors' });
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try {
        const j = await r.json();
        if (j?.detail) msg += `: ${typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)}`;
      } catch {
        /* not JSON */
      }
      throw new Error(msg);
    }
    return r;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('timeout');
    if (e instanceof TypeError) throw new Error('network/CORS error – server offline or not reachable');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(c: BackendConfig): Promise<Health> {
  const j = await (await req(c, '/health')).json();
  if (j?.status !== 'ok') throw new Error('unexpected health response');
  return { status: j.status, model: String(j.model ?? '?'), device: String(j.device ?? '?'), version: String(j.version ?? '?') };
}

export async function submitJob(c: BackendConfig, image: Blob, fileName: string, opts: { removeBg: boolean; resolution: number }): Promise<string> {
  const fd = new FormData();
  fd.append('image', image, fileName);
  fd.append('remove_bg', String(opts.removeBg));
  fd.append('mc_resolution', String(opts.resolution));
  const j = await (await req(c, '/v1/jobs', { method: 'POST', body: fd }, 60000)).json();
  if (!j?.id) throw new Error('no job id');
  return String(j.id);
}

export async function jobStatus(c: BackendConfig, id: string): Promise<JobStatus> {
  const j = await (await req(c, `/v1/jobs/${encodeURIComponent(id)}`)).json();
  return { id, status: j.status, progress: Number(j.progress ?? 0), error: j.error };
}

export async function jobResult(c: BackendConfig, id: string): Promise<Blob> {
  return (await req(c, `/v1/jobs/${encodeURIComponent(id)}/result`, {}, 120000)).blob();
}

/** Submit, poll until done, return the GLB. */
export async function generate(
  c: BackendConfig,
  image: Blob,
  fileName: string,
  opts: { removeBg: boolean; resolution: number },
  onStatus: (s: JobStatus) => void,
  pollMs = 2000,
  maxMs = 15 * 60 * 1000,
): Promise<Blob> {
  const id = await submitJob(c, image, fileName, opts);
  const t0 = Date.now();
  for (;;) {
    const s = await jobStatus(c, id);
    onStatus(s);
    if (s.status === 'done') return jobResult(c, id);
    if (s.status === 'failed') throw new Error(s.error || 'failed');
    if (Date.now() - t0 > maxMs) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
