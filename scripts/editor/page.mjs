// The editor page served at /_editor (dev only). The client script is loaded
// through the Vite dev server (clientSrc is a /@fs/ URL), which bundles
// @toast-ui/editor from node_modules — no CDN, works offline.
export function editorPageHtml({ clientSrc }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>New blog post — local editor</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 860px;
         margin: 24px auto; padding: 0 16px; color: #222; }
  h1 { font-size: 20px; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 14px 0 4px; }
  /* Scope form styling to this page's own controls so it never leaks into the
     editor/plugin internals (the code-syntax-highlight plugin renders its own
     <input> and language <button> list — issue #48). */
  #title, #description, #tags { width: 100%; padding: 8px; font-size: 14px;
          border: 1px solid #bbb; border-radius: 6px; box-sizing: border-box; }
  #editor { margin-top: 14px; }
  #save, #reset { margin-top: 16px; padding: 10px 22px; font-size: 15px; border: 0;
           border-radius: 6px; background: #1a7f37; color: #fff; cursor: pointer; }
  #save:disabled { background: #999; }
  #status { margin-top: 12px; font-size: 14px; white-space: pre-wrap; }
  #status.ok { color: #1a7f37; } #status.err { color: #b42318; }
  .hint { color: #666; font-size: 12px; margin-top: 2px; }
</style>
</head>
<body>
<h1>New blog post <span class="hint">(local only — saves a markdown file into src/content/blog/)</span></h1>
<label for="title">Title</label>
<input id="title" placeholder="My Post Title">
<div class="hint">Filename/URL comes from the title on first save and then stays fixed.</div>
<label for="description">Description</label>
<input id="description" placeholder="One-line summary for the list, RSS, and search results.">
<label for="tags">Tags (comma-separated, optional)</label>
<input id="tags" placeholder="tech, ai">
<div id="editor"></div>
<div class="hint">Code: use the <strong>Code Block</strong> button (2nd toolbar group), then click the block's top-right corner to pick a language (or type <code>&#96;&#96;&#96;lang</code> in the Markdown tab).</div>
<button id="save">Save post</button>
<button id="reset" type="button" style="background:#666; margin-left:10px;">Start a new post</button>
<div id="status"></div>
<script type="module" src="${clientSrc}"></script>
</body>
</html>`;
}
