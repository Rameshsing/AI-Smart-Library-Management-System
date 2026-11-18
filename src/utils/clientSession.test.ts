import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApiRequestInit,
  clearClientSessionToken,
  CLIENT_SESSION_TOKEN_KEY,
  getClientSessionToken,
  installApiAuthInterceptor,
  isApiRequestUrl,
  saveClientSessionToken,
  type StorageLike,
} from './clientSession';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('clientSession stores token in sessionStorage by default and clears localStorage', () => {
  const session = createMemoryStorage();
  const local = createMemoryStorage();
  local.setItem(CLIENT_SESSION_TOKEN_KEY, 'stale-token');

  saveClientSessionToken('tok-session', false, { session, local });

  assert.equal(getClientSessionToken({ session, local }), 'tok-session');
  assert.equal(session.getItem(CLIENT_SESSION_TOKEN_KEY), 'tok-session');
  assert.equal(local.getItem(CLIENT_SESSION_TOKEN_KEY), null);
});

test('clientSession stores token in localStorage when rememberMe is true and clears cleanly', () => {
  const session = createMemoryStorage();
  const local = createMemoryStorage();
  session.setItem(CLIENT_SESSION_TOKEN_KEY, 'temp-token');

  saveClientSessionToken('tok-remember', true, { session, local });

  assert.equal(getClientSessionToken({ session, local }), 'tok-remember');
  assert.equal(local.getItem(CLIENT_SESSION_TOKEN_KEY), 'tok-remember');
  assert.equal(session.getItem(CLIENT_SESSION_TOKEN_KEY), null);

  clearClientSessionToken({ session, local });
  assert.equal(getClientSessionToken({ session, local }), null);
});

test('isApiRequestUrl restricts Bearer injection to same-origin or configured API routes', () => {
  assert.equal(isApiRequestUrl('/api/student/dashboard', 'https://app.example.com', ''), true);
  assert.equal(
    isApiRequestUrl('https://app.example.com/api/auth/me', 'https://app.example.com', ''),
    true
  );
  assert.equal(
    isApiRequestUrl('https://api.example.com/api/auth/me', 'https://app.example.com', 'https://api.example.com'),
    true
  );
  assert.equal(
    isApiRequestUrl('https://evil.example.net/api/steal', 'https://app.example.com', ''),
    false
  );
  assert.equal(isApiRequestUrl('/src/assets/images/hero.jpg', 'https://app.example.com', ''), false);
});

test('buildApiRequestInit attaches Bearer token for /api requests except login', () => {
  const dash = buildApiRequestInit('/api/student/dashboard', { method: 'GET' }, 'signed-tok');
  assert.equal(new Headers(dash.init?.headers).get('Authorization'), 'Bearer signed-tok');
  assert.equal(dash.init?.credentials, 'include');

  const login = buildApiRequestInit('/api/auth/login', { method: 'POST' }, 'signed-tok');
  assert.equal(new Headers(login.init?.headers).get('Authorization'), null);
});

test('installApiAuthInterceptor does not throw when fetch is getter-only or non-configurable', () => {
  const baseFetch = (async () => new Response('{}')) as typeof fetch;

  const configurableGetterTarget: { fetch?: typeof fetch } = {};
  Object.defineProperty(configurableGetterTarget, 'fetch', {
    get: () => baseFetch,
    configurable: true,
  });
  assert.doesNotThrow(() => installApiAuthInterceptor(configurableGetterTarget));

  const lockedGetterTarget: { fetch?: typeof fetch } = {};
  Object.defineProperty(lockedGetterTarget, 'fetch', {
    get: () => baseFetch,
    configurable: false,
  });
  assert.doesNotThrow(() => installApiAuthInterceptor(lockedGetterTarget));
});

test('clientSession keeps in-memory token fallback when Web Storage throws SecurityError', () => {
  const throwingStore: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('SecurityError');
    },
    removeItem: () => {
      throw new Error('SecurityError');
    },
  };

  saveClientSessionToken('mem-only-token', true, {
    session: throwingStore,
    local: throwingStore,
  });
  assert.equal(
    getClientSessionToken({ session: throwingStore, local: throwingStore }),
    'mem-only-token'
  );
  clearClientSessionToken({ session: throwingStore, local: throwingStore });
  assert.equal(getClientSessionToken({ session: throwingStore, local: throwingStore }), null);
});
