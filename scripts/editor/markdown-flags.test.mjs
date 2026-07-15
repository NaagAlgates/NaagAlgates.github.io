// hasSizedImage: the sized-image counterpart of the titled-image guard.
import test from "node:test";
import assert from "node:assert/strict";
import { hasSizedImage, hasTitledImage } from "./markdown-flags.mjs";

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
