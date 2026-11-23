import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const json = (data, status = 200, headers = {}) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const draft = (version = "v1", status = "DRAFT") => ({
  id: 73,
  clientId: 7,
  companyName: "LinkIT Client",
  title: "Portfolio project",
  description: "Project requirements",
  deliverables: "Source code and documentation",
  acceptanceCriteria: "Tests pass",
  budgetMin: "100.00",
  budgetMax: "1000.00",
  currencyCode: "VND",
  deadline: "2099-12-31",
  status,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  publishedAt: null,
  version,
  skills: [{ skillId: 501, name: "Java", isRequired: true }],
  quality: {
    score: 60,
    rulesVersion: "job-quality-v1",
    breakdown: {},
    recommendations: ["Add detail"],
    evaluatedAt: "2026-01-01T00:00:00Z",
  },
});
async function harness(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), "linkit-jobs-"));
  t.after(() => {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith("linkit-jobs-")
    )
      throw Error("Unsafe test directory");
    rmSync(folder, { recursive: true });
  });
  for (const file of [
    "api/http",
    "api/jobs",
    "api/skills",
    "features/jobs/model",
  ]) {
    const source = readFileSync(
      join(root, "src", `${file}.ts`),
      "utf8",
    ).replace(
      "import.meta.env?.VITE_API_BASE_URL",
      '"https://api.linkit.test"',
    );
    const compiled = ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(
        /from (["'])(\.\.?\/[^"']+)\1/g,
        (_, q, path) => `from ${q}${path}.mjs${q}`,
      );
    const output = join(folder, `${file}.mjs`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, compiled);
  }
  const old = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (address, options) => {
    const call = { url: new URL(address), options };
    calls.push(call);
    return respond
      ? respond(call, calls)
      : json(draft(), 200, { ETag: '"v1"' });
  };
  t.after(() => {
    globalThis.fetch = old;
  });
  const http = await import(pathToFileURL(join(folder, "api/http.mjs")).href);
  http.configureApiTokenProvider(() => "test-access");
  const jobs = await import(pathToFileURL(join(folder, "api/jobs.mjs")).href);
  const skills = await import(
    pathToFileURL(join(folder, "api/skills.mjs")).href
  );
  const model = await import(
    pathToFileURL(join(folder, "features/jobs/model.mjs")).href
  );
  return { ...jobs, ...skills, ...model, calls };
}

test("Job list uses q/skillIds/mine and actual zero-based page response", async (t) => {
  const h = await harness(t, () =>
    json({ content: [], page: 2, size: 10, totalElements: 23, totalPages: 3 }),
  );
  const result = await h.jobApi.search({
    q: "React & SQL",
    skillIds: [501, 902],
    minBudget: "0",
    maxBudget: "99999999999999999.99",
    currency: "VND",
    status: "DRAFT",
    mine: true,
    page: 2,
    size: 10,
  });
  const q = h.calls[0].url.searchParams;
  assert.equal(q.get("q"), "React & SQL");
  assert.equal(q.get("skillIds"), "501,902");
  assert.equal(q.get("mine"), "true");
  assert.equal(q.has("keyword"), false);
  assert.equal(q.get("maxBudget"), "99999999999999999.99");
  assert.equal(result.page, 2);
  assert.equal(result.totalPages, 3);
  await h.jobApi.mine(1, 5);
  assert.equal(h.calls[1].url.pathname, "/api/jobs");
  assert.equal(h.calls[1].url.searchParams.get("mine"), "true");
});
test("detail preserves ETag and exact large money without rewriting user text", async (t) => {
  const note =
    'User text "budgetMin":123 and escaped \\"quotes\\" remains unchanged';
  const raw = JSON.stringify({ ...draft(), description: note }).replace(
    '"budgetMax":"1000.00"',
    '"budgetMax":99999999999999999.99',
  );
  const h = await harness(
    t,
    () => new Response(raw, { headers: { ETag: '"actual-rowversion"' } }),
  );
  const detail = await h.jobApi.detail(73);
  assert.equal(detail.budgetMax, "99999999999999999.99");
  assert.equal(detail.description, note);
  assert.equal(detail.etag, '"actual-rowversion"');
  assert.equal(
    h.money(detail.budgetMax, "VND"),
    "99.999.999.999.999.999,99 VND",
  );
  assert.equal(
    h.calls[0].options.headers.get("Authorization"),
    "Bearer test-access",
  );
});
test("create/update/publish/cancel use the real verbs and current If-Match", async (t) => {
  const h = await harness(t, (call) =>
    call.options.method === "DELETE"
      ? json(null, 204)
      : json(draft(), 200, { ETag: '"version"' }),
  );
  const input = h.jobInput(h.formFromJob({ ...draft(), etag: '"old"' }));
  await h.jobApi.create(input);
  await h.jobApi.update(73, input, '"old"');
  await h.jobApi.publish(73, '"new"');
  await h.jobApi.cancel(73, '"last"');
  assert.deepEqual(
    h.calls.map((c) => [c.options.method, c.url.pathname]),
    [
      ["POST", "/api/jobs"],
      ["PUT", "/api/jobs/73"],
      ["POST", "/api/jobs/73/publish"],
      ["DELETE", "/api/jobs/73"],
    ],
  );
  assert.equal(h.calls[1].options.headers.get("If-Match"), '"old"');
  assert.equal(h.calls[2].options.headers.get("If-Match"), '"new"');
  assert.equal(h.calls[3].options.headers.get("If-Match"), '"last"');
  const body = JSON.parse(h.calls[0].options.body);
  assert.equal(body.budgetMax, "1000.00");
  assert.equal(body.skills[0].skillId, 501);
  assert.equal("budget" in body, false);
  assert.equal("clientId" in body, false);
  assert.equal("status" in body, false);
});
test("publish failure retains saved draft and retry never creates a second Job", async (t) => {
  let creates = 0,
    publishes = 0,
    current = null;
  const h = await harness(t, (call) => {
    if (call.url.pathname === "/api/jobs") {
      creates++;
      return json(draft("v1"), 201, { ETag: '"v1"' });
    }
    if (call.options.method === "PUT")
      return json(draft("v2"), 200, { ETag: '"v2"' });
    publishes++;
    return publishes === 1
      ? json(
          { code: "JOB_QUALITY", message: "Below threshold", errors: {} },
          422,
        )
      : json(
          {
            ...draft("v3", "OPEN"),
            quality: { ...draft().quality, score: 80 },
          },
          200,
          { ETag: '"v3"' },
        );
  });
  const form = h.formFromJob({ ...draft(), etag: '"v0"' });
  await assert.rejects(
    h.saveJob(form, null, true, (saved) => {
      current = saved;
    }),
    (e) => e.status === 422,
  );
  assert.equal(current.id, 73);
  assert.equal(current.status, "DRAFT");
  assert.equal(current.quality.score, 60);
  const result = await h.saveJob(form, current, true, (saved) => {
    current = saved;
  });
  assert.equal(result.status, "OPEN");
  assert.equal(result.quality.score, 80);
  assert.equal(creates, 1);
  assert.equal(publishes, 2);
  assert.equal(h.calls[3].options.headers.get("If-Match"), '"v2"');
});
test("draft save does not publish or invent missing title/skills/required budget", async (t) => {
  const h = await harness(t);
  const empty = h.emptyJobForm();
  assert.throws(() => h.jobInput(empty));
  assert.equal(h.calls.length, 0);
  assert.equal(empty.budgetMin, "");
  assert.equal(empty.skills.length, 0);
  const form = {
    ...empty,
    budgetMin: "0",
    budgetMax: "0",
    currencyCode: "VND",
    deadline: "2020-01-01",
  };
  const input = h.jobInput(form);
  assert.equal(input.title, "");
  assert.equal(input.deliverables, "");
  assert.deepEqual(input.skills, []);
  await h.saveJob(form, null, false, () => {});
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url.pathname, "/api/jobs");
});
test("form validation covers real precision, ranges, duplicate skills, required flags and dates", async (t) => {
  const h = await harness(t);
  const base = h.formFromJob({ ...draft(), etag: '"v1"' });
  assert.equal(h.cents("99999999999999999.99"), 9999999999999999999n);
  for (const patch of [
    { budgetMin: "1001" },
    { budgetMax: "-1" },
    { budgetMax: "1.001" },
    { budgetMax: "100000000000000000" },
    { currencyCode: "" },
    { deadline: "2026-02-30" },
    { title: "x".repeat(201) },
    { deliverables: "x".repeat(20001) },
  ])
    assert.throws(() => h.jobInput({ ...base, ...patch }));
  for (const patch of [
    { skillId: 0 },
    { skillId: -1 },
    { skillId: 1.5 },
    { skillId: Number.MAX_SAFE_INTEGER + 1 },
    { isRequired: "" },
  ])
    assert.throws(() =>
      h.jobInput({ ...base, skills: [{ ...base.skills[0], ...patch }] }),
    );
  assert.throws(() =>
    h.jobInput({ ...base, skills: [...base.skills, ...base.skills] }),
  );
});
test("Skill picker uses catalog IDs, retains choices across pages and defaults new skills to optional", async (t) => {
  const h = await harness(t);
  let selected = h.chooseSkill([], [{ id: 501, name: "Java" }], 501);
  selected = h.chooseSkill(selected, [{ id: 902, name: "React" }], 902);
  assert.deepEqual(
    selected.map((s) => s.skillId),
    [501, 902],
  );
  assert.equal(selected[0].name, "Java");
  assert.deepEqual(selected, [
    { skillId: 501, name: "Java", isRequired: "false" },
    { skillId: 902, name: "React", isRequired: "false" },
  ]);
  const input = h.jobInput({
    ...h.formFromJob({ ...draft(), etag: '"v1"' }),
    skills: selected,
  });
  assert.deepEqual(input.skills, [
    { skillId: 501, isRequired: false },
    { skillId: 902, isRequired: false },
  ]);
  assert.equal(
    h.chooseSkill(selected, [{ id: 501, name: "Java" }], 501),
    selected,
  );
  assert.throws(() => h.chooseSkill(selected, [{ id: 902, name: "React" }], 1));
});
test("Skill catalog searches and pages using backend response, without mutation routes", async (t) => {
  const h = await harness(t, () =>
    json({
      content: [{ id: 902, name: "React", category: "Web" }],
      page: 1,
      size: 10,
      totalElements: 11,
      totalPages: 2,
    }),
  );
  const result = await h.skillsApi.list("Web & UI", 1, 10);
  assert.equal(h.calls[0].url.pathname, "/api/skills");
  assert.equal(h.calls[0].url.searchParams.get("q"), "Web & UI");
  assert.equal(result.page, 1);
  assert.equal(result.content[0].id, 902);
  assert.deepEqual(Object.keys(h.skillsApi), ["list"]);
});
test("409 keeps original ID/version and typed content; no automatic overwrite/retry", async (t) => {
  const h = await harness(t, () =>
    json({ message: "stale", code: "JOB_CONFLICT", errors: {} }, 409),
  );
  const current = { ...draft(), etag: '"old"' };
  const form = h.formFromJob(current);
  form.title = "Unsaved user edits";
  let saved = false;
  await assert.rejects(
    h.saveJob(form, current, false, () => {
      saved = true;
    }),
    (e) => e.status === 409,
  );
  assert.equal(h.calls.length, 1);
  assert.equal(saved, false);
  assert.equal(current.etag, '"old"');
  assert.equal(form.title, "Unsaved user edits");
});
test("network failures do not retry creates or substitute fixtures; 403/422 are surfaced", async (t) => {
  const h = await harness(t, () => {
    throw new TypeError("offline");
  });
  const input = h.jobInput(h.formFromJob({ ...draft(), etag: '"old"' }));
  await assert.rejects(h.jobApi.create(input), (e) => e.status === 0);
  assert.equal(h.calls.length, 1);
  globalThis.fetch = async () =>
    json({ message: "not allowed", code: "FORBIDDEN", errors: {} }, 403);
  await assert.rejects(h.jobApi.search(), (e) => e.status === 403);
  globalThis.fetch = async () =>
    json(
      {
        message: "invalid",
        code: "VALIDATION_FAILED",
        errors: { budgetMax: "too low" },
      },
      422,
    );
  await assert.rejects(
    h.jobApi.create(input),
    (e) => e.status === 422 && e.errors.budgetMax === "too low",
  );
});
