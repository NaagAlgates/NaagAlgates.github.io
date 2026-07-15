#!/usr/bin/env node
// One-shot (but idempotent) migration for posts that carry base64 data-URI
// images inline (issue #45): extracts each image to public/images/ and
// rewrites the reference to a /images/<file> path. Also strips any
// whitespace before the frontmatter delimiter, which some markdown tooling
// treats as "no front matter" even though Astro tolerates it.
//
// Usage:
//   node scripts/migrate-inline-images.mjs [--dry-run] [--images-dir DIR] FILE.md...
//   ... | node scripts/migrate-inline-images.mjs --stdin --prefix NAME- [--dry-run] [--images-dir DIR]
//
// Modes:
//   FILE.md...          extract + rewrite the file in place (backup kept at
//                       FILE.md.bak with the exact pre-migration bytes).
//   --stdin --prefix P  read markdown from stdin, ONLY extract images (named
//                       P1.ext, P2.ext, ...); never rewrites any file. For
//                       content that has no worktree file (e.g. a staged git
//                       blob via `git show :path`).
//
// Image writes are no-clobber: an existing destination with identical bytes
// is reused; different bytes abort the run with a non-zero exit.
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sniffImageType } from "./editor/image-store.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_IMAGES_DIR = join(HERE, "..", "public", "images");

const DATA_IMG_RE = /!\[([^\]]*)\]\(\s*<?data:image\/[a-zA-Z+.-]+;base64,([A-Za-z0-9+/=\s]+?)>?\s*\)/g;

/**
 * Pure transform. Returns { text, images, strippedPrefix } where images is
 * [{ name, buf }] (name = `${prefix}${n}.${ext}`, ext from magic bytes) and
 * text has each data URI replaced with ![alt](/images/<name>). No-op input
 * (no data URIs, no leading whitespace) returns text unchanged.
 */
export function extractInlineImages(mdText, { prefix }) {
  if (typeof prefix !== "string" || prefix === "") {
    throw new Error("prefix is required");
  }
  const images = [];
  let n = 0;
  let text = String(mdText).replace(DATA_IMG_RE, (match, alt, b64) => {
    const buf = Buffer.from(b64.replace(/\s+/g, ""), "base64");
    const type = sniffImageType(buf);
    if (!type) return match; // unrecognized bytes: leave untouched, report nothing
    n += 1;
    const name = `${prefix}${n}.${type.ext}`;
    images.push({ name, buf });
    return `![${alt}](/images/${name})`;
  });
  const strippedPrefix = /^\s+---/.test(text);
  if (strippedPrefix) text = text.replace(/^\s+(?=---)/, "");
  return { text, images, strippedPrefix };
}

/** Phase 1: decide what to do for one image without writing anything.
 * Throws on a different-content conflict so the caller aborts BEFORE any
 * write happens (all-or-nothing across the whole run). */
function planImageWrite(imagesDir, { name, buf }) {
  const target = resolve(join(imagesDir, name));
  if (!target.startsWith(resolve(imagesDir) + "/")) {
    throw new Error(`refusing to write outside images dir: ${name}`);
  }
  let existing = null;
  try {
    existing = readFileSync(target);
  } catch (err) {
    // ONLY a missing file means "free to write". Anything else (EISDIR,
    // EACCES, ...) must abort the whole run BEFORE any image is written,
    // or all-or-nothing breaks.
    if (err.code !== "ENOENT") {
      throw new Error(`cannot use destination ${target}: ${err.code ?? err.message}`);
    }
  }
  if (existing) {
    if (Buffer.compare(existing, buf) === 0) return { target, buf, action: "reuse" };
    throw new Error(`refusing to overwrite ${target}: exists with different content`);
  }
  return { target, buf, action: "write" };
}

/** Phase 2: perform a validated write plan. */
function performImageWrite({ target, buf, action }, dryRun) {
  if (action === "reuse") {
    console.log(`reuse    ${target} (identical content already present)`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] would write ${target} (${buf.length} bytes)`);
    return;
  }
  writeFileSync(target, buf, { flag: "wx" });
  console.log(`wrote    ${target} (${buf.length} bytes)`);
}

function writeAllOrNothing(imagesDir, images, dryRun) {
  const plans = images.map((img) => planImageWrite(imagesDir, img)); // may throw: nothing written yet
  for (const plan of plans) performImageWrite(plan, dryRun);
}

function migrateFile(file, imagesDir, dryRun) {
  // Refuse symlinks and non-files up front: the backup/rewrite below must
  // never follow a link and write outside the intended location (CWE-59).
  const st = lstatSync(file);
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new Error(`refusing symlink or non-regular-file input: ${file}`);
  }
  const raw = readFileSync(file, "utf8");
  const prefix = `${basename(file).replace(/\.md$/, "")}-`;
  const { text, images, strippedPrefix } = extractInlineImages(raw, { prefix });
  if (text === raw && images.length === 0) {
    console.log(`clean    ${file} (nothing to migrate)`);
    return;
  }
  writeAllOrNothing(imagesDir, images, dryRun);
  if (dryRun) {
    console.log(
      `[dry-run] would rewrite ${file}: ${images.length} image(s) extracted` +
        `${strippedPrefix ? ", leading whitespace before frontmatter stripped" : ""}` +
        ` (backup would be kept at ${file}.bak)`,
    );
    return;
  }
  // "wx" = O_CREAT|O_EXCL: fails on ANY existing path, including a planted
  // symlink — the backup can never follow a link or clobber a prior backup.
  writeFileSync(`${file}.bak`, raw, { flag: "wx" });
  writeFileSync(file, text);
  console.log(
    `rewrote  ${file}: ${images.length} image(s) extracted` +
      `${strippedPrefix ? ", frontmatter prefix stripped" : ""} (backup: ${file}.bak)`,
  );
}

function runStdin(prefix, imagesDir, dryRun) {
  const raw = readFileSync(0, "utf8");
  const { images } = extractInlineImages(raw, { prefix });
  if (images.length === 0) {
    console.log("clean    stdin (no inline images found)");
    return;
  }
  writeAllOrNothing(imagesDir, images, dryRun);
}

function main(argv) {
  const args = [...argv];
  const has = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1) return false;
    args.splice(i, 1);
    return true;
  };
  const opt = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    const v = args[i + 1];
    args.splice(i, 2);
    return v ?? null;
  };

  const dryRun = has("--dry-run");
  const useStdin = has("--stdin");
  const prefix = opt("--prefix");
  const imagesDir = opt("--images-dir") ?? DEFAULT_IMAGES_DIR;
  const files = args;

  if (!dryRun) mkdirSync(imagesDir, { recursive: true });

  if (useStdin) {
    if (!prefix) throw new Error("--stdin requires --prefix <output-prefix>");
    if (files.length > 0) throw new Error("--stdin cannot be combined with file arguments");
    runStdin(prefix, imagesDir, dryRun);
    return;
  }
  if (files.length === 0) {
    throw new Error(
      "no input: pass explicit .md file paths, or --stdin --prefix NAME- (this " +
        "script never scans the repo on its own)",
    );
  }
  for (const file of files) migrateFile(file, imagesDir, dryRun);
}

// Only run as a CLI, not when imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}
