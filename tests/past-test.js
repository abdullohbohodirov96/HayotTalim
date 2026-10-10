/* Past darajali tuzatishlar (16-bo'lim):
   — boshlang'ich direktor paroli tasodifiy va kodda ochiq emas;
   — xodim sessiyalari bazada, faqat xeshi bilan; server qayta ishga tushsa ham saqlanadi;
     parol almashtirilsa boshqa sessiyalar yopiladi;
   — karta to'lovi: qo'lda tasdiq/rad bir vaqtda ikki marta bajarilmaydi;
   — qissa.html va boshqa HTML sahifalarda ham CSP bor.
     node tests/past-test.js                                                   */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
let pass = 0, fail = 0; const out = [];
const ok = (n, c, e) => { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 200) : '')); } };
const eq = (n, a, b) => ok(n, a === b, 'kutilgan ' + JSON.stringify(b) + ', olindi ' + JSON.stringify(a));
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'past-'));
process.env.DATA_DIR = DIR; process.env.DB_DRIVER = 'sqlite';
const PORT = 3990 + Math.floor(Math.random() * 9);
const B = 'http://localhost:' + PORT;
let srv = null, log = '';
async function boot(extraEnv) {
  log = '';
  const env = Object.assign({}, process.env, { DATA_DIR: DIR, DB_DRIVER: 'sqlite', PORT: String(PORT), BACKUP_DIR: path.join(DIR, 'b') }, extraEnv || {});
  delete env.SEED_DIRECTOR_PASSWORD;
  if (extraEnv && extraEnv.SEED_DIRECTOR_PASSWORD) env.SEED_DIRECTOR_PASSWORD = extraEnv.SEED_DIRECTOR_PASSWORD;
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 60; i++) { if (await fetch(B + '/api/health').then(r => r.status).catch(() => 0) === 200) return; await new Promise(r => setTimeout(r, 250)); }
  throw new Error('server ko‘tarilmadi');
}
async function stop() { if (srv) { srv.kill(); await new Promise(r => srv.on('exit', r)); srv = null; } }
async function req(p, o = {}) {
  const h = {}; if (o.body) h['Content-Type'] = 'application/json'; if (o.cookie) h.Cookie = o.cookie;
  const r = await fetch(B + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, json: j, text: t, headers: r.headers, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const login = (l, p) => req('/api/login', { body: { login: l, password: p } });

(async () => {
  try {
    out.push('\n1. Boshlang’ich direktor paroli');
    await boot();
    const m = /vaqtinchalik parol \(faqat bir marta ko’rsatiladi\): (\S+)/.exec(log);
    ok('Tasodifiy parol bir marta jurnalga chiqdi', !!m, log.slice(0, 300));
    eq('Eski umumiy parol (hayottalim.123) ishlamaydi', (await login('admin', 'hayottalim.123')).status, 401);
    const first = await login('admin', m ? m[1] : 'x');
    eq('Tasodifiy parol bilan kirildi', first.status, 200);
    ok('Kodda umumiy boshlang’ich parol yo’q', !/\|\| 'hayottalim\.123'/.test(fs.readFileSync(path.join(__dirname, '..', 'server', 'index.js'), 'utf8')));
    const NEW = 'SinovDirektor2026!';
    const me = (await req('/api/me', { cookie: first.cookie })).json.user;
    await req('/api/doc?path=' + encodeURIComponent('users/' + me.id), { method: 'PUT', cookie: first.cookie, body: { data: Object.assign({}, me), password: NEW } });
    await stop();

    out.push('\n2. Xodim sessiyalari bazada, xeshlangan');
    await boot();
    ok('Qayta ishga tushganda parol yana chiqmaydi', !/vaqtinchalik parol/.test(log));
    const a = await login('admin', NEW);
    eq('Yangi parol bilan kirildi', a.status, 200);
    const token = decodeURIComponent(a.cookie.split('=')[1] || '');
    const { createStore } = require('../server/store');
    const st = createStore(); if (st.ready) await st.ready;
    const rows = await st.list('staffsess/');
    ok('Sessiya bazada saqlangan', rows.some(r => r.path === 'staffsess/' + crypto.createHash('sha256').update(token).digest('hex')));
    ok('Tokenning o’zi bazada yo’q', !JSON.stringify(rows).includes(token));
    eq('staffsess API orqali o’qilmaydi', (await req('/api/doc?path=' + encodeURIComponent(rows[0].path), { cookie: a.cookie })).status, 403);
    await stop(); await boot();
    eq('Server qayta ishga tushsa ham sessiya ishlaydi', (await req('/api/me', { cookie: a.cookie })).status, 200);
    const b = await login('admin', NEW);
    const me2 = (await req('/api/me', { cookie: a.cookie })).json.user;
    await req('/api/doc?path=' + encodeURIComponent('users/' + me2.id), { method: 'PUT', cookie: a.cookie, body: { data: Object.assign({}, me2), password: NEW + 'x' } });
    eq('Parol almashtirilgach boshqa qurilma sessiyasi yopildi', (await req('/api/me', { cookie: b.cookie })).status, 401);
    eq('Almashtirgan qurilma sessiyasi qoladi', (await req('/api/me', { cookie: a.cookie })).status, 200);
    await req('/api/logout', { method: 'POST', cookie: a.cookie });
    eq('Chiqqandan keyin sessiya ishlamaydi', (await req('/api/me', { cookie: a.cookie })).status, 401);
    const c = await login('admin', NEW + 'x');

    out.push('\n3. Karta to’lovi: ikki marta tasdiqlab bo’lmaydi');
    await req('/api/doc?path=students%2Fpb1', { method: 'PUT', cookie: c.cookie, body: { data: { id: 'pb1', firstName: 'Karta', lastName: 'Sinov', phone: '+998900007777', status: 'faol' } } });
    await st.set('payclaim/pcx1', { id: 'pcx1', studentId: 'pb1', chatId: '', base: 400000, tail: 37, amount: 400037, status: 'tolandi', createdAt: '2026-10-10 10:00', atMs: Date.now() });
    const [r1, r2] = await Promise.all([
      req('/api/paybank/confirm', { cookie: c.cookie, body: { claimId: 'pcx1' } }),
      req('/api/paybank/confirm', { cookie: c.cookie, body: { claimId: 'pcx1' } })
    ]);
    const codes = [r1.status, r2.status].sort();
    ok('Bir vaqtdagi ikki so’rovdan faqat bittasi o’tdi', codes[0] === 200 && codes[1] === 409, JSON.stringify([r1.text.slice(0, 80), r2.text.slice(0, 80)]));
    const pays = (await st.list('payments/')).map(x => x.data).filter(p => p && p.studentId === 'pb1');
    eq('To’lov bitta yozildi', pays.length, 1);
    eq('Tasdiqlangan da’voni rad etib bo’lmaydi', (await req('/api/paybank/reject', { cookie: c.cookie, body: { claimId: 'pcx1' } })).status, 409);
    eq('Da’vo holati o’zgarmadi', (await st.get('payclaim/pcx1')).status, 'tasdiqlandi');

    out.push('\n4. Boshqa HTML sahifalarda ham CSP');
    const q = await req('/qissa.html');
    ok('qissa.html — CSP sarlavhasi bor', /script-src 'self'/.test(q.headers.get('content-security-policy') || ''), q.headers.get('content-security-policy'));
    ok('…ichki skript xeshi kiritilgan', /'sha256-/.test(q.headers.get('content-security-policy') || ''));
    const idx = await req('/');
    ok('Bosh sahifada CSP saqlanib qoldi', /frame-ancestors 'none'/.test(idx.headers.get('content-security-policy') || ''));
  } catch (e) { ok('Kutilmagan xato', false, e.stack); }
  await stop();
  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ XATOLAR BOR — ' + pass + " ta o'tdi, " + fail + ' ta xato' : '✓ HAMMASI O’TDI — ' + pass + " ta o'tdi, 0 ta xato"));
  process.exit(fail ? 1 : 0);
})();
