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

let postId = null;
let rev = null;
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");

function setStatus(kind, text) {
  statusEl.className = kind;
  statusEl.textContent = text;
}

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
