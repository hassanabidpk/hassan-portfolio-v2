// src/lib/postPath.ts
export function slugFromPath(path: string): string {
  const m = path.match(/^\/posts\/(.+?)\/?$/);
  if (!m) throw new Error(`Not a /posts/ path: ${path}`);
  return m[1];
}

export function urlFromPath(path: string): string {
  return `/posts/${slugFromPath(path)}/`;
}
