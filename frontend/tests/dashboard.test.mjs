import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const actor = (id, ...roles) => ({ id, roles });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const job = id => ({ id, clientId: 2, status: 'OPEN', createdAt: '2026-11-01T00:00:00Z' });
const proposal = (id, jobId = 1) => ({ id, jobId, clientId: 2, freelancerId: 3, status: id % 2 ? 'PENDING' : 'ACCEPTED', submittedAt: '2026-11-02T00:00:00Z' });
const assignment = id => ({ id, clientId: 2, freelancerId: 3, status: id % 2 ? 'ACTIVE' : 'COMPLETED', createdAt: '2026-10-01T00:00:00Z', completedAt: '2026-11-03T00:00:00Z' });
function paged(items, c) { const page = Number(c.url.searchParams.get('page')), size = Number(c.url.searchParams.get('size')); return { content: items.slice(page * size, (page + 1) * size), page, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) }; }
async function harness(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), 'linkit-dashboard-'));
  t.after(() => { if (dirname(resolve(folder)) !== resolve(tmpdir()) || !basename(folder).startsWith('linkit-dashboard-')) throw Error('Unsafe test directory'); rmSync(folder, { recursive: true }); });
  for (const file of ['api/http', 'api/jobs', 'api/recruitment', 'features/dashboard/model']) {
    const source = readFileSync(join(root, 'src', `${file}.ts`), 'utf8').replace('import.meta.env?.VITE_API_BASE_URL', '"https://api.linkit.test"');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/from (["'])(\.\.?\/[^"']+)\1/g, (_, q, path) => `from ${q}${path}.mjs${q}`);
    const output = join(folder, `${file}.mjs`); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, compiled);
  }
  const old = globalThis.fetch, calls = [];
  globalThis.fetch = async (address, options) => { const call = { url: new URL(address), options }; calls.push(call); return respond ? respond(call) : json(paged([], call)); };
  t.after(() => { globalThis.fetch = old; });
  const http = await import(pathToFileURL(join(folder, 'api/http.mjs')).href); http.configureApiTokenProvider(() => 'test-access');
  return { ...await import(pathToFileURL(join(folder, 'features/dashboard/model.mjs')).href), calls };
}
test('Presentation distinguishes loading/error/unsupported/empty and uses totalElements for totals', async t => {
  const h = await harness(t); assert.equal(h.metric({ state: 'loading' }), 'Đang tải…'); assert.equal(h.metric({ state: 'unsupported' }), 'Chưa có dữ liệu thống kê');
  assert.notEqual(h.metric({ state: 'error', message: 'Offline' }), '0'); assert.equal(h.rows({ state: 'error', message: 'Offline' }), null);
  assert.equal(h.metric({ state: 'empty', items: [], total: 0 }), '0'); assert.equal(h.metric({ state: 'ready', items: [job(1)], total: 205 }), '205');
  assert.equal(h.initialDashboard('Admin').proposals.state, 'unsupported'); assert.equal(h.initialDashboard('Client').jobs.state, 'loading');
});
test('collectAll loads every page and rejects inconsistent or incomplete metadata', async t => {
  const h = await harness(t); const items = [job(1), job(2), job(3)]; let calls = 0;
  const result = await h.collectAll(async (page, size) => { calls++; return { content: items.slice(page * size, (page + 1) * size), page, size, totalElements: 3, totalPages: 2 }; }, 2);
  assert.equal(calls, 2); assert.equal(result.total, 3); assert.equal(result.items.length, 3);
  await assert.rejects(h.collectAll(async (page, size) => ({ content: [], page, size, totalElements: 5, totalPages: 1 })), /đủ/);
  await assert.rejects(h.collectAll(async (page, size) => ({ content: [job(1), job(1)], page, size, totalElements: 2, totalPages: 1 })), /trùng/);
  await assert.rejects(h.collectAll(async (page, size) => ({ content: [job(page + 1)], page, size, totalElements: page ? 3 : 2, totalPages: page ? 3 : 2 }), 1), /thay đổi/);
});
test('CLIENT uses mine=true and sums complete Proposal totals across all owned Jobs', async t => {
  const proposals = Array.from({ length: 205 }, (_, i) => proposal(i + 1, 1)); const second = [proposal(900, 2), proposal(901, 2)];
  const h = await harness(t, c => json(paged(c.url.pathname === '/api/jobs' ? [job(1), job(2)] : c.url.pathname === '/api/assignments' ? [assignment(1)] : c.url.pathname === '/api/jobs/1/proposals' ? proposals : second, c)));
  const data = await h.loadDashboard(actor(2, 'CLIENT'), 'Client');
  assert.equal(data.jobs.total, 2); assert.equal(data.proposals.total, 207); assert.equal(data.proposals.items.length, 207); assert.equal(data.assignments.total, 1);
  assert.equal(h.calls.find(c => c.url.pathname === '/api/jobs').url.searchParams.get('mine'), 'true');
  assert.equal(h.calls.filter(c => c.url.pathname === '/api/jobs/1/proposals').length, 3); assert.equal(h.calls.some(c => c.url.pathname === '/api/proposals/me'), false);
});
test('FREELANCER reads /me and all Assignment pages without deriving global Job counts', async t => {
  const p = Array.from({ length: 105 }, (_, i) => proposal(i + 1)), a = Array.from({ length: 101 }, (_, i) => assignment(i + 1));
  const h = await harness(t, c => json(paged(c.url.pathname === '/api/proposals/me' ? p : a, c)));
  const data = await h.loadDashboard(actor(3, 'FREELANCER'), 'Freelancer');
  assert.equal(data.proposals.total, 105); assert.equal(data.assignments.total, 101); assert.equal(data.jobs.state, 'unsupported');
  assert.equal(h.calls.length, 4); assert.equal(h.calls.some(c => c.url.pathname === '/api/jobs'), false);
});
test('ADMIN reads only the permitted global Job catalog and never invents user/Proposal totals', async t => {
  const h = await harness(t, c => json(paged([job(1), job(2)], c))); const data = await h.loadDashboard(actor(9, 'ADMIN'), 'Admin');
  assert.equal(data.jobs.total, 2); assert.equal(data.proposals.state, 'unsupported'); assert.equal(data.assignments.state, 'unsupported');
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].url.pathname, '/api/jobs'); assert.equal(h.calls[0].url.searchParams.has('mine'), false);
});
test('Role validation and foreign DTO ownership fail closed', async t => {
  const h = await harness(t, c => json(paged([{ ...job(1), clientId: 88 }], c)));
  await assert.rejects(h.loadDashboard(actor(3, 'FREELANCER'), 'Admin'), /quyền/); assert.equal(h.calls.length, 0);
  const data = await h.loadDashboard(actor(2, 'CLIENT'), 'Client'); assert.equal(data.jobs.state, 'error'); assert.equal(data.proposals.state, 'error');
  assert.equal(h.rows(data.jobs), null); assert.equal(h.calls.some(c => c.url.pathname.endsWith('/proposals')), false);
});
test('Dual-role Assignment unions are filtered only after loading the full authorized set', async t => {
  const items = [{ ...assignment(1), clientId: 2, freelancerId: 8 }, { ...assignment(2), clientId: 9, freelancerId: 2 }];
  const h = await harness(t, c => json(paged(c.url.pathname === '/api/assignments' ? items : [], c)));
  const data = await h.loadDashboard(actor(2, 'CLIENT', 'FREELANCER'), 'Client'); assert.equal(data.assignments.total, 1); assert.equal(data.assignments.items[0].id, 1);
});
test('Proposal fan-out has at most four concurrent requests and does not omit jobs', async t => {
  let active = 0, peak = 0; const jobs = Array.from({ length: 9 }, (_, i) => job(i + 1));
  const h = await harness(t, async c => {
    if (c.url.pathname === '/api/jobs') return json(paged(jobs, c));
    if (c.url.pathname === '/api/assignments') return json(paged([], c));
    active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5)); active--;
    const id = Number(c.url.pathname.split('/')[3]); return json(paged([proposal(id, id)], c));
  });
  const data = await h.loadDashboard(actor(2, 'CLIENT'), 'Client'); assert.equal(peak, 4); assert.equal(data.proposals.total, 9); assert.equal(h.calls.length, 11);
});
test('Large workloads report a limit error rather than partial Proposal counts', async t => {
  const jobs = Array.from({ length: 102 }, (_, i) => job(i + 1));
  const h = await harness(t, c => json(paged(c.url.pathname === '/api/jobs' ? jobs : [], c)));
  const data = await h.loadDashboard(actor(2, 'CLIENT'), 'Client'); assert.equal(data.jobs.total, 102); assert.equal(data.proposals.state, 'error'); assert.match(data.proposals.message, /60 request/); assert.equal(h.calls.length, 3);
  await assert.rejects(h.collectAll(async (page, size) => ({ content: [], page, size, totalElements: 2100, totalPages: 21 })), /Quá nhiều trang/);
});
test('StrictMode/concurrent consumers share one flight but settled data is not cached across visits', async t => {
  const h = await harness(t, async c => { await new Promise(resolve => setTimeout(resolve, 2)); return json(paged([], c)); });
  const one = h.loadDashboard(actor(3, 'FREELANCER'), 'Freelancer', 1), two = h.loadDashboard(actor(3, 'FREELANCER'), 'Freelancer', 1);
  assert.equal(one, two); await one; assert.equal(h.calls.length, 2); await h.loadDashboard(actor(3, 'FREELANCER'), 'Freelancer', 2); assert.equal(h.calls.length, 4);
});
test('Backend enum mapping retains every real state without confusing ACTIVE and IN_PROGRESS', async t => {
  const h = await harness(t); assert.deepEqual(Object.keys(h.assignmentLabels), ['PENDING_SCOPE', 'ACTIVE', 'AWAITING_ACCEPTANCE', 'COMPLETED', 'CANCELLED']);
  assert.equal(h.jobLabels.IN_PROGRESS, 'Đang thực hiện'); assert.equal(h.assignmentLabels.ACTIVE, 'Đang thực hiện'); assert.equal(h.proposalLabels.WITHDRAWN, 'Đã rút');
});
test('Monthly series uses real UTC year/month and never moves old events into the current month', async t => {
  const h = await harness(t), now = new Date('2026-11-15T12:00:00Z');
  const result = h.monthly(['2026-06-01T00:00:00Z', '2026-11-01T00:30:00+07:00', '2025-11-01T00:00:00Z'], x => x, now);
  assert.equal(result.months[0].label, 'T6/2026'); assert.deepEqual(result.months.map(m => m.count), [1, 0, 0, 0, 1, 0]);
  const old = h.monthly(['2025-11-01T00:00:00Z'], x => x, now); assert.equal(old.state, 'empty'); assert.equal(old.months[5].count, 0);
});
test('Missing/invalid completion timestamps yield unsupported chart, never fallback to startDate or now', async t => {
  const h = await harness(t); for (const stamp of [null, '', 'invalid']) { const series = h.monthly([{ completedAt: stamp, startedAt: '2026-11-01' }], x => x.completedAt); assert.equal(series.state, 'unsupported'); assert.deepEqual(series.months, []); }
  assert.equal(h.monthly([], x => x).state, 'empty');
});
test('API failures remain explicit per-resource errors, with no 0/mock fallback or request retry', async t => {
  for (const status of [401, 403, 422, 500]) {
    const h = await harness(t, () => json({ message: 'Actual backend error' }, status)); const data = await h.loadDashboard(actor(9, 'ADMIN'), 'Admin');
    assert.equal(data.jobs.state, 'error'); assert.equal(data.jobs.message, 'Actual backend error'); assert.equal(h.calls.length, 1); assert.notEqual(h.metric(data.jobs), '0');
  }
  const h = await harness(t, () => { throw new TypeError('offline'); }); const data = await h.loadDashboard(actor(3, 'FREELANCER'), 'Freelancer'); assert.equal(data.assignments.state, 'error'); assert.equal(data.proposals.state, 'error'); assert.equal(h.calls.length, 2);
});
test('A failed Job Proposal request never turns a partial sum into a successful total', async t => {
  const h = await harness(t, c => c.url.pathname === '/api/jobs/2/proposals' ? json({ message: 'Forbidden' }, 403) : json(paged(c.url.pathname === '/api/jobs' ? [job(1), job(2)] : c.url.pathname === '/api/jobs/1/proposals' ? [proposal(1)] : [], c)));
  const data = await h.loadDashboard(actor(2, 'CLIENT'), 'Client'); assert.equal(data.jobs.total, 2); assert.equal(data.proposals.state, 'error'); assert.equal(h.rows(data.proposals), null);
});
