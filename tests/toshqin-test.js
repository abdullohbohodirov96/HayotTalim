/* Toshqin (flood) va sekin ulanish (slowloris) himoyasi sinovi.
   Server FLOOD_MAX=50 bilan ishga tushirilishi kerak:
     FLOOD_MAX=50 PORT=3300 node server/index.js
   Ishga tushirish: node tests/toshqin-test.js [port]                  */
'use strict';
const net = require('net');
const PORT = Number(process.argv[2] || 3300);
const BASE = 'http://localhost:' + PORT;
let pass = 0, fail = 0;
const ok = (name, cond, info) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + '  → ' + (info || '')); } };

(async () => {
  console.log('\n1. Bitta IP dan toshqin');
  const codes = [];
  for (let i = 0; i < 70; i++) {
    const r = await fetch(BASE + '/robots.txt');
    codes.push(r.status);
  }
  const first429 = codes.indexOf(429);
  ok('Dastlabki so’rovlar o’tadi', codes.slice(0, 40).every(c => c === 200), codes.slice(0, 40).join(','));
  ok('Chegaradan keyin 429', first429 > 0 && first429 <= 55, 'birinchi 429: ' + first429);
  ok('Keyingilari ham to’xtatilgan', codes.slice(55).every(c => c === 429), codes.slice(55).join(','));
  const api = await fetch(BASE + '/api/public');
  ok('To’xtatilgan IP API ga ham kira olmaydi', api.status === 429, String(api.status));
  ok('Retry-After sarlavhasi bor', !!api.headers.get('retry-after'), api.headers.get('retry-after'));
  const h = await fetch(BASE + '/api/health');
  ok('Sog’liq tekshiruvi (/api/health) baribir ishlaydi', h.status === 200, String(h.status));

  console.log('\n2. Sekin ulanish (slowloris)');
  const t0 = Date.now();
  const closedAfter = await new Promise(resolve => {
    const s = net.connect(PORT, '127.0.0.1', () => {
      s.write('GET / HTTP/1.1\r\nHost: localhost\r\n');
      const iv = setInterval(() => { try { s.write('X-a: b\r\n'); } catch (e) { } }, 5000);
      s.on('close', () => { clearInterval(iv); resolve(Date.now() - t0); });
      s.on('error', () => { });
    });
    setTimeout(() => resolve(-1), 45000);
  });
  ok('Tugamagan sarlavha ~20 soniyada yopiladi', closedAfter > 0 && closedAfter < 35000, closedAfter + ' ms');

  console.log('\n' + (fail ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI') + ' — ' + pass + " ta o'tdi, " + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})();
