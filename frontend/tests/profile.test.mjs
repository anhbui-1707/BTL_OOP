import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function harness(t, respond) {
  const folder = mkdtempSync(join(tmpdir(), "linkit-profile-"));
  t.after(() => {
    if (dirname(resolve(folder)) !== resolve(tmpdir()) || !basename(folder).startsWith("linkit-profile-")) throw Error("Unexpected test directory");
    rmSync(folder, { recursive: true });
  });
  for (const file of ["http", "platform"]) {
    const source = readFileSync(join(root, "src/api", `${file}.ts`), "utf8").replace("import.meta.env?.VITE_API_BASE_URL", '"https://api.linkit.test"');
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
      .replace(/from (["'])(\.\.?\/[^"']+)\1/g, (_, q, path) => `from ${q}${path}.mjs${q}`);
    writeFileSync(join(folder, `${file}.mjs`), compiled);
  }
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    return respond(calls.at(-1));
  };
  const transport = await import(pathToFileURL(join(folder, "http.mjs")).href);
  transport.configureApiTokenProvider(() => "test-profile-token");
  return { ...(await import(pathToFileURL(join(folder, "platform.mjs")).href)), calls };
}

test("profile skills send all editable fields and use atomic PUT; reload preserves values", async t => {
  let saved;
  const h = await harness(t, call => {
    if (call.options.body) saved = { id: 17, ...JSON.parse(call.options.body) };
    const result = call.options.method === "DELETE" ? undefined : call.options.method ? saved : [saved];
    return new Response(result ? JSON.stringify(result) : null, { status: result ? 200 : 204, headers: { "Content-Type": "application/json" } });
  });
  const input = { name: "Java", proficiency: 3, yearsExperience: 2 };
  assert.deepEqual(await h.skillApi.addMineByName(input), { id: 17, ...input });
  assert.equal(h.calls[0].options.method, "POST");
  const updated = { name: "Spring Boot", proficiency: 4, yearsExperience: 5 };
  assert.deepEqual(await h.skillApi.updateMine(17, updated), { id: 17, ...updated });
  assert.equal(h.calls[1].options.method, "PUT");
  assert.equal(h.calls[1].url.pathname, "/api/skills/me/17");
  assert.deepEqual(await h.skillApi.mine(), [{ id: 17, ...updated }]);
  await h.skillApi.removeMine(17);
  assert.equal(h.calls[3].options.method, "DELETE");
  for (const call of h.calls) {
    assert.equal(call.options.headers.get("Authorization"), "Bearer test-profile-token");
    assert.equal(call.options.credentials, "omit");
  }
});

test("failed profile edits propagate the error without issuing a delete", async t => {
  const h = await harness(t, () => new Response(JSON.stringify({ message: "Kỹ năng đã có trong hồ sơ." }), { status: 409, headers: { "Content-Type": "application/json" } }));
  await assert.rejects(h.skillApi.updateMine(17, { name: "Java", proficiency: 3, yearsExperience: 2 }), error => error.status === 409);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.method, "PUT");
});
