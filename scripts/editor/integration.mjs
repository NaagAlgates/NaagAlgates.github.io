// Astro integration for the local blog editor. Dev server only, by two
// independent guards: the `command === "dev"` gate here, and the fact that
// nothing under scripts/ is ever emitted to dist/. See
// .omc/plans/44-local-blog-editor.md.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEditorMiddleware } from "./middleware.mjs";
import { PRISM_COMPONENT_LANGUAGES } from "./editor-config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = join(HERE, "..", "..", "src", "content", "blog");
const IMAGES_DIR = join(HERE, "..", "..", "public", "images");
const CLIENT_PATH = join(HERE, "client.mjs");

export default function localBlogEditor() {
  let isDev = false;
  return {
    name: "local-blog-editor",
    hooks: {
      "astro:config:setup": ({ command, updateConfig }) => {
        isDev = command === "dev";
        if (isDev) {
          // Pre-bundle the editor at server start so the first /_editor load
          // doesn't trigger a mid-session dep-optimization reload.
          updateConfig({
            vite: {
              optimizeDeps: {
                // Pre-bundle EVERY bundled dep the client imports — otherwise
                // Vite discovers the un-listed ones on first /_editor load and
                // does a mid-session re-optimization reload. The Prism language
                // components are generated from the shared CODE_LANGUAGES list
                // (editor-config.mjs) so the picker, the loaded grammars, and
                // this pre-bundle can't drift apart.
                include: [
                  "@toast-ui/editor",
                  "@toast-ui/editor-plugin-code-syntax-highlight",
                  "prismjs",
                  ...PRISM_COMPONENT_LANGUAGES.map(
                    (lang) => `prismjs/components/prism-${lang}`,
                  ),
                  "dompurify",
                  "mdast-util-from-markdown",
                ],
              },
            },
          });
        }
      },
      "astro:server:setup": ({ server }) => {
        if (!isDev) return;
        const getBoundPort = () => {
          const addr = server.httpServer?.address();
          return addr && typeof addr === "object" ? addr.port : undefined;
        };
        // /@fs/ serves the client through Vite's transform pipeline, which
        // resolves @toast-ui/editor (and its CSS) from node_modules.
        const clientSrc = `/@fs/${CLIENT_PATH}`;
        server.middlewares.use(
          createEditorMiddleware({
            blogDir: BLOG_DIR,
            imagesDir: IMAGES_DIR,
            getBoundPort,
            clientSrc,
          }),
        );
      },
    },
  };
}
