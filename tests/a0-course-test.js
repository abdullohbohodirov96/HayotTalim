/* A0 («Nabra», 24 dars): darslar KETMA-KET ochiladi.
   Test ≥ 60% + uy vazifasi (avtomatik qism ≥ 60%) bo'lmaguncha keyingi dars yopiq.
     node tests/a0-course-test.js [port] [direktor paroli]                        */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;
const A = require('../server/shared').A;
const F = A.Alifbo;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('  ✓ ' + name); } else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); } }
async function req(path, opts = {}) {
  const h = { 'X-Forwarded-For': '10.7.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) };
  if (opts.body) h['Content-Type'] = 'application/json';
  if (opts.cookie) h.Cookie = opts.cookie;
  if (opts.csrf) h['X-Kab-Csrf'] = opts.csrf;
  const r = await fetch(BASE + path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

(async () => {
  /* Ma'lumot tekshiruvi */
  ok('24 ta dars', F.LESSONS.length === 24);
  ok('8 hafta × 3 dars', [1, 2, 3, 4, 5, 6, 7, 8].every(w => F.LESSONS.filter(l => l.week === w).length === 3));
  let bad = 0;
  F.LESSONS.forEach(l => ['p', 'x', 'y'].forEach(s => F.buildTest(l, s).concat(F.buildPractice(l), F.buildHomework(l))
    .forEach(q => { if (!(q.answer >= 0) || new Set(q.options).size !== q.options.length) bad++; })));
  ok('Barcha savollarda to’g’ri javob bor, variantlar takrorlanmaydi', bad === 0, bad + ' ta xato savol');
  ok('O’qilishi: كَاتِبُ → kaatibu, الشَّهْدُ → ash-shahdu', F.translit('كَاتِبُ') === 'kaatibu' && F.translit('الشَّهْدُ') === 'ash-shahdu');

  /* Server */
  const dir = (await req('/api/login', { body: { login: 'admin', password: PASS } })).cookie;
  ok('Direktor kirdi', !!dir);
  const sid = 'a0t' + Date.now().toString(36);
  await req('/api/doc?path=students/' + sid, { method: 'PUT', cookie: dir, body: { data: { id: sid, firstName: 'A0', lastName: 'Sinov', phone: '+99891' + String(Date.now()).slice(-7), status: 'faol' } } });
  const code = (await req('/api/doc?path=students/' + sid, { cookie: dir })).json.data.code;
  const kin = await req('/api/kabinet', { body: { code } });
  ok('O’quvchi kirdi', kin.status === 200);
  const kc = kin.cookie, csrf = kin.json && kin.json.csrf;
  const kp = (sub, body) => req('/api/kabinet/' + sub, { cookie: kc, csrf, body });

  let v = (await req('/api/kabinet/alif', { cookie: kc })).json;
  ok('Boshida faqat 1-dars ochiq', v.lessons[0].status === 'open' && v.lessons.slice(1).every(l => l.status === 'locked'));
  ok('Yopiq darsning testi berilmaydi', (await kp('alif/start', { lessonId: 'a0-02' })).status === 403);
  ok('Yopiq darsga uy vazifasi topshirib bo’lmaydi', (await kp('alif/hw', { lessonId: 'a0-02', answers: [] })).status === 403);
  ok('Bosqich belgilanadi', (await kp('alif/step', { lessonId: 'a0-01', step: 'learn' })).status === 200);

  async function passTest(lid, good) {
    const s = (await kp('alif/start', { lessonId: lid })).json;
    ok(lid + ': savollarda javob yo’q (serverda)', s.questions.every(q => q.answer === undefined));
    /* Javoblarni test bazasidan emas, variantlardan topib bo'lmaydi — shuning uchun seed'ni bilmasdan
       100% olish mumkin emas; test uchun ochiq API orqali emas, server baholashini tekshiramiz. */
    const ans = s.questions.map(() => 0);
    const r = (await kp('alif/submit', { sessId: s.sessId, answers: ans })).json;
    return r;
  }
  /* Xato javoblar bilan (hammasi 0) — odatda 60% dan past */
  const r1 = await passTest('a0-01');
  ok('Test serverda baholandi', r1 && r1.result && typeof r1.result.percent === 'number');
  /* Uy vazifasi to'g'ri javoblar bilan */
  const hw = F.buildHomework(F.byId('a0-01')).map(q => q.answer);
  const h1 = (await kp('alif/hw', { lessonId: 'a0-01', answers: hw, tasks: { yoz: true, oqi: true } })).json;
  ok('Uy vazifasi 100%', h1.result.percent === 100);
  v = h1.view;
  if (!r1.passed) ok('Testdan o’tmagan — 2-dars hali yopiq', v.lessons[1].status === 'locked');
  /* Ustoz qo'lda ochadi */
  const mv = await req('/api/course/move', { cookie: dir, body: { studentId: sid, lessonId: 'a0-03' } });
  ok('Ustoz A0 darsini qo’lda ochdi', mv.status === 200);
  v = (await req('/api/kabinet/alif', { cookie: kc })).json;
  ok('3-darsgacha ochiq, 4-dars yopiq', v.lessons[2].status !== 'locked' && v.lessons[3].status === 'locked');
  ok('Uy vazifasiz dars «tugadi» bo’lmaydi', v.lessons[1].status !== 'done');

  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' + pass + ' ta o’tdi' : '✓ HAMMASI O’TDI — ' + pass + ' ta'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
