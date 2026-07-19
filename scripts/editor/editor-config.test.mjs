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
import {
  TOOLBAR_ITEMS,
  applyOpenedPost,
  codeGroupIndex,
  CODE_LANGUAGES,
  PRISM_COMPONENT_LANGUAGES,
  editorOptimizeDepsInclude,
  languageMatches,
  languageKeyAction,
  opSequencer,
} from "./editor-config.mjs";

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
  // Base plugin registered WITH a curated highlighter (issue #48 follow-up),
  // not the bare/`-all` form.
  assert.match(
    client,
    /plugins:\s*\[\s*\[\s*codeSyntaxHighlight\s*,\s*\{\s*highlighter:\s*curatedHighlighter\s*\}\s*\]\s*\]/,
    "Editor config registers plugins: [[codeSyntaxHighlight, { highlighter: curatedHighlighter }]]",
  );
  assert.match(
    client,
    /toolbarItems:\s*TOOLBAR_ITEMS/,
    "Editor config uses the shared TOOLBAR_ITEMS",
  );
  assert.match(
    client,
    /import\s+codeSyntaxHighlight\s+from\s+["']@toast-ui\/editor-plugin-code-syntax-highlight["']/,
    "client imports the BASE code-syntax-highlight plugin (not a dist subpath)",
  );
  assert.doesNotMatch(
    client,
    /code-syntax-highlight-all/,
    "client must NOT use the -all bundle (that gives the unusable 303-language list)",
  );
});

test("CODE_LANGUAGES is a curated, click-usable short list", () => {
  assert.ok(Array.isArray(CODE_LANGUAGES));
  assert.ok(
    CODE_LANGUAGES.length >= 5 && CODE_LANGUAGES.length <= 25,
    `curated list should be short (got ${CODE_LANGUAGES.length})`,
  );
  for (const common of ["python", "javascript", "kotlin"]) {
    assert.ok(CODE_LANGUAGES.includes(common), `includes ${common}`);
  }
  // lowercase + unique
  assert.deepEqual(
    CODE_LANGUAGES,
    CODE_LANGUAGES.map((l) => l.toLowerCase()),
    "all entries lowercase",
  );
  assert.equal(
    new Set(CODE_LANGUAGES).size,
    CODE_LANGUAGES.length,
    "no duplicate languages",
  );
});

test("every non-core curated language has a matching Prism component import", () => {
  const client = readFileSync(join(HERE, "client.mjs"), "utf8");
  // Guards list<->import drift: a language offered in the picker with no grammar
  // loaded would be uncoloured and could distort the picker count.
  for (const lang of PRISM_COMPONENT_LANGUAGES) {
    assert.match(
      client,
      new RegExp(`prismjs/components/prism-${lang}(["'])`),
      `client.mjs imports prismjs/components/prism-${lang}`,
    );
  }
  // Core-only grammars must NOT get a redundant component import.
  for (const core of ["markup", "css", "javascript"]) {
    assert.doesNotMatch(
      client,
      new RegExp(`prismjs/components/prism-${core}["']`),
      `no redundant component import for core grammar ${core}`,
    );
  }
});

test("languageMatches: the type-to-search filter predicate", () => {
  // empty / whitespace query shows everything
  for (const lang of CODE_LANGUAGES) {
    assert.equal(languageMatches(lang, ""), true, `empty query shows ${lang}`);
    assert.equal(languageMatches(lang, "   "), true, `blank query shows ${lang}`);
  }
  // substring match
  assert.equal(languageMatches("python", "py"), true);
  assert.equal(languageMatches("javascript", "script"), true, "matches mid-string");
  assert.equal(languageMatches("java", "py"), false, "non-match excluded");
  // case-insensitive both ways
  assert.equal(languageMatches("Python", "PY"), true);
  assert.equal(languageMatches("KOTLIN", "kot"), true);
  // a query matching nothing in the curated set
  assert.ok(
    CODE_LANGUAGES.every((l) => languageMatches(l, "zzz") === false),
    "no curated language matches 'zzz' (list would collapse)",
  );
  // 'j' multi-matches java/javascript/json but not python
  const jHits = CODE_LANGUAGES.filter((l) => languageMatches(l, "j"));
  assert.ok(jHits.includes("java") && jHits.includes("javascript") && jHits.includes("json"));
  assert.ok(!jHits.includes("python"));
});

test("languageKeyAction: keyboard nav stays within visible matches while filtering", () => {
  // No active query → the plugin handles everything.
  assert.equal(languageKeyAction("Enter", false, 5), "passthrough");
  assert.equal(languageKeyAction("ArrowDown", false, 5), "passthrough");
  // Active query, but a character key is not ours.
  assert.equal(languageKeyAction("a", true, 3), "passthrough");
  // Active query with matches: we own navigation/commit.
  assert.equal(languageKeyAction("ArrowDown", true, 3), "down");
  assert.equal(languageKeyAction("ArrowUp", true, 3), "up");
  assert.equal(languageKeyAction("Enter", true, 3), "commit");
  assert.equal(languageKeyAction("Tab", true, 3), "commit");
  // Active query with ZERO matches: suppress (never let the plugin commit the
  // raw query or navigate hidden buttons) — this is the round-3 bug fix.
  assert.equal(languageKeyAction("Enter", true, 0), "suppress");
  assert.equal(languageKeyAction("Tab", true, 0), "suppress");
  assert.equal(languageKeyAction("ArrowDown", true, 0), "suppress");
  assert.equal(languageKeyAction("ArrowUp", true, 0), "suppress");
  // A character key with zero matches still passes through (user keeps editing).
  assert.equal(languageKeyAction("x", true, 0), "passthrough");
});

test("client.mjs wires type-to-search for the language picker", () => {
  const client = readFileSync(join(HERE, "client.mjs"), "utf8");
  // The plugin has no filter (typing hides its list); we add type-to-search
  // ourselves. Guard that wiring: a delegated input listener that targets the
  // language input and re-shows/filters the list.
  assert.match(
    client,
    /addEventListener\(\s*["']input["']/,
    "delegated input listener present",
  );
  assert.match(
    client,
    /toastui-editor-code-block-language-input input/,
    "listener targets the language input",
  );
  assert.match(
    client,
    /toastui-editor-code-block-language-list/,
    "filter re-shows/narrows the language list",
  );
  assert.match(client, /languageMatches/, "uses the shared, tested match predicate");
  assert.match(
    client,
    /addEventListener\(\s*["']focusin["']/,
    "focusin handler resets stale filter state on reopen",
  );
  // Keyboard nav must be constrained to visible matches while filtering.
  assert.match(
    client,
    /addEventListener\(\s*["']keydown["'][\s\S]*capture:\s*true/,
    "capture-phase keydown handler owns Arrow/Enter/Tab during filtering",
  );
  assert.match(client, /stopImmediatePropagation/, "suppresses the plugin's own key handling");
  assert.match(client, /languageKeyAction/, "uses the shared, tested key-decision helper");
  assert.match(client, /isComposing/, "IME composition is left alone");
  assert.match(client, /["']Escape["']/, "Escape still dismisses the picker via the plugin");
});

test("optimizeDeps.include pre-bundles every client import (no first-load reload)", () => {
  // AC-6: the generated prebundle list must cover every bundled specifier the
  // client imports, or Vite re-optimizes on first /_editor load and reloads.
  const include = editorOptimizeDepsInclude();
  for (const required of [
    "@toast-ui/editor",
    "@toast-ui/editor-plugin-code-syntax-highlight",
    "prismjs",
    "dompurify",
    "mdast-util-from-markdown",
  ]) {
    assert.ok(include.includes(required), `include lists ${required}`);
  }
  // a component subpath for every non-core language, and no `-all` bundle
  for (const lang of PRISM_COMPONENT_LANGUAGES) {
    assert.ok(
      include.includes(`prismjs/components/prism-${lang}`),
      `include pre-bundles prismjs/components/prism-${lang}`,
    );
  }
  assert.ok(
    !include.some((e) => e.includes("code-syntax-highlight-all")),
    "must not pre-bundle the -all bundle",
  );
});

test("integration.mjs uses the shared optimizeDeps helper (not a hand-maintained list)", () => {
  const integration = readFileSync(join(HERE, "integration.mjs"), "utf8");
  assert.match(
    integration,
    /include:\s*editorOptimizeDepsInclude\(\)/,
    "integration.mjs builds optimizeDeps.include from the shared, tested helper",
  );
});

test("applyOpenedPost: markdown mode is established BEFORE body injection for unsafe posts", () => {
  // Recording mock: the whole point is the call ORDER (issue #53 — injecting
  // into an active WYSIWYG model runs the destructive conversion at open).
  const calls = [];
  const mockEditor = (markdownMode) => ({
    isMarkdownMode: () => {
      calls.push("isMarkdownMode");
      return markdownMode;
    },
    changeMode: (mode, silent) => calls.push(`changeMode:${mode}:${silent}`),
    setMarkdown: () => calls.push("setMarkdown"),
  });

  // Unsafe + editor in WYSIWYG: switch strictly precedes injection.
  calls.length = 0;
  let unsafe = applyOpenedPost(mockEditor(false), { body: "<iframe></iframe>", wysiwygUnsafe: true });
  assert.equal(unsafe, true);
  const changeIdx = calls.indexOf("changeMode:markdown:true");
  const setIdx = calls.indexOf("setMarkdown");
  assert.ok(changeIdx !== -1, "changeMode must be called");
  assert.ok(changeIdx < setIdx, "changeMode must precede setMarkdown");

  // Unsafe + already markdown: no redundant switch, body still injected.
  calls.length = 0;
  unsafe = applyOpenedPost(mockEditor(true), { body: "<i>x</i>", wysiwygUnsafe: true });
  assert.equal(unsafe, true);
  assert.ok(!calls.some((c) => c.startsWith("changeMode")));
  assert.ok(calls.includes("setMarkdown"));

  // Safe post: no forced switch.
  calls.length = 0;
  unsafe = applyOpenedPost(mockEditor(false), { body: "plain", wysiwygUnsafe: false });
  assert.equal(unsafe, false);
  assert.ok(!calls.some((c) => c.startsWith("changeMode")));
  assert.ok(calls.includes("setMarkdown"));
});

test("opSequencer: a response from before an invalidation never applies", () => {
  const ops = opSequencer();
  // Normal save: token captured, nothing moved, response applies.
  let t = ops.begin();
  assert.equal(ops.isCurrent(t), true);
  // Save in flight, then an open (invalidate): the save response is stale.
  t = ops.begin();
  ops.invalidate();
  assert.equal(ops.isCurrent(t), false);
  // The open's own token stays current until something newer invalidates.
  const openToken = ops.invalidate();
  assert.equal(ops.isCurrent(openToken), true);
  // A second open supersedes the first's in-flight response.
  const second = ops.invalidate();
  assert.equal(ops.isCurrent(openToken), false);
  assert.equal(ops.isCurrent(second), true);
  // Reset invalidates too.
  ops.invalidate();
  assert.equal(ops.isCurrent(second), false);
});
