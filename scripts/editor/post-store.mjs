// Post store for the local blog editor: validates input, serializes
// frontmatter matching src/content/blog conventions, and writes files so the
// collection never sees a partial post. See .omc/plans/44-local-blog-editor.md.
import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { hasRawHtml, hasSizedImage, hasTitledImage } from "./markdown-flags.mjs";

/** Single source of truth for the save endpoint's JSON body cap (middleware
 * imports this). Open-time size refusals leave headroom below it so a post
 * that opens can always be saved. */
export const SAVE_BODY_LIMIT = 2 * 1024 * 1024; // 2 MiB
const SAVE_BODY_HEADROOM = 64 * 1024; // 64 KiB

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

export function renderPostFile(meta, body, { blankAfterFrontmatter = true } = {}) {
  // Body is preserved verbatim; only the final newline count is normalized.
  // blankAfterFrontmatter: the editor's own files put a blank line between
  // the closing --- and the body, but 18 of the 20 legacy posts don't —
  // an opened post must be re-saved in ITS OWN layout or a no-edit save
  // would mutate the file (issue #53).
  const trimmed = body.replace(/\n+$/, "");
  return `${serializeFrontmatter(meta)}\n${blankAfterFrontmatter ? "\n" : ""}${trimmed}\n`;
}

/** One frontmatter scalar, strictly: must be a canonical JSON string token —
 * `JSON.stringify(JSON.parse(token))` byte-identical — so a save can never
 * silently respell it (e.g. `a` for `a`, or `\/`). */
function parseCanonicalString(token, key) {
  let value;
  try {
    value = JSON.parse(token);
  } catch {
    throw new ConflictError(
      `frontmatter ${key} is not the editor's quoted format — edit this file directly`,
    );
  }
  if (typeof value !== "string" || JSON.stringify(value) !== token)
    throw new ConflictError(
      `frontmatter ${key} uses a spelling the editor would rewrite on save — edit this file directly`,
    );
  return value;
}

/**
 * Strict parser for the exact file shape this editor writes (the whole
 * current corpus verifiably uses it). Anything else — unknown or reordered
 * keys (incl. schema-optional updatedDate/image), unquoted scalars,
 * non-canonical spellings, a missing blank line — is refused with
 * ConflictError rather than opened-and-rewritten: silent dropping or
 * normalizing of frontmatter the editor doesn't model is forbidden
 * (issue #53 investigation, hazard 4).
 */
export function parseFrontmatter(fileText) {
  const lines = String(fileText).split("\n");
  const fail = (why) =>
    new ConflictError(`${why} — this file is not in the editor's format; edit it directly`);
  if (lines[0] !== "---" || lines.length < 7) throw fail("unrecognized frontmatter layout");
  if (lines[5] !== "---")
    throw fail(
      "frontmatter is not exactly title/description/pubDate/tags (an extra, missing, or reordered key)",
    );
  // Editor-written files have a blank line between --- and the body; most
  // legacy posts don't. Both layouts are accepted, and which one the file
  // uses is preserved so a no-edit save stays byte-identical.
  const blankAfterFrontmatter = lines[6] === "";
  const take = (line, key) => {
    if (!line.startsWith(`${key}: `)) throw fail(`expected ${key} at its fixed position`);
    return line.slice(key.length + 2);
  };
  const title = parseCanonicalString(take(lines[1], "title"), "title");
  const description = parseCanonicalString(take(lines[2], "description"), "description");
  const pubDate = take(lines[3], "pubDate");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pubDate) || Number.isNaN(Date.parse(pubDate)))
    throw fail("pubDate is not a plain YYYY-MM-DD date");
  const tagsToken = take(lines[4], "tags");
  let tags;
  try {
    tags = JSON.parse(tagsToken);
  } catch {
    throw fail("tags is not a JSON array");
  }
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))
    throw fail("tags is not an array of strings");
  const canonicalTags = `[${tags.map((t) => JSON.stringify(t)).join(", ")}]`;
  if (canonicalTags !== tagsToken)
    throw fail("tags uses a spelling the editor would rewrite on save");
  // join() reconstructs the body byte-exactly, including its trailing newline.
  const body = lines.slice(blankAfterFrontmatter ? 7 : 6).join("\n");
  return { title, description, pubDate, tags, body, blankAfterFrontmatter };
}

/**
 * Why a parsed post still can't round-trip through the editor UI, or null.
 * Every case here is something the save path or the single-line inputs would
 * silently mutate or reject (hazards 6-9); refusing at open is the agreed
 * policy — never silent alteration. Verified zero-impact on the current
 * corpus. All refusals surface as 409 (ConflictError) via openPost.
 */
export function openRefusalReason({ title, description, tags }, body) {
  if (!description.trim()) return "its description is blank, which the editor cannot save";
  for (const [key, value] of [
    ["title", title],
    ["description", description],
  ]) {
    if (/[\r\n]/.test(value)) return `its ${key} spans multiple lines, which the editor's single-line field would flatten`;
    if (value !== value.trim()) return `its ${key} has leading/trailing whitespace the editor would strip on save`;
  }
  for (const tag of tags) {
    if (/[\r\n]/.test(tag)) return "a tag spans multiple lines, which the editor's tag field would flatten";
    if (!tag.trim()) return "it has an empty tag, which the editor's tag field would drop";
    if (tag !== tag.trim()) return `tag ${JSON.stringify(tag)} has surrounding whitespace the editor would strip`;
    if (tag.includes(",")) return `tag ${JSON.stringify(tag)} contains a comma, which the editor's comma-separated tag field would split`;
    if (!slugify(tag)) return `tag ${JSON.stringify(tag)} has no slug form, which the editor cannot save`;
  }
  const slug = slugify(title);
  if (!slug) return "its title has no slug form, which the editor cannot save";
  if (slug.length > 200) return "its title's slug exceeds the editor's 200-character save limit";
  // Hazard 8: a post must never open if its save request could not fit the
  // endpoint's body cap. Measure real UTF-8 bytes (string .length undercounts
  // non-ASCII) of a worst-case-shaped payload.
  const payload = JSON.stringify({
    mode: "update",
    postId: "0".repeat(36),
    rev: "0".repeat(64),
    title,
    description,
    tags,
    body,
  });
  if (Buffer.byteLength(payload, "utf8") > SAVE_BODY_LIMIT - SAVE_BODY_HEADROOM)
    return "it is too large to save through the editor's 2 MiB request limit";
  return null;
}

export const NESTED_POST_REASON =
  "nested posts are not supported by the editor yet — edit the file directly";

/**
 * Filesystem facade — every operation the store performs goes through here so
 * tests can observe/fail each step deterministically. Uses fd-based ops where
 * identity matters.
 */
export function defaultFsx() {
  return import("node:fs/promises").then((fsp) => ({
    // open/read/write/stat/close on file handles; link/rename/unlink on
    // paths; readdir (withFileTypes) for the post listing
    open: (p, flags) => fsp.open(p, flags),
    link: (a, b) => fsp.link(a, b),
    rename: (a, b) => fsp.rename(a, b),
    unlink: (p) => fsp.unlink(p),
    readdir: (p) => fsp.readdir(p, { withFileTypes: true }),
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
  #registry = new Map(); // postId -> { slug, relPath, ino, rev, pubDate }
  #queue = Promise.resolve();
  #lastSave = null; // most recent successful save; lets the client recover
  // ownership when the dev server's post-save page reload beats the response
  // Opaque per-run tokens for existing files (issue #53): the client never
  // holds a filesystem path — only a fileId minted here, resolved back
  // through these maps. Rebuilt/extended on every listing; tokens are stable
  // per relPath for the server run.
  #fileIdByPath = new Map(); // relPath -> fileId
  #pathByFileId = new Map(); // fileId -> relPath

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

  /** Resolve a collection-relative path (created posts pass `${slug}.md`) to
   * its target and glob-invisible temp sibling. Defense in depth: neither
   * slugify() nor the listing can emit an escaping path, but never trust that
   * here — both resolved paths must stay inside the blog dir. */
  #pathsFor(relPath) {
    const target = resolve(join(this.#dir, relPath));
    const temp = resolve(join(dirname(target), `.${basename(relPath)}.tmp`));
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

  /** Serialize the post listing through the write mutex (a list that arrives
   * mid-save waits and sees the final state). */
  listPosts() {
    const run = this.#queue.then(() => this.#listPosts());
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Serialize adoption of an existing file through the write mutex. */
  openPost(fileId) {
    const run = this.#queue.then(() => this.#openPost(fileId));
    this.#queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  #fileIdFor(relPath) {
    let id = this.#fileIdByPath.get(relPath);
    if (!id) {
      id = randomUUID();
      this.#fileIdByPath.set(relPath, id);
      this.#pathByFileId.set(id, relPath);
    }
    return id;
  }

  /** Read + strictly parse one post; returns identity (ino/rev) with it. */
  async #readPost(fsx, relPath) {
    const { target } = this.#pathsFor(relPath);
    let fh;
    try {
      fh = await fsx.open(target, "r");
      const st = await fh.stat();
      const bytes = await fh.readFile();
      const parsed = parseFrontmatter(bytes.toString("utf8"));
      return { parsed, ino: String(st.ino), rev: sha256(bytes) };
    } catch (err) {
      if (err && err.code === "ENOENT")
        throw new ConflictError("the post file no longer exists on disk");
      throw err;
    } finally {
      await fh?.close().catch(() => {});
    }
  }

  async #listPosts() {
    const fsx = await this.#fs();
    const found = []; // { relPath, nested }
    const walk = async (rel) => {
      const entries = await fsx.readdir(rel ? join(this.#dir, rel) : this.#dir);
      for (const ent of entries) {
        const name = ent.name;
        // Dotfiles/dot-dirs (.omc state, .<name>.md.tmp temps) are never
        // posts, and Astro's glob loader ignores underscore-prefixed files
        // (the seo tests rely on that for their _seo-fixture-* files) — the
        // listing mirrors the collection's own membership rules.
        if (name.startsWith(".") || name.startsWith("_")) continue;
        const childRel = rel ? `${rel}/${name}` : name;
        if (ent.isDirectory()) await walk(childRel);
        else if (name.endsWith(".md")) found.push({ relPath: childRel, nested: rel !== "" });
      }
    };
    await walk("");
    found.sort((a, b) => a.relPath.localeCompare(b.relPath));

    const posts = [];
    for (const { relPath, nested } of found) {
      const fileId = this.#fileIdFor(relPath);
      // Nested posts are collection-valid but outside this editor's write
      // model — surfaced with a reason, never silently missing (plan D1).
      if (nested) {
        posts.push({ fileId, relPath, title: relPath, pubDate: null, openable: false, reason: NESTED_POST_REASON });
        continue;
      }
      try {
        const { parsed } = await this.#readPost(fsx, relPath);
        const reason = openRefusalReason(parsed, parsed.body);
        posts.push({
          fileId,
          relPath,
          title: parsed.title,
          pubDate: parsed.pubDate,
          openable: !reason,
          ...(reason ? { reason } : {}),
        });
      } catch (err) {
        if (err instanceof ConflictError || err instanceof ValidationError) {
          posts.push({ fileId, relPath, title: relPath, pubDate: null, openable: false, reason: err.message });
        } else {
          throw err;
        }
      }
    }
    return posts;
  }

  async #openPost(fileId) {
    const fsx = await this.#fs();
    const relPath = this.#pathByFileId.get(typeof fileId === "string" ? fileId : "");
    // Same philosophy as unknown postId: the file is reachable only through a
    // token this server run minted.
    if (!relPath)
      throw new ConflictError("unknown fileId — refresh the post list and try again");
    // Nested posts are listed (visibly) but outside the editor's write model
    // (plan D1) — the refusal must hold here too, not just in the listing.
    if (relPath.includes("/")) throw new ConflictError(NESTED_POST_REASON);
    const { parsed, ino, rev } = await this.#readPost(fsx, relPath);
    const reason = openRefusalReason(parsed, parsed.body);
    if (reason) throw new ConflictError(`cannot open this post: ${reason}`);
    // Union of every lossy detector (plan D4): a titled-image-only post must
    // also load in markdown mode or open-time injection would lose titles.
    const wysiwygUnsafe =
      hasTitledImage(parsed.body) || hasSizedImage(parsed.body) || hasRawHtml(parsed.body);
    const slug = relPath.replace(/\.md$/, "");
    const postId = randomUUID();
    // Adoption: from here on the post has full ownership semantics — the
    // original pubDate AND frontmatter/body layout are preserved through the
    // registry (hazard 3), and the update path's three-way rev + inode checks
    // apply unchanged.
    this.#registry.set(postId, {
      slug,
      relPath,
      ino,
      rev,
      pubDate: parsed.pubDate,
      blankAfterFrontmatter: parsed.blankAfterFrontmatter,
    });
    return {
      postId,
      rev,
      relPath,
      slug,
      title: parsed.title,
      description: parsed.description,
      tags: parsed.tags,
      pubDate: parsed.pubDate,
      body: parsed.body,
      blankAfterFrontmatter: parsed.blankAfterFrontmatter,
      wysiwygUnsafe,
    };
  }

  async #create(fsx, valid) {
    const { slug } = valid;
    const { target, temp } = this.#pathsFor(`${slug}.md`);
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
    this.#registry.set(newId, { slug, relPath: `${slug}.md`, ino, rev: newRev, pubDate });
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

    // The update always targets the file registered at create/open time; a
    // title change never retargets (or renames) the file.
    const { target, temp } = this.#pathsFor(entry.relPath ?? `${entry.slug}.md`);

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

    // Keep the frontmatter pubDate — and the file's own frontmatter/body
    // separator layout (adopted legacy posts mostly lack the blank line) —
    // stable across re-saves.
    const pubDate = entry.pubDate ?? localToday(this.#clock());
    const content = renderPostFile({ ...valid, pubDate }, valid.body, {
      blankAfterFrontmatter: entry.blankAfterFrontmatter ?? true,
    });

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
