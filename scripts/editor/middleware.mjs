// Connect middleware for the local blog editor. Wired into the Astro dev
// server by integration.mjs; also bootable on a plain node:http server for
// the endpoint-level tests. Never part of `astro build` output.
import { EDITOR_HEADER, checkRequest } from "./security.mjs";
import { ConflictError, PostStore, ValidationError } from "./post-store.mjs";
import { editorPageHtml } from "./page.mjs";

const BODY_LIMIT = 2 * 1024 * 1024; // 2 MB

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(obj));
}

function readJsonBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    let overLimit = false;
    req.on("data", (chunk) => {
      if (overLimit) return; // keep draining so the 413 response can be sent
      size += chunk.length;
      if (size > BODY_LIMIT) {
        overLimit = true;
        chunks.length = 0;
        reject(Object.assign(new Error("request body too large"), { code: "too_large" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (overLimit) return;
      let parsed;
      try {
        parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        reject(Object.assign(new Error("invalid JSON body"), { code: "bad_json" }));
        return;
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        reject(Object.assign(new Error("body must be a JSON object"), { code: "bad_json" }));
        return;
      }
      resolvePromise(parsed);
    });
    req.on("error", reject);
  });
}

/**
 * @param {object} opts
 * @param {string} opts.blogDir             src/content/blog
 * @param {() => number|undefined} opts.getBoundPort
 * @param {string} opts.clientSrc           URL the page loads its module from
 * @param {PostStore} [opts.store]
 */
export function createEditorMiddleware({ blogDir, getBoundPort, clientSrc, store }) {
  const postStore = store ?? new PostStore({ dir: blogDir });

  return async function editorMiddleware(req, res, next) {
    const url = (req.url ?? "").split("?")[0];
    if (!url.startsWith("/_editor")) return next ? next() : sendJson(res, 404, { error: "not found" });

    const verdict = checkRequest({
      method: req.method,
      remoteAddress: req.socket?.remoteAddress,
      host: req.headers.host,
      origin: req.headers.origin,
      editorHeader: req.headers[EDITOR_HEADER],
      boundPort: getBoundPort(),
    });
    // No CORS headers are emitted anywhere in this middleware (including for
    // OPTIONS), so a cross-origin preflight can never succeed.
    if (!verdict.allowed) return sendJson(res, verdict.status, { error: verdict.reason });

    if (req.method === "OPTIONS") return sendJson(res, 403, { error: "no cross-origin access" });

    if (req.method === "GET" && (url === "/_editor" || url === "/_editor/")) {
      // Defense in depth: even if a sanitizer bypass injects markup, no
      // inline/foreign script can execute on the editor page.
      res.setHeader(
        "content-security-policy",
        [
          "default-src 'self'",
          "script-src 'self'",
          "connect-src 'self'",
          "img-src 'self' data: https:",
          "style-src 'self' 'unsafe-inline'",
          "object-src 'none'",
          "base-uri 'none'",
          "frame-ancestors 'none'",
        ].join("; "),
      );
      return send(res, 200, "text/html; charset=utf-8", editorPageHtml({ clientSrc }));
    }

    // Session recovery: the post-save page reload can beat the save response
    // to the client; this lets a restored session re-adopt ownership.
    if (req.method === "GET" && url === "/_editor/api/last-save") {
      // Serialized behind any in-flight save — never observes mid-save state.
      const last = await postStore.getLastSave();
      if (!last) return sendJson(res, 404, { error: "no save in this server run" });
      return sendJson(res, 200, last);
    }

    if (req.method === "POST" && url === "/_editor/api/save") {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        return sendJson(res, err.code === "too_large" ? 413 : 400, { error: err.message });
      }
      try {
        const result = await postStore.save({
          input: { title: body.title, description: body.description, tags: body.tags, body: body.body },
          mode: body.mode,
          postId: body.postId,
          rev: body.rev,
        });
        return sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof ValidationError) return sendJson(res, 400, { error: err.message });
        if (err instanceof ConflictError) return sendJson(res, 409, { error: err.message });
        return sendJson(res, 500, { error: "save failed" });
      }
    }

    return sendJson(res, 404, { error: "not found" });
  };
}
