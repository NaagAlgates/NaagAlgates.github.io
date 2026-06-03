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

## Abuse protection

`CHAT_API_URL` is public (it must be — the browser calls it). No API key is ever
exposed; Workers AI is accessed via a server-side binding. The endpoint is
protected in three layers, **each optional and only active when configured**:

1. **Origin allow-list** — always on. Set `ALLOWED_ORIGINS` in `wrangler.toml`.
   Blocks other sites' browsers and naive callers.
2. **Per-IP rate limit** — on if the `RATE_LIMITER` binding deploys (it's in
   `wrangler.toml`: 15 requests / 60s per IP). If `wrangler deploy` errors on the
   `[[unsafe.bindings]]` block, comment it out — rate-limiting is then skipped and
   the other layers still apply.
3. **Cloudflare Turnstile** (free CAPTCHA) — on if the `TURNSTILE_SECRET` is set.
   Setup:
   - Cloudflare dashboard → **Turnstile** → add a widget for `nagaraj.com.au`.
   - Put the **site key** (public) in `src/consts.ts`:
     ```ts
     export const TURNSTILE_SITE_KEY = "0x4AAA...";
     ```
   - Put the **secret key** on the Worker (never in code):
     ```bash
     cd worker && npx wrangler secret put TURNSTILE_SECRET
     ```
   - Redeploy the Worker. The widget will now require a Turnstile token, and the
     Worker verifies it before calling the model.

   Leave `TURNSTILE_SITE_KEY` empty to skip Turnstile entirely.

## Notes

- Cost: Workers AI free tier (Neurons/day). Low-traffic blogs stay free; if the
  cap is hit the chat pauses until reset — no surprise bill.
- The Worker only answers from the excerpts the site sends + the author bio, so
  it won't fabricate beyond the blog. The bio lives in `src/index.js`.
