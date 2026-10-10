/* O'quvchi yuklashlari uchun cheklov: kuniga fayllar soni va jami hajm.
   O'zining alohida (sun'iy) server nusxasini ishga tushiradi:
     node tests/kvota-test.js                                                */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const PASS = 'Albyana2026!';
let pass = 0, fail = 0; const out = [];
const ok = (n, c, e) => { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 160) : '')); } };
const eq = (n, a, b) => ok(n, a === b, 'kutilgan ' + b + ', olindi ' + a);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kvota-'));
  const port = 3900 + Math.floor(Math.random() * 90);
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: Object.assign({}, process.env, {
      DATA_DIR: dir, DB_DRIVER: 'sqlite', PORT: String(port), BACKUP_DIR: path.join(dir, 'b'),
      SEED_DIRECTOR_PASSWORD: PASS, STUDENT_FILES_PER_DAY: '3', STUDENT_FILE_QUOTA_MB: '1'
    }), stdio: 'ignore'
  });
  const B = 'http://localhost:' + port;
  for (let i = 0; i < 40; i++) { if (await fetch(B + '/api/health').then(r => r.status).catch(() => 0) === 200) break; await new Promise(r => setTimeout(r, 300)); }
  async function req(p, o = {}) {
    const h = {}; if (o.body) h['Content-Type'] = 'application/json'; if (o.cookie) h.Cookie = o.cookie; if (o.csrf) h['X-Kab-Csrf'] = o.csrf;
    const r = await fetch(B + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
    return { status: r.status, json: j, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  }
  try {
    const dirc = (await req('/api/login', { body: { login: 'admin', password: PASS } })).cookie;
    await req('/api/doc?path=students%2Fkv1', { method: 'PUT', cookie: dirc, body: { data: { id: 'kv1', firstName: 'Kvota', lastName: 'Sinov', phone: '+998900001111', status: 'faol' } } });
    const code = (await req('/api/doc?path=students%2Fkv1', { cookie: dirc })).json.data.code;
    const k = await req('/api/kabinet', { body: { code } });
    const kp = (sub, body) => req('/api/kabinet/' + sub, { cookie: k.cookie, csrf: k.json.csrf, body });
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    out.push('\n1. Kuniga fayllar soni (sinovda 3 ta)');
    eq('1-fayl (Fayllarim)', (await kp('files/upload', { name: 'a.png', type: 'image/png', data: png })).status, 200);
    eq('2-fayl (kurs)', (await kp('course/upload', { name: 'b.png', type: 'image/png', data: png })).status, 200);
    eq('3-fayl', (await kp('files/upload', { name: 'c.png', type: 'image/png', data: png })).status, 200);
    const r4 = await kp('files/upload', { name: 'd.png', type: 'image/png', data: png });
    eq('4-fayl rad etildi (Fayllarim)', r4.status, 429);
    ok('Tushunarli xabar', /Bugun juda ko’p fayl/.test((r4.json || {}).error || ''), JSON.stringify(r4.json));
    eq('4-fayl rad etildi (kurs)', (await kp('course/upload', { name: 'e.png', type: 'image/png', data: png })).status, 429);

    out.push('\n2. Jami hajm (sinovda 1 MB)');
    const files = require('../server/files');
    const { createStore } = require('../server/store');
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kvota-u-'));
    const st = createStore();
    await st.set('files/f0000000000000001', { id: 'f0000000000000001', byKind: 'oquvchi', by: 's9', bytes: 140 * 1024 * 1024, at: '2026-01-01 10:00' });
    const e1 = await files.studentQuotaError(st, 's9', '2026-10-10', 20 * 1024 * 1024);
    ok('Hajm oshsa rad etiladi', /joy tugadi/.test(e1 || ''), e1);
    ok('Sig’sa ruxsat', (await files.studentQuotaError(st, 's9', '2026-10-10', 1024)) === null);
    ok('Boshqa o’quvchi hisobga olinmaydi', (await files.studentQuotaError(st, 's8', '2026-10-10', 1024)) === null);
  } finally { srv.kill(); }
  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ XATOLAR BOR — ' + pass + " ta o'tdi, " + fail + ' ta xato' : '✓ HAMMASI O’TDI — ' + pass + " ta o'tdi, 0 ta xato"));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
