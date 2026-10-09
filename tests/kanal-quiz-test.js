/* Kanal viktorinasi: savollar banki, vaqt jadvali, bir slot — bir savol.
   Haqiqiy Telegramga ulanmaydi.  node tests/kanal-quiz-test.js            */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kquiz-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.TELEGRAM_BOT_TOKEN;
const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');
const BANK = require('../server/quiz-bank');
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + x : '')); } }
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
const calls = [];
async function fakeTg(method, params) { calls.push({ method, params }); return { message_id: calls.length }; }
/* Toshkent vaqti → UTC ms */
const at = (date, hm) => Date.parse(date + 'T' + hm + ':00Z') - 5 * 3600 * 1000;
(async () => {
  const store = createStore();
  const B = bot._test({ store, stamp, A, send: async () => ({}), tg: fakeTg });
  await store.set('meta/settings', { bot: {} });
  ok('Standart boshlanish: 10-oktabr', (await B.quizConf()).start === '2026-10-10');
  ok('10-oktabrdan oldin yuborilmaydi', (await B.quizTick(at('2026-10-09', '09:05'))).sent === 0);
  await store.set('meta/settings', { bot: { quizStart: '2026-10-01' } });
  /* Bank tekshiruvi */
  const bad = BANK.filter(q => !(q.question.length <= 300 && q.options.length >= 2 && q.options.length <= 10 &&
    q.options.every(o => o.length <= 100) && q.correct >= 0 && q.correct < q.options.length && (q.explain || '').length <= 200));
  ok('Bankdagi barcha savollar Telegram cheklovlariga mos', !bad.length, bad.map(q => q.id).join(','));
  ok('4 hafta: har haftada 21 ta savol', [1, 2, 3, 4].every(w => BANK.filter(q => q.id.indexOf('w' + w + 'd') === 0).length === 21));
  ok('Diniy so‘z yo‘q', !BANK.some(q => /namoz|masjid|alloh|qur.?on|ibodat|ramazon|hadis|duo/i.test(JSON.stringify(q))));
  const n = await B.ensureQuizBank();
  ok('Savollar bazaga qo‘shildi', n === BANK.length, n);
  ok('Qayta chaqirilsa takrorlanmaydi', (await B.ensureQuizBank()) === 0);
  /* Vaqt */
  ok('Toshkent vaqti: 04:00Z → 09:00', B.tashkentNow(Date.parse('2026-10-09T04:00:00Z')).hm === '09:00');
  let r = await B.quizTick(at('2026-10-09', '08:55'));
  ok('09:00 dan oldin yuborilmaydi', r.sent === 0 && calls.length === 0);
  r = await B.quizTick(at('2026-10-09', '09:02'));
  ok('09:00 slotida 1 ta savol ketdi', r.sent === 1 && calls.length === 1, JSON.stringify(r));
  const c = calls[0];
  ok('Telegram Quiz: sendPoll, type=quiz, anonim', c.method === 'sendPoll' && c.params.type === 'quiz' && c.params.is_anonymous === true);
  ok('Kanal: @SaboAcademy', c.params.chat_id === '@SaboAcademy');
  ok('To‘g‘ri javob va izoh bor', c.params.correct_option_id === BANK[0].correct && !!c.params.explanation);
  ok('Birinchi savol — w1d1s1', c.params.question === BANK[0].question);
  r = await B.quizTick(at('2026-10-09', '09:07'));
  ok('Shu slot ikkinchi marta ketmaydi', r.sent === 0 && calls.length === 1);
  r = await B.quizTick(at('2026-10-09', '14:01'));
  ok('14:00 slotida keyingi savol', r.sent === 1 && calls[1].params.question === BANK[1].question);
  r = await B.quizTick(at('2026-10-09', '23:30'));
  ok('20:00 slot 3 soatdan kech bo‘lsa o‘tkaziladi', r.sent === 0, JSON.stringify(r));
  r = await B.quizTick(at('2026-10-10', '20:10'));
  ok('Ertasi kuni 20:00 da 1 ta (09 va 14 allaqachon o‘tib ketgan)', r.sent === 1, JSON.stringify(r));
  /* O'chirish */
  await store.set('meta/settings', { bot: { quizOn: false, quizStart: '2026-10-01' } });
  r = await B.quizTick(at('2026-10-11', '09:01'));
  ok('O‘chirilgan bo‘lsa yuborilmaydi', r.sent === 0);
  await store.set('meta/settings', { bot: { quizOn: true, quizChannel: '@boshqa_kanal', quizStart: '2026-10-01' } });
  r = await B.quizTick(at('2026-10-11', '09:01'));
  ok('Kanal sozlamadan olinadi', calls[calls.length - 1].params.chat_id === '@boshqa_kanal');
  /* Qo'shish */
  const add = await B.addQuizzes([
    { id: 'w2d1s1', question: 'Sinov?', options: ['a', 'b'], correct: 1, explain: 'x' },
    { id: 'yomon', question: 'X', options: ['faqat bitta'], correct: 0 }
  ]);
  ok('Yangi savol qo‘shiladi, noto‘g‘risi rad etiladi', add.added === 1 && add.bad.length === 1, JSON.stringify(add));
  /* Bank tugasa — aylanadi */
  const list = await B.quizList();
  for (const q of list) { q.sentAt = q.sentAt || '2026-10-01 10:00'; await store.set('tgquiz/' + q.id, q); }
  const nx = await B.nextQuiz();
  ok('Hammasi yuborilgach eng eskisidan qayta boshlaydi', !!nx);
  console.log('\n' + (fail ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI') + ' — ' + pass + " ta o'tdi, " + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
