/* Ustoz kitoblari va daftari: tozalash va saqlash (server/books.js). node tests/books-test.js */
'use strict';
const B = require('../server/books');
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } }
const mem = new Map();
const store = { get: async k => mem.has(k) ? JSON.parse(mem.get(k)) : null, set: async (k, v) => { mem.set(k, JSON.stringify(v)); },
  del: async k => { mem.delete(k); }, list: async p => [...mem].filter(([k]) => k.indexOf(p) === 0).map(([path, d]) => ({ path, data: JSON.parse(d) })) };
const stamp = () => '2026-11-02 16:00';
(async () => {
  console.log('\n1. Kitob yozuvlari');
  let r = await B.saveAnnot(store, 'u1', { book: 'nabra-a0', page: 3, items: [
    { t: 'p', c: '#FF0000', w: 0.004, p: [0.1, 0.2, 0.3, 0.4, 5, -1] }, { t: 'x', c: 'red', s: 0.03, x: 0.5, y: 0.5, v: 'مَرْحَبًا' }, { t: 'z' }, null] }, stamp);
  ok('Saqlandi', r.ok && r.count === 2, JSON.stringify(r));
  const a = await B.getAnnot(store, 'u1', 'nabra-a0');
  ok('Koordinatalar 0..1 ga cheklandi', JSON.stringify(a.pages[3][0].p) === '[0.1,0.2,0.3,0.4,1,0]', JSON.stringify(a.pages[3][0].p));
  ok('Noto‘g‘ri rang almashtirildi', a.pages[3][1].c === '#111111');
  ok('Boshqa ustoz ko‘rmaydi', Object.keys((await B.getAnnot(store, 'u2', 'nabra-a0')).pages).length === 0);
  ok('Noto‘g‘ri kitob nomi rad etiladi', !!(await B.saveAnnot(store, 'u1', { book: '../x', page: 1, items: [] }, stamp)).error);
  await B.saveAnnot(store, 'u1', { book: 'nabra-a0', page: 3, items: [] }, stamp);
  ok('Bo‘sh sahifa o‘chiriladi', !(await B.getAnnot(store, 'u1', 'nabra-a0')).pages[3]);
  console.log('\n2. Daftar');
  r = await B.saveNotebook(store, 'u1', { title: '<b>Dars</b>', html: '<p dir="rtl" onclick="x()">سَلَام</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:x">a</a><span style="color:red;background-image:url(x)">r</span>' }, stamp);
  const nb = r.notebook;
  ok('Yaratildi', r.ok && /^n[a-f0-9]{12}$/.test(nb.id));
  ok('Nom tozalandi', nb.title === 'bDars/b', nb.title);
  ok('Skript, img, havola, onclick olib tashlandi', !/script|img|onerror|onclick|javascript|<a/i.test(nb.html), nb.html);
  ok('Arabcha va dir saqlandi', /<p dir="rtl">سَلَام<\/p>/.test(nb.html), nb.html);
  ok('Xavfsiz uslub qoldi, url() olib tashlandi', /style="color:red"/.test(nb.html) && !/url/.test(nb.html), nb.html);
  ok('Ro‘yxatda bor', (await B.listNotebooks(store, 'u1')).length === 1);
  ok('Boshqa ustoz ochaolmaydi', !!(await B.getNotebook(store, 'u2', nb.id)).error);
  ok('Boshqa ustoz o‘zgartira olmaydi', !!(await B.saveNotebook(store, 'u2', { id: nb.id, html: 'x' }, stamp)).error);
  ok('O‘chirildi', (await B.deleteNotebook(store, 'u1', nb.id)).ok && (await B.listNotebooks(store, 'u1')).length === 0);
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o‘tdi');
  process.exit(fail ? 1 : 0);
})();
