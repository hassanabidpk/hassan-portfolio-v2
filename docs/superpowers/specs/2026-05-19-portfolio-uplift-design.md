# Portfolio Uplift — Design Spec

Date: 2026-05-19
Status: Approved (design), pending implementation plan

## Summary

Migrate the personal portfolio off the dead Gatsby v2 starter (Lumen, ~2018 —
will not build on current Node) to a modern **Astro** site with a full
**modern-minimal** visual redesign. Keep the existing blog engine and all
existing posts/pages, add portfolio sections (hero + Projects). Continue
deploying on **Netlify**. Existing post URLs are preserved.

## Goals

- Buildable, maintainable, future-proof stack on current Node.
- Clean modern-minimal aesthetic, light + dark mode.
- Preserve all existing content and existing `/posts/...` URLs (SEO).
- Add a landing/hero page and a Projects section.
- Keep Netlify deployment.

## Non-Goals (YAGNI)

- CMS / admin UI.
- Comments (old Disqus shortname was empty — dropped).
- Internationalization.
- Site search.
- Newsletter signup.

## Stack Decision

Chosen: **Astro** (TypeScript).

Rationale: Content Collections ingest the existing markdown almost as-is;
zero-JS static output gives top Lighthouse scores; first-class Netlify
adapter; MDX preserves speakerdeck/iframe embeds; `astro:assets` replaces
`gatsby-remark-images`. Lowest migration friction for a markdown blog +
portfolio.

Rejected:
- **Next.js (App Router)** — more power than a static portfolio needs,
  heavier JS baseline, more config for equivalent result.
- **Modern Gatsby v5** — fading ecosystem, near-rewrite from v2 anyway,
  slowest builds, least future-proof.

## Architecture

- Astro project, TypeScript, integrations: `@astrojs/mdx`,
  `@astrojs/sitemap`, `@astrojs/rss`, `astro:assets`. Shiki for code
  highlighting.
- Content collections in `src/content/`:
  - `posts` — blog/talks. Zod schema mirrors current frontmatter:
    `title` (string), `date` (date), `draft` (boolean, default false),
    `path` (string), `category` (string), `tags` (string[]),
    `description` (string).
  - `pages` — `about`, `contact`. Schema: `title`, `path`.
  - `projects` — curated portfolio entries. Schema: `title`, `summary`,
    `link` (optional), `repo` (optional), `tags` (string[]),
    `order` (number), `image` (optional).
- URL preservation: post route derives the public path from the `path`
  frontmatter field so existing `/posts/<slug>/` URLs are unchanged.
  A Netlify `_redirects` file maps any URL that does change.
- Site metadata centralized in `src/config.ts` (name, subtitle, socials:
  twitter/github/instagram/linkedin, menu, GA id) — replaces
  `gatsby-config.js` `siteMetadata`.

### Routes

- `/` — landing/home (hero + intro + Projects + latest posts).
- `/blog` — post list (the old "Talks and Workshops" index).
- `/posts/[...slug]` — individual post (path-preserved).
- `/about`, `/contact` — from `pages` collection.
- `/tags`, `/tags/[tag]`, `/categories`, `/categories/[category]`.
- `/404`.
- `/rss.xml` — feed parity with the old `gatsby-plugin-feed` output.
- `robots.txt`, sitemap (via integration).

### Components & Layouts

- Layouts: `BaseLayout` (head, SEO/OpenGraph, theme bootstrap),
  `PostLayout` (prose wrapper + post meta).
- Components: `Header`, `Footer`, `ThemeToggle`, `Hero`, `PostCard`,
  `ProjectCard`, `SocialLinks`, `Prose`, `TagList`.
- The old fixed left-sidebar shell is retired. Sidebar identity (photo,
  name, role, socials) is re-homed into the `Hero` and `Footer`.

## Visual Design — Modern Minimal

- Light + dark mode: system default, manual `ThemeToggle`, inline
  no-flash script reading `localStorage` before paint.
- Design tokens as CSS custom properties: refined modular type scale,
  generous whitespace, single accent (keep brand blue `#5d93ff`, tuned
  per theme), neutral gray ramp.
- Typography: variable sans (Inter via `@fontsource-variable`) for UI;
  optional serif for post body. Self-hosted — the google-fonts plugin
  is dropped.
- Motion: subtle only — fade/translate on scroll-in, hover transitions.
  Honors `prefers-reduced-motion`. No heavy animation libraries.
- `Prose` styles: polished markdown rendering — headings, code blocks
  (Shiki), images (`astro:assets`), blockquotes, embeds, tables.

### Home Page

Hero (photo, name, "Senior Software Engineer · Google Developers Expert
for Android", primary social links, CTA to blog + contact) → short intro
→ **Projects** section (curated `ProjectCard` grid) → latest posts →
footer. Projects is the one net-new content area; seeded with editable
placeholders (KineMaster, KineMaster/NexPlayer SDK work, this site).

## Content Migration

- Each `src/pages/articles/<date>---<slug>/index.md` →
  `src/content/posts/<slug>.md(x)`. Use `.mdx` where the body contains
  HTML/script embeds (e.g. speakerdeck); plain `.md` otherwise.
- Colocate local post images; rewrite relative `./img.jpg` references for
  `astro:assets`. Remote image URLs left untouched.
- `about` and `contact` markdown → `pages` collection with their local
  images migrated.
- Preserve `draft`, `category`, `tags`, `description`, `date`, and
  `path`-derived URLs. Drafts excluded from build/list/feed (parity with
  old `draft: { ne: true }` filter).
- Migration is script-assisted but verified by hand; the old
  `src/pages` tree is removed once parity is confirmed.

## SEO / Infrastructure

- Per-page `<title>`, meta description, canonical, OpenGraph/Twitter
  card tags via `BaseLayout`.
- `@astrojs/sitemap` for sitemap; `@astrojs/rss` for `/rss.xml` with the
  same fields the old feed emitted.
- Analytics: replace `gatsby-plugin-google-analytics` with a lightweight
  deferred GA4 snippet, tracking id in `src/config.ts` (configurable;
  easy to swap to Plausible later).
- Netlify: `netlify.toml` → `command = "astro build"`,
  `publish = "dist"`; pin Node 20 via `.nvmrc` + `NODE_VERSION`; remove
  dead `YARN_VERSION`/`YARN_FLAGS`. `_redirects` for any changed URLs.

## Error Handling

- Branded `/404` page.
- Build-time: Zod content schema fails the build loudly on malformed
  frontmatter. `astro check` (TypeScript) runs as a verification step.

## Testing / Verification

- `astro build` completes clean; `astro check` passes.
- Dev server manual walkthrough: home, `/blog`, a post (local-image post
  and embed post), `/about`, `/contact`, `/tags`, `/categories`, dark
  mode toggle, `/404`.
- Confirm representative old `/posts/...` URLs still resolve.
- Lighthouse spot-check on home + a post (performance + a11y).

## Risks

- Embed-heavy posts (speakerdeck `<script>`) — mitigated by `.mdx`.
- URL drift breaking SEO — mitigated by path-preserving route +
  `_redirects`.
- Image path rewrites missed in migration — mitigated by manual
  per-post verification before deleting the old tree.
