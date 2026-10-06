/* Onlayn kurs (A1): ketma-ket ochilish, test, uy vazifasi, ustoz tekshiruvi.
   Serverni alohida (sun'iy ma'lumotli) bazada ishga tushiring, keyin:
     node tests/course-test.js [port] [direktor paroli]                      */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;
const A = require('../server/shared').A || globalThis.A;
const C = A.Course;

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + JSON.stringify(want) + ', olindi ' + JSON.stringify(got)); }
function section(t) { out.push('\n' + t); }

async function req(path, opts = {}) {
  const h = {};
  if (opts.body) h['Content-Type'] = 'application/json';
  if (opts.cookie) h.Cookie = opts.cookie;
  if (opts.csrf) h['X-Kab-Csrf'] = opts.csrf;
  h['X-Forwarded-For'] = opts.ip || '10.9.8.7';
  const res = await fetch(BASE + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'), headers: h,
    body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual'
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const put = (p, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(p),
  { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
const getDoc = (p, cookie) => req('/api/doc?path=' + encodeURIComponent(p), { cookie });
async function login(l, p) {
  const r = await req('/api/login', { body: { login: l, password: p } });
  return r.status === 200 ? r.cookie : null;
}

const R = 'c' + Date.now().toString(36);
const ID = n => R + '_' + n;

(async () => {
  const dir = await login('admin', PASS);
  if (!dir) { console.error('Direktor kira olmadi.'); process.exit(1); }

  section('0. Sinov ma’lumotlari');
  await put('staff/' + ID('t1'), { id: ID('t1'), name: 'Ustoz Kurs', status: 'faol', payType: 'fixed', salaryAmount: 1 }, dir);
  await put('staff/' + ID('t2'), { id: ID('t2'), name: 'Boshqa ustoz', status: 'faol', payType: 'fixed', salaryAmount: 1 }, dir);
  await put('courses/' + ID('c1'), { id: ID('c1'), name: 'Arab tili', monthlyFee: 400000, active: true }, dir);
  const G = (n, t, code) => ({ id: ID(n), code, name: 'Kurs ' + n, courseId: ID('c1'), teacherId: ID(t),
    days: [1, 3], startTime: '18:00', endTime: '19:20', startDate: '2026-09-01', format: 'onlayn',
    fee: 400000, feeHistory: [{ fee: 400000, from: '2026-09' }], limit: 20, status: 'faol' });
  await put('groups/' + ID('g1'), G('g1', 't1', 'C' + R.slice(-4).toUpperCase()), dir);
  await put('groups/' + ID('g2'), G('g2', 't2', 'D' + R.slice(-4).toUpperCase()), dir);
  await put('students/' + ID('s1'), { id: ID('s1'), firstName: 'Madina', lastName: 'Sinov', phone: '+998901234500', status: 'faol' }, dir);
  await put('students/' + ID('s2'), { id: ID('s2'), firstName: 'Begona', lastName: 'Sinov', phone: '+998901234501', status: 'faol' }, dir);
  await put('memberships/' + ID('m1'), { id: ID('m1'), studentId: ID('s1'), groupId: ID('g1'), joinedAt: '2026-09-01', status: 'faol' }, dir);
  await put('memberships/' + ID('m2'), { id: ID('m2'), studentId: ID('s2'), groupId: ID('g2'), joinedAt: '2026-09-01', status: 'faol' }, dir);
  await put('users/' + ID('u1'), { id: ID('u1'), login: R + 'u', name: 'Ustoz Kurs', role: 'oqituvchi', staffId: ID('t1'), active: true }, dir, { password: 'Ustoz12345' });
  const ustoz = await login(R + 'u', 'Ustoz12345');
  ok('Ustoz kirdi', !!ustoz);

  const code = (await getDoc('students/' + ID('s1'), dir)).json.data.code;
  const kin = await req('/api/kabinet', { body: { code } });
  eq('O’quvchi kod bilan kirdi', kin.status, 200);
  const kc = kin.cookie, csrf = kin.json && kin.json.csrf;
  const kpost = (sub, body, withCsrf = true) => req('/api/kabinet/' + sub, { cookie: kc, csrf: withCsrf ? csrf : null, body });

  section('1. Darslar ketma-ket ochiladi');
  let v = (await req('/api/kabinet/course', { cookie: kc })).json;
  eq('8 ta dars', v.lessons.length, 8);
  eq('1-dars ochiq', v.lessons[0].status, 'open');
  eq('2-dars yopiq', v.lessons[1].status, 'locked');
  const L1 = C.LESSONS[0], L2 = C.LESSONS[1];
  eq('Yopiq darsga test topshirib bo’lmaydi', (await kpost('course/test', { lessonId: L2.id, answers: [] })).status, 403);
  eq('CSRF siz yozib bo’lmaydi', (await kpost('course/step', { lessonId: L1.id, step: 'words' }, false)).status, 403);
  eq('Bosqich belgilandi', (await kpost('course/step', { lessonId: L1.id, step: 'words' })).status, 200);

  section('2. Test serverda baholanadi');
  const test = C.buildTest(L1);
  const bad = await kpost('course/test', { lessonId: L1.id, answers: test.map(q => (q.answer + 1) % q.options.length) });
  ok('Noto’g’ri javoblar → 0%', bad.json.result.percent === 0 && !bad.json.passed, JSON.stringify(bad.json.result));
  const good = await kpost('course/test', { lessonId: L1.id, answers: test.map(q => q.answer) });
  ok('To’g’ri javoblar → 100%', good.json.result.percent === 100 && good.json.passed);
  eq('Faqat test bilan keyingi dars ochilmaydi', good.json.view.lessons[1].status, 'locked');

  section('3. Uy vazifasi: fayl yuklash va topshirish');
  const empty = await kpost('course/homework', { lessonId: L1.id, autoAnswers: [] });
  eq('Bo’sh vazifa rad etiladi', empty.status, 400);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const exe = await kpost('course/upload', { name: 'x.exe', type: 'application/x-msdownload', data: png });
  eq('Noto’g’ri fayl turi rad etiladi', exe.status, 400);
  const up = await kpost('course/upload', { name: 'daftar.png', type: 'image/png', data: png });
  eq('Rasm yuklandi', up.status, 200);
  const pdf = await kpost('course/upload', { name: 'vazifa.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.4\n%test\n').toString('base64') });
  eq('PDF yuklandi', pdf.status, 200);
  const hwA = (L1.homework.auto || []).map(q => q.answer);
  const hw = await kpost('course/homework', { lessonId: L1.id, autoAnswers: hwA, texts: ['هٰذَا أَبِي'], fileIds: [up.json.file.id, pdf.json.file.id, 'begona_fayl'] });
  eq('Vazifa topshirildi', hw.status, 200);
  v = hw.json.view;
  eq('Faqat o’z fayllari qabul qilindi', v.lessons[0].hw.fileIds.length, 2);
  eq('Holat: tekshirilmoqda', v.lessons[0].hw.status, 'tekshirilmoqda');
  eq('Test + vazifa → 1-dars tugadi', v.lessons[0].status, 'done');
  eq('2-dars o’zi ochildi', v.lessons[1].status, 'open');

  section('4. Ustoz tekshiradi');
  const ov = await req('/api/course/overview', { cookie: ustoz });
  eq('Ustoz ro’yxatni ko’radi', ov.status, 200);
  const mine = ov.json.rows.find(r => r.studentId === ID('s1'));
  ok('O’z o’quvchisi ko’rinadi, vazifa kutmoqda', mine && mine.pending.length === 1);
  ok('Begona guruh o’quvchisi ko’rinmaydi', !ov.json.rows.some(r => r.studentId === ID('s2')));
  const f = await req('/api/file?id=' + encodeURIComponent(up.json.file.id), { cookie: ustoz });
  eq('Ustoz yuklangan rasmni ochadi', f.status, 200);
  eq('Begona o’quvchini o’tkazib bo’lmaydi',
    (await req('/api/course/move', { cookie: ustoz, body: { studentId: ID('s2'), lessonId: L2.id } })).status, 403);
  const back = await req('/api/course/review', { cookie: ustoz, body: { studentId: ID('s1'), lessonId: L1.id, decision: 'qayta', comment: 'Harakatlarni yozing' } });
  eq('Qayta topshirishga qaytarildi', back.status, 200);
  v = (await req('/api/kabinet/course', { cookie: kc })).json;
  eq('Qaytarilgach 1-dars yana ochiq', v.lessons[0].status, 'open');
  eq('…va 2-dars yana yopiq', v.lessons[1].status, 'locked');
  eq('Ustoz izohi ko’rinadi', v.lessons[0].hw.comment, 'Harakatlarni yozing');
  await kpost('course/homework', { lessonId: L1.id, autoAnswers: hwA, texts: ['هٰذَا أَبِي وَهٰذِهِ أُمِّي'] });
  const acc = await req('/api/course/review', { cookie: ustoz, body: { studentId: ID('s1'), lessonId: L1.id, decision: 'qabul', grade: 5, comment: 'Barakalla' } });
  eq('Qabul qilindi', acc.status, 200);
  v = (await req('/api/kabinet/course', { cookie: kc })).json;
  ok('Baho 5, holat qabul', v.lessons[0].hw.grade === 5 && v.lessons[0].hw.status === 'qabul');

  section('5. Ustoz/admin darsga o’tkazadi');
  const L5 = C.LESSONS[4];
  eq('Admin 5-darsgacha o’tkazdi', (await req('/api/course/move', { cookie: dir, body: { studentId: ID('s1'), lessonId: L5.id } })).status, 200);
  v = (await req('/api/kabinet/course', { cookie: kc })).json;
  eq('5-dars ochiq', v.lessons[4].status, 'open');
  eq('6-dars yopiq', v.lessons[5].status, 'locked');
  eq('O’quvchi courseprog ni o’zi yoza olmaydi',
    (await put('courseprog/' + ID('s1'), { lessons: {} }, dir)).status, 403);

  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o’tdi');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
