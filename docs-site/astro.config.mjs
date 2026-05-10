// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeSix from '@six-tech/starlight-theme-six';
import starlightImageZoom from 'starlight-image-zoom';

// https://astro.build/config
//
// `site` and `base` are injected by the GitHub Pages workflow
// (.github/workflows/pages.yml) via actions/configure-pages. They're undefined
// for local dev, which is fine — Astro defaults to localhost/'/'.

// Strip a trailing slash so it composes cleanly with paths that start
// with `/` (e.g. `${BASE_PATH}/scripts/sidebar-toggles.js`). Empty in
// local dev, `/mcp-production-pathway` on Pages.
const BASE_PATH = (process.env.BASE || '').replace(/\/$/, '');

export default defineConfig({
	site: process.env.SITE,
	base: process.env.BASE,
	integrations: [
		starlight({
			title: "MCP Production Pathway",
			description:
			  "A 12-week learning pathway for building a production-grade Model Context Protocol server.",
			customCss: ['./src/styles/custom.css'],
			components: {
				Sidebar: './src/overrides/Sidebar.astro',
				SidebarSublist: './src/overrides/SidebarSublist.astro',
				PageTitle: './src/overrides/PageTitle.astro',
				MarkdownContent: './src/overrides/MarkdownContent.astro',
			},
			head: [
				// Pre-paint: read stored sidebar/TOC visibility preference and
				// stamp matching data-attrs on <html> before the first paint, so
				// hidden sidebars don't flash visible on load. Default state
				// (no localStorage entry) leaves both sidebars open.
				{
					tag: 'script',
					content:
						"(function(){try{var s=localStorage.getItem('docs-sidebar-hidden');var t=localStorage.getItem('docs-toc-hidden');if(s==='1')document.documentElement.dataset.sidebarHidden='';if(t==='1')document.documentElement.dataset.tocHidden='';}catch(e){}})();",
				},
				// Deferred: floating-pill UI + click handlers. The src has to
				// be prefixed with BASE_PATH manually — Starlight's `head` config
				// renders attrs verbatim and doesn't run them through Astro's
				// asset pipeline, so a bare `/scripts/...` path 404s on Pages
				// where the site is served under `/mcp-production-pathway/`.
				{
					tag: 'script',
					attrs: { src: `${BASE_PATH}/scripts/sidebar-toggles.js`, defer: true },
				},
			],
			logo: {
				light: "./src/assets/logo-light.svg",
				dark: "./src/assets/logo-dark.svg",
				replacesTitle: false,
			},
			plugins: [
				starlightThemeSix({
					navLinks: [
						{ label: "Start here", link: "/" },
						{ label: "Leader fast track", link: "/fast-track" },
						{ label: "Curriculum", link: "/weeks/week-00-setup" },
						{ label: "Examples", link: "/templates/examples" },
					],
					footerText: "Template — fork and make it your own. MIT licensed.",
				}),
				starlightImageZoom({
					// Suppress the plugin's "alt text as caption" rendering on
					// zoom. The brief renders its own visible captions in
					// markdown beneath each figure (smaller-font italic),
					// which is the canonical caption. Showing alt text again
					// on zoom would duplicate or confuse.
					showCaptions: false,
				}),
			],
			sidebar: [
			  {
				label: "Start here",
				items: [
				  { label: "Overview", link: "/" },
				  { label: "Pathway map", slug: "pathway" },
				  { label: "Repo architecture", slug: "repo-architecture" },
				],
			  },
			  {
				label: "Leader fast track",
				items: [
				  { label: "Overview", slug: "fast-track" },
				  { label: "Executive brief (CEO / CFO / Sales)", slug: "fast-track/executive-brief" },
				  { label: "1 — What MCP is, and what it changes", slug: "fast-track/01-why-mcp-exists" },
				  { label: "2 — The mental model", slug: "fast-track/02-mental-model" },
				  { label: "3 — Architecture in depth", slug: "fast-track/03-architecture-in-depth" },
				  { label: "4 — The risk surface", slug: "fast-track/04-risk-surface" },
				  { label: "5 — Making it reliable", slug: "fast-track/05-making-it-reliable" },
				  { label: "Resources and further reading", slug: "fast-track/resources" },
				],
			  },
			  {
				label: "Curriculum",
				items: [
				  { label: "Week 0 — Setup", slug: "weeks/week-00-setup" },
				  { label: "Week 1 — Mental model", slug: "weeks/week-01" },
				  { label: "Week 2 — First server", slug: "weeks/week-02" },
				  { label: "Week 3 — Iterate and measure", slug: "weeks/week-03" },
				  { label: "Week 4 — Streamable HTTP transport", slug: "weeks/week-04" },
				  { label: "Week 5 — Sessions, persistence, prompts, roots", slug: "weeks/week-05" },
				  { label: "Week 6 — OAuth 2.1 done correctly", slug: "weeks/week-06" },
				  { label: "Week 7 — DCR, multi-tenancy, audit, quotas", slug: "weeks/week-07" },
				  { label: "Week 8 — Docker, deploy, SLOs, reliability", slug: "weeks/week-08" },
				  { label: "Week 9 — OpenTelemetry, traces, metrics", slug: "weeks/week-09" },
				  { label: "Week 10 — Caching, cost, versioning, contracts", slug: "weeks/week-10" },
				  { label: "Week 11 — Load, sampling, elicitation", slug: "weeks/week-11" },
				  { label: "Week 12 — Security, threats, PII, close-out", slug: "weeks/week-12" },
				],
			  },
			  {
				label: "Templates",
				items: [
				  { label: "Memo template", slug: "templates/memo" },
				  { label: "ADR template", slug: "templates/adr" },
				  { label: "Progress entry template", slug: "templates/progress-entry" },
				],
			  },
			  {
				label: "Worked examples",
				items: [
				  { label: "Overview", slug: "templates/examples" },
				  { label: "Memo — example A", slug: "templates/examples/memo-example-a" },
				  { label: "Memo — example B", slug: "templates/examples/memo-example-b" },
				  { label: "ADR example", slug: "templates/examples/adr-example" },
				  { label: "Iteration log example", slug: "templates/examples/iteration-log-example" },
				  { label: "Harness trace example", slug: "templates/examples/harness-trace-example" },
				  { label: "Progress entry example", slug: "templates/examples/progress-entry-example" },
				],
			  },
			  {
				label: "Reference",
				items: [
				  { label: "Model IDs", slug: "docs/model-ids" },
				  { label: "Server scaffold", slug: "server/readme" },
				  { label: "Harness scaffold", slug: "harness/readme" },
				],
			  },
			]
		}),
	],
});
