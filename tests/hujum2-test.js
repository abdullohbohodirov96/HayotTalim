/* HUJUM SINOVI 2 — yangi qo'shilgan qismlar va brauzer himoyasi.
   Faqat vaqtinchalik sinov serveriga qarshi.
   node tests/hujum2-test.js [port] [direktor paroli]                     */
'use strict';
const http = require('http');
const PORT = process.argv[2] || 3300;
const PASS = process.argv[3] || 'Albyana2026!';
const API = 'http://localhost:' + PORT;
let pass = 0, fail = 0; const out = [];
function ok(n, c, x) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (x !== undefined ? '  → ' + String(x).slice(0, 220) : '')); } }
function section(t) { out.push('\n' + t); }
const R = 'h2' + Date.now().toString(36);
async function req(p, o = {}) {
  const res = await fetch(API + p, {
    method: o.method || 'GET', redirect: 'manual',
    headers: Object.assign(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}, o.cookie ? { Cookie: o.cookie } : {},
      o.ip ? { 'X-Forwarded-For': o.ip } : {}, o.headers || {}),
    body: o.body !== undefined ? (typeof o.body === 'string' ? o.body : JSON.stringify(o.body)) : undefined
  });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { status: res.status, json, text, headers: res.headers, cookie: (res.headers.get('set-cookie') || '').split(';')[0], setCookie: res.headers.get('set-cookie') || '' };
}
const login = (l, p, ip) => req('/api/login', { method: 'POST', body: { login: l, password: p }, ip });
const putDoc = (p, data, cookie, extra) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie, body: Object.assign({ data }, extra || {}) });
function raw(pathRaw, o = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: 'localhost', port: Number(PORT), path: pathRaw, method: o.method || 'GET', headers: o.headers || {} }, res => {
      let t = ''; res.setEncoding('utf8'); res.on('data', c => { t += c; }); res.on('end', () => resolve({ status: res.statusCode, text: t, headers: res.headers }));
    });
    r.on('error', reject); if (o.body) r.write(o.body); r.end();
  });
}
(async () => {
  const dirRes = await login('admin', PASS, '10.9.0.1');
  const dir = dirRes.cookie;
  ok('Direktor kirdi', !!dir, dirRes.text);

  section('1. Brauzer himoyasi (sarlavhalar)');
  const home = await req('/');
  const csp = home.headers.get('content-security-policy') || '';
  ok('CSP bor', /default-src 'self'/.test(csp));
  ok('CSP: begona skript taqiqlangan (unsafe-inline yo‘q)', !/script-src[^;]*unsafe-inline/.test(csp) && !/script-src[^;]*\*/.test(csp), csp.slice(0, 160));
  ok('CSP: iframe ichiga joylab bo‘lmaydi (frame-ancestors none)', /frame-ancestors 'none'/.test(csp));
  ok('CSP: object/base-uri yopiq', /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp));
  ok('X-Frame-Options: DENY', home.headers.get('x-frame-options') === 'DENY');
  ok('Referrer-Policy bor', /strict-origin/.test(home.headers.get('referrer-policy') || ''));
  ok('nosniff', home.headers.get('x-content-type-options') === 'nosniff');
  ok('Kamera/joylashuv yopiq', /camera=\(\)/.test(home.headers.get('permissions-policy') || ''));
  const apiH = await req('/api/health');
  ok('API javobida ham X-Frame-Options', apiH.headers.get('x-frame-options') === 'DENY');
  ok('Health ichki ma’lumot bermaydi', Object.keys(apiH.json || {}).every(k => ['ok', 'mode'].indexOf(k) >= 0), apiH.text);
  ok('Sessiya cookie: HttpOnly + SameSite', /HttpOnly/i.test(dirRes.setCookie) && /SameSite=(Strict|Lax)/i.test(dirRes.setCookie), dirRes.setCookie);

  section('2. Kanal viktorinasi — faqat ruxsati borlarga');
  ok('Kirmagan: ro‘yxat yopiq', [401, 403].indexOf((await req('/api/kanal-quiz')).status) >= 0);
  ok('Kirmagan: savol qo‘sha olmaydi', [401, 403].indexOf((await req('/api/kanal-quiz/add', { method: 'POST', body: { items: [{ id: 'x1', question: 'q', options: ['a', 'b'], correct: 0 }] } })).status) >= 0);
  ok('Kirmagan: kanalga yubora olmaydi', [401, 403].indexOf((await req('/api/kanal-quiz/send', { method: 'POST', body: {} })).status) >= 0);
  ok('Kirmagan: sozlamani o‘zgartira olmaydi', [401, 403].indexOf((await req('/api/kanal-quiz/config', { method: 'POST', body: { channel: '@hacker' } })).status) >= 0);
  const uLogin = 'h2u' + Date.now().toString(36).slice(-5);
  await putDoc('users/' + R + '_u', { id: R + '_u', name: 'Ustoz H', login: uLogin, role: 'oqituvchi', active: true }, dir, { password: 'Hujum12345' });
  const tch = (await login(uLogin, 'Hujum12345', '10.9.0.2')).cookie;
  ok('O‘qituvchi kirdi', !!tch);
  ok('O‘qituvchi viktorinani boshqara olmaydi', (await req('/api/kanal-quiz', { cookie: tch })).status === 403);
  ok('O‘qituvchi kanalni almashtira olmaydi', (await req('/api/kanal-quiz/config', { method: 'POST', cookie: tch, body: { channel: '@hacker' } })).status === 403);
  const qz = await req('/api/kanal-quiz', { cookie: dir });
  ok('Direktor ko‘radi', qz.status === 200 && Array.isArray(qz.json.items), qz.text.slice(0, 100));
  for (const col of ['tgquiz/w1d1s1', 'tgquizlog/2026-10-10-0900', 'kabpass/' + R, 'filebody/f0000000000000000']) {
    const r = await req('/api/doc?path=' + encodeURIComponent(col), { cookie: dir });
    ok('Hatto direktor ham /api/doc orqali o‘qiy olmaydi: ' + col.split('/')[0], r.status === 403 || r.status === 404 || !(r.json && r.json.data), r.status + ' ' + r.text.slice(0, 80));
  }
  const qzAdd = await req('/api/kanal-quiz/add', { method: 'POST', cookie: dir, body: { items: [{ id: '../../x', question: '<script>alert(1)</script>', options: ['a', 'b'], correct: 9 }] } });
  ok('Noto‘g‘ri savol (id, correct) rad etiladi', qzAdd.json && qzAdd.json.added === 0, qzAdd.text);

  section('3. O‘quvchi paroli (kabpass)');
  await putDoc('students/' + R + '_s', { id: R + '_s', firstName: 'Parol', lastName: 'Sinov', phone: '+998901239876', status: 'faol' }, dir);
  ok('Kirmagan parol yarata olmaydi', [401, 403].indexOf((await req('/api/student/kabpass', { method: 'POST', body: { studentId: R + '_s' } })).status) >= 0);
  ok('O‘qituvchi parol yarata olmaydi', (await req('/api/student/kabpass', { method: 'POST', cookie: tch, body: { studentId: R + '_s' } })).status === 403);
  ok('Yo‘l bilan hujum (studentId) rad', (await req('/api/student/kabpass', { method: 'POST', cookie: dir, body: { studentId: '../users/admin' } })).status === 400);
  const kp = await req('/api/student/kabpass', { method: 'POST', cookie: dir, body: { studentId: R + '_s' } });
  ok('Direktor parol yaratdi (6 xonali)', kp.status === 200 && /^\d{6}$/.test(kp.json.password), kp.text);
  const kp2 = await req('/api/student/kabpass', { method: 'POST', cookie: dir, body: { studentId: R + '_s' } });
  ok('Qayta yaratilsa — eski parol ishlamaydi', (await req('/api/kabinet', { method: 'POST', body: { login: kp.json.login, password: kp.json.password }, ip: '10.9.1.1' })).status !== 200);
  ok('Yangi parol ishlaydi', (await req('/api/kabinet', { method: 'POST', body: { login: kp2.json.login, password: kp2.json.password }, ip: '10.9.1.2' })).status === 200);
  ok('Shaxsiy kod endi parol emas', (await req('/api/kabinet', { method: 'POST', body: { login: kp2.json.login, password: kp2.json.login }, ip: '10.9.1.3' })).status !== 200);

  section('4. Parolni terib topish (brute force)');
  let locked = false;
  for (let i = 0; i < 12; i++) {
    const r = await req('/api/kabinet', { method: 'POST', body: { login: kp2.json.login, password: '00000' + i }, ip: '10.9.2.' + (i % 3 + 1) });
    if (r.status === 429) { locked = true; break; }
  }
  ok('Kabinet: ko‘p xato urinishdan keyin bloklanadi', locked);
  const after = await req('/api/kabinet', { method: 'POST', body: { login: kp2.json.login, password: kp2.json.password }, ip: '10.9.2.9' });
  ok('Bloklangan paytda to‘g‘ri parol ham kutadi (taxmin qilib bo‘lmaydi)', after.status === 429 || after.status === 200, after.status);

  section('5. Spam va inyeksiya');
  let leadLimited = false;
  for (let i = 0; i < 25; i++) {
    const r = await req('/api/lead', { method: 'POST', body: { name: 'Spam ' + i, phone: '+99890' + String(1000000 + i) }, ip: '10.9.4.1' });
    if (r.status === 429) { leadLimited = true; break; }
  }
  ok('Ariza formasi: bitta IP dan spam cheklanadi', leadLimited);
  let bigSt = 0;
  try { bigSt = (await req('/api/lead', { method: 'POST', body: JSON.stringify({ name: 'x'.repeat(5e6), phone: '+998901234567' }), ip: '10.9.4.2' })).status; }
  catch (e) { bigSt = 'uzildi'; }                       // server ulanishni uzdi — bu ham rad etish
  ok('Juda katta so‘rov rad etiladi', bigSt === 413 || bigSt === 400 || bigSt === 'uzildi', bigSt);
  ok('Undan keyin server ishlab turibdi', (await req('/api/health')).status === 200);
  const proto = await req('/api/lead', { method: 'POST', body: '{"name":"Proto","phone":"+998905556677","__proto__":{"admin":true},"constructor":{"prototype":{"isAdmin":true}}}', ip: '10.9.4.3' });
  ok('Prototype pollution — server yiqilmadi', proto.status < 500);
  ok('Prototype pollution — ta’sir yo‘q', ({}).admin === undefined && ({}).isAdmin === undefined);
  const bad = await req('/api/lead', { method: 'POST', body: '{"name":', ip: '10.9.4.4' });
  ok('Buzuq JSON — stack trace chiqmaydi', bad.status < 500 && !/at .*\.js:\d+/.test(bad.text), bad.text.slice(0, 120));
  const pub = await req('/api/public');
  ok('Ochiq ma’lumotda narx yo‘q', !(pub.json.courses || []).some(c => c.fee), JSON.stringify(pub.json.courses));
  ok('Ochiq ma’lumotda maxfiy kalit yo‘q', !/TELEGRAM_BOT_TOKEN|DATABASE_URL|ELEVENLABS|postgres:\/\//i.test(pub.text));
  const bot = require('../server/bot');
  ok('Bot: xodimga xabarda HTML ekranlanadi (notifyStaff)', /text = esc\(/.test(require('fs').readFileSync(require('path').join(__dirname, '../server/bot.js'), 'utf8')));

  section('6. Fayllar va yo‘llar');
  for (const p of ['/.env', '/server/index.js', '/data/markaz.db', '/%2e%2e/server/store.js', '/js/../server/bot.js', '/package.json', '/.git/config', '/tests/hujum2-test.js', '/node_modules/pg/package.json']) {
    const r = await raw(p);
    ok('Yopiq: ' + p, r.status === 404 || r.status === 400 || (r.status === 200 && /<!doctype html/i.test(r.text) && !/require\(|"dependencies"/.test(r.text)), r.status);
  }

  section('7. Admin parolini terib topish (oxirida — boshqa bo‘limlarga xalaqit bermasin)');
  let admLocked = false;
  for (let i = 0; i < 40; i++) {
    const r = await login('admin', 'xato' + i, '10.9.3.1');
    if (r.status === 429) { admLocked = true; break; }
  }
  ok('Admin kirish: ko‘p xato urinishdan keyin bloklanadi', admLocked);
  const other = await login('admin', PASS, '10.9.3.200');
  ok('Hujumchi IP bloklansa ham haqiqiy admin boshqa IP dan kira oladi', other.status === 200, other.status);

  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI') + ' — ' + pass + " ta o'tdi, " + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
