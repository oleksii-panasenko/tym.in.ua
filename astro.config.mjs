import { defineConfig } from 'astro/config';
// Переадресації зі старих адрес (колишній WordPress, старе меню) на нові: "стара": "нова"
import redirects from './src/data/redirects.json' with { type: 'json' };

export default defineConfig({
  site: 'https://tym.in.ua',
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects,
  markdown: { smartypants: false },
});
