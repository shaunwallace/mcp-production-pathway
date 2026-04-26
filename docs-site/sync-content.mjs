#!/usr/bin/env node
// Mirrors the repo's markdown into docs-site/src/content/docs/ so Starlight
// can serve it. Runs before dev and build via npm script hooks. The repo's
// .md files stay authoritative; this directory is a generated mirror.

import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, posix } from "node:path";
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

// Insert the given Starlight component imports after any frontmatter block.
// Pass the names that the page actually uses so the import list stays minimal.
function injectComponentImports(text, names) {
  if (names.length === 0) return text;
  const importLine = `import { ${names.join(", ")} } from '@astrojs/starlight/components';\n\n`;
  const fmMatch = text.match(/^(---\n[\s\S]*?\n---\n)/);
  if (fmMatch) {
    return fmMatch[1] + "\n" + importLine + text.slice(fmMatch[1].length);
  }
  return importLine + text;
}

// Replace `<!-- steps -->` followed by a numbered list with a <Steps> wrapper
// around the same list. Starlight's <Steps> styles ordered lists as a
// numbered, vertically-spaced sequence. GitHub renders the marker as an
// invisible HTML comment and the list as a normal numbered list.
function transformSteps(text) {
  let transformed = false;
  const replaced = text.replace(
    /<!-- steps -->\n((?:\d+\.\s[^\n]+\n(?:[ \t]+[^\n]*\n|\n(?=[ \t]))*)+)/g,
    (_match, listBody) => {
      transformed = true;
      return `<Steps>\n\n${listBody.trimEnd()}\n\n</Steps>\n`;
    },
  );
  return { text: replaced, transformed };
}

// Replace a `<!-- tabs -->` … `<!-- /tabs -->` block whose body contains
// `### Label` sub-headings with a <Tabs><TabItem> structure. Each ### header
// becomes a tab; the prose between headers is the tab body. On GitHub the
// markers are invisible and the headings render as ordinary subheadings.
function transformTabs(text) {
  let transformed = false;
  const replaced = text.replace(
    /<!-- tabs -->\n([\s\S]*?)\n<!-- \/tabs -->/g,
    (_match, body) => {
      const sections = body.split(/^### (.+)$/m);
      // Discard any prose before the first ### header.
      if (sections.length < 3) return _match;
      const items = [];
      for (let i = 1; i < sections.length; i += 2) {
        const label = sections[i].trim().replace(/"/g, "&quot;");
        const content = sections[i + 1].trim();
        items.push(`<TabItem label="${label}">\n\n${content}\n\n</TabItem>`);
      }
      transformed = true;
      return `<Tabs>\n${items.join("\n")}\n</Tabs>`;
    },
  );
  return { text: replaced, transformed };
}

// Replace `<!-- card-grid -->` followed by a list of `- **Week N — Title.** body…`
// items with a <CardGrid> of <LinkCard>s linking to /weeks/week-NN. The marker
// is invisible on GitHub; the bullet list still renders there as plain prose.
function transformCardGrids(text) {
  let transformed = false;
  const replaced = text.replace(
    /<!-- card-grid -->\n((?:- \*\*[^\n]+\n(?:  [^\n]*\n)*)+)/g,
    (_match, listBody) => {
      const items = [];
      // Split list into top-level items: each starts with `- `.
      const itemBlocks = listBody.split(/\n(?=- )/);
      for (const block of itemBlocks) {
        const m = block.match(/^- \*\*Week (\d+)\s*—\s*([^*]+?)\.\*\*\s*([\s\S]*)$/);
        if (!m) continue;
        const weekNum = m[1];
        const titleTail = m[2].trim();
        const body = m[3].replace(/\s+/g, " ").trim();
        const description = body.split(/(?<=\.)\s/)[0]; // first sentence
        const padded = String(weekNum).padStart(2, "0");
        const safeDesc = description.replace(/"/g, "&quot;");
        items.push(
          `  <LinkCard title="Week ${weekNum} — ${titleTail}" description="${safeDesc}" href="/weeks/week-${padded}" />`,
        );
      }
      if (items.length === 0) return _match;
      transformed = true;
      return `<CardGrid>\n${items.join("\n")}\n</CardGrid>\n`;
    },
  );
  return { text: replaced, transformed };
}

// MDX interprets `<` as the start of a JSX tag, so markdown autolinks
// (`<https://...>`) break parsing. Convert them to `[url](url)` form.
function escapeAutolinksForMdx(text) {
  return text.replace(/<(https?:\/\/[^>\s]+)>/g, "[$1]($1)");
}

// GitHub resolves `[text](path/to/file.md)` against the source file's path.
// Starlight wants an absolute route. Resolve internal `.md` link targets to
// absolute site routes based on the destination file's route directory so
// the same source link works in both renderers. Skip http(s)://, anchors,
// and absolute paths.
function resolveMdLinks(text, dstRouteDir) {
  return text.replace(
    /\]\(((?!https?:\/\/|#|\/)[^)]+?)\.md(#[^)]*)?\)/g,
    (_match, relPath, anchor = "") => {
      const abs = posix.resolve(dstRouteDir, relPath);
      return `](${abs}/${anchor})`;
    },
  );
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
  // Route dir mirrors the dst path (relative to contentDir), minus filename.
  // e.g. dst "templates/memo.md" → route dir "/templates".
  const routeDir = "/" + posix.dirname(dst);
  let text = resolveMdLinks(
    stripBodyH1(await readFile(srcAbs, "utf8")),
    routeDir,
  );

  const imports = [];
  const treeResult = transformTrees(text);
  text = treeResult.text;
  if (treeResult.transformed) imports.push("FileTree");

  const cardResult = transformCardGrids(text);
  text = cardResult.text;
  if (cardResult.transformed) imports.push("CardGrid", "LinkCard");

  const stepsResult = transformSteps(text);
  text = stepsResult.text;
  if (stepsResult.transformed) imports.push("Steps");

  const tabsResult = transformTabs(text);
  text = tabsResult.text;
  if (tabsResult.transformed) imports.push("Tabs", "TabItem");

  if (imports.length > 0) {
    text = injectComponentImports(escapeAutolinksForMdx(text), imports);
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
