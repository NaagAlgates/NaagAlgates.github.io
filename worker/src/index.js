// Cloudflare Worker: blog chat backend for nagaraj.com.au
// Receives { question, contexts:[{title,url,text}], turnstileToken? }, grounds the
// model with the post excerpts + Nagaraj's bio, returns { answer }.
//
// Abuse protection (each layer is optional and only active when configured):
//   1. Origin allow-list (ALLOWED_ORIGINS)            — always on
//   2. Per-IP rate limit (RATE_LIMITER binding)       — on if the binding exists
//   3. Cloudflare Turnstile (TURNSTILE_SECRET secret) — on if the secret is set
//
// Deploy + setup: see worker/README.md

const BIO = `Nagaraj Alagusundaram is a software engineer with 13+ years of experience building mobile and backend applications using Flutter, Kotlin, Swift, and Xamarin, with cloud experience on AWS and Azure. He has led teams, conducted technical interviews, and defined technical roadmaps, and has shipped products across health & fitness, dating, language learning, super apps, and employee engagement. He writes about technology and AI at nagaraj.com.au. Every post on the site is written by a human, never by AI.`;

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const allowed = allowedOrigins(env);
  const origin = request.headers.get("Origin") || "";
  const allow = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

async function verifyTurnstile(token, ip, secret) {
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token || "");
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const data = await r.json();
    return !!data.success;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405, cors);
    }

    // 1) Origin allow-list — blocks other sites' browsers and naive callers.
    const allowed = allowedOrigins(env);
    const origin = request.headers.get("Origin") || "";
    if (allowed.length && !allowed.includes(origin)) {
      return json({ error: "Forbidden origin" }, 403, cors);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "anon";

    // 2) Per-IP rate limit (only if the RATE_LIMITER binding is configured).
    if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "Too many requests" }, 429, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
    }

    // 3) Turnstile verification (only if the TURNSTILE_SECRET secret is set).
    if (env.TURNSTILE_SECRET) {
      const ok = await verifyTurnstile(payload?.turnstileToken, ip, env.TURNSTILE_SECRET);
      if (!ok) return json({ error: "Verification failed" }, 403, cors);
    }

    const question = String(payload?.question || "").slice(0, 500).trim();
    if (!question) return json({ error: "Missing question" }, 400, cors);

    const contexts = Array.isArray(payload?.contexts) ? payload.contexts.slice(0, 4) : [];
    const contextBlock =
      contexts
        .map(
          (c, i) =>
            `[${i + 1}] ${String(c.title || "").slice(0, 200)} (${String(c.url || "")})\n${String(c.text || "").slice(0, 1800)}`,
        )
        .join("\n\n") || "(no matching posts found)";

    const system = `You are a friendly assistant for Nagaraj's personal blog (nagaraj.com.au).
About the author: ${BIO}

Answer the visitor's question using ONLY the blog excerpts and the bio above.
- Be concise and conversational (2-5 sentences).
- If the answer isn't in the provided context, say you're not sure and suggest browsing the posts — do not invent facts.
- Never claim the posts were written by AI; they are human-written.`;

    const user = `Question: ${question}\n\nBlog excerpts:\n${contextBlock}`;

    try {
      const result = await env.AI.run(env.MODEL || "@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 512,
      });
      const answer = (result?.response || "").trim();
      return json({ answer }, 200, cors);
    } catch (err) {
      return json({ error: "Model error", detail: String(err) }, 502, cors);
    }
  },
};
