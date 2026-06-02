# Astro Blog Refresh — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design)
**Author:** Nagaraj Alagusundaram

## Summary

Replace the existing Jekyll + `portfolYOU` portfolio site with a fresh, minimal,
**blog-only** site built on **Astro 5**. Remove all personal/portfolio detail
(photo, CV, work projects, career timeline, skills, social links, email). Keep
the 18 existing blog posts. Reposition the site as a general **tech & AI** writing
blog with a prominent, SEO-backed **"human-written, not AI"** stance. Continue
hosting on **GitHub Pages** at the existing domain **www.nagaraj.com.au**.

## Goals

- Migrate the 18 existing Markdown posts to Astro with preserved URLs.
- A distinctive "Mono Dev" dark aesthetic with a light/dark toggle.
- Blog-only: no portfolio, no CV, no photo, no contact/social.
- Broad positioning: tech & AI, "anything worth thinking through."
- Prominent + machine-readable "human-written, no AI" signals.
- Same host (GitHub Pages) and same domain (www.nagaraj.com.au).

## Non-Goals

- No CMS, comments (Disqus removed), search, or newsletter.
- No analytics/tracking added in this pass.
- No content rewriting of existing posts beyond mechanical cleanup.
- SEO scope is **on-page signals only** — not a ranking guarantee.

## Aesthetic

"Mono Dev" direction (approved from mockup B):

- **Fonts:** `Space Mono` (mono accents, headers, code labels) + `Sora` (body).
- **Theme:** dark default; **light/dark toggle** respecting `prefers-color-scheme`
  with manual override persisted to `localStorage`. CSS custom properties drive
  both themes (no flash-of-wrong-theme: inline head script sets theme before paint).
- **Motifs:** terminal-style header (`~ $ whoami`), subtle grid background,
  rounded post-list panel, code-tag pills, dashed-underline links.
- **Accents:** green (`--accent`) + blue (`--accent2`); muted greys for body.

## Information Architecture

| Route | Purpose |
|-------|---------|
| `/` | Terminal header, tiny generic bio (tech & AI), "human-written" statement, full post list |
| `/blog/<slug>` | Single post. **URLs preserved** — current Jekyll permalink is `/blog/:title` |
| `/tags/<tag>` | Tag filter page (tags already exist in post frontmatter) |
| `/rss.xml` | RSS feed |
| `/404` | Not found |

- **Bio:** one or two lines, generic to tech & AI. Keeps the name "Nagaraj"
  (it is the domain). No employer, no years-of-experience, no photo, no contact.
- **Human-written badge:** a persistent small badge/line in the header or footer
  of **every page** (e.g. `✍ Human-written · No AI`), plus a one-line statement
  on the homepage.

## Content Model & Migration

Astro **Content Collection** `blog` with a Zod schema:

```ts
{
  title: string,
  description: string,
  pubDate: Date,
  tags: string[] (default []),
}
```

Migration of `_posts/*.md` → `src/content/blog/*.md`:

- **Slug:** filename minus the `YYYY-MM-DD-` date prefix (preserves `/blog/<slug>`).
- **pubDate:** parsed from the filename date prefix.
- **Frontmatter:** keep `title`, `description`, `tags`; **drop** `style`, `color`,
  `comments` (portfolYOU/Disqus cruft).
- **Liquid cleanup:** strip genuine Jekyll tags (e.g. `{{ site.author.name }}`,
  `{% ... %}` includes). Code-block braces are left untouched — Astro `.md`
  (not `.mdx`) renders curly braces literally, so code examples are safe.
- **Images:** keep the 4 in-post technical diagrams/screenshots; migrate their
  assets into the Astro project. **Remove only** the personal headshot
  (`assets/img/nag.jpeg`).
- **Syntax highlighting:** Astro built-in Shiki for fenced code blocks (this is a
  technical blog — code rendering matters).

## SEO & "Human-Written" Signals

Honest scope: on-page signals only.

- Global `<meta name="author">`, `<meta name="description">` and keyword/OG/Twitter
  meta including "human-written, no AI" phrasing.
- Per-post **JSON-LD `BlogPosting`** with a human `author` (Person), `datePublished`,
  `headline`, `description` — the machine-readable signal search engines read.
- Visible "Human-written · No AI" badge on every page.
- Per-post canonical URL, title, and date.
- `sitemap.xml` (via `@astrojs/sitemap`) and `rss.xml`.

## Removal List

Deleted from the new site (recoverable via git history):

- `_projects/` (17 work projects)
- `_data/` (timeline, programming-skills, other-skills, social-media)
- `pages/about.md` (CV bio), `pages/projects.html`, portfolYOU-specific pages
- `assets/img/nag.jpeg` (headshot) and other portfolio assets
- `_config.yml` author block: email, social links (github/linkedin/stackoverflow/
  twitter/youtube)
- `Gemfile`, `Gemfile.lock`, Jekyll config and theme

Preserved: the 18 posts (cleaned), `CNAME`.

## Deployment

- **Build:** Astro static output.
- **CI/CD:** GitHub Actions using `withastro/action` → deploy to GitHub Pages on
  push to `master`.
- **Domain:** `CNAME` (www.nagaraj.com.au) preserved; Astro `site` set to the
  domain, `base` empty (custom domain serves at root).
- Old Jekyll files removed in the same change set.

## Project Structure (target)

```
/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── public/
│   └── CNAME
├── src/
│   ├── content.config.ts        # blog collection schema
│   ├── content/blog/*.md        # 18 migrated posts
│   ├── components/
│   │   ├── BaseHead.astro        # meta, OG, JSON-LD, theme script
│   │   ├── Header.astro          # terminal header + human-written badge + theme toggle
│   │   ├── Footer.astro
│   │   ├── PostList.astro
│   │   └── ThemeToggle.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PostLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── blog/[slug].astro
│   │   ├── tags/[tag].astro
│   │   ├── rss.xml.ts
│   │   └── 404.astro
│   └── styles/global.css         # CSS vars, light/dark themes, Mono Dev styling
└── .github/workflows/deploy.yml
```

## Risks & Mitigations

- **URL regressions:** keep `/blog/<slug>` exactly to preserve inbound links/SEO.
- **Theme flash:** inline pre-paint script reads stored theme before first paint.
- **Liquid in code:** only strip real Jekyll tags; verify no code snippet is altered.
- **Lost old content:** retained in git history; can restore if needed.

## Open Questions

None outstanding — all design decisions confirmed with the user.
