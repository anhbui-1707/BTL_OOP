import { test } from "node:test"
import assert from "node:assert/strict"
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join, dirname, basename } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const json = (data, status = 200, headers = {}) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
const user = (id, ...roles) => ({ id, roles, fullName: "LinkIT user" })
const client = user(2, "CLIENT"),
  freelancer = user(3, "FREELANCER")
const assignment = {
  id: 44,
  jobId: 7,
  clientId: 2,
  freelancerId: 3,
  agreedBudget: "100.25",
  currencyCode: "VND",
  status: "PENDING_SCOPE",
  version: "a1",
}
const job = {
  id: 7,
  clientId: 2,
  status: "ASSIGNED",
  deliverables: "Source and documentation",
  acceptanceCriteria: "Tests pass",
  budgetMax: "200.00",
  deadline: "2099-12-31",
  version: "j1",
}
const scope = (status = "DRAFT", versionNumber = 1) => ({
  id: 55 + versionNumber,
  assignmentId: 44,
  versionNumber,
  deliverables: "Deliverables",
  exclusions: null,
  acceptanceCriteria: "Criteria",
  budget: "100.25",
  deadline: "2099-12-31",
  status,
  createdBy: 2,
  approvals: [],
  assignmentVersion: "a1",
})
const milestone = (status = "PLANNED") => ({
  id: 88,
  assignmentId: 44,
  scopeVersionId: 56,
  title: "API delivery",
  description: "Deliver backend",
  acceptanceCriteria: "Tests pass",
  dueDate: "2099-12-20",
  amount: "50.25",
  isRequired: true,
  sortOrder: 1,
  status,
  version: "m1",
})
const submission = (status = "SUBMITTED", number = 1) => ({
  id: 99 + number,
  milestoneId: 88,
  submissionNumber: number,
  submittedBy: 3,
  submissionNote: "Implemented and tested",
  evidenceUrl: "https://example.test/report",
  status,
  reviewNote: null,
  reviewedBy: null,
  milestoneVersion: "m2",
})
const page = (content, number = 0, size = 20, pages = 1) => ({
  content,
  page: number,
  size,
  totalElements: content.length,
  totalPages: pages,
})
const pending = () => ({ assignment, job, scopes: [scope()] })
const active = () => ({
  assignment: { ...assignment, status: "ACTIVE" },
  job: { ...job, status: "IN_PROGRESS" },
  scopes: [scope("LOCKED")],
})
async function harness(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), "linkit-workspace-"))
  t.after(() => {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith("linkit-workspace-")
    )
      throw Error("Unsafe test directory")
    rmSync(folder, { recursive: true })
  })
  for (const file of [
    "api/http",
    "api/jobs",
    "api/recruitment",
    "api/workspace",
    "features/workspace/productionModel",
  ]) {
    const source = readFileSync(
      join(root, "src", `${file}.ts`),
      "utf8",
    ).replace("import.meta.env?.VITE_API_BASE_URL", '"https://api.linkit.test"')
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
      )
    const output = join(folder, `${file}.mjs`)
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, compiled)
  }
  const old = globalThis.fetch
  const calls = []
  globalThis.fetch = async (address, options) => {
    const call = { url: new URL(address), options }
    calls.push(call)
    return respond
      ? respond(call, calls)
      : json(scope(), 200, { ETag: '"actual"' })
  }
  t.after(() => {
    globalThis.fetch = old
  })
  const http = await import(pathToFileURL(join(folder, "api/http.mjs")).href)
  http.configureApiTokenProvider(() => "test-access")
  return {
    ...(await import(pathToFileURL(join(folder, "api/workspace.mjs")).href)),
    ...(await import(
      pathToFileURL(join(folder, "features/workspace/productionModel.mjs")).href
    )),
    calls,
  }
}
test("Workspace route contains only a positive safe Assignment ID", async (t) => {
  const h = await harness(t)
  assert.equal(
    h.workspaceId("#/dashboard/Không gian dự án?assignmentId=44"),
    44,
  )
  for (const value of ["", "0", "-1", "1.5", "9007199254740992", "abc", "1e2"])
    assert.equal(h.workspaceId(`#/dashboard/x?assignmentId=${value}`), null)
  const oldWindow = globalThis.window,
    oldEvent = globalThis.PopStateEvent
  const events = []
  globalThis.window = {
    history: { pushState: (...args) => events.push(args[2]) },
    dispatchEvent: (e) => events.push(e.type),
  }
  globalThis.PopStateEvent = class {
    constructor(type) {
      this.type = type
    }
  }
  t.after(() => {
    globalThis.window = oldWindow
    globalThis.PopStateEvent = oldEvent
  })
  h.openWorkspace(44)
  h.openWorkspace(-1)
  assert.equal(h.workspaceId(events[0]), 44)
  assert.equal(events[1], "popstate")
  assert.equal(events.length, 2)
})
test("Workspace loads the real Assignment and its Job, then every page of Scope history", async (t) => {
  const h = await harness(t, (c) =>
    c.url.pathname === "/api/assignments/44"
      ? json(assignment)
      : c.url.pathname === "/api/jobs/7"
        ? json(job)
        : json(
            page(
              [scope("SUPERSEDED", Number(c.url.searchParams.get("page")) + 1)],
              Number(c.url.searchParams.get("page")),
              100,
              2,
            ),
          ),
  )
  const data = await h.loadWorkspace(44, freelancer)
  assert.equal(data.assignment.status, "PENDING_SCOPE")
  assert.equal(data.job.status, "ASSIGNED")
  assert.equal(data.scopes.length, 2)
  assert.deepEqual(
    h.calls.map((c) => c.url.pathname),
    [
      "/api/assignments/44",
      "/api/jobs/7",
      "/api/assignments/44/scopes",
      "/api/assignments/44/scopes",
    ],
  )
  assert.equal(h.calls[3].url.searchParams.get("page"), "1")
  assert.equal(h.calls[3].url.searchParams.get("size"), "100")
})
test("Unrelated users and ADMIN cannot load private Scope through a guessed Assignment", async (t) => {
  for (const actor of [
    user(4, "CLIENT"),
    user(4, "FREELANCER"),
    user(4, "ADMIN"),
  ]) {
    const h = await harness(t, () => json(assignment))
    await assert.rejects(h.loadWorkspace(44, actor), /CLIENT\/FREELANCER/)
    assert.equal(h.calls.length, 1)
    assert.equal(h.party(actor, assignment), null)
  }
})
test("Private Assignment failures stop loading and never fall back to demo data", async (t) => {
  const h = await harness(t, () => json({ message: "Not found" }, 404))
  await assert.rejects(
    h.loadWorkspace(123456, freelancer),
    (e) => e.status === 404,
  )
  assert.equal(h.calls.length, 1)
})
test("First Scope retains Job defaults and requires Client to enter product acceptance criteria", async (t) => {
  const h = await harness(t)
  const data = { ...pending(), scopes: [] }
  const before = structuredClone(data)
  const form = h.scopeForm(data)
  assert.equal(form.deliverables, job.deliverables)
  assert.equal(form.acceptanceCriteria, "")
  assert.equal(form.deadline, job.deadline)
  assert.equal(form.budget, assignment.agreedBudget)
  assert.deepEqual(data, before)
  assert.throws(() => h.scopeInput(form), /nghiệm thu/)
  assert.equal(h.scopeInput({ ...form, acceptanceCriteria: "Product tests pass", budget: "0" }).budget, "0")
})
test("Scope versioning permits only the newest DRAFT submit and retains old approval history", async (t) => {
  const h = await harness(t)
  const old = {
    ...scope("SUPERSEDED", 1),
    approvals: [{ userId: 2, partyRole: "CLIENT", approvedAt: "2026-01-01" }],
  }
  const next = scope("DRAFT", 2)
  const data = { ...pending(), scopes: [next, old] }
  const before = structuredClone(data)
  assert.equal(h.scopeRights(client, data, next).submit, true)
  assert.equal(h.scopeRights(freelancer, data, old).approve, false)
  assert.equal(h.scopeRights(client, data, old).submit, false)
  assert.deepEqual(data, before)
  assert.deepEqual(next.approvals, [])
})
test("Only each actual party can approve once; locked Scope cannot be edited or approved", async (t) => {
  const h = await harness(t)
  const s = {
    ...scope("PENDING_APPROVAL"),
    approvals: [{ userId: 2, partyRole: "CLIENT" }],
  }
  const data = { ...pending(), scopes: [s] }
  assert.equal(h.scopeRights(client, data, s).approve, false)
  assert.equal(h.scopeRights(freelancer, data, s).approve, true)
  assert.equal(h.scopeRights(user(4, "CLIENT"), data, s).approve, false)
  for (const actor of [client, freelancer])
    assert.deepEqual(h.scopeRights(actor, active(), scope("LOCKED")), {
      create: false,
      submit: false,
      approve: false,
    })
})
test("Scope API uses Assignment ETag for create, submit and approve, with no userId payload", async (t) => {
  const h = await harness(t)
  const data = h.scopeInput({ ...h.scopeForm(pending()), acceptanceCriteria: "Product tests pass" })
  await h.scopesApi.create(44, data, '"a1"')
  await h.scopesApi.submit(56, '"a2"')
  await h.scopesApi.approve(56, '"a3"')
  assert.deepEqual(
    h.calls.map((c) => [c.options.method, c.url.pathname]),
    [
      ["POST", "/api/assignments/44/scopes"],
      ["POST", "/api/scopes/56/submit"],
      ["POST", "/api/scopes/56/approve"],
    ],
  )
  assert.deepEqual(
    h.calls.map((c) => c.options.headers.get("If-Match")),
    ['"a1"', '"a2"', '"a3"'],
  )
  assert.equal(h.calls[2].options.body, undefined)
  assert.equal("userId" in JSON.parse(h.calls[0].options.body), false)
})
test("Scope reads preserve pagination, approval identity and Assignment version fallback", async (t) => {
  const h = await harness(t, (c) =>
    c.url.pathname === "/api/scopes/56"
      ? json({
          ...scope("PENDING_APPROVAL"),
          approvals: [{ userId: 3, partyRole: "FREELANCER" }],
        })
      : json(page([scope()], 2, 10, 3)),
  )
  const list = await h.scopesApi.list(44, 2, 10)
  const s = await h.scopesApi.detail(56)
  assert.equal(list.page, 2)
  assert.equal(list.totalPages, 3)
  assert.equal(s.etag, '"a1"')
  assert.equal(s.approvals[0].userId, 3)
})
test("After Scope approval, Workspace rereads Scope, Assignment and Job rather than setting states locally", async (t) => {
  const h = await harness(t, (c) =>
    c.url.pathname.endsWith("/approve")
      ? json(scope("LOCKED"), 200, { ETag: '"a2"' })
      : c.url.pathname === "/api/assignments/44"
        ? json({
            ...assignment,
            status: "ACTIVE",
            startedAt: "2026-01-01T00:00:00Z",
            version: "a2",
          })
        : c.url.pathname === "/api/jobs/7"
          ? json({ ...job, status: "IN_PROGRESS" })
          : json(page([scope("LOCKED")])),
  )
  await h.scopesApi.approve(56, '"a1"')
  const result = await h.loadWorkspace(44, freelancer)
  assert.equal(result.assignment.status, "ACTIVE")
  assert.equal(result.job.status, "IN_PROGRESS")
  assert.equal(result.scopes[0].status, "LOCKED")
  assert.equal(h.calls.filter((c) => c.options.method === "POST").length, 1)
})
test("Milestone create, detail, PUT and soft DELETE match actual routes and version resource", async (t) => {
  const h = await harness(t, (c) =>
    c.options.method === "DELETE"
      ? json(null, 204)
      : json(milestone(), 200, { ETag: '"m1"' }),
  )
  const input = h.milestoneInput(h.milestoneForm(milestone()), "2099-12-31")
  await h.milestonesApi.create(44, input)
  const m = await h.milestonesApi.detail(88)
  await h.milestonesApi.update(88, input, m.etag)
  await h.milestonesApi.cancel(88, '"m2"')
  assert.deepEqual(
    h.calls.map((c) => [c.options.method || "GET", c.url.pathname]),
    [
      ["POST", "/api/assignments/44/milestones"],
      ["GET", "/api/milestones/88"],
      ["PUT", "/api/milestones/88"],
      ["DELETE", "/api/milestones/88"],
    ],
  )
  assert.equal(h.calls[0].options.headers.has("If-Match"), false)
  assert.equal(h.calls[2].options.headers.get("If-Match"), '"m1"')
  assert.equal(h.calls[3].options.headers.get("If-Match"), '"m2"')
  assert.deepEqual(JSON.parse(h.calls[0].options.body), input)
})
test("Milestone and Submission histories preserve server pagination and exact enums", async (t) => {
  const h = await harness(t, (c) =>
    c.url.pathname.endsWith("/submissions")
      ? json(
          page(
            [submission("REVISION_REQUIRED", 2), submission("SUBMITTED", 1)],
            1,
            2,
            3,
          ),
        )
      : json(
          page(
            [
              "PLANNED",
              "IN_PROGRESS",
              "SUBMITTED",
              "REVISION_REQUIRED",
              "APPROVED",
              "CANCELLED",
            ].map(milestone),
          ),
        ),
  )
  const list = await h.milestonesApi.list(44, 0, 20)
  const history = await h.milestonesApi.history(88, 1, 2)
  assert.equal(list.content[3].status, "REVISION_REQUIRED")
  assert.equal(history.content[0].submissionNumber, 2)
  assert.equal(history.page, 1)
  assert.equal(h.calls[1].url.searchParams.get("size"), "2")
})
test("Submitting and resubmitting append using POST and use Milestone ETag", async (t) => {
  let number = 0
  const h = await harness(t, () =>
    json(submission("SUBMITTED", ++number), 201, { ETag: '"m3"' }),
  )
  const input = h.submissionInput(
    "  Working source  ",
    "https://example.test/source",
  )
  const one = await h.milestonesApi.submit(88, input, '"m1"')
  const two = await h.milestonesApi.submit(88, input, '"m2"')
  assert.equal(one.submissionNumber, 1)
  assert.equal(two.submissionNumber, 2)
  assert.equal(two.etag, '"m3"')
  assert.equal(h.calls[0].options.method, "POST")
  assert.equal(h.calls[0].options.headers.get("If-Match"), '"m1"')
  assert.deepEqual(JSON.parse(h.calls[1].options.body), {
    submissionNote: "Working source",
    evidenceUrl: "https://example.test/source",
  })
})
test("Approving or requesting revision targets Submission ID but uses Milestone version", async (t) => {
  const h = await harness(t, () => json(submission()))
  await h.milestonesApi.approve(100, null, '"milestone-version"')
  await h.milestonesApi.revise(100, "Fix failing test", '"milestone-new"')
  assert.deepEqual(
    h.calls.map((c) => c.url.pathname),
    ["/api/submissions/100/approve", "/api/submissions/100/request-revision"],
  )
  assert.equal(
    h.calls[0].options.headers.get("If-Match"),
    '"milestone-version"',
  )
  assert.equal(h.calls[1].options.headers.get("If-Match"), '"milestone-new"')
  assert.deepEqual(JSON.parse(h.calls[1].options.body), {
    reviewNote: "Fix failing test",
  })
})
test("Milestone writes require the actual party, ACTIVE Assignment, IN_PROGRESS Job and current LOCKED Scope", async (t) => {
  const h = await harness(t)
  assert.equal(h.milestoneRights(client, active()).create, true)
  for (const data of [
    pending(),
    { ...active(), assignment: { ...assignment, status: "COMPLETED" } },
    { ...active(), job: { ...job, status: "ASSIGNED" } },
    { ...active(), scopes: [scope("SUPERSEDED")] },
  ])
    assert.equal(h.milestoneRights(client, data).create, false)
  for (const actor of [
    user(4, "CLIENT"),
    user(4, "FREELANCER"),
    user(2, "ADMIN"),
  ])
    assert.equal(h.milestoneRights(actor, active()).create, false)
  assert.equal(
    h.milestoneRights(client, active(), { ...milestone(), scopeVersionId: 999 })
      .edit,
    false,
  )
})
test("Only CLIENT edits/cancels PLANNED without history; terminal and submitted states are immutable", async (t) => {
  const h = await harness(t)
  assert.equal(h.milestoneRights(client, active(), milestone()).edit, true)
  assert.equal(
    h.milestoneRights(client, active(), milestone(), undefined, true).edit,
    false,
  )
  assert.equal(h.milestoneRights(freelancer, active(), milestone()).edit, false)
  for (const status of [
    "IN_PROGRESS",
    "SUBMITTED",
    "REVISION_REQUIRED",
    "APPROVED",
    "CANCELLED",
  ])
    assert.equal(
      h.milestoneRights(client, active(), milestone(status)).edit,
      false,
    )
})
test("Only assigned FREELANCER submits/resubmits; prior history must require revision", async (t) => {
  const h = await harness(t)
  for (const status of ["PLANNED", "IN_PROGRESS"])
    assert.equal(
      h.milestoneRights(freelancer, active(), milestone(status)).submit,
      true,
    )
  assert.equal(
    h.milestoneRights(
      freelancer,
      active(),
      milestone("REVISION_REQUIRED"),
      submission("REVISION_REQUIRED"),
      true,
    ).submit,
    true,
  )
  assert.equal(
    h.milestoneRights(freelancer, active(), milestone("REVISION_REQUIRED"))
      .submit,
    false,
  )
  assert.equal(
    h.milestoneRights(
      freelancer,
      active(),
      milestone("REVISION_REQUIRED"),
      submission("SUBMITTED"),
      true,
    ).submit,
    false,
  )
  for (const status of ["SUBMITTED", "APPROVED", "CANCELLED"])
    assert.equal(
      h.milestoneRights(freelancer, active(), milestone(status)).submit,
      false,
    )
  assert.equal(h.milestoneRights(client, active(), milestone()).submit, false)
})
test("Only owner CLIENT reviews a valid latest SUBMITTED result from the assigned freelancer", async (t) => {
  const h = await harness(t)
  assert.equal(
    h.milestoneRights(
      client,
      active(),
      milestone("SUBMITTED"),
      submission(),
      true,
    ).review,
    true,
  )
  assert.equal(
    h.milestoneRights(
      freelancer,
      active(),
      milestone("SUBMITTED"),
      submission(),
      true,
    ).review,
    false,
  )
  assert.equal(
    h.milestoneRights(
      client,
      active(),
      milestone("SUBMITTED"),
      { ...submission(), submittedBy: 9 },
      true,
    ).review,
    false,
  )
  assert.equal(
    h.milestoneRights(client, active(), milestone("SUBMITTED"), undefined, true)
      .review,
    false,
  )
  assert.equal(
    h.milestoneRights(
      client,
      active(),
      milestone("APPROVED"),
      submission("APPROVED"),
      true,
    ).review,
    false,
  )
})
test("DTO validation enforces real precision, date/length/INT limits without recalculating budget totals", async (t) => {
  const h = await harness(t)
  const form = h.milestoneForm(milestone())
  assert.equal(
    h.milestoneInput({ ...form, amount: "99999999999999999.99" }, "2099-12-31")
      .amount,
    "99999999999999999.99",
  )
  for (const patch of [
    { title: " " },
    { title: "x".repeat(201) },
    { amount: "-1" },
    { amount: "1.001" },
    { amount: "100000000000000000" },
    { sortOrder: "0" },
    { sortOrder: "2147483648" },
    { isRequired: "" },
    { dueDate: "2099-02-30" },
    { dueDate: "2100-01-01" },
  ])
    assert.throws(() => h.milestoneInput({ ...form, ...patch }, "2099-12-31"))
  assert.equal(h.date("0001-01-01"), "0001-01-01")
  assert.throws(() => h.date("0000-01-01"))
  assert.throws(() =>
    h.scopeInput({ ...h.scopeForm(pending()), deliverables: "" }),
  )
})
test("Submission notes and revision reasons are mandatory; evidence is optional HTTP(S) without credentials", async (t) => {
  const h = await harness(t)
  assert.deepEqual(h.submissionInput("x", ""), {
    submissionNote: "x",
    evidenceUrl: null,
  })
  assert.equal(h.reviewNote("", false), null)
  assert.throws(() => h.submissionInput("", ""))
  assert.throws(() => h.reviewNote(" ", true))
  assert.throws(() => h.reviewNote("x".repeat(20001), false))
  for (const url of [
    "javascript:alert(1)",
    "file:///tmp/a",
    "https://user:password@example.test/a",
    "no url",
    "http://",
  ])
    assert.throws(() => h.submissionInput("x", url))
})
test("Scope budget and Milestone amount preserve DECIMAL(19,2), without changing user text", async (t) => {
  const h = await harness(
    t,
    (c) =>
      new Response(
        JSON.stringify(
          c.url.pathname.startsWith("/api/scopes")
            ? { ...scope(), budget: "BIG", deliverables: 'text "budget":123' }
            : { ...milestone(), amount: "BIG" },
        ).replace('"BIG"', "99999999999999999.99"),
      ),
  )
  const s = await h.scopesApi.detail(56),
    m = await h.milestonesApi.detail(88)
  assert.equal(s.budget, "99999999999999999.99")
  assert.equal(m.amount, "99999999999999999.99")
  assert.equal(s.deliverables, 'text "budget":123')
})
test("409/412 preserve typed data and expose conflict without replaying a write", async (t) => {
  for (const status of [409, 412]) {
  const h = await harness(t, () =>
    json({ code: "CONFLICT", message: "Reload resource" }, status),
  )
  const form = h.milestoneForm(milestone())
  form.description = "Unsaved work"
  const before = structuredClone(form)
  await assert.rejects(
    h.milestonesApi.update(88, h.milestoneInput(form, "2099-12-31"), '"old"'),
    (e) => e.status === status,
  )
  assert.deepEqual(form, before)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].options.headers.get("If-Match"), '"old"')
  }
})
test("401/403/422 and network failures surface actual errors and never use fixtures or retry writes", async (t) => {
  for (const status of [401, 403, 422]) {
    const h = await harness(t, () =>
      json({ message: "Actual error", errors: { title: "Invalid" } }, status),
    )
    await assert.rejects(
      h.scopesApi.approve(56, '"a1"'),
      (e) => e.status === status && e.errors.title === "Invalid",
    )
    assert.equal(h.calls.length, 1)
  }
  const h = await harness(t, () => {
    throw new TypeError("offline")
  })
  await assert.rejects(
    h.milestonesApi.submit(88, h.submissionInput("x", ""), '"m1"'),
    (e) => e.status === 0,
  )
  assert.equal(h.calls.length, 1)
})
test("Version fallback uses the correct aggregate and missing versions fail closed", async (t) => {
  const h = await harness(t, (c) =>
    json(
      c.url.pathname.startsWith("/api/scopes")
        ? { ...scope(), assignmentVersion: null }
        : submission(),
    ),
  )
  await assert.rejects(h.scopesApi.detail(56), /phiên bản/)
  const s = await h.milestonesApi.approve(100, null, '"m1"')
  assert.equal(s.etag, '"m2"')
})
