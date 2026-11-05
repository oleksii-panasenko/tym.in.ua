// Завантажує медіафайли зі старого сайту в public/wp-content/uploads (ті самі шляхи — старі посилання працюють)
// і робить мініатюри для галерей у public/thumbs. Повторний запуск пропускає вже завантажене.
import { readFileSync, writeFileSync, mkdirSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

const ORIGIN = process.env.MEDIA_ORIGIN || 'https://tym.in.ua';
const { files, gallery } = JSON.parse(readFileSync('src/data/media.json', 'utf8'));

// Дозволені лише ці типи, і перевіряємо справжній вміст за сигнатурою
const SIGNATURES = {
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  gif: [[0x47, 0x49, 0x46, 0x38]],
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  rar: [[0x52, 0x61, 0x72, 0x21]],
};
const ext = (p) => p.split('.').pop().toLowerCase();
const okSignature = (buf, p) => (SIGNATURES[ext(p)] || []).some((sig) => sig.every((b, i) => buf[i] === b));

const failed = [];
let downloaded = 0, skipped = 0, thumbs = 0;

async function fetchOne(p) {
  const dest = `public/wp-content/uploads/${p}`;
  if (!SIGNATURES[ext(p)]) return failed.push(`${p}: недозволений тип`);
  if (existsSync(dest)) return skipped++;
  const url = `${ORIGIN}/wp-content/uploads/${p.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, { redirect: 'error' });
  if (!res.ok) return failed.push(`${p}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!okSignature(buf, p)) return failed.push(`${p}: вміст не відповідає типу файлу`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  downloaded++;
}

async function thumbOne(p) {
  const src = `public/wp-content/uploads/${p}`;
  const dest = `public/thumbs/${p.replace(/\.[a-z]+$/i, '.webp')}`;
  if (!existsSync(src) || existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(src).rotate().resize({ width: 480, height: 480, fit: 'cover' }).webp({ quality: 72 }).toFile(dest);
  thumbs++;
}

async function pool(list, n, fn) {
  const queue = [...list];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) {
      const p = queue.shift();
      try { await fn(p); } catch (e) { failed.push(`${p}: ${e.message}`); }
    }
  }));
}

await pool(files, 4, fetchOne);
await pool(gallery, 4, thumbOne);
console.log(`Завантажено: ${downloaded}, вже були: ${skipped}, мініатюр: ${thumbs}`);
if (failed.length) {
  console.log(`Проблеми (${failed.length}):\n  ` + failed.join('\n  '));
  process.exitCode = 1;
}
