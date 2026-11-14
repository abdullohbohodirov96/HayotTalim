/* Murojaat taqsimlash (foiz) va Zoom: dars vaqti o'zgarganda sinxronlash */
'use strict';
process.env.ZOOM_ACCOUNT_ID = 'acc'; process.env.ZOOM_CLIENT_ID = 'cid'; process.env.ZOOM_CLIENT_SECRET = 'sec';
const { A } = require('../server/shared');
const split = require('../server/lead-split');
const zoom = require('../server/zoom');
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (i ? ' → ' + i : '')); } }
const mk = () => { const db = {}; return { db,
  async get(p) { return db[p] ? JSON.parse(JSON.stringify(db[p])) : null; },
  async set(p, v) { db[p] = JSON.parse(JSON.stringify(v)); }, async del(p) { delete db[p]; },
  async list(px) { return Object.keys(db).filter(k => k.indexOf(px) === 0).map(k => ({ path: k, data: JSON.parse(JSON.stringify(db[k])) })); } }; };
(async () => {
  console.log('\n1. Taqsimlash');
  const s = mk();
  s.db['users/a'] = { id: 'a', name: 'A', role: 'menejer', active: true };
  s.db['users/b'] = { id: 'b', name: 'B', role: 'menejer', active: true };
  let l = await split.assign(s, { id: 'x', ownerStaffId: '' });
  ok('O‘chiq bo‘lsa — tegmaydi', l.ownerStaffId === '');
  s.db['meta/settings'] = { leadSplit: { enabled: true, rules: [{ userId: 'a', pct: 80 }, { userId: 'b', pct: 20 }] } };
  const res = await Promise.all(Array.from({ length: 10 }, (_, i) => split.assign(s, { id: 'l' + i, ownerStaffId: '' })));
  const ca = res.filter(x => x.ownerStaffId === 'a').length;
  ok('10 tadan 8 tasi A ga, 2 tasi B ga (parallel kelsa ham)', ca === 8, ca);
  ok('Birinchi 5 tadan kamida bittasi B ga', res.slice(0, 5).some(x => x.ownerStaffId === 'b'));
  l = await split.assign(s, { id: 'y', ownerStaffId: 'b' });
  ok('Mas’ul qo‘lda tanlangan bo‘lsa — o‘zgarmaydi', l.ownerStaffId === 'b');
  s.db['users/b'].active = false;
  l = await split.assign(s, { id: 'z', ownerStaffId: '' });
  ok('Faol bo‘lmagan xodimga berilmaydi', l.ownerStaffId === 'a');

  console.log('\n2. Zoom: dars vaqti o‘zgardi');
  const z = mk(); const DAY = Date.UTC(2026, 9, 19); const at = (h, m) => DAY + ((h - 5) * 60 + m) * 60000; const iso = '2026-10-19';
  z.db['groups/g1'] = { id: 'g1', name: 'A0', format: 'onlayn', status: 'faol', days: [A.weekdayOf(iso)], startTime: '18:00', endTime: '19:30', startDate: '2026-09-01', tgChat: '-1' };
  const calls = [];
  zoom.setFetch(async (url, opt) => {
    const J = (o, st) => ({ ok: true, status: st || 200, json: async () => o });
    if (/oauth/.test(url)) return J({ access_token: 'T', expires_in: 3600 });
    if (opt && opt.method === 'PATCH') { calls.push(JSON.parse(opt.body)); return J({}, 204); }
    if (/users\/me\/meetings$/.test(url)) return J({ id: 5, join_url: 'https://zoom.us/j/5', start_url: 'https://zoom.us/s/5', password: 'p' });
    if (/meetings\/5$/.test(url)) return J({ id: 5, start_url: 'https://zoom.us/s/5?new' });
    return J({});
  });
  const gm = [], sent = [];
  const ctx = { stamp: () => '2026-10-19 17:00', send: async m => { sent.push(m); return {}; }, sendGroup: async (g, t) => { gm.push(t); return {}; } };
  await zoom.tick(z, A, ctx, at(17, 0));
  ok('1 soat oldin eslatma ketdi', gm.some(t => /Bugun darsingiz bor/.test(t)));
  z.db['groups/g1'].startTime = '19:00'; z.db['groups/g1'].endTime = '20:30';
  await zoom.tick(z, A, ctx, at(17, 10));
  const rec = z.db['zoomlesson/g1__' + iso];
  ok('Zoom’dagi vaqt yangilandi (PATCH 19:00)', calls.some(b => b.start_time === iso + 'T19:00:00'), JSON.stringify(calls));
  ok('Yozuvda yangi vaqt', rec.start === '19:00' && rec.end === '20:30');
  ok('Guruhga «Dars vaqti o‘zgardi» xabari', gm.some(t => /Dars vaqti o‘zgardi/.test(t) && /19:00/.test(t) && /18:00/.test(t)));
  const before = gm.filter(t => /Bugun darsingiz bor/.test(t)).length;
  await zoom.tick(z, A, ctx, at(18, 0));
  ok('Yangi vaqtga 1 soat qolganda eslatma qayta ketdi (19:00)', gm.filter(t => /Bugun darsingiz bor/.test(t)).length === before + 1 && /19:00/.test(gm[gm.length - 1]));
  await zoom.tick(z, A, ctx, at(18, 30));
  ok('Eski 18:00 da «Dars boshlandi» ketmadi', !gm.some(t => /Dars boshlandi/.test(t)));
  await zoom.tick(z, A, ctx, at(19, 0));
  ok('19:00 da «Dars boshlandi»', gm.some(t => /Dars boshlandi/.test(t)));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato' : '✓ HAMMASI O’TDI') + ' — ' + pass + ' ta o‘tdi');
  process.exit(fail ? 1 : 0);
})();
