// Site-wide constants. Edit these to change identity / SEO copy in one place.
export const SITE_TITLE = "Nagaraj";
export const SITE_URL = "https://www.nagaraj.com.au";
export const AUTHOR = "Nagaraj Alagusundaram";

// Broad positioning: tech & AI, anything worth thinking through.
export const SITE_DESCRIPTION =
  "A human-written blog about technology and AI — notes, ideas, and anything worth thinking through. 100% written by a person, never by AI.";

export const HUMAN_LINE = "Human-written blogs";

// Public links shown in the sidebar (connect / contact).
export const LINKS = [
  { label: "github", href: "https://github.com/NaagAlgates" },
  { label: "linkedin", href: "https://www.linkedin.com/in/nalagusundaram" },
  { label: "bluesky", href: "https://bsky.app/profile/nagaraj.com.au" },
  { label: "rss", href: "/rss.xml" },
];

export const KEYWORDS =
  "technology, AI, software, programming, human-written, no AI, written by a human, blog";

// Chat widget: URL of the Cloudflare Worker that returns LLM answers.
// Leave "" to run the widget in retrieval-only mode (it links to the most
// relevant posts). Set this to your deployed Worker URL once it's live —
// e.g. "https://nagaraj-chat.<your-subdomain>.workers.dev". See worker/README.md.
export const CHAT_API_URL = "https://nagaraj-chat.naaglabs.workers.dev";

// Optional Cloudflare Turnstile site key (PUBLIC — safe to expose). Leave "" to
// disable. When set, the chat asks visitors to pass a Turnstile check and sends
// the token to the Worker (which must also have the TURNSTILE_SECRET set).
export const TURNSTILE_SITE_KEY = "0x4AAAAAADd4WUNVSCQSuGU4";

/** URL-safe slug for a tag, e.g. "Dart 3.10" -> "dart-3-10". */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
