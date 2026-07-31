// Authenticated request headers. Identity is the JWT issued at login/register;
// there is no anonymous identity. Reads are public (no headers needed); writes
// require a logged-in account, so the token is attached when present.
export function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token');
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}
