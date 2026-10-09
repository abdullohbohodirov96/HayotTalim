/* Botdagi administrator menyusi: viktorina savolini darhol yuborish,
   savol qo'shish (bosqichma-bosqich va bitta xabarda), holat, arizalar;
   mehmon uchun «Sayt» javobi. Haqiqiy Telegramga ulanmaydi.
   node tests/bot-admin-test.js                                         */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'badm-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.TELEGRAM_BOT_TOKEN;
const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + x : '')); } }
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
const sent = [];       // bot javoblari
const polls = [];      // kanalga ketgan so'rovnomalar
const ADMIN = 555111, GUEST = 777222;
(async () => {
  const store = createStore();
  const B = bot._test({
    store, stamp, A,
    send: async (chatId, text, kb) => { sent.push({ chatId: String(chatId), text, kb }); return {}; },
    tg: async (method, params) => { polls.push({ method, params }); return { message_id: polls.length }; }
  });
  await store.set('meta/settings', { bot: { staffChats: String(ADMIN), quizStart: '2026-10-01' } });
  await B.ensureQuizBank();
  const say = async (chatId, text, extra) => {
    sent.length = 0;
    await B.onMessage(Object.assign({ chat: { id: chatId, type: 'private' }, from: { id: chatId, first_name: 'Test' }, text }, extra || {}));
    return sent[sent.length - 1] || { text: '', kb: null };
  };
  const btns = kb => (kb || []).flat().map(b => b.text);

  console.log('\n1. Administrator /start');
  let r = await say(ADMIN, '/start');
  ok('Administrator menyusi chiqadi', /administrator menyusi/i.test(r.text), r.text.slice(0, 80));
  ok('Tugmalar: yuborish, qo‘shish, holat, arizalar', ['📤 Savolni hozir yuborish', '➕ Savol qo‘shish', '📊 Viktorina holati', '📝 Yangi arizalar'].every(t => btns(r.kb).indexOf(t) >= 0), btns(r.kb).join(' | '));
  r = await say(GUEST, '/start');
  ok('Oddiy foydalanuvchiga admin menyu chiqmaydi', !/administrator menyusi/i.test(r.text) && btns(r.kb).indexOf('📤 Savolni hozir yuborish') < 0);
  r = await say(GUEST, '📤 Savolni hozir yuborish');
  ok('Mehmon tugma matnini yozsa ham kanalga hech narsa ketmaydi', polls.length === 0, polls.length);

  console.log('\n2. Savolni hozir yuborish');
  r = await say(ADMIN, '📤 Savolni hozir yuborish');
  ok('Kanalga 1 ta quiz ketdi', polls.length === 1 && polls[0].method === 'sendPoll' && polls[0].params.type === 'quiz', JSON.stringify(polls[0] || {}).slice(0, 120));
  ok('Adminga tasdiq', /Kanalga yuborildi/.test(r.text), r.text.slice(0, 80));
  const first = polls[0].params.question;
  await say(ADMIN, '📤 Savolni hozir yuborish');
  ok('Ikkinchi bosishda keyingi savol (takror emas)', polls.length === 2 && polls[1].params.question !== first);

  console.log('\n3. Savol qo‘shish — bosqichma-bosqich');
  r = await say(ADMIN, '➕ Savol qo‘shish');
  ok('Savol matni so‘raladi', /Savol matnini/.test(r.text));
  r = await say(ADMIN, '"Kitob" arabchada qanday?');
  ok('Variantlar so‘raladi', /variantlarini/.test(r.text));
  r = await say(ADMIN, 'Qalam\nKitab\nBayt\nMaktab');
  ok('To‘g‘ri javob so‘raladi, 1–4 tugmalar', /to‘g‘ri javob/.test(r.text) && ['1', '2', '3', '4'].every(n => btns(r.kb).indexOf(n) >= 0), btns(r.kb).join(','));
  r = await say(ADMIN, '7');
  ok('Noto‘g‘ri raqam qabul qilinmaydi', /1 dan 4 gacha/.test(r.text));
  r = await say(ADMIN, '2');
  ok('Izoh so‘raladi', /Izoh/.test(r.text));
  r = await say(ADMIN, 'O‘tkazib yuborish');
  ok('Ko‘rib chiqish: to‘g‘ri javob belgilangan', /✅ Kitab/.test(r.text), r.text);
  const before = polls.length;
  r = await say(ADMIN, '📤 Hozir kanalga');
  ok('Hozir kanalga ketdi', polls.length === before + 1 && polls[polls.length - 1].params.question === '"Kitob" arabchada qanday?' && polls[polls.length - 1].params.correct_option_id === 1, JSON.stringify(polls[polls.length - 1].params).slice(0, 160));
  ok('Bazaga yozildi', (await B.quizList()).some(q => q.question === '"Kitob" arabchada qanday?' && q.sentAt));

  console.log('\n4. Bitta xabarda savol → navbatga');
  r = await say(ADMIN, 'Salom arabchada?\n- Shukran\n+ Marhaban\n- Ma’a salama');
  ok('Tez yo‘l tanildi', /Tekshiring/.test(r.text) && /✅ Marhaban/.test(r.text), r.text);
  const before2 = polls.length;
  r = await say(ADMIN, '⏭ Navbatga (keyingi)');
  ok('Kanalga hozir ketmadi', polls.length === before2);
  ok('Navbatdagi savol — shu', (await B.nextQuiz()).question === 'Salom arabchada?', (await B.nextQuiz()).question);
  r = await say(ADMIN, 'Faqat savol\n- a\n- b');
  ok('To‘g‘ri javobsiz xabar savol sifatida qabul qilinmaydi', !/Tekshiring/.test(r.text));
  r = await say(ADMIN, '<b>x</b>?\n+ <i>1</i>\n- 2');
  ok('HTML ekranlanadi', /&lt;b&gt;x&lt;\/b&gt;/.test(r.text), r.text);
  await say(ADMIN, '✖️ Bekor qilish');
  ok('Bekor qilinsa saqlanmaydi', !(await B.quizList()).some(q => /<b>x/.test(q.question)));

  console.log('\n5. Holat va yoqish/o‘chirish');
  r = await say(ADMIN, '📊 Viktorina holati');
  ok('Holat: kanal, savollar soni, navbatdagi', /@SaboAcademy/.test(r.text) && /hali yuborilmagan/.test(r.text) && /Navbatdagi savol/.test(r.text), r.text.slice(0, 200));
  r = await say(ADMIN, '⏯ Viktorinani yoqish/o‘chirish');
  ok('O‘chirildi', /to‘xtatildi/.test(r.text) && (await B.quizConf()).on === false);
  ok('Boshqa sozlamalar saqlanib qoldi', ((await store.get('meta/settings')).bot || {}).staffChats === String(ADMIN));
  r = await say(ADMIN, '⏯ Viktorinani yoqish/o‘chirish');
  ok('Qayta yoqildi', (await B.quizConf()).on === true);

  console.log('\n6. Arizalar');
  await store.set('leads/l1', { id: 'l1', name: 'Malika <script>', phone: '+998 90 111 22 33', source: 'Sayt', createdAt: stamp(), note: 'Tekin dars' });
  r = await say(ADMIN, '📝 Yangi arizalar');
  ok('Ariza ko‘rinadi', /Malika/.test(r.text) && /\+998 90 111 22 33/.test(r.text), r.text.slice(0, 200));
  ok('Ism ekranlangan', /&lt;script&gt;/.test(r.text) && !/<script>/.test(r.text));
  ok('ERP havolasi bor', /#leads/.test(r.text));

  console.log('\n7. Mehmon: sayt so‘rasa');
  r = await say(GUEST, 'web saytingiz bormi?');
  ok('Sayt manzili beriladi', /🌐 Saytimiz: https?:\/\//.test(r.text), r.text.slice(0, 100));
  r = await say(GUEST, '🌐 Sayt');
  ok('«Sayt» tugmasi ishlaydi', /Saytimiz/.test(r.text) && /#test/.test(r.text), r.text.slice(0, 100));
  r = await say(GUEST, '/start');
  ok('Mehmon menyusida «Sayt» tugmasi bor', btns(r.kb).indexOf('🌐 Sayt') >= 0, btns(r.kb).join(' | '));

  console.log('\n' + (fail ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI') + ' — ' + pass + " ta o'tdi, " + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
