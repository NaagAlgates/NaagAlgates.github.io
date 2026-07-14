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
