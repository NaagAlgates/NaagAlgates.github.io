import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConflictError,
  PostStore,
  ValidationError,
  localToday,
  renderPostFile,
  serializeFrontmatter,
  sha256,
  slugify,
} from "./post-store.mjs";

async function makeDir() {
  return fsp.mkdtemp(join(tmpdir(), "blog-editor-test-"));
}

/** List collection-visible posts (the *.md glob view of the dir). */
async function mdFiles(dir) {
  return (await fsp.readdir(dir)).filter((f) => f.endsWith(".md") && !f.startsWith("."));
}

/**
 * Instrumented fs facade over the real filesystem. `before(op, path)` runs
 * ahead of each operation and may throw to inject a deterministic fault;
 * `after(op)` runs after each completed operation (invariant checks).
 */
function makeFsx({ before = () => {}, after = () => {} } = {}) {
  const wrapFh = (fh, path) => ({
    writeFile: async (...a) => { before("fh.writeFile", path); const r = await fh.writeFile(...a); await after("fh.writeFile"); return r; },
    stat: async () => { before("fh.stat", path); const r = await fh.stat(); await after("fh.stat"); return r; },
    readFile: async () => { before("fh.readFile", path); const r = await fh.readFile(); await after("fh.readFile"); return r; },
    close: async () => fh.close().catch(() => {}),
  });
  return {
    open: async (p, f) => { before("open", p); const fh = await fsp.open(p, f); await after("open"); return wrapFh(fh, p); },
    link: async (a, b) => { before("link", b); const r = await fsp.link(a, b); await after("link"); return r; },
    rename: async (a, b) => { before("rename", b); const r = await fsp.rename(a, b); await after("rename"); return r; },
    unlink: async (p) => { before("unlink", p); const r = await fsp.unlink(p); await after("unlink"); return r; },
  };
}

const INPUT = {
  title: "My Test Post",
  description: "A one-line summary.",
  tags: ["tech", "ai"],
  body: "# Hello\n\nSome **bold** text.",
};

test("slugify matches new-post.mjs rules", () => {
  assert.equal(slugify("My Post Title"), "my-post-title");
  assert.equal(slugify("Dart 3.10!"), "dart-3-10");
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify("日本語のみ"), "");
  assert.equal(slugify("../../etc/passwd"), "etc-passwd");
});

test("validation rejects empty/unslugifiable titles, empty description, bad tags", async () => {
  const store = new PostStore({ dir: await makeDir() });
  const cases = [
    { ...INPUT, title: "" },
    { ...INPUT, title: "!!!" },
    { ...INPUT, title: "日本語" },
    { ...INPUT, description: "  " },
    { ...INPUT, tags: ["ok", "!!!"] },
    { ...INPUT, tags: "not-an-array" },
  ];
  for (const input of cases) {
    await assert.rejects(store.save({ input, mode: "create" }), ValidationError);
  }
});

test("traversal-shaped titles cannot escape the blog dir", async () => {
  const dir = await makeDir();
  const store = new PostStore({ dir });
  const res = await store.save({
    input: { ...INPUT, title: "../../outside attack" },
    mode: "create",
  });
  assert.ok(res.path.startsWith(dir + "/"));
  assert.equal(res.slug, "outside-attack");
  assert.deepEqual(await mdFiles(dir), ["outside-attack.md"]);
});

test("create is exclusive: existing post survives byte-identical", async () => {
  const dir = await makeDir();
  const existing = join(dir, "my-test-post.md");
  await fsp.writeFile(existing, "PRE-EXISTING\n");
  const store = new PostStore({ dir });
  await assert.rejects(store.save({ input: INPUT, mode: "create" }), ConflictError);
  assert.equal(await fsp.readFile(existing, "utf8"), "PRE-EXISTING\n");
});

test("create returns postId/rev and writes the established file shape", async () => {
  const dir = await makeDir();
  const clock = () => new Date("2026-03-05T10:00:00+10:00");
  const store = new PostStore({ dir, clock });
  const res = await store.save({ input: INPUT, mode: "create" });
  assert.ok(res.postId);
  const content = await fsp.readFile(res.path, "utf8");
  assert.equal(sha256(Buffer.from(content, "utf8")), res.rev);
  assert.match(content, /^---\ntitle: "My Test Post"\ndescription: "A one-line summary\."\npubDate: \d{4}-\d{2}-\d{2}\ntags: \["tech", "ai"\]\n---\n\n/);
});

test("update: happy path, stale rev, external-edit hash, replaced inode, unknown postId, retitle", async () => {
  const dir = await makeDir();
  const store = new PostStore({ dir });
  const created = await store.save({ input: INPUT, mode: "create" });
  const target = created.path;

  // happy re-save
  const updated = await store.save({
    input: { ...INPUT, body: "# Hello\n\nEdited." },
    mode: "update", postId: created.postId, rev: created.rev,
  });
  assert.notEqual(updated.rev, created.rev);
  assert.equal(updated.slug, created.slug);

  // stale rev (old rev after a successful update)
  await assert.rejects(
    store.save({ input: INPUT, mode: "update", postId: created.postId, rev: created.rev }),
    ConflictError,
  );

  // external in-place edit; client supplies the EXTERNAL edit's hash as rev
  const external = Buffer.from("---\ntitle: \"x\"\n---\nexternal edit\n");
  await fsp.writeFile(target, external);
  await assert.rejects(
    store.save({ input: INPUT, mode: "update", postId: created.postId, rev: sha256(external) }),
    ConflictError,
  );
  assert.deepEqual(await fsp.readFile(target), external); // untouched

  // registry rev correct but disk differs (external edit) -> conflict
  await assert.rejects(
    store.save({ input: INPUT, mode: "update", postId: created.postId, rev: updated.rev }),
    ConflictError,
  );
  assert.deepEqual(await fsp.readFile(target), external);

  // replaced file: same bytes as last save, but a NEW inode -> identity conflict
  const store2 = new PostStore({ dir: await makeDir() });
  const c2 = await store2.save({ input: INPUT, mode: "create" });
  const bytes2 = await fsp.readFile(c2.path);
  await fsp.unlink(c2.path);
  await fsp.writeFile(c2.path, bytes2);
  await assert.rejects(
    store2.save({ input: INPUT, mode: "update", postId: c2.postId, rev: c2.rev }),
    ConflictError,
  );

  // unknown postId (legacy post with correct current hash) -> refused
  const store3 = new PostStore({ dir });
  await assert.rejects(
    store3.save({ input: INPUT, mode: "update", postId: "not-registered", rev: sha256(external) }),
    ConflictError,
  );

  // retitle: update still targets the registered slug, not the new title
  const dir4 = await makeDir();
  const store4 = new PostStore({ dir: dir4 });
  const c4 = await store4.save({ input: INPUT, mode: "create" });
  const r4 = await store4.save({
    input: { ...INPUT, title: "Completely Different Title" },
    mode: "update", postId: c4.postId, rev: c4.rev,
  });
  assert.equal(r4.slug, c4.slug);
  assert.deepEqual(await mdFiles(dir4), [`${c4.slug}.md`]);
});

test("pubDate stays stable across re-saves", async () => {
  const dir = await makeDir();
  let now = new Date("2026-03-05T10:00:00+10:00");
  const store = new PostStore({ dir, clock: () => now });
  const created = await store.save({ input: INPUT, mode: "create" });
  now = new Date("2026-03-09T10:00:00+10:00");
  const updated = await store.save({ input: INPUT, mode: "update", postId: created.postId, rev: created.rev });
  assert.equal(updated.pubDate, created.pubDate);
  const content = await fsp.readFile(created.path, "utf8");
  assert.match(content, new RegExp(`pubDate: ${created.pubDate}\n`));
});

test("atomic visibility: target is always a complete old or new post", async () => {
  const dir = await makeDir();
  const allowed = new Set(); // exact byte-strings permitted to be visible
  const fsx = makeFsx({
    after: async () => {
      for (const f of await mdFiles(dir)) {
        const content = await fsp.readFile(join(dir, f), "utf8");
        assert.ok(allowed.has(content), `partial/unexpected content visible in ${f}`);
      }
    },
  });
  const clock = () => new Date("2026-03-05T10:00:00+10:00");
  const store = new PostStore({ dir, fsx, clock });
  const pubDate = localToday(clock());

  const v1 = renderPostFile({ ...INPUT, pubDate }, INPUT.body);
  allowed.add(v1);
  const created = await store.save({ input: INPUT, mode: "create" });

  const body2 = "# Hello\n\nRewritten body.";
  const v2 = renderPostFile({ ...INPUT, pubDate }, body2);
  allowed.add(v2);
  await store.save({ input: { ...INPUT, body: body2 }, mode: "update", postId: created.postId, rev: created.rev });
  assert.equal(await fsp.readFile(created.path, "utf8"), v2);
});

test("interruption at each boundary leaves a complete post and recoverable state", async () => {
  // Ops in create order: unlink(stale tmp), open(tmp), fh.writeFile, fh.stat, link, unlink(tmp)
  // Ops in update order: open(target), fh.stat, fh.readFile, unlink(stale tmp), open(tmp), fh.writeFile, fh.stat, rename
  const failAt = async (opToFail, occurrence, mode) => {
    const dir = await makeDir();
    let fault = null;
    let seen = 0;
    const fsx = makeFsx({
      before: (op) => {
        if (fault && op === fault.op && ++seen === fault.n) throw new Error(`injected ${op} failure`);
      },
    });
    const store = new PostStore({ dir, fsx });
    let created;
    if (mode === "update") {
      created = await store.save({ input: INPUT, mode: "create" });
    }
    const before = created ? await fsp.readFile(created.path, "utf8") : null;

    fault = { op: opToFail, n: occurrence };
    seen = 0;
    const attempt = created
      ? store.save({ input: { ...INPUT, body: "changed" }, mode: "update", postId: created.postId, rev: created.rev })
      : store.save({ input: INPUT, mode: "create" });
    await assert.rejects(attempt, /injected/);
    fault = null;

    // Invariants: complete post preserved (update) / no partial .md (create);
    // at most glob-invisible residue; a subsequent save works.
    if (created) {
      assert.equal(await fsp.readFile(created.path, "utf8"), before, `${mode}:${opToFail} damaged the target`);
      const retry = await store.save({ input: { ...INPUT, body: "changed" }, mode: "update", postId: created.postId, rev: created.rev });
      assert.ok(retry.rev);
    } else {
      assert.deepEqual(await mdFiles(dir), [], `create:${opToFail} left a visible .md`);
      const retry = await store.save({ input: INPUT, mode: "create" });
      assert.ok(retry.rev);
    }
  };

  await failAt("open", 1, "create"); // open(tmp) — wx
  await failAt("fh.writeFile", 1, "create");
  await failAt("link", 1, "create");
  await failAt("open", 1, "update"); // open(target)
  await failAt("fh.readFile", 1, "update");
  await failAt("open", 2, "update"); // open(tmp)
  await failAt("fh.writeFile", 1, "update");
  await failAt("rename", 1, "update");
});

test("concurrency: parallel creates and same-rev updates serialize; one winner", async () => {
  const dir = await makeDir();
  const store = new PostStore({ dir });
  const [a, b] = await Promise.allSettled([
    store.save({ input: INPUT, mode: "create" }),
    store.save({ input: INPUT, mode: "create" }),
  ]);
  const outcomes = [a.status, b.status].sort();
  assert.deepEqual(outcomes, ["fulfilled", "rejected"]);
  const winner = a.status === "fulfilled" ? a.value : b.value;

  const [u1, u2] = await Promise.allSettled([
    store.save({ input: { ...INPUT, body: "u1" }, mode: "update", postId: winner.postId, rev: winner.rev }),
    store.save({ input: { ...INPUT, body: "u2" }, mode: "update", postId: winner.postId, rev: winner.rev }),
  ]);
  assert.deepEqual([u1.status, u2.status].sort(), ["fulfilled", "rejected"]);
  const loser = u1.status === "rejected" ? u1 : u2;
  assert.ok(loser.reason instanceof ConflictError);
});

test("YAML: adversarial scalars round-trip exactly", async () => {
  const dir = await makeDir();
  const store = new PostStore({ dir });
  const nasty = {
    title: 'He said "yes" — #1: [ok] x', // quotes, #, brackets
    description: 'line1\nline2 --- "quoted" #tag [a,b]',
    tags: ['c# stuff', 'a"b', "x [y] z", "tag: colon"],
    body: "Body with --- and #.",
  };
  const res = await store.save({ input: nasty, mode: "create" });
  const content = await fsp.readFile(res.path, "utf8");
  const lines = content.split("\n");
  assert.equal(lines[0], "---");
  assert.equal(JSON.parse(lines[1].slice("title: ".length)), nasty.title);
  assert.equal(JSON.parse(lines[2].slice("description: ".length)), nasty.description);
  assert.match(lines[3], /^pubDate: \d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(JSON.parse(lines[4].slice("tags: ".length)), nasty.tags);
  assert.equal(lines[5], "---");
  // frontmatter fence is not broken early by embedded '---'
  assert.equal(lines.slice(1, 5).filter((l) => l === "---").length, 0);
});

test("serializeFrontmatter emits the established shape", () => {
  const fm = serializeFrontmatter({
    title: "T", description: "D", pubDate: "2026-03-05", tags: ["a", "b"],
  });
  assert.equal(fm, '---\ntitle: "T"\ndescription: "D"\npubDate: 2026-03-05\ntags: ["a", "b"]\n---');
});

test("localToday uses the local calendar date, not UTC", () => {
  // 2026-01-01T15:00Z is 2026-01-02 01:00 in Brisbane (UTC+10):
  // toISOString() would say 2026-01-01 — the pre-existing quirk this fixes.
  const instant = new Date("2026-01-01T15:00:00Z");
  assert.equal(localToday(instant, "Australia/Brisbane"), "2026-01-02");
  assert.equal(instant.toISOString().slice(0, 10), "2026-01-01");
  assert.match(localToday(new Date(), undefined), /^\d{4}-\d{2}-\d{2}$/);
});
