// Post store for the local blog editor: validates input, serializes
// frontmatter matching src/content/blog conventions, and writes files so the
// collection never sees a partial post. See .omc/plans/44-local-blog-editor.md.
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";

/** Same rule as scripts/new-post.mjs and tagSlug() in src/consts.ts. */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Local calendar date (YYYY-MM-DD) — not UTC, so late-evening AEST posts
 * carry the author's actual date. Clock and zone injectable for tests. */
export function localToday(now = new Date(), timeZone = undefined) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** Validation error the middleware maps to 400. */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.code = "invalid";
  }
}

/** Conflict/refusal the middleware maps to 409. */
export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.code = "conflict";
  }
}

export function validatePost(input) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const body = typeof input.body === "string" ? input.body : "";
  let tags = input.tags ?? [];

  if (!title) throw new ValidationError("title is required");
  const slug = slugify(title);
  if (!slug)
    throw new ValidationError(
      "title must contain at least one letter or digit (a-z, 0-9) so it can become a URL slug",
    );
  // Keep the final path component (`.<slug>.md.tmp`) well under the common
  // 255-byte filesystem limit.
  if (slug.length > 200)
    throw new ValidationError("title is too long (slug exceeds 200 characters)");
  if (!description) throw new ValidationError("description is required");
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))
    throw new ValidationError("tags must be an array of strings");
  tags = tags.map((t) => t.trim());
  for (const tag of tags) {
    if (!slugify(tag))
      throw new ValidationError(
        `tag ${JSON.stringify(tag)} must contain at least one letter or digit (it becomes a /tags/ URL)`,
      );
  }
  return { title, description, tags, body, slug };
}

/** Exact established file shape: quoted title/description, bare YYYY-MM-DD
 * date, JSON-array tags. JSON.stringify per scalar = safe YAML (same
 * technique as scripts/new-post.mjs). */
export function serializeFrontmatter({ title, description, pubDate, tags }) {
  return [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: ${pubDate}`,
    `tags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    "---",
  ].join("\n");
}

export function renderPostFile(meta, body) {
  // Body is preserved verbatim; only the final newline count is normalized.
  const trimmed = body.replace(/\n+$/, "");
  return `${serializeFrontmatter(meta)}\n\n${trimmed}\n`;
}

/**
 * Filesystem facade — every operation the store performs goes through here so
 * tests can observe/fail each step deterministically. Uses fd-based ops where
 * identity matters.
 */
export function defaultFsx() {
  return import("node:fs/promises").then((fsp) => ({
    // open/read/write/stat/close on file handles; link/rename/unlink on paths
    open: (p, flags) => fsp.open(p, flags),
    link: (a, b) => fsp.link(a, b),
    rename: (a, b) => fsp.rename(a, b),
    unlink: (p) => fsp.unlink(p),
  }));
}

/**
 * PostStore: holds the per-server-run ownership registry and the write mutex.
 * Concurrency model (from the agreed plan): single local author; all editor
 * writes serialize through this mutex; external edits are detected at the
 * next save and refused — never merged, never overwritten.
 */
export class PostStore {
  #dir;
  #fsx;
  #clock;
  #registry = new Map(); // postId -> { slug, ino, rev }
  #queue = Promise.resolve();
  #lastSave = null; // most recent successful save; lets the client recover
  // ownership when the dev server's post-save page reload beats the response

  /**
   * Read the last successful save THROUGH the write mutex: a read that
   * arrives while a save is in flight waits for it and returns the final
   * truth — it can never observe a mid-save (phantom or missing) state.
   */
  getLastSave() {
    const run = this.#queue.then(() => this.#lastSave);
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  constructor({ dir, fsx, clock }) {
    this.#dir = resolve(dir);
    this.#fsx = fsx ?? null;
    this.#clock = clock ?? (() => new Date());
  }

  async #fs() {
    if (!this.#fsx) this.#fsx = await defaultFsx();
    return this.#fsx;
  }

  /** Serialize all saves through one in-process mutex. */
  save(args) {
    const run = this.#queue.then(() => this.#save(args));
    // Keep the chain alive even when a save rejects.
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  #paths(slug) {
    const target = resolve(join(this.#dir, `${slug}.md`));
    const temp = resolve(join(this.#dir, `.${slug}.md.tmp`));
    // Defense in depth: slugify() cannot emit path separators, but never
    // trust that here — both paths must stay inside the blog dir.
    if (!target.startsWith(this.#dir + "/") || !temp.startsWith(this.#dir + "/"))
      throw new ValidationError("resolved path escapes the blog directory");
    return { target, temp };
  }

  async #writeTemp(fsx, temp, content) {
    const bytes = Buffer.from(content, "utf8");
    // A previous interrupted save may have left a stale temp; it is outside
    // the collection glob and owned by this store, so clear it.
    await fsx.unlink(temp).catch(() => {});
    let fh;
    try {
      fh = await fsx.open(temp, "wx");
      await fh.writeFile(bytes);
      const st = await fh.stat();
      return { bytes, ino: String(st.ino) };
    } catch (err) {
      await fh?.close().catch(() => {});
      await fsx.unlink(temp).catch(() => {});
      throw err;
    } finally {
      await fh?.close().catch(() => {});
    }
  }

  async #save({ input, mode, postId, rev }) {
    const fsx = await this.#fs();
    const valid = validatePost(input ?? {});

    if (mode === "create") return this.#create(fsx, valid);
    if (mode === "update") return this.#update(fsx, valid, postId, rev);
    throw new ValidationError(`unknown mode ${JSON.stringify(mode)}`);
  }

  async #create(fsx, valid) {
    const { slug } = valid;
    const { target, temp } = this.#paths(slug);
    const pubDate = localToday(this.#clock());
    const content = renderPostFile({ ...valid, pubDate }, valid.body);

    const { bytes, ino } = await this.#writeTemp(fsx, temp, content);
    try {
      // Exclusive placement: link() fails with EEXIST if target exists, so a
      // pre-existing post can never be clobbered (no existsSync TOCTOU).
      await fsx.link(temp, target);
    } catch (err) {
      await fsx.unlink(temp).catch(() => {});
      if (err && err.code === "EEXIST")
        throw new ConflictError(`a post already exists at ${slug}.md`);
      throw err;
    }
    await fsx.unlink(temp).catch(() => {});

    // A client reload triggered by the publish above reaches /last-save via
    // getLastSave(), which serializes behind this save on the mutex — so
    // recording after publish is race-free by construction.
    const newRev = sha256(bytes);
    const newId = randomUUID();
    this.#registry.set(newId, { slug, ino, rev: newRev, pubDate });
    this.#lastSave = { postId: newId, slug, path: target, rev: newRev, pubDate };
    return this.#lastSave;
  }

  async #update(fsx, valid, postId, rev) {
    const entry = this.#registry.get(postId);
    // Ownership: only files created through this endpoint, this server run.
    if (!entry)
      throw new ConflictError(
        "unknown postId — this editor session does not own that post " +
          "(copy your work, reload the editor, and edit the file directly " +
          "or create a new post)",
      );
    // Freshness needs three-way agreement: client rev, registry rev, and the
    // on-disk bytes must all match. Comparing the client rev to the registry
    // first means a caller can never bless an external edit by sending that
    // edit's own hash.
    if (rev !== entry.rev)
      throw new ConflictError("stale rev — the post changed since your last save");

    // The update always targets the slug registered at create time; a title
    // change never retargets the file.
    const { target, temp } = this.#paths(entry.slug);

    let fh;
    try {
      fh = await fsx.open(target, "r");
      const st = await fh.stat();
      if (String(st.ino) !== entry.ino)
        throw new ConflictError(
          "the post file was replaced on disk since your last save",
        );
      const onDisk = await fh.readFile();
      if (sha256(onDisk) !== entry.rev)
        throw new ConflictError(
          "the post file was edited on disk since your last save",
        );
    } catch (err) {
      if (err && err.code === "ENOENT")
        throw new ConflictError("the post file no longer exists on disk");
      throw err;
    } finally {
      await fh?.close().catch(() => {});
    }

    // Keep the frontmatter pubDate stable across re-saves of the same draft.
    const pubDate = entry.pubDate ?? localToday(this.#clock());
    const content = renderPostFile({ ...valid, pubDate }, valid.body);

    // New rev + inode are known BEFORE the rename (rename preserves the
    // inode), so after the atomic publish only a synchronous in-memory
    // registry assignment remains — no failable step in between.
    const { bytes, ino } = await this.#writeTemp(fsx, temp, content);
    const newRev = sha256(bytes);
    try {
      await fsx.rename(temp, target);
    } catch (err) {
      await fsx.unlink(temp).catch(() => {});
      throw err;
    }
    this.#registry.set(postId, { ...entry, ino, rev: newRev, pubDate });
    this.#lastSave = { postId, slug: entry.slug, path: target, rev: newRev, pubDate };
    return this.#lastSave;
  }
}
