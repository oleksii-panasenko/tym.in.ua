// Одноразовий імпорт контенту з WordPress-експорту (WXR) у Markdown-файли.
// Використання: node scripts/import-wp.mjs export/WordPress.xml
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const src = process.argv[2];
if (!src) throw new Error('Вкажіть шлях до XML-експорту');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'category', 'wp:postmeta'].includes(name),
});
const channel = parser.parse(readFileSync(src, 'utf8')).rss.channel;
const items = channel.item;

const SITE = /https?:\/\/(?:www\.)?tym\.in\.ua/g;
const CATEGORIES = ['news', 'matherials', 'results', 'photo', 'useful'];

const meta = (it, key) =>
  (it['wp:postmeta'] || []).filter((m) => m['wp:meta_key'] === key).map((m) => String(m['wp:meta_value']));

// id вкладення → шлях відносно /wp-content/uploads/
const attachments = new Map();
for (const it of items) {
  if (it['wp:post_type'] !== 'attachment') continue;
  const url = String(it['wp:attachment_url']);
  attachments.set(String(it['wp:post_id']), url.replace(/^.*\/wp-content\/uploads\//, ''));
}

const media = new Set(); // усі файли з uploads, на які посилається контент
const galleryImages = new Set(); // ті, для яких треба мініатюри

const uploadsUrl = (p) => `/wp-content/uploads/${p}`;
const decode = (s) => {
  try { return decodeURIComponent(s); } catch { return s; }
};

function galleryHtml(ids) {
  const imgs = ids
    .map((id) => attachments.get(String(id)))
    .filter(Boolean)
    .map((p) => {
      galleryImages.add(p);
      return `<a href="${uploadsUrl(p)}"><img src="/thumbs/${p.replace(/\.[a-z]+$/i, '.webp')}" alt="" loading="lazy" decoding="async"></a>`;
    });
  return `\n<div class="gallery">\n${imgs.join('\n')}\n</div>\n`;
}

function pdfHtml(file) {
  const href = file.replace(SITE, '');
  const name = decode(href.split('/').pop()).replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
  return `\n<figure class="pdf">\n<object data="${href}" type="application/pdf" aria-label="${name}"></object>\n<figcaption><a href="${href}">${name} (PDF)</a></figcaption>\n</figure>\n`;
}

function clean(html) {
  let h = String(html ?? '');

  // Gutenberg-галереї → наша галерея з id вкладень
  h = h.replace(/<!-- wp:gallery[\s\S]*?<!-- \/wp:gallery -->/g, (block) => {
    const ids = [...block.matchAll(/data-id="(\d+)"/g)].map((m) => m[1]);
    return galleryHtml(ids);
  });
  h = h.replace(/\[gallery [^\]]*ids="([\d,\s]+)"[^\]]*\]/g, (_, ids) => galleryHtml(ids.split(/\s*,\s*/)));
  h = h.replace(/\[gview file="([^"]+)"[^\]]*\]/g, (_, f) => pdfHtml(f));
  h = h.replace(/\[caption[^\]]*align="(\w+)"[^\]]*\]\s*(<img[^>]*>)\s*([\s\S]*?)\[\/caption\]/g,
    (_, align, img, cap) => `<figure class="portrait ${align === 'alignright' ? 'right' : 'left'}">${img}<figcaption>${cap.trim()}</figcaption></figure>`);

  // усі HTML-коментарі (службові wp:*, <!--more-->, закоментований старий текст)
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  // службові атрибути WordPress
  h = h.replace(/\s(?:style|class)="(?:[^"]*(?:text-align:\s*justify|wp-image-|size-|alignnone|wp-block-)[^"]*)"/g, '');
  h = h.replace(/\s(?:data-id|data-link|data-type)="[^"]*"/g, '');
  h = h.replace(/\stype="circle"/g, '');
  h = h.replace(/\starget="_blank"/g, ' rel="noopener"');
  // абсолютні посилання на свій сайт → відносні
  h = h.replace(SITE, '');
  h = h.replace(/href=""/g, 'href="/"');
  // емодзі-картинки з Facebook → звичайні символи (без зовнішніх запитів)
  h = h.replace(/<img[^>]*src="https?:\/\/static\.xx\.fbcdn\.net[^"]*"[^>]*alt="([^"]*)"[^>]*>/g, '$1');
  h = h.replace(/<p>(?:\s|&nbsp;| )*<\/p>/g, '');
  // типографіка лише в тексті (не в тегах): 1932--2004 → 1932–2004, « -- » → « — »
  h = h.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) =>
    tag ? tag : text.replace(/(\d)\s*--\s*(\d)/g, '$1–$2').replace(/(^|\s)--?(?=\s)/g, '$1—'));
  h = h.replace(/\n{3,}/g, '\n\n').trim();

  for (const m of h.matchAll(/["'(]\/wp-content\/uploads\/([^"'<>\s)]+)/g)) media.add(decode(m[1]));
  return h;
}

const yamlStr = (s) => JSON.stringify(String(s));
const plainTitle = (t) => String(t).replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();

rmSync('src/content/posts', { recursive: true, force: true });
rmSync('src/content/pages', { recursive: true, force: true });
mkdirSync('src/content/posts', { recursive: true });
mkdirSync('src/content/pages', { recursive: true });

const redirects = {};
let nPosts = 0, nPages = 0;

for (const it of items) {
  const type = it['wp:post_type'];
  if (!['post', 'page'].includes(type) || it['wp:status'] !== 'publish') continue;

  const link = decode(String(it.link)).replace(SITE, '') || '/';
  const slug = decode(String(it['wp:post_name']));
  const date = String(it['wp:post_date']).slice(0, 10);
  const body = clean(it['content:encoded']);
  const title = plainTitle(it.title);

  if (type === 'post') {
    const cats = (it.category || []).filter((c) => c.domain === 'category' && CATEGORIES.includes(c.nicename)).map((c) => c.nicename);
    const fm = [
      '---',
      `title: ${yamlStr(title)}`,
      `date: ${date}`,
      `path: ${yamlStr(link)}`,
      `categories: [${cats.join(', ')}]`,
      '---',
    ].join('\n');
    writeFileSync(`src/content/posts/${date}-${slug}.md`, `${fm}\n\n${body}\n`);
    for (const old of meta(it, '_wp_old_slug')) {
      redirects[`/${date.replaceAll('-', '/')}/${decode(old)}/`] = link;
    }
    nPosts++;
  } else {
    if (!body) {
      redirects[link] = null; // порожня сторінка-заглушка меню — переадресацію задаємо вручну в site.config
      continue;
    }
    const name = link === '/' ? 'home' : slug;
    const fm = ['---', `title: ${yamlStr(title)}`, `path: ${yamlStr(link)}`, '---'].join('\n');
    writeFileSync(`src/content/pages/${name}.md`, `${fm}\n\n${body}\n`);
    nPages++;
  }
}

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/media.json', JSON.stringify({ files: [...media].sort(), gallery: [...galleryImages].sort() }, null, 2) + '\n');
writeFileSync('src/data/wp-redirects.json', JSON.stringify(redirects, null, 2) + '\n');
console.log(`Записів: ${nPosts}, сторінок: ${nPages}, медіафайлів: ${media.size}, фото в галереях: ${galleryImages.size}`);
