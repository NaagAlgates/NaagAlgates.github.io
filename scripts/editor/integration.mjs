// Astro integration for the local blog editor. Dev server only, by two
// independent guards: the `command === "dev"` gate here, and the fact that
// nothing under scripts/ is ever emitted to dist/. See
// .omc/plans/44-local-blog-editor.md.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEditorMiddleware } from "./middleware.mjs";

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
                // Pre-bundle the exact specifiers the client imports (the
                // plugin is imported by its `dist/...-all.js` subpath, so name
                // that subpath, not the package root) — avoids a first-load
                // dep re-optimization reload on /_editor.
                include: [
                  "@toast-ui/editor",
                  "@toast-ui/editor-plugin-code-syntax-highlight/dist/toastui-editor-plugin-code-syntax-highlight-all.js",
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
