// Shared between the browser client and the node:test suite.
//
// Detects an image with a title — the construct Toast UI's WYSIWYG model
// cannot represent (it drops the title on conversion). Uses a real
// CommonMark parser (mdast-util-from-markdown, the same remark family
// Astro's markdown pipeline is built on) instead of a regex, so escaped
// brackets/parens, angle-bracket destinations, and every spec title form
// are recognized exactly — and code spans/fences are correctly ignored.
import { fromMarkdown } from "mdast-util-from-markdown";

export function hasTitledImage(markdown) {
  let found = false;
  const imageReferenceIds = new Set();
  const titledDefinitionIds = new Set();
  const walk = (node) => {
    if (!node) return;
    if (node.type === "image" && node.title != null && node.title !== "") {
      found = true;
    }
    if (node.type === "imageReference") imageReferenceIds.add(node.identifier);
    if (node.type === "definition" && node.title != null && node.title !== "")
      titledDefinitionIds.add(node.identifier);
    if (node.children) for (const child of node.children) walk(child);
  };
  try {
    walk(fromMarkdown(String(markdown)));
  } catch {
    return false; // unparseable input has nothing to protect
  }
  return found || [...imageReferenceIds].some((id) => titledDefinitionIds.has(id));
}

// Raw <img> HTML carrying width/height — the OTHER construct Toast UI's
// WYSIWYG conversion silently drops (its convertors keep only src/alt; see
// the sized-image guard rationale in .omc/plans/45-editor-image-upload.md).
// The parser walk means code spans/fences never false-positive: inline HTML
// surfaces as `html` nodes, code as `code`/`inlineCode` nodes.
const SIZED_IMG_RE = /<img\b[^>]*\s(?:width|height)\s*=/i;

export function hasSizedImage(markdown) {
  let found = false;
  const walk = (node) => {
    if (!node || found) return;
    if (node.type === "html" && SIZED_IMG_RE.test(node.value)) found = true;
    if (node.children) for (const child of node.children) walk(child);
  };
  try {
    walk(fromMarkdown(String(markdown)));
  } catch {
    return false; // unparseable input has nothing to protect
  }
  return found;
}

// ANY raw HTML (block or inline). Issue #53: the WYSIWYG round-trip was
// empirically shown to REMOVE <iframe> embeds entirely and to destroy
// <figure>/<figcaption> structure (and the <img> convertor keeps only
// src/alt), so every html node is treated as WYSIWYG-unsafe. Deliberately
// broader than hasSizedImage (a strict subset of this); the parser walk keeps
// code fences/spans immune, same as the other detectors.
export function hasRawHtml(markdown) {
  let found = false;
  const walk = (node) => {
    if (!node || found) return;
    if (node.type === "html") found = true;
    if (node.children) for (const child of node.children) walk(child);
  };
  try {
    walk(fromMarkdown(String(markdown)));
  } catch {
    return false; // unparseable input has nothing to protect
  }
  return found;
}
