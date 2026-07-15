// Build-output guarantees for the image migration (acceptance criteria 2 & 3
// of .omc/plans/45-editor-image-upload.md): a post that references an image
// under /images/ must ship that reference — and the actual file — in the
// static build, with no base64 and no editor artifacts leaking into dist/.
//
// This runs a real `astro build`, so it is SLOW and lives OUTSIDE the fast
// `npm test` glob. Run it with:  npm run test:build
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SLUG = "zz-build-image-smoke";
const postPath = join(ROOT, "src", "content", "blog", `${SLUG}.md`);
const distPost = join(ROOT, "dist", "blog", SLUG, "index.html");

test("build ships the /images/ reference and the file, with no data URI or editor leak", async (t) => {
  // Uses an existing committed image so we assert on a real, served asset.
  const image = "/images/back-to-blogging-1.jpg";
  assert.ok(existsSync(join(ROOT, "public", image)), "fixture image must exist");

  writeFileSync(
    postPath,
    `---\ntitle: "Build Image Smoke"\ndescription: "temp"\npubDate: 2026-07-15\ntags: []\n---\n\nintro\n\n<img src="${image}" width="400" alt="w">\n`,
  );
  t.after(() => {
    rmSync(postPath, { force: true });
    rmSync(join(ROOT, "dist", "blog", SLUG), { recursive: true, force: true });
  });

  execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "pipe" });

  const html = readFileSync(distPost, "utf8");
  assert.match(html, /<img[^>]+src="\/images\/back-to-blogging-1\.jpg"[^>]*width="400"/);
  assert.equal(html.includes("data:image"), false);

  // The referenced file is emitted, and no /_editor route leaks into the build.
  assert.ok(existsSync(join(ROOT, "dist", image)), "referenced image copied into dist/");
  assert.equal(
    readdirSync(join(ROOT, "dist")).some((e) => e.toLowerCase().includes("editor")),
    false,
    "no _editor artifacts in dist/",
  );
});
