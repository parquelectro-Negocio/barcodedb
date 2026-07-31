const PROD_API = 'https://backend-production-f446.up.railway.app';
export const API_BASE: string = (import.meta as any).env?.VITE_API_URL ?? `${PROD_API}/api`;
const BACKEND_ORIGIN = PROD_API;

export function resolveImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return url;
}

export async function uploadImage(file: File): Promise<string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/images/upload-token`, { method: 'POST', headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Error al obtener token de subida');
  }

  const { uploadURL } = await res.json();

  const form = new FormData();
  form.append('file', file);

  const uploadRes = await fetch(uploadURL, { method: 'POST', body: form });
  if (!uploadRes.ok) throw new Error('Error al subir la imagen');

  const uploadData: any = await uploadRes.json();
  return uploadData.result.variants[0];
}
