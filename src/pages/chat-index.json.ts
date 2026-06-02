import { getCollection } from "astro:content";

// Strip Markdown/HTML down to readable plain text for retrieval + LLM context.
function toPlain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/[#>*_~`>-]+/g, " ") // md punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const posts = (await getCollection("blog")).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  const data = posts.map((p) => ({
    title: p.data.title,
    url: `/blog/${p.id}`,
    tags: p.data.tags,
    date: p.data.pubDate.toISOString().slice(0, 10),
    description: p.data.description,
    text: toPlain(p.body ?? "").slice(0, 2000),
  }));

  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
