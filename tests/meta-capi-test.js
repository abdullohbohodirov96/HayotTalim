/* Meta Conversions API (CRM): bosqich o'zgarsa Meta'ga hodisa ketadimi.
   Haqiqiy Meta'ga ulanmaydi. node tests/meta-capi-test.js            */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.DATA_DIR = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'capi-')), 'data');
process.env.META_DATASET_ID = '1234567890';
process.env.META_CAPI_TOKEN = 'test-token';
const { createStore } = require('../server/store');
const capi = require('../server/meta-capi');
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + x : '')); } }
const posts = [];
let failNext = false;
capi._test.setPost(async json => { if (failNext) { failNext = false; throw new Error('tarmoq'); } posts.push(JSON.parse(json.replace(/"lead_id":(\d+)/g, '"lead_id":"$1"'))); posts[posts.length - 1].raw = json; return { events_received: 1 }; });
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const store = createStore();
  capi.start({ store });
  await store.set('funnels/fnl_target', { id: 'fnl_target', stages: [{ id: 'yangi', label: 'Yangi lid' }, { id: 'boglanildi', label: 'Bog’lanildi' }, { id: 'oquvchi', label: 'O’quvchi bo’ldi', type: 'won' }, { id: 'x1', label: 'Sinovga keldi' }] });
  const L = { id: 'led_1', funnelId: 'fnl_target', name: 'Malika Karimova', phone: '+998 90 111 22 33', stage: 'yangi', metaLeadId: '9876543210123456789' };

  console.log('\n1. Yangi lead');
  ok('Navbatga tushdi', await capi.onLeadSaved(null, L) === 1);
  await capi.flush();
  const e = posts[0] && posts[0].data[0];
  ok('Hodisa «Lead», CRM manbasi', e && e.event_name === 'Lead' && e.custom_data.event_source === 'crm' && e.action_source === 'system_generated');
  ok('lead_id katta son — aniqligi saqlandi (qo‘shtirnoqsiz)', /"lead_id":9876543210123456789[,}]/.test(posts[0].raw), posts[0] && posts[0].raw);
  ok('Telefon hash qilingan (998…)', e && e.user_data.ph[0] === require('crypto').createHash('sha256').update('998901112233').digest('hex'));
  ok('Ochiq telefon/ism yuborilmaydi', !/901112233|Malika/.test(posts[0].raw));

  console.log('\n2. Bosqich o‘zgarishi');
  posts.length = 0;
  const L2 = Object.assign({}, L, { stage: 'boglanildi' });
  await capi.onLeadSaved(L, L2); await capi.flush();
  ok('«Boglanildi» ketdi', posts.length === 1 && posts[0].data[0].event_name === 'Boglanildi');
  posts.length = 0;
  await capi.onLeadSaved(L2, Object.assign({}, L2, { note: 'izoh' })); await capi.flush();
  ok('Faqat izoh o‘zgarsa — hech narsa ketmaydi', posts.length === 0);
  await capi.onLeadSaved(L2, L); await capi.onLeadSaved(L, L2); await capi.flush();
  ok('Qaytib-qaytib o‘tkazilsa — takror yuborilmaydi', posts.length === 0, posts.length);
  const L3 = Object.assign({}, L2, { stage: 'x1' });
  await capi.onLeadSaved(L2, L3); await capi.flush();
  ok('O‘zimiz qo‘shgan bosqich nomi → «SinovgaKeldi»', posts[0] && posts[0].data[0].event_name === 'SinovgaKeldi', posts[0] && posts[0].data[0].event_name);

  console.log('\n3. Xato bo‘lsa qayta urinish');
  posts.length = 0; failNext = true;
  const L4 = Object.assign({}, L3, { stage: 'oquvchi' });
  await capi.onLeadSaved(L3, L4); await capi.flush();
  ok('Birinchi urinish xato → navbatda qoldi', (await store.list('capiq/')).length === 1 && (await capi.status()).lastError === 'tarmoq');
  const q = (await store.list('capiq/'))[0].data; q.next = 0; await store.set('capiq/' + q.id, q);
  await capi.flush();
  ok('Keyingi urinishda ketdi «OquvchiBoldi»', posts.length === 1 && posts[0].data[0].event_name === 'OquvchiBoldi' && (await store.list('capiq/')).length === 0);

  console.log('\n4. Meta formasidan emas (sayt formasi)');
  posts.length = 0;
  await capi.onLeadSaved(null, { id: 'led_2', name: 'Ali', phone: '90 555 66 77', stage: 'yangi' }); await capi.flush();
  ok('Faqat hash telefon bilan ketdi', posts.length === 1 && !posts[0].data[0].user_data.lead_id && posts[0].data[0].user_data.ph.length === 1);
  await capi.onLeadSaved(null, { id: 'led_3', name: 'X', phone: '', stage: 'yangi' });
  ok('Telefoni ham, Meta ID si ham yo‘q — yuborilmaydi', (await store.list('capiq/')).length === 0);

  console.log('\n5. Sozlanmagan bo‘lsa');
  delete process.env.META_CAPI_TOKEN;
  ok('Token yo‘q — hech narsa navbatga tushmaydi', await capi.onLeadSaved(null, { id: 'led_4', phone: '901234567', stage: 'yangi' }) === 0);
  ok('Holat: configured=false', (await capi.status()).configured === false);

  console.log('\n' + pass + ' o‘tdi, ' + fail + ' xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
