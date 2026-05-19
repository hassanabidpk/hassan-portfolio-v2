# Talks Restructure — Design Spec

Date: 2026-05-19
Status: Approved (design), pending implementation plan
Builds on: 2026-05-19-portfolio-uplift (Astro 5 migration, already shipped)

## Summary

Reframe the site around **Talks** instead of a Blog. The 7 legacy markdown
posts are actually talk write-ups (6 talks + 1 mentoring). Merge them into
the Talks experience: `/talks` becomes a two-section page (**Talks** and
**Mentoring & Workshops**), where entries that have a rich write-up link to
their existing `/posts/<slug>/` detail page. Remove `/blog`, remove the
Projects and Latest-posts sections from the home page, delete the resulting
dead code, and kill the stale Gatsby `gatsby-plugin-offline` service worker
that still serves the old site to returning visitors.

## Goals

- One `/talks` page with two categories: **Talks** (35) and
  **Mentoring & Workshops** (1, structured to grow).
- Talks/mentoring entries with a write-up link to their rich
  `/posts/<slug>/` page; legacy `/posts/...` URLs preserved.
- `/blog` gone (redirects to `/talks`); "Blog" removed from nav.
- Home = Hero + "Recent talks" teaser only (no Projects, no Latest posts).
- Returning visitors stop seeing the old cached Gatsby site.
- No orphaned dead code left behind.

## Non-Goals (YAGNI)

- Re-scraping Advocu Workshop/Mentoring activities (deferred; the category
  is populated only with the one existing mentoring post for now).
- Changing canonical domain (`site` → `www.hassanabid.dev`) — separate,
  pending the user's DNS/SSL fix.
- Removing the Tags/Categories pages — still valid, driven by post
  frontmatter, not in nav; out of scope.

## Data Model

`src/data/talks.json` (existing, 35 entries) — unchanged shape, with one
new **optional** field added only to the 6 entries that have a write-up:

- `post` (string, optional): the canonical post URL, e.g.
  `"/posts/android-101/"`.

New `src/data/mentoring.json` — same envelope as talks.json
(`{ source, fetchedOn, count, items: [...] }`), each item:
`{ title, date (ISO), location (string|null), summary, tags (string[]),
post (string|null) }`. Seeded with one entry (Google Startup Jam 2019).

`src/lib/talks.ts` extends to also export `mentoring: MentoringItem[]`
(sorted newest-first) and keeps `talks`, `totalTalks`, `totalAttendees`.
Add a `MentoringItem` interface and an optional `post` to `Talk`.

### Deterministic talk → post mapping (by event date)

Titles differ for 2 of them, so map by ISO date (each is unique):

| talks.json title (date) | post |
|---|---|
| What's new in Android JetPack (2019-06-16) | /posts/whats-new-in-android-jetpack/ |
| Exploring CameraX Jetpack Library (2019-07-14) | /posts/exploring-camerax-jetpack/ |
| Modern Android Development with Kotlin (2019-03-25) | /posts/kotlin-for-android-devs/ |
| Android 101 (2019-09-07) | /posts/android-101/ |
| Improving app performance with Kotlin Coroutines [DevFest Cebu] (2019-11-16) | /posts/app-kotlin-coroutines/ |
| CameraX JetPack - Android Developers Day 2019 (2019-07-21) | /posts/exploring-camerax-from-jetpack/ |

Mentoring item → `/posts/google-startup-jam-2019/`.

The `post` values are added by hand to the JSON (deterministic, reviewed),
not computed at runtime — keeps the data self-describing and testable.

## Components & Routes

- **`src/pages/talks.astro`** — renders two sections:
  - `## Talks` — `talks` (35), existing stats line retained.
  - `## Mentoring & Workshops` — `mentoring` items.
  - Each rendered via `TalkCard`.
- **`src/components/TalkCard.astro`** — gains optional `post`. When `post`
  is set, the title (and the image, if present) is wrapped in
  `<a href={post}>`; hover affordance consistent with PostCard. When
  absent, renders exactly as today (non-clickable).
- **`src/pages/posts/[...slug].astro`** + posts collection — unchanged.
  These are the detail pages. Legacy `/posts/...` URLs preserved.
- **`src/pages/index.astro`** — remove the Projects `<section>` and the
  Latest-posts `<section>` and their imports/queries. Keep `Hero` + the
  "Recent talks" teaser (5 latest from `talks`).
- **`src/config.ts`** — `menu` becomes Home / Talks / About / Contact
  (drop Blog).
- **`public/_redirects`** — add `/blog    /talks    301` and
  `/blog/*    /talks    301` (keep existing apex rule).

## Dead-code Removal

Deleting these (now unreferenced after the above):

- `src/pages/blog.astro`
- `src/components/ProjectCard.astro`
- `src/content/projects/` (kinemaster.md, nexplayer-sdk.md, this-site.md)
- the `projects` collection from `src/content.config.ts`

`PostCard.astro` stays (still used by tags/categories pages).

## Service-Worker Kill (returning-visitor bug)

Root cause: the previous Gatsby site used `gatsby-plugin-offline`, which
registered `/sw.js` at scope `/`. Cached in past visitors' browsers, it
serves the old app shell offline-first regardless of new deploys.

Two-layer fix (the documented gatsby-offline removal pattern):

1. **`public/sw.js`** — a self-destroying worker shipped at the same path
   the old one occupied:
   ```js
   self.addEventListener('install', () => self.skipWaiting());
   self.addEventListener('activate', async () => {
     await self.registration.unregister();
     const keys = await caches.keys();
     await Promise.all(keys.map((k) => caches.delete(k)));
     const clients = await self.clients.matchAll();
     clients.forEach((c) => c.navigate(c.url));
   });
   ```
2. **Inline `<head>` script in `BaseLayout.astro`** (runs on first load of
   the new site for anyone who reaches new HTML):
   ```js
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.getRegistrations()
       .then((rs) => rs.forEach((r) => r.unregister()));
     if (window.caches) caches.keys()
       .then((ks) => ks.forEach((k) => caches.delete(k)));
   }
   ```
   Placed alongside the existing no-flash theme script; must not block
   render and must be safe when `serviceWorker`/`caches` are absent.

## Error Handling

- `TalkCard` with `post` unset behaves exactly as before (no link).
- Data loader: `post` is optional; absent → plain card.
- Build-time content schema unchanged for posts; mentoring.json validated
  by a Vitest shape check (no Astro collection needed for it — it is plain
  imported JSON like talks.json).

## Testing / Verification

- **Vitest (extend `tests/`):**
  - Every `post` value in talks.json + mentoring.json resolves to an
    existing file under `src/content/posts/` (derive slug from the URL;
    assert a matching `.md`/`.mdx`). No dead links.
  - Exactly 6 talks carry a `post`; mentoring.json has ≥1 item, all with
    `post`.
  - Existing postPath (4) and content (2) tests still green.
- `astro check` → 0 errors.
- `astro build` → 0; assertions on `dist/`:
  - `/talks/index.html` contains both `Talks` and
    `Mentoring &amp; Workshops` headings; contains `href="/posts/`
    links for the 6+1 write-ups.
  - `/blog` → `dist/_redirects` has the `/blog` → `/talks` rule.
  - `/index.html` does NOT contain "Projects" or "Latest posts"; DOES
    contain "Recent talks" and the hero.
  - `dist/sw.js` exists and is the self-destroying stub (contains
    `registration.unregister`).
  - 7 `/posts/<slug>/` pages still build (unchanged).
- Manual: load `/talks` (two sections, links work), `/` (no projects),
  visit `/blog` (redirects), and confirm `sw.js` served is the stub.

## Risks

- **Stale SW persistence:** some browsers cache the old `sw.js` with a
  long TTL; the self-destroying replacement + inline unregister covers
  both the "old SW still controlling" and "new HTML reached" cases. A
  hard-refresh may still be needed once per returning visitor — acceptable
  and self-healing thereafter.
- **Title mismatch in mapping:** mitigated by mapping on unique event
  date and hand-writing `post` into JSON (reviewed, not fuzzy-matched).
- **Deleting projects content:** intentional per user ("don't need
  projects"); removed as dead code, not hidden.
