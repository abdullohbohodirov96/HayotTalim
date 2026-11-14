'use strict';
const { A } = require('../server/shared');
const lr = require('../server/lead-remind');
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (i ? ' → ' + i : '')); } }
const db = {};
const store = { async get(p) { return db[p] || null; }, async set(p, v) { db[p] = v; }, async list(px) { return Object.keys(db).filter(k => k.indexOf(px) === 0).map(k => ({ path: k, data: db[k] })); } };
db['users/u1'] = { id: 'u1', name: 'Ali', active: true };
db['leads/l1'] = { id: 'l1', name: 'Zilola', phone: '+998901112233', stage: 'yangi', funnelId: 'fnl_asosiy', nextContact: '2026-11-14', nextContactTime: '18:00', ownerStaffId: 'u1', note: 'kechki guruh' };
db['leads/l2'] = { id: 'l2', name: 'Rad', phone: '1', stage: 'rad', funnelId: 'fnl_asosiy', nextContact: '2026-11-14', nextContactTime: '18:00' };
const sent = [];
const bot = { notifyUser: async (id, t) => { sent.push({ to: id, t }); return { queued: 1 }; }, notifyStaff: async t => { sent.push({ to: 'staff', t }); return { queued: 1 }; } };
const T = (h, m) => Date.parse('2026-11-14T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00+05:00');
(async () => {
  await lr.tick(store, A, bot, T(17, 40));
  ok('20 daqiqa oldin — hali yo‘q', sent.length === 0);
  await lr.tick(store, A, bot, T(17, 45));
  ok('15 daqiqa oldin mas’ulga', sent.length === 1 && sent[0].to === 'u1' && /15 daqiqadan/.test(sent[0].t), JSON.stringify(sent));
  await lr.tick(store, A, bot, T(17, 50));
  ok('Takror ketmaydi', sent.length === 1);
  await lr.tick(store, A, bot, T(18, 0));
  ok('Aynan vaqtida', sent.length === 2 && /vaqti keldi/.test(sent[1].t));
  ok('Rad etilganga eslatma yo‘q', !sent.some(s => /Rad/.test(s.t)));
  db['leads/l1'].nextContactTime = '19:00';
  await lr.tick(store, A, bot, T(18, 45));
  ok('Vaqt o‘zgarsa — yangi vaqtga qayta eslatadi', sent.length === 3);
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato' : '✓ HAMMASI O’TDI') + ' — ' + pass + ' ta o‘tdi');
  process.exit(fail ? 1 : 0);
})();
