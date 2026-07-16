# Writing a new post

Posts live in `src/content/blog/` as Markdown files. Publishing = add a file and
push to `master`; GitHub Actions builds and deploys automatically (~1–2 min).

## Quick start

```bash
npm run new "My Post Title"
```

This creates `src/content/blog/my-post-title.md` with frontmatter pre-filled.
The filename becomes the URL: `https://www.nagaraj.com.au/blog/my-post-title`.

## Visual editor (local only)

Prefer writing in a rich-text editor? Run the dev server and open the local
editor:

```bash
npm run dev      # then visit http://localhost:4321/_editor
```

Fill in the title, description, and tags, write the post in the WYSIWYG editor
(it also has a markdown tab), and hit **Save post**. That writes a normal
markdown file into `src/content/blog/` — same format as `npm run new` — and
the post is instantly previewable at `http://localhost:4321/blog/<slug>`.
Re-saving updates your draft; the filename/URL is fixed by the first save.

Notes:

- The editor exists **only** in the local dev server. It is never built or
  deployed — the live site has no `/_editor` route.
- Saving is refused (with your work kept in the editor) if the file was
  changed on disk by something else, if a post with the same slug already
  exists, or after the dev server restarted — copy your text, reload, and
  continue in the file directly.
- An interrupted save never leaves a half-written post — you always keep a
  complete version, old or new. After a hard crash or power loss, glance at
  the file and re-save from the editor (or restore from git) if it looks off.
- Images with title text (`![alt](url "title")`) are preserved when you write
  them in the **Markdown tab**. The WYSIWYG view can't represent image titles
  and drops them if you edit there — the editor warns you when that applies.
- Publishing is unchanged: commit the file and push (see below).

### Images

Inserting an image in the editor (toolbar button, paste, or drag-and-drop)
uploads the file into `public/images/` and puts a normal reference like
`![alt](/images/my-photo-1a2b3c4d.png)` into the markdown. Images are never
embedded into the post as base64 — that used to produce megabyte-sized
markdown files that many markdown tools handle poorly and that would
eventually push saves over the editor's request-size limit.
Commit the new file(s) under `public/images/` together with the post.

Allowed formats: PNG, JPEG, GIF, WebP (validated by content, up to 8 MB).
SVG is deliberately not accepted.

**To control an image's display size**, switch to the **Markdown tab** and
write the image as plain HTML:

```html
<img src="/images/my-photo-1a2b3c4d.png" width="400" alt="my photo">
```

`width`/`height` attributes only survive in the Markdown tab — the WYSIWYG
view drops them (same as image titles), so the editor blocks switching to
WYSIWYG while the draft has a sized image and warns you, exactly like the
titled-image protection. Switch again within 8 seconds to override knowingly.

### Editing post files outside the editor

The editor refuses to overwrite a post that changed on disk since its last
save (you'll get a conflict message; your text stays in the editor). If you
edit the file in your IDE, treat the file as the source of truth from then on
— or copy your text, press "Start a new post", and re-save under a new title.

One formatting rule when hand-editing: make `---` the very first line, with no
blank lines above it. The site builds fine either way, but if blank lines creep
in above the `---`, some markdown previews (including VS Code's) stop treating
the block as frontmatter and show it as plain text at the top of the post.

## Frontmatter

```markdown
---
title: "My Post Title"
description: "One-line summary for the list, RSS, and search results."
pubDate: 2026-06-02
tags: [ai, tech]
---

Your writing here.
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Shown everywhere |
| `description` | yes | One line; used for SEO + list |
| `pubDate` | yes | `YYYY-MM-DD` |
| `tags` | no | Lowercased; each gets a `/tags/<tag>` page |

## Preview locally

```bash
npm install      # first time only
npm run dev      # http://localhost:4321
```

## Publish

- **From a computer:** commit the new file and `git push`.
- **From your phone / browser:** on GitHub, open `src/content/blog/`, *Add file →
  Create new file*, paste, *Commit*. Done.

Markdown supports headings, **bold**, lists, links, images (remote URLs are fine),
and fenced code blocks ` ```lang ` which get syntax highlighting automatically.

In the local editor (`/_editor`), add code with the **Code Block** toolbar button
(2nd group), then click the block's **top-right corner**, type to filter the
language list, and click a match (or press **Enter**) to set the language — or
switch to the **Markdown** tab and type ` ```lang ` directly.

## New posts and the chat widget

You don't need to do anything extra for the "ask the blog" chat widget — **new
posts are included automatically.**

- The chat's knowledge comes from `/chat-index.json`, which is **regenerated on
  every build** from `src/content/blog/`. Add a post and push → the deploy
  rebuilds the index with the new post → the widget can find and answer from it.
- The Cloudflare Worker (LLM mode) stores no content. The site sends it the most
  relevant post excerpts per question, so it reasons over new posts too — **no
  Worker redeploy needed when you add blogs.**
- Redeploy the Worker only if you change the Worker code, the model, or the
  author bio in `worker/src/index.js`.

> Caching note: right after a deploy, a CDN-cached `chat-index.json` may take a
> few minutes (or a cache purge) to refresh, so a brand-new post can lag briefly
> in the chat — the post page itself is live immediately.
