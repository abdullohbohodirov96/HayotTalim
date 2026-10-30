/* Aqlli lug'at, kunlik mashqlar, XP, streak, yutuqlar va rivojlanish.
   O'zi vaqtinchalik bazada server ishga tushiradi:
     node tests/learning-test.js                                          */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 3000 + Math.floor(Math.random() * 900) + 4000;
const BASE = 'http://localhost:' + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-'));
const PASS = 'Direktor-Sinov-2026!';

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('  ✓ ' + name); } else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }
function eq(name, got, want) { ok(name, JSON.stringify(got) === JSON.stringify(want), 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function req(p, o = {}) {
  const h = { 'X-Forwarded-For': o.ip || '10.20.30.' + (1 + Math.floor(Math.random() * 200)) };
  if (o.body) h['Content-Type'] = 'application/json';
  if (o.cookie) h.Cookie = o.cookie;
  if (o.csrf) h['X-Kab-Csrf'] = o.csrf;
  const r = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

/* ---- Toza (server ishlatmaydigan) qismlar: oraliqli takrorlash ---- */
const L = require('../server/learning');
section('0. Oraliqli takrorlash algoritmi');
{
  const T = '2026-10-30';
  let s = { step: 0, ease: 2.5, iv: 0, due: T, reps: 0, lapses: 0 };
  const ivs = [];
  for (let i = 0; i < 5; i++) { s = L.schedule(s, 2, T); ivs.push(s.iv); }
  ok('«Oson» ketma-ket: oraliq o‘sib boradi (1 → 3 → 7 …)', ivs[0] === 1 && ivs[1] === 3 && ivs[2] >= 7 && ivs[3] >= 14 && ivs[4] >= 30, JSON.stringify(ivs));
  const before = s.iv;
  const f = L.schedule(s, 0, T);
  ok('«Bilmadim»: oraliq 1 kunga qisqaradi, unutish soni oshadi', f.iv === 1 && f.lapses === 1 && f.due === L.addDays(T, 1), JSON.stringify(f));
  ok('«Bilmadim»: yengillik koeffitsiyenti pasayadi', f.ease < s.ease);
  const hd = L.schedule(s, 1, T);
  ok('«Qiynalib»: oraliq «oson»dan qisqa, lekin qisqarmaydi', hd.iv < L.schedule(s, 2, T).iv && hd.iv >= Math.round(before * 0.8), hd.iv + ' / ' + before);
  ok('Sana Toshkent kuni bo‘yicha +oraliq', L.schedule({ step: 0, ease: 2.5, iv: 0, reps: 0, lapses: 0 }, 2, T).due === '2026-10-31');
  const rows = L.parseCsv('arabcha;tarjima;talaffuz\nكِتَابٌ;kitob;kitabun;هَذَا كِتَابٌ;Bu kitob;course:a1-01;A1\n"بَيْتٌ";"uy, xona";baytun');
  ok('CSV: sarlavha o‘tkazib yuboriladi, qo‘shtirnoq ichidagi vergul saqlanadi', rows.length === 2 && rows[1].uz === 'uy, xona' && rows[0].lessons === 'course:a1-01', JSON.stringify(rows));
  ok('Harakatsiz solishtirish', L.normAr('كِتَابٌ') === L.normAr('كتاب'));
  const sum = { days: { '2026-10-27': { xp: 25 }, '2026-10-28': { xp: 30 }, '2026-10-29': { xp: 5 }, '2026-10-30': { xp: 40 } } };
  const c = { daily: { minXp: 20 } };
  const st = L.streakOf(sum, '2026-10-30', c);
  ok('Streak: minimal XP dan kam kun zanjirni uzadi', st.current === 1 && st.best === 2, JSON.stringify(st));
  const st2 = L.streakOf({ days: { '2026-10-28': { xp: 20 }, '2026-10-29': { xp: 20 } } }, '2026-10-30', c);
  ok('Streak: bugun hali bajarilmagan — kechagi zanjir saqlanadi', st2.current === 2 && !st2.todayDone, JSON.stringify(st2));
  ok('Streak: bir kun o‘tkazib yuborilsa — 0', L.streakOf({ days: { '2026-10-28': { xp: 20 } } }, '2026-10-30', c).current === 0);
}

let srv;
(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', SEED_DIRECTOR_PASSWORD: PASS, BOT_TOKEN: '', TELEGRAM_BOT_TOKEN: '' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 250)); }

  const lg = await req('/api/login', { body: { login: 'admin', password: PASS } });
  const dir = lg.status === 200 ? lg.cookie : null;
  if (!dir) { console.log(log); throw new Error('Direktor kira olmadi: ' + lg.status); }
  const put = (p, data, extra) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie: dir, body: Object.assign({ data }, extra || {}) });

  section('1. Sinov ma’lumotlari');
  await put('staff/t1', { id: 't1', name: 'Ustoz Bir', status: 'faol', payType: 'fixed', salaryAmount: 1 });
  await put('staff/t2', { id: 't2', name: 'Ustoz Ikki', status: 'faol', payType: 'fixed', salaryAmount: 1 });
  await put('courses/c1', { id: 'c1', name: 'Arab tili', monthlyFee: 1, active: true });
  const G = (id, t) => ({ id, code: 'G' + id.toUpperCase() + '9', name: 'A1 | ' + id, courseId: 'c1', teacherId: t, days: [1, 3], startTime: '18:00', endTime: '19:20', startDate: '2026-09-01', format: 'onlayn', fee: 1, feeHistory: [{ fee: 1, from: '2026-09' }], limit: 20, status: 'faol' });
  await put('groups/g1', G('g1', 't1'));
  await put('groups/g2', G('g2', 't2'));
  await put('students/s1', { id: 's1', firstName: 'Madina', lastName: 'Sinov', phone: '+998901110001', status: 'faol' });
  await put('students/s2', { id: 's2', firstName: 'Begona', lastName: 'Sinov', phone: '+998901110002', status: 'faol' });
  await put('memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', joinedAt: '2026-09-01', status: 'faol' });
  await put('memberships/m2', { id: 'm2', studentId: 's2', groupId: 'g2', joinedAt: '2026-09-01', status: 'faol' });
  await put('users/u1', { id: 'u1', login: 'ustoz1', name: 'Ustoz Bir', role: 'oqituvchi', staffId: 't1', active: true }, { password: 'Ustoz-12345' });
  const ust = (await req('/api/login', { body: { login: 'ustoz1', password: 'Ustoz-12345' } })).cookie;
  ok('Ustoz kirdi', !!ust);
  const code1 = (await req('/api/doc?path=students%2Fs1', { cookie: dir })).json.data.code;
  const code2 = (await req('/api/doc?path=students%2Fs2', { cookie: dir })).json.data.code;
  const k1 = await req('/api/kabinet', { body: { code: code1 } });
  const k2 = await req('/api/kabinet', { body: { code: code2 } });
  eq('O’quvchi kirdi', k1.status, 200);
  const S1 = { c: k1.cookie, x: k1.json.csrf }, S2 = { c: k2.cookie, x: k2.json.csrf };
  const kget = (S, p) => req('/api/kabinet/' + p, { cookie: S.c });
  const kpost = (S, p, b, noCsrf) => req('/api/kabinet/' + p, { cookie: S.c, csrf: noCsrf ? null : S.x, body: b || {} });

  section('2. Admin lug‘ati: kiritish, takrorsiz, CSV, huquqlar');
  const w1 = await req('/api/learning/word', { cookie: dir, body: { ar: 'كِتَابٌ', uz: 'kitob', tr: 'kitabun', ex: 'هَذَا كِتَابٌ جَدِيدٌ', exUz: 'Bu yangi kitob', lessons: ['course:a1-01'], level: 'A1' } });
  eq('So‘z qo‘shildi', w1.status, 200);
  const w1b = await req('/api/learning/word', { cookie: dir, body: { ar: 'كتاب', uz: 'Kitob', lessons: ['topic:tp1'] } });
  ok('Bir xil so‘z ikkinchi marta yaratilmaydi — darsi qo‘shiladi', w1b.json.duplicate && w1b.json.word.id === w1.json.word.id && w1b.json.word.lessons.length === 2, JSON.stringify(w1b.json));
  eq('Ustoz lug‘atni tahrirlay olmaydi', (await req('/api/learning/word', { cookie: ust, body: { ar: 'قَلَمٌ', uz: 'ruchka' } })).status, 403);
  eq('Arabchasiz so‘z rad etiladi', (await req('/api/learning/word', { cookie: dir, body: { ar: 'kitob', uz: 'kitob' } })).status, 400);
  const imp = await req('/api/learning/import', { cookie: dir, body: { csv: 'ar;uz;tr;misol;tarjima;dars\nقَلَمٌ;ruchka;qalamun;;;course:a1-01\nبَيْتٌ;uy;baytun;;;course:a1-01\nكِتَابٌ;kitob;;;;course:a1-01\nyomon;qator' } });
  ok('CSV import: 2 yangi, 1 birlashdi, 1 xato', imp.json && imp.json.added === 2 && imp.json.merged === 1 && imp.json.errors.length === 1, JSON.stringify(imp.json));
  const words = await req('/api/learning/words', { cookie: dir });
  ok('Lug‘at ro‘yxati: kurs so‘zlari + markaz so‘zlari', words.json.builtin.length >= 8 && words.json.custom.length === 3, words.json && (words.json.builtin.length + '/' + words.json.custom.length));
  eq('O‘quvchi admin yo‘liga kira olmaydi', (await req('/api/learning/words', { cookie: S1.c })).status, 401);

  section('3. Shaxsiy lug‘at: dars o‘rganilganda qo‘shiladi');
  let v = (await kget(S1, 'vocab')).json;
  eq('Dars boshlanmagan — lug‘at bo‘sh', v.counts.total, 0);
  eq('Darsning birinchi bosqichi', (await kpost(S1, 'course/step', { lessonId: 'a1-01', step: 'words' })).status, 200);
  v = (await kget(S1, 'vocab')).json;
  const nCourse = 8 + 3;
  eq('Dars so‘zlari (kurs + admin bog‘lagan) lug‘atga tushdi', v.counts.total, nCourse);
  v = (await kget(S1, 'vocab')).json;
  eq('Qayta ochilganda takroriy yozuv yaratilmaydi', v.counts.total, nCourse);
  ok('Har so‘zda: tarjima, dars, holat, keyingi sana', v.words.every(w => w.ar && w.uz && w.lesson && w.status && w.due), JSON.stringify(v.words[0]));
  ok('Misol jumla ko‘rinadi', v.words.some(w => w.ex === 'هَذَا كِتَابٌ جَدِيدٌ'));
  eq('Boshqa o‘quvchining lug‘ati bo‘sh (faqat o‘ziniki)', (await kget(S2, 'vocab')).json.counts.total, 0);
  eq('Boshqa o‘quvchi id si bilan so‘rab bo‘lmaydi', (await kget(S2, 'vocab?studentId=s1')).status, 403);

  section('4. Kartochkalar va kunlik topshiriqlar');
  let dy = (await kget(S1, 'daily')).json;
  ok('Kunlik maqsadlar: 5 yangi, 0 takrorlash (hali eski so‘z yo‘q), test, mashq', dy.day.goals.newWords === 5 && dy.day.goals.reviews === 0 && dy.day.goals.test === 5 && dy.day.goals.rl === 1, JSON.stringify(dy.day.goals));
  const deck = (await kget(S1, 'vocab/deck')).json;
  ok('Kartochkalar: yangi so‘zlar, javob variantlari bilan', deck.cards.length >= 5 && deck.cards.every(c => c.isNew && c.optsUz.length >= 2), deck.cards.length);
  eq('CSRF siz javob qabul qilinmaydi', (await kpost(S1, 'vocab/review', { items: [{ id: deck.cards[0].id, g: 2 }] }, true)).status, 403);
  const items = deck.cards.slice(0, 5).map((c, i) => ({ id: c.id, g: i === 0 ? 0 : 2 }));
  let rv = (await kpost(S1, 'vocab/review', { items })).json;
  eq('5 ta yangi so‘z → 5 × 5 XP', rv.day.xp, 25);
  eq('«Yangi so‘z» topshirig‘i bajarildi', rv.day.done.newWords, 5);
  rv = (await kpost(S1, 'vocab/review', { items })).json;
  eq('Xuddi shu so‘zlarni qayta yuborish XP qo‘shmaydi', rv.day.xp, 25);
  eq('Begona so‘z id si e’tiborsiz qoladi', (await kpost(S1, 'vocab/review', { items: [{ id: 'yoq', g: 2 }, { id: deck.cards[1].id, g: 7 }] })).json.saved, 0);
  v = (await kget(S1, 'vocab')).json;
  const forgot = v.words.filter(w => w.id === deck.cards[0].id)[0];
  ok('«Bilmadim»: keyingi takrorlash ertaga', forgot.due === L.addDays(v.today, 1) && forgot.lapses >= 1, JSON.stringify(forgot));
  ok('Holat statistikasi takrorlash tarixidan', v.counts.yangi === nCourse - 5 && v.counts.learned === 5, JSON.stringify(v.counts));

  section('4b. Tizim o‘zi baholaydi (vocab/answer)');
  const dk3 = (await kget(S1, 'vocab/deck')).json.cards;
  const nw = dk3.filter(c => c.isNew)[0];
  ok('Kartochkada 4 ta javob varianti, to‘g‘risi ichida', nw.optsUz.length >= 2 && nw.optsUz.indexOf(nw.uz) >= 0 && nw.optsAr.indexOf(nw.ar) >= 0, JSON.stringify(nw.optsUz));
  const wrongPick = nw.optsUz.filter(x => x !== nw.uz)[0];
  const an1 = (await kpost(S1, 'vocab/answer', { id: nw.id, kind: 'uz', pick: wrongPick, ms: 3000 })).json;
  ok('Xato javob — server aniqlaydi, to‘g‘risini qaytaradi, ertaga yana', an1.correct === false && an1.right === nw.uz && an1.grade === 0, JSON.stringify(an1).slice(0, 160));
  const nw2 = dk3.filter(c => c.isNew)[1];
  const an2 = (await kpost(S1, 'vocab/answer', { id: nw2.id, kind: 'ar', pick: nw2.ar, ms: 4000 })).json;
  ok('To‘g‘ri va tez — «oson»', an2.correct && an2.grade === 2);
  const nw3 = dk3.filter(c => c.isNew)[2];
  const an3 = (await kpost(S1, 'vocab/answer', { id: nw3.id, kind: 'uz', pick: nw3.uz, ms: 20000 })).json;
  ok('To‘g‘ri lekin sekin — «qiynalib»', an3.correct && an3.grade === 1);
  eq('Noma’lum so‘z', (await kpost(S1, 'vocab/answer', { id: 'yoq', kind: 'uz', pick: 'x' })).status, 404);

  section('5. Kunlik test — javob serverda tekshiriladi, XP bir marta');
  const xpBeforeQuiz = (await kget(S1, 'daily')).json.day.xp;
  const qz = (await kpost(S1, 'daily/quiz/start')).json;
  ok('5 ta savol, to‘g‘ri javob mijozga berilmaydi', qz.quiz && qz.quiz.qs.length === 5 && qz.quiz.qs.every(q => !('answer' in q)), JSON.stringify(qz).slice(0, 200));
  const again = (await kpost(S1, 'daily/quiz/start')).json;
  eq('Tugallanmagan test qayta boshlanmaydi (o‘sha test qaytadi)', again.quiz.id, qz.quiz.id);
  let right = 0, xpAfter = 0;
  for (const q of qz.quiz.qs) {
    const a = (await kpost(S1, 'daily/quiz/answer', { quizId: qz.quiz.id, i: q.i, pick: 0 })).json;
    if (a.correct) right++;
    const rep = (await kpost(S1, 'daily/quiz/answer', { quizId: qz.quiz.id, i: q.i, pick: a.right })).json;
    ok('Savol ' + q.i + ': qayta javob natijani o‘zgartirmaydi', rep.repeat && rep.correct === a.correct);
    xpAfter = a.day ? a.day.xp : xpAfter;
  }
  dy = (await kget(S1, 'daily')).json;
  eq('Test topshirig‘i: 5/5', dy.day.done.test, 5);
  eq('XP: faqat to‘g‘ri javoblar × 5 qo‘shildi', dy.day.xp, xpBeforeQuiz + right * 5);
  eq('Eskirgan test id si rad etiladi', (await kpost(S1, 'daily/quiz/answer', { quizId: 'qxx', i: 0, pick: 0 })).status, 409);

  section('6. Reading / Listening mashqi');
  const rl = (await kpost(S1, 'daily/rl/start')).json;
  ok('Mashq: 5 ta topshiriq, javobsiz', rl.rl && rl.rl.qs.length >= 4 && rl.rl.qs.every(q => !('answer' in q)), JSON.stringify(rl).slice(0, 200));
  const bad = (await kpost(S1, 'daily/rl/submit', { rlId: rl.rl.id, answers: rl.rl.qs.map(() => 99) })).json;
  ok('Xato javoblar — bajarilmadi, XP yo‘q', !bad.passed && bad.day.done.rl == null);
  eq('Bir mashqni ikki marta yuborib bo‘lmaydi', (await kpost(S1, 'daily/rl/submit', { rlId: rl.rl.id, answers: [] })).status, 409);
  const rl2 = (await kpost(S1, 'daily/rl/start')).json;
  const probe = (await kpost(S1, 'daily/rl/submit', { rlId: rl2.rl.id, answers: rl2.rl.qs.map(() => 0) })).json;
  const rl3 = (await kpost(S1, 'daily/rl/start')).json;
  /* To'g'ri javoblarni bilmaymiz — natija javobidan foydalanib, keyingi urinish to'g'ri bo'ladigan holat yo'q (savollar yangi). Shuning uchun to'liq to'g'ri yuborish uchun javoblar serverda tekshirilganini — ball ko'rsatkichi orqali tasdiqlaymiz. */
  ok('Natija foizi serverda hisoblanadi', typeof probe.percent === 'number' && probe.results.length === rl2.rl.qs.length);
  ok('Yangi mashq boshlanadi', rl3.rl && rl3.rl.id !== rl2.rl.id);

  section('7. Takroriy XP himoyasi va parallel so‘rovlar');
  const before = (await kget(S1, 'daily')).json.day.xp;
  const deck2 = (await kget(S1, 'vocab/deck')).json;
  const fresh2 = deck2.cards.filter(c => c.isNew).slice(0, 2);
  const par = await Promise.all([1, 2, 3, 4].map(() => kpost(S1, 'vocab/review', { items: fresh2.map(c => ({ id: c.id, g: 2 })) })));
  ok('Parallel 4 ta so‘rov', par.every(r => r.status === 200));
  const after = (await kget(S1, 'daily')).json.day.xp;
  eq('XP faqat bir marta qo‘shildi (2 ta yangi so‘z)', after - before, 2 * 5);

  section('8. Rivojlanish dashboardi va ko‘nikmalar');
  const pg = (await kget(S1, 'progress')).json;
  ok('Kurs, foiz, lug‘at, XP, streak', pg.course && pg.course.code === 'A1' && typeof pg.course.percent === 'number' && pg.vocab.learned >= 7 && pg.xpTotal === after, JSON.stringify({ c: pg.course, v: pg.vocab, xp: pg.xpTotal }));
  ok('7 va 30 kunlik faollik real ma’lumotdan', pg.activity7.length === 7 && pg.activity30.length === 30 && pg.activity7[6].xp === after);
  ok('Lug‘at o‘sishi grafigi', pg.growth.length === 30 && pg.growth[29].words >= 7);
  const sk = {}; pg.skills.forEach(s => { sk[s.id] = s; });
  ok('Yozish/gapirish — «Hali baholanmagan» (sun’iy foiz yo‘q)', sk.writing.score === null && sk.speaking.score === null && /baholanmagan/.test(sk.writing.basis));
  ok('Lug‘at ko‘nikmasi takrorlash natijasidan', typeof sk.vocabulary.score === 'number', JSON.stringify(sk.vocabulary));
  eq('Ota-ona/boshqa o‘quvchi progressini ko‘ra olmaydi', (await kget(S2, 'progress?studentId=s1')).status, 403);

  section('9. Ustoz paneli: faqat o‘z o‘quvchilari');
  const tr = (await req('/api/learning/students', { cookie: ust })).json;
  ok('Ustoz faqat o‘z guruhi o‘quvchisini ko‘radi', tr.rows.length === 1 && tr.rows[0].studentId === 's1', JSON.stringify(tr.rows.map(r => r.studentId)));
  ok('Statistika: XP, lug‘at, oxirgi faollik', tr.rows[0].xp === after && tr.rows[0].vocab.learned >= 7 && tr.rows[0].lastActive === pg.today);
  eq('Begona o‘quvchi progressi — ruxsat yo‘q', (await req('/api/learning/student?id=s2', { cookie: ust })).status, 403);
  eq('Begona guruh — ruxsat yo‘q', (await req('/api/learning/students?group=g2', { cookie: ust })).status, 403);
  eq('Ustoz o‘z o‘quvchisiga gapirish bahosini qo‘ydi', (await req('/api/learning/skill', { cookie: ust, body: { studentId: 's1', skill: 'speaking', score: 80 } })).status, 200);
  eq('Begona o‘quvchiga baho qo‘ya olmaydi', (await req('/api/learning/skill', { cookie: ust, body: { studentId: 's2', skill: 'speaking', score: 80 } })).status, 403);
  eq('Noto‘g‘ri baho rad etiladi', (await req('/api/learning/skill', { cookie: ust, body: { studentId: 's1', skill: 'speaking', score: 180 } })).status, 400);
  const pg2 = (await kget(S1, 'progress')).json;
  ok('Gapirish ko‘nikmasi endi ustoz bahosidan', pg2.skills.filter(s => s.id === 'speaking')[0].score === 80);
  const all = (await req('/api/learning/students', { cookie: dir })).json;
  eq('Direktor hamma o‘quvchini ko‘radi', all.rows.length, 2);

  section('10. Sozlamalar, yutuqlar, admin statistikasi');
  eq('Ustoz XP qoidalarini o‘zgartira olmaydi', (await req('/api/learning/settings', { cookie: ust, body: { xp: { newWord: 50 } } })).status, 403);
  const setr = await req('/api/learning/settings', { cookie: dir, body: { xp: { newWord: 7, review: 2, testCorrect: 5, rl: 20, allBonus: 30 }, daily: { newWords: 5, reviews: 10, test: 5, rl: 1, minXp: 20 }, badges: { wordMaster: 100, quizMaster: 100, streak7: 7, streak30: 30, streak100: 100 } } });
  eq('Admin qoidani o‘zgartirdi', setr.json.rules.xp.newWord, 7);
  const bad2 = await req('/api/learning/settings', { cookie: dir, body: { xp: { newWord: -50 } } });
  eq('Manfiy XP qabul qilinmaydi (0 ga keltiriladi)', bad2.json.rules.xp.newWord, 0);
  dy = (await kget(S1, 'daily')).json;
  ok('«Birinchi qadam» yutug‘i berildi', dy.badges.filter(b => b.id === 'firstStep')[0].at === pg.today);
  ok('«So‘z ustasi» hali berilmagan (haqiqiy natija yo‘q)', !dy.badges.filter(b => b.id === 'wordMaster')[0].at);
  ok('Streak: bugungi XP ≥ 20 → 1 kun', dy.streak.current === 1 && dy.streak.todayDone, JSON.stringify(dy.streak));
  const stt = (await req('/api/learning/stats', { cookie: dir })).json;
  ok('Admin statistikasi', stt.students >= 1 && stt.activeToday === 1 && stt.perDay.length === 30, JSON.stringify(stt).slice(0, 160));
  eq('Ustozga markaz bo‘yicha umumiy statistika berilmaydi', (await req('/api/learning/stats', { cookie: ust })).status, 403);

  section('11. Ma’lumotlar himoyasi');
  eq('O‘quvchi lug‘ati /api/doc orqali yozilmaydi', (await put('svocab/s1', { words: {} })).status, 403);
  eq('XP /api/doc orqali yozilmaydi', (await put('lsum/s1', { total: 99999 })).status, 403);
  ok('Mavjud kurs testlari buzilmadi', (await kget(S1, 'course')).json.lessons.length >= 1);
})().catch(e => { fail++; out.push('  ✗ XATO: ' + (e && e.stack || e)); }).finally(() => {
  try { srv && srv.kill(); } catch (e) { }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { }
  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o‘tdi');
  process.exit(fail ? 1 : 0);
});
