// Browser client for the local blog editor page. Served through the Vite dev
// server (/@fs/ URL), which resolves and bundles @toast-ui/editor and its
// prosemirror dependencies from node_modules — no CDN, dev only.
import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";

const editor = new Editor({
  el: document.querySelector("#editor"),
  height: "480px",
  initialEditType: "wysiwyg",
  previewStyle: "vertical",
  usageStatistics: false,
});
// Dev-only page; exposing the instance makes the editor scriptable for
// fidelity checks and debugging.
window.__editor = editor;

// Toast UI's WYSIWYG model has no image-title attribute, so editing in
// WYSIWYG mode strips `![alt](url "title")` titles (verified empirically).
// Markdown mode preserves them byte-exact. Warn instead of losing silently.
const TITLED_IMAGE = /!\[[^\]]*\]\([^)\s]+\s+"[^"]*"\)/;
editor.on("changeMode", (mode) => {
  if (mode === "wysiwyg" && TITLED_IMAGE.test(editor.getMarkdown())) {
    setStatus(
      "err",
      'Heads up: this draft has images with title text (![alt](url "title")). ' +
        "Editing in WYSIWYG mode drops those titles — switch back to the " +
        "Markdown tab to keep them.",
    );
  }
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
    if (s.body) editor.setMarkdown(s.body);
    if (postId) setStatus("ok", "Draft session restored — Save will update the same post.");
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
restoreSession();

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  setStatus("", "Saving…");
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
        `Conflict: ${data.error}\nYour work is still in this editor — copy it, ` +
          `reload the page, then either edit the file directly or create a new post.`,
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
