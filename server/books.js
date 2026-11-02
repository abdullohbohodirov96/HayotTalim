/* Ustoz kitoblari va daftari.

   Yozuvlar (faqat server orqali, faqat egasi ko'radi):
     bookannot/<userId>__<bookId>  — kitob sahifalaridagi chizma/yozuvlar: { pages: { <n>: [element] } }
       element: { t:'p'|'m', c:'#rrggbb', w: qalinlik (sahifa enining ulushi), p:[x,y, x,y, ...] (0..1) }
                { t:'x', c, s: o'lcham (ulush), x, y, v: matn }
     notebook/<userId>__<id>       — daftar: { id, title, html, createdAt, updatedAt }

   Daftar matni (HTML) saqlashdan oldin tozalanadi: faqat ruxsat etilgan teglar va
   uslublar qoladi (skript, hodisa atributlari, havolalar — yo'q).                   */
'use strict';
const crypto = require('crypto');

const ANN = 'bookannot/';
const NB = 'notebook/';
const BOOK_RE = /^[a-z0-9-]{2,40}$/;
const ID_RE = /^n[a-f0-9]{12}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

const MAX_ITEMS = 600;          // bir sahifada
const MAX_POINTS = 40000;       // bir sahifadagi jami nuqta koordinatalari
const MAX_HTML = 300000;        // daftar hajmi (belgi)
const MAX_NOTEBOOKS = 200;

function num(v, lo, hi) { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; }
function r4(v) { return Math.round(v * 10000) / 10000; }

/** Sahifa elementlarini tekshirish va siqish */
function cleanItems(items) {
  const out = []; let pts = 0;
  for (const it of (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') continue;
    const c = COLOR_RE.test(String(it.c || '')) ? String(it.c).toLowerCase() : '#111111';
    if (it.t === 'p' || it.t === 'm') {
      const raw = Array.isArray(it.p) ? it.p : [];
      const p = [];
      for (let i = 0; i + 1 < raw.length && pts < MAX_POINTS; i += 2) { p.push(r4(num(raw[i], 0, 1)), r4(num(raw[i + 1], 0, 1))); pts += 2; }
      if (p.length >= 2) out.push({ t: it.t, c, w: r4(num(it.w, 0.0005, 0.08)), p });
    } else if (it.t === 'x') {
      const v = String(it.v == null ? '' : it.v).replace(/\u0000/g, '').slice(0, 500);
      if (v.trim()) out.push({ t: 'x', c, s: r4(num(it.s, 0.008, 0.2)), x: r4(num(it.x, 0, 1)), y: r4(num(it.y, 0, 1)), v });
    }
  }
  return out;
}

async function getAnnot(store, uid, book) {
  if (!BOOK_RE.test(String(book || ''))) return { error: 'Kitob topilmadi.', code: 404 };
  const d = await store.get(ANN + uid + '__' + book);
  return { pages: (d && d.pages) || {} };
}
async function saveAnnot(store, uid, body, stamp) {
  const book = String(body && body.book || '');
  const page = Math.round(Number(body && body.page));
  if (!BOOK_RE.test(book) || !(page >= 1 && page <= 2000)) return { error: 'Noto’g’ri sahifa.', code: 400 };
  const key = ANN + uid + '__' + book;
  const d = (await store.get(key)) || { userId: uid, book, pages: {} };
  d.pages = d.pages || {};
  const items = cleanItems(body.items);
  if (items.length) d.pages[page] = items; else delete d.pages[page];
  d.updatedAt = stamp();
  await store.set(key, d);
  return { ok: true, count: items.length };
}

/* ---------------- Daftar: HTML tozalash ---------------- */
const TAGS = { p: 1, div: 1, br: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, s: 1, span: 1, ul: 1, ol: 1, li: 1, h1: 1, h2: 1, h3: 1, blockquote: 1, hr: 1, mark: 1, sub: 1, sup: 1, font: 1, small: 1, strike: 1,
  table: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, th: 1, td: 1, colgroup: 1, col: 1, caption: 1 };
const CLASS_RE = /^nb-[a-z0-9-]+( nb-[a-z0-9-]+){0,5}$/;
const VOID = { br: 1, hr: 1, col: 1 };
const STYLE_OK = { color: 1, 'background-color': 1, 'font-size': 1, 'text-align': 1, direction: 1, 'font-family': 1, 'font-weight': 1, 'font-style': 1, 'text-decoration': 1 };
function cleanStyle(st) {
  return String(st || '').split(';').map(x => {
    const i = x.indexOf(':'); if (i < 0) return '';
    const k = x.slice(0, i).trim().toLowerCase(), v = x.slice(i + 1).trim();
    if (!STYLE_OK[k] || /url\(|expression|javascript|[<>"]/i.test(v) || v.length > 80) return '';
    return k + ':' + v;
  }).filter(Boolean).join(';');
}
function cleanHtml(html) {
  let s = String(html || '').replace(/\u0000/g, '').slice(0, MAX_HTML);
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|svg|math|template|noscript)[\s\S]*?<\/\1\s*>/gi, '');
  return s.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (m, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!TAGS[t]) return '';
    if (m[1] === '/') return VOID[t] ? '' : '</' + t + '>';
    const keep = [];
    attrs.replace(/([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g, (a, name, _q, d1, d2, d3) => {
      const n = name.toLowerCase(), v = d1 != null ? d1 : d2 != null ? d2 : (d3 || '');
      if (n === 'style') { const st = cleanStyle(v); if (st) keep.push('style="' + st.replace(/"/g, '') + '"'); }
      else if (n === 'dir' && /^(rtl|ltr|auto)$/i.test(v)) keep.push('dir="' + v.toLowerCase() + '"');
      else if (n === 'align' && /^(left|right|center|justify)$/i.test(v)) keep.push('align="' + v.toLowerCase() + '"');
      else if (n === 'class' && CLASS_RE.test(v.trim())) keep.push('class="' + v.trim() + '"');
      else if ((n === 'colspan' || n === 'rowspan' || n === 'span') && /^[1-9][0-9]?$/.test(v)) keep.push(n + '="' + v + '"');
      else if (t === 'font' && n === 'color' && /^#?[0-9a-z]{3,20}$/i.test(v)) keep.push('color="' + v + '"');
      else if (t === 'font' && n === 'size' && /^[1-7]$/.test(v)) keep.push('size="' + v + '"');
      else if (t === 'font' && n === 'face' && /^[a-z0-9 ,'-]{1,60}$/i.test(v)) keep.push('face="' + v.replace(/'/g, '') + '"');
      return '';
    });
    return '<' + t + (keep.length ? ' ' + keep.join(' ') : '') + (VOID[t] ? '>' : '>');
  });
}

async function listNotebooks(store, uid) {
  const rows = await store.list(NB + uid + '__');
  return rows.map(r => r.data).filter(Boolean)
    .map(d => ({ id: d.id, title: d.title || 'Nomsiz daftar', updatedAt: d.updatedAt || '', size: String(d.html || '').length,
      preview: String(d.html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
async function getNotebook(store, uid, id) {
  if (!ID_RE.test(String(id || ''))) return { error: 'Daftar topilmadi.', code: 404 };
  const d = await store.get(NB + uid + '__' + id);
  if (!d) return { error: 'Daftar topilmadi.', code: 404 };
  return { notebook: d };
}
async function saveNotebook(store, uid, body, stamp) {
  let id = String(body && body.id || '');
  let d = null;
  if (id) {
    if (!ID_RE.test(id)) return { error: 'Daftar topilmadi.', code: 404 };
    d = await store.get(NB + uid + '__' + id);
    if (!d) return { error: 'Daftar topilmadi.', code: 404 };
  } else {
    if ((await store.list(NB + uid + '__')).length >= MAX_NOTEBOOKS) return { error: 'Daftarlar soni ' + MAX_NOTEBOOKS + ' tadan oshmasin.', code: 400 };
    id = 'n' + crypto.randomBytes(6).toString('hex');
    d = { id, userId: uid, createdAt: stamp() };
  }
  if (body.title != null) d.title = String(body.title).replace(/[<>\u0000]/g, '').trim().slice(0, 120) || 'Nomsiz daftar';
  if (body.html != null) d.html = cleanHtml(body.html);
  if (!d.title) d.title = 'Nomsiz daftar';
  if (d.html == null) d.html = '';
  d.updatedAt = stamp();
  await store.set(NB + uid + '__' + id, d);
  return { ok: true, notebook: d };
}
async function deleteNotebook(store, uid, id) {
  if (!ID_RE.test(String(id || ''))) return { error: 'Daftar topilmadi.', code: 404 };
  const key = NB + uid + '__' + id;
  if (!(await store.get(key))) return { error: 'Daftar topilmadi.', code: 404 };
  await store.del(key);
  return { ok: true };
}

/* ---------------- Daftarni fayl qilib berish (eksport) ----------------
   Bitta o'zi yetarli HTML: telefonda ham, kompyuterda ham ochiladi, chop etiladi.
   Word (.doc) uchun — Word tushunadigan HTML.                                 */
const EXPORT_CSS = `
body{font-family:Manrope,'Segoe UI',Arial,sans-serif;color:#14181f;max-width:1100px;margin:24px auto;padding:0 18px;line-height:1.6;font-size:16px;background:#fff}
h1.nb-doc-title{font-size:26px;margin:0 0 4px;color:#0b5d48}
.nb-doc-meta{color:#6a7380;font-size:13px;margin:0 0 22px;border-bottom:2px solid #0b5d48;padding-bottom:10px}
h1[dir=rtl],h2[dir=rtl],p[dir=rtl],.nb-ar,.nb-pr,.nb-verb,table.nb-tbl th{font-family:'Amiri','Noto Naskh Arabic','Traditional Arabic','Geeza Pro',serif}
table.nb-tbl td.nb-m,table.nb-tbl th.nb-m,table.nb-tbl td.nb-mean,table.nb-tbl th.nb-mh,table.nb-tbl td.nb-num,table.nb-tbl th.nb-num{font-family:Manrope,'Segoe UI',Arial,sans-serif}
table.nb-tbl{border-collapse:collapse;width:100%;margin:14px 0 22px;font-size:15px;page-break-inside:auto}
table.nb-tbl th,table.nb-tbl td{border:1px solid #c9d3cf;padding:7px 8px;text-align:center;vertical-align:middle}
table.nb-tbl tr{page-break-inside:avoid}
table.nb-tbl th{background:#0b5d48;color:#fff;font-weight:700;font-size:15px;line-height:1.3}
table.nb-tbl th small{display:block;font-weight:600;font-size:11.5px;opacity:.85;font-family:Manrope,Arial,sans-serif}
table.nb-tbl th.nb-m{background:#e8f3ef;color:#0b5d48}
table.nb-tbl td.nb-ar{font-size:24px;font-weight:700;color:#10231c;direction:rtl}
table.nb-tbl td.nb-m{background:#f6faf8;color:#3b4a44;font-size:14px;direction:ltr}
table.nb-tbl td.nb-num{width:34px;color:#8a958f;font-size:13px;background:#fafafa}
table.nb-tbl td.nb-na{background:repeating-linear-gradient(45deg,#f3f3f3,#f3f3f3 6px,#fbfbfb 6px,#fbfbfb 12px);color:#b0b0b0}
table.nb-tbl th.nb-c1{background:#0b5d48}table.nb-tbl th.nb-c2{background:#1565c0}table.nb-tbl th.nb-c3{background:#c62828}
table.nb-tbl th.nb-c4{background:#6a1b9a}table.nb-tbl th.nb-c5{background:#ef6c00}table.nb-tbl th.nb-c6{background:#00838f}
table.nb-tbl th.nb-num{background:#f1f3f2;color:#6a756f}
table.nb-tbl th.nb-mh{background:#f9a825;color:#fff}
table.nb-tbl td.nb-mean{background:#fffbea;color:#3d3420;font-weight:600;min-width:110px;direction:ltr}
table.nb-tbl td.nb-pr{font-size:21px;font-weight:700;background:#fff8e1;direction:rtl}
.nb-verb{display:inline-block;padding:6px 16px;border-radius:10px;background:#fff8e1;border:1px solid #f0d68a}
.nb-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}
.nb-wrap table.nb-tbl{min-width:640px}
@media (max-width:600px){body{font-size:15px;margin:14px auto;padding:0 12px}table.nb-tbl{font-size:13px}table.nb-tbl td.nb-ar{font-size:20px}table.nb-tbl th,table.nb-tbl td{padding:5px 5px}}
@media print{body{margin:0;max-width:none}h1.nb-doc-title{font-size:22px}.nb-wrap{overflow:visible}.nb-wrap table.nb-tbl{min-width:0}}
`;
function escHtml(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
/* O'quvchiga boradigan nusxada jadvalning bo'sh qatorlari olib tashlanadi
   (jadvalda kamida bitta to'ldirilgan qator bo'lsa), raqamlar qayta qo'yiladi. */
function dropEmptyRows(html) {
  return String(html).replace(/<tbody>([\s\S]*?)<\/tbody>/g, (m, body) => {
    const rows = body.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    const filled = r => r.replace(/<td class="nb-num"[^>]*>[\s\S]*?<\/td>/g, '').replace(/<td class="nb-na"[^>]*>[\s\S]*?<\/td>/g, '')
      .replace(/<[^>]+>/g, '').replace(/&nbsp;|\s|—/g, '') !== '';
    if (!rows.some(filled)) return m;
    let n = 0;
    return '<tbody>' + rows.filter(filled).map(r => r.replace(/(<td class="nb-num"[^>]*>)[\s\S]*?(<\/td>)/, (x, a, b) => a + (++n) + b)).join('') + '</tbody>';
  });
}
/* Telefonda keng jadval sahifani buzmasin: o'zi yonga suriladi, o'ngdan (arabcha boshidan) boshlanadi */
function wrapTables(html, word) {
  if (word) return html;
  return String(html).replace(/<table\b/g, '<div class="nb-wrap" dir="rtl"><table').replace(/<\/table>/g, '</table></div>');
}
function exportHtml(nb, opts) {
  opts = opts || {};
  const title = escHtml(nb.title || 'Daftar');
  const meta = escHtml([opts.center || 'Sabo Academy', nb.updatedAt ? String(nb.updatedAt).slice(0, 10) : ''].filter(Boolean).join(' · '));
  const word = opts.fmt === 'doc';
  return '<!doctype html>\n<html' + (word ? ' xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"' : '') + ' lang="uz"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    (word ? '<meta name="ProgId" content="Word.Document"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' : '') +
    '<title>' + title + '</title>' +
    (word ? '' : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Manrope:wght@400;600;700&display=swap">') +
    '<style>' + EXPORT_CSS + '</style></head><body>' +
    '<h1 class="nb-doc-title">' + title + '</h1><p class="nb-doc-meta">' + meta + '</p>' +
    wrapTables(dropEmptyRows(cleanHtml(nb.html || '')), word) + '</body></html>';
}
function exportName(nb, ext) {
  const base = String(nb.title || 'daftar').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'daftar';
  return base + '.' + ext;
}

module.exports = { dropEmptyRows, exportHtml, exportName, EXPORT_CSS, cleanItems, cleanHtml, getAnnot, saveAnnot, listNotebooks, getNotebook, saveNotebook, deleteNotebook };
