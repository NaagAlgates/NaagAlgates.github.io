// Site-wide constants. Edit these to change identity / SEO copy in one place.
export const SITE_TITLE = "Nagaraj";
export const SITE_URL = "https://www.nagaraj.com.au";
export const AUTHOR = "Nagaraj Alagusundaram";

// Broad positioning: tech & AI, anything worth thinking through.
export const SITE_DESCRIPTION =
  "A human-written blog about technology and AI — notes, ideas, and anything worth thinking through. 100% written by a person, never by AI.";

export const HUMAN_LINE = "Human-written · No AI";

// Public links shown in the sidebar (connect / contact).
export const LINKS = [
  { label: "github", href: "https://github.com/NaagAlgates" },
  { label: "linkedin", href: "https://www.linkedin.com/in/nalagusundaram" },
  { label: "bluesky", href: "https://bsky.app/profile/nagaraj.com.au" },
  { label: "rss", href: "/rss.xml" },
];

export const KEYWORDS =
  "technology, AI, software, programming, human-written, no AI, written by a human, blog";

/** URL-safe slug for a tag, e.g. "Dart 3.10" -> "dart-3-10". */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
