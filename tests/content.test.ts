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
