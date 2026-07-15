// migrate-inline-images: pure transform + CLI filesystem contract.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractInlineImages } from "../migrate-inline-images.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "migrate-inline-images.mjs");

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("png-payload"),
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("jpg-payload")]);

const FIXTURE_MD = [
  "", // two leading blank lines before the frontmatter — the symptom-B state
  "",
  "---",
  'title: "T"',
  'description: "D"',
  "pubDate: 2026-07-15",
  "tags: []",
  "---",
  "",
  "# Heading",
  "",
  `![first alt](data:image/png;base64,${PNG.toString("base64")})`,
  "",
  "middle text",
  "",
  `![](data:image/jpeg;base64,${JPG.toString("base64")})`,
  "",
].join("\n");

function runCli(args, { cwd, input } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd,
      input,
      encoding: "utf8",
    });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status ?? 1, stdout: String(err.stdout), stderr: String(err.stderr) };
  }
}

const makeDir = () => fsp.mkdtemp(join(tmpdir(), "migrate-images-"));

test("transform: extracts data URIs, rewrites refs, strips frontmatter prefix", () => {
  const { text, images, strippedPrefix } = extractInlineImages(FIXTURE_MD, { prefix: "post-" });
  assert.equal(strippedPrefix, true);
  assert.ok(text.startsWith("---\n"), "file must start with --- at byte 0");
  assert.equal(images.length, 2);
  assert.equal(images[0].name, "post-1.png");
  assert.deepEqual(images[0].buf, PNG);
  assert.equal(images[1].name, "post-2.jpg");
  assert.deepEqual(images[1].buf, JPG);
  assert.match(text, /!\[first alt\]\(\/images\/post-1\.png\)/);
  assert.match(text, /!\[\]\(\/images\/post-2\.jpg\)/);
  assert.equal(text.includes("data:image"), false);

  // idempotency: transforming the output again is a no-op
  const again = extractInlineImages(text, { prefix: "post-" });
  assert.equal(again.text, text);
  assert.equal(again.images.length, 0);
  assert.equal(again.strippedPrefix, false);
});

test("cli: refuses to run with no input (never scans the repo)", async () => {
  const dir = await makeDir();
  const res = runCli(["--images-dir", join(dir, "images")], { cwd: dir });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /no input/);
});

test("cli: --dry-run writes nothing at all", async () => {
  const dir = await makeDir();
  const imagesDir = join(dir, "images");
  const md = join(dir, "post.md");
  await fsp.writeFile(md, FIXTURE_MD);

  const res = runCli(["--dry-run", "--images-dir", imagesDir, md], { cwd: dir });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(await fsp.readFile(md, "utf8"), FIXTURE_MD); // untouched
  await assert.rejects(fsp.readdir(imagesDir)); // dir not even created
  assert.deepEqual(
    (await fsp.readdir(dir)).sort(),
    ["post.md"], // no .bak, no images dir
  );
});

test("cli: real run migrates, keeps exact backup, second run is a no-op", async () => {
  const dir = await makeDir();
  const imagesDir = join(dir, "images");
  const md = join(dir, "post.md");
  await fsp.writeFile(md, FIXTURE_MD);

  const res = runCli(["--images-dir", imagesDir, md], { cwd: dir });
  assert.equal(res.status, 0, res.stderr);
  const migrated = await fsp.readFile(md, "utf8");
  assert.ok(migrated.startsWith("---\n"));
  assert.equal(migrated.includes("data:image"), false);
  assert.deepEqual(await fsp.readFile(join(imagesDir, "post-1.png")), PNG);
  assert.deepEqual(await fsp.readFile(join(imagesDir, "post-2.jpg")), JPG);
  assert.equal(await fsp.readFile(`${md}.bak`, "utf8"), FIXTURE_MD); // exact bytes

  const rerun = runCli(["--images-dir", imagesDir, md], { cwd: dir });
  assert.equal(rerun.status, 0);
  assert.match(rerun.stdout, /clean/);
  assert.equal(await fsp.readFile(md, "utf8"), migrated); // unchanged
});

test("cli: aborts without writing when a destination exists with different content", async () => {
  const dir = await makeDir();
  const imagesDir = join(dir, "images");
  const md = join(dir, "post.md");
  await fsp.writeFile(md, FIXTURE_MD);
  await fsp.mkdir(imagesDir, { recursive: true });
  await fsp.writeFile(join(imagesDir, "post-1.png"), Buffer.from("impostor"));

  const res = runCli(["--images-dir", imagesDir, md], { cwd: dir });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /refusing to overwrite/);
  assert.equal(await fsp.readFile(md, "utf8"), FIXTURE_MD); // md untouched
  assert.deepEqual(await fsp.readFile(join(imagesDir, "post-1.png")), Buffer.from("impostor"));
});

test("cli: a conflict on a LATER image leaves EARLIER images unwritten (all-or-nothing)", async () => {
  const dir = await makeDir();
  const imagesDir = join(dir, "images");
  const md = join(dir, "post.md");
  await fsp.writeFile(md, FIXTURE_MD);
  await fsp.mkdir(imagesDir, { recursive: true });
  // conflict on the SECOND image only
  await fsp.writeFile(join(imagesDir, "post-2.jpg"), Buffer.from("impostor"));

  const res = runCli(["--images-dir", imagesDir, md], { cwd: dir });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /refusing to overwrite/);
  assert.equal(await fsp.readFile(md, "utf8"), FIXTURE_MD); // md untouched
  assert.deepEqual(await fsp.readdir(imagesDir), ["post-2.jpg"]); // post-1.png NOT written
});

test("cli: identical existing destination is reused, not an error", async () => {
  const dir = await makeDir();
  const imagesDir = join(dir, "images");
  const md = join(dir, "post.md");
  await fsp.writeFile(md, FIXTURE_MD);
  await fsp.mkdir(imagesDir, { recursive: true });
  await fsp.writeFile(join(imagesDir, "post-1.png"), PNG); // already extracted once

  const res = runCli(["--images-dir", imagesDir, md], { cwd: dir });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /reuse/);
  assert.equal((await fsp.readFile(md, "utf8")).includes("data:image"), false);
});

test("cli: --stdin --prefix extracts only, touches no markdown file", async () => {
  const dir = await makeDir();
  const imagesDir = join(dir, "images");
  const md = join(dir, "post.md");
  await fsp.writeFile(md, FIXTURE_MD); // present but NOT passed as an argument

  const res = runCli(["--stdin", "--prefix", "staged-", "--images-dir", imagesDir], {
    cwd: dir,
    input: FIXTURE_MD,
  });
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(await fsp.readFile(join(imagesDir, "staged-1.png")), PNG);
  assert.deepEqual(await fsp.readFile(join(imagesDir, "staged-2.jpg")), JPG);
  assert.equal(await fsp.readFile(md, "utf8"), FIXTURE_MD); // untouched
  assert.equal(
    (await fsp.readdir(dir)).includes("post.md.bak"),
    false, // stdin mode never writes backups/rewrites
  );
});

test("cli: --stdin without --prefix is an error", async () => {
  const dir = await makeDir();
  const res = runCli(["--stdin", "--images-dir", join(dir, "images")], { cwd: dir, input: "x" });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /--prefix/);
});
