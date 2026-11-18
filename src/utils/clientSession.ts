import { getApiBaseUrl } from './apiConfig';

export const CLIENT_SESSION_TOKEN_KEY = 'ai_smart_library_session_token';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStores(): { session: StorageLike | null; local: StorageLike | null } {
  if (typeof window === 'undefined') {
    return { session: null, local: null };
  }
  let session: StorageLike | null = null;
  let local: StorageLike | null = null;
  try {
    session = window.sessionStorage;
  } catch {
    session = null;
  }
  try {
    local = window.localStorage;
  } catch {
    local = null;
  }
  return { session, local };
}

let inMemorySessionToken: string | null = null;

export function saveClientSessionToken(
  token: string,
  rememberMe: boolean = false,
  stores = getDefaultStores()
): void {
  const clean = token.trim();
  if (!clean) return;
  inMemorySessionToken = clean;
  try {
    if (rememberMe) {
      stores.local?.setItem(CLIENT_SESSION_TOKEN_KEY, clean);
      stores.session?.removeItem(CLIENT_SESSION_TOKEN_KEY);
    } else {
      stores.session?.setItem(CLIENT_SESSION_TOKEN_KEY, clean);
      stores.local?.removeItem(CLIENT_SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota or private browsing errors; in-memory fallback remains active
  }
}

export function getClientSessionToken(stores = getDefaultStores()): string | null {
  try {
    const fromSession = stores.session?.getItem(CLIENT_SESSION_TOKEN_KEY);
    if (fromSession) {
      inMemorySessionToken = fromSession;
      return fromSession;
    }
    const fromLocal = stores.local?.getItem(CLIENT_SESSION_TOKEN_KEY);
    if (fromLocal) {
      inMemorySessionToken = fromLocal;
      return fromLocal;
    }
  } catch {
    // Ignore storage access errors and fall back to in-memory token
  }
  return inMemorySessionToken;
}

export function clearClientSessionToken(stores = getDefaultStores()): void {
  inMemorySessionToken = null;
  try {
    stores.session?.removeItem(CLIENT_SESSION_TOKEN_KEY);
    stores.local?.removeItem(CLIENT_SESSION_TOKEN_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export function isApiRequestUrl(
  rawUrl: string,
  currentOrigin: string = typeof window !== 'undefined' ? window.location.origin : '',
  configuredApiBase: string = getApiBaseUrl()
): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/api/') || trimmed === '/api') {
    return true;
  }
  if (configuredApiBase && trimmed.startsWith(`${configuredApiBase}/api/`)) {
    return true;
  }
  if (currentOrigin) {
    try {
      const parsed = new URL(trimmed, currentOrigin);
      return parsed.origin === currentOrigin && parsed.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  }
  return false;
}

function getRequestUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function buildApiRequestInit(
  input: RequestInfo | URL,
  init?: RequestInit,
  token: string | null = getClientSessionToken()
): { init: RequestInit | undefined; isLogout: boolean; isLogin: boolean } {
  const urlStr = getRequestUrlString(input);
  if (!isApiRequestUrl(urlStr)) {
    return { init, isLogout: false, isLogin: false };
  }

  const isLogout = urlStr.includes('/api/auth/logout');
  const isLogin = urlStr.includes('/api/auth/login');

  if (!token || isLogin) {
    return { init, isLogout, isLogin };
  }

  const headers = new Headers(
    init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined)
  );
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return {
    init: {
      ...init,
      credentials: init?.credentials ?? 'include',
      headers,
    },
    isLogout,
    isLogin,
  };
}

const installedTargets = new WeakSet<object>();
let nativeFetchRef: typeof fetch | null = null;

function getNativeFetch(): typeof fetch {
  if (nativeFetchRef) return nativeFetchRef;
  return globalThis.fetch.bind(globalThis);
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const fetchFn = getNativeFetch();
  const { init: nextInit, isLogout, isLogin } = buildApiRequestInit(input, init);
  const response = await fetchFn(input, nextInit);

  if (isLogout || (response.status === 401 && !isLogin && isApiRequestUrl(getRequestUrlString(input)))) {
    clearClientSessionToken();
  }

  return response;
}

export function installApiAuthInterceptor(
  target: { fetch?: typeof fetch } = typeof window !== 'undefined' ? window : globalThis
): boolean {
  if (!target || typeof target !== 'object') return false;
  if (installedTargets.has(target)) return true;
  if (typeof target.fetch !== 'function') return false;

  const baseFetch = target.fetch.bind(target);
  if (target === (typeof window !== 'undefined' ? window : globalThis)) {
    nativeFetchRef = baseFetch;
  }

  const wrappedFetch: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const { init: nextInit, isLogout, isLogin } = buildApiRequestInit(input, init);
    const response = await baseFetch(input, nextInit);
    if (isLogout || (response.status === 401 && !isLogin && isApiRequestUrl(getRequestUrlString(input)))) {
      clearClientSessionToken();
    }
    return response;
  };

  try {
    const ownDesc = Object.getOwnPropertyDescriptor(target, 'fetch');
    if (ownDesc && ownDesc.configurable === false && !ownDesc.writable && !ownDesc.set) {
      installedTargets.add(target);
      return false;
    }
    Object.defineProperty(target, 'fetch', {
      value: wrappedFetch,
      configurable: true,
      writable: true,
    });
    installedTargets.add(target);
    return true;
  } catch {
    // Window.fetch may be non-configurable / getter-only in embedded preview runtimes;
    // components using apiFetch() will still attach Authorization headers cleanly.
    installedTargets.add(target);
    return false;
  }
}
