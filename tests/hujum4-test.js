/* HUJUM SINOVI 4 — tarix (hist), savatcha (trash), video ro'yxati, «to'liq dostup»,
   «ko'tarmadi» va murojaat tarixi maydonlariga hujumlar.
   O'zi vaqtinchalik bazada server ishga tushiradi (production ga tegmaydi):
     node tests/hujum4-test.js                                                     */
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { spawn } = require('child_process');
const PORT = 4800 + Math.floor(Math.random() * 90);
const BASE = 'http://localhost:' + PORT;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hujum4-'));
const PASS = 'Hujum4-Direktor-2026!';
let pass = 0, fail = 0; const out = [];
function ok(n, c, x) { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (x !== undefined ? '  → ' + String(x).slice(0, 200) : '')); } }
function section(t) { out.push('\n' + t); }
let ipN = 0;
async function req(p, o = {}) {
  const h = { 'X-Forwarded-For': o.ip || '10.44.' + (++ipN % 250) + '.' + (1 + ipN % 200) };
  if (o.body) h['Content-Type'] = 'application/json';
  if (o.cookie) h.Cookie = o.cookie; if (o.csrf) h['X-Kab-Csrf'] = o.csrf;
  const r = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
let srv;
(async () => {
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA, DATABASE_URL: '', SEED_DIRECTOR_PASSWORD: PASS, BOT_TOKEN: '', TELEGRAM_BOT_TOKEN: '', TRUST_PROXY_HOPS: '1' }), stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch (e) { } await new Promise(r => setTimeout(r, 250)); }
  const dir = (await req('/api/login', { body: { login: 'admin', password: PASS } })).cookie;
  const put = (c, p, d, extra) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie: c, body: Object.assign({ data: d }, extra || {}) });
  await put(dir, 'staff/t1', { id: 't1', name: 'Ustoz', status: 'faol', payType: 'fixed', salaryAmount: 1 });
  await put(dir, 'courses/c1', { id: 'c1', name: 'Arab', monthlyFee: 1, active: true });
  await put(dir, 'groups/g1', { id: 'g1', name: 'A1 | h4', courseId: 'c1', teacherId: 't1', days: [1], startTime: '18:00', endTime: '19:00', startDate: '2026-09-01', fee: 1, feeHistory: [{ fee: 1, from: '2026-09' }], limit: 20, status: 'faol' });
  await put(dir, 'students/s1', { id: 's1', firstName: 'H', lastName: 'Bir', phone: '+998901114401', status: 'faol' });
  await put(dir, 'leads/l1', { id: 'l1', name: 'Lid', phone: '+998901114402', stage: 'yangi', funnelId: 'fnl_asosiy', createdAt: '2026-10-30 10:00' });
  await put(dir, 'leads/l1', { id: 'l1', name: 'Lid', phone: '+998901114403', stage: 'boglanildi', funnelId: 'fnl_asosiy', createdAt: '2026-10-30 10:00' });
  await put(dir, 'users/u1', { id: 'u1', login: 'h4ustoz', name: 'Ustoz', role: 'oqituvchi', staffId: 't1', active: true }, { password: 'Ustoz-H4-12345' });
  await put(dir, 'users/u2', { id: 'u2', login: 'h4men', name: 'Menejer', role: 'menejer', active: true }, { password: 'Menejer-H4-12345' });
  await put(dir, 'users/u3', { id: 'u3', login: 'h4adm', name: 'Admin', role: 'admin', active: true }, { password: 'Admin-H4-12345' });
  const ust = (await req('/api/login', { body: { login: 'h4ustoz', password: 'Ustoz-H4-12345' } })).cookie;
  const men = (await req('/api/login', { body: { login: 'h4men', password: 'Menejer-H4-12345' } })).cookie;
  const adm = (await req('/api/login', { body: { login: 'h4adm', password: 'Admin-H4-12345' } })).cookie;
  const code = (await req('/api/doc?path=students%2Fs1', { cookie: dir })).json.data.code;
  const k = await req('/api/kabinet', { body: { code } });

  section('1. Tarix (hist) — kim ko‘ra oladi');
  const hDir = await req('/api/history?path=leads%2Fl1', { cookie: dir });
  ok('Direktor murojaat tarixini ko‘radi', hDir.status === 200 && hDir.json.items.length >= 1, hDir.text.slice(0, 100));
  ok('Menejer (lead.edit) ham ko‘radi', (await req('/api/history?path=leads%2Fl1', { cookie: men })).status === 200);
  ok('O‘qituvchi tarixni ko‘ra olmaydi', (await req('/api/history?path=leads%2Fl1', { cookie: ust })).status === 403);
  ok('O‘qituvchi davomat tarixini ham ko‘ra olmaydi', (await req('/api/history?path=lessons%2Fg1__2026-10', { cookie: ust })).status === 403);
  ok('O‘quvchi cookie si bilan — 401', (await req('/api/history?path=leads%2Fl1', { cookie: k.cookie })).status === 401);
  ok('Kirmagan — 401', (await req('/api/history?path=leads%2Fl1')).status === 401);
  for (const bad of ['users%2Fusr_admin', 'meta%2Fsettings', 'leads%2F..%2Fusers%2Fx', 'leads%2Fl1%2F..%2F..%2Fkabpass%2Fs1', 'kabpass%2Fs1', 'hist%2Fx']) {
    ok('Ruxsatsiz yo‘l rad etiladi: ' + decodeURIComponent(bad), (await req('/api/history?path=' + bad, { cookie: dir })).status === 400);
  }
  const hid = hDir.json.items[0].id;
  ok('Menejer «tarixdan qaytarish» ni o‘qituvchi qila olmaydi', (await req('/api/history/restore', { cookie: ust, body: { id: hid } })).status === 403);
  ok('Soxta tarix id — 400', (await req('/api/history/restore', { cookie: dir, body: { id: '../../users/x' } })).status === 400);
  ok('Mavjud bo‘lmagan id — 404', (await req('/api/history/restore', { cookie: dir, body: { id: 'h_zzzz' } })).status === 404);
  ok('hist/ ni /api/doc orqali o‘qib bo‘lmaydi', (await req('/api/doc?path=hist%2F' + hid, { cookie: dir })).status === 403);
  ok('hist/ ga /api/doc orqali yozib bo‘lmaydi', (await put(dir, 'hist/h_fake', { path: 'users/usr_admin', data: { role: 'direktor' } })).status === 403);
  const bs = (await req('/api/bootstrap', { cookie: dir })).json;
  ok('Bootstrap da hist/trash yo‘q', !bs.col.hist && !bs.col.trash && !JSON.stringify(Object.keys(bs.docs || {})).match(/hist\/|trash\//));

  section('2. Savatcha (trash)');
  await put(dir, 'leads/l2', { id: 'l2', name: 'O‘chiriladi', phone: '+998901114404', stage: 'yangi', funnelId: 'fnl_asosiy', createdAt: '2026-10-30 10:00' });
  await req('/api/doc?path=leads%2Fl2', { method: 'DELETE', cookie: dir });
  ok('O‘qituvchi savatchani ko‘ra olmaydi', (await req('/api/trash', { cookie: ust })).status === 403);
  ok('Menejer savatchani ko‘ra olmaydi', (await req('/api/trash', { cookie: men })).status === 403);
  const tr = await req('/api/trash', { cookie: dir });
  ok('Direktor savatchani ko‘radi', tr.status === 200 && tr.json.items.some(t => t.path === 'leads/l2'));
  ok('Savatcha ro‘yxatida yozuv mazmuni (data) berilmaydi', !tr.text.includes('+998901114404'));
  ok('Menejer tiklay olmaydi', (await req('/api/trash/restore', { cookie: men, body: { id: tr.json.items[0].id } })).status === 403);
  ok('Soxta id bilan tiklash — 400', (await req('/api/trash/restore', { cookie: dir, body: { id: '../users/x' } })).status === 400);
  ok('trash/ ga yozib bo‘lmaydi', (await put(dir, 'trash/tr_fake', { path: 'users/evil', data: { role: 'direktor', login: 'evil' } })).status === 403);
  /* Foydalanuvchi o'chirilsa — savatchada parol xeshi saqlanmaydi */
  await put(dir, 'users/u9', { id: 'u9', login: 'h4del', name: 'Del', role: 'menejer', active: true }, { password: 'Deluser-H4-12345' });
  await req('/api/doc?path=users%2Fu9', { method: 'DELETE', cookie: dir });
  const tr2 = (await req('/api/trash', { cookie: dir })).json.items.filter(t => t.path === 'users/u9')[0];
  ok('O‘chirilgan foydalanuvchi savatchada', !!tr2);
  if (tr2) {
    await req('/api/trash/restore', { cookie: dir, body: { id: tr2.id } });
    const u9 = (await req('/api/doc?path=users%2Fu9', { cookie: dir })).json.data || {};
    ok('Tiklangan foydalanuvchida parol xeshi yo‘q (eski parol bilan kirib bo‘lmaydi)', !u9.hash && !u9.salt);
    ok('Eski parol bilan kirish ishlamaydi', (await req('/api/login', { body: { login: 'h4del', password: 'Deluser-H4-12345' } })).status !== 200);
  }

  section('3. Video ro‘yxati');
  ok('O‘quvchi video ro‘yxatini ko‘ra olmaydi', (await req('/api/videos', { cookie: k.cookie })).status === 401);
  ok('Menejer (curriculum.view yo‘q) — 403', (await req('/api/videos', { cookie: men })).status === 403);
  ok('Direktor ko‘radi', (await req('/api/videos', { cookie: dir })).status === 200);
  ok('O‘qituvchi ko‘radi (faqat o‘z guruhi fayllari)', (await req('/api/videos', { cookie: ust })).status === 200);

  section('4. «To‘liq dostup»');
  const st = (await req('/api/doc?path=students%2Fs1', { cookie: dir })).json.data;
  const r1 = await put(men, 'students/s1', Object.assign({}, st, { fullAccess: true }));
  const afterMen = (await req('/api/doc?path=students%2Fs1', { cookie: dir })).json.data;
  ok('Menejer to‘liq dostup bera olmaydi', r1.status === 403 || !afterMen.fullAccess, r1.status);
  await put(adm, 'students/s1', Object.assign({}, st, { fullAccess: true }));
  const afterAdm = (await req('/api/doc?path=students%2Fs1', { cookie: dir })).json.data;
  ok('Admin (settings.edit yo‘q) ham bera olmaydi', !afterAdm.fullAccess);
  await put(dir, 'students/s1', Object.assign({}, st, { fullAccess: true }));
  const me = (await req('/api/kabinet/me', { cookie: k.cookie })).json;
  ok('Direktor beradi — kabinetda ochiladi', me.fullAccess === true);
  const alif = (await req('/api/kabinet/alif', { cookie: k.cookie })).json;
  ok('Hamma alifbo darslari ochiq', alif.lessons.every(l => l.status !== 'locked'));
  ok('O‘quvchi o‘zi progressga «all» yoza olmaydi', (await put(k.cookie, 'alifprog/s1', { all: true, lessons: {} })).status === 401);

  section('5. Murojaat maydonlarini soxtalashtirish');
  const l1 = (await req('/api/doc?path=leads%2Fl1', { cookie: men })).json.data;
  await put(men, 'leads/l1', Object.assign({}, l1, { trialBookedAt: '2026-01-01 00:00', noAnswer: 99, stageLog: [], noAnswerLog: [{ at: 'x' }] }));
  const l1b = (await req('/api/doc?path=leads%2Fl1', { cookie: dir })).json.data;
  ok('trialBookedAt / noAnswer / stageLog ni mijoz o‘zgartira olmaydi', !l1b.trialBookedAt && !l1b.noAnswer && l1b.stageLog.length >= 2, JSON.stringify(l1b).slice(0, 200));
  for (let i = 0; i < 30; i++) await put(men, 'leads/l1', Object.assign({}, l1b, { noAnswerAdd: true }));
  const l1c = (await req('/api/doc?path=leads%2Fl1', { cookie: dir })).json.data;
  ok('«Ko‘tarmadi» jurnali cheklangan (20 ta)', l1c.noAnswer === 30 && l1c.noAnswerLog.length === 20 && !('noAnswerAdd' in l1c));
  const xss = await put(men, 'leads/l1', Object.assign({}, l1c, { stage: '<img src=x onerror=alert(1)>', phone2: '<script>alert(1)</script>' }));
  ok('HTML li qiymat saqlanadi, server yiqilmaydi (sahifada matn bo‘lib chiqadi)', xss.status === 200);
  ok('O‘qituvchi murojaatni o‘zgartira olmaydi', (await put(ust, 'leads/l1', l1c)).status === 403);
})().catch(e => { fail++; out.push('  ✗ XATO: ' + (e && e.stack || e)); }).finally(() => {
  try { srv && srv.kill(); } catch (e) { }
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { }
  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o‘tdi');
  process.exit(fail ? 1 : 0);
});
