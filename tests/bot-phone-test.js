/* Bot: yangi odam /start → raqam → o'quvchi bo'lsa ulanadi, bo'lmasa murojaat (lead) ochiladi.
   Ishga tushirish:  node tests/bot-phone-test.js                                          */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markaz-botphone-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.TELEGRAM_BOT_TOKEN;
const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
const sent = [];
async function fakeSend(chatId, text, keyboard) { sent.push({ chatId: String(chatId), text: String(text), keyboard: keyboard || null }); return { message_id: sent.length }; }
const last = id => sent.filter(m => m.chatId === String(id)).slice(-1)[0] || {};
const hasContactBtn = m => JSON.stringify(m.keyboard || []).indexOf('request_contact') >= 0;

(async () => {
  const store = createStore();
  const B = bot._test({ store, stamp, A, send: fakeSend, tg: async () => ({}) });
  await store.set('meta/settings', { bot: { welcome: 'Xush kelibsiz', staffChats: '' } });
  await store.set('funnels/fnl_asosiy', { id: 'fnl_asosiy', name: 'Asosiy', isDefault: true });
  await store.set('students/s1', { id: 's1', firstName: 'Madina', lastName: 'Karimova', phone: '+998 90 123 45 67', status: 'faol' });
  await store.set('students/s2', { id: 's2', firstName: 'Ali', lastName: 'Valiyev', parentPhone: '+998 93 555 44 33', status: 'faol' });
  await store.set('students/s3', { id: 's3', firstName: 'Vali', lastName: 'Valiyev', parentPhone: '+998 93 555 44 33', status: 'faol' });
  const msg = (chat, text, extra) => B.onMessage(Object.assign({ chat: { id: chat, type: 'private' }, from: { id: chat, first_name: 'Test', username: 'u' + chat }, text }, extra || {}));
  const contact = (chat, phone, uid) => msg(chat, '', { contact: { phone_number: phone, user_id: uid == null ? chat : uid, first_name: 'Test' } });
  const leads = async () => (await store.list('leads/')).map(r => r.data);

  console.log('\n1. /start — raqam so’raladi');
  await msg(701, '/start');
  ok('Kontakt tugmasi bor', hasContactBtn(last(701)));

  console.log('\n2. O’quvchi raqami → darhol o’quvchi sifatida ulanadi');
  await contact(701, '998901234567');
  const s1 = await store.get('students/s1');
  ok('O’quvchi Telegramga ulandi', s1.telegram && String(s1.telegram.id) === '701');
  ok('Ulandi xabari', /ulandingiz/.test(last(701).text), last(701).text);
  ok('Murojaat ochilmadi', (await leads()).length === 0);

  console.log('\n3. Yangi odam → murojaat ERP ga tushadi');
  await msg(702, '/start');
  await contact(702, '+998 97 111 22 33');
  let L = await leads();
  ok('Bitta murojaat ochildi', L.length === 1, L.length);
  ok('Raqam va manba to’g’ri', L[0] && A.phoneDigits(L[0].phone) === A.phoneDigits('+998 97 111 22 33') && L[0].source === 'Bot' && L[0].phoneVerified === true);
  ok('Rahmat xabari', /Raqamingiz qabul qilindi/.test(last(702).text));

  console.log('\n4. Qayta yuborsa — dublikat yo’q');
  await contact(702, '+998 97 111 22 33');
  ok('Hamon bitta murojaat', (await leads()).length === 1);
  await msg(702, '/start');
  ok('Raqam berganga qayta so’ralmaydi', !hasContactBtn(last(702)));

  console.log('\n5. Begona kontakt qabul qilinmaydi');
  await msg(703, '/start');
  await contact(703, '998901234567', 999);
  ok('O’quvchi begonaga ulanmadi', String((await store.get('students/s1')).telegram.id) === '701');
  ok('Ogohlantirish', /o’zingizning raqamingizni/.test(last(703).text));
  ok('Murojaat ochilmadi', (await leads()).length === 1);

  console.log('\n6. Bir raqamda 2 o’quvchi → avtomatik ulanmaydi');
  await msg(704, '/start');
  await contact(704, '+998 93 555 44 33');
  ok('Hech kim ulanmadi', !(await store.get('students/s2')).telegram && !(await store.get('students/s3')).telegram);
  ok('Guruh kodi so’raldi', /guruh kodini/.test(last(704).text));

  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o’tdi');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
