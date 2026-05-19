// tests/talksData.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { talks, workshops, mentoring } from '../src/lib/talks';
import talksData from '../src/data/talks.json';
import workshopsData from '../src/data/workshops.json';
import mentoringData from '../src/data/mentoring.json';

function postFileExists(url: string): boolean {
  const slug = url.replace(/^\/posts\//, '').replace(/\/$/, '');
  return (
    existsSync(`src/content/posts/${slug}.md`) ||
    existsSync(`src/content/posts/${slug}.mdx`)
  );
}

const sortedDesc = (xs: { date: string }[]) =>
  xs.every(
    (_, i) => i === 0 || +new Date(xs[i - 1].date) >= +new Date(xs[i].date)
  );

describe('talks data', () => {
  it('count matches and exactly 6 have a post link', () => {
    expect(talks.length).toBe(talksData.count);
    expect(talks.filter((t) => t.post).length).toBe(6);
  });
  it('every talk post URL resolves', () => {
    for (const t of talks) {
      if (t.post) expect(postFileExists(t.post), t.post).toBe(true);
    }
  });
  it('talks remain sorted newest-first', () => {
    expect(sortedDesc(talks)).toBe(true);
  });
});

describe('workshops data', () => {
  it('count matches json, non-empty, sorted newest-first', () => {
    expect(workshops.length).toBe(workshopsData.count);
    expect(workshops.length).toBeGreaterThan(0);
    expect(sortedDesc(workshops)).toBe(true);
  });
  it('the Google Startup Jam workshop keeps its write-up link', () => {
    const gsj = workshops.find(
      (w) => w.post === '/posts/google-startup-jam-2019/'
    );
    expect(gsj, 'GSJ workshop item with post link').toBeTruthy();
    expect(postFileExists(gsj!.post!)).toBe(true);
  });
  it('every workshop post URL resolves', () => {
    for (const w of workshops) {
      if (w.post) expect(postFileExists(w.post), w.post).toBe(true);
    }
  });
});

describe('mentoring data', () => {
  it('count matches json, non-empty, sorted newest-first', () => {
    expect(mentoring.length).toBe(mentoringData.count);
    expect(mentoring.length).toBeGreaterThan(0);
    expect(sortedDesc(mentoring)).toBe(true);
  });
  it('every mentoring post URL resolves (if any)', () => {
    for (const m of mentoring) {
      if (m.post) expect(postFileExists(m.post), m.post).toBe(true);
    }
  });
});
