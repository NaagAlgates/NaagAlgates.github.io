// ImageStore: magic-byte validation, content-addressed naming, no-clobber
// collision handling, and temp-file hygiene.
import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ImageStore, imageFileName, sniffImageType } from "./image-store.mjs";
import { ValidationError, sha256 } from "./post-store.mjs";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("png-payload"),
]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("jpg-payload")]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.from("gif-payload")]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBPxx")]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

const makeDir = () => fsp.mkdtemp(join(tmpdir(), "blog-editor-images-"));

async function listDir(dir) {
  return (await fsp.readdir(dir)).sort();
}

test("sniffImageType: accepts png/jpeg/gif/webp, rejects svg/text/truncated", () => {
  assert.equal(sniffImageType(PNG).ext, "png");
  assert.equal(sniffImageType(JPG).ext, "jpg");
  assert.equal(sniffImageType(GIF).ext, "gif");
  assert.equal(sniffImageType(WEBP).ext, "webp");
  assert.equal(sniffImageType(SVG), null);
  assert.equal(sniffImageType(Buffer.from("plain text")), null);
  assert.equal(sniffImageType(PNG.subarray(0, 2)), null); // truncated magic
});

test("imageFileName: slugged stem, capped length, content hash, sniffed ext", () => {
  const name = imageFileName("My Holiday Photo.PNG", PNG);
  assert.match(name, /^my-holiday-photo-[0-9a-f]{8}\.png$/);
  assert.equal(name, imageFileName("My Holiday Photo.PNG", PNG)); // deterministic
  // client-claimed extension is ignored; magic bytes win
  assert.match(imageFileName("evil.svg", JPG), /\.jpg$/);
  // unslugifiable stem falls back to "image"
  assert.match(imageFileName("日本語.png", PNG), /^image-[0-9a-f]{8}\.png$/);
  // very long stems are capped (64) so the component stays short
  const long = imageFileName(`${"a".repeat(400)}.png`, PNG);
  assert.ok(long.length < 100, long);
});

test("save: writes the file, idempotent for identical content", async () => {
  const dir = await makeDir();
  const store = new ImageStore({ dir });
  const first = await store.save("photo.png", PNG);
  assert.match(first.url, /^\/images\/photo-[0-9a-f]{8}\.png$/);
  assert.deepEqual(await fsp.readFile(join(dir, first.fileName)), PNG);

  const second = await store.save("photo.png", PNG);
  assert.equal(second.fileName, first.fileName); // same bytes -> same name
  assert.deepEqual(await listDir(dir), [first.fileName]); // no dup, no temp
});

test("save: hash-prefix collision with different content retries longer suffix", async () => {
  const dir = await makeDir();
  const store = new ImageStore({ dir });
  // Occupy the 8-hex name with DIFFERENT (but valid image) content.
  const shortName = imageFileName("photo.png", PNG, 8);
  const impostor = Buffer.concat([PNG, Buffer.from("-other")]);
  await fsp.writeFile(join(dir, shortName), impostor);

  const saved = await store.save("photo.png", PNG);
  assert.notEqual(saved.fileName, shortName);
  assert.match(saved.fileName, /^photo-[0-9a-f]{16}\.png$/); // 16-hex retry
  // the impostor is untouched, and the real bytes live at the longer name
  assert.deepEqual(await fsp.readFile(join(dir, shortName)), impostor);
  assert.deepEqual(await fsp.readFile(join(dir, saved.fileName)), PNG);
  assert.deepEqual(await listDir(dir), [shortName, saved.fileName].sort()); // no temp
});

test("save: no temp file left after success, EEXIST, or injected failure", async () => {
  const dir = await makeDir();
  const noTemps = async () =>
    assert.deepEqual((await listDir(dir)).filter((f) => f.startsWith(".")), []);

  const store = new ImageStore({ dir });
  await store.save("a.png", PNG); // success
  await noTemps();
  await store.save("a.png", PNG); // EEXIST-identical path
  await noTemps();

  // Injected write failure: fsx whose file handle fails writeFile.
  const failingFsx = {
    open: async (p, f) => {
      const fh = await fsp.open(p, f);
      return {
        writeFile: async () => {
          throw new Error("injected write failure");
        },
        readFile: () => fh.readFile(),
        stat: () => fh.stat(),
        close: () => fh.close().catch(() => {}),
      };
    },
    link: (a, b) => fsp.link(a, b),
    rename: (a, b) => fsp.rename(a, b),
    unlink: (p) => fsp.unlink(p),
  };
  const broken = new ImageStore({ dir, fsx: failingFsx });
  await assert.rejects(broken.save("b.png", PNG), /injected/);
  await noTemps();
});

test("save: traversal-shaped names are neutralized by slugification + confinement", async () => {
  const dir = await makeDir();
  const store = new ImageStore({ dir });
  const saved = await store.save("../../etc/passwd.png", PNG);
  assert.match(saved.fileName, /^etc-passwd-[0-9a-f]{8}\.png$/);
  const files = await listDir(dir);
  assert.deepEqual(files, [saved.fileName]); // nothing written outside dir
});

test("save: rejects unknown types, empty buffers, empty names", async () => {
  const dir = await makeDir();
  const store = new ImageStore({ dir });
  await assert.rejects(store.save("x.svg", SVG), ValidationError);
  await assert.rejects(store.save("x.txt", Buffer.from("hello")), ValidationError);
  await assert.rejects(store.save("x.png", Buffer.alloc(0)), ValidationError);
  await assert.rejects(store.save("", PNG), ValidationError);
  assert.deepEqual(await listDir(dir), []);
});

test("save: never returns a URL whose bytes differ from the upload", async () => {
  const dir = await makeDir();
  const store = new ImageStore({ dir });
  // Even in the collision test above this held; assert the invariant plainly.
  const saved = await store.save("photo.png", JPG);
  assert.equal(sha256(await fsp.readFile(join(dir, saved.fileName))), sha256(JPG));
});
