export function getAdminToken(): string | null {
  try {
    const raw = localStorage.getItem('royshare_admin_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.sessionToken) {
        return parsed.sessionToken;
      }
    }
    const backupToken = localStorage.getItem('adminSessionToken');
    if (backupToken) {
      return backupToken;
    }
  } catch (e) {
    console.error('Error reading admin token', e);
  }
  return null;
}

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('x-admin-session-token', token);
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    console.warn(`[API] Received 401 Unauthorized for ${url}. Dispatching session expired event.`);
    // Dispatch event to trigger logout and redirection
    window.dispatchEvent(new CustomEvent('admin-session-expired'));
  }

  return res;
}

export const apiFetch = authenticatedFetch;

