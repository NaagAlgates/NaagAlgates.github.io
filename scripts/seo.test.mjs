// SEO output tests: build the real site once into an ISOLATED temp output dir,
// then assert on the emitted artifacts. The SEO behavior lives in .astro/.ts
// render paths, so the only faithful check is the built output — but we build to
// a throwaway dir (never the real ./dist) so a test run can't contaminate
// previews or a deploy with fixture pages.
//
// CONSTRAINT — single build per checkout at a time: to exercise the render
// paths, two throwaway fixture posts are written into src/content/blog for the
// duration of the build (Astro's content collection base is fixed to that dir).
// Names are per-PID unique and removed in the after hook, but this suite still
// must NOT run concurrently with another `astro build` in the SAME checkout —
// including a second `npm test` — because Astro's build state (`.astro/`, the
// shared cache dir) is repo-local, and two overlapping builds corrupt it
// (ENOENT on `.astro/chunks/...`). That's an Astro-level limitation on
// concurrent same-project builds, not specific to these fixtures. CI runs each
// job in its own clean checkout, so this only matters for a hand-run local
// overlap; likewise don't run a real `npm run build` here mid-test.
//
// Covered acceptance criteria (plan .omc/plans/46-seo-completion.md, step 5):
//  - robots.txt: Sitemap pointer + COMPLETE per-UA policy incl. `*` default,
//    Content-signal line, and Bytespider (no `*` inheritance for the bot groups)
//  - URL consistency: zero slash-less /blog/<id> across ALL dist HTML + rss.xml
//  - updatedDate -> dateModified (JSON-LD) path is exercised
//  - per-post image override vs site-default og:image path is exercised
//  - /llms.txt is emitted with trailing-slash post URLs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BLOG_DIR = path.join(ROOT, "src", "content", "blog");
const ASTRO_BIN = path.join(ROOT, "node_modules", "astro", "astro.js");
const SITE = "https://www.nagaraj.com.au";

// Per-PID unique slugs so two concurrent `npm test` runs never touch the same file.
const SLUG_UPDATED = `_seo-fixture-updated-${process.pid}`;
const SLUG_PLAIN = `_seo-fixture-plain-${process.pid}`;
const FIXTURE_UPDATED = path.join(BLOG_DIR, `${SLUG_UPDATED}.md`);
const FIXTURE_PLAIN = path.join(BLOG_DIR, `${SLUG_PLAIN}.md`);
const OVERRIDE_IMAGE = "/images/_seo-fixture-card.png";

const UPDATED_MD = `---
title: SEO Fixture Updated
description: Temporary fixture exercising updatedDate and a per-post image override.
pubDate: 2020-01-01
updatedDate: 2020-06-15
tags: [seotest]
image: ${OVERRIDE_IMAGE}
---

Fixture body — updated + image override.
`;

const PLAIN_MD = `---
title: SEO Fixture Plain
description: Temporary fixture with no updatedDate and no image (default card path).
pubDate: 2020-01-02
tags: [seotest]
---

Fixture body — plain.
`;

const FIXTURES = [
  [FIXTURE_UPDATED, UPDATED_MD],
  [FIXTURE_PLAIN, PLAIN_MD],
];

let OUT = ""; // isolated temp build output dir

function writeFixture(file, body) {
  // Exclusive create ("wx") — atomically fails if the path already exists, so a
  // real post at this name is never clobbered (no existsSync/write TOCTOU gap).
  try {
    fs.writeFileSync(file, body, { flag: "wx" });
  } catch (err) {
    if (err.code === "EEXIST") {
      throw new Error(`refusing to clobber pre-existing ${path.relative(ROOT, file)} — remove it and re-run`);
    }
    throw err;
  }
}

function cleanup() {
  for (const [file, body] of FIXTURES) {
    // Only delete a fixture that still holds exactly what we wrote — never a
    // file something else replaced it with in the meantime.
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === body) fs.rmSync(file);
  }
  if (OUT && fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
}

/** Recursively collect every .html file under dir. */
function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

/** Parse robots.txt into { userAgent: [directive, ...] } — no `*` inheritance. */
function parseRobots(txt) {
  const groups = {};
  let current = null;
  for (const raw of txt.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const ua = line.match(/^User-agent:\s*(.+)$/i);
    if (ua) {
      current = ua[1].trim();
      groups[current] ??= [];
      continue;
    }
    const dir = line.match(/^(Allow|Disallow):\s*(.*)$/i);
    if (dir && current) groups[current].push(`${dir[1]}: ${dir[2]}`.trim());
    const cs = line.match(/^Content-signal:\s*(.*)$/i);
    if (cs && current) groups[current].push(`Content-signal: ${cs[1].trim()}`);
  }
  return groups;
}

// Match a /blog/… URL path up to a delimiter, then require it to end in "/".
// The charset is "anything that isn't a URL/markup boundary", so it also covers
// NESTED ids (/blog/a/b/ from **/*.md) and non-ASCII/Unicode ids — a flat
// [A-Za-z0-9._-] pattern would silently miss both. `)` stays a boundary because
// it terminates a markdown link in llms.txt; Astro slugifies `)`/`]` out of real
// ids, so treating `)` as a boundary can't hide a real post URL here.
const BLOG_URL = /\/blog\/[^\s"'<>?#)&]*/g;
function slashlessBlogUrls(text) {
  const out = [];
  for (const m of text.matchAll(BLOG_URL)) {
    const url = m[0];
    if (url === "/blog/") continue; // blog index, fine
    if (!url.endsWith("/")) out.push(url);
  }
  return [...new Set(out)];
}

const ALLOW_UAS = [
  "Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot",
  "Applebot", "Amzn-SearchBot", "DuckAssistBot", "Claude-User", "Amzn-User",
];
const DISALLOW_UAS = [
  "GPTBot", "ClaudeBot", "Applebot-Extended", "meta-externalagent",
  "Bytespider", "CCBot", "Amazonbot", "Google-Extended",
];

let ROBOTS = "";
let RSS = "";
let HTML_FILES = [];

before(
  () => {
    for (const [file, body] of FIXTURES) writeFixture(file, body);
    OUT = fs.mkdtempSync(path.join(os.tmpdir(), "seo-dist-"));
    execFileSync(process.execPath, [ASTRO_BIN, "build", "--outDir", OUT], {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 180000,
    });
    ROBOTS = fs.readFileSync(path.join(OUT, "robots.txt"), "utf8");
    RSS = fs.readFileSync(path.join(OUT, "rss.xml"), "utf8");
    HTML_FILES = walkHtml(OUT);
  },
  { timeout: 200000 },
);

after(() => cleanup());

test("robots.txt has the Sitemap pointer", () => {
  assert.match(ROBOTS, /^Sitemap:\s*https:\/\/www\.nagaraj\.com\.au\/sitemap-index\.xml$/m);
});

test("robots.txt default `*` group allows all + declares the content signals", () => {
  const g = parseRobots(ROBOTS);
  assert.ok(g["*"], "expected a default User-agent: * group");
  assert.ok(g["*"].includes("Allow: /"), "* should Allow: /");
  assert.ok(!g["*"].includes("Disallow: /"), "* must not Disallow: /");
  // Scoped to the `*` group (via the parser), so a Content-signal line sitting
  // in a comment or some other UA group can't satisfy this.
  assert.ok(
    g["*"].includes("Content-signal: search=yes, ai-input=yes, ai-train=no"),
    "the default * group should declare the content signals",
  );
});

test("robots.txt encodes the COMPLETE per-UA policy incl. Bytespider (no contradictions)", () => {
  const g = parseRobots(ROBOTS);
  // Assert each UA's EFFECTIVE policy: intended directive present AND the
  // opposite absent, so a contradictory group (Allow: / + Disallow: /) fails.
  for (const ua of ALLOW_UAS) {
    assert.ok(g[ua], `expected a group for ${ua}`);
    assert.ok(g[ua].includes("Allow: /"), `${ua} should Allow: /`);
    assert.ok(!g[ua].includes("Disallow: /"), `${ua} must not also Disallow: /`);
  }
  for (const ua of DISALLOW_UAS) {
    assert.ok(g[ua], `expected a group for ${ua}`);
    assert.ok(g[ua].includes("Disallow: /"), `${ua} should Disallow: /`);
    assert.ok(!g[ua].includes("Allow: /"), `${ua} must not also Allow: /`);
  }
});

test("no slash-less /blog/<id> URLs across ALL built HTML", () => {
  const offenders = [];
  for (const file of HTML_FILES) {
    const hits = slashlessBlogUrls(fs.readFileSync(file, "utf8"));
    if (hits.length) offenders.push(`${path.relative(OUT, file)}: ${hits.join(", ")}`);
  }
  assert.equal(offenders.length, 0, `slash-less post URLs found:\n${offenders.join("\n")}`);
});

test("no slash-less /blog/<id> URLs in rss.xml (the RSS link fix)", () => {
  const hits = slashlessBlogUrls(RSS);
  assert.equal(hits.length, 0, `slash-less RSS links: ${hits.join(", ")}`);
});

test("updatedDate is emitted as JSON-LD dateModified; absent when unset", () => {
  const updated = fs.readFileSync(path.join(OUT, "blog", SLUG_UPDATED, "index.html"), "utf8");
  const plain = fs.readFileSync(path.join(OUT, "blog", SLUG_PLAIN, "index.html"), "utf8");
  assert.match(updated, /"dateModified":"2020-06-15T00:00:00\.000Z"/);
  assert.doesNotMatch(plain, /"dateModified"/);
});

test("per-post image overrides og:image; default card used otherwise", () => {
  const updated = fs.readFileSync(path.join(OUT, "blog", SLUG_UPDATED, "index.html"), "utf8");
  const plain = fs.readFileSync(path.join(OUT, "blog", SLUG_PLAIN, "index.html"), "utf8");
  assert.ok(
    updated.includes(`property="og:image" content="${SITE}${OVERRIDE_IMAGE}"`),
    "updated fixture should use its per-post image for og:image",
  );
  assert.ok(
    plain.includes(`property="og:image" content="${SITE}/og-default.png"`),
    "plain fixture should fall back to the default social card",
  );
});

test("/llms.txt is emitted with trailing-slash post URLs", () => {
  const llms = fs.readFileSync(path.join(OUT, "llms.txt"), "utf8");
  assert.match(llms, /# /); // has a heading
  const hits = slashlessBlogUrls(llms);
  assert.equal(hits.length, 0, `llms.txt slash-less URLs: ${hits.join(", ")}`);
});
