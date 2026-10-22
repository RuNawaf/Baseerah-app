const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { accept: 'application/json', ...(options?.body ? { 'content-type': 'application/json' } : {}) },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Baseerah could not reach its server. Check your connection and try again.', 0);
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // fall through: a non-JSON answer is treated as a server error below
  }

  if (!response.ok) {
    const error = body?.error;
    // Baseerah's API never answers a known route with 404 NOT_FOUND; that comes from a host with no API behind it,
    // such as the front end deployed on its own without VITE_API_URL.
    if (response.status === 404 && (!error || error.code === 'NOT_FOUND')) {
      throw new ApiError('API_UNAVAILABLE', 'Baseerah’s scanning server is not connected to this site yet, so scans cannot run here.', 404);
    }
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Something went wrong on the server. Try again later.',
      response.status,
    );
  }
  return body;
}

export function startScan(url) {
  return request('/api/scans', { method: 'POST', body: JSON.stringify({ url }) });
}

export function getScan(scanId) {
  return request(`/api/scans/${encodeURIComponent(scanId)}`);
}

export function getHealth() {
  return request('/api/health');
}