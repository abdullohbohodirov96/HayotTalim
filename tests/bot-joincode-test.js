/* Bot: guruh kodi bilan darhol ulanish (haqiqiy Telegram ishlatilmaydi).
   Ishga tushirish:  node tests/bot-joincode-test.js                       */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markaz-joincode-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.TELEGRAM_BOT_TOKEN;
const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
const sent = [], tgCalls = [];
async function fakeSend(chatId, text, keyboard) { sent.push({ chatId: String(chatId), text: String(text), keyboard: keyboard || null }); return { message_id: sent.length }; }
const last = id => sent.filter(m => m.chatId === String(id)).slice(-1)[0] || {};

(async () => {
  const store = createStore();
  const B = bot._test({ store, stamp, A, send: fakeSend, tg: async (m, p) => { tgCalls.push({ m, p }); return { invite_link: 'https://t.me/+INV' + tgCalls.length }; } });
  await store.set('meta/settings', { bot: { notify: {} } });
  await store.set('groups/g1', { id: 'g1', code: 'B020', name: 'Arab A1', status: 'faol', joinCode: 'K7M2Q4', tgChat: '-100777' });
  await store.set('students/s1', { id: 's1', firstName: 'Madina', lastName: 'Karimova', phone: '+998 90 123 45 67' });
  await store.set('students/s2', { id: 's2', firstName: 'Ali', lastName: 'Valiyev', phone: '+998 91 000 00 00' });
  await store.set('memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', status: 'faol' });
  const msg = (chat, uid, text, extra) => B.onMessage(Object.assign({ chat: { id: chat, type: 'private' }, from: { id: uid, first_name: 'X' }, text }, extra || {}));

  console.log('\n1. To’g’ri kod + guruhdagi raqam → darhol ulanadi');
  await msg(501, 501, '/start');
  await msg(501, 501, '🎓 Men o’quvchiman');
  await msg(501, 501, 'k7m2q4');
  ok('Raqam so’raldi (kontakt tugmasi)', JSON.stringify(last(501).keyboard || '').indexOf('request_contact') >= 0, last(501).text);
  await msg(501, 501, '', { contact: { phone_number: '998901234567', user_id: 999 } });
  ok('Begona kontakt rad etildi', /o’zingizning/.test(last(501).text));
  await msg(501, 501, '', { contact: { phone_number: '+998901234567', user_id: 501 } });
  const s1 = await store.get('students/s1');
  ok('Madina bog’landi', s1.telegram && s1.telegram.id === '501', JSON.stringify(s1.telegram));
  ok('Ulanish usuli — guruh-kodi', s1.telegram && s1.telegram.via === 'guruh-kodi');
  ok('Telegram guruhga shaxsiy taklif', tgCalls.some(c => c.m === 'createChatInviteLink' && c.p.chat_id === '-100777' && c.p.member_limit === 1) && sent.some(m => m.chatId === '501' && /t\.me\/\+INV/.test(m.text)));

  console.log('\n2. Raqam guruhda yo’q → administratorga so’rov');
  await msg(502, 502, '/start');
  await msg(502, 502, '🎓 Men o’quvchiman');
  await msg(502, 502, 'K7M2Q4');
  await msg(502, 502, '', { contact: { phone_number: '998910000000', user_id: 502, first_name: 'Ali' } });
  const s2 = await store.get('students/s2');
  ok('Guruhda bo’lmagan Ali ULANMADI', !s2.telegram);
  const req = await store.get('botreq/req_502');
  ok('So’rov administratorga tushdi', req && req.groupId === 'g1' && req.status === 'kutilmoqda');

  console.log('\n3. Noto’g’ri kod — terib topishdan himoya');
  await msg(503, 503, '/start');
  for (let i = 0; i < 6; i++) await msg(503, 503, 'AB12C' + i);
  ok('5 ta xatodan keyin qulf', /Juda ko’p urinish/.test(last(503).text), last(503).text);
  await msg(504, 504, 'rahmat');
  ok('Oddiy so’z kod deb olinmaydi', !/guruh kodi topilmadi/i.test(last(504).text || ''));

  console.log('\n' + (fail ? '✗ XATOLAR BOR — ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o\'tdi, ' + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
