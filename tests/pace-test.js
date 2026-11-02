/* Darsliklar guruh sur'atida ochilishi (server/pace.js + statuses()).
   Ishga tushirish: node tests/pace-test.js                              */
'use strict';
const { A } = require('../server/shared');
const P = require('../server/pace');

let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } }
function eq(n, g, w) { ok(n, JSON.stringify(g) === JSON.stringify(w), 'kutilgan ' + JSON.stringify(w) + ', olindi ' + JSON.stringify(g)); }
const T = (y, m, d, hh, mm) => Date.UTC(y, m - 1, d, hh - 5, mm);   // Toshkent vaqti → ms

/* Du/Cho/Ju, 18:00–19:30, 26-oktabr (Du) dan */
const g = { id: 'g1', name: 'A1 kechki', level: 'A1', startDate: '2026-10-26', days: [1, 3, 5], startTime: '18:00', endTime: '19:30', status: 'faol' };

console.log('\n1. Jadval bo\'yicha hisob');
eq('Boshlanishdan oldin — 0 ta', P.schedule(g, [], T(2026, 10, 25, 12, 0)).n, 0);
eq('Birinchi dars kuni, dars tugamagan — 0', P.schedule(g, [], T(2026, 10, 26, 19, 0)).n, 0);
eq('Dars tugashi bilan — 1', P.schedule(g, [], T(2026, 10, 26, 19, 30)).n, 1);
eq('2-noyabr kunduzi — 3 ta (Du, Cho, Ju)', P.schedule(g, [], T(2026, 11, 2, 12, 0)).n, 3);
eq('Keyingi dars — bugun 19:30', P.schedule(g, [], T(2026, 11, 2, 12, 0)).next, { date: '2026-11-02', start: '18:00', end: '19:30' });
eq('Bayram kuni hisobga kirmaydi', P.schedule(g, [{ from: '2026-10-28', to: '2026-10-28', scope: 'markaz' }], T(2026, 11, 2, 12, 0)).n, 2);
eq('Boshqa guruh bayrami ta\'sir qilmaydi', P.schedule(g, [{ from: '2026-10-28', scope: 'guruh', groupId: 'g9' }], T(2026, 11, 2, 12, 0)).n, 3);
eq('Jadvali yo\'q guruh — null', P.schedule({ id: 'x', days: [], endTime: '' }, [], Date.now()), null);

console.log('\n2. Darslar holati (A1)');
const C = A.Course, F = A.Alifbo;
const ids = C.LESSONS.map(l => l.id);
const passed = { testBest: 100, hw: { submittedAt: '2026-10-27', auto: { total: 1, percent: 100 } } };
let doc = { lessons: {}, pace: { n: 1 } };
let st = C.statuses(doc);
eq('1 ta dars o\'tilgan: 1-dars ochiq', st[ids[0]], 'open');
if (ids[1]) eq('2-dars yopiq (o\'quvchi hali boshlamagan)', st[ids[1]], 'locked');
doc = { lessons: { [ids[0]]: passed }, pace: { n: 1 } };
if (ids[1]) eq('O\'quvchi 1-darsni tez tugatdi — 2-dars baribir yopiq', C.statuses(doc)[ids[1]], 'locked');
if (ids[1]) { doc.pace = { n: 2 }; eq('Guruh 2-darsni o\'tdi — ochildi', C.statuses(doc)[ids[1]], 'open'); }
doc = { lessons: {}, pace: { n: 0 } };
eq('Guruh boshlanmagan — 1-dars ham yopiq', C.statuses(doc)[ids[0]], 'locked');
doc = { lessons: {}, pace: { n: 0 }, all: true };
eq('To\'liq dostup — ochiq', C.statuses(doc)[ids[0]], 'open');
doc = { lessons: {}, pace: { n: 0 }, unlocked: { [ids[0]]: true } };
eq('Ustoz qo\'lda ochgan — ochiq', C.statuses(doc)[ids[0]], 'open');
doc = { lessons: {} };
eq('Guruh jadvali yo\'q — eski qoida (1-dars ochiq)', C.statuses(doc)[ids[0]], 'open');
const v = C.buildView({ lessons: {}, pace: { n: 0, next: { date: '2026-11-04', start: '18:00', end: '19:30' } } }, '2026-11-02');
eq('Yopiq dars yozuvi', v.lessons[0].lockNote, 'Dars o‘tilgandan keyin ochiladi: 4-noyabr, 19:30');

console.log('\n3. Alifbo (A0)');
const fid = F.LESSONS.map(l => l.id);
let fv = F.view({ lessons: {}, pace: { n: 3, next: { date: '2026-11-04', end: '19:30' } } });
eq('3 ta dars o\'tilgan: 3-dars ochiq', fv.lessons[2].status, 'open');
eq('4-dars yopiq', fv.lessons[3].status, 'locked');
eq('4-dars yozuvi', fv.lessons[3].lockNote, 'Dars o‘tilgandan keyin ochiladi: 4-noyabr, 19:30');
eq('5-dars yozuvi', fv.lessons[4].lockNote, 'Dars o‘tilgandan keyin ochiladi');
ok('pace ko\'rinishda bor', fv.pace && fv.pace.n === 3);

console.log('\n4. Saqlanmaydi');
(async () => {
  const mem = new Map([
    ['memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', status: 'faol' }],
    ['groups/g1', g]
  ]);
  const store = { list: async p => [...mem].filter(([k]) => k.indexOf(p) === 0).map(([path, data]) => ({ path, data })) };
  const d = await P.attach(store, 's1', { lessons: {} }, 'A1');
  ok('pace qo\'shildi', d.pace && typeof d.pace.n === 'number');
  ok('JSON ga chiqmaydi (bazaga yozilmaydi)', JSON.stringify(d).indexOf('pace') < 0);
  const d0 = await P.attach(store, 's1', { lessons: {} }, 'A0');
  eq('A0 guruhi yo\'q — null (eski qoida)', d0.pace, null);
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o‘tdi');
  process.exit(fail ? 1 : 0);
})();
