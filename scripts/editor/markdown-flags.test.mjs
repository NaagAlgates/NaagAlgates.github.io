// hasSizedImage: the sized-image counterpart of the titled-image guard.
import test from "node:test";
import assert from "node:assert/strict";
import { hasRawHtml, hasSizedImage, hasTitledImage } from "./markdown-flags.mjs";

test("hasSizedImage: detects <img> width/height in every quoting style", () => {
  assert.ok(hasSizedImage('<img src="/images/x.png" width="400">'));
  assert.ok(hasSizedImage('<img src="/images/x.png" height="300">'));
  assert.ok(hasSizedImage("<img src='/images/x.png' width='400'>"));
  assert.ok(hasSizedImage('<img src="/images/x.png" width=400>'));
  assert.ok(hasSizedImage('<IMG SRC="/images/x.png" WIDTH="400">'));
  assert.ok(hasSizedImage('text before\n\n<img src="/images/x.png" width="400">\n\nafter'));
});

test("hasSizedImage: ignores unsized images and non-image markdown", () => {
  assert.equal(hasSizedImage("![alt](/images/x.png)"), false);
  assert.equal(hasSizedImage('<img src="/images/x.png">'), false);
  assert.equal(hasSizedImage('<img src="/images/x.png" alt="wide thing">'), false);
  assert.equal(hasSizedImage("plain text, no images at all"), false);
  assert.equal(hasSizedImage(""), false);
  // width= on a non-img tag is not a sized image
  assert.equal(hasSizedImage('<iframe width="400"></iframe>'), false);
});

test("hasSizedImage: code spans and fences never false-positive", () => {
  assert.equal(hasSizedImage('`<img src="x" width="4">`'), false);
  assert.equal(hasSizedImage('```html\n<img src="x" width="400">\n```'), false);
});

test("flags coexist: titled and sized detected independently", () => {
  const titled = '![alt](/images/x.png "a title")';
  const sized = '<img src="/images/x.png" width="400">';
  assert.ok(hasTitledImage(titled) && !hasSizedImage(titled));
  assert.ok(hasSizedImage(sized) && !hasTitledImage(sized));
  assert.ok(hasTitledImage(`${titled}\n\n${sized}`) && hasSizedImage(`${titled}\n\n${sized}`));
});

test("hasRawHtml: any html node fires; code is immune (issue #53)", () => {
  // Established-lossy constructs from the real corpus.
  assert.equal(hasRawHtml('<div class="video">\n<iframe src="https://www.youtube.com/embed/x"></iframe>\n</div>\n'), true);
  assert.equal(hasRawHtml("<figure><img src=\"/x.png\" alt=\"a\" loading=\"lazy\" /><figcaption>cap</figcaption></figure>"), true);
  // Inline html counts too — deliberately conservative.
  assert.equal(hasRawHtml("some *md* with <i>inline html</i> in it"), true);
  assert.equal(hasRawHtml('<img src="/x.png" width="400">'), true);
  // Plain markdown (including images and links) does not.
  assert.equal(hasRawHtml("# Title\n\n![alt](/images/x.png)\n\n[link](https://x)"), false);
  // HTML inside code fences/spans is data, not markup.
  assert.equal(hasRawHtml("```html\n<iframe src=x></iframe>\n```"), false);
  assert.equal(hasRawHtml("use `<figure>` for captions"), false);
  assert.equal(hasRawHtml(""), false);
});
