# Türk Güncesi Wiki

The open encyclopedia of Turkish culture. A community-curated reference on
Turkish literature, history, folklore, music, language, architecture, cuisine
and art.

- **Live site:** https://wiki.turkguncesi.com
- **Main site:** https://turkguncesi.com
- **Blog:** https://blog.turkguncesi.com

This project is a **fully static [Astro](https://astro.build/) site**. No
server, no database, no CMS, no runtime dependencies. Every article lives as
a Markdown file inside this repository under `src/content/wiki/`. Search is
fully client-side using [Pagefind](https://pagefind.app).

---

## Quick start

Requirements:

- **Node.js ≥ 22.12** (tested on Node 22 / 24 / 25)
- npm (bundled with Node)

```bash
git clone <this-repo> turkguncesi-wiki
cd turkguncesi-wiki
npm install
npm run dev
```

Open <http://localhost:4321>. Any edit to a `.md` file hot-reloads instantly.

### Production build

```bash
npm run build
npm run preview
```

When `npm run build` runs, three things happen in order:

1. **`prebuild`** runs `scripts/sync-canonical-redirects.mjs`, which **rewrites
   `public/_redirects`**: legacy `/wiki/…` → new URLs, plus **301 redirects**
   for any article that sets `canonicalEntryId` (see below).
2. **Astro** compiles the site into `dist/`.
3. **`postbuild`** runs **Pagefind** (`pagefind --site dist`), which writes the
   static search index under `dist/pagefind/`.

To go live, publish the contents of `dist/` to any static host.

---

## Project layout

```
turkguncesi-wiki/
├── astro.config.mjs          # Astro config, site URL, sitemap integration
├── netlify.toml              # Netlify deploy + security headers
├── vercel.json               # Vercel deploy + security headers
├── package.json              # npm scripts and dependencies
├── scripts/
│   ├── import-wikijs.py      # Optional Wiki.js → Markdown importer
│   └── sync-canonical-redirects.mjs  # prebuild: writes public/_redirects
├── public/                   # Static assets copied as-is
│   ├── _headers              # Netlify HTTP headers
│   ├── _redirects            # Generated on prebuild (legacy /wiki/ + 301 aliases)
│   ├── favicon.svg
│   ├── og-default.svg        # Default Open Graph image
│   └── images/               # Article images
└── src/
    ├── content.config.ts     # Content collection + Zod schema
    ├── content/
    │   └── wiki/             # One folder per category
    │       ├── turk-edebiyati/
    │       ├── turk-folkloru/
    │       ├── turk-milliyetciligi/
    │       ├── turk-muzigi/
    │       ├── turk-tarihi/
    │       ├── turk-dili/
    │       ├── turk-mimarisi/
    │       ├── turk-mutfagi/
    │       └── turk-sanati/
    ├── layouts/
    │   ├── BaseLayout.astro       # Global page shell
    │   └── ArticleLayout.astro    # Article page shell
    ├── components/
    │   ├── ThemeToggle.astro      # Light/dark toggle button
    │   ├── TableOfContents.astro  # Auto-generated from headings
    │   ├── RelatedArticles.astro  # Resolves frontmatter `related`
    │   ├── CategoryCard.astro
    │   ├── CategoryIcon.astro     # SVG category icons
    │   ├── Breadcrumb.astro
    │   └── SearchBar.astro
    ├── pages/
    │   ├── index.astro              # Homepage
    │   ├── [...path].astro          # Wiki: /{category}/…/ (articles + hubs)
    │   ├── dizin/
    │   │   └── index.astro          # Full hierarchical index (/dizin/)
    │   ├── 404.astro                # Custom 404
    │   ├── hakkimizda.astro         # About
    │   ├── gizlilik-politikasi.astro
    │   ├── cerez-politikasi.astro
    │   ├── robots.txt.ts            # robots.txt generator
    │   └── ara/
    │       └── index.astro          # Pagefind search page
    └── styles/
        └── global.css               # Themes + the entire visual system
```

---

## The nine categories

The wiki has exactly **nine categories**. Category display names and slugs
are **fixed** and must not be renamed:

| Display name            | Folder / slug           |
| ----------------------- | ----------------------- |
| Türk Edebiyatı          | `turk-edebiyati`        |
| Türk Folkloru           | `turk-folkloru`         |
| Türk Milliyetçiliği     | `turk-milliyetciligi`   |
| Türk Müziği             | `turk-muzigi`           |
| Türk Tarihi             | `turk-tarihi`           |
| Türk Dili               | `turk-dili`             |
| Türk Mimarisi           | `turk-mimarisi`         |
| Türk Mutfağı            | `turk-mutfagi`          |
| Türk Sanatı             | `turk-sanati`           |

If a new category ever needs to be added, four constants in
`src/content.config.ts` must be updated (`CATEGORIES`, `CATEGORY_DISPLAY`,
`CATEGORY_DESCRIPTION`, `CATEGORY_ICON`) and a matching SVG branch needs to
be added to `CategoryIcon.astro`.

---

## Adding a new article

1. Decide which category it belongs to (e.g. `turk-tarihi`).
2. Inside that category folder, create a new Markdown file. The filename —
   lowercase, no Turkish diacritics, words separated by hyphens — becomes the
   URL slug (articles are **not** under `/wiki/`; the path mirrors the folder
   tree under `src/content/wiki/`).
   ```
   src/content/wiki/turk-tarihi/orhun-yazitlari.md
   → https://wiki.turkguncesi.com/turk-tarihi/orhun-yazitlari/
   ```
3. Add the frontmatter block (see below).
4. Write the article body in Markdown.
5. Run `npm run dev` to preview it locally.
6. Commit and push.

### Frontmatter schema

Every article must satisfy this schema (validated with Zod):

```yaml
---
title: "Orhun Yazıtları"              # string, required
category: "turk-tarihi"               # must match the folder slug EXACTLY
tags: ["göktürk", "yazıt", "8. yüzyıl"]  # string[] (default: [])
description: "Short description"      # string, required (used in meta/OG)
author: "Author Name"                 # string, optional
date: 2026-04-10                      # last updated date (required)
image: "/images/orhun.jpg"            # optional cover image (under public/)
related: ["bozkir-kulturu"]           # slugs of related articles
draft: false                          # if true, excluded from build
# canonicalEntryId: "turk-milliyetciligi/nihal-atsiz"  # optional; see “Same topic, two categories”
---
```

| Field                | Type                         | Required | Description                                                                                     |
| -------------------- | ---------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `title`              | string                       | yes      | Article title                                                                                   |
| `category`           | enum (one of the 9 slugs)    | yes      | Must match the containing folder name                                                           |
| `description`        | string                       | yes      | 1–2 sentence summary; used in `<meta>` and OG tags                                              |
| `date`               | date (YYYY-MM-DD)            | yes      | Last updated date                                                                               |
| `tags`               | string[]                     | no       | List of tags (default `[]`)                                                                     |
| `author`             | string                       | no       | Author name                                                                                     |
| `image`              | string                       | no       | A path under `public/` (e.g. `/images/foo.jpg`). 16:9 recommended.                              |
| `related`            | string[]                     | no       | Article slugs. Both `"slug"` and `"category/slug"` forms are supported.                         |
| `draft`              | boolean                      | no       | If `true`, the article is excluded from the build output                                        |
| `canonicalEntryId`   | string                       | no       | If set, this file is an **alias**: same topic also listed elsewhere; see below.                 |

### Same topic in two categories (`canonicalEntryId`)

Sometimes one person or topic belongs in **two** category trees (e.g. a figure
in both *Türk Milliyetçiliği* and *Türk Edebiyatı*). Without care, that creates
**two different public URLs** for the same article — bad for readers and SEO.

**Pattern we use:**

1. Keep **one “main”** Markdown file where the **full article** lives (normal
   frontmatter, no `canonicalEntryId`).
2. For each **extra** place it should appear in the tree, add another `.md`
   file in the right folder (so it still shows up in the index under that
   branch). In that file’s frontmatter, set:

   ```yaml
   canonicalEntryId: "category/sub/path-to-main-file"
   ```

   Use the **collection id**: path under `src/content/wiki/`, **no** `.md`, use
   `/` between folders (e.g. `turk-milliyetciligi/nihal-atsiz`).

3. **What the site does:** links in the tree, “related” blocks, and prev/next
   point to the **main** URL. The alias URL shows a short **redirect** page
   (`noindex`, canonical tag, meta refresh + button). On **Netlify**, `npm run
   build` also refreshes `public/_redirects` so the alias URL gets a **301** to
   the main URL.

After changing `canonicalEntryId` anywhere, run a full **`npm run build`** (or
at least `node scripts/sync-canonical-redirects.mjs`) so `_redirects` stays in
sync. `npm run dev` does **not** run `prebuild` automatically.

### Public URL layout (short)

| What                         | URL pattern                          |
| ---------------------------- | ------------------------------------ |
| Homepage                     | `/`                                  |
| Full wiki index (nav **Dizin**) | `/dizin/`                        |
| Category or article          | `/{category}/…/` (mirrors file path) |
| Search                       | `/ara/`                              |

Old links under `/wiki/…` are redirected (see `public/_redirects`).

### Article body

- Standard Markdown (GitHub-flavored) is supported: tables, lists, code
  blocks, blockquotes, links, images.
- Headings starting with `##` are automatically included in the sidebar
  **Table of Contents** on each article page.
- Use fenced code blocks (\`\`\`) for code. Shiki renders them with matching
  light and dark themes automatically.
- Images go under `public/images/` and are referenced as `/images/...` in
  Markdown.

---

## Category suggestions

Short guidance on the kinds of content each category should contain:

- **Türk Edebiyatı** — Author monographs (Yunus Emre, Karacaoğlan, Yahya
  Kemal), literary movements (Tanzimat, Servet-i Fünûn), work analyses.
- **Türk Folkloru** — Epics (Manas, Oğuz Kağan), folk tales, customs,
  proverbs, idioms.
- **Türk Milliyetçiliği** — Intellectual history, key concepts, figures
  (Ziya Gökalp, Yusuf Akçura), period analyses.
- **Türk Müziği** — Turkish folk music, Turkish classical (sanat) music,
  contemporary Turkish music; instruments, performers, makams.
- **Türk Tarihi** — States (Göktürk, Selçuklu, Osmanlı), events, battles,
  reforms, biographies.
- **Türk Dili** — Dialects, historical periods, grammar topics, etymology,
  alphabet history.
- **Türk Mimarisi** — Buildings (Süleymaniye, Ayasofya), architects (Mimar
  Sinan), styles, regional vernacular architecture.
- **Türk Mutfağı** — Regional dishes, historical cuisine, ingredients,
  techniques, beverages.
- **Türk Sanatı** — Calligraphy (hat), illumination (tezhip), miniature,
  ceramics (çini), painting, sculpture, contemporary fine arts.

---

## Theme system (light / dark)

- Defined in `src/styles/global.css` using **CSS custom properties only**.
- Applied via `<html data-theme="light | dark">`.
- A small **inline `<script>`** in `BaseLayout.astro` runs before any CSS
  loads, reads the user's preference from `localStorage`, and sets
  `data-theme` on `<html>` — this prevents FOUC (flash of unstyled content).
- If no preference has been saved, the site falls back to the
  `prefers-color-scheme` media query.
- `ThemeToggle.astro` persists the choice as `localStorage["tg-theme"]`.

To change the color palette, edit the `:root, [data-theme="light"]` and
`[data-theme="dark"]` blocks in `global.css`. **No third-party theme library
is used.**

---

## Search (Pagefind)

- No manual setup needed — `pagefind` is listed under `devDependencies`.
- After every `npm run build`, the `postbuild` hook runs
  `pagefind --site dist`, which writes the index, CSS and JS into
  `dist/pagefind/`.
- The `/ara/` page loads that index with a small inline `<script>` and runs
  entirely client-side.
- Each article page wraps its `<article>` in a `data-pagefind-body`
  attribute, so only the article body is indexed (not the navigation or
  footer).
- Categories and tags are exposed as filters via `data-pagefind-filter`.

Search is **100% client-side**. No query ever leaves the browser.

---

## SEO & technical compliance

- `site: "https://wiki.turkguncesi.com"` is declared in `astro.config.mjs`.
- `@astrojs/sitemap` generates `sitemap-index.xml` at build time.
- `src/pages/robots.txt.ts` generates `robots.txt` at build time.
- `BaseLayout.astro` emits `<title>`, `<meta name="description">`,
  `og:title`, `og:description`, `og:image`, `og:url`, `canonical` and
  Twitter Card tags on every page.
- Alias articles (`canonicalEntryId`) emit `noindex` and point `canonical` at
  the primary URL; Netlify-style **301** rules are written to `public/_redirects`
  during `prebuild`.
- `<html lang="tr">`.
- Favicon at `public/favicon.svg`.

### Security headers

Declared in parallel for both deployment targets:

- **Netlify:** `public/_headers` + `netlify.toml`
- **Vercel:** `vercel.json`

Headers applied site-wide:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

---

## Deploying

### Netlify

1. Create a new site and connect this repository.
2. Build settings are picked up automatically from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add `wiki.turkguncesi.com` as a custom domain.
4. Deploy. The Pagefind index is produced by the `postbuild` step and the
   headers from `_headers` are applied on the edge.

### Vercel

1. "Import Git Repository" and select this repo.
2. Vercel detects Astro automatically. `vercel.json` supplies the headers.
3. Build command: `npm run build`, output directory: `dist`.
4. Add `wiki.turkguncesi.com` as a custom domain.

Any other static host (Cloudflare Pages, GitHub Pages, S3 + CloudFront,
etc.) also works — it just needs to serve the `dist/` folder. Re-declare the
security headers in that host's configuration if needed.

---

## Contribution workflow

1. Fork / branch the repository.
2. Create a feature branch (e.g. `article/yunus-emre`).
3. Add your Markdown file under the correct category folder.
4. Verify locally with `npm run dev`.
5. Commit and open a pull request.

---

## License

Suggested licenses:

- **Source code:** MIT
- **Content (articles):** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

© Türk Güncesi. All rights reserved.
