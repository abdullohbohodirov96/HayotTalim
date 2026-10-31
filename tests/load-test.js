/* YUKLAMA TESTI — faqat LOKAL sinov serveriga! (production ga emas)
   Server: PORT=3500 SEED_DIRECTOR_PASSWORD='Load-Direktor-2026!' TRUST_PROXY_HOPS=1 node server/index.js
   Ishga tushirish: SEED=1 N=300 CONC=100 node tests/load-test.js */
// Yuklama testi: N o'quvchi bir vaqtda kabinetni ochadi va mashq qiladi + xodimlar ERP da ishlaydi
const B = process.env.BASE || 'http://localhost:3500';
const PASS = 'Load-Direktor-2026!';
let ipN = 0;
const ip = () => '10.' + (50 + (++ipN >> 16) % 50) + '.' + ((ipN >> 8) & 255) + '.' + (ipN & 255);
async function req(p, o = {}) {
  const h = { 'X-Forwarded-For': o.ip || ip() };
  if (o.body) h['Content-Type'] = 'application/json';
  if (o.cookie) h.Cookie = o.cookie; if (o.csrf) h['X-Kab-Csrf'] = o.csrf;
  const t0 = Date.now();
  try {
    const r = await fetch(B + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: h, body: o.body ? JSON.stringify(o.body) : undefined });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { }
    return { status: r.status, json: j, ms: Date.now() - t0, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  } catch (e) { return { status: 0, ms: Date.now() - t0, err: e.message }; }
}
const stats = {};
function rec(name, r) { const s = stats[name] = stats[name] || { n: 0, err: 0, ms: [], codes: {} }; s.n++; s.ms.push(r.ms); s.codes[r.status] = (s.codes[r.status] || 0) + 1; if (!(r.status >= 200 && r.status < 300)) s.err++; }
function pct(a, p) { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0; }
async function pool(items, conc, fn) { let i = 0; await Promise.all(Array.from({ length: conc }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }

(async () => {
  const N = Number(process.env.N || 300), CONC = Number(process.env.CONC || 100);
  const dir = (await req('/api/login', { body: { login: 'admin', password: PASS } })).cookie;
  const put = (p, d, extra) => req('/api/doc?path=' + encodeURIComponent(p), { method: 'PUT', cookie: dir, body: Object.assign({ data: d }, extra || {}) });
  if (process.env.SEED === '1') {
    const t0 = Date.now();
    await put('staff/t1', { id: 't1', name: 'Ustoz', status: 'faol', payType: 'fixed', salaryAmount: 1 });
    await put('courses/c1', { id: 'c1', name: 'Arab', monthlyFee: 400000, active: true, level: 'A1' });
    await put('courses/c0', { id: 'c0', name: 'Alifbo', monthlyFee: 400000, active: true, level: 'A0' });
    const G = 20;
    await pool(Array.from({ length: G }, (_, i) => i), 10, async i => {
      await put('groups/g' + i, { id: 'g' + i, name: (i % 2 ? 'A1' : 'A0') + ' | guruh ' + i, courseId: i % 2 ? 'c1' : 'c0', teacherId: 't1', days: [1 + i % 3, 3 + i % 3], startTime: String(8 + i % 12).padStart(2, '0') + ':00', endTime: String(9 + i % 12).padStart(2, '0') + ':30', startDate: '2026-09-01', fee: 400000, feeHistory: [{ fee: 400000, from: '2026-09' }], limit: 20, status: 'faol', format: 'onlayn' });
    });
    await pool(Array.from({ length: N }, (_, i) => i), 15, async i => {
      await put('students/s' + i, { id: 's' + i, firstName: 'O‘quvchi', lastName: 'N' + i, phone: '+99890' + String(1000000 + i), status: 'faol' });
      await put('memberships/m' + i, { id: 'm' + i, studentId: 's' + i, groupId: 'g' + (i % G), joinedAt: '2026-09-01', status: 'faol' });
    });
    await pool(Array.from({ length: 600 }, (_, i) => i), 15, async i => {
      await put('leads/l' + i, { id: 'l' + i, name: 'Lid ' + i, phone: '+99893' + String(1000000 + i), stage: ['yangi', 'boglanildi', 'sinov', 'rad'][i % 4], funnelId: 'fnl_asosiy', createdAt: '2026-10-' + String(1 + i % 30).padStart(2, '0') + ' 10:00', note: 'izoh '.repeat(20) });
    });
    console.log('seed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  /* O'quvchilar kodi */
  const bs = (await req('/api/bootstrap', { cookie: dir })).json;
  const codes = Object.values(bs.col.students).map(s => s.code).filter(Boolean).slice(0, N);
  /* 1) Kirish to'lqini: hamma bir vaqtda kiradi */
  const sess = [];
  const tA = Date.now();
  await pool(codes, CONC, async code => { const r = await req('/api/kabinet', { body: { code } }); rec('kirish (kod)', r); if (r.status === 200) sess.push({ cookie: r.cookie, csrf: r.json.csrf }); });
  const loginWave = Date.now() - tA;
  /* 2) Kabinet ochilishi + mashq: har o'quvchi 8 ta o'qish + 3 ta yozish; parallel xodimlar */
  const staffLoop = (async () => { for (let i = 0; i < 20; i++) { rec('xodim: bootstrap (ERP ochilishi)', await req('/api/bootstrap', { cookie: dir })); const l = (await req('/api/doc?path=leads%2Fl' + i, { cookie: dir })); rec('xodim: murojaat saqlash', await put('leads/l' + i, Object.assign({}, l.json && l.json.data, { note: 'yangilandi ' + i }))); } })();
  const tB = Date.now();
  await pool(sess, CONC, async s => {
    const g = p => req('/api/kabinet/' + p, { cookie: s.cookie });
    const w = (p, b) => req('/api/kabinet/' + p, { cookie: s.cookie, csrf: s.csrf, body: b || {} });
    rec('kabinet/me', await g('me'));
    const [c, a, d, v, t, pr] = await Promise.all([g('course'), g('alif'), g('daily'), g('vocab'), g('top'), g('progress')]);
    rec('kabinet/course', c); rec('kabinet/alif', a); rec('kabinet/daily', d); rec('kabinet/vocab', v); rec('kabinet/top', t); rec('kabinet/progress', pr);
    rec('yozish: alif/step', await w('alif/step', { lessonId: 'a0-01', step: 'learn' }));
    rec('yozish: course/step', await w('course/step', { lessonId: 'a1-01', step: 'video' }));
    rec('kabinet/deck', await g('vocab/deck'));
  });
  const practice = Date.now() - tB;
  await staffLoop;
  const h = await req('/api/health');
  console.log('\nN=' + N + ' parallel=' + CONC + ' · kirish to‘lqini ' + (loginWave / 1000).toFixed(1) + 's · kabinet+mashq ' + (practice / 1000).toFixed(1) + 's · health ' + h.status);
  console.log('so‘rov'.padEnd(34) + 'soni  xato  p50   p95   max  kodlar');
  Object.keys(stats).forEach(k => { const s = stats[k]; console.log(k.padEnd(34) + String(s.n).padStart(4) + String(s.err).padStart(6) + String(pct(s.ms, .5)).padStart(6) + String(pct(s.ms, .95)).padStart(6) + String(Math.max(...s.ms)).padStart(6) + '  ' + JSON.stringify(s.codes)); });
})();
