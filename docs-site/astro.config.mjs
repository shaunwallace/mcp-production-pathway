// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeSix from '@six-tech/starlight-theme-six';

// https://astro.build/config
//
// `site` and `base` are injected by the GitHub Pages workflow
// (.github/workflows/pages.yml) via actions/configure-pages. They're undefined
// for local dev, which is fine — Astro defaults to localhost/'/'.
export default defineConfig({
	site: process.env.SITE,
	base: process.env.BASE,
	integrations: [
		starlight({
			title: "MCP Production Pathway",
			description:
			  "A 12-week learning pathway for building a production-grade Model Context Protocol server.",
			customCss: ['./src/styles/custom.css'],
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
				  { label: "1 — What MCP is, and what it changes", slug: "fast-track/01-why-mcp-exists" },
				  { label: "2 — The mental model", slug: "fast-track/02-mental-model" },
				  { label: "3 — Architecture in depth", slug: "fast-track/03-architecture-in-depth" },
				  { label: "4 — The risk surface", slug: "fast-track/04-risk-surface" },
				  { label: "5 — Making it reliable", slug: "fast-track/05-making-it-reliable" },
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
