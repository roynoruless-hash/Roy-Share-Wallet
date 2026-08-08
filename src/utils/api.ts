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

export function setupFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      let urlStr = '';
      if (typeof input === 'string') {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.href;
      } else if (input && typeof input === 'object' && 'url' in input) {
        urlStr = (input as any).url || '';
      }

      // Only intercept requests destined for admin api endpoints
      if (urlStr && urlStr.includes('/api/admin/')) {
        const token = getAdminToken();
        if (token) {
          init = init || {};
          const headers = new Headers(init.headers || {});
          if (!headers.has('x-admin-session-token')) {
            headers.set('x-admin-session-token', token);
          }
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          init.headers = headers;
        }
      }

      const response = await originalFetch(input, init);

      // Dispatch expired event if receiving 401 on admin endpoints, except the status check itself
      if (response.status === 401 && urlStr && urlStr.includes('/api/admin/') && !urlStr.includes('/api/admin/status')) {
        console.warn(`[API Interceptor] Received 401 on admin API ${urlStr}. Triggering logout.`);
        window.dispatchEvent(new CustomEvent('admin-session-expired'));
      }
      return response;
    } catch (error) {
      // If our interceptor logic fails or the fetch fails, make sure we fall back to originalFetch
      // so we don't break the application's ability to fetch.
      if (error instanceof TypeError && error.message.includes('failed to fetch')) {
        // This is a normal network/CORS error from fetch itself, rethrow it
        throw error;
      }
      // If it's an unexpected exception from our interceptor logic, log it and fallback to original fetch
      console.error('[API Interceptor Error]', error);
      return originalFetch(input, init);
    }
  };
}

