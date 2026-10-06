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

  section('6. Login + parol, to’lovlar, fayllar, parolni almashtirish');
  const ph = '+998 90 123 45 00';
  const badPw = await req('/api/kabinet', { body: { login: ph, password: '9999' }, ip: '10.2.2.2' });
  eq('Noto’g’ri parol rad etildi', badPw.status, 404);
  const lp = await req('/api/kabinet', { body: { login: ph, password: code }, ip: '10.2.2.3' });
  eq('Telefon + boshlang’ich parol (kod) bilan kirdi', lp.status, 200);
  ok('Parol hali qo’yilmagan deb aytildi', lp.json.hasOwnPassword === false);
  const c2 = lp.cookie, s2 = lp.json.csrf;
  const kp2 = (sub, body) => req('/api/kabinet/' + sub, { cookie: c2, csrf: s2, body });
  eq('To’lovlar ro’yxati', (await req('/api/kabinet/payments', { cookie: c2 })).status, 200);
  const upf = await kp2('files/upload', { name: 'daftar.png', type: 'image/png', data: png, note: '3-dars' });
  eq('Fayl yuklandi', upf.status, 200);
  const fl = await req('/api/kabinet/files', { cookie: c2 });
  ok('Fayllarim ro’yxatida bor (vazifa fayllari ham)', fl.json.files.length >= 3 && fl.json.files.some(f => f.note === '3-dars'), JSON.stringify(fl.json.files.map(f => f.name)));
  const audio = await kp2('course/upload', { name: 'oqish.webm', type: 'audio/webm', data: Buffer.from('webmtest-audio-bytes').toString('base64') });
  eq('Ovoz yozuvi yuklandi', audio.status, 200);
  eq('Qisqa parol rad etildi', (await kp2('password', { old: code, password: '123' })).status, 400);
  eq('Parol o’zgartirildi', (await kp2('password', { old: code, password: 'Madina2026' })).status, 200);
  eq('Endi eski kod parol bo’lmaydi', (await req('/api/kabinet', { body: { login: ph, password: code }, ip: '10.2.2.4' })).status, 404);
  eq('Yangi parol bilan kirdi', (await req('/api/kabinet', { body: { login: code, password: 'Madina2026' }, ip: '10.2.2.5' })).status, 200);
  eq('Parol xeshi o’qib bo’lmaydi', (await getDoc('kabpass/' + ID('s1'), dir)).status, 403);

  section('7. Kitobdagidek yozma mashqlar serverda baholanadi');
  const L5w = C.buildWritten(L5);
  const hw5 = await kp2('course/homework', {
    lessonId: L5.id, autoAnswers: (L5.homework.auto || []).map(q => q.answer),
    fillAnswers: L5w.fill.map(f => f.answer), trAnswers: L5w.tr.map(t => t.ar), readPercent: 83, fileIds: [audio.json.file.id]
  });
  eq('Vazifa (faqat yozma mashqlar + ovoz) qabul qilindi', hw5.status, 200);
  const v5 = hw5.json.view.lessons[4].hw;
  ok('Bo’sh joy to’liq to’g’ri', v5.written && v5.written.fillOk === v5.written.fillTotal, JSON.stringify(v5.written));
  eq('O’qish natijasi saqlandi', v5.readPercent, 83);
  const ov2 = await req('/api/course/overview', { cookie: dir });
  const pend = ov2.json.rows.find(r => r.studentId === ID('s1')).pending.find(p => p.lessonId === L5.id);
  ok('Ustozga ovoz fayli turi bilan keladi', pend && pend.files.some(f => /^audio\//.test(f.type)));

  section('8. Har 2 darsdan keyin takrorlash testi va lug’at');
  await put('students/' + ID('s3'), { id: ID('s3'), firstName: 'Takror', lastName: 'Sinov', phone: '+998901234502', status: 'faol' }, dir);
  await put('memberships/' + ID('m3'), { id: ID('m3'), studentId: ID('s3'), groupId: ID('g1'), joinedAt: '2026-09-01', status: 'faol' }, dir);
  const code3 = (await getDoc('students/' + ID('s3'), dir)).json.data.code;
  const k3 = await req('/api/kabinet', { body: { login: code3, password: code3 }, ip: '10.3.3.3' });
  const kp3 = (sub, body) => req('/api/kabinet/' + sub, { cookie: k3.cookie, csrf: k3.json.csrf, body });
  for (const L of [C.LESSONS[0], C.LESSONS[1]]) {
    await kp3('course/test', { lessonId: L.id, answers: C.buildTest(L).map(q => q.answer) });
    const w = C.buildWritten(L);
    await kp3('course/homework', { lessonId: L.id, autoAnswers: (L.homework.auto || []).map(q => q.answer), fillAnswers: w.fill.map(f => f.answer), texts: ['ok ok'] });
  }
  let v3 = (await req('/api/kabinet/course', { cookie: k3.cookie })).json;
  eq('2 dars tugadi, lekin 3-dars yopiq (takrorlash kerak)', v3.lessons[2].status, 'locked');
  eq('1-takrorlash ochiq', v3.reviews[0].status, 'open');
  eq('2-takrorlash hali yopiq', v3.reviews[1].status, 'locked');
  eq('Yopiq takrorlashni ishlab bo’lmaydi', (await kp3('course/review', { reviewId: 'r2', answers: [] })).status, 403);
  const rq = C.buildReview(C.REVIEWS[0]);
  const rBad = await kp3('course/review', { reviewId: 'r1', answers: rq.map(q => (q.answer + 1) % q.options.length) });
  ok('Xato javoblar — o’tmadi', rBad.status === 200 && !rBad.json.passed);
  eq('…3-dars hali yopiq', rBad.json.view.lessons[2].status, 'locked');
  ok('Xato so’zlar lug’atda 0-qutida', Object.values(rBad.json.view.vocab.map).every(x => x.b === 0));
  const rGood = await kp3('course/review', { reviewId: 'r1', answers: rq.map(q => q.answer) });
  ok('To’g’ri javoblar — o’tdi', rGood.json.passed && rGood.json.result.percent === 100);
  eq('3-dars ochildi', rGood.json.view.lessons[2].status, 'open');
  eq('1-takrorlash bajarildi', rGood.json.view.reviews[0].status, 'done');
  const vk = 'a1-01:0';
  const vm = await kp3('course/vocab', { items: [{ key: vk, ok: true }, { key: 'a1-08:0', ok: true }] });
  eq('Faqat ochiq dars so’zi saqlandi', vm.json.saved, 1);
  ok('So’z keyingi qutiga o’tdi', vm.json.view.vocab.map[vk].b === 2, JSON.stringify(vm.json.view.vocab.map[vk]));
  ok('Ochiq so’zlar soni to’g’ri', vm.json.view.vocab.total === C.LESSONS.slice(0, 3).reduce((n, l) => n + l.words.length, 0), String(vm.json.view.vocab.total));
  const ov3 = await req('/api/course/overview', { cookie: dir });
  const r3 = ov3.json.rows.find(r => r.studentId === ID('s3'));
  ok('Ustoz panelida takrorlash va lug’at ko’rinadi', r3 && r3.reviews[0].status === 'done' && r3.vocab.total > 0);
  const qa = await req('/api/qissa-audio?l=a1-01');
  ok('Qissa ovozi holati (ochiq yo’l)', qa.status === 200 && Array.isArray(qa.json.lines));
  const mp4 = Buffer.from('00000018667479706d703432000000006d703432', 'hex').toString('base64');
  eq('Dars videosi (MP4) yuklandi', (await req('/api/course/video', { cookie: dir, body: { lessonId: 'a1-03', name: 'dars3.mp4', type: 'video/mp4', data: mp4 } })).status, 200);
  ok('Video ochiq yo’lda bor', (await req('/api/lesson-video?l=a1-03&info=1')).json.has === true);
  eq('Faqat MP4 qabul qilinadi', (await req('/api/course/video', { cookie: dir, body: { lessonId: 'a1-03', name: 'x.exe', type: 'application/octet-stream', data: mp4 } })).status, 400);
  eq('O’quvchi video yuklay olmaydi', (await req('/api/course/video', { cookie: k3.cookie, body: { lessonId: 'a1-03', type: 'video/mp4', data: mp4 } })).status, 401);
  ok('Ovoz xaritasi ochiq yo’lda', (await req('/api/qissa-audio/map')).status === 200);
  eq('Kalitsiz ElevenLabs yaratish aniq xato beradi', (await req('/api/course/tts', { cookie: dir, body: { lessonId: 'a1-01' } })).status, 400);

  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o’tdi');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
