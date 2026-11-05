import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES } from '../content.config';

export type Post = CollectionEntry<'posts'>;
export type CategoryKey = keyof typeof CATEGORIES;
export { CATEGORIES };

/** Адреса запису: з поля path або з дати та назви файлу (2025-04-06-nazva.md → /2025/04/06/nazva/). */
export function postHref(post: Post): string {
  if (post.data.path) return post.data.path;
  const d = post.data.date.toISOString().slice(0, 10).split('-').join('/');
  const slug = post.id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return `/${d}/${slug}/`;
}

export async function getPosts(category?: CategoryKey): Promise<Post[]> {
  const all = await getCollection('posts');
  return all
    .filter((p) => !category || p.data.categories.includes(category))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const formatDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const formatShort = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
