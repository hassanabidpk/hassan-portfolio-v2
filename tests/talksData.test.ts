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
