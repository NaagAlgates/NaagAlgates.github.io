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
- Saves are atomic: the site never sees a half-written post. If your machine
  crashes mid-save, worst case is re-saving the draft.
- Publishing is unchanged: commit the file and push (see below).

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
