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
