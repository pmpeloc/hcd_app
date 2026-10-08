import { test, expect } from '@playwright/test';
import { createApiClient } from '../lib/api-client';

function setup() {
  let token: string | undefined = 'first-token';
  let response = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  const requests: { url: string; init: RequestInit }[] = [];
  const client = createApiClient({
    baseUrl: 'https://api.example.test', getAccessToken: async () => token,
    fetcher: async (url, init) => { requests.push({ url: String(url), init: init! }); return response(); },
  });
  return { client, requests, setToken: (value?: string) => { token = value; },
    respond: (factory: () => Response) => { response = factory; } };
}

test('reads a fresh token for each request and overrides caller authorization', async () => {
  const s = setup();
  await s.client('/tx/build', { method: 'POST', body: '{}', headers: new Headers({ Authorization: 'Bearer stale', 'X-Request-Id': 'synthetic' }) });
  s.setToken('refreshed-token');
  await s.client('/tx/submit', { method: 'POST', body: '{}' });
  const first = new Headers(s.requests[0].init.headers);
  expect(first.get('Authorization')).toBe('Bearer first-token');
  expect(first.get('X-Request-Id')).toBe('synthetic');
  expect(first.get('Content-Type')).toBe('application/json');
  expect(new Headers(s.requests[1].init.headers).get('Authorization')).toBe('Bearer refreshed-token');
  expect(s.requests[0].init).toMatchObject({ redirect: 'error', cache: 'no-store', credentials: 'omit' });
});

test('does not call the API after logout', async () => {
  const s = setup(); s.setToken(undefined);
  await expect(s.client('/records')).rejects.toMatchObject({ status: 401 });
  expect(s.requests).toHaveLength(0);
});

for (const path of ['https://external.test/upload', '//external.test/upload', '/\\external.test', '/records\n']) {
  test(`rejects non-API URL ${JSON.stringify(path)}`, async () => {
    const s = setup();
    await expect(s.client(path)).rejects.toMatchObject({ status: 0 });
    expect(s.requests).toHaveLength(0);
  });
}

for (const status of [401, 403, 410, 422, 429, 500]) {
  test(`preserves HTTP ${status} without exposing provider messages or retrying`, async () => {
    const s = setup();
    s.respond(() => new Response(JSON.stringify({ message: 'internal secret', code: 'InvalidContentHash' }), { status }));
    await expect(s.client('/tx/submit', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status, code: 'InvalidContentHash' });
    expect(s.requests).toHaveLength(1);
  });
}

test('handles empty success and non-JSON errors', async () => {
  const s = setup(); s.respond(() => new Response(null, { status: 204 }));
  await expect(s.client('/records')).resolves.toBeUndefined();
  s.respond(() => new Response('<html>private error</html>', { status: 502 }));
  await expect(s.client('/records')).rejects.toMatchObject({ status: 502, message: 'The request could not be completed.' });
});

test('fails closed when session retrieval fails', async () => {
  let called = false;
  const client = createApiClient({ baseUrl: 'https://api.example.test',
    getAccessToken: async () => { throw new Error('private auth details'); },
    fetcher: async () => { called = true; return new Response(); } });
  await expect(client('/records')).rejects.toMatchObject({ status: 503 });
  expect(called).toBe(false);
});

