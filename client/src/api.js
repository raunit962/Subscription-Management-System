const API_BASE = '/api';

/**
 * Core fetch wrapper.
 * - Attaches Authorization: Bearer <token> from localStorage
 * - Parses JSON response
 * - Throws on non-2xx with the server's { error } message
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Stage 2 pages pass '/api/...' while Stage 1 pages pass '/...' — accept both
  const url = path.startsWith(`${API_BASE}/`) ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return null;

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return body;
}

export const api = {
  get:    (path)        => apiFetch(path),
  post:   (path, data)  => apiFetch(path, { method: 'POST',   body: JSON.stringify(data) }),
  put:    (path, data)  => apiFetch(path, { method: 'PUT',    body: JSON.stringify(data) }),
  patch:  (path, data)  => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(data) }),
  delete: (path)        => apiFetch(path, { method: 'DELETE' }),
};

export default api;
