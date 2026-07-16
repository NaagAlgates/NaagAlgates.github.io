// Regression coverage for issue #48, mechanism 1: the code-block button must
// stay out of the overflow-prone trailing toolbar position, and the syntax-
// highlight plugin must stay wired into the editor. These are config-level
// assertions — the live overflow/highlighting behaviour needs a browser and is
// verified manually (see the plan's Verification Steps).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TOOLBAR_ITEMS, codeGroupIndex } from "./editor-config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const flat = TOOLBAR_ITEMS.flat();

test("TOOLBAR_ITEMS exposes both code controls", () => {
  assert.ok(flat.includes("code"), "inline 'code' button present");
  assert.ok(flat.includes("codeblock"), "'codeblock' button present");
});

test("codeblock is not in the last group (survives trailing-end overflow)", () => {
  const lastGroup = TOOLBAR_ITEMS.length - 1;
  // Assert on 'codeblock' SPECIFICALLY — it is the control that overflows and
  // matters for issue #48. Checking a generic "code-or-codeblock" group index
  // would let 'code' sit early while 'codeblock' slid into the last group.
  const codeblockGroup = TOOLBAR_ITEMS.findIndex((g) => g.includes("codeblock"));
  assert.ok(codeblockGroup >= 0, "'codeblock' is present in some group");
  assert.notEqual(
    codeblockGroup,
    lastGroup,
    "'codeblock' must not be in the last (overflow-prone) group",
  );
  // 'code' (inline) must also stay out of the last group.
  const codeGroup = TOOLBAR_ITEMS.findIndex((g) => g.includes("code"));
  assert.notEqual(codeGroup, lastGroup, "'code' must not be in the last group");
  // Sanity: codeGroupIndex helper points at a non-last group too.
  assert.ok(codeGroupIndex >= 0 && codeGroupIndex !== lastGroup);
});

test("scrollSync is preserved (no Markdown-mode toolbar regression)", () => {
  assert.ok(flat.includes("scrollSync"), "'scrollSync' toggle still present");
});

test("page.mjs renders the code-block hint and WRITING.md mirrors it (AC-7)", () => {
  const page = readFileSync(join(HERE, "page.mjs"), "utf8");
  assert.match(page, /Code Block/, "editor page shows the Code Block hint");
  const writing = readFileSync(join(HERE, "..", "..", "WRITING.md"), "utf8");
  assert.match(writing, /Code Block/, "WRITING.md mirrors the code-block note");
});

test("page.mjs form CSS is scoped so it can't leak into the plugin's controls", () => {
  const page = readFileSync(join(HERE, "page.mjs"), "utf8");
  // A bare `button {` / `input {` selector would restyle the plugin's language
  // <button> list and <input> (issue #48 round-2 regression). Require the
  // rules to be id-scoped instead.
  assert.doesNotMatch(page, /(^|\s)button\s*\{/, "no unscoped `button {` rule");
  assert.doesNotMatch(page, /(^|\s)input\s*\{/, "no unscoped `input {` rule");
});

test("client.mjs wires the code-syntax-highlight plugin and the shared toolbar", () => {
  const client = readFileSync(join(HERE, "client.mjs"), "utf8");
  assert.match(
    client,
    /plugins:\s*\[\s*codeSyntaxHighlight\s*\]/,
    "Editor config registers plugins: [codeSyntaxHighlight]",
  );
  assert.match(
    client,
    /toolbarItems:\s*TOOLBAR_ITEMS/,
    "Editor config uses the shared TOOLBAR_ITEMS",
  );
  assert.match(
    client,
    /import\s+codeSyntaxHighlight\s+from\s+["']@toast-ui\/editor-plugin-code-syntax-highlight/,
    "client imports the code-syntax-highlight plugin",
  );
});
