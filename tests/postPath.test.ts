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
