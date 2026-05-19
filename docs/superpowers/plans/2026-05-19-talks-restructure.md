# Talks Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe the site around Talks: a two-section `/talks` page (Talks + Mentoring & Workshops) where written-up entries link to their `/posts/<slug>/` detail pages; remove `/blog` and the home Projects/Latest-posts sections; delete the resulting dead code; and kill the stale Gatsby service worker that serves the old site to returning visitors.

**Architecture:** `src/data/talks.json` (35 talks) gains an optional `post` URL on the 6 entries that have a markdown write-up; a new `src/data/mentoring.json` holds the Mentoring & Workshops list (1 seeded item). `src/lib/talks.ts` exports `talks` + `mentoring`. `/talks` renders two sections via `TalkCard` (now link-aware). Posts and `/posts/[...slug].astro` are unchanged (the detail pages). A self-destroying `public/sw.js` + an inline unregister script in `BaseLayout` remove the dead `gatsby-plugin-offline` worker.

**Tech Stack:** Astro 5, TypeScript, Vitest, plain JSON data modules, Netlify `_redirects`.

**Testing note:** Real logic = the data↔post-file link integrity and the data loader; those get genuine Vitest tests (TDD). UI/route changes are gated by `astro check` + `astro build` + asserting built `dist/` HTML. Every task states exact commands and expected output.

---

## File Structure

Modified:
- `src/data/talks.json` — add `"post"` to 6 entries
- `src/lib/talks.ts` — `Talk.post?`, `MentoringItem`, `mentoring` export
- `src/components/TalkCard.astro` — optional `post` → linked title/image
- `src/pages/talks.astro` — two sections
- `src/pages/index.astro` — drop Projects + Latest posts
- `src/config.ts` — menu drops Blog
- `src/content.config.ts` — drop `projects` collection
- `public/_redirects` — add `/blog` → `/talks`
- `src/layouts/BaseLayout.astro` — inline SW-unregister script

Created:
- `src/data/mentoring.json`
- `public/sw.js`
- `tests/talksData.test.ts`

Deleted:
- `src/pages/blog.astro`
- `src/components/ProjectCard.astro`
- `src/content/projects/` (kinemaster.md, nexplayer-sdk.md, this-site.md)

---

## Phase 1 — Data

### Task 1: Add `post` to talks.json + create mentoring.json

**Files:**
- Modify: `src/data/talks.json`
- Create: `src/data/mentoring.json`

- [ ] **Step 1: Add `post` to exactly the 6 written-up talks**

In `src/data/talks.json`, to each talk object whose `date` matches below, add a `"post"` string field (place it after the `image` field; valid JSON, keep all other fields unchanged):

| date | title (verify) | add |
|---|---|---|
| `2019-11-16` | Improving app performance with Kotlin Coroutines [DevFest Cebu] | `"post": "/posts/app-kotlin-coroutines/"` |
| `2019-09-07` | Android 101 | `"post": "/posts/android-101/"` |
| `2019-07-21` | CameraX JetPack - Android Developers Day 2019 | `"post": "/posts/exploring-camerax-from-jetpack/"` |
| `2019-07-14` | Exploring CameraX Jetpack Library | `"post": "/posts/exploring-camerax-jetpack/"` |
| `2019-06-16` | What's new in Android JetPack | `"post": "/posts/whats-new-in-android-jetpack/"` |
| `2019-03-25` | Modern Android Development with Kotlin | `"post": "/posts/kotlin-for-android-devs/"` |

Do NOT add `post` to any other entry. Match by `date` (each is unique); the title column is only to sanity-check you edited the right object.

- [ ] **Step 2: Create `src/data/mentoring.json` exactly**

```json
{
  "source": "Advocu — Google Developer Experts (Mentoring & Workshops)",
  "fetchedOn": "2026-05-19",
  "count": 1,
  "items": [
    {
      "title": "Mentoring at Google Startup Jam 2019 - Singapore",
      "date": "2019-08-31",
      "location": "Singapore",
      "summary": "Mentored early stage startups at Google Startup Jam organized by Google Business Group Singapore.",
      "tags": ["GDE", "Mentoring"],
      "post": "/posts/google-startup-jam-2019/"
    }
  ]
}
```

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; t=json.load(open('src/data/talks.json')); m=json.load(open('src/data/mentoring.json')); n=sum(1 for x in t['talks'] if 'post' in x); print('talks with post:', n); print('mentoring items:', len(m['items'])); assert n==6, n; assert len(m['items'])==1; print('OK')"`
Expected: `talks with post: 6` / `mentoring items: 1` / `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/data/talks.json src/data/mentoring.json
git commit -m "feat: link 6 talks to write-up posts; add mentoring data"
```

---

## Phase 2 — Loader & link-integrity (TDD)

### Task 2: Extend talks.ts (Talk.post, MentoringItem, mentoring)

**Files:**
- Modify: `src/lib/talks.ts`

- [ ] **Step 1: Rewrite `src/lib/talks.ts` exactly**

```ts
import talksData from '../data/talks.json';
import mentoringData from '../data/mentoring.json';

export interface Talk {
  title: string;
  date: string;
  attendees: number;
  location: string | null;
  summary: string;
  tags: string[];
  image: string | null;
  post?: string;
}

export interface MentoringItem {
  title: string;
  date: string;
  location: string | null;
  summary: string;
  tags: string[];
  post: string | null;
}

const byDateDesc = (a: { date: string }, b: { date: string }) =>
  +new Date(b.date) - +new Date(a.date);

export const talks: Talk[] = [...(talksData.talks as Talk[])].sort(byDateDesc);

export const mentoring: MentoringItem[] = [
  ...(mentoringData.items as MentoringItem[]),
].sort(byDateDesc);

export const totalTalks = talks.length;
export const totalAttendees = talks.reduce((n, t) => n + t.attendees, 0);
```

- [ ] **Step 2: Verify types**

Run: `npx astro check`
Expected: 0 errors. (`resolveJsonModule` is on via astro strict tsconfig; importing the second JSON must not error.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/talks.ts
git commit -m "feat: talks loader exports mentoring + optional post"
```

---

### Task 3: Link-integrity test (every post URL resolves)

**Files:**
- Create: `tests/talksData.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/talksData.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { talks, mentoring } from '../src/lib/talks';

function postFileExists(url: string): boolean {
  const slug = url.replace(/^\/posts\//, '').replace(/\/$/, '');
  return (
    existsSync(`src/content/posts/${slug}.md`) ||
    existsSync(`src/content/posts/${slug}.mdx`)
  );
}

describe('talks data', () => {
  it('exactly 6 talks have a post link', () => {
    expect(talks.filter((t) => t.post).length).toBe(6);
  });

  it('every talk post URL resolves to an existing post file', () => {
    for (const t of talks) {
      if (t.post) expect(postFileExists(t.post), t.post).toBe(true);
    }
  });

  it('mentoring has >=1 item, all with a resolvable post', () => {
    expect(mentoring.length).toBeGreaterThanOrEqual(1);
    for (const m of mentoring) {
      expect(m.post).toBeTruthy();
      expect(postFileExists(m.post!), m.post!).toBe(true);
    }
  });

  it('talks remain sorted newest-first', () => {
    for (let i = 1; i < talks.length; i++) {
      expect(+new Date(talks[i - 1].date)).toBeGreaterThanOrEqual(
        +new Date(talks[i].date)
      );
    }
  });
});
```

- [ ] **Step 2: Run — verify it PASSES** (data + loader already exist from Tasks 1–2)

Run: `npx vitest run tests/talksData.test.ts`
Expected: PASS — 4 tests. If "exactly 6" or a resolve check fails, the bug is in Task 1 data (wrong/missing `post` or typo'd slug) — fix the JSON, not the test.

- [ ] **Step 3: Full suite still green**

Run: `npx vitest run`
Expected: postPath (4) + content (2) + talksData (4) = 10 passing.

- [ ] **Step 4: Commit**

```bash
git add tests/talksData.test.ts
git commit -m "test: assert talks/mentoring post links resolve"
```

---

## Phase 3 — UI

### Task 4: TalkCard — optional post link

**Files:**
- Modify: `src/components/TalkCard.astro`

- [ ] **Step 1: Rewrite `src/components/TalkCard.astro` exactly**

```astro
---
import type { Talk } from '../lib/talks';
interface Props {
  title: string;
  date: string;
  attendees?: number;
  location: string | null;
  summary: string;
  tags: string[];
  image?: string | null;
  post?: string | null;
}
const { title, date, attendees, location, summary, tags, image, post } =
  Astro.props;
const dt = new Date(date).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'short',
});
const meta = [
  dt,
  attendees != null ? `${attendees} attendees` : null,
  location,
]
  .filter(Boolean)
  .join(' · ');
---
<div class="talk">
  {image && (
    post ? (
      <a href={post} aria-label={title}>
        <img class="shot" src={image} alt={title} loading="lazy" decoding="async" />
      </a>
    ) : (
      <img class="shot" src={image} alt={title} loading="lazy" decoding="async" />
    )
  )}
  <div>
    <p class="meta">{meta}</p>
    <h3>{post ? <a href={post}>{title}</a> : title}</h3>
    <p class="desc">{summary}</p>
    <p class="tags">{tags.join(' · ')}</p>
  </div>
</div>
<style>
  .talk { display: grid; grid-template-columns: 200px 1fr; gap: 1.25rem;
    padding: 1.25rem 0; border-bottom: 1px solid var(--border); }
  .talk:has(.shot) { align-items: start; }
  .talk:not(:has(.shot)) { grid-template-columns: 1fr; }
  .shot { width: 200px; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius); }
  .meta { color: var(--fg-soft); font-size: var(--step--1); }
  h3 { margin: .25rem 0 .35rem; }
  h3 a { color: var(--fg); }
  h3 a:hover { color: var(--accent); }
  .desc { color: var(--fg-soft); }
  .tags { color: var(--fg-soft); font-size: var(--step--1); margin-top: .5rem; }
  @media (max-width: 640px) { .talk { grid-template-columns: 1fr; } .shot { width: 100%; } }
</style>
```

Notes: `attendees` and `image` are now optional so mentoring items (no
attendees, no image) render cleanly; `meta` is composed from present
fields only (talks keep "date · N attendees · location"; mentoring shows
"date · location").

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TalkCard.astro
git commit -m "feat: TalkCard links to write-up post when present"
```

---

### Task 5: Talks page — two sections

**Files:**
- Modify: `src/pages/talks.astro`

- [ ] **Step 1: Rewrite `src/pages/talks.astro` exactly**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import TalkCard from '../components/TalkCard.astro';
import { talks, mentoring, totalTalks, totalAttendees } from '../lib/talks';
---
<BaseLayout title="Talks" description={`${totalTalks} talks as a Google Developers Expert for Android`}>
  <h1>Talks</h1>
  <p style="color:var(--fg-soft);margin-top:.5rem">
    {totalTalks} talks · {totalAttendees.toLocaleString()}+ attendees ·
    Google Developers Expert for Android
  </p>
  <div style="margin-top:1.5rem">
    {talks.map((t) => <TalkCard {...t} />)}
  </div>

  <h2 style="margin-top:3rem">Mentoring &amp; Workshops</h2>
  <div style="margin-top:1.5rem">
    {mentoring.map((m) => <TalkCard {...m} />)}
  </div>
</BaseLayout>
```

- [ ] **Step 2: Verify build + content**

Run: `npx astro build`
Expected: exit 0. Then:
`grep -c 'class="talk"' dist/talks/index.html` → `36` (35 talks + 1 mentoring).
`grep -o 'Mentoring &amp; Workshops' dist/talks/index.html` → one match.
`grep -c 'href="/posts/' dist/talks/index.html` → at least 7 (6 talk links + 1 mentoring; more if image links double them — ≥7 is the bar).

- [ ] **Step 3: Commit**

```bash
git add src/pages/talks.astro
git commit -m "feat: talks page adds Mentoring & Workshops section"
```

---

### Task 6: Home page — drop Projects + Latest posts

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Rewrite `src/pages/index.astro` exactly**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import { talks } from '../lib/talks';

const recentTalks = talks.slice(0, 5);
---
<BaseLayout wide>
  <Hero />
  <section>
    <h2>Recent talks</h2>
    {recentTalks.map((t) => (
      <p style="padding:.6rem 0;border-bottom:1px solid var(--border)">
        <strong>{t.title}</strong><br />
        <span style="color:var(--fg-soft);font-size:var(--step--1)">
          {new Date(t.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
          {t.location ? ` · ${t.location}` : ''}
        </span>
      </p>
    ))}
    <p style="margin-top:1.5rem"><a href="/talks">All talks →</a></p>
  </section>
  <style>
    section { margin-top: 3rem; }
  </style>
</BaseLayout>
```

(Removed: `getCollection`, `PostCard`, `ProjectCard` imports; `posts`,
`latest`, `projects`; the Projects and Latest-posts sections; the `.grid`
style. Kept Hero + Recent talks only.)

- [ ] **Step 2: Verify**

Run: `npx astro build`
Expected: exit 0. Then:
`grep -c 'Projects\|Latest posts' dist/index.html` → `0`.
`grep -c 'Recent talks' dist/index.html` → `1`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: home shows hero + recent talks only (drop projects/posts)"
```

---

## Phase 4 — Nav, redirects, dead code, service worker

### Task 7: Nav menu + /blog redirect

**Files:**
- Modify: `src/config.ts`, `public/_redirects`

- [ ] **Step 1: Edit `src/config.ts` menu** — remove the Blog entry so it reads exactly:

```ts
  menu: [
    { label: 'Home', path: '/' },
    { label: 'Talks', path: '/talks' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ],
```

(Change ONLY the menu array; leave every other field in `site` intact.)

- [ ] **Step 2: Rewrite `public/_redirects` exactly**

```
/blog/*    /talks    301
/blog    /talks    301
/index.html    /    301
```

- [ ] **Step 3: Commit**

```bash
git add src/config.ts public/_redirects
git commit -m "feat: drop Blog from nav; redirect /blog to /talks"
```

---

### Task 8: Remove dead code (blog page, projects)

**Files:**
- Delete: `src/pages/blog.astro`, `src/components/ProjectCard.astro`, `src/content/projects/kinemaster.md`, `src/content/projects/nexplayer-sdk.md`, `src/content/projects/this-site.md`
- Modify: `src/content.config.ts`

- [ ] **Step 1: Delete the now-unreferenced files**

```bash
git rm src/pages/blog.astro src/components/ProjectCard.astro \
  src/content/projects/kinemaster.md src/content/projects/nexplayer-sdk.md \
  src/content/projects/this-site.md
```
(If `src/content/projects/` is now empty, that's fine — git won't track it.)

- [ ] **Step 2: Drop the `projects` collection from `src/content.config.ts`**

Remove the entire `const projects = defineCollection({ ... });` block, and change the final export to:
```ts
export const collections = { posts, pages };
```
Leave `posts` and `pages` collections unchanged.

- [ ] **Step 3: Verify nothing else references the deleted units**

Run: `grep -rn "ProjectCard\|getCollection('projects')\|src/content/projects\|/blog\b" src/ ; echo "exit:$?"`
Expected: no source matches (grep exit 1 / "exit:1"). Only `_redirects` (not under src/) references `/blog` — that's intended.

- [ ] **Step 4: Full gate**

Run: `npm run check && npx vitest run && npm run build`
Expected: `astro check` 0 errors; vitest 10 passing; build exit 0. `ls dist/blog 2>/dev/null; echo gone` → `gone` (no blog page generated). `ls dist/posts | wc -l` → `7` (unchanged).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead blog page and projects code"
```

---

### Task 9: Kill the stale Gatsby service worker

**Files:**
- Create: `public/sw.js`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Create `public/sw.js` exactly** (self-destroying worker at the path the old `gatsby-plugin-offline` worker occupied)

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
```

- [ ] **Step 2: Add an inline unregister script to `src/layouts/BaseLayout.astro`**

In `src/layouts/BaseLayout.astro`, immediately AFTER the existing
`<script is:inline>` theme block (the one ending
`...setAttribute('data-theme', d ? 'dark' : 'light'); </script>`) and
BEFORE `<Analytics />`, insert:

```astro
    <script is:inline>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then((rs) => rs.forEach((r) => r.unregister()))
          .catch(() => {});
        if (window.caches) {
          caches.keys()
            .then((ks) => ks.forEach((k) => caches.delete(k)))
            .catch(() => {});
        }
      }
    </script>
```

Change nothing else in BaseLayout.

- [ ] **Step 3: Verify**

Run: `npx astro build`
Expected: exit 0. Then:
`cat dist/sw.js | grep -c 'registration.unregister'` → `1` (the stub shipped at /sw.js).
`grep -c "serviceWorker' in navigator" dist/index.html` → `1` (inline unregister present on pages).

- [ ] **Step 4: Commit**

```bash
git add public/sw.js src/layouts/BaseLayout.astro
git commit -m "fix: self-destroy stale gatsby-plugin-offline service worker"
```

---

## Phase 5 — Verification

### Task 10: Full verification + manual walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Full gate**

Run: `npm run check && npx vitest run && npm run build`
Expected: `astro check` 0 errors / 0 warnings; vitest 10 passing (postPath 4, content 2, talksData 4); build exit 0.

- [ ] **Step 2: Built-output assertions**

Run each; all must hold:
- `grep -c 'class="talk"' dist/talks/index.html` → `36`
- `grep -c 'Mentoring &amp; Workshops' dist/talks/index.html` → `1`
- `grep -c 'href="/posts/' dist/talks/index.html` → ≥ `7`
- `grep -c 'Projects\|Latest posts' dist/index.html` → `0`
- `grep -c 'Recent talks' dist/index.html` → `1`
- `grep -c '>Blog<' dist/index.html` → `0` (Blog removed from nav)
- `ls dist/posts | wc -l` → `7`
- `ls dist/blog 2>/dev/null || echo gone` → `gone`
- `grep -c 'registration.unregister' dist/sw.js` → `1`
- `grep -c "serviceWorker' in navigator" dist/about/index.html` → `1`
- `grep -E '/blog' dist/_redirects` → shows the two `/blog` rules

If any fail, fix the owning task before continuing.

- [ ] **Step 3: Manual spot-check (dev server)**

Run `npm run dev`; confirm:
- `/talks` — "Talks" section (35 cards) then "Mentoring & Workshops" (1 card); the 6 talk cards + the mentoring card are clickable to `/posts/...`; non-write-up talks are plain.
- `/posts/app-kotlin-coroutines/` (and one slideshare post) still render with embeds/images.
- `/` — hero + Recent talks only; no Projects, no Latest posts.
- nav shows Home / Talks / About / Contact (no Blog); visiting `/blog` redirects to `/talks` (note: redirect is Netlify-side; locally `/blog` will 404 — that's expected, verify the rule exists in `dist/_redirects`).
- DevTools → Application → Service Workers: loading any page unregisters existing workers (no active SW remains).

- [ ] **Step 4: Commit (if any fix-ups were needed; otherwise skip)**

```bash
git add -A && git commit -m "chore: talks-restructure verification fixups"
```

---

## Self-Review

**Spec coverage:**
- Two-section `/talks` (Talks + Mentoring & Workshops) → Tasks 4–5. ✓
- `post` on 6 talks + mentoring.json → Task 1; loader → Task 2; link integrity test → Task 3. ✓
- Posts/`[...slug]` unchanged as detail pages → untouched (no task needed). ✓
- `/blog` removed + redirect + nav drop → Tasks 7–8. ✓
- Home = Hero + Recent talks only → Task 6. ✓
- Dead-code removal (blog.astro, ProjectCard, projects content+collection) → Task 8. ✓
- Service-worker kill (public/sw.js + inline unregister) → Task 9. ✓
- Testing (link integrity vitest, check/build, dist assertions, manual) → Tasks 3, 8, 10. ✓
- Tags/Categories untouched (out of scope) → not modified. ✓

**Placeholder scan:** none. All code blocks complete; data mapping is an explicit date table; deletions enumerated.

**Type consistency:** `Talk.post?: string` (Task 2) ↔ TalkCard `post?: string | null` prop (Task 4) — compatible (optional, nullable accepted; talks pass `string|undefined`, mentoring passes `string|null`). `MentoringItem` has no `attendees`/`image`; TalkCard makes both optional so `{...m}` spread is valid. `mentoring`/`talks` exports (Task 2) match `talks.astro` import (Task 5) and `index.astro` import (Task 6). `collections = { posts, pages }` (Task 8) — no remaining `projects` consumer after Task 6/8.

**Note:** local `npm run dev` makes `/blog` 404 (redirects are Netlify-runtime via `_redirects`); the plan verifies the rule is in `dist/_redirects` rather than expecting a local redirect — called out in Task 10.
