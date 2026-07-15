import { getCollection } from "astro:content";
import { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from "../consts";

// Generates /llms.txt — a Markdown index of posts following the emerging
// "llms.txt" convention for AI/chat engines. NOTE: consumption by major engines
// is unproven; this is a cheap, low-risk addition, not a guaranteed signal.
export async function GET() {
  const posts = (await getCollection("blog")).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  const lines = [
    `# ${SITE_TITLE}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## Posts",
    "",
    ...posts.map((p) => {
      const url = new URL(`/blog/${p.id}/`, SITE_URL).href;
      return `- [${p.data.title}](${url}): ${p.data.description}`;
    }),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
