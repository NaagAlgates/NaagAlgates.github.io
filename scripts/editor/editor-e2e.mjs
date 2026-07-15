// Browser-level E2E for the /_editor image flow — the parts that live in a
// real browser and can't be exercised by node:test (acceptance criteria 1
// and 5 of .omc/plans/45-editor-image-upload.md). It drives the REAL
// registered addImageBlobHook through Toast UI's event emitter (the same
// path the toolbar file dialog, paste, and drag-drop use).
//
// This is intentionally OUT of `npm test`: it needs a running dev server and
// a local Chromium, neither of which exists in plain CI. Run it by hand:
//
//   npm run dev                       # in one terminal (or use --base URL)
//   npx playwright install chromium   # first time only
//   node scripts/editor/editor-e2e.mjs http://localhost:4321
//
// If Playwright (or a browser) isn't available it prints SKIP and exits 0,
// so it never becomes a broken required step — it's a durable, re-runnable
// record of the manual verification, not a gate.
const BASE = process.argv[2] ?? process.env.EDITOR_BASE ?? "http://localhost:4321";

let chromium;
try {
  ({ chromium } = await import(process.env.PW_PATH ?? "playwright"));
} catch {
  console.log("SKIP: playwright is not installed (see the header of this file).");
  process.exit(0);
}

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("e2e-png-payload"),
]).toString("base64");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

let browser;
try {
  browser = await chromium.launch(
    process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {},
  );
} catch (e) {
  console.log(`SKIP: no launchable browser (${String(e).split("\n")[0]}).`);
  console.log("Run `npx playwright install chromium` first.");
  process.exit(0);
}

const page = await browser.newPage();
const cspErrors = [];
page.on("console", (m) => {
  if (m.type() === "error" && /content security policy|refused to/i.test(m.text()))
    cspErrors.push(m.text());
});
try {
  await page.goto(`${BASE}/_editor`, { waitUntil: "domcontentloaded", timeout: 20000 });
} catch (e) {
  console.log(`SKIP: dev server not reachable at ${BASE} (${String(e).split("\n")[0]}).`);
  await browser.close();
  process.exit(0);
}
await page.waitForFunction(() => !!window.__editor, { timeout: 15000 });

// Criterion 1: upload through the hook inserts a /images/ ref, no data URI.
const inserted = await page.evaluate(async (pngB64) => {
  const editor = window.__editor;
  editor.setMarkdown("before text\n");
  const bytes = Uint8Array.from(atob(pngB64), (c) => c.charCodeAt(0));
  const file = new File([bytes], "e2e photo.png", { type: "image/png" });
  editor.eventEmitter.emit("addImageBlobHook", file, (url, text) => {
    editor.eventEmitter.emit("command", "addImage", {
      imageUrl: url,
      altText: text || "dialog description",
    });
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    if (editor.getMarkdown().includes("/images/")) return editor.getMarkdown();
    await new Promise((r) => setTimeout(r, 100));
  }
  return editor.getMarkdown();
}, PNG);
check(
  "upload inserts /images/ markdown reference",
  /!\[dialog description\]\(\/images\/e2e-photo-[0-9a-f]{8}\.png\)/.test(inserted),
);
check("no data: URI in editor markdown", !inserted.includes("data:image"));

const imgUrl = inserted.match(/\((\/images\/[^)]+)\)/)?.[1];
let imgStatus = null;
for (let i = 0; imgUrl && i < 15; i++) {
  imgStatus = (await page.request.get(`${BASE}${imgUrl}`)).status();
  if (imgStatus === 200) break;
  await new Promise((r) => setTimeout(r, 300));
}
check("uploaded image URL serves 200", imgStatus === 200, `${imgUrl} -> ${imgStatus}`);

// Criterion 1 (negative): a rejected upload inserts NOTHING (no base64 fallback).
const afterFail = await page.evaluate(async () => {
  const editor = window.__editor;
  editor.setMarkdown("unchanged body\n");
  const file = new File([new TextEncoder().encode("<svg></svg>")], "evil.svg", {
    type: "image/svg+xml",
  });
  editor.eventEmitter.emit("addImageBlobHook", file, (url, text) => {
    editor.eventEmitter.emit("command", "addImage", { imageUrl: url, altText: text || "x" });
  });
  await new Promise((r) => setTimeout(r, 1500));
  return { md: editor.getMarkdown(), status: document.getElementById("status").textContent };
});
check(
  "rejected upload inserts nothing (no base64 fallback)",
  afterFail.md.trim() === "unchanged body" && !afterFail.md.includes("data:"),
);
check("rejected upload shows an error status", /Image not inserted/.test(afterFail.status));

// Criterion 5: sized-image guard blocks the WYSIWYG switch, then override works.
const guard = await page.evaluate(async () => {
  const editor = window.__editor;
  editor.changeMode("markdown", true);
  editor.setMarkdown('<img src="/images/x.png" width="400">\n');
  await new Promise((r) => setTimeout(r, 100));
  editor.changeMode("wysiwyg");
  await new Promise((r) => setTimeout(r, 300));
  const blockedInMarkdown = editor.isMarkdownMode();
  const statusAfterBlock = document.getElementById("status").textContent;
  const mdPreserved = editor.getMarkdown().includes('width="400"');
  editor.changeMode("wysiwyg");
  await new Promise((r) => setTimeout(r, 300));
  return {
    blockedInMarkdown,
    statusAfterBlock,
    mdPreserved,
    overrideInWysiwyg: !editor.isMarkdownMode(),
  };
});
check("sized-image WYSIWYG switch is blocked", guard.blockedInMarkdown);
check("block message names width/height", /width\/height/.test(guard.statusAfterBlock));
check("width attribute preserved after block", guard.mdPreserved);
check("second switch within 8s overrides", guard.overrideInWysiwyg);

// Criterion 5 (both constructs): the warning must name BOTH.
const both = await page.evaluate(async () => {
  const editor = window.__editor;
  editor.changeMode("markdown", true);
  editor.setMarkdown('![a](/images/x.png "t")\n\n<img src="/images/y.png" width="400">\n');
  await new Promise((r) => setTimeout(r, 9000)); // let any prior override window lapse
  editor.changeMode("wysiwyg");
  await new Promise((r) => setTimeout(r, 300));
  return {
    stillMarkdown: editor.isMarkdownMode(),
    status: document.getElementById("status").textContent,
  };
});
check("both-constructs switch is blocked", both.stillMarkdown);
check(
  "warning names titles AND width/height",
  /image titles/.test(both.status) && /width\/height/.test(both.status),
);

// Criterion 8: the editor page loaded with no CSP violation in the console.
check("no CSP violations on the editor page", cspErrors.length === 0, cspErrors[0] ?? "");

// Criteria 1, 2, 5 (end-to-end): upload an image, SAVE the post, then fetch
// the saved post's dev page and confirm the /images/ reference and a sized
// <img width> both render. This is the full picker -> save -> render path.
const SAVE_TITLE = "E2E Image Roundtrip Check";
const SAVE_SLUG = "e2e-image-roundtrip-check";
const saved = await page.evaluate(async ({ pngB64, title }) => {
  const editor = window.__editor;
  editor.changeMode("markdown", true);
  // Upload through the real hook, capture the returned /images/ URL.
  const bytes = Uint8Array.from(atob(pngB64), (c) => c.charCodeAt(0));
  const file = new File([bytes], "roundtrip.png", { type: "image/png" });
  const url = await new Promise((resolve) => {
    editor.eventEmitter.emit("addImageBlobHook", file, (u) => resolve(u));
  });
  // A markdown image AND a sized raw <img> using the same uploaded asset.
  editor.setMarkdown(`intro\n\n![rt](${url})\n\n<img src="${url}" width="321">\n`);
  document.getElementById("title").value = title;
  document.getElementById("description").value = "e2e roundtrip";
  document.getElementById("save").click();
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const s = document.getElementById("status").textContent || "";
    if (/^Saved /.test(s)) return { status: s, url };
    if (/Not saved|Conflict/.test(s)) return { status: s, url, failed: true };
    await new Promise((r) => setTimeout(r, 150));
  }
  return { status: document.getElementById("status").textContent, url, timedOut: true };
}, { pngB64: PNG, title: SAVE_TITLE });

check("save succeeds after upload", /^Saved /.test(saved.status), saved.status.slice(0, 80));

// Fetch the saved post's dev page and confirm both references render.
let pageHtml = "";
for (let i = 0; i < 15; i++) {
  const r = await page.request.get(`${BASE}/blog/${SAVE_SLUG}/`);
  if (r.status() === 200) {
    pageHtml = await r.text();
    if (pageHtml.includes("/images/")) break;
  }
  await new Promise((r) => setTimeout(r, 300));
}
const relUrl = saved.url ?? "";
check(
  "saved post's dev page renders the uploaded /images/ reference",
  pageHtml.includes(`src="${relUrl}"`),
  relUrl,
);
check(
  "saved post's dev page preserves the sized <img width>",
  new RegExp(`<img[^>]+src="${relUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*width="321"`).test(
    pageHtml,
  ),
);
check("saved post has no data: URI", pageHtml.includes("data:image") === false);

await browser.close();

// Clean up the post this run created so re-runs stay idempotent. The blog
// dir is deterministic relative to this script; only our fixed test slug is
// touched. Uploaded e2e images are left to the caller (dot-temp-free).
try {
  const { unlink, readdir } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const blogDir = join(here, "..", "..", "src", "content", "blog");
  const imagesDir = join(here, "..", "..", "public", "images");
  await unlink(join(blogDir, `${SAVE_SLUG}.md`)).catch(() => {});
  for (const f of await readdir(imagesDir).catch(() => [])) {
    if (/^(e2e-photo|roundtrip)-[0-9a-f]+\.png$/.test(f))
      await unlink(join(imagesDir, f)).catch(() => {});
  }
} catch {
  /* cleanup is best-effort */
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
process.exit(failed.length ? 1 : 0);
