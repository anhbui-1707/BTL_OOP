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
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const proposal = (status = "PENDING") => ({
  id: 12,
  jobId: 7,
  jobTitle: "LinkIT project",
  jobStatus: "OPEN",
  clientId: 2,
  freelancerId: 3,
  freelancerName: "Freelancer",
  freelancerHeadline: "Java developer",
  coverLetter: "Relevant experience",
  proposedBudget: "100.25",
  currencyCode: "VND",
  estimatedDays: 10,
  status,
  submittedAt: "2026-11-01T02:03:00Z",
  updatedAt: "2026-11-01T02:03:00Z",
  version: "row1",
});
const assignment = (status = "PENDING_SCOPE") => ({
  id: 44,
  jobId: 7,
  jobTitle: "LinkIT project",
  proposalId: 12,
  clientId: 2,
  companyName: "Client",
  freelancerId: 3,
  freelancerName: "Freelancer",
  agreedBudget: "100.25",
  currencyCode: "VND",
  status,
  createdAt: "2026-11-01T02:03:00Z",
  startedAt: null,
  completedAt: null,
  version: "row2",
});
const job = { id: 7, clientId: 2, status: "OPEN", version: "j1" };
const user = (id, ...roles) => ({ id, roles });
const candidate = {
  proposalId: 12,
  proposalVersion: "row1",
  freelancerId: 3,
  fullName: "Freelancer",
  headline: "Java developer",
  yearsExperience: 4,
  availability: "BUSY",
  proposedBudget: "100.25",
  currencyCode: "VND",
  estimatedDays: 10,
  proposalStatus: "PENDING",
  selectable: true,
  ineligibilityReasons: [],
  averageRating: 4.5,
  reviewCount: 7,
};
const page = (content) => ({
  content,
  page: 2,
  size: 5,
  totalElements: 11,
  totalPages: 3,
});
async function harness(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), "linkit-recruitment-"));
  t.after(() => {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith("linkit-recruitment-")
    )
      throw Error("Unsafe test directory");
    rmSync(folder, { recursive: true });
  });
  for (const file of [
    "api/http",
    "api/jobs",
    "api/recruitment",
    "features/recruitment/model",
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
      : json(proposal(), 200, { ETag: '"actual"' });
  };
  t.after(() => {
    globalThis.fetch = old;
  });
  const http = await import(pathToFileURL(join(folder, "api/http.mjs")).href);
  http.configureApiTokenProvider(() => "test-access");
  return {
    ...(await import(pathToFileURL(join(folder, "api/recruitment.mjs")).href)),
    ...(await import(
      pathToFileURL(join(folder, "features/recruitment/model.mjs")).href
    )),
    calls,
  };
}
test("Proposal submit sends only actual fields, including exact decimal budget and positive days", async (t) => {
  const h = await harness(t);
  const result = await h.proposalsApi.submit(7, {
    ...h.proposalInput("  My experience  ", "99999999999999999.99", "10"),
    cvId: 99,
    freelancerId: 123,
  });
  assert.deepEqual(JSON.parse(h.calls[0].options.body), {
    coverLetter: "My experience",
    proposedBudget: "99999999999999999.99",
    estimatedDays: 10,
    cvId: 99,
  });
  assert.equal(h.calls[0].url.pathname, "/api/jobs/7/proposals");
  assert.equal(h.calls[0].options.method, "POST");
  assert.equal(result.submittedAt, proposal().submittedAt);
  assert.equal(result.etag, '"actual"');
});
test("Proposal detail and paginated lists use /me and real status/page/size fields", async (t) => {
  const h = await harness(t, (c) =>
    c.url.pathname === "/api/proposals/12"
      ? json(proposal())
      : json(page([proposal()])),
  );
  const mine = await h.proposalsApi.mine({
    status: "WITHDRAWN",
    page: 2,
    size: 5,
  });
  await h.proposalsApi.forJob(7, { status: "PENDING", page: 2, size: 5 });
  const detail = await h.proposalsApi.detail(12);
  assert.equal(h.calls[0].url.pathname, "/api/proposals/me");
  assert.equal(h.calls[1].url.pathname, "/api/jobs/7/proposals");
  assert.equal(h.calls[0].url.searchParams.get("status"), "WITHDRAWN");
  assert.equal(h.calls[1].url.searchParams.get("page"), "2");
  assert.equal(h.calls[1].url.searchParams.get("size"), "5");
  assert.equal(mine.page, 2);
  assert.equal(mine.totalElements, 11);
  assert.equal(detail.etag, '"row1"');
  assert.equal(detail.coverLetter, "Relevant experience");
});
test("Only rejection uses PATCH status; withdrawal is POST and both carry current ETag", async (t) => {
  const h = await harness(t);
  await h.proposalsApi.reject(12, '"r1"');
  await h.proposalsApi.withdraw(12, '"r2"');
  assert.deepEqual(
    h.calls.map((c) => [c.options.method, c.url.pathname]),
    [
      ["PATCH", "/api/proposals/12/status"],
      ["POST", "/api/proposals/12/withdraw"],
    ],
  );
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { status: "REJECTED" });
  assert.equal(h.calls[1].options.body, undefined);
  assert.equal(h.calls[0].options.headers.get("If-Match"), '"r1"');
  assert.equal(h.calls[1].options.headers.get("If-Match"), '"r2"');
  assert.equal("accept" in h.proposalsApi, false);
  assert.equal("shortlist" in h.proposalsApi, false);
});
test("Proposal validation follows actual DTO with optional CV and no budget caps or guessed defaults", async (t) => {
  const h = await harness(t);
  assert.deepEqual(h.proposalInput("x", "0", "1"), {
    coverLetter: "x",
    proposedBudget: "0",
    estimatedDays: 1,
    cvId: null,
  });
  for (const args of [
    [" ", "1", "1"],
    ["x".repeat(20001), "1", "1"],
    ["x", "", "1"],
    ["x", "-1", "1"],
    ["x", "1.001", "1"],
    ["x", "100000000000000000", "1"],
    ["x", "1", "0"],
    ["x", "1", "2.5"],
    ["x", "1", "2147483648"],
  ])
    assert.throws(() => h.proposalInput(...args));
  assert.equal(
    h.proposalInput("x", "99999999999999999.99", "2147483647").estimatedDays,
    2147483647,
  );
});
test("Submit and matching ownership fail closed across roles and dual-role self-application", async (t) => {
  const h = await harness(t);
  assert.equal(h.canSubmit(user(3, "FREELANCER"), job), true);
  for (const actor of [
    null,
    user(2, "CLIENT"),
    user(4, "ADMIN"),
    user(2, "CLIENT", "FREELANCER"),
  ])
    assert.equal(h.canSubmit(actor, job), false);
  for (const status of [
    "DRAFT",
    "ASSIGNED",
    "IN_PROGRESS",
    "CANCELLED",
    "COMPLETED",
    "CLOSED",
  ])
    assert.equal(h.canSubmit(user(3, "FREELANCER"), { ...job, status }), false);
  assert.equal(h.ownsJob(user(2, "CLIENT"), job), true);
  assert.equal(h.ownsJob(user(4, "CLIENT"), job), false);
  assert.equal(h.ownsJob(user(2, "ADMIN"), job), false);
});
test("Only owner CLIENT rejects and applicant FREELANCER withdraws PENDING on OPEN jobs", async (t) => {
  const h = await harness(t);
  assert.deepEqual(h.proposalRights(user(2, "CLIENT"), proposal()), {
    reject: true,
    withdraw: false,
  });
  assert.deepEqual(h.proposalRights(user(3, "FREELANCER"), proposal()), {
    reject: false,
    withdraw: true,
  });
  for (const actor of [
    null,
    user(4, "CLIENT"),
    user(4, "FREELANCER"),
    user(2, "ADMIN"),
  ])
    assert.deepEqual(h.proposalRights(actor, proposal()), {
      reject: false,
      withdraw: false,
    });
  for (const status of ["ACCEPTED", "REJECTED", "WITHDRAWN"])
    assert.deepEqual(
      h.proposalRights(user(3, "FREELANCER"), proposal(status)),
      { reject: false, withdraw: false },
    );
  assert.equal(
    h.proposalRights(user(2, "CLIENT"), {
      ...proposal(),
      jobStatus: "ASSIGNED",
    }).reject,
    false,
  );
});
test("Candidate listing preserves backend ratings and ranking and uses a single paginated GET", async (t) => {
  const h = await harness(t, () => json(page([candidate])));
  const result = await h.matchingApi.candidates(7, {
    status: "REJECTED",
    page: 2,
    size: 5,
  });
  assert.equal(h.calls[0].url.pathname, "/api/jobs/7/candidates");
  assert.equal(h.calls[0].url.searchParams.get("status"), "REJECTED");
  assert.equal(h.calls[0].url.searchParams.get("page"), "2");
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.method ?? "GET", "GET");
  assert.equal(h.calls[0].options.body, undefined);
  assert.equal(h.calls[0].url.searchParams.get("size"), "5");
  assert.equal(result.content[0].averageRating, 4.5);
  assert.equal(result.content[0].reviewCount, 7);
  assert.equal(result.totalPages, 3);
});
test("Selection trusts server eligibility without a minimum rating", async (t) => {
  const h = await harness(t);
  assert.equal(
    h.canSelect(user(2, "CLIENT"), job, {
      ...candidate,
      averageRating: null,
      reviewCount: 0,
    }),
    true,
  );
  assert.equal(
    h.canSelect(user(2, "CLIENT"), job, {
      ...candidate,
      selectable: false,
      ineligibilityReasons: ["FREELANCER_UNAVAILABLE"],
    }),
    false,
  );
  assert.equal(h.canSelect(user(2, "ADMIN"), job, candidate), false);
  assert.equal(h.canSelect(user(4, "CLIENT"), job, candidate), false);
  assert.equal(
    h.canSelect(user(2, "CLIENT"), { ...job, status: "ASSIGNED" }, candidate),
    false,
  );
  for (const proposalStatus of ["REJECTED", "WITHDRAWN", "ACCEPTED"])
    assert.equal(
      h.canSelect(user(2, "CLIENT"), job, { ...candidate, proposalStatus }),
      false,
    );
});
test("Selection uses Proposal If-Match then reloads Proposal, Job and Assignment without inventing ACTIVE", async (t) => {
  const h = await harness(t, (c) =>
    c.url.pathname === "/api/proposals/12/select"
      ? json(assignment(), 201, { ETag: '"assignment-version"' })
      : c.url.pathname === "/api/proposals/12"
        ? json(proposal("ACCEPTED"))
        : c.url.pathname === "/api/jobs/7"
          ? json({ ...job, status: "ASSIGNED" })
          : json(assignment()),
  );
  let committed = null;
  const result = await h.selectAndReload(12, '"proposal-version"', (id) => {
    committed = id;
  });
  assert.equal(committed, 44);
  assert.equal(h.calls[0].options.method, "POST");
  assert.equal(
    h.calls[0].options.headers.get("If-Match"),
    '"proposal-version"',
  );
  assert.deepEqual(
    h.calls
      .slice(1)
      .map((c) => c.url.pathname)
      .sort(),
    ["/api/proposals/12", "/api/jobs/7", "/api/assignments/44"].sort(),
  );
  assert.equal(result.proposal.status, "ACCEPTED");
  assert.equal(result.job.status, "ASSIGNED");
  assert.equal(result.assignment.status, "PENDING_SCOPE");
  assert.equal(result.assignment.startedAt, null);
});
test("A successful selection remains committed when refresh fails; it is never replayed", async (t) => {
  const h = await harness(t, (c) =>
    c.url.pathname.endsWith("/select")
      ? json(assignment(), 201)
      : json({ message: "Reload failed" }, 503),
  );
  let committed = false;
  await assert.rejects(
    h.selectAndReload(12, '"r1"', () => {
      committed = true;
    }),
    (e) => e.status === 503,
  );
  assert.equal(committed, true);
  assert.equal(h.calls.filter((c) => c.options.method === "POST").length, 1);
});
test("Assignment list/detail preserve every real status, dates, exact amounts and ETag", async (t) => {
  const all = [
    "PENDING_SCOPE",
    "ACTIVE",
    "AWAITING_ACCEPTANCE",
    "COMPLETED",
    "CANCELLED",
  ].map(assignment);
  const h = await harness(t, (c) =>
    c.url.pathname === "/api/assignments"
      ? json(page(all))
      : json(assignment("ACTIVE"), 200, { ETag: '"a1"' }),
  );
  const result = await h.assignmentsApi.list({
    status: "ACTIVE",
    page: 2,
    size: 5,
  });
  const detail = await h.assignmentsApi.detail(44);
  assert.deepEqual(
    result.content.map((a) => a.status),
    all.map((a) => a.status),
  );
  assert.equal(result.page, 2);
  assert.equal(h.calls[0].url.pathname, "/api/assignments");
  assert.equal(h.calls[0].url.searchParams.get("status"), "ACTIVE");
  assert.equal(h.calls[1].url.pathname, "/api/assignments/44");
  assert.equal(detail.agreedBudget, "100.25");
  assert.equal(detail.etag, '"a1"');
  assert.equal(detail.startedAt, null);
});
test("DECIMAL precision is preserved without rewriting proposal text or rating numbers", async (t) => {
  const h = await harness(t);
  const text = 'text "proposedBudget": 123.45';
  const raw = JSON.stringify({
    coverLetter: text,
    proposedBudget: "big",
    agreedBudget: "big",
    averageRating: 4.5,
  }).replaceAll('"big"', "99999999999999999.99");
  const decoded = h.parseRecruitmentJson(raw);
  assert.equal(decoded.proposedBudget, "99999999999999999.99");
  assert.equal(decoded.agreedBudget, "99999999999999999.99");
  assert.equal(decoded.coverLetter, text);
  assert.equal(decoded.averageRating, 4.5);
});
test("403/409/412/422 errors surface backend DTO and never retry writes or change versions", async (t) => {
  for (const status of [403, 409, 412, 422]) {
    const h = await harness(t, () =>
      json(
        {
          code: "BACKEND_ERROR",
          message: "Actual backend message",
          errors: { coverLetter: "Invalid" },
        },
        status,
      ),
    );
    await assert.rejects(
      h.proposalsApi.reject(12, '"old"'),
      (e) =>
        e.status === status &&
        e.code === "BACKEND_ERROR" &&
        e.errors.coverLetter === "Invalid",
    );
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].options.headers.get("If-Match"), '"old"');
  }
});
test("Network errors never substitute mocks or retry selection/submission", async (t) => {
  const h = await harness(t, () => {
    throw new TypeError("offline");
  });
  await assert.rejects(
    h.proposalsApi.select(12, '"old"'),
    (e) => e.status === 0,
  );
  assert.equal(h.calls.length, 1);
  await assert.rejects(
    h.proposalsApi.submit(7, h.proposalInput("x", "0", "1")),
    (e) => e.status === 0,
  );
  assert.equal(h.calls.length, 2);
});
test("401 on protected resources surfaces authentication failure without a refresh loop", async (t) => {
  const h = await harness(t, () =>
    json({ code: "UNAUTHORIZED", message: "Authentication required" }, 401),
  );
  await assert.rejects(h.proposalsApi.mine(), (e) => e.status === 401);
  await assert.rejects(h.assignmentsApi.list(), (e) => e.status === 401);
  assert.equal(h.calls.length, 2);
});
test("Missing version prevents unsafe follow-up mutations instead of inventing ETags", async (t) => {
  const h = await harness(t, () => json({ ...proposal(), version: null }));
  await assert.rejects(h.proposalsApi.detail(12), /phiên bản/);
  assert.equal(h.calls.length, 1);
});
