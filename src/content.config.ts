import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const CATEGORIES = {
  news: 'Новини',
  matherials: 'Матеріали турнірів',
  results: 'Результати',
  photo: 'Фотогалерея',
  useful: 'Корисні джерела',
} as const;

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    // Адреса сторінки. Для нових записів можна не вказувати — збереться з дати та назви файлу.
    path: z.string().optional(),
    categories: z.array(z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES])).default(['news']),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string(), path: z.string() }),
});

export const collections = { posts, pages };
