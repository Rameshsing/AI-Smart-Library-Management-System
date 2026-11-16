/**
 * Centralized API base URL resolution for the full-stack application.
 *
 * When deployed or running under the unified Express + Vite server on port 3000,
 * same-origin requests (`""`) resolve cleanly to `/api/*`. If `VITE_API_BASE_URL`
 * is explicitly set, it is trimmed and used as the API origin.
 */
export function getApiBaseUrl(): string {
  const configured =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/+$/, '')
      : '';
  return configured;
}

export function isBackendConnected(): boolean {
  if (typeof window !== 'undefined') {
    return true;
  }
  return Boolean(getApiBaseUrl());
}
