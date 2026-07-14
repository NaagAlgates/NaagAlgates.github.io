// Shared between the browser client and the node:test suite.
//
// Detects a CommonMark image whose destination is followed by a title —
// the construct Toast UI's WYSIWYG model cannot represent (it drops the
// title on conversion). Covers the spec's title forms:
//   ![alt](dest "title")   ![alt](dest 'title')   ![alt](dest (title))
// and destination forms: bare (with one level of balanced parens) or
// angle-bracketed (<dest with spaces>).
export const TITLED_IMAGE =
  /!\[[^\]]*\]\(\s*(?:<[^>]*>|(?:[^()\s]|\([^()]*\))+)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\([^()]*\))\s*\)/;
