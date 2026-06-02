// Cloudflare Worker: blog chat backend for nagaraj.com.au
// Receives { question, contexts: [{title, url, text}] }, calls Workers AI with
// the blog content + Nagaraj's bio as grounding, returns { answer }.
//
// Deploy: see worker/README.md  (npm i -g wrangler && wrangler deploy)

const BIO = `Nagaraj Alagusundaram is a software engineer with 13+ years of experience building mobile and backend applications using Flutter, Kotlin, Swift, and Xamarin, with cloud experience on AWS and Azure. He has led teams, conducted technical interviews, and defined technical roadmaps, and has shipped products across health & fitness, dating, language learning, super apps, and employee engagement. He writes about technology and AI at nagaraj.com.au. Every post on the site is written by a human, never by AI.`;

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  const allow = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
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

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, cors);
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
