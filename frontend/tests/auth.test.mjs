import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const user = { id: 7, email: 'client@linkit.test', fullName: 'LinkIT Client', phoneNumber: null, avatarUrl: null, status: 'ACTIVE', roles: ['CLIENT'] };
const pair = (suffix = '1') => ({ accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}`, tokenType: 'Bearer', expiresIn: 900, refreshExpiresAt: '2099-01-01T00:00:00Z', user });
const json = (value, status = 200, headers = {}) => new Response(status === 204 ? null : JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
class Storage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
async function harness(t, respond = () => json(user)) {
  const folder = mkdtempSync(join(tmpdir(), 'linkit-auth-'));
  t.after(() => {
    // Only remove this test's freshly allocated directory under the OS temp root.
    if (dirname(resolve(folder)) !== resolve(tmpdir()) || !basename(folder).startsWith('linkit-auth-')) throw new Error('Unexpected test directory');
    rmSync(folder, { recursive: true });
  });
  for (const name of ['api/http', 'auth/session', 'api/auth', 'api/platform']) {
    const source = readFileSync(join(frontend, 'src', `${name}.ts`), 'utf8')
      .replace('import.meta.env?.VITE_API_BASE_URL', '"https://api.linkit.test"');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
      .replace(/from (["'])(\.\.?\/[^"']+)\1/g, (_, quote, path) => `from ${quote}${path}.mjs${quote}`);
    const output = join(folder, `${name}.mjs`); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, compiled);
  }
  const previous = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
  globalThis.localStorage = new Storage(); globalThis.sessionStorage = new Storage();
  const calls = [];
  globalThis.fetch = async (url, options) => { const call = { path: new URL(url).pathname, options }; calls.push(call); return respond(call, calls); };
  t.after(() => Object.assign(globalThis, previous));
  const http = await import(pathToFileURL(join(folder, 'api/http.mjs')).href);
  const session = await import(pathToFileURL(join(folder, 'auth/session.mjs')).href);
  const auth = await import(pathToFileURL(join(folder, 'api/auth.mjs')).href);
  const platform = await import(pathToFileURL(join(folder, 'api/platform.mjs')).href);
  return { http, session, platform, ...auth, calls };
}

test('avatar uses multipart with JWT, surfaces errors, and resolves persisted URL', async t => {
  let fail = false;
  const h = await harness(t, call => call.path.endsWith('/avatar')
    ? fail ? json({ message: 'Ảnh không hợp lệ', code: 'INVALID_AVATAR' }, 422)
      : json({ id: 7, avatarUrl: '/api/avatars/saved.png' })
    : json(user));
  await h.session.establishSession(pair());
  const image = new File(['png'], 'avatar.png', { type: 'image/png' });
  const result = await h.platform.userApi.uploadAvatar(image);
  assert.equal(result.avatarUrl, '/api/avatars/saved.png');
  assert.equal(h.platform.resolveAvatarUrl(result.avatarUrl), 'https://api.linkit.test/api/avatars/saved.png');
  const request = h.calls.at(-1);
  assert.equal(request.path, '/api/users/me/avatar');
  assert.equal(request.options.headers.get('Authorization'), 'Bearer access-1');
  assert.equal(request.options.headers.has('Content-Type'), false);
  assert.equal(request.options.body.get('file'), image);
  fail = true;
  await assert.rejects(h.platform.userApi.uploadAvatar(image), error => error.status === 422);
});

test('avatar 403 cannot be rendered as success toast', async t => {
  const h = await harness(t, call => call.path.endsWith('/avatar')
    ? json({ message: 'Bạn không có quyền truy cập tài nguyên này.', code: 'FORBIDDEN' }, 403)
    : json(user));
  await h.session.establishSession(pair());
  await assert.rejects(h.platform.userApi.uploadAvatar(new File(['x'], 'avatar.png', { type: 'image/png' })), error => error.status === 403);
  const app = readFileSync(join(frontend, 'src/App.tsx'), 'utf8');
  const source = app.match(/function getToastKind\([\s\S]*?(?=function Toast\()/)?.[0];
  assert.ok(source);
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const classify = new Function(`${js}; return getToastKind;`)();
  assert.equal(classify('Không thể lưu ảnh đại diện: Bạn không có quyền truy cập tài nguyên này.'), 'error');
});

test('login uses real response, /me roles, memory access and sessionStorage refresh only', async t => {
  const h = await harness(t, call => call.path.endsWith('/login') ? json({ ...pair(), user: { ...user, roles: ['FREELANCER'] } }) : json(user));
  const result = await h.authApi.login({ email: user.email, password: 'test-password-123' });
  assert.deepEqual(result.roles, ['CLIENT']); assert.equal(h.session.uiRole(result), 'Client');
  assert.equal(h.session.getAccessToken(), 'access-1'); assert.equal(sessionStorage.getItem(h.session.REFRESH_KEY), 'refresh-1');
  assert.equal(localStorage.values.size, 0); assert.deepEqual([...sessionStorage.values.values()], ['refresh-1']);
  assert.equal(h.calls[0].options.headers.has('Authorization'), false);
  assert.equal(h.calls[1].options.headers.get('Authorization'), 'Bearer access-1');
  assert.equal(h.calls[0].options.credentials, 'omit'); assert.ok(h.session.getAccessExpiry() > Date.now());
});

test('register strips unsupported fields and does not perform a second login', async t => {
  const h = await harness(t, call => call.path.endsWith('/register') ? json(pair(), 201) : json(user));
  await h.authApi.register({ email: user.email, password: 'test-password-123', fullName: user.fullName, role: 'CLIENT', phone: 'ignored', confirmPassword: 'ignored' });
  assert.deepEqual(Object.keys(JSON.parse(h.calls[0].options.body)).sort(), ['email', 'fullName', 'password', 'role']);
  assert.deepEqual(h.calls.map(call => call.path), ['/api/auth/register', '/api/auth/me']);
  assert.ok(h.passwordError('short')); assert.ok(h.passwordError('x'.repeat(73))); assert.ok(h.passwordError('ắ'.repeat(25)));
  assert.equal(h.passwordError('x'.repeat(12)), null); assert.equal(h.passwordError('x'.repeat(72)), null);
});

test('restore runs once even under StrictMode and removes the retired local session', async t => {
  const h = await harness(t, call => call.path.endsWith('/refresh') ? json(pair('restored')) : json(user));
  localStorage.setItem('itlink-session', 'retired'); sessionStorage.setItem(h.session.REFRESH_KEY, 'refresh-old');
  await Promise.all([h.session.initializeSession(), h.session.initializeSession()]);
  assert.equal(h.calls.filter(call => call.path.endsWith('/refresh')).length, 1);
  assert.equal(localStorage.getItem('itlink-session'), null); assert.equal(h.session.getSessionSnapshot().status, 'authenticated');
  assert.equal(h.session.getAccessToken(), 'access-restored'); assert.equal(sessionStorage.getItem(h.session.REFRESH_KEY), 'refresh-restored');
});

test('concurrent 401 responses share a single refresh and replay with the rotated access token', async t => {
  let refreshes = 0;
  const h = await harness(t, async call => {
    if (call.path.endsWith('/refresh')) { refreshes++; await new Promise(r => setTimeout(r, 15)); return json(pair('2')); }
    if (call.path.endsWith('/me')) return json(user);
    return call.options.headers.get('Authorization') === 'Bearer access-2' ? json({ ok: true }) : json({ message: 'expired' }, 401);
  });
  await h.session.establishSession(pair());
  const result = await Promise.all(Array.from({ length: 8 }, () => h.http.apiRequest('/api/protected')));
  assert.equal(refreshes, 1); assert.equal(result.length, 8); assert.equal(sessionStorage.getItem(h.session.REFRESH_KEY), 'refresh-2');
});

test('a delayed old 401 reuses the already refreshed token without another rotation', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let refreshes = 0;
  const h = await harness(t, async call => {
    if (call.path.endsWith('/me')) return json(user);
    if (call.path.endsWith('/refresh')) { refreshes++; return json(pair('2')); }
    if (call.options.headers.get('Authorization') === 'Bearer access-2') return json({ ok: true });
    if (call.path.endsWith('/slow')) await gate;
    return json({}, 401);
  });
  await h.session.establishSession(pair()); const slow = h.http.apiRequest('/api/slow');
  await h.http.apiRequest('/api/fast'); release(); await slow; assert.equal(refreshes, 1);
});

test('request retries only once when the server keeps returning 401', async t => {
  let count = 0; let refreshes = 0;
  const h = await harness(t, call => {
    if (call.path.endsWith('/me')) return json(user);
    if (call.path.endsWith('/refresh')) { refreshes++; return json(pair('2')); }
    count++; return json({}, 401);
  });
  await h.session.establishSession(pair());
  await assert.rejects(h.http.apiRequest('/api/protected'), error => error.status === 401);
  assert.equal(count, 2); assert.equal(refreshes, 1); assert.equal(h.session.getAccessToken(), null);
});

test('invalid refresh expires the session, login/refresh never recurse', async t => {
  const h = await harness(t, call => call.path.endsWith('/me') ? json(user) : json({ code: 'UNAUTHORIZED' }, 401));
  await h.session.establishSession(pair());
  await assert.rejects(h.http.apiRequest('/api/protected'), error => error.status === 401);
  assert.equal(h.calls.filter(call => call.path.endsWith('/refresh')).length, 1);
  assert.equal(sessionStorage.getItem(h.session.REFRESH_KEY), null);
  const count = h.calls.length; await assert.rejects(h.authApi.login({ email: user.email, password: 'wrong' }), error => error.status === 401);
  assert.equal(h.calls.length, count + 1);
});

test('403, 409, 412, 422 preserve session and expose actual error fields and headers', async t => {
  let status = 403;
  const h = await harness(t, call => call.path.endsWith('/me') ? json(user) : json({ code: 'VALIDATION_FAILED', message: 'server message', errors: { email: 'invalid' } }, status, { ETag: '"server-version"' }));
  await h.session.establishSession(pair());
  for (const code of [403, 409, 412, 422]) {
    status = code;
    await assert.rejects(h.http.apiRequest('/api/protected'), error => error.status === code && error.code === 'VALIDATION_FAILED' && error.errors.email === 'invalid' && error.headers.get('ETag') === '"server-version"');
    assert.equal(h.session.getSessionSnapshot().status, 'authenticated');
  }
  assert.equal(h.calls.filter(call => call.path.endsWith('/refresh')).length, 0);
});

test('network errors never retry writes or replace data with mocks', async t => {
  let writes = 0;
  const h = await harness(t, call => { if (call.path.endsWith('/me')) return json(user); writes++; throw new TypeError('offline'); });
  await h.session.establishSession(pair());
  await assert.rejects(h.http.apiRequest('/api/protected', { method: 'POST', body: '{}' }), error => error.status === 0);
  assert.equal(writes, 1); assert.equal(h.session.getSessionSnapshot().status, 'authenticated');
});

test('ETag, If-Match and 204 are preserved through metadata transport', async t => {
  const h = await harness(t, () => json(null, 204, { ETag: '"new"', Location: '/api/item/1' }));
  const result = await h.http.apiRequestWithMeta('/api/item/1', { method: 'DELETE', headers: { 'If-Match': '"old"' } });
  assert.equal(result.data, null); assert.equal(result.status, 204); assert.equal(result.etag, '"new"');
  assert.equal(result.headers.get('Location'), '/api/item/1'); assert.equal(h.calls[0].options.headers.get('If-Match'), '"old"');
});

test('logout revokes and clears immediately, including when revocation fails', async t => {
  let fail = false;
  const h = await harness(t, call => {
    if (call.path.endsWith('/me')) return json(user);
    if (fail) throw new TypeError('offline'); return json(null, 204);
  });
  await h.session.establishSession(pair()); assert.equal(await h.authApi.logout(), true);
  assert.equal(h.session.getAccessToken(), null); assert.equal(sessionStorage.values.size, 0);
  await h.session.establishSession(pair('2')); fail = true; assert.equal(await h.authApi.logout(), false);
  assert.equal(h.session.getSessionSnapshot().status, 'anonymous'); assert.equal(sessionStorage.values.size, 0);
});

test('logout during refresh revokes the late new token and cannot resurrect a session', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); const revoked = [];
  const h = await harness(t, async call => {
    if (call.path.endsWith('/me')) return json(user);
    if (call.path.endsWith('/refresh')) { await gate; return json(pair('late')); }
    if (call.path.endsWith('/logout')) { revoked.push(JSON.parse(call.options.body).refreshToken); return json(null, 204); }
    return json({}, 401);
  });
  await h.session.establishSession(pair()); const pending = h.authApi.refresh(); const logout = h.authApi.logout();
  assert.equal(h.session.getAccessToken(), null); assert.equal(sessionStorage.values.size, 0);
  release(); await Promise.all([pending, logout]); assert.deepEqual(revoked.sort(), ['refresh-1', 'refresh-late']);
  assert.equal(h.session.getSessionSnapshot().status, 'anonymous');
});

test('late login after logout is discarded and its issued refresh token revoked', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); let revoked = false;
  const h = await harness(t, async call => {
    if (call.path.endsWith('/login')) { await gate; return json(pair('late')); }
    if (call.path.endsWith('/logout')) { revoked = true; return json(null, 204); }
    return json(user);
  });
  const login = h.authApi.login({ email: user.email, password: 'test-password-123' });
  await h.authApi.logout(); release(); await assert.rejects(login, error => error.status === 401);
  assert.equal(revoked, true); assert.equal(h.session.getAccessToken(), null);
});

test('role guard is fail-closed and follows /me roles rather than local storage', async t => {
  const h = await harness(t);
  assert.equal(h.session.canUseDashboard(null, 'Client'), false);
  assert.equal(h.session.canUseDashboard(user, 'Client'), true);
  assert.equal(h.session.canUseDashboard(user, 'Admin'), false);
  assert.equal(h.session.uiRole({ ...user, roles: [] }), null);
  assert.equal(h.session.uiRole({ ...user, roles: ['ADMIN', 'CLIENT'] }), 'Admin');
});

test('failed restoration preserves refresh on network failure without exposing a protected session', async t => {
  const h = await harness(t, () => { throw new TypeError('offline'); });
  sessionStorage.setItem(h.session.REFRESH_KEY, 'saved'); await h.session.initializeSession();
  assert.equal(h.session.getSessionSnapshot().status, 'error'); assert.equal(h.session.getSessionSnapshot().user, null);
  assert.equal(sessionStorage.getItem(h.session.REFRESH_KEY), 'saved');
});

test('forbidden refresh does not log out an already verified user', async t => {
  const h = await harness(t, call => call.path.endsWith('/me') ? json(user) : json({ code: 'FORBIDDEN', message: 'denied' }, call.path.endsWith('/refresh') ? 403 : 401));
  await h.session.establishSession(pair());
  await assert.rejects(h.http.apiRequest('/api/protected'), error => error.status === 403);
  assert.equal(h.session.getSessionSnapshot().status, 'authenticated');
  assert.equal(sessionStorage.getItem(h.session.REFRESH_KEY), 'refresh-1');
});

test('freelancer registration derives its role from /me', async t => {
  const freelancer = { ...user, roles: ['FREELANCER'] };
  const h = await harness(t, call => call.path.endsWith('/register') ? json({ ...pair(), user: freelancer }, 201) : json(freelancer));
  const result = await h.authApi.register({ email: user.email, password: 'test-password-123', fullName: user.fullName, role: 'FREELANCER' });
  assert.equal(h.session.uiRole(result), 'Freelancer');
  assert.equal(h.session.canUseDashboard(result, 'Client'), false);
  assert.equal(JSON.parse(h.calls[0].options.body).role, 'FREELANCER');
});

test('isolated preview cannot send requests or refresh against the real API', async t => {
  const h = await harness(t);
  const previous = globalThis.window;
  globalThis.window = { location: { pathname: '/preview-v2' } };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  await assert.rejects(h.http.apiRequest('/api/protected'), error => error.status === 0);
  assert.equal(h.calls.length, 0);
});

test('401 during /me verification has no refresh loop', async t => {
  const h = await harness(t, call => call.path.endsWith('/login') ? json(pair()) : json({}, 401));
  await assert.rejects(h.authApi.login({ email: user.email, password: 'test-password-123' }), error => error.status === 401);
  assert.deepEqual(h.calls.map(call => call.path), ['/api/auth/login', '/api/auth/me']); assert.equal(h.session.getAccessToken(), null);
});
