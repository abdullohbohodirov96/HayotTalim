/* Target (Meta Lead Ads) → murojaat. Serversiz: node tests/meta-leads-test.js */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.DATA_DIR = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'meta-')), 'data');
process.env.META_PAGE_TOKEN = 'x';
const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const M = require('../server/meta-leads');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } };
(async () => {
  const store = createStore();
  await store.set('funnels/f1', { id: 'f1', name: 'Asosiy', stages: [{ id: 'yangi', name: 'Yangi' }] });
  await store.set('funnels/f2', { id: 'f2', name: 'Target reklama', autoSource: 'Target', stages: [{ id: 'yangi', name: 'Yangi' }] });
  global.fetch = async () => ({ ok: true, json: async () => ({ platform: 'ig', campaign_name: 'AB | Lead', adset_name: 'Women 20-45', ad_name: 'noldan-A0',
    field_data: [{ name: 'full_name', values: ['Malika Karimova'] }, { name: 'phone_number', values: ['+998901234567'] },
      { name: 'kim_uchun_yozilmoqchisiz?', values: ['Ayollar guruhiga'] }, { name: 'qachon_qo‘ng‘iroq_qilsak_qulay?', values: ['Kechqurun'] }] }) });
  const sent = [];
  const ctx = { store, A, stamp: () => '2026-10-26 12:00', notify: t => sent.push(t) };
  await M.saveLead(ctx, '111');
  const ls = (await store.list('leads/')).map(x => x.data);
  ok('Murojaat yaratildi', ls.length === 1 && ls[0].name === 'Malika Karimova');
  ok('«Target reklama» voronkasiga tushdi', ls[0].funnelId === 'f2', ls[0].funnelId);
  ok('Telefon to‘g‘ri', A.phoneDigits(ls[0].phone).slice(-9) === '901234567', ls[0].phone);
  ok('Manba: Target (Instagram), reklama nomi', ls[0].source === 'Target (Instagram)' && /noldan-A0/.test(ls[0].src));
  ok('Savollarga javoblar izohda', /Ayollar guruhiga/.test(ls[0].note) && /Kechqurun/.test(ls[0].note), ls[0].note);
  ok('Savollar o‘z joyiga tushdi (kim uchun, vaqt)', ls[0].audience === 'Ayollar guruhiga' && ls[0].wantTime === 'Kechqurun', JSON.stringify([ls[0].audience, ls[0].wantTime]));
  ok('Xodimlarga xabar ketdi', sent.length === 1 && /Malika/.test(sent[0]));
  await M.saveLead(ctx, '111');
  ok('Bir xil webhook ikki marta — bitta murojaat', (await store.list('leads/')).length === 1);
  await M.saveLead(ctx, '222');
  ok('Shu raqam qayta yozilsa — yangi murojaat ochilmaydi', (await store.list('leads/')).length === 1);
  /* Polling: formalar → arizalar */
  const calls = [];
  global.fetch = async (u) => { calls.push(u); const j = /me\?fields=id/.test(u) ? { id: 'P1' } : /leadgen_forms/.test(u) ? { data: [{ id: 'F1' }] } : /\/leads\?/.test(u) ? { data: [{ id: '333' }, { id: '111' }] }
    : { platform: 'fb', field_data: [{ name: 'full_name', values: ['Ali Valiyev'] }, { name: 'phone_number', values: ['+998935556677'] }] };
    return { ok: true, json: async () => j }; };
  const pr = await M.pollOnce(ctx);
  ok('Polling: yangi ariza tortib olindi', pr.added === 2 && (await store.list('leads/')).length === 2, JSON.stringify(pr));
  const pr2 = await M.pollOnce(ctx);
  ok('Polling: qayta tekshiruvda takrorlanmaydi', pr2.added === 0 && (await store.list('leads/')).length === 2);
  console.log(fail ? '✗ ' + fail + ' xato' : '✓ HAMMASI O’TDI — ' + pass + ' ta');
  process.exit(fail ? 1 : 0);
})();
