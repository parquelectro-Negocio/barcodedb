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

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/images/upload`, { method: 'POST', headers, body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Error al subir la imagen');
  }
  const data: any = await res.json();
  return data.url;
}
