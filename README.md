# Docs Site

A Next.js (App Router) + MDX documentation site, configured for static export to GitHub Pages.

**Stack:** Next.js 15 · MDX (`next-mdx-remote`) · Tailwind CSS · Shiki (`rehype-pretty-code`) · Pagefind (search) · `next-themes` (dark mode)

## Features

- ✅ Author docs as `.md` / `.mdx` files inside `/content`
- ✅ Sidebar nav generated from folder structure (with `order` frontmatter)
- ✅ Full-text search via Pagefind, indexed at build time (⌘K to open)
- ✅ Dark mode with system preference + toggle
- ✅ Syntax highlighting with line highlighting (`{1,3-5}`) and titles
- ✅ One-click copy button on every code block
- ✅ Anchor links on headings (`rehype-slug` + `rehype-autolink-headings`)
- ✅ GitHub Actions workflow for GitHub Pages deployment

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

> Search results require a build first (`npm run build`) — Pagefind only runs against the static export.

## Adding content

Drop a markdown file anywhere in `/content`. The folder structure becomes the URL.

```
content/
  index.md                   →  /docs
  getting-started/
    installation.md          →  /docs/getting-started/installation
  guides/
    deployment.md            →  /docs/guides/deployment
```

Frontmatter:

```md
---
title: Page Title
description: Optional summary
order: 1
---
```

## Deploying to GitHub Pages

1. Push to GitHub and enable Pages: **Settings → Pages → Source: GitHub Actions**.
2. If deploying to `https://<user>.github.io/<repo>/`, edit `.github/workflows/deploy.yml` and set:
   ```yaml
   env:
     NEXT_PUBLIC_BASE_PATH: '/your-repo-name'
   ```
3. Push to `main` — the workflow builds the static site and the Pagefind index, then deploys.

## Project structure

```
app/
  docs/
    [[...slug]]/page.tsx     # Catch-all MDX renderer
    layout.tsx               # Header + sidebar shell
  globals.css
  layout.tsx
  page.tsx                   # Marketing landing
components/
  search.tsx                 # Pagefind ⌘K modal
  sidebar.tsx                # Recursive nav tree
  theme-provider.tsx         # next-themes wrapper
  theme-toggle.tsx
  code-copy.tsx              # Copy button injection
content/                     # Your markdown lives here
lib/
  content.ts                 # Filesystem walker + nav tree builder
.github/workflows/deploy.yml
next.config.js               # output: 'export', basePath
```
