/**
 * Extract evenly spaced frames from a video at its native resolution (lossless PNG).
 * Used to turn a walk-around video into multiple reference images.
 * Note: video frames are usually less sharp than photos (compression, motion blur).
 */
export async function extractFrames(video: Blob, count: number, onProgress?: (i: number) => void): Promise<{ blob: Blob; w: number; h: number; time: number }[]> {
  const url = URL.createObjectURL(video);
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.src = url;
  try {
    await new Promise<void>((res, rej) => {
      el.onloadedmetadata = () => res();
      el.onerror = () => rej(new Error('video format not supported by this browser'));
      setTimeout(() => rej(new Error('video load timeout')), 20000);
    });
    // Some browsers report Infinity duration for recorded WebM until seeked to the end.
    if (!Number.isFinite(el.duration)) {
      el.currentTime = 1e9;
      await new Promise((r) => (el.onseeked = r));
    }
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1;
    const w = el.videoWidth;
    const h = el.videoHeight;
    if (!w || !h) throw new Error('video has no picture');
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const out: { blob: Blob; w: number; h: number; time: number }[] = [];
    for (let i = 0; i < count; i++) {
      const time = ((i + 0.5) * dur) / count;
      el.currentTime = time;
      await new Promise<void>((res, rej) => {
        el.onseeked = () => res();
        setTimeout(() => rej(new Error('seek timeout')), 10000);
      });
      ctx.drawImage(el, 0, 0, w, h);
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));
      out.push({ blob, w, h, time });
      onProgress?.(i + 1);
    }
    return out;
  } finally {
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
  }
}
