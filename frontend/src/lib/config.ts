const PROD_API = 'https://backend-production-f446.up.railway.app';
export const API_BASE: string = (import.meta as any).env?.VITE_API_URL ?? `${PROD_API}/api`;
const BACKEND_ORIGIN = PROD_API;

export function resolveImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return url;
}

// Resize + compress before upload so phone photos (2-8MB) become ~200KB —
// faster uploads, far less R2 storage, quick display. Preserves transparency
// for background-removed PNGs; otherwise re-encodes as JPEG.
export async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const outType = hasAlpha ? 'image/png' : 'image/jpeg';
    const blob: Blob | null = await new Promise(r => canvas.toBlob(b => r(b), outType, quality));
    if (!blob || blob.size >= file.size) return file; // never upsize
    const ext = outType === 'image/png' ? 'png' : 'jpg';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: outType });
  } catch {
    return file;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const compressed = await compressImage(file);
  const form = new FormData();
  form.append('file', compressed);

  const res = await fetch(`${API_BASE}/images/upload`, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Error al subir la imagen');
  }
  const data: any = await res.json();
  return data.url;
}
