// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://www.nagaraj.com.au",
  trailingSlash: "ignore",
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      // Dual themes; colours are toggled via CSS using data-theme on <html>.
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: false,
      wrap: false,
    },
  },
});
