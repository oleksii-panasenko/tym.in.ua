// Мініатюри для фотогалерей.
//
//   npm run gallery -- public/files/2026/final
//     робить мініатюри для всіх фото в папці й друкує готову розмітку галереї,
//     яку треба вставити в текст запису.
//
//   npm run gallery
//     перевіряє всі галереї в src/content і створює мініатюри, яких бракує.
import { readdirSync, readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import sharp from 'sharp';

const PHOTO = /\.(jpe?g|png)$/i;

async function makeThumb(src, dest) {
  if (existsSync(dest)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(src).rotate().resize({ width: 480, height: 480, fit: 'cover' }).webp({ quality: 72 }).toFile(dest);
  return true;
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const folder = process.argv[2];
let created = 0;

if (folder) {
  if (!folder.startsWith('public/') || !existsSync(folder)) throw new Error('Вкажіть папку всередині public/, наприклад public/files/2026/final');
  const photos = walk(folder).filter((p) => PHOTO.test(p)).sort();
  if (!photos.length) throw new Error(`У ${folder} немає фото (jpg, png)`);
  const links = [];
  for (const p of photos) {
    const rel = relative('public', p);
    const thumb = `thumbs/${rel.replace(PHOTO, '.webp')}`;
    if (await makeThumb(p, `public/${thumb}`)) created++;
    links.push(`<a href="/${encodeURI(rel)}"><img src="/${encodeURI(thumb)}" alt="" loading="lazy" decoding="async"></a>`);
  }
  console.log(`\nМініатюр створено: ${created}. Вставте в запис:\n`);
  console.log(`<div class="gallery">\n${links.join('\n')}\n</div>\n`);
} else {
  const missing = [];
  for (const file of walk('src/content').filter((p) => p.endsWith('.md'))) {
    for (const [, href, thumb] of readFileSync(file, 'utf8').matchAll(/<a href="([^"]+)"><img src="(\/thumbs\/[^"]+)"/g)) {
      const src = `public${decodeURI(href)}`;
      if (!existsSync(src)) { missing.push(`${file}: немає ${src}`); continue; }
      if (await makeThumb(src, `public${decodeURI(thumb)}`)) created++;
    }
  }
  console.log(`Мініатюр створено: ${created}`);
  if (missing.length) {
    console.log(`Проблеми (${missing.length}):\n  ` + missing.join('\n  '));
    process.exitCode = 1;
  }
}
