/* HUJUM SINOVI 3 — aqlli lug'at, kunlik mashq va XP ga qarshi hujumlar,
   prototip kalitlari («__proto__», «constructor») bilan tekshiruvlarni aylanib o'tish.
   O'zi vaqtinchalik bazada server ishga tushiradi (production ga tegmaydi):
     node tests/hujum3-test.js                                                     */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { spawn } = require('child_process');
const PORT = 4900 + Math.floor(Math.random() * 90);
const BASE = 'http://localhost:' + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hujum3-'));
const PASS = 'Hujum3-Direktor-2026!';
let pass = 0, fail = 0; const out = [];
function ok(n, c, x) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (x !== undefined ? '  → ' + String(x).slice(0, 200) : '')); } }
function section(t) { out.push('\n' + t); }
let ipN = 0;
async function req(p, o = {}) {
  const h = { 'X-Forwarded-For': o.ip || '10.33.' + (++ipN % 250) + '.' + (1 + ipN % 200) };
  if (o.body) h['Content-Type'] = 'application/json';
  if (o.cookie) h.Cookie = o.cookie; if (o.csrf) h['X-Kab-Csrf'] = o.csrf;
  const r = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
let srv;
(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', SEED_DIRECTOR_PASSWORD: PASS, BOT_TOKEN: '', TELEGRAM_BOT_TOKEN: '' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 250)); }
  const dir = (await req('/api/login', { body: { login: 'admin', password: PASS } })).cookie;
  const put = (p, d, extra) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie: dir, body: Object.assign({ data: d }, extra || {}) });
  await put('staff/t1', { id: 't1', name: 'Ustoz', status: 'faol', payType: 'fixed', salaryAmount: 1 });
  await put('courses/c1', { id: 'c1', name: 'Arab', monthlyFee: 1, active: true });
  await put('groups/g1', { id: 'g1', code: 'HJ39', name: 'A1 | hujum', courseId: 'c1', teacherId: 't1', days: [1], startTime: '18:00', endTime: '19:00', startDate: '2026-09-01', format: 'onlayn', fee: 1, feeHistory: [{ fee: 1, from: '2026-09' }], limit: 20, status: 'faol' });
  await put('students/s1', { id: 's1', firstName: 'H', lastName: 'Bir', phone: '+998901113301', status: 'faol' });
  await put('students/s2', { id: 's2', firstName: 'H', lastName: 'Ikki', phone: '+998901113302', status: 'faol' });
  await put('memberships/m1', { id: 'm1', studentId: 's1', groupId: 'g1', joinedAt: '2026-09-01', status: 'faol' });
  await put('users/u1', { id: 'u1', login: 'hustoz', name: 'Ustoz', role: 'oqituvchi', staffId: 't1', active: true }, { password: 'Ustoz-H3-12345' });
  const ust = (await req('/api/login', { body: { login: 'hustoz', password: 'Ustoz-H3-12345' } })).cookie;
  const code = (await req('/api/doc?path=students%2Fs1', { cookie: dir })).json.data.code;
  const k = await req('/api/kabinet', { body: { code } });
  const kp = (p, b) => req('/api/kabinet/' + p, { cookie: k.cookie, csrf: k.json.csrf, body: b || {} });
  const kg = p => req('/api/kabinet/' + p, { cookie: k.cookie });
  await kp('course/step', { lessonId: 'a1-01', step: 'words' });

  section('1. Prototip kalitlari bilan hujum (__proto__, constructor …)');
  for (const bad of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'prototype']) {
    const r = await kp('vocab/review', { items: [{ id: bad, g: 2 }] });
    ok('vocab/review «' + bad + '» — e’tiborsiz, server yiqilmaydi', r.status === 200 && r.json.saved === 0, r.status + ' ' + r.text);
    const a = await kp('vocab/answer', { id: bad, kind: 'uz', pick: 'x' });
    ok('vocab/answer «' + bad + '» — 404', a.status === 404, a.status + ' ' + a.text);
  }
  const v = await kg('vocab');
  ok('Lug‘at buzilmadi', v.status === 200 && v.json.counts.total >= 8, v.status + ' ' + v.text.slice(0, 100));
  const cv = await kp('course/vocab', { items: [{ key: '__proto__', ok: true }, { key: 'constructor', ok: true }] });
  ok('Eski lug‘at yo‘li: prototip kalitlari saqlanmaydi', cv.status === 200 && cv.json.saved === 0, cv.text.slice(0, 120));
  ok('Ustoz «__proto__» o‘quvchisi nomidan ish qila olmaydi (bonus)', (await req('/api/gamify/bonus', { cookie: ust, body: { studentId: '__proto__', points: 5, reason: 'x' } })).status === 403);
  ok('Ustoz «constructor» o‘quvchisiga baho qo‘ya olmaydi', (await req('/api/learning/skill', { cookie: ust, body: { studentId: 'constructor', skill: 'speaking', score: 50 } })).status === 403);
  ok('Ustoz begona (s2) o‘quvchiga baho qo‘ya olmaydi', (await req('/api/learning/skill', { cookie: ust, body: { studentId: 's2', skill: 'speaking', score: 50 } })).status === 403);
  ok('Ustoz kurs vazifasini «__proto__» uchun tekshira olmaydi', (await req('/api/course/review', { cookie: ust, body: { studentId: '__proto__', lessonId: 'a1-01', decision: 'qabul' } })).status === 403);

  section('2. XP ni sun’iy oshirish');
  const xp0 = (await kg('daily')).json.day.xp;
  let maxGain = 0;
  for (let round = 0; round < 4; round++) {
    const q = (await kp('daily/quiz/start')).json;
    if (!q.quiz) break;
    for (const qq of q.quiz.qs) {
      /* Javobni bilish uchun avval bitta urinish, keyin qolgan savollarga «to'g'ri» javob topib bo'lmaydi — har variantni sinab ko'ramiz */
      await kp('daily/quiz/answer', { quizId: q.quiz.id, i: qq.i, pick: 0 });
    }
  }
  const xp1 = (await kg('daily')).json.day.xp;
  const rules = (await req('/api/learning/settings', { cookie: dir })).json.rules;
  maxGain = 5 * rules.xp.testCorrect + rules.xp.allBonus;
  ok('4 marta test ochilsa ham XP faqat kunlik maqsad (5 savol) uchun', xp1 - xp0 <= maxGain, (xp1 - xp0) + ' > ' + maxGain);
  ok('Savol raqami bilan hujum (i=-1, «1e9», «__proto__»)', [(await kp('daily/quiz/answer', { quizId: 'q', i: -1, pick: 0 })).status, (await kp('daily/quiz/answer', { quizId: 'q', i: '__proto__', pick: 0 })).status].every(s => s === 409 || s === 400));
  const dk = (await kg('vocab/deck')).json.cards;
  const w = dk[0];
  const forged = await kp('vocab/review', { items: [{ id: w.id, g: 2 }, { id: w.id, g: 2 }, { id: w.id, g: 2 }] });
  const x2 = (await kg('daily')).json.day.xp;
  const forged2 = await kp('vocab/review', { items: [{ id: w.id, g: 2 }] });
  ok('Bir so‘zni qayta-qayta yuborish XP ni oshirmaydi', forged.status === 200 && (await kg('daily')).json.day.xp === x2, forged2.text.slice(0, 80));

  section('3. Tezlik cheklovi (skript bilan bombardimon)');
  let c429 = 0;
  for (let i = 0; i < 130; i++) { const r = await kp('daily/rl/start'); if (r.status === 429) c429++; }
  ok('Daqiqasiga juda ko‘p yozish — 429', c429 > 0, 'hech biri rad etilmadi');
  ok('O‘qish (GET) cheklanmaydi', (await kg('daily')).status === 200);

  section('4. Admin yo‘llari');
  ok('So‘z id sida yo‘l hujumi', (await req('/api/learning/word', { cookie: dir, body: { id: '../../users/usr_admin', ar: 'قَلَمٌ', uz: 'q' } })).status === 404);
  ok('O‘chirishda yo‘l hujumi', (await req('/api/learning/word/delete', { cookie: dir, body: { id: '../users/usr_admin' } })).status === 404);
  const big = await req('/api/learning/word', { cookie: dir, body: { ar: 'قَلَمٌ'.repeat(3000), uz: 'x'.repeat(9000), lessons: ['course:a1-01', 'topic:../../x', 'javascript:alert(1)'] } });
  ok('Juda uzun matn qisqartiriladi, noto‘g‘ri dars kodlari tashlanadi', big.status === 200 && big.json.word.ar.length <= 120 && big.json.word.uz.length <= 200 && big.json.word.lessons.join() === 'course:a1-01', big.text.slice(0, 160));
  const xss = await req('/api/learning/word', { cookie: dir, body: { ar: 'بَيْتٌ <img src=x onerror=alert(1)>', uz: '<script>alert(1)</script>' } });
  ok('HTML matn sifatida saqlanadi (sahifada matn bo‘lib chiqadi)', xss.status === 200);
  const csv = await req('/api/learning/import', { cookie: dir, body: { csv: Array.from({ length: 2600 }, (_, i) => 'كَلِمَةٌ' + i + ';s' + i).join('\n') } });
  ok('CSV: 2000 qatordan ko‘pi qabul qilinmaydi', csv.status === 200 && csv.json.total === 2000, csv.text.slice(0, 120));
  ok('O‘quvchi cookie si bilan admin yo‘li yopiq', (await req('/api/learning/import', { cookie: k.cookie, body: { csv: 'a;b' } })).status === 401);
  ok('Ustoz CSV yuklay olmaydi', (await req('/api/learning/import', { cookie: ust, body: { csv: 'a;b' } })).status === 403);
  ok('Ustoz XP qoidasini o‘zgartira olmaydi', (await req('/api/learning/settings', { cookie: ust, body: { xp: { newWord: 500 } } })).status === 403);

  section('5. Ochiq shakllar: prototip kalitlari');
  const lead = await req('/api/lead', { body: { name: 'Hujum Sinov', phone: '+998901113399', startLevel: '__proto__' } });
  ok('Ariza: «__proto__» daraja — yiqilmaydi', lead.status < 500, lead.status + ' ' + lead.text.slice(0, 120));
})().catch(e => { fail++; out.push('  ✗ XATO: ' + (e && e.stack || e)); }).finally(() => {
  try { srv && srv.kill(); } catch (e) { }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { }
  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o‘tdi');
  process.exit(fail ? 1 : 0);
});
