# docs-site

Local Astro Starlight site that presents the pathway curriculum with sidebar navigation, local search (pagefind), and dark mode. The markdown files in the parent repo stay authoritative — `sync-content.mjs` mirrors them into `src/content/docs/` before dev/build, transforming ASCII file trees into `<FileTree>` components along the way.

## Run locally

```bash
cd docs-site
pnpm install
pnpm dev
```

Open <http://localhost:4321>.

## Build

```bash
pnpm build      # → docs-site/dist/
pnpm preview    # serve the build locally
```

## Deploy to GitHub Pages

A workflow at `.github/workflows/pages.yml` builds and deploys this site on every push to `main` (and via manual dispatch). One-time setup per repo:

1. Push the repo to GitHub.
2. Go to **Settings → Pages → Source** and pick **"GitHub Actions"** (not "Deploy from branch").
3. Push any change that matches the workflow's path filter, or trigger it manually from the Actions tab.

The workflow injects `SITE` and `BASE` via env using `actions/configure-pages`, which means the template works in any fork without editing `astro.config.mjs`. For a custom domain, add a `CNAME` file under `docs-site/public/` and GitHub will pick it up.

## How the content sync works

`src/content.config.ts` uses Starlight's default docs loader at `src/content/docs/`. Content is put there by `sync-content.mjs`, which:

- Copies markdown from the parent repo (`README.md`, `weeks/*`, `templates/*`, etc.)
- Strips the first body H1 on each file (Starlight renders the title from frontmatter, avoiding duplicates)
- Detects ASCII file trees (`├── └── │`) in code blocks and rewrites them as `<FileTree>` MDX
- Renames output to `.mdx` and injects the `FileTree` import when a transformation happened
- Escapes markdown autolinks (`<https://…>`) to `[url](url)` for MDX compatibility
- Writes a minimal `404.md` that Starlight's default 404 route expects

To add a new markdown file to the site: add an entry to `sync-content.mjs`'s `files[]` array and to the `sidebar` in `astro.config.mjs`.
