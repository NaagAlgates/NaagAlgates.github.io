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

test("atomic visibility: target is always a complete old or new post, never absent", async () => {
  const dir = await makeDir();
  const allowed = new Set(); // exact byte-strings permitted to be visible
  let targetMustExist = null; // during update, the target may never be absent
  const fsx = makeFsx({
    after: async () => {
      for (const f of await mdFiles(dir)) {
        const content = await fsp.readFile(join(dir, f), "utf8");
        assert.ok(allowed.has(content), `partial/unexpected content visible in ${f}`);
      }
      if (targetMustExist) {
        const content = await fsp.readFile(targetMustExist, "utf8");
        assert.ok(allowed.has(content), "update target absent or partial mid-save");
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
  targetMustExist = created.path; // never-absent invariant, checked at every op
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
  await failAt("fh.stat", 1, "create"); // stat(tmp) before link
  await failAt("link", 1, "create");
  await failAt("open", 1, "update"); // open(target)
  await failAt("fh.stat", 1, "update"); // fstat(target) identity check
  await failAt("fh.readFile", 1, "update"); // hash(target) freshness check
  await failAt("open", 2, "update"); // open(tmp)
  await failAt("fh.writeFile", 1, "update");
  await failAt("fh.stat", 2, "update"); // fstat(tmp) pre-publish
  await failAt("rename", 1, "update");
  // After a successful rename only a synchronous in-memory registry
  // assignment remains (values pre-computed before publish, per plan D3) —
  // there is no fs operation left to interrupt. A cleanup-unlink failure
  // after create's link must NOT fail the save:
  {
    const dir = await makeDir();
    let fault = false;
    const fsx = makeFsx({
      before: (op, p) => {
        if (fault && op === "unlink" && p.endsWith(".tmp")) throw new Error("injected unlink failure");
      },
    });
    const store = new PostStore({ dir, fsx });
    fault = true;
    const res = await store.save({ input: INPUT, mode: "create" });
    assert.ok(res.rev, "create must succeed even if temp cleanup fails");
    assert.deepEqual(await mdFiles(dir), [`${res.slug}.md`]);
  }
});

test("concurrency: mixed create/update interleavings serialize safely", async () => {
  const dir = await makeDir();
  const store = new PostStore({ dir });
  const first = await store.save({ input: INPUT, mode: "create" });
  const other = { ...INPUT, title: "Another Post Entirely" };
  const results = await Promise.allSettled([
    store.save({ input: { ...INPUT, body: "u1" }, mode: "update", postId: first.postId, rev: first.rev }),
    store.save({ input: other, mode: "create" }),
    store.save({ input: { ...INPUT, body: "u2" }, mode: "update", postId: first.postId, rev: first.rev }),
  ]);
  // The unrelated create always succeeds; exactly one same-rev update wins.
  assert.equal(results[1].status, "fulfilled");
  assert.deepEqual([results[0].status, results[2].status].sort(), ["fulfilled", "rejected"]);
  assert.deepEqual((await mdFiles(dir)).sort(), ["another-post-entirely.md", "my-test-post.md"]);
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

test("YAML: adversarial scalars round-trip through Astro's actual parser", async () => {
  // js-yaml is the frontmatter parser Astro itself depends on.
  const { load } = await import("js-yaml");
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
  // Extract the frontmatter block exactly the way a frontmatter splitter
  // does: first fence line to the next fence line.
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "frontmatter fences not found or broken by embedded ---");
  const parsed = load(m[1]);
  assert.equal(parsed.title, nasty.title);
  assert.equal(parsed.description, nasty.description);
  assert.deepEqual(parsed.tags, nasty.tags);
  const dateStr = parsed.pubDate instanceof Date
    ? parsed.pubDate.toISOString().slice(0, 10)
    : String(parsed.pubDate);
  assert.match(dateStr, /^\d{4}-\d{2}-\d{2}$/);
  // body preserved after the fence
  assert.equal(content.slice(m[0].length), "\nBody with --- and #.\n");
});

test("validation: empty-string tags and over-long slugs are rejected", async () => {
  const store = new PostStore({ dir: await makeDir() });
  await assert.rejects(
    store.save({ input: { ...INPUT, tags: ["tech", ""] }, mode: "create" }),
    ValidationError,
  );
  await assert.rejects(
    store.save({ input: { ...INPUT, title: "x".repeat(250) }, mode: "create" }),
    ValidationError,
  );
});

test("getLastSave serializes behind in-flight saves — no phantom, no missing state", async () => {
  const dir = await makeDir();
  const store = new PostStore({ dir });

  // Read issued WHILE a create is in flight resolves to that create's result.
  const saving = store.save({ input: INPUT, mode: "create" });
  const reading = store.getLastSave();
  const [created, observed] = await Promise.all([saving, reading]);
  assert.equal(observed.postId, created.postId);
  assert.equal(observed.rev, created.rev);

  // Read issued while a FAILING create is in flight never sees a phantom:
  // it resolves to the previous successful save.
  const failing = store.save({ input: INPUT, mode: "create" }); // duplicate slug
  const reading2 = store.getLastSave();
  await assert.rejects(failing, ConflictError);
  const observed2 = await reading2;
  assert.equal(observed2.postId, created.postId);
  assert.equal(observed2.rev, created.rev);

  // A store with no successful save yet (failing create only) reports null.
  const dir3 = await makeDir();
  await fsp.writeFile(join(dir3, "my-test-post.md"), "existing\n");
  const store3 = new PostStore({ dir: dir3 });
  const failing3 = store3.save({ input: INPUT, mode: "create" });
  const reading3 = store3.getLastSave();
  await assert.rejects(failing3, ConflictError);
  assert.equal(await reading3, null);
});

test("hasTitledImage: exact CommonMark semantics, including escaped forms", async () => {
  const { hasTitledImage } = await import("./markdown-flags.mjs");
  const positive = [
    '![alt](https://e.com/i.png "title")',
    "![alt](https://e.com/i.png 'title')",
    "![alt](https://e.com/i.png (title))",
    '![alt](<https://e.com/my image.png> "title")',
    '![alt](https://e.com/i_(1).png "title")', // balanced parens in dest
    '![alt](i.png "he said \\"hi\\"")', // escaped quotes in title
    '![a\\]b](u.png "title")', // escaped bracket in alt
    "![alt](u.png (a\\)b))", // escaped paren in title
    'text before ![a](u.png "t") after',
    '![alt][img]\n\n[img]: /image.png "title"',
    "![alt][]\n\n[alt]: /image.png 'title'", // collapsed reference
    "![alt]\n\n[alt]: /image.png (title)", // shortcut reference
    '![alt][Spaced Label]\n\n[spaced   label]: /image.png "title"', // normalized identifier
  ];
  const negative = [
    "![alt](https://e.com/i.png)",
    "![alt](<https://e.com/my image.png>)",
    '[not an image](u.png "t")',
    'plain text with "quotes" and (parens)',
    '`![alt](u.png "t")` in inline code is not an image',
    '```\n![alt](u.png "t")\n```\nfenced code is not an image',
    "![alt][img]\n\n[img]: /image.png", // referenced definition has no title
    '[link][img]\n\n[img]: /image.png "title"', // titled definition is not used by an image
    '[img]: /image.png "title"', // unreferenced titled definition
  ];
  for (const s of positive) assert.ok(hasTitledImage(s), `should detect: ${s}`);
  for (const s of negative) assert.ok(!hasTitledImage(s), `should not detect: ${s}`);
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

// ---------------------------------------------------------------------------
// Issue #53: open/edit existing posts — strict parser, open-time refusals,
// adoption into the ownership registry, and the post listing.

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  NESTED_POST_REASON,
  SAVE_BODY_LIMIT,
  openRefusalReason,
  parseFrontmatter,
} from "./post-store.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_BLOG_DIR = join(HERE, "..", "..", "src", "content", "blog");

/** A corpus-shaped legacy post file. */
function legacyFile({
  title = "A Legacy Post",
  description = "A legacy description.",
  pubDate = "2021-03-04",
  tags = ["Kotlin", "Hackerank"],
  body = "Intro paragraph.\n\n## Heading\n\nMore text.",
} = {}) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\npubDate: ${pubDate}\ntags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]\n---\n\n${body}\n`;
}

test("parseFrontmatter: exact editor shape round-trips all four fields + body bytes", () => {
  const body = 'Text with "quotes" and\n\n```html\n<iframe></iframe>\n```\n\nEnd.';
  const file = legacyFile({ title: 'He said "hi" — ok', body });
  const parsed = parseFrontmatter(file);
  assert.equal(parsed.title, 'He said "hi" — ok');
  assert.equal(parsed.description, "A legacy description.");
  assert.equal(parsed.pubDate, "2021-03-04");
  assert.deepEqual(parsed.tags, ["Kotlin", "Hackerank"]);
  assert.equal(parsed.body, `${body}\n`); // byte-exact incl. trailing newline
  // And the writer reproduces the file byte-for-byte.
  assert.equal(renderPostFile({ ...parsed, pubDate: parsed.pubDate }, parsed.body), file);
});

test("parseFrontmatter: refusals — unknown/reordered keys, formats, non-canonical spellings", () => {
  const refuse = (text, why) =>
    assert.throws(() => parseFrontmatter(text), ConflictError, why);
  // Schema-optional keys the editor doesn't model are refused, never dropped
  // — and the refusal message NAMES the unsupported key (criterion 3).
  assert.throws(
    () => parseFrontmatter('---\ntitle: "T"\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a"]\nupdatedDate: 2022-01-01\n---\n\nB\n'),
    (err) => err instanceof ConflictError && /"updatedDate"/.test(err.message),
  );
  assert.throws(
    () => parseFrontmatter('---\ntitle: "T"\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a"]\nimage: "/x.png"\n---\n\nB\n'),
    (err) => err instanceof ConflictError && /"image"/.test(err.message),
  );
  // A reordered key is named too.
  assert.throws(
    () => parseFrontmatter('---\ndescription: "D"\ntitle: "T"\npubDate: 2021-01-01\ntags: ["a"]\n---\n\nB\n'),
    (err) => err instanceof ConflictError && /"description"/.test(err.message),
  );
  // Missing key (only three).
  refuse('---\ntitle: "T"\ndescription: "D"\npubDate: 2021-01-01\n---\n\nB\n');
  // Unquoted scalar.
  refuse('---\ntitle: Plain Title\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a"]\n---\n\nB\n');
  // Non-canonical escape spelling (a === "a") would be respelled on save.
  refuse('---\ntitle: "\\u0061bc"\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a"]\n---\n\nB\n');
  // Non-canonical tag spacing.
  refuse('---\ntitle: "T"\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a","b"]\n---\n\nB\n');
  // Bad pubDate forms.
  refuse('---\ntitle: "T"\ndescription: "D"\npubDate: 2021-13-45\ntags: ["a"]\n---\n\nB\n');
  refuse('---\ntitle: "T"\ndescription: "D"\npubDate: "2021-01-01"\ntags: ["a"]\n---\n\nB\n');
  // No frontmatter at all.
  refuse("# Just markdown\n");
});

test("parseFrontmatter: empty-body layouts round-trip byte-exactly", () => {
  // `---\n` at EOF: the split artifact must NOT read as a blank separator.
  const bare = '---\ntitle: "T"\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a"]\n---\n';
  const p1 = parseFrontmatter(bare);
  assert.equal(p1.blankAfterFrontmatter, false);
  assert.equal(p1.body, "");
  assert.equal(
    renderPostFile({ ...p1, pubDate: p1.pubDate }, p1.body, { blankAfterFrontmatter: p1.blankAfterFrontmatter }),
    bare,
  );
  // `---\n\n` at EOF: a real (empty) separator layout.
  const sep = `${bare}\n`;
  const p2 = parseFrontmatter(sep);
  assert.equal(p2.blankAfterFrontmatter, true);
  assert.equal(p2.body, "");
  assert.equal(
    renderPostFile({ ...p2, pubDate: p2.pubDate }, p2.body, { blankAfterFrontmatter: p2.blankAfterFrontmatter }),
    sep,
  );
});

test("parseFrontmatter: the legacy no-blank-line layout parses and round-trips byte-exactly", () => {
  // 18 of the 20 real posts start the body right after the closing ---.
  const file = '---\ntitle: "T"\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a"]\n---\nBody first line.\n\nMore.\n';
  const parsed = parseFrontmatter(file);
  assert.equal(parsed.blankAfterFrontmatter, false);
  assert.equal(parsed.body, "Body first line.\n\nMore.\n");
  assert.equal(
    renderPostFile({ ...parsed, pubDate: parsed.pubDate }, parsed.body, {
      blankAfterFrontmatter: parsed.blankAfterFrontmatter,
    }),
    file,
  );
});

test("openRefusalReason: every UI-round-trip hazard refuses; clean posts pass", () => {
  const meta = (over = {}) => ({
    title: "Fine Title",
    description: "Fine description.",
    tags: ["tech"],
    ...over,
  });
  assert.equal(openRefusalReason(meta(), "body"), null);
  assert.match(openRefusalReason(meta({ description: "   " }), "b"), /description is blank/);
  assert.match(openRefusalReason(meta({ title: "Two\nLines" }), "b"), /spans multiple lines/);
  assert.match(openRefusalReason(meta({ title: " Padded " }), "b"), /leading\/trailing whitespace/);
  assert.match(openRefusalReason(meta({ description: "d\r\ne" }), "b"), /spans multiple lines/);
  assert.match(openRefusalReason(meta({ tags: ["ok", "a,b"] }), "b"), /contains a comma/);
  assert.match(openRefusalReason(meta({ tags: [" pad "] }), "b"), /surrounding whitespace/);
  assert.match(openRefusalReason(meta({ tags: [""] }), "b"), /empty tag/);
  assert.match(openRefusalReason(meta({ tags: ["日本語"] }), "b"), /no slug form/);
  assert.match(openRefusalReason(meta({ title: "!!!" }), "b"), /no slug form/);
  assert.match(openRefusalReason(meta({ title: "x".repeat(220) }), "b"), /200-character/);
  // Hazard 8: a body that cannot fit the save cap refuses at open (UTF-8 bytes).
  const hugeBody = "é".repeat(SAVE_BODY_LIMIT / 2); // 2 bytes each in UTF-8
  assert.match(openRefusalReason(meta(), hugeBody), /too large to save/);
});

test("adopt: open an existing post, edit, save — pubDate preserved, no rename", async () => {
  const dir = await makeDir();
  const original = legacyFile({ title: "Old Post", pubDate: "2019-08-07" });
  await fsp.writeFile(join(dir, "old-post-file.md"), original);
  const store = new PostStore({ dir, clock: () => new Date("2026-07-19T10:00:00") });

  const posts = await store.listPosts();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].openable, true);
  assert.equal(posts[0].relPath, "old-post-file.md");
  assert.equal(posts[0].title, "Old Post");

  const opened = await store.openPost(posts[0].fileId);
  assert.ok(opened.postId);
  assert.equal(opened.pubDate, "2019-08-07");
  assert.equal(opened.slug, "old-post-file");
  assert.equal(opened.wysiwygUnsafe, false);
  assert.equal(renderPostFile({ ...opened, pubDate: opened.pubDate }, opened.body), original);

  // No-edit save: byte-identical file (single trailing newline already).
  const saved = await store.save({
    input: { title: opened.title, description: opened.description, tags: opened.tags, body: opened.body },
    mode: "update",
    postId: opened.postId,
    rev: opened.rev,
  });
  assert.equal(await fsp.readFile(join(dir, "old-post-file.md"), "utf8"), original);

  // Title edit: same file updated, pubDate still original, never renamed.
  await store.save({
    input: { title: "Renamed Title", description: opened.description, tags: opened.tags, body: "New body.\n" },
    mode: "update",
    postId: opened.postId,
    rev: saved.rev,
  });
  assert.deepEqual(await mdFiles(dir), ["old-post-file.md"]);
  const after = await fsp.readFile(join(dir, "old-post-file.md"), "utf8");
  assert.match(after, /^title: "Renamed Title"$/m);
  assert.match(after, /^pubDate: 2019-08-07$/m);
});

test("adopt: conflict semantics — external edit, replaced inode, stale rev, unknown fileId", async () => {
  const dir = await makeDir();
  const file = join(dir, "legacy.md");
  await fsp.writeFile(file, legacyFile());
  const store = new PostStore({ dir });
  const [{ fileId }] = await store.listPosts();

  // Unknown fileId → refused, nothing touched.
  await assert.rejects(store.openPost("not-a-minted-id"), ConflictError);

  // External in-place edit between open and save → 409, file untouched.
  const opened = await store.openPost(fileId);
  const external = legacyFile({ body: "Externally edited." });
  await fsp.writeFile(file, external);
  await assert.rejects(
    store.save({
      input: { title: opened.title, description: opened.description, tags: opened.tags, body: "mine" },
      mode: "update",
      postId: opened.postId,
      rev: opened.rev,
    }),
    ConflictError,
  );
  assert.equal(await fsp.readFile(file, "utf8"), external);

  // Replaced file (same bytes, new inode) → 409 (identity check).
  const opened2 = await store.openPost(fileId);
  const bytes = await fsp.readFile(file);
  await fsp.unlink(file);
  await fsp.writeFile(file, bytes);
  await assert.rejects(
    store.save({
      input: { title: opened2.title, description: opened2.description, tags: opened2.tags, body: "mine" },
      mode: "update",
      postId: opened2.postId,
      rev: opened2.rev,
    }),
    ConflictError,
  );

  // Two adoptions of one file: first save wins, second 409s (never merged).
  const a = await store.openPost(fileId);
  const b = await store.openPost(fileId);
  await store.save({
    input: { title: a.title, description: a.description, tags: a.tags, body: "A's edit." },
    mode: "update",
    postId: a.postId,
    rev: a.rev,
  });
  await assert.rejects(
    store.save({
      input: { title: b.title, description: b.description, tags: b.tags, body: "B's edit." },
      mode: "update",
      postId: b.postId,
      rev: b.rev, // stale: A already published
    }),
    ConflictError,
  );
  assert.match(await fsp.readFile(file, "utf8"), /A's edit\./);
});

test("adopt: open refuses un-round-trippable and unknown-key files; listing surfaces reasons", async () => {
  const dir = await makeDir();
  await fsp.writeFile(join(dir, "good.md"), legacyFile({ title: "Good" }));
  await fsp.writeFile(
    join(dir, "extra-key.md"),
    '---\ntitle: "T"\ndescription: "D"\npubDate: 2021-01-01\ntags: ["a"]\nupdatedDate: 2022-01-01\n---\n\nB\n',
  );
  await fsp.writeFile(join(dir, "comma-tag.md"), legacyFile({ tags: ["a,b"] }));
  await fsp.writeFile(join(dir, ".hidden.md"), legacyFile());
  await fsp.writeFile(join(dir, ".good.md.tmp"), "stale temp");
  // Underscore files ARE collection members under the v5 glob loader (the
  // seo tests build pages for them) — they must be listed and openable.
  await fsp.writeFile(join(dir, "_underscore.md"), legacyFile({ title: "Underscore" }));
  // Symlinked .md: outside the write model (inode identity), never listed.
  await fsp.writeFile(join(dir, "..outside-target.md"), legacyFile());
  await fsp.symlink(join(dir, "..outside-target.md"), join(dir, "sym-link.md"));
  await fsp.mkdir(join(dir, "series"));
  await fsp.writeFile(join(dir, "series", "nested.md"), legacyFile());
  await fsp.mkdir(join(dir, ".omc"));
  await fsp.writeFile(join(dir, ".omc", "state.md"), "not a post");

  const store = new PostStore({ dir });
  const posts = await store.listPosts();
  const byPath = Object.fromEntries(posts.map((p) => [p.relPath, p]));

  // Dotfiles, temps, dot-dirs, and symlinks never appear; underscore files do.
  assert.deepEqual(Object.keys(byPath).sort(), [
    "_underscore.md",
    "comma-tag.md",
    "extra-key.md",
    "good.md",
    "series/nested.md",
  ]);
  assert.equal(byPath["good.md"].openable, true);
  assert.equal(byPath["_underscore.md"].openable, true);
  assert.equal(byPath["extra-key.md"].openable, false);
  assert.match(byPath["extra-key.md"].reason, /"updatedDate"/);
  assert.equal(byPath["comma-tag.md"].openable, false);
  assert.match(byPath["comma-tag.md"].reason, /comma/);
  assert.equal(byPath["series/nested.md"].openable, false);
  assert.equal(byPath["series/nested.md"].reason, NESTED_POST_REASON);

  // openPost enforces the same refusals (409-shaped ConflictError).
  await assert.rejects(store.openPost(byPath["extra-key.md"].fileId), ConflictError);
  await assert.rejects(store.openPost(byPath["comma-tag.md"].fileId), ConflictError);
  await assert.rejects(store.openPost(byPath["series/nested.md"].fileId), ConflictError);

  // fileIds are stable across repeated listings.
  const again = await store.listPosts();
  assert.equal(again.find((p) => p.relPath === "good.md").fileId, byPath["good.md"].fileId);

  // openPost refusal reasons are distinct per D3 case (criterion 9), not one
  // generic message.
  await assert.rejects(store.openPost(byPath["comma-tag.md"].fileId), /comma/);
  await fsp.writeFile(join(dir, "multiline.md"), legacyFile({ title: "Two\nLines" }));
  await fsp.writeFile(join(dir, "blank-desc.md"), legacyFile({ description: "   " }));
  const withNew = await store.listPosts();
  const idOf = (rel) => withNew.find((p) => p.relPath === rel).fileId;
  await assert.rejects(store.openPost(idOf("multiline.md")), /multiple lines/);
  await assert.rejects(store.openPost(idOf("blank-desc.md")), /description is blank/);

  // Pruning (plan D1 rebuild semantics): a deleted file's token vanishes on
  // the next listing and its old fileId can no longer open anything.
  const goodId = byPath["good.md"].fileId;
  await fsp.unlink(join(dir, "good.md"));
  const afterDelete = await store.listPosts();
  assert.equal(afterDelete.find((p) => p.relPath === "good.md"), undefined);
  await assert.rejects(store.openPost(goodId), /unknown fileId/);
});

test("adopt: invalid UTF-8 refuses at open (a save would rewrite the bytes)", async () => {
  const dir = await makeDir();
  const good = Buffer.from(legacyFile(), "utf8");
  const corrupt = Buffer.concat([good.subarray(0, good.length - 2), Buffer.from([0xff, 0xfe]), good.subarray(good.length - 2)]);
  await fsp.writeFile(join(dir, "corrupt.md"), corrupt);
  const store = new PostStore({ dir });
  const posts = await store.listPosts();
  assert.equal(posts[0].openable, false);
  assert.match(posts[0].reason, /not valid UTF-8/);
  await assert.rejects(store.openPost(posts[0].fileId), /not valid UTF-8/);
  // Untouched on refusal.
  assert.ok((await fsp.readFile(join(dir, "corrupt.md"))).equals(corrupt));
});

test("listing order: pubDate descending, ties by relPath, no-date entries last", async () => {
  const dir = await makeDir();
  await fsp.writeFile(join(dir, "old.md"), legacyFile({ pubDate: "2020-01-01" }));
  await fsp.writeFile(join(dir, "newest.md"), legacyFile({ pubDate: "2026-07-18" }));
  await fsp.writeFile(join(dir, "mid-b.md"), legacyFile({ pubDate: "2023-05-05" }));
  await fsp.writeFile(join(dir, "mid-a.md"), legacyFile({ pubDate: "2023-05-05" }));
  await fsp.writeFile(join(dir, "unparseable.md"), "# not a post\n");
  await fsp.mkdir(join(dir, "series"));
  await fsp.writeFile(join(dir, "series", "nested.md"), legacyFile({ pubDate: "2027-01-01" }));
  const store = new PostStore({ dir });
  const order = (await store.listPosts()).map((p) => p.relPath);
  assert.deepEqual(order, [
    "newest.md",
    "mid-a.md",
    "mid-b.md",
    "old.md",
    "series/nested.md", // no parsed pubDate (nested posts aren't read)
    "unparseable.md",
  ]);
});

test("adopt: wysiwygUnsafe is the union of all lossy detectors", async () => {
  const dir = await makeDir();
  await fsp.writeFile(join(dir, "iframe.md"), legacyFile({ body: '<div class="video">\n<iframe src="https://x"></iframe>\n</div>' }));
  await fsp.writeFile(join(dir, "titled.md"), legacyFile({ body: 'Intro.\n\n![alt](/images/x.png "a title")' }));
  await fsp.writeFile(join(dir, "clean.md"), legacyFile({ body: "Plain **markdown** only." }));
  const store = new PostStore({ dir });
  const posts = await store.listPosts();
  const open = async (rel) => store.openPost(posts.find((p) => p.relPath === rel).fileId);
  assert.equal((await open("iframe.md")).wysiwygUnsafe, true);
  assert.equal((await open("titled.md")).wysiwygUnsafe, true); // titled-image-only fixture
  assert.equal((await open("clean.md")).wysiwygUnsafe, false);
});

// The 19 git-tracked posts — pinned by name so a silently missing or
// deleted corpus post FAILS this suite (a derived-only expectation would
// shrink with the directory and still pass). Working trees may hold extra
// drafts; those are covered by the derived comparison below.
const TRACKED_POSTS = [
  "2d-search-kotlin-hackerrank.md",
  "acm-icpc-team-finder-algorithm.md",
  "back-to-blogging.md",
  "base-calse-in-dart.md",
  "breaking-the-record.md",
  "companion-object-vs-factory-keyword.md",
  "exploring-the-searchbar-widget-in-flutter.md",
  "final-keyword-for-classes.md",
  "flutter-refreshindicator-widget.md",
  "interface-keyword-in-dart.md",
  "isolates-in-dart.md",
  "sealed-classes-in-kotlin.md",
  "solid-principles-in-counter-app-riverpod.md",
  "switch-expression-in-dart-310.md",
  "understanding-livedata-stateflow-sharedflow-and-flow-in-android.md",
  "what-is-floor-dart.md",
  "what-is-never-in-dart.md",
  "whats-is-managed-and-unmanaged-code-in-dot-net.md",
  "why-or-how-fluter-renders-quickly.md",
];

test("real corpus: every current post lists as openable and parses (read-only)", async () => {
  // _seo-fixture-* files are transient artifacts of the concurrently-running
  // seo tests — excluded to keep this test deterministic under `node --test`
  // parallelism, not because the editor excludes them.
  const isFixture = (name) => name.startsWith("_seo-fixture-");
  const expected = (await fsp.readdir(REAL_BLOG_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith(".md") && !e.name.startsWith(".") && !isFixture(e.name))
    .map((e) => e.name)
    .sort();
  const store = new PostStore({ dir: REAL_BLOG_DIR });
  const posts = await store.listPosts();
  const topLevel = posts.filter((p) => !p.relPath.includes("/") && !isFixture(p.relPath));
  const listed = topLevel.map((p) => p.relPath).sort();
  assert.deepEqual(listed, expected);
  // Every pinned tracked post MUST be present — deletion/omission fails here.
  for (const name of TRACKED_POSTS) {
    assert.ok(listed.includes(name), `tracked post missing from listing: ${name}`);
  }
  // Newest-first ordering holds over the real corpus.
  for (let i = 1; i < topLevel.length; i++) {
    assert.ok(
      topLevel[i - 1].pubDate >= topLevel[i].pubDate,
      `${topLevel[i - 1].relPath} (${topLevel[i - 1].pubDate}) should sort before ${topLevel[i].relPath} (${topLevel[i].pubDate})`,
    );
  }
  for (const post of topLevel) {
    assert.equal(post.openable, true, `${post.relPath}: ${post.reason ?? ""}`);
    const opened = await store.openPost(post.fileId);
    // The writer must reproduce every current post byte-for-byte (allowing
    // only trailing-newline normalization) — proof of a faithful round-trip.
    const original = await fsp.readFile(join(REAL_BLOG_DIR, post.relPath), "utf8");
    const rewritten = renderPostFile({ ...opened, pubDate: opened.pubDate }, opened.body, {
      blankAfterFrontmatter: opened.blankAfterFrontmatter,
    });
    assert.equal(rewritten, original.replace(/\n+$/, "\n"), post.relPath);
  }
});

test("real corpus fixtures: no-edit save is byte-identical (escaped quotes, raw HTML)", async () => {
  for (const name of [
    "whats-is-managed-and-unmanaged-code-in-dot-net.md",
    "why-or-how-fluter-renders-quickly.md",
    "back-to-blogging.md",
  ]) {
    const dir = await makeDir();
    const original = await fsp.readFile(join(REAL_BLOG_DIR, name), "utf8");
    await fsp.writeFile(join(dir, name), original);
    const store = new PostStore({ dir });
    const [{ fileId, openable }] = await store.listPosts();
    assert.equal(openable, true, name);
    const opened = await store.openPost(fileId);
    await store.save({
      input: { title: opened.title, description: opened.description, tags: opened.tags, body: opened.body },
      mode: "update",
      postId: opened.postId,
      rev: opened.rev,
    });
    const after = await fsp.readFile(join(dir, name), "utf8");
    assert.equal(after, original.replace(/\n+$/, "\n"), name);
  }
});

test("adopt: a symlink swapped in after listing cannot be opened (O_NOFOLLOW)", async () => {
  const dir = await makeDir();
  await fsp.writeFile(join(dir, "victim.md"), legacyFile({ title: "Victim" }));
  const store = new PostStore({ dir });
  const [{ fileId }] = await store.listPosts();
  // TOCTOU: after listing (isFile passed), replace the path with a symlink.
  await fsp.unlink(join(dir, "victim.md"));
  await fsp.writeFile(join(dir, ".target.md"), legacyFile({ title: "Elsewhere" }));
  await fsp.symlink(join(dir, ".target.md"), join(dir, "victim.md"));
  await assert.rejects(store.openPost(fileId), /symlink/);

  // Same guard on the update path: adopt a real file, then swap the path for
  // a symlink pointing at the ORIGINAL inode (which would pass the ino check
  // if the open followed it).
  const dir2 = await makeDir();
  await fsp.writeFile(join(dir2, "post.md"), legacyFile());
  const store2 = new PostStore({ dir: dir2 });
  const [{ fileId: id2 }] = await store2.listPosts();
  const opened = await store2.openPost(id2);
  await fsp.rename(join(dir2, "post.md"), join(dir2, ".moved.md"));
  await fsp.symlink(join(dir2, ".moved.md"), join(dir2, "post.md"));
  await assert.rejects(
    store2.save({
      input: { title: opened.title, description: opened.description, tags: opened.tags, body: "x" },
      mode: "update",
      postId: opened.postId,
      rev: opened.rev,
    }),
    ConflictError,
  );
  // The real content (behind the moved file) is untouched.
  assert.equal(await fsp.readFile(join(dir2, ".moved.md"), "utf8"), legacyFile());
});
