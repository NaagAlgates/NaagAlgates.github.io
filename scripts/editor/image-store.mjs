// Image store for the local blog editor: validates uploaded bytes by magic
// numbers (never by client-supplied names/MIME), derives a content-addressed
// filename, and places files into public/images/ so posts can reference them
// as /images/<file>. See .omc/plans/45-editor-image-upload.md.
import { join, resolve } from "node:path";
import { ValidationError, defaultFsx, sha256, slugify } from "./post-store.mjs";

// Longest final component: 64 (stem) + 1 + 64 (full sha256) + 5 (".webp")
// = 134 bytes, well under the common 255-byte filesystem limit.
const STEM_MAX = 64;

const SNIFFERS = [
  {
    ext: "png",
    mime: "image/png",
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    ext: "jpg",
    mime: "image/jpeg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "gif",
    mime: "image/gif",
    test: (b) =>
      b.length >= 6 &&
      ["GIF87a", "GIF89a"].includes(b.toString("latin1", 0, 6)),
  },
  {
    ext: "webp",
    mime: "image/webp",
    test: (b) =>
      b.length >= 12 &&
      b.toString("latin1", 0, 4) === "RIFF" &&
      b.toString("latin1", 8, 12) === "WEBP",
  },
];

/** Magic-byte detection; returns {ext, mime} or null. SVG is deliberately
 * not accepted — it can carry scripts and these files ship on the real
 * site origin. */
export function sniffImageType(buf) {
  for (const s of SNIFFERS) if (s.test(buf)) return { ext: s.ext, mime: s.mime };
  return null;
}

/** `<slug-of-original-stem>-<sha256 prefix>.<sniffed ext>` — content-
 * addressed so identical bytes always map to the same name. */
export function imageFileName(originalName, buf, hashLen = 8) {
  const type = sniffImageType(buf);
  if (!type) throw new ValidationError("unsupported image type (allowed: png, jpeg, gif, webp)");
  const stem = String(originalName ?? "").replace(/\.[A-Za-z0-9]+$/, "");
  const slug = (slugify(stem) || "image").slice(0, STEM_MAX).replace(/-+$/, "") || "image";
  return `${slug}-${sha256(buf).slice(0, hashLen)}.${type.ext}`;
}

export class ImageStore {
  #dir;
  #fsx;

  constructor({ dir, fsx }) {
    this.#dir = resolve(dir);
    this.#fsx = fsx ?? null;
  }

  async #fs() {
    if (!this.#fsx) this.#fsx = await defaultFsx();
    return this.#fsx;
  }

  #confine(name) {
    const p = resolve(join(this.#dir, name));
    // slugify()/imageFileName() cannot emit separators; never trust that here.
    if (!p.startsWith(this.#dir + "/"))
      throw new ValidationError("resolved path escapes the images directory");
    return p;
  }

  async #readFile(fsx, path) {
    let fh;
    try {
      fh = await fsx.open(path, "r");
      return await fh.readFile();
    } finally {
      await fh?.close().catch(() => {});
    }
  }

  /**
   * Store `buf` and return { fileName, url }. Idempotent for identical
   * content. On a name collision with DIFFERENT content (hash-prefix
   * collision), retries with a longer hash suffix — it must never return
   * a URL that serves someone else's bytes. Temp files are cleaned up on
   * success, on EEXIST, and on every failure path.
   */
  async save(originalName, buf) {
    if (!Buffer.isBuffer(buf) || buf.length === 0)
      throw new ValidationError("empty image upload");
    if (typeof originalName !== "string" || originalName.trim() === "")
      throw new ValidationError("image name is required");
    const type = sniffImageType(buf);
    if (!type)
      throw new ValidationError("unsupported image type (allowed: png, jpeg, gif, webp)");

    const fsx = await this.#fs();
    const digest = sha256(buf);

    for (const hashLen of [8, 16, digest.length]) {
      const fileName = imageFileName(originalName, buf, hashLen);
      const target = this.#confine(fileName);
      const temp = this.#confine(`.${fileName}.tmp`);

      // A previous interrupted save may have left a stale temp; it is
      // dot-prefixed (never referenced by posts) and owned by this store.
      await fsx.unlink(temp).catch(() => {});
      let fh;
      try {
        fh = await fsx.open(temp, "wx");
        await fh.writeFile(buf);
      } catch (err) {
        await fh?.close().catch(() => {});
        await fsx.unlink(temp).catch(() => {});
        throw err;
      } finally {
        await fh?.close().catch(() => {});
      }

      try {
        // Exclusive placement: link() fails with EEXIST rather than
        // overwriting (same no-clobber technique as PostStore#create).
        await fsx.link(temp, target);
        return { fileName, url: `/images/${fileName}` };
      } catch (err) {
        if (!(err && err.code === "EEXIST")) throw err;
        // Same name already present: identical content → reuse; different
        // content → longer suffix on the next loop iteration.
        const existing = await this.#readFile(fsx, target);
        if (sha256(existing) === digest) return { fileName, url: `/images/${fileName}` };
      } finally {
        await fsx.unlink(temp).catch(() => {});
      }
    }
    // Full-digest name occupied by different bytes: not reachable without a
    // SHA-256 collision or an externally planted file.
    throw new ValidationError("image name collision could not be resolved");
  }
}
