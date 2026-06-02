// Create a new blog post: `npm run new "My Post Title"`
// Generates src/content/blog/<slug>.md with today's date pre-filled.
import { writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Usage: npm run new "My Post Title"');
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const today = new Date().toISOString().slice(0, 10);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "src", "content", "blog", `${slug}.md`);

if (existsSync(file)) {
  console.error(`! A post already exists at ${file}`);
  process.exit(1);
}

const body = `---
title: ${JSON.stringify(title)}
description: "One-line summary used in the post list, RSS, and search results."
pubDate: ${today}
tags: [tech, ai]
---

Write here. Markdown works: **bold**, \`code\`, lists, links, images.

\`\`\`ts
// fenced code blocks get syntax highlighting automatically
const hello = "world";
\`\`\`
`;

writeFileSync(file, body, "utf8");
console.log(`Created ${file}`);
console.log(`URL will be /blog/${slug}`);
