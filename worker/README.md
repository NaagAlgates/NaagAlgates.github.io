# Blog chat Worker

A tiny Cloudflare Worker that powers the "ask the blog" widget. It takes a
question plus the most relevant post excerpts (sent by the site), asks a free
**Cloudflare Workers AI** model, and returns a grounded answer.

The website (on GitHub Pages) stays static and free — this Worker is the only
backend, and Workers AI has a free daily allowance that's ample for a blog.

## Deploy (one time)

You need a free Cloudflare account (you already use Cloudflare for DNS).

```bash
cd worker
npm install
npx wrangler login        # opens browser, authorise once
npx wrangler deploy
```

`wrangler deploy` prints a URL like:

```
https://nagaraj-chat.<your-subdomain>.workers.dev
```

## Connect it to the site

1. Put that URL in `src/consts.ts` of the main site:
   ```ts
   export const CHAT_API_URL = "https://nagaraj-chat.<your-subdomain>.workers.dev";
   ```
2. Commit + push. GitHub Actions redeploys; the widget now gives full answers.

Until `CHAT_API_URL` is set, the widget still works — it just links visitors to
the most relevant posts (retrieval-only mode).

## Config (wrangler.toml)

- `ALLOWED_ORIGINS` — origins allowed to call the Worker (CORS). Update if the
  domain changes.
- `MODEL` — any Workers AI text model (default `@cf/meta/llama-3.1-8b-instruct`).

## Notes

- Cost: Workers AI free tier (Neurons/day). Low-traffic blogs stay free.
- The Worker only answers from the excerpts the site sends + the author bio, so
  it won't fabricate beyond the blog. The bio lives in `src/index.js`.
- To rate-limit or add abuse protection later, front it with Cloudflare WAF /
  Rate Limiting rules, or add a Turnstile check.
