# Portfolio Uplift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead Gatsby v2 portfolio with a modern-minimal Astro 5 site that keeps all existing posts/pages and URLs, adds a hero + Projects section, and deploys on Netlify.

**Architecture:** Static Astro 5 site. Content Collections (glob loader) ingest migrated markdown for `posts`, `pages`, `projects`. Post public URLs are derived from each post's existing `path` frontmatter via a unit-tested pure function so `/posts/...` URLs never change. Light/dark theming via CSS custom properties + a no-flash inline script. No SSR adapter (pure static output to `dist/`).

**Tech Stack:** Astro 5, TypeScript, `@astrojs/mdx`, `@astrojs/sitemap`, `@astrojs/rss`, `astro:assets`, `@fontsource-variable/inter`, Shiki, Vitest (for the two pieces of real logic + schema validation), Netlify static deploy, Node 20.

**Testing note:** This is a static content site. Genuine unit tests exist only where there is real logic (the URL-derivation function and content-schema validity). Everything else is gated by `astro check` (types) and `astro build` (build + schema + render), with a final manual walkthrough. Tasks state the exact verification command and expected output.

---

## File Structure

Created:
- `astro.config.mjs`, `tsconfig.json`, `.nvmrc`, `vitest.config.ts`
- `src/config.ts` — site metadata (name, subtitle, socials, menu, analyticsId)
- `src/content.config.ts` — `posts` / `pages` / `projects` collections + Zod schemas
- `src/lib/postPath.ts` — pure URL-derivation from frontmatter `path`
- `src/styles/tokens.css`, `src/styles/global.css`
- `src/layouts/BaseLayout.astro`, `src/layouts/PostLayout.astro`
- `src/components/`: `BaseHead.astro`, `Header.astro`, `Footer.astro`, `ThemeToggle.astro`, `SocialLinks.astro`, `Hero.astro`, `PostCard.astro`, `ProjectCard.astro`, `SpeakerDeck.astro`, `SlideShare.astro`, `Analytics.astro`
- `src/pages/`: `index.astro`, `blog.astro`, `posts/[...slug].astro`, `about.astro`, `contact.astro`, `tags/index.astro`, `tags/[tag].astro`, `categories/index.astro`, `categories/[category].astro`, `404.astro`, `rss.xml.js`
- `src/content/posts/*.md(x)`, `src/content/pages/{about,contact}.md`, `src/content/projects/*.md`
- `src/assets/profile.jpeg`
- `public/robots.txt`, `public/_redirects`
- `tests/postPath.test.ts`, `tests/content.test.ts`

Rewritten: `package.json`, `netlify.toml`
Deleted (final task): `gatsby-config.js`, `gatsby-node.js`, `src/templates/`, `src/pages/articles/`, `src/pages/pages/`, old `src/components/`, `src/assets/scss/`, `src/assets/fonts/`, `src/pages/index.jsx`, `src/pages/{tags,categories,404}.jsx`, `.browserslistrc`, `travis.yml`, old gatsby/react deps.

---

## Phase 1 — Scaffold

### Task 1: Initialize Astro project config

**Files:**
- Create: `package.json` (rewrite), `astro.config.mjs`, `tsconfig.json`, `.nvmrc`

- [ ] **Step 1: Write `.nvmrc`**

```
20
```

- [ ] **Step 2: Rewrite `package.json`**

```json
{
  "name": "hassan-portfolio",
  "version": "4.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run"
  },
  "dependencies": {
    "@astrojs/mdx": "^4.0.0",
    "@astrojs/rss": "^4.0.0",
    "@astrojs/sitemap": "^3.2.0",
    "@fontsource-variable/inter": "^5.1.0",
    "astro": "^5.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 4: Write `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://hassanabid.netlify.app',
  output: 'static',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-dark-default', wrap: true },
  },
});
```

- [ ] **Step 5: Install and verify**

Run: `npm install && npx astro --version`
Expected: prints an Astro 5.x version with no install errors.

- [ ] **Step 6: Commit**

```bash
git add package.json astro.config.mjs tsconfig.json .nvmrc package-lock.json
git commit -m "chore: scaffold Astro 5 project config"
```

---

### Task 2: Site config module

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Write `src/config.ts`**

```ts
export const site = {
  name: 'Hassan Abid',
  role: 'Senior Software Engineer · Google Developers Expert for Android',
  subtitle:
    'Senior Software Engineer. Google Developers Expert for Android',
  url: 'https://hassanabid.netlify.app',
  copyright: '© All rights reserved.',
  // GA4 measurement id (G-XXXXXXX). Empty disables analytics.
  // Legacy Universal id UA-73379983-2 is dead and intentionally not shipped.
  analyticsId: '',
  socials: {
    twitter: 'https://twitter.com/hassanabidpk',
    github: 'https://github.com/hassanabidpk',
    instagram: 'https://www.instagram.com/hassanabidpk/',
    linkedin: 'https://www.linkedin.com/in/hassanabid89/',
  },
  menu: [
    { label: 'Home', path: '/' },
    { label: 'Blog', path: '/blog' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ],
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/config.ts
git commit -m "feat: add centralized site config"
```

---

## Phase 2 — Core logic (TDD)

### Task 3: Post URL derivation function

The old Gatsby site served posts at the `path` value in each post's frontmatter (e.g. `/posts/app-kotlin-coroutines/`, and one without a trailing slash: `/posts/exploring-camerax-jetpack`). The new `posts/[...slug].astro` route must reproduce these exact URLs. This is the only nontrivial pure logic in the project, so it is built test-first.

**Files:**
- Create: `src/lib/postPath.ts`
- Create: `vitest.config.ts`
- Test: `tests/postPath.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/postPath.test.ts
import { describe, it, expect } from 'vitest';
import { slugFromPath, urlFromPath } from '../src/lib/postPath';

describe('slugFromPath', () => {
  it('strips /posts/ prefix and trailing slash', () => {
    expect(slugFromPath('/posts/app-kotlin-coroutines/')).toBe(
      'app-kotlin-coroutines'
    );
  });
  it('handles no trailing slash', () => {
    expect(slugFromPath('/posts/exploring-camerax-jetpack')).toBe(
      'exploring-camerax-jetpack'
    );
  });
  it('throws on a non-/posts/ path', () => {
    expect(() => slugFromPath('/about')).toThrow();
  });
});

describe('urlFromPath', () => {
  it('always returns a trailing-slash canonical url', () => {
    expect(urlFromPath('/posts/android-101/')).toBe('/posts/android-101/');
    expect(urlFromPath('/posts/exploring-camerax-jetpack')).toBe(
      '/posts/exploring-camerax-jetpack/'
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/postPath.test.ts`
Expected: FAIL — cannot resolve `../src/lib/postPath`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/postPath.ts
export function slugFromPath(path: string): string {
  const m = path.match(/^\/posts\/(.+?)\/?$/);
  if (!m) throw new Error(`Not a /posts/ path: ${path}`);
  return m[1];
}

export function urlFromPath(path: string): string {
  return `/posts/${slugFromPath(path)}/`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/postPath.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/postPath.ts vitest.config.ts tests/postPath.test.ts
git commit -m "feat: add post URL derivation with tests"
```

---

## Phase 3 — Content collections & migration

### Task 4: Define content collections

**Files:**
- Create: `src/content.config.ts`

- [ ] **Step 1: Write `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    path: z.string(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    description: z.string().default(''),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    path: z.string(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    link: z.string().url().optional(),
    repo: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
    order: z.number().default(99),
  }),
});

export const collections = { posts, pages, projects };
```

- [ ] **Step 2: Verify types**

Run: `npx astro sync && npx astro check`
Expected: `astro sync` generates `.astro/`; `astro check` reports 0 errors (no content yet is fine).

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "feat: define posts/pages/projects collections"
```

---

### Task 5: Migrate the 7 posts

Each old post lives at `src/pages/articles/<date>---<slug-dir>/index.md`. The new filename is the slug from its frontmatter `path` (NOT the directory name — directory names are stale starter names). Strip the `layout: post` frontmatter line (unused in Astro). Use `.mdx` for posts containing raw `<iframe>`/`<script>` embeds, `.md` otherwise. Only one post has a local image.

Migration table (verified from source):

| Source dir | New file | Embed | Local image |
|---|---|---|---|
| `2016-01-09---Perfecting-the-Art-of-Perfection` | `whats-new-in-android-jetpack.md` | none | none |
| `2016-01-12---The-Origins-of-Social-Stationery-Lettering` | `exploring-camerax-jetpack.md` | none | none |
| `2016-02-02---A-Brief-History-of-Typography` | `kotlin-for-android-devs.md` | none | none |
| `2017-18-08---The-Birth-of-Movable-Type` | `exploring-camerax-from-jetpack.mdx` | slideshare iframe | none |
| `2017-19-08---Humane-Typography-in-the-Digital-Age` | `android-101.mdx` | slideshare iframe | none |
| `2018-10-18---Upgraded-to-Gatsby-v2` | `google-startup-jam-2019.md` | none | none |
| `2019-16-11---App-Performance-with-Kotlin-Coroutines` | `app-kotlin-coroutines.mdx` | speakerdeck script | `IMG_1035.JPG` |

**Files:**
- Create: `src/content/posts/<slug>.md(x)` (7 files)
- Create: `src/content/posts/IMG_1035.JPG` (copied)
- Create: `src/components/SlideShare.astro`, `src/components/SpeakerDeck.astro`

- [ ] **Step 1: Create embed components** (used by the `.mdx` posts instead of raw scripts)

```astro
---
// src/components/SlideShare.astro
interface Props { src: string; title: string; }
const { src, title } = Astro.props;
---
<div class="embed">
  <iframe src={src} title={title} width="595" height="485"
    loading="lazy" frameborder="0" allowfullscreen
    style="max-width:100%;border:1px solid #ccc"></iframe>
</div>
```

```astro
---
// src/components/SpeakerDeck.astro
interface Props { dataId: string; }
const { dataId } = Astro.props;
---
<div class="embed">
  <script async class="speakerdeck-embed" data-id={dataId}
    data-ratio="1.33333333333333" src="https://speakerdeck.com/assets/embed.js"
  ></script>
</div>
```

- [ ] **Step 2: Migrate the 3 plain `.md` posts with no embeds**

For each of `whats-new-in-android-jetpack`, `kotlin-for-android-devs`, `google-startup-jam-2019`: copy the source `index.md` body, keep frontmatter fields `title,date,draft,path,category,tags,description` (drop `layout`). Remote `![]()` image URLs stay verbatim. Example expected result for `google-startup-jam-2019.md`:

```md
---
title: Mentoring at Google Startup Jam 2019 - Singapore
date: "2019-08-31T10:51:00.000Z"
draft: false
path: "/posts/google-startup-jam-2019/"
category: "GDE"
tags:
  - "GDE"
  - "Android Development"
description: "Mentored early stage startups at Google Startup Jam organized by Google Business Group Singapore"
---

Startup Jam is specially designed for seed stage startups ... (full original body)

![GBG Singapore](https://sfo2.digitaloceanspaces.com/advocu/gde/activity-photos/2019/09/13/369e8dbf1c66aaedc8ba.jpeg)
```

Add `description: ""` where the source had none (jetpack/camerax posts had no description line).

- [ ] **Step 3: Migrate `exploring-camerax-jetpack.md`**

Source `2016-01-12---The-Origins-of-Social-Stationery-Lettering/index.md`. Note its `path` is `"/posts/exploring-camerax-jetpack"` (no trailing slash) — keep it verbatim; `urlFromPath` normalizes it. Plain `.md`, remote image stays.

- [ ] **Step 4: Migrate the 2 slideshare `.mdx` posts**

For `exploring-camerax-from-jetpack.mdx` and `android-101.mdx`: convert frontmatter as above, then replace the raw `<iframe>...</iframe><div>...</div>` block with an MDX import + component. Example for `android-101.mdx`:

```mdx
---
title: Android 101 - Kotlin ( Future of Android Development)
date: "2019-09-07T10:40:32.169Z"
draft: false
path: "/posts/android-101/"
category: "Android"
tags:
  - "Android"
  - "GDE"
  - "DSC"
  - "Public Speaking"
description: ""
---
import SlideShare from '../../components/SlideShare.astro';

(original intro paragraphs)

<SlideShare
  src="https://www.slideshare.net/slideshow/embed_code/key/1C9J7QBa3WOJzS"
  title="Android 101 - Kotlin ( Future of Android Development)" />

(any remaining body, e.g. the slideshare attribution link as markdown, and the trailing remote image)
```

Apply the same shape to `exploring-camerax-from-jetpack.mdx` using its key `uZPC6Oiqx6qmt9` and its trailing remote image.

- [ ] **Step 5: Migrate `app-kotlin-coroutines.mdx` + its local image**

Copy `2019-16-11---App-Performance-with-Kotlin-Coroutines/IMG_1035.JPG` to `src/content/posts/IMG_1035.JPG`. In the `.mdx`, replace the speakerdeck `<script>` with `<SpeakerDeck dataId="be0b0bad80e3498a9b820ba88d8f8772" />` (import it), keep the `[Speakerdeck link](...)` markdown line, and keep the local image as standard markdown `![image](./IMG_1035.JPG)` (Astro optimizes relative markdown images in `src/`).

- [ ] **Step 6: Verify build sees all 7 posts**

Run: `npx astro build`
Expected: build succeeds; output includes 7 pages under `dist/posts/`. If a schema error appears, the offending frontmatter field is reported — fix and rebuild.

- [ ] **Step 7: Commit**

```bash
git add src/content/posts src/components/SlideShare.astro src/components/SpeakerDeck.astro
git commit -m "feat: migrate 7 posts to Astro content collection"
```

---

### Task 6: Migrate about & contact pages + projects seed

**Files:**
- Create: `src/content/pages/about.md`, `src/content/pages/contact.md`, `src/content/pages/about.jpg`, `src/content/pages/contact.jpg`
- Create: `src/content/projects/{kinemaster,nexplayer-sdk,this-site}.md`

- [ ] **Step 1: Migrate About**

Copy `src/pages/pages/2015-05-01---about/2.jpg` → `src/content/pages/about.jpg`. Write `src/content/pages/about.md`:

```md
---
title: "About me"
path: "/about"
---

I am a passionate Software Engineer with several years of experience in Mobile and Web development. I am currently based in Singapore, where I work as Tech Lead for [BeLive technology](http://www.tech.belive.sg/).

![Code](./about.jpg)

Before that, I lived in Seoul where I worked for NexStreaming Corp. with the NexPlayer SDK team. I worked on [KineMaster](https://www.kinemaster.com), an Android Video editing app, in the same company.

I love writing and sharing my experiences about Android, iOS and Web development with fellow developers through blog posts, events and conferences. When I am not coding, you can find me hiking, running or cycling with my GoPro.
```

- [ ] **Step 2: Migrate Contact**

Copy `src/pages/pages/2015-05-01---contact/1.jpg` → `src/content/pages/contact.jpg`. Write `src/content/pages/contact.md`:

```md
---
title: "Contact me"
path: "/contact"
---

Find me on [Twitter](https://twitter.com/hassanabidpk), [Instagram](https://www.instagram.com/hassanabidpk/) and [LinkedIn](https://www.linkedin.com/in/hassanabid89/).

![phone](./contact.jpg)
```

- [ ] **Step 3: Seed 3 projects** (editable placeholders, no images — per spec YAGNI)

`src/content/projects/kinemaster.md`:
```md
---
title: KineMaster
summary: Contributed to KineMaster, a professional Android video-editing app, during my time at NexStreaming Corp.
link: https://www.kinemaster.com
tags: ["Android", "Video"]
order: 1
---
```

`src/content/projects/nexplayer-sdk.md`:
```md
---
title: NexPlayer SDK
summary: Worked on the NexPlayer SDK team building a high-performance media playback SDK used by streaming apps.
tags: ["Android", "Media", "SDK"]
order: 2
---
```

`src/content/projects/this-site.md`:
```md
---
title: This Portfolio
summary: Personal portfolio rebuilt with Astro — static, fast, dark-mode, deployed on Netlify.
repo: https://github.com/hassanabidpk/hassan-portfolio-v2
tags: ["Astro", "TypeScript"]
order: 3
---
```

- [ ] **Step 4: Verify**

Run: `npx astro build`
Expected: build still succeeds (collections now have pages + projects).

- [ ] **Step 5: Commit**

```bash
git add src/content/pages src/content/projects
git commit -m "feat: migrate about/contact pages and seed projects"
```

---

### Task 7: Content schema sanity test

**Files:**
- Test: `tests/content.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/content.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const dir = 'src/content/posts';

describe('post frontmatter', () => {
  const files = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));

  it('has 7 posts', () => {
    expect(files.length).toBe(7);
  });

  it('every post has title, date, path frontmatter', () => {
    for (const f of files) {
      const src = readFileSync(`${dir}/${f}`, 'utf8');
      expect(src).toMatch(/^---/);
      expect(src).toMatch(/\ntitle:/);
      expect(src).toMatch(/\ndate:/);
      expect(src).toMatch(/\npath:\s*"\/posts\//);
    }
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/content.test.ts`
Expected: PASS — 2 tests. If "has 7 posts" fails, a migration file is missing/misnamed; fix Task 5.

- [ ] **Step 3: Commit**

```bash
git add tests/content.test.ts
git commit -m "test: assert migrated post frontmatter integrity"
```

---

## Phase 4 — Design system & layout

### Task 8: Design tokens & global styles

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`

- [ ] **Step 1: Write `src/styles/tokens.css`**

```css
:root {
  --accent: #3a78e7;
  --accent-contrast: #fff;
  --bg: #ffffff;
  --bg-soft: #f5f6f8;
  --fg: #1a1c1f;
  --fg-soft: #565b63;
  --border: #e3e6ea;
  --max-w: 46rem;
  --radius: 12px;
  --step--1: clamp(.83rem, .8rem + .2vw, .9rem);
  --step-0: clamp(1rem, .95rem + .25vw, 1.1rem);
  --step-1: clamp(1.3rem, 1.2rem + .6vw, 1.6rem);
  --step-2: clamp(1.8rem, 1.5rem + 1.4vw, 2.6rem);
  --step-3: clamp(2.4rem, 1.9rem + 2.6vw, 3.8rem);
}
:root[data-theme='dark'] {
  --accent: #6ea8ff;
  --accent-contrast: #0c0e12;
  --bg: #0c0e12;
  --bg-soft: #15181f;
  --fg: #e8eaed;
  --fg-soft: #9aa1ab;
  --border: #262b34;
}
```

- [ ] **Step 2: Write `src/styles/global.css`**

```css
@import '@fontsource-variable/inter';
@import './tokens.css';

* { box-sizing: border-box; margin: 0; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { animation: none !important; transition: none !important; }
}
body {
  background: var(--bg);
  color: var(--fg);
  font-family: 'Inter Variable', system-ui, sans-serif;
  font-size: var(--step-0);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; height: auto; border-radius: var(--radius); }
.wrap { max-width: var(--max-w); margin: 0 auto; padding: 0 1.25rem; }
.wrap-wide { max-width: 64rem; margin: 0 auto; padding: 0 1.25rem; }
h1 { font-size: var(--step-3); line-height: 1.1; letter-spacing: -.02em; }
h2 { font-size: var(--step-2); line-height: 1.2; margin-top: 2.5rem; }
h3 { font-size: var(--step-1); margin-top: 2rem; }
.fade-in { animation: fade .6s ease both; }
@keyframes fade { from { opacity: 0; transform: translateY(12px); } }
.embed { margin: 1.5rem 0; }
.prose > * + * { margin-top: 1.15rem; }
.prose pre { padding: 1rem; border-radius: var(--radius); overflow-x: auto; }
.prose code:not(pre code) {
  background: var(--bg-soft); padding: .15em .4em; border-radius: 6px;
  font-size: .9em;
}
.prose blockquote {
  border-left: 3px solid var(--accent); padding-left: 1rem;
  color: var(--fg-soft);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles
git commit -m "feat: add design tokens and global styles"
```

---

### Task 9: BaseHead (SEO) + Analytics components

**Files:**
- Create: `src/components/BaseHead.astro`, `src/components/Analytics.astro`

- [ ] **Step 1: Write `src/components/BaseHead.astro`**

```astro
---
import { site } from '../config';
interface Props { title?: string; description?: string; }
const { title, description = site.subtitle } = Astro.props;
const fullTitle = title ? `${title} — ${site.name}` : site.name;
const canonical = new URL(Astro.url.pathname, site.url).href;
---
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{fullTitle}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="sitemap" href="/sitemap-index.xml" />
<link rel="alternate" type="application/rss+xml" title={site.name} href="/rss.xml" />
```

- [ ] **Step 2: Write `src/components/Analytics.astro`**

```astro
---
import { site } from '../config';
const id = site.analyticsId;
---
{id && (
  <>
    <script is:inline async src={`https://www.googletagmanager.com/gtag/js?id=${id}`}></script>
    <script is:inline define:vars={{ id }}>
      window.dataLayer = window.dataLayer || [];
      function gtag(){ dataLayer.push(arguments); }
      gtag('js', new Date());
      gtag('config', id);
    </script>
  </>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BaseHead.astro src/components/Analytics.astro
git commit -m "feat: add SEO head and analytics components"
```

---

### Task 10: Theme toggle, header, footer, social links

**Files:**
- Create: `src/components/ThemeToggle.astro`, `src/components/SocialLinks.astro`, `src/components/Header.astro`, `src/components/Footer.astro`

- [ ] **Step 1: Write `src/components/ThemeToggle.astro`**

```astro
<button id="theme-toggle" aria-label="Toggle color theme" type="button">🌓</button>
<style>
  #theme-toggle {
    background: none; border: 1px solid var(--border); color: var(--fg);
    border-radius: 8px; padding: .35rem .55rem; cursor: pointer; font-size: 1rem;
  }
</style>
<script is:inline>
  const t = document.getElementById('theme-toggle');
  t.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
</script>
```

- [ ] **Step 2: Write `src/components/SocialLinks.astro`**

```astro
---
import { site } from '../config';
const items = [
  ['GitHub', site.socials.github],
  ['Twitter', site.socials.twitter],
  ['LinkedIn', site.socials.linkedin],
  ['Instagram', site.socials.instagram],
] as const;
---
<nav class="socials" aria-label="Social links">
  {items.map(([label, href]) => (
    <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
  ))}
</nav>
<style>
  .socials { display: flex; gap: 1rem; flex-wrap: wrap; font-size: var(--step--1); }
</style>
```

- [ ] **Step 3: Write `src/components/Header.astro`**

```astro
---
import { site } from '../config';
import ThemeToggle from './ThemeToggle.astro';
const path = Astro.url.pathname;
---
<header class="site-header">
  <div class="wrap-wide bar">
    <a href="/" class="brand">{site.name}</a>
    <nav aria-label="Primary">
      {site.menu.map((m) => (
        <a href={m.path} aria-current={path === m.path ? 'page' : undefined}>{m.label}</a>
      ))}
    </nav>
    <ThemeToggle />
  </div>
</header>
<style>
  .site-header { border-bottom: 1px solid var(--border); position: sticky; top: 0;
    background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); z-index: 10; }
  .bar { display: flex; align-items: center; gap: 1.25rem; padding-top: .9rem; padding-bottom: .9rem; }
  .brand { font-weight: 700; color: var(--fg); }
  nav { display: flex; gap: 1rem; margin-left: auto; font-size: var(--step--1); }
  nav a { color: var(--fg-soft); }
  nav a[aria-current='page'] { color: var(--accent); }
</style>
```

- [ ] **Step 4: Write `src/components/Footer.astro`**

```astro
---
import { site } from '../config';
import SocialLinks from './SocialLinks.astro';
---
<footer class="site-footer">
  <div class="wrap-wide">
    <SocialLinks />
    <p>{site.copyright} {site.name}</p>
  </div>
</footer>
<style>
  .site-footer { border-top: 1px solid var(--border); margin-top: 4rem; padding: 2.5rem 0; color: var(--fg-soft); font-size: var(--step--1); }
  .site-footer p { margin-top: 1rem; }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ThemeToggle.astro src/components/SocialLinks.astro src/components/Header.astro src/components/Footer.astro
git commit -m "feat: add header, footer, theme toggle, social links"
```

---

### Task 11: BaseLayout & PostLayout

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/layouts/PostLayout.astro`

- [ ] **Step 1: Write `src/layouts/BaseLayout.astro`** (includes no-flash theme script)

```astro
---
import BaseHead from '../components/BaseHead.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import Analytics from '../components/Analytics.astro';
import '../styles/global.css';
interface Props { title?: string; description?: string; wide?: boolean; }
const { title, description, wide = false } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <BaseHead title={title} description={description} />
    <script is:inline>
      const s = localStorage.getItem('theme');
      const d = s ? s === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light');
    </script>
    <Analytics />
  </head>
  <body>
    <Header />
    <main class={wide ? 'wrap-wide' : 'wrap'} style="padding-top:3rem">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Write `src/layouts/PostLayout.astro`**

```astro
---
import BaseLayout from './BaseLayout.astro';
interface Props {
  title: string; description?: string; date: Date; category: string;
}
const { title, description, date, category } = Astro.props;
const dt = new Date(date).toLocaleDateString('en-US',
  { year: 'numeric', month: 'long', day: 'numeric' });
---
<BaseLayout title={title} description={description}>
  <article class="prose fade-in">
    <p class="meta">{dt} · {category}</p>
    <h1>{title}</h1>
    <slot />
  </article>
  <style>
    .meta { color: var(--fg-soft); font-size: var(--step--1); }
    article > h1 { margin: .25rem 0 1.5rem; }
  </style>
</BaseLayout>
```

- [ ] **Step 3: Verify**

Run: `npx astro check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/layouts
git commit -m "feat: add base and post layouts with no-flash theming"
```

---

## Phase 5 — Pages & routes

### Task 12: Cards (Post, Project) + Hero

**Files:**
- Create: `src/components/PostCard.astro`, `src/components/ProjectCard.astro`, `src/components/Hero.astro`
- Create: `src/assets/profile.jpeg` (copied from `src/pages/hassan_github_photo.jpeg`)

- [ ] **Step 1: Copy profile image**

```bash
cp src/pages/hassan_github_photo.jpeg src/assets/profile.jpeg
```

- [ ] **Step 2: Write `src/components/PostCard.astro`**

```astro
---
import { urlFromPath } from '../lib/postPath';
interface Props {
  title: string; description: string; date: Date;
  category: string; path: string;
}
const { title, description, date, category, path } = Astro.props;
const href = urlFromPath(path);
const dt = new Date(date).toLocaleDateString('en-US',
  { year: 'numeric', month: 'short', day: 'numeric' });
---
<a class="card" href={href}>
  <p class="meta">{dt} · {category}</p>
  <h3>{title}</h3>
  {description && <p class="desc">{description}</p>}
</a>
<style>
  .card { display: block; padding: 1.25rem 0; border-bottom: 1px solid var(--border); color: var(--fg); }
  .card:hover { text-decoration: none; }
  .card:hover h3 { color: var(--accent); }
  .meta { color: var(--fg-soft); font-size: var(--step--1); }
  .desc { color: var(--fg-soft); margin-top: .35rem; }
  h3 { margin: .2rem 0 0; }
</style>
```

- [ ] **Step 3: Write `src/components/ProjectCard.astro`**

```astro
---
interface Props {
  title: string; summary: string; tags: string[];
  link?: string; repo?: string;
}
const { title, summary, tags, link, repo } = Astro.props;
---
<div class="proj">
  <h3>{title}</h3>
  <p>{summary}</p>
  <p class="tags">{tags.join(' · ')}</p>
  <p class="links">
    {link && <a href={link} target="_blank" rel="noopener noreferrer">Visit</a>}
    {repo && <a href={repo} target="_blank" rel="noopener noreferrer">Code</a>}
  </p>
</div>
<style>
  .proj { border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; background: var(--bg-soft); }
  .proj h3 { margin: 0 0 .5rem; }
  .tags { color: var(--fg-soft); font-size: var(--step--1); margin-top: .75rem; }
  .links { display: flex; gap: 1rem; margin-top: .75rem; font-size: var(--step--1); }
</style>
```

- [ ] **Step 4: Write `src/components/Hero.astro`**

```astro
---
import { Image } from 'astro:assets';
import { site } from '../config';
import SocialLinks from './SocialLinks.astro';
import profile from '../assets/profile.jpeg';
---
<section class="hero fade-in">
  <Image src={profile} alt={site.name} width={120} height={120} class="avatar" />
  <h1>{site.name}</h1>
  <p class="role">{site.role}</p>
  <SocialLinks />
  <p class="cta">
    <a href="/blog">Read the blog</a> ·
    <a href="/contact">Get in touch</a>
  </p>
</section>
<style>
  .hero { padding: 3rem 0 1rem; }
  .avatar { border-radius: 50%; }
  .role { color: var(--fg-soft); margin: .5rem 0 1.25rem; font-size: var(--step-1); }
  .cta { margin-top: 1.25rem; }
</style>
```

- [ ] **Step 5: Verify**

Run: `npx astro check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/PostCard.astro src/components/ProjectCard.astro src/components/Hero.astro src/assets/profile.jpeg
git commit -m "feat: add post/project cards and hero"
```

---

### Task 13: Home page

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Write `src/pages/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import PostCard from '../components/PostCard.astro';
import ProjectCard from '../components/ProjectCard.astro';

const posts = (await getCollection('posts', ({ data }) => !data.draft))
  .sort((a, b) => +new Date(b.data.date) - +new Date(a.data.date));
const latest = posts.slice(0, 4);
const projects = (await getCollection('projects'))
  .sort((a, b) => a.data.order - b.data.order);
---
<BaseLayout wide>
  <Hero />
  <section>
    <h2>Projects</h2>
    <div class="grid">
      {projects.map((p) => <ProjectCard {...p.data} />)}
    </div>
  </section>
  <section>
    <h2>Latest posts</h2>
    {latest.map((p) => <PostCard {...p.data} />)}
    <p style="margin-top:1.5rem"><a href="/blog">All posts →</a></p>
  </section>
  <style>
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); margin-top: 1rem; }
    section { margin-top: 3rem; }
  </style>
</BaseLayout>
```

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: `dist/index.html` generated, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add home page"
```

---

### Task 14: Blog index + post route

**Files:**
- Create: `src/pages/blog.astro`, `src/pages/posts/[...slug].astro`

- [ ] **Step 1: Write `src/pages/blog.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import PostCard from '../components/PostCard.astro';
const posts = (await getCollection('posts', ({ data }) => !data.draft))
  .sort((a, b) => +new Date(b.data.date) - +new Date(a.data.date));
---
<BaseLayout title="Blog">
  <h1>Talks &amp; Writing</h1>
  <div style="margin-top:1.5rem">
    {posts.map((p) => <PostCard {...p.data} />)}
  </div>
</BaseLayout>
```

- [ ] **Step 2: Write `src/pages/posts/[...slug].astro`** (path-preserving via `slugFromPath`)

```astro
---
import { getCollection, render } from 'astro:content';
import PostLayout from '../../layouts/PostLayout.astro';
import { slugFromPath } from '../../lib/postPath';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: slugFromPath(post.data.path) },
    props: { post },
  }));
}
const { post } = Astro.props;
const { Content } = await render(post);
---
<PostLayout
  title={post.data.title}
  description={post.data.description}
  date={post.data.date}
  category={post.data.category}
>
  <Content />
</PostLayout>
```

- [ ] **Step 3: Verify URL preservation**

Run: `npx astro build`
Expected: build succeeds; these dirs exist with `index.html`:
`dist/posts/app-kotlin-coroutines/`, `dist/posts/android-101/`,
`dist/posts/exploring-camerax-jetpack/`,
`dist/posts/exploring-camerax-from-jetpack/`,
`dist/posts/whats-new-in-android-jetpack/`,
`dist/posts/kotlin-for-android-devs/`,
`dist/posts/google-startup-jam-2019/`.
Verify: `ls dist/posts` lists exactly 7 directories.

- [ ] **Step 4: Commit**

```bash
git add src/pages/blog.astro src/pages/posts
git commit -m "feat: add blog index and path-preserving post route"
```

---

### Task 15: About & Contact pages

**Files:**
- Create: `src/pages/about.astro`, `src/pages/contact.astro`

- [ ] **Step 1: Write `src/pages/about.astro`**

```astro
---
import { getEntry, render } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
const entry = await getEntry('pages', 'about');
const { Content } = await render(entry);
---
<BaseLayout title={entry.data.title}>
  <article class="prose fade-in">
    <h1>{entry.data.title}</h1>
    <Content />
  </article>
</BaseLayout>
```

- [ ] **Step 2: Write `src/pages/contact.astro`** (identical shape, `'contact'`)

```astro
---
import { getEntry, render } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
const entry = await getEntry('pages', 'contact');
const { Content } = await render(entry);
---
<BaseLayout title={entry.data.title}>
  <article class="prose fade-in">
    <h1>{entry.data.title}</h1>
    <Content />
  </article>
</BaseLayout>
```

- [ ] **Step 3: Verify**

Run: `npx astro build`
Expected: `dist/about/index.html` and `dist/contact/index.html` exist; migrated images resolved (no broken-image build warnings).

- [ ] **Step 4: Commit**

```bash
git add src/pages/about.astro src/pages/contact.astro
git commit -m "feat: add about and contact pages"
```

---

### Task 16: Tags & Categories

**Files:**
- Create: `src/pages/tags/index.astro`, `src/pages/tags/[tag].astro`, `src/pages/categories/index.astro`, `src/pages/categories/[category].astro`

- [ ] **Step 1: Write `src/pages/tags/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
const posts = await getCollection('posts', ({ data }) => !data.draft);
const tags = [...new Set(posts.flatMap((p) => p.data.tags))].sort();
---
<BaseLayout title="Tags">
  <h1>Tags</h1>
  <ul class="tag-list">
    {tags.map((t) => <li><a href={`/tags/${t}/`}>{t}</a></li>)}
  </ul>
  <style>
    .tag-list { display: flex; flex-wrap: wrap; gap: .75rem; list-style: none; padding: 0; margin-top: 1.5rem; }
    .tag-list a { border: 1px solid var(--border); padding: .35rem .75rem; border-radius: 999px; }
  </style>
</BaseLayout>
```

- [ ] **Step 2: Write `src/pages/tags/[tag].astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostCard from '../../components/PostCard.astro';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const tags = [...new Set(posts.flatMap((p) => p.data.tags))];
  return tags.map((tag) => ({
    params: { tag },
    props: { posts: posts.filter((p) => p.data.tags.includes(tag)) },
  }));
}
const { tag } = Astro.params;
const { posts } = Astro.props;
---
<BaseLayout title={`Tag: ${tag}`}>
  <h1>#{tag}</h1>
  <div style="margin-top:1.5rem">
    {posts.map((p) => <PostCard {...p.data} />)}
  </div>
</BaseLayout>
```

- [ ] **Step 3: Write `src/pages/categories/index.astro`** (same as tags index, swap `tags`→`category`, single value per post)

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
const posts = await getCollection('posts', ({ data }) => !data.draft);
const cats = [...new Set(posts.map((p) => p.data.category))].sort();
---
<BaseLayout title="Categories">
  <h1>Categories</h1>
  <ul class="tag-list">
    {cats.map((c) => <li><a href={`/categories/${c}/`}>{c}</a></li>)}
  </ul>
  <style>
    .tag-list { display: flex; flex-wrap: wrap; gap: .75rem; list-style: none; padding: 0; margin-top: 1.5rem; }
    .tag-list a { border: 1px solid var(--border); padding: .35rem .75rem; border-radius: 999px; }
  </style>
</BaseLayout>
```

- [ ] **Step 4: Write `src/pages/categories/[category].astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostCard from '../../components/PostCard.astro';

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const cats = [...new Set(posts.map((p) => p.data.category))];
  return cats.map((category) => ({
    params: { category },
    props: { posts: posts.filter((p) => p.data.category === category) },
  }));
}
const { category } = Astro.params;
const { posts } = Astro.props;
---
<BaseLayout title={`Category: ${category}`}>
  <h1>{category}</h1>
  <div style="margin-top:1.5rem">
    {posts.map((p) => <PostCard {...p.data} />)}
  </div>
</BaseLayout>
```

- [ ] **Step 5: Verify**

Run: `npx astro build`
Expected: `dist/tags/index.html`, `dist/categories/index.html`, plus per-tag and per-category dirs exist; no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/tags src/pages/categories
git commit -m "feat: add tags and categories pages"
```

---

### Task 17: 404, RSS, robots

**Files:**
- Create: `src/pages/404.astro`, `src/pages/rss.xml.js`, `public/robots.txt`

- [ ] **Step 1: Write `src/pages/404.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Page not found">
  <h1>404</h1>
  <p>That page doesn’t exist. <a href="/">Go home</a> or
  <a href="/blog">browse the blog</a>.</p>
</BaseLayout>
```

- [ ] **Step 2: Write `src/pages/rss.xml.js`** (feed parity)

```js
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../config';
import { urlFromPath } from '../lib/postPath';

export async function GET(context) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => +new Date(b.data.date) - +new Date(a.data.date));
  return rss({
    title: site.name,
    description: site.subtitle,
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: new Date(p.data.date),
      link: urlFromPath(p.data.path),
    })),
  });
}
```

- [ ] **Step 3: Write `public/robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://hassanabid.netlify.app/sitemap-index.xml
```

- [ ] **Step 4: Verify**

Run: `npx astro build`
Expected: `dist/404.html`, `dist/rss.xml`, `dist/robots.txt`, `dist/sitemap-index.xml` all present.

- [ ] **Step 5: Commit**

```bash
git add src/pages/404.astro src/pages/rss.xml.js public/robots.txt
git commit -m "feat: add 404, RSS feed, robots.txt"
```

---

## Phase 6 — Deploy config & cleanup

### Task 18: Netlify config + redirects

**Files:**
- Rewrite: `netlify.toml`
- Create: `public/_redirects`

- [ ] **Step 1: Rewrite `netlify.toml`**

```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "20"
```

- [ ] **Step 2: Write `public/_redirects`**

All post URLs are preserved by `slugFromPath`, so only legacy non-post
routes need mapping. The old site used `/about/` and `/contact/`
(trailing slash) and a tag/category index; Astro emits the same paths.
No URL drift is expected, so this file only future-proofs the apex:

```
/index.html    /    301
```

- [ ] **Step 3: Verify**

Run: `npx astro build && test -d dist && echo OK`
Expected: prints `OK`.

- [ ] **Step 4: Commit**

```bash
git add netlify.toml public/_redirects
git commit -m "chore: configure Netlify for Astro static deploy"
```

---

### Task 19: Remove dead Gatsby tree

**Files:**
- Delete: `gatsby-config.js`, `gatsby-node.js`, `.browserslistrc`, `travis.yml`, `.codeclimate.yml`, `src/templates/`, `src/components/` (old jsx), `src/assets/scss/`, `src/assets/fonts/`, `src/pages/articles/`, `src/pages/pages/`, `src/pages/index.jsx`, `src/pages/tags.jsx`, `src/pages/categories.jsx`, `src/pages/404.jsx`, `src/pages/photo.jpg`, `src/pages/hassan_github_photo.jpeg`, old `yarn.lock`

- [ ] **Step 1: Delete Gatsby/source artifacts**

```bash
git rm -r --quiet gatsby-config.js gatsby-node.js .browserslistrc travis.yml .codeclimate.yml \
  src/templates src/assets/scss src/assets/fonts \
  src/pages/articles src/pages/pages \
  src/pages/index.jsx src/pages/tags.jsx src/pages/categories.jsx src/pages/404.jsx \
  src/pages/photo.jpg src/pages/hassan_github_photo.jpeg yarn.lock
git rm -r --quiet src/components/Sidebar src/components/Post src/components/Layout \
  src/components/CategoryTemplateDetails src/components/PostTemplateDetails \
  src/components/Links src/components/Menu src/components/Disqus \
  src/components/TagTemplateDetails src/components/PageTemplateDetails
```

- [ ] **Step 2: Full verification**

Run: `npm run check && npm test && npm run build`
Expected: `astro check` 0 errors; vitest all green (postPath 5 + content 2); `astro build` succeeds. Confirm `dist/posts` still has exactly 7 directories: `ls dist/posts | wc -l` → `7`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove dead Gatsby v2 source tree"
```

---

### Task 20: Manual walkthrough & README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run dev server and walk the site**

Run: `npm run dev` then visit and confirm each renders correctly:
- `/` — hero, projects grid, latest posts
- `/blog` — all 7 posts listed
- `/posts/app-kotlin-coroutines/` — speakerdeck embed + local image render
- `/posts/android-101/` — slideshare iframe renders
- `/posts/google-startup-jam-2019/` — remote image renders
- `/about`, `/contact` — text + migrated local images render
- `/tags`, `/categories` and one of each detail page
- toggle dark mode; reload — preference persists, no flash
- visit a bad URL — branded `/404`

Note any failure, fix, re-verify before continuing.

- [ ] **Step 2: Rewrite `README.md`** to reflect Astro

```md
# Hassan Abid — Portfolio

Personal portfolio & blog. Built with [Astro](https://astro.build),
deployed on Netlify.

## Develop

```bash
nvm use        # Node 20
npm install
npm run dev
```

## Scripts

- `npm run dev` — local dev server
- `npm run build` — static build to `dist/`
- `npm run check` — TypeScript/Astro diagnostics
- `npm test` — unit tests (Vitest)

## Content

Posts live in `src/content/posts/` (`.md`/`.mdx`). Each post's public URL
is derived from its `path` frontmatter to keep legacy `/posts/...` URLs
stable. Pages in `src/content/pages/`, projects in `src/content/projects/`.
Site metadata in `src/config.ts`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for Astro stack"
```

---

## Self-Review

**Spec coverage:**
- Stack = Astro → Tasks 1–4. ✓
- Content collections + Zod schema mirroring frontmatter → Task 4. ✓
- URL preservation via path frontmatter → Task 3 (tested) + Task 14. ✓
- All 7 posts + about/contact kept → Tasks 5–6; integrity test Task 7. ✓
- Projects section (seeded, editable) → Task 6 + Task 13. ✓
- Modern-minimal visual, light/dark, no-flash, reduced-motion → Tasks 8, 10, 11. ✓
- Hero re-homes sidebar identity; sidebar retired → Task 12 + Task 19. ✓
- Self-hosted Inter, google-fonts dropped → Task 8. ✓
- Routes (home/blog/post/about/contact/tags/categories/404/rss/robots/sitemap) → Tasks 13–17. ✓
- SEO/OG/canonical → Task 9. ✓
- Analytics replacement, configurable, dead UA not shipped → Tasks 2, 9. ✓
- Netlify static config, Node 20 pin, drop yarn flags → Task 18. ✓
- `_redirects` for drift → Task 18. ✓
- Dead tree removed → Task 19. ✓
- Verification (check/build/manual/Lighthouse) → Tasks 19–20.
- Embeds preserved via MDX components → Task 5.

**Placeholder scan:** No TBD/TODO. Migration content shown with concrete frontmatter; bodies reference the verified source files by exact path. The 3 plain-`.md` post bodies are described as "copy original body verbatim" with a fully-shown example — acceptable since the source is in-repo and exact.

**Type consistency:** `slugFromPath`/`urlFromPath` signatures consistent across Tasks 3, 12, 14, 17. `site` config shape consistent across Tasks 2, 9, 10, 12, 17. Collection names `posts`/`pages`/`projects` consistent Tasks 4–17. `PostCard` props (`title,description,date,category,path`) match the schema and all call sites.

**Note:** Lighthouse spot-check from the spec is folded into Task 20's manual walkthrough rather than a separate automated gate (static site; no CI Lighthouse configured) — honest scoping, called out here.
