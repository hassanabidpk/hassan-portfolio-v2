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
