# nagaraj.dev

A minimal, human-written blog about tech & AI. Built with [Astro](https://astro.build),
hosted on GitHub Pages at **www.nagaraj.com.au**.

> Every post on this site is written by a human, never by AI.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
```

## Write a post

```bash
npm run new "My Post Title"
```

See [WRITING.md](./WRITING.md) for the full guide. Posts live in
`src/content/blog/*.md`.

## Build

```bash
npm run build      # output in dist/
npm run preview    # preview the production build
```

## Deploy

Pushing to `master` triggers `.github/workflows/deploy.yml`, which builds the site
and deploys to GitHub Pages. The custom domain (`public/CNAME`) and Bluesky handle
verification (`public/.well-known/atproto-did`) are preserved in the build output.

> **Pages source must be set to "GitHub Actions"** (Settings → Pages → Build and
> deployment → Source), not "Deploy from a branch".

## Structure

```
src/
  content/blog/      # posts (Markdown)
  components/        # Astro components
  layouts/           # page + post layouts
  pages/             # routes (/, /blog/[slug], /tags/[tag], rss, 404)
  styles/global.css  # Mono Dev theme, light/dark
  consts.ts          # site identity + SEO copy
public/              # CNAME, .well-known, favicon (copied verbatim to dist/)
scripts/             # new-post + (one-off) migrate-posts
```
