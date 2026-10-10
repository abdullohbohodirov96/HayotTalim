/* Vercel (namoyish) nusxasi: javoblar kaliti yo'q, ochiq formalar ERP ga boradi.
   1) scripts/build-vercel.js natijasini tekshiradi;
   2) serverda ochiq yo'llar uchun CORS (faqat ruxsat etilgan manbadan).
     node tests/vercel-test.js [port]   (port berilsa — ishlab turgan server)  */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const PORT = process.argv[2] || '';
let pass = 0, fail = 0; const out = [];
const ok = (n, c, e) => { if (c) { pass++; out.push('  ✓ ' + n); } else { fail++; out.push('  ✗ ' + n + (e ? '  → ' + String(e).slice(0, 160) : '')); } };

(async () => {
  out.push('\n1. Vercel nusxasi');
  execFileSync(process.execPath, [path.join(root, 'build.js')], { stdio: 'ignore' });
  execFileSync(process.execPath, [path.join(root, 'scripts/build-vercel.js')], { stdio: 'ignore', env: Object.assign({}, process.env, { SITE_URL: 'https://hayottalim.uz' }) });
  const dist = path.join(root, 'vercel-dist');
  ok('levels-local.js (javoblar kaliti) yo’q', !fs.existsSync(path.join(dist, 'js/levels-local.js')));
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  ok('index.html da levels-local ulanmagan', !/levels-local/.test(html));
  ok('Ochiq formalar asosiy serverga yo’naltirilgan', /MARKAZ_API_BASE = "https:\/\/hayottalim\.uz"/.test(html));
  const jsFiles = fs.readdirSync(path.join(dist, 'js')).filter(f => /\.js$/.test(f));
  const leak = jsFiles.filter(f => /testq\/|"answer"\s*:\s*\d/.test(fs.readFileSync(path.join(dist, 'js', f), 'utf8')));
  ok('JS fayllarda daraja testi javoblari yo’q', leak.length === 0, leak.join(', '));
  const kurs = fs.readFileSync(path.join(dist, 'js/course-a1.js'), 'utf8');
  ok('Kurs uy vazifasi javoblari yo’q', !/auto:\s*\[[^\]]*answer:/.test(kurs));

  if (PORT) {
    out.push('\n2. Server: ochiq yo’llar uchun CORS');
    const B = 'http://localhost:' + PORT;
    const pre = (p, origin) => fetch(B + p, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    const r1 = await pre('/api/lead', 'https://sabo-academy.vercel.app');
    ok('Vercel manbasidan ariza preflight ruxsat (' + r1.status + ')', r1.status === 204 && r1.headers.get('access-control-allow-origin') === 'https://sabo-academy.vercel.app');
    const r2 = await pre('/api/lead', 'https://zararli.example.com');
    ok('Begona manbaga ruxsat yo’q (' + r2.status + ')', r2.status === 403 && !r2.headers.get('access-control-allow-origin'));
    const r3 = await pre('/api/bootstrap', 'https://sabo-academy.vercel.app');
    ok('Yopiq yo’llarga CORS yo’q', !r3.headers.get('access-control-allow-origin'));
    const st = await fetch(B + '/api/test/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://sabo-academy.vercel.app' }, body: '{}' });
    ok('Daraja testi Vercel’dan boshlanadi (' + st.status + ')', st.status === 200 && st.headers.get('access-control-allow-origin') === 'https://sabo-academy.vercel.app');
    ok('Credentials ruxsat etilmagan', !st.headers.get('access-control-allow-credentials'));
  }
  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ XATOLAR BOR — ' + pass + " ta o'tdi, " + fail + ' ta xato' : '✓ HAMMASI O’TDI — ' + pass + " ta o'tdi, 0 ta xato"));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
