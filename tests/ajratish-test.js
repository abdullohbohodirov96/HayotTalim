/* O'QUVCHI MA'LUMOTLARI BIR-BIRIGA O'TMASLIGI (ajratish sinovi)
   Ikki o'quvchi: A va B (har xil guruhlarda). B ning ma'lumotiga noyob belgilar
   qo'yiladi (familiya, telefon, fayl, vazifa matni, to'lov, savol). Keyin A ning
   kabinet sessiyasi bilan HAR BIR o'quvchi yo'liga B ning identifikatorlari
   berilib so'rov yuboriladi — javobda B ning belgilari bitta ham chiqmasligi kerak.
   Shuningdek: o'quvchi sessiyasi bilan xodim API lari yopiq; B ning fayli A ga 403.
   Ishga tushirish:  node tests/ajratish-test.js [port] [direktor paroli]       */
'use strict';
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const B = 'http://localhost:' + PORT;
let pass = 0, fail = 0; const out = [];
const ok = (n, c, e) => { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 220) : '')); } };
const section = t => out.push('\n' + t);
let ipN = 0;
async function req(p, o = {}) {
  const h = { 'X-Forwarded-For': '10.77.' + ((++ipN >> 8) & 255) + '.' + (ipN & 255) };
  if (o.body) h['Content-Type'] = 'application/json';
  if (o.cookie) h.Cookie = o.cookie; if (o.csrf) h['X-Kab-Csrf'] = o.csrf;
  const r = await fetch(B + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined, redirect: 'manual' });
  const buf = Buffer.from(await r.arrayBuffer());
  const text = buf.toString('utf8'); let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: r.status, text, json, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

(async () => {
  const dir = (await req('/api/login', { body: { login: 'admin', password: PASS } })).cookie;
  const put = (p, d) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie: dir, body: { data: d } });
  const MARK = 'Bmarker' + Date.now().toString(36);
  const PHONE_B = '+998' + String(900000000 + Math.floor(Math.random() * 9999999));
  await put('courses/c0', { id: 'c0', name: 'Alifbo', monthlyFee: 100, active: true, level: 'A0' });
  await put('courses/c1', { id: 'c1', name: 'Arab', monthlyFee: 100, active: true, level: 'A1' });
  await put('groups/gA', { id: 'gA', name: 'A guruh', courseId: 'c1', days: [1, 2, 3, 4, 5, 6, 7], startTime: '08:00', endTime: '09:00', startDate: '2026-09-01', fee: 100, feeHistory: [{ fee: 100, from: '2026-09' }], limit: 20, status: 'faol' });
  await put('groups/gB', { id: 'gB', name: 'B guruh ' + MARK, courseId: 'c0', days: [1, 2, 3, 4, 5, 6, 7], startTime: '10:00', endTime: '11:00', startDate: '2026-09-01', fee: 100, feeHistory: [{ fee: 100, from: '2026-09' }], limit: 20, status: 'faol' });
  await put('students/sA', { id: 'sA', firstName: 'Anvar', lastName: 'Aliyev', phone: '+998901234500', status: 'faol' });
  await put('students/sB', { id: 'sB', firstName: 'Bobur', lastName: MARK, phone: PHONE_B, parentPhone: PHONE_B, status: 'faol', telegram: { id: '55501' } });
  await put('memberships/mA', { id: 'mA', studentId: 'sA', groupId: 'gA', joinedAt: '2026-09-01', status: 'faol' });
  await put('memberships/mB', { id: 'mB', studentId: 'sB', groupId: 'gB', joinedAt: '2026-09-01', status: 'faol' });
  await put('invoices/iB', { id: 'iB', studentId: 'sB', groupId: 'gB', month: '2026-10', final: 777333, amount: 777333, status: 'open' });
  await put('payments/pB', { id: 'pB', studentId: 'sB', invoiceId: 'iB', amount: 555111, date: '2026-10-05', method: 'naqd', receiptNo: 'R-' + MARK });
  const codeA = String((await req('/api/doc?path=students%2FsA', { cookie: dir })).json.data.code);
  const codeB = String((await req('/api/doc?path=students%2FsB', { cookie: dir })).json.data.code);

  const loginK = async code => { const r = await req('/api/kabinet', { body: { code } }); return { cookie: r.cookie, csrf: r.json && r.json.csrf, status: r.status }; };
  const KA = await loginK(codeA), KB = await loginK(codeB);
  section('1. Kirish');
  ok('A kabinetga kirdi', KA.status === 200 && !!KA.cookie, KA.status);
  ok('B kabinetga kirdi', KB.status === 200 && !!KB.cookie, KB.status);

  /* B o'z ma'lumotini hosil qiladi: fayl, savol, vazifa */
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const upB = await req('/api/kabinet/files/upload', { cookie: KB.cookie, csrf: KB.csrf, body: { name: MARK + '.png', type: 'image/png', data: png.toString('base64'), note: 'izoh ' + MARK } });
  const fileB = upB.json && upB.json.file && upB.json.file.id;
  await req('/api/kabinet/question', { cookie: KB.cookie, csrf: KB.csrf, body: { text: 'savol ' + MARK } });
  await req('/api/kabinet/alif/step', { cookie: KB.cookie, csrf: KB.csrf, body: { lessonId: 'a0-01', step: 'learn' } });
  section('2. B ning ma’lumotlari tayyor');
  ok('B fayl yukladi', !!fileB, upB.text.slice(0, 120));
  const own = await req('/api/kabinet/files', { cookie: KB.cookie });
  ok('B o’z faylini ko’radi (nazorat)', own.text.indexOf(MARK) >= 0);
  const ownPay = await req('/api/kabinet/payments', { cookie: KB.cookie });
  ok('B o’z to’lovini ko’radi (nazorat)', /555111|777333/.test(ownPay.text), ownPay.text.slice(0, 120));

  /* Sizish belgisi: B ning noyob familiyasi, telefoni, summalari */
  const leaks = t => [MARK, PHONE_B.replace('+', ''), PHONE_B, '555111', '777333', 'R-' + MARK].filter(x => t.indexOf(x) >= 0);

  section('3. A ning sessiyasi bilan B ga tegishli narsani so’rash (barcha yo’llar)');
  const Q = 'studentId=sB&sid=sB&id=sB&student=sB&groupId=gB&g=gB&fileId=' + (fileB || 'x') + '&code=' + codeB;
  const GETS = ['me', 'course', 'alif', 'daily', 'vocab', 'vocab/deck', 'top', 'progress', 'learning', 'payments', 'files', 'session'];
  for (const p of GETS) {
    const r0 = await req('/api/kabinet/' + p, { cookie: KA.cookie });
    ok('GET kabinet/' + p + ' (oddiy) — A uchun ochiladi, B ma’lumoti yo’q (' + r0.status + ')', (r0.status === 200 || p === 'session') && leaks(r0.text).length === 0, r0.text.slice(0, 120));
    const r = await req('/api/kabinet/' + p + '?' + Q, { cookie: KA.cookie });
    const l = leaks(r.text);
    ok('GET kabinet/' + p + ' — B ma’lumoti yo’q (' + r.status + ')', l.length === 0, l.join(','));
  }
  /* «Reyting»: boshqalarning faqat ismi/balli ko'rinishi mumkin — telefon/familiya hech qachon */
  const POSTS = [['alif/step', { lessonId: 'a0-01', step: 'learn', studentId: 'sB' }], ['alif/start', { studentId: 'sB' }],
    ['alif/hw', { lessonId: 'a0-01', studentId: 'sB', text: 'x' }], ['quiz/start', { studentId: 'sB' }], ['daily/quiz/start', { studentId: 'sB' }],
    ['vocab/answer', { studentId: 'sB', wordId: 'x', field: 'uz', answer: 'x' }], ['feedback', { studentId: 'sB', text: 'x' }],
    ['question', { studentId: 'sB', text: 'A savoli' }], ['password', { studentId: 'sB', old: codeB, password: 'Buzildi12345' }]];
  for (const [p, body] of POSTS) {
    const r = await req('/api/kabinet/' + p, { cookie: KA.cookie, csrf: KA.csrf, body });
    const l = leaks(r.text);
    ok('POST kabinet/' + p + ' (studentId=B) — B ga ta’sir/sizish yo’q (' + r.status + ')', l.length === 0, l.join(','));
  }
  const relogB = await loginK(codeB);
  ok('A B ning parolini o’zgartira olmadi (B eski kod bilan kiradi)', relogB.status === 200, relogB.status);

  section('4. B ning fayli');
  if (fileB) {
    const f1 = await req('/api/kabinet/file?id=' + encodeURIComponent(fileB), { cookie: KA.cookie });
    ok('A B ning faylini ocha olmaydi (' + f1.status + ')', f1.status === 403 || f1.status === 404);
    const f2 = await req('/api/kabinet/file?id=' + encodeURIComponent(fileB), { cookie: KB.cookie });
    ok('B o’z faylini ochadi (nazorat, ' + f2.status + ')', f2.status === 200);
    const f3 = await req('/api/files/get?id=' + encodeURIComponent(fileB), { cookie: KA.cookie });
    ok('Xodim fayl yo’li o’quvchiga yopiq (' + f3.status + ')', f3.status === 401 || f3.status === 403 || f3.status === 404);
  }

  section('5. O’quvchi sessiyasi bilan xodim API lari');
  for (const p of ['/api/bootstrap', '/api/collection?name=students', '/api/doc?path=students%2FsB', '/api/doc?path=payments%2FpB',
    '/api/zoom/overview', '/api/backup/list', '/api/course/overview', '/api/users', '/api/files/list', '/api/meta?key=settings']) {
    const r = await req(p, { cookie: KA.cookie });
    ok(p + ' — yopiq (' + r.status + ')', (r.status === 401 || r.status === 403 || r.status === 404) && leaks(r.text).length === 0, r.text.slice(0, 100));
  }
  const w = await req('/api/doc?path=students%2FsB', { method: 'PUT', cookie: KA.cookie, body: { data: { id: 'sB', firstName: 'Buzildi' } } });
  ok('O’quvchi xodim yo’li bilan B ni o’zgartira olmaydi (' + w.status + ')', w.status === 401 || w.status === 403);

  section('6. Sessiya almashtirilmaydi');
  const fake = await req('/api/kabinet/me', { cookie: KA.cookie.replace(/=(.*)$/, (m, v) => '=' + v.slice(0, -4) + 'abcd') });
  ok('Soxta (o’zgartirilgan) sessiya rad etiladi (' + fake.status + ')', fake.status === 401);
  const meA = await req('/api/kabinet/me', { cookie: KA.cookie });
  ok('A ning «me» — faqat A', /Anvar|Aliyev/.test(meA.text) && leaks(meA.text).length === 0);
  const meB = await req('/api/kabinet/me', { cookie: KB.cookie });
  ok('B ning «me» — B (nazorat)', meB.text.indexOf(MARK) >= 0);

  console.log(out.join('\n'));
  console.log('\n' + '─'.repeat(52));
  console.log((fail === 0 ? '✓ HAMMASI O’TDI' : '✗ XATOLAR BOR') + ` — ${pass} ta o'tdi, ${fail} ta xato`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
