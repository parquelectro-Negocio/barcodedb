const PROD_API = 'https://backend-production-f446.up.railway.app';
export const API_BASE: string = (import.meta as any).env?.VITE_API_URL ?? `${PROD_API}/api`;
const BACKEND_ORIGIN = PROD_API;

export function resolveImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return url;
}
