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
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
const user = (id, ...roles) => ({ id, roles, fullName: "Test user" })
const client = user(2, "CLIENT"),
  freelancer = user(3, "FREELANCER"),
  admin = user(9, "ADMIN")
const assignment = {
  id: 44,
  jobId: 7,
  clientId: 2,
  freelancerId: 3,
  status: "ACTIVE",
  agreedBudget: "1000.00",
  version: "a1",
}
const job = { id: 7, status: "IN_PROGRESS", version: "j1" }
const scope = { id: 56, versionNumber: 2, status: "LOCKED" }
const context = () => ({ assignment, job, scopes: [scope] })
const acceptance = (accepted = false) => ({
  assignmentId: 44,
  assignmentStatus: accepted ? "COMPLETED" : "ACTIVE",
  accepted,
  acceptance: accepted
    ? {
        id: 88,
        scopeVersionId: 56,
        acceptedBy: 2,
        acceptanceNote: null,
        acceptedAt: "2026-01-01",
      }
    : null,
  assignmentVersion: "a2",
})
const review = {
  id: 99,
  assignmentId: 44,
  reviewerId: 2,
  freelancerId: 3,
  overallRating: 5,
  qualityRating: 4,
  communicationRating: 3,
  timelinessRating: 2,
  comment: "Useful result",
  createdAt: "2026-01-01",
}
const page = (content) => ({
  content,
  page: 2,
  size: 5,
  totalElements: 11,
  totalPages: 3,
})
const evidence = () => ({
  milestones: [
    { id: 1, scopeVersionId: 56, isRequired: true, status: "APPROVED" },
  ],
})
async function harness(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), "linkit-lifecycle-"))
  t.after(() => {
    if (
      dirname(resolve(folder)) !== resolve(tmpdir()) ||
      !basename(folder).startsWith("linkit-lifecycle-")
    )
      throw Error("Unsafe test directory")
    rmSync(folder, { recursive: true })
  })
  for (const file of [
    "api/http",
    "api/jobs",
    "api/recruitment",
    "api/workspace",
    "api/lifecycle",
    "features/workspace/productionModel",
    "features/workspace/lifecycleModel",
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
  const old = globalThis.fetch,
    calls = []
  globalThis.fetch = async (address, options) => {
    const call = { url: new URL(address), options }
    calls.push(call)
    return respond
      ? respond(call, calls)
      : json(acceptance(), 200, { ETag: '"actual"' })
  }
  t.after(() => {
    globalThis.fetch = old
  })
  const http = await import(pathToFileURL(join(folder, "api/http.mjs")).href)
  http.configureApiTokenProvider(() => "test-access")
  return {
    ...(await import(pathToFileURL(join(folder, "api/lifecycle.mjs")).href)),
    ...(await import(
      pathToFileURL(join(folder, "features/workspace/lifecycleModel.mjs")).href
    )),
    ...(await import(
      pathToFileURL(join(folder, "features/workspace/productionModel.mjs")).href
    )),
    calls,
  }
}
test("Explicit ADMIN workspace mode fetches Assignment/Job only, never private Scope/Milestone endpoints", async (t) => {
  const h = await harness(t, (c) =>
    json(c.url.pathname === "/api/assignments/44" ? assignment : job),
  )
  const data = await h.loadWorkspace(44, admin, true)
  assert.deepEqual(data.scopes, [])
  assert.deepEqual(
    h.calls.map((c) => c.url.pathname),
    ["/api/assignments/44", "/api/jobs/7"],
  )
  await assert.rejects(
    h.loadWorkspace(44, user(8, "FREELANCER"), true),
    /CLIENT\/FREELANCER/,
  )
})
test("Final Acceptance GET/POST preserve Assignment version and optional note", async (t) => {
  const h = await harness(t, (c) =>
    json(acceptance(c.options.method === "POST")),
  )
  const status = await h.acceptanceApi.get(44)
  await h.acceptanceApi.accept(44, "Approved delivery", status.etag)
  assert.equal(status.etag, '"a2"')
  assert.equal(h.calls[1].options.headers.get("If-Match"), '"a2"')
  assert.equal(h.calls[1].options.method, "POST")
  assert.deepEqual(JSON.parse(h.calls[1].options.body), {
    acceptanceNote: "Approved delivery",
  })
  assert.equal(h.calls[0].url.pathname, "/api/assignments/44/final-acceptance")
  assert.throws(() => h.acceptanceNote("x".repeat(20001)))
})
test("Acceptance ignores cancelled/optional/old-Scope milestones but requires approved current required work", async (t) => {
  const h = await harness(t)
  const e = evidence()
  e.milestones.push(
    { scopeVersionId: 56, isRequired: true, status: "CANCELLED" },
    { scopeVersionId: 56, isRequired: false, status: "SUBMITTED" },
    { scopeVersionId: 55, isRequired: true, status: "PLANNED" },
  )
  assert.equal(h.canAccept(client, context(), acceptance(), e), true)
  assert.equal(
    h.canAccept(client, context(), acceptance(), {
      milestones: [],
    }),
    false,
  )
  assert.equal(
    h.canAccept(client, context(), acceptance(), {
      ...e,
      milestones: [
        { scopeVersionId: 56, isRequired: true, status: "SUBMITTED" },
      ],
    }),
    false,
  )
})
test("Only owner CLIENT accepts ACTIVE/AWAITING_ACCEPTANCE with IN_PROGRESS Job, once", async (t) => {
  const h = await harness(t)
  for (const actor of [admin, freelancer, user(8, "CLIENT")])
    assert.equal(h.canAccept(actor, context(), acceptance(), evidence()), false)
  assert.equal(
    h.canAccept(
      client,
      {
        ...context(),
        assignment: { ...assignment, status: "AWAITING_ACCEPTANCE" },
      },
      acceptance(),
      evidence(),
    ),
    true,
  )
  assert.equal(
    h.canAccept(client, context(), acceptance(true), evidence()),
    false,
  )
  assert.equal(
    h.canAccept(
      client,
      { ...context(), job: { ...job, status: "ASSIGNED" } },
      acceptance(),
      evidence(),
    ),
    false,
  )
})
test("Acceptance evidence reads every Milestone page using only milestone GET requests", async (t) => {
  const h = await harness(t, (c) =>
    json({
      content: c.url.pathname.endsWith("/milestones")
        ? evidence().milestones
        : [],
      page: Number(c.url.searchParams.get("page")),
      totalPages: 2,
    }),
  )
  const result = await h.acceptanceEvidence(44)
  assert.equal(result.milestones.length, 2)
  assert.equal(h.calls.length, 2)
  assert.equal(
    h.calls.some(
      (c) =>
        c.options.method === "POST" || !c.url.pathname.endsWith("/milestones"),
    ),
    false,
  )
})
test("Review sends exactly four integer rating fields and comment with no aggregate or reputation mutation", async (t) => {
  const h = await harness(t, () => json(review, 201))
  const f = {
    overallRating: "5",
    qualityRating: "4",
    communicationRating: "3",
    timelinessRating: "2",
    comment: "  Useful result  ",
  }
  await h.reviewsApi.create(44, h.reviewInput(f))
  assert.deepEqual(JSON.parse(h.calls[0].options.body), {
    overallRating: 5,
    qualityRating: 4,
    communicationRating: 3,
    timelinessRating: 2,
    comment: "Useful result",
  })
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url.pathname, "/api/assignments/44/review")
  assert.equal("update" in h.reviewsApi, false)
  assert.equal("delete" in h.reviewsApi, false)
})
test("Review validates all four ratings as integers 1–5 and original comment length <=2000", async (t) => {
  const h = await harness(t)
  const f = {
    overallRating: "1",
    qualityRating: "2",
    communicationRating: "3",
    timelinessRating: "4",
    comment: "x".repeat(2000),
  }
  assert.equal(h.reviewInput(f).comment.length, 2000)
  for (const field of h.ratingFields)
    for (const value of ["", "0", "6", "2.5", "NaN"])
      assert.throws(() => h.reviewInput({ ...f, [field]: value }))
  assert.throws(() => h.reviewInput({ ...f, comment: "x".repeat(2001) }))
})
test("Review creation is restricted to owner CLIENT after actual completion and acceptance", async (t) => {
  const h = await harness(t)
  const completed = {
    ...context(),
    assignment: { ...assignment, status: "COMPLETED" },
    job: { ...job, status: "COMPLETED" },
  }
  assert.equal(h.canReview(client, completed, false, true), true)
  for (const actor of [admin, freelancer, user(8, "CLIENT")])
    assert.equal(h.canReview(actor, completed, false, true), false)
  assert.equal(h.canReview(client, completed, true, true), false)
  assert.equal(h.canReview(client, completed, false, false), false)
  assert.equal(h.canReview(client, context(), false, true), false)
})
test("Review absence is recognized only by backend REVIEW_NOT_FOUND; forbidden/network failures remain errors", async (t) => {
  const h = await harness(t, () =>
    json({ code: "REVIEW_NOT_FOUND", message: "No review" }, 404),
  )
  assert.equal(await h.reviewsApi.get(44), null)
  for (const status of [401, 403, 500]) {
    const other = await harness(t, () =>
      json({ message: "Actual failure" }, status),
    )
    await assert.rejects(other.reviewsApi.get(44), (e) => e.status === status)
  }
})
test("Network failures never retry acceptance/review writes or substitute fixtures", async (t) => {
  const h = await harness(t, () => {
    throw new TypeError("offline")
  })
  await assert.rejects(
    h.acceptanceApi.accept(44, null, '"a1"'),
    (e) => e.status === 0,
  )
  await assert.rejects(h.reviewsApi.create(44, review), (e) => e.status === 0)
  assert.equal(h.calls.length, 2)
})
test("Missing aggregate versions fail closed with unknown-result error", async (t) => {
  const h = await harness(t, () =>
    json({ ...acceptance(), assignmentVersion: null }),
  )
  await assert.rejects(h.acceptanceApi.get(44), (e) => e.status === 0)
})
