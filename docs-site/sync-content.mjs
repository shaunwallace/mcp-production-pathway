#!/usr/bin/env node
// Mirrors the repo's markdown into docs-site/src/content/docs/ so Starlight
// can serve it. Runs before dev and build via npm script hooks. The repo's
// .md files stay authoritative; this directory is a generated mirror.

import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Starlight renders the `title` from frontmatter as the page H1.
// The source markdown also has its own `# Title` so it reads well on GitHub.
// Strip the first body H1 during sync to avoid duplicate titles on the site.
function stripBodyH1(text) {
  const fmMatch = text.match(/^(---\n[\s\S]*?\n---\n)/);
  const frontmatter = fmMatch ? fmMatch[1] : "";
  const body = text.slice(frontmatter.length);
  const bodyStripped = body.replace(/^(\s*\n)*#\s+.+\n+/, "");
  return frontmatter + bodyStripped;
}

// Parse an ASCII file tree (├── └── │) into a nested markdown list
// and wrap in <FileTree>. Returns null if no tree content detected.
function asciiTreeToFileTree(block) {
  const raw = block.split("\n").filter((l) => l.length > 0);
  if (!raw.some((l) => /[├└│]/.test(l))) return null;

  const items = [];
  for (const line of raw) {
    // Root line: no tree chars, ends with `/` or is a bare name
    if (!/[├└│]/.test(line)) {
      items.push({ depth: 0, text: line.trim() });
      continue;
    }
    // Match: leading `│   ` or `    ` repeats, then `├── ` or `└── `, then rest
    const m = line.match(/^((?:(?:│   )|(?:    ))*)[├└]── (.+?)\s*$/);
    if (!m) continue;
    const depth = m[1].length / 4 + 1;
    const rest = m[2];
    // Separate inline `# comment` from the filename
    const hashIdx = rest.search(/\s+#\s/);
    const name = hashIdx >= 0 ? rest.slice(0, hashIdx).trim() : rest.trim();
    const comment = hashIdx >= 0 ? rest.slice(hashIdx).replace(/^\s+#\s/, "").trim() : "";
    items.push({ depth, text: comment ? `${name} ${comment}` : name });
  }

  if (items.length === 0) return null;
  const lines = items.map((it) => `${"  ".repeat(it.depth)}- ${it.text}`);
  return `<FileTree>\n${lines.join("\n")}\n</FileTree>`;
}

// Replace any ```code block``` that contains ASCII tree characters with a
// <FileTree> MDX block. Returns { text, transformed }.
function transformTrees(text) {
  let transformed = false;
  const replaced = text.replace(/```[\w-]*\n([\s\S]*?)```/g, (match, body) => {
    const ft = asciiTreeToFileTree(body);
    if (!ft) return match;
    transformed = true;
    return ft;
  });
  return { text: replaced, transformed };
}

// Insert the FileTree import after any frontmatter block.
function injectFileTreeImport(text) {
  const importLine = `import { FileTree } from '@astrojs/starlight/components';\n\n`;
  const fmMatch = text.match(/^(---\n[\s\S]*?\n---\n)/);
  if (fmMatch) {
    return fmMatch[1] + "\n" + importLine + text.slice(fmMatch[1].length);
  }
  return importLine + text;
}

// MDX interprets `<` as the start of a JSX tag, so markdown autolinks
// (`<https://...>`) break parsing. Convert them to `[url](url)` form.
function escapeAutolinksForMdx(text) {
  return text.replace(/<(https?:\/\/[^>\s]+)>/g, "[$1]($1)");
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const contentDir = resolve(here, "src/content/docs");

const files = [
  // path-relative-to-repo-root → path-in-content-dir
  ["README.md",                                              "index.md"],
  ["PATHWAY.md",                                             "pathway.md"],
  ["REPO-ARCHITECTURE.md",                                   "repo-architecture.md"],
  ["weeks/week-00-setup.md",                                 "weeks/week-00-setup.md"],
  ["weeks/week-01.md",                                       "weeks/week-01.md"],
  ["weeks/week-02.md",                                       "weeks/week-02.md"],
  ["weeks/week-03.md",                                       "weeks/week-03.md"],
  ["templates/memo.md",                                      "templates/memo.md"],
  ["templates/adr.md",                                       "templates/adr.md"],
  ["templates/progress-entry.md",                            "templates/progress-entry.md"],
  ["templates/examples/README.md",                           "templates/examples/index.md"],
  ["templates/examples/memo-example-a.md",                   "templates/examples/memo-example-a.md"],
  ["templates/examples/memo-example-b.md",                   "templates/examples/memo-example-b.md"],
  ["templates/examples/adr-example.md",                      "templates/examples/adr-example.md"],
  ["templates/examples/iteration-log-example.md",            "templates/examples/iteration-log-example.md"],
  ["templates/examples/harness-trace-example.md",            "templates/examples/harness-trace-example.md"],
  ["templates/examples/progress-entry-example.md",           "templates/examples/progress-entry-example.md"],
  ["docs/model-ids.md",                                      "docs/model-ids.md"],
  ["server/README.md",                                       "server/readme.md"],
  ["harness/README.md",                                      "harness/readme.md"],
];

if (existsSync(contentDir)) {
  await rm(contentDir, { recursive: true, force: true });
}

for (const [src, dst] of files) {
  const srcAbs = resolve(repoRoot, src);
  let dstAbs = resolve(contentDir, dst);
  await mkdir(dirname(dstAbs), { recursive: true });
  let text = stripBodyH1(await readFile(srcAbs, "utf8"));
  const { text: transformedText, transformed } = transformTrees(text);
  if (transformed) {
    text = injectFileTreeImport(escapeAutolinksForMdx(transformedText));
    dstAbs = dstAbs.replace(/\.md$/, ".mdx");
  }
  await writeFile(dstAbs, text);
}

// Write a 404 page. Starlight's default 404 route expects this entry.
const notFound = `---
title: Not found
---

That page doesn't exist. Try the sidebar, or head back to the [pathway overview](/).
`;
await writeFile(resolve(contentDir, "404.md"), notFound);

console.log(`Synced ${files.length} files + 404 → ${contentDir}`);
