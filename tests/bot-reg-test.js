/* Bot: bepul darsga ro'yxat voronkasi sinovi (haqiqiy Telegram ishlatilmaydi).
   Ishga tushirish:  node tests/bot-reg-test.js                              */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markaz-botreg-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.TELEGRAM_BOT_TOKEN;

const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
const sent = [];
async function fakeSend(chatId, text, keyboard) {
  sent.push({ chatId: String(chatId), text: String(text), keyboard: keyboard || null });
  return { message_id: sent.length };
}
const last = id => sent.filter(m => m.chatId === String(id)).slice(-1)[0] || {};

(async () => {
  const store = createStore();
  const B = bot._test({ store, stamp, A, send: fakeSend });
  await store.set('meta/settings', {
    centerName: 'Sinov markazi',
    bot: { welcome: 'Xush kelibsiz', staffChats: '' },
    freeLesson: { title: 'Arab harflari', date: '2026-10-20', time: '20:30', channel: 'https://t.me/+abc123' }
  });
  await store.set('funnels/fnl_asosiy', { id: 'fnl_asosiy', name: 'Asosiy', isDefault: true });
  const from = { id: 555, first_name: 'Madina', username: 'madina' };
  const msg = (text, extra) => B.onMessage(Object.assign({ chat: { id: 555, type: 'private' }, from, text }, extra || {}));

  await msg('/start dars_reels1');
  ok('Reklama havolasi ro’yxatni boshlaydi', /Ismingiz/.test(last(555).text), last(555).text);
  ok('Ism tugmasi taklif qilindi', JSON.stringify(last(555).keyboard || '').indexOf('Madina') >= 0);
  await msg('Madina');
  ok('Raqam so’raldi (kontakt tugmasi bilan)', JSON.stringify(last(555).keyboard || '').indexOf('request_contact') >= 0);
  await msg('', { contact: { phone_number: '998901234567', user_id: 999 } });
  ok('Begona kontakt qabul qilinmaydi', /o’zingizning/.test(last(555).text), last(555).text);
  await msg('', { contact: { phone_number: '998901234567', user_id: 555 } });
  ok('Hudud so’raldi', /hudud/i.test(last(555).text), last(555).text);
  await msg('Marsda');
  ok('Ro’yxatdan tashqari hudud qabul qilinmaydi', /Ro’yxatdan/.test(last(555).text));
  await msg('Namangan');
  ok('Kanal havolasi berildi', /t\.me\/\+abc123/.test(last(555).text), last(555).text);
  const leads = (await store.list('leads/')).map(x => x.data);
  ok('Bitta murojaat yaratildi', leads.length === 1, leads.length);
  const L = leads[0] || {};
  ok('Manba: Bot, belgi: reels1', L.source === 'Bot' && L.src === 'reels1', L.source + ' ' + L.src);
  ok('Hudud saqlandi', L.region === 'Namangan');
  ok('Raqam saqlandi', A.phoneDigits(L.phone) === '901234567', L.phone);
  ok('Chat ID saqlandi (eslatma yuborish uchun)', L.chatId === '555');
  ok('Voronkaga tushdi', L.funnelId === 'fnl_asosiy');

  await msg('salom');
  ok('Qayta yozsa — ro’yxatda ekanini aytadi', /yozilgansiz/.test(last(555).text));

  /* Takroriy ro'yxat: yangi lead yaratilmaydi */
  await msg('/start dars_posev2');
  await msg('Madina'); await msg('+998 90 123 45 67'); await msg('Toshkent shahri');
  const leads2 = (await store.list('leads/')).map(x => x.data);
  ok('Bir raqam ikki marta lead bo’lmaydi', leads2.length === 1, leads2.length);
  ok('Hudud yangilandi, birinchi reklama belgisi saqlanadi', leads2[0].region === 'Toshkent shahri' && leads2[0].src === 'reels1');

  /* Oddiy /start: kod so'raydi va ro'yxat tugmasini ko'rsatadi */
  await B.onMessage({ chat: { id: 777, type: 'private' }, from: { id: 777 }, text: '/start' });
  ok('Oddiy /start — savol taklifi va ro’yxat tugmasi', /savolingizni yozing/i.test(last(777).text) &&
    JSON.stringify(last(777).keyboard || '').indexOf('Bepul darsga') >= 0);
  /* Savollarga javob */
  const ask = t => B.onMessage({ chat: { id: 888, type: 'private' }, from: { id: 888, first_name: 'Dilnoza', username: 'dil' }, text: t });
  await ask('/start');
  await ask('Narxi qancha?');
  ok('Narx savoli: administrator aytadi, narx yozilmaydi', /administrator/i.test(last(888).text) && !/\d{3}\s?\d{3}\s?so/i.test(last(888).text), last(888).text);
  await ask('Darslar qachon bo‘ladi?');
  ok('Vaqt savoli: haftada 3 marta', /haftada 3 marta/.test(last(888).text), last(888).text);
  await ask('Когда занятия онлайн?');
  ok('Kirillcha savol ham tushuniladi', /Zoom|haftada/.test(last(888).text), last(888).text);
  await ask('❓ Savollar');
  ok('Savollar ro‘yxati', /Ko‘p so‘raladigan/.test(last(888).text));
  await ask('3');
  ok('Raqam bilan savol tanlash', /haftada 3 marta/i.test(last(888).text), last(888).text);
  const before = (await store.list('leads/')).length;
  await ask('Sizlarda yotoqxona bormi?');
  ok('Bilmagan savolda raqam so‘raydi', /telefon raqamingizni/i.test(last(888).text), last(888).text);
  await B.onMessage({ chat: { id: 888, type: 'private' }, from: { id: 888, first_name: 'Dilnoza', username: 'dil' }, text: '', contact: { phone_number: '998935554433', user_id: 888 } });
  const ld = (await store.list('leads/')).map(x => x.data).filter(l => /yotoqxona/.test(l.note || ''))[0];
  ok('Savol murojaatga yozildi (raqam bilan)', !!ld && A.phoneDigits(ld.phone) === '935554433' && (await store.list('leads/')).length === before + 1, JSON.stringify(ld));
  ok('Javob: administratorga yuborildi', /administratorga yuborildi/.test(last(888).text));
  await B.onMessage({ chat: { id: 777, type: 'private' }, from: { id: 777 }, text: 'Bepul darsga yozilish' });
  ok('Tugma ro’yxatni boshlaydi', /Ismingiz/.test(last(777).text));
  ok('Belgi tozalanadi', B.regSrc('dars_reels<script>') === 'reelsscript');

  console.log(out.join('\n'));
  console.log('\n' + (fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
