// Editor toolbar configuration, extracted so it can be unit-tested without
// loading the browser-only @toast-ui/editor bundle. Pure data + helpers, no
// side effects and no DOM/browser imports — safe to `import` from node:test.
//
// Why an explicit toolbarItems at all: Toast UI's default toolbar overflows
// items from the TRAILING end into a "⋯ more" dropdown as width shrinks, and
// the default puts ['code','codeblock'] near the end — so the code-block
// button is the first to disappear on narrow/zoomed windows (issue #48,
// mechanism 1). This list is Toast UI's full default set REORDERED only: the
// code group is promoted to 2nd so it survives overflow far longer, and every
// other control (including scrollSync, used by the Markdown tab's split view)
// is kept so nothing regresses.

/** @type {string[][]} Toolbar groups, in render order. */
export const TOOLBAR_ITEMS = [
  ["heading", "bold", "italic", "strike"],
  ["code", "codeblock"],
  ["hr", "quote"],
  ["ul", "ol", "task", "indent", "outdent"],
  ["table", "image", "link"],
  ["scrollSync"],
];

/** Index of the toolbar group that holds the code controls. */
export const codeGroupIndex = TOOLBAR_ITEMS.findIndex(
  (group) => group.includes("code") || group.includes("codeblock"),
);

// Curated code-block languages (issue #48 follow-up). The syntax-highlight
// plugin's language box is NOT a type-to-search combobox — typing hides its
// list — so a full 303-language list is unusable. We instead offer a short,
// click-friendly set. This is the single source of truth: client.mjs builds
// the picker's language map from it, integration.mjs pre-bundles the matching
// Prism components from it, and editor-config.test.mjs guards the three in sync.
// Extend freely (keep it short enough to scroll-and-click). `markup` = HTML/XML.
export const CODE_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "dart",
  "go",
  "java",
  "javascript",
  "json",
  "kotlin",
  "markup",
  "python",
  "rust",
  "sql",
  "typescript",
  "yaml",
];

// Grammars bundled in Prism core (no `prismjs/components/prism-*` import needed).
const PRISM_CORE = new Set(["markup", "css", "javascript"]);

/**
 * Languages that DO need a `prismjs/components/prism-<name>` import. Shared by
 * client.mjs (static imports) and integration.mjs (optimizeDeps pre-bundle) so
 * the picker list, the loaded grammars, and the pre-bundle stay in lockstep.
 * @type {string[]}
 */
export const PRISM_COMPONENT_LANGUAGES = CODE_LANGUAGES.filter(
  (lang) => !PRISM_CORE.has(lang),
);

/**
 * Type-to-search predicate for the code-block language picker: does `lang`
 * match the user's query? Empty/whitespace query matches everything (show the
 * whole list); otherwise a case-insensitive substring match. Pure — shared by
 * client.mjs's live filter and unit tests so the behaviour is covered.
 * @param {string} lang
 * @param {string} query
 * @returns {boolean}
 */
export function languageMatches(lang, query) {
  const q = String(query).trim().toLowerCase();
  if (q === "") return true;
  return String(lang).toLowerCase().includes(q);
}

/**
 * Vite `optimizeDeps.include` for the editor client. Every bundled specifier
 * the client imports must be listed here, or Vite discovers the un-listed ones
 * on first /_editor load and triggers a mid-session re-optimization reload
 * (issue #48). The Prism language components are generated from
 * PRISM_COMPONENT_LANGUAGES so this list can't drift from what client.mjs
 * imports. Pure strings — safe to import from node:test.
 * @returns {string[]}
 */
export function editorOptimizeDepsInclude() {
  return [
    "@toast-ui/editor",
    "@toast-ui/editor-plugin-code-syntax-highlight",
    "prismjs",
    ...PRISM_COMPONENT_LANGUAGES.map((lang) => `prismjs/components/prism-${lang}`),
    "dompurify",
    "mdast-util-from-markdown",
  ];
}
