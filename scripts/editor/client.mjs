// Browser client for the local blog editor page. Served through the Vite dev
// server (/@fs/ URL), which resolves and bundles @toast-ui/editor and its
// prosemirror dependencies from node_modules — no CDN, dev only.
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import DOMPurify from "dompurify";
import { hasSizedImage, hasTitledImage } from "./markdown-flags.mjs";

/** Every WYSIWYG-lossy construct the markdown contains, or null — the
 * warning must name ALL of them, or the unnamed one is silently lost. */
function lossyConstruct(md) {
  const found = [];
  if (hasTitledImage(md)) found.push('image titles (![alt](url "title"))');
  if (hasSizedImage(md)) found.push("image width/height attributes (<img ... width>)");
  return found.length ? found.join(" and ") : null;
}

// Upload the picked/pasted image to the dev-only endpoint and hand the
// resulting /images/ URL back to Toast UI. Never fall back to the default
// hook behavior (base64 data URI inlined into the markdown) — on failure,
// report and insert nothing. callback(url) deliberately passes NO alt text:
// the image popup fills alt from its own Description field in that case
// (verified against the dist source's hookCallback).
async function uploadImage(blob, callback) {
  try {
    const name = blob && blob.name ? blob.name : "pasted-image";
    const res = await fetch(`/_editor/api/upload-image?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: {
        "content-type": (blob && blob.type) || "application/octet-stream",
        "x-blog-editor": "1",
      },
      body: blob,
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus("err", `Image not inserted: ${data.error || res.status}`);
      return;
    }
    callback(data.url);
    setStatus("ok", `Image saved to public${data.url} — referenced as ${data.url}`);
  } catch (e) {
    setStatus("err", `Image not inserted: ${e}`);
  }
}

const editor = new Editor({
  el: document.querySelector("#editor"),
  height: "480px",
  initialEditType: "wysiwyg",
  previewStyle: "vertical",
  usageStatistics: false,
  // Toast UI's dist bundle embeds DOMPurify 2.3.3 (known mXSS / prototype-
  // pollution bypasses) and calls it internally on some WYSIWYG parsing
  // paths this hook does not intercept. This hook routes the render/preview
  // path through the patched DOMPurify 3.x from node_modules. Defense in
  // depth: the CSP on the /_editor page (script-src 'self', no unsafe-inline)
  // blocks inline and foreign-origin script execution if any sanitizer
  // bypass — embedded or not — leaves executable markup. Fully eliminating
  // the residual would require replacing Toast UI's embedded sanitizer.
  customHTMLSanitizer: (html) => DOMPurify.sanitize(html),
  // Without this hook Toast UI base64-inlines picked images into the
  // markdown — megabyte posts that markdown tooling handles poorly and
  // that push saves toward the request-size limit (issue #45). Images now
  // go through the dev-only upload endpoint into public/images/ instead.
  hooks: {
    addImageBlobHook: (blob, callback) => {
      uploadImage(blob, callback);
    },
  },
});
// Dev-only page; exposing the instance makes the editor scriptable for
// fidelity checks and debugging.
window.__editor = editor;

// Toast UI's WYSIWYG model has no image-title attribute, so editing in
// WYSIWYG mode strips `![alt](url "title")` titles (verified empirically).
// Markdown mode preserves them byte-exact. The changeMode event fires AFTER
// conversion (the title is already gone from getMarkdown() by then), so keep
// a snapshot of the markdown as typed and test that instead.
let mdSnapshot = "";
let lossyOverrideUntil = 0;
editor.on("change", () => {
  if (editor.isMarkdownMode()) mdSnapshot = editor.getMarkdown();
});
editor.on("changeMode", (mode) => {
  if (mode !== "wysiwyg") return;
  const construct = lossyConstruct(mdSnapshot);
  if (!construct) return;
  if (Date.now() < lossyOverrideUntil) {
    setStatus(
      "err",
      `Switched to WYSIWYG — the ${construct} in this draft were dropped ` +
        "(protection overridden).",
    );
    return;
  }
  // Block the lossy switch: revert to markdown with the snapshot intact.
  lossyOverrideUntil = Date.now() + 8000;
  const snap = mdSnapshot;
  setTimeout(() => {
    editor.changeMode("markdown", true);
    editor.setMarkdown(snap);
    mdSnapshot = snap;
  }, 0);
  setStatus(
    "err",
    `This draft has ${construct}, which the ` +
      "WYSIWYG view cannot represent — kept you in the Markdown tab so " +
      "nothing is lost. Switch again within 8 seconds to override.",
  );
});

let postId = null;
let rev = null;
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");

function setStatus(kind, text) {
  statusEl.className = kind;
  statusEl.textContent = text;
}

// Saving a post adds a file to the content collection, which makes the dev
// server broadcast a full page reload — so the draft session (including
// postId/rev, without which the next save would be a duplicate-create
// conflict) must survive reloads. sessionStorage is per-tab and dev-only.
const SESSION_KEY = "blog-editor-draft";

function persistSession() {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      postId,
      rev,
      title: document.getElementById("title").value,
      description: document.getElementById("description").value,
      tags: document.getElementById("tags").value,
      body: editor.getMarkdown(),
      savedAt: Date.now(),
    }),
  );
}

function restoreSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    postId = s.postId ?? null;
    rev = s.rev ?? null;
    document.getElementById("title").value = s.title ?? "";
    document.getElementById("description").value = s.description ?? "";
    document.getElementById("tags").value = s.tags ?? "";
    if (s.body) {
      // Restoring into the WYSIWYG model would strip image titles and
      // <img> width/height; restore such drafts in markdown mode so
      // restore is never lossy.
      if (lossyConstruct(s.body)) editor.changeMode("markdown", true);
      editor.setMarkdown(s.body);
      mdSnapshot = s.body;
    }
    if (postId) setStatus("ok", "Draft session restored — Save will update the same post.");
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

/** Same slug rule as the server (scripts/editor/post-store.mjs). */
function clientSlug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The post-save page reload can arrive BEFORE the save response, leaving the
// session without the postId/rev the server assigned. Re-adopt them from the
// server's last successful save when it unambiguously matches this draft.
async function adoptLastSave() {
  try {
    const res = await fetch("/_editor/api/last-save");
    if (!res.ok) return;
    const last = await res.json();
    const title = document.getElementById("title").value;
    if (!postId && last.slug && last.slug === clientSlug(title)) {
      postId = last.postId;
      rev = last.rev;
      persistSession();
      setStatus("ok", "Recovered the last save — Save will update the same post.");
    } else if (postId && last.postId === postId && last.rev !== rev) {
      rev = last.rev; // a raced update's response was lost; take the fresh rev
      persistSession();
    }
  } catch {
    /* recovery is best-effort; normal save flow still works */
  }
}

restoreSession();
adoptLastSave();

// Recovery path for genuinely lost ownership (e.g. dev-server restart):
// unlink from the saved file but keep the text, so Save creates a new post.
document.getElementById("reset").addEventListener("click", () => {
  postId = null;
  rev = null;
  sessionStorage.removeItem(SESSION_KEY);
  setStatus(
    "ok",
    "Unlinked from the saved file — Save will now create a NEW post. " +
      "If the old file still exists, change the title (or delete the file) first.",
  );
});

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  setStatus("", "Saving…");
  // Persist the draft BEFORE the request: the save triggers a content-change
  // reload that can beat the response, and the restored page re-adopts
  // postId/rev via /_editor/api/last-save.
  persistSession();
  const payload = {
    mode: postId ? "update" : "create",
    postId: postId || undefined,
    rev: rev || undefined,
    title: document.getElementById("title").value,
    description: document.getElementById("description").value,
    tags: document
      .getElementById("tags")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    body: editor.getMarkdown(),
  };
  try {
    const res = await fetch("/_editor/api/save", {
      method: "POST",
      headers: { "content-type": "application/json", "x-blog-editor": "1" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      postId = data.postId;
      rev = data.rev;
      persistSession();
      setStatus(
        "ok",
        `Saved ${data.path}\nPreview: ${location.origin}/blog/${data.slug}` +
          `\nPublish when ready: git add, commit, and push (see WRITING.md).`,
      );
    } else if (res.status === 409) {
      setStatus(
        "err",
        `Conflict: ${data.error}\nYour text is still in this editor. Either ` +
          `edit the saved file directly, or press "Start a new post" to keep ` +
          `writing here as a fresh post.`,
      );
    } else {
      setStatus("err", `Not saved: ${data.error || res.status}`);
    }
  } catch (e) {
    setStatus("err", `Not saved: ${e}`);
  } finally {
    saveBtn.disabled = false;
  }
});
