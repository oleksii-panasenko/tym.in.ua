import { defineConfig } from 'astro/config';
import wpRedirects from './src/data/wp-redirects.json' with { type: 'json' };

// Порожні сторінки-заглушки старого меню → відповідні розділи
const menuStubs = {
  '/про-тюм/': '/',
  '/матеріали-турнірів/': '/category/matherials/',
  '/фотогалерея/': '/category/photo/',
  '/корисні-джерела/': '/category/useful/',
  // старе посилання всередині запису «Зміна реквізитів для оплати»
  '/2017/09/22/nakaz-depart/': '/2017/09/22/nakaz-departamentu-osviti-i-nauki-vinnickoї-oda-pro-provedennya-finalnogo-etapu-xx-turniru-yunix-matematikiv-imeni-profesora-m-j-yadrenka/',
};
const redirects = Object.fromEntries(
  Object.entries({ ...wpRedirects, ...menuStubs }).filter(([, to]) => to),
);

export default defineConfig({
  site: 'https://tym.in.ua',
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects,
  markdown: { smartypants: false },
});
