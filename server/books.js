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
const TAGS = { p: 1, div: 1, br: 1, b: 1, strong: 1, i: 1, em: 1, u: 1, s: 1, span: 1, ul: 1, ol: 1, li: 1, h1: 1, h2: 1, h3: 1, blockquote: 1, hr: 1, mark: 1, sub: 1, sup: 1, font: 1 };
const VOID = { br: 1, hr: 1 };
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

module.exports = { cleanItems, cleanHtml, getAnnot, saveAnnot, listNotebooks, getNotebook, saveNotebook, deleteNotebook };
