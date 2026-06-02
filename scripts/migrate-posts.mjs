// One-off migration: Jekyll `_posts/*.md` -> Astro `src/content/blog/*.md`.
// - Derives slug + pubDate from the filename (YYYY-MM-DD-slug.md).
// - Keeps title/description/tags; drops portfolYOU cruft (style/color/comments).
// - Converts Jekyll liquid to plain Markdown:
//     {% highlight LANG %} ... {% endhighlight %}        -> ```LANG ... ```
//     {% include elements/highlight.html text="X" %}     -> `X`
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "_posts");
const outDir = join(root, "src", "content", "blog");

// Start clean so re-runs are deterministic.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return { data, body: m[2] };
}

function parseTags(val) {
  if (!val) return [];
  return val
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function convertLiquid(body) {
  return body
    .replace(/\{%\s*highlight\s+(\w+)\s*%\}/g, "```$1")
    .replace(/\{%\s*endhighlight\s*%\}/g, "```")
    .replace(/\{%\s*include\s+elements\/highlight\.html\s+text="([^"]*)"\s*%\}/g, "`$1`")
    .replace(/\{%\s*include\s+elements\/highlight\.html\s+text='([^']*)'\s*%\}/g, "`$1`")
    // YouTube embeds -> responsive iframe (raw HTML is fine in Astro .md)
    .replace(
      /\{%\s*include\s+elements\/video\.html\s+id="([^"]*)"\s*%\}/g,
      '<div class="video"><iframe src="https://www.youtube.com/embed/$1" title="YouTube video" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>',
    )
    // Figures with captions -> <figure>
    .replace(
      /\{%\s*include\s+elements\/figure\.html\s+image="([^"]*)"\s+caption="([^"]*)"\s*%\}/g,
      '<figure><img src="$1" alt="$2" loading="lazy" /><figcaption>$2</figcaption></figure>',
    )
    .replace(
      /\{%\s*include\s+elements\/figure\.html\s+image="([^"]*)"\s*%\}/g,
      '<figure><img src="$1" alt="" loading="lazy" /></figure>',
    );
}

const files = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
let count = 0;
for (const file of files) {
  const fm = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (!fm) {
    console.warn(`! skipped (no date prefix): ${file}`);
    continue;
  }
  const [, y, mo, d, slug] = fm;
  const pubDate = `${y}-${mo}-${d}`;

  const { data, body } = parseFrontmatter(readFileSync(join(srcDir, file), "utf8"));
  const title = data.title || slug.replace(/-/g, " ");
  const description = data.description || "";
  const tags = parseTags(data.tags);

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `pubDate: ${pubDate}`,
    `tags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    "---",
    "",
  ].join("\n");

  const out = frontmatter + convertLiquid(body).replace(/^\s+/, "") + "\n";
  writeFileSync(join(outDir, `${slug}.md`), out, "utf8");
  count++;
}

console.log(`Migrated ${count} posts -> src/content/blog/`);
