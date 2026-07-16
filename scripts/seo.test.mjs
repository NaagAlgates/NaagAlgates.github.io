// SEO output tests: build the real site once, then assert on the emitted
// dist/ artifacts. Unlike the editor tests (pure units), the SEO behavior lives
// in .astro/.ts render paths, so the only faithful check is the built output.
//
// Covered acceptance criteria (plan .omc/plans/46-seo-completion.md):
//  - robots.txt: Sitemap pointer + per-UA policy incl. Bytespider (no `*` inherit)
//  - URL consistency: zero slash-less /blog/<id> in dist HTML + rss.xml (the RSS fix)
//  - updatedDate -> dateModified (JSON-LD) path is exercised
//  - per-post image override vs site-default og:image path is exercised
//  - /llms.txt is emitted with trailing-slash post URLs
//
// Two throwaway fixture posts are written before the build and removed after,
// so both feature paths are exercised without depending on real post content.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const BLOG_DIR = path.join(ROOT, "src", "content", "blog");
const SITE = "https://www.nagaraj.com.au";

const FIXTURE_UPDATED = path.join(BLOG_DIR, "_seo-fixture-updated.md");
const FIXTURE_PLAIN = path.join(BLOG_DIR, "_seo-fixture-plain.md");
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

function cleanupFixtures() {
  for (const f of [FIXTURE_UPDATED, FIXTURE_PLAIN]) {
    if (fs.existsSync(f)) fs.rmSync(f);
  }
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

/** Parse robots.txt into { userAgent: [directive, ...] } with no `*` inheritance. */
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
  }
  return groups;
}

// A slash-less post link: /blog/<id> NOT immediately followed by another
// path/id char (so /blog/<id>/ and /blog/<id>-more are fine, /blog/<id>" isn't).
const SLASHLESS = /\/blog\/[A-Za-z0-9._-]+(?![/A-Za-z0-9._-])/g;

let ROBOTS = "";
let RSS = "";
let HTML_FILES = [];

before(
  () => {
    cleanupFixtures();
    fs.writeFileSync(FIXTURE_UPDATED, UPDATED_MD);
    fs.writeFileSync(FIXTURE_PLAIN, PLAIN_MD);
    execSync("npm run build", { cwd: ROOT, stdio: "pipe", timeout: 180000 });
    ROBOTS = fs.readFileSync(path.join(DIST, "robots.txt"), "utf8");
    RSS = fs.readFileSync(path.join(DIST, "rss.xml"), "utf8");
    HTML_FILES = walkHtml(path.join(DIST, "blog"));
  },
  { timeout: 200000 },
);

after(() => cleanupFixtures());

test("robots.txt has the Sitemap pointer", () => {
  assert.match(ROBOTS, /^Sitemap:\s*https:\/\/www\.nagaraj\.com\.au\/sitemap-index\.xml$/m);
});

test("robots.txt allows search/citation and disallows training crawlers per-UA (incl. Bytespider)", () => {
  const g = parseRobots(ROBOTS);
  for (const ua of ["Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]) {
    assert.ok(g[ua], `expected a group for ${ua}`);
    assert.ok(g[ua].includes("Allow: /"), `${ua} should Allow: /`);
  }
  for (const ua of [
    "GPTBot",
    "ClaudeBot",
    "Applebot-Extended",
    "meta-externalagent",
    "Bytespider",
    "CCBot",
    "Amazonbot",
    "Google-Extended",
  ]) {
    assert.ok(g[ua], `expected a group for ${ua}`);
    assert.ok(g[ua].includes("Disallow: /"), `${ua} should Disallow: /`);
  }
});

test("no slash-less /blog/<id> URLs in built HTML", () => {
  const offenders = [];
  for (const file of HTML_FILES) {
    const html = fs.readFileSync(file, "utf8");
    const hits = html.match(SLASHLESS);
    if (hits) offenders.push(`${path.relative(DIST, file)}: ${[...new Set(hits)].join(", ")}`);
  }
  assert.equal(offenders.length, 0, `slash-less post URLs found:\n${offenders.join("\n")}`);
});

test("no slash-less /blog/<id> URLs in rss.xml (the RSS link fix)", () => {
  const hits = RSS.match(SLASHLESS);
  assert.equal(hits, null, `slash-less RSS links: ${hits && [...new Set(hits)].join(", ")}`);
});

test("updatedDate is emitted as JSON-LD dateModified; absent when unset", () => {
  const updated = fs.readFileSync(path.join(DIST, "blog", "_seo-fixture-updated", "index.html"), "utf8");
  const plain = fs.readFileSync(path.join(DIST, "blog", "_seo-fixture-plain", "index.html"), "utf8");
  assert.match(updated, /"dateModified":"2020-06-15T00:00:00\.000Z"/);
  assert.doesNotMatch(plain, /"dateModified"/);
});

test("per-post image overrides og:image; default card used otherwise", () => {
  const updated = fs.readFileSync(path.join(DIST, "blog", "_seo-fixture-updated", "index.html"), "utf8");
  const plain = fs.readFileSync(path.join(DIST, "blog", "_seo-fixture-plain", "index.html"), "utf8");
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
  const llms = fs.readFileSync(path.join(DIST, "llms.txt"), "utf8");
  assert.match(llms, /# /); // has a heading
  assert.equal(llms.match(SLASHLESS), null, "llms.txt should not contain slash-less /blog/<id> URLs");
});
