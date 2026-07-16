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

test("code group is not the last group (survives trailing-end overflow)", () => {
  assert.ok(codeGroupIndex >= 0, "a code group exists");
  assert.notEqual(
    codeGroupIndex,
    TOOLBAR_ITEMS.length - 1,
    "code group must not be the last (overflow-prone) group",
  );
});

test("scrollSync is preserved (no Markdown-mode toolbar regression)", () => {
  assert.ok(flat.includes("scrollSync"), "'scrollSync' toggle still present");
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
