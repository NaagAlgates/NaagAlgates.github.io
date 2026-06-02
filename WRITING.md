# Writing a new post

Posts live in `src/content/blog/` as Markdown files. Publishing = add a file and
push to `master`; GitHub Actions builds and deploys automatically (~1–2 min).

## Quick start

```bash
npm run new "My Post Title"
```

This creates `src/content/blog/my-post-title.md` with frontmatter pre-filled.
The filename becomes the URL: `https://www.nagaraj.com.au/blog/my-post-title`.

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
