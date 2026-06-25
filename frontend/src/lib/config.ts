export const API_BASE: string = 'https://backend-production-f446.up.railway.app/api';
const BACKEND_ORIGIN = 'https://backend-production-f446.up.railway.app';

export function resolveImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`;
  return url;
}
