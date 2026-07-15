import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    // Optional last-modified date. When set, emitted as JSON-LD dateModified.
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // Optional per-post social-card image (path or absolute URL). Falls back
    // to the site default when omitted.
    image: z.string().optional(),
  }),
});

export const collections = { blog };
