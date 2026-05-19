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
Talks data in `src/data/talks.json` (sourced from Advocu GDE profile).
Site metadata in `src/config.ts`.
