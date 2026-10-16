/* ZOOM SINOVI — haqiqiy Zoom'ga ulanmaydi: API soxta (mock) javob beradi.
   Tekshiriladi: konferensiya 2 soat oldin ochiladi, shaxsiy havolalar,
   1 soat / 15 daqiqa / boshlanganda eslatma, 10 daqiqadan keyin faqat
   qo'shilmaganlarga xabar, webhook imzosi, davomat, dars yozuvi guruhga.
   Ishga tushirish: node tests/zoom-test.js                                  */
'use strict';
process.env.ZOOM_ACCOUNT_ID = 'acc'; process.env.ZOOM_CLIENT_ID = 'cid'; process.env.ZOOM_CLIENT_SECRET = 'sec';
process.env.ZOOM_WEBHOOK_SECRET = 'whsec';
const crypto = require('crypto');
const { A } = require('../server/shared');
const zoom = require('../server/zoom');

let pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (info ? '  → ' + info : '')); } }

/* Xotiradagi ombor */
const db = {};
const store = {
  async get(p) { return db[p] ? JSON.parse(JSON.stringify(db[p])) : null; },
  async set(p, v) { db[p] = JSON.parse(JSON.stringify(v)); },
  async del(p) { delete db[p]; },
  async list(prefix) { return Object.keys(db).filter(k => k.indexOf(prefix) === 0).map(k => ({ path: k, data: JSON.parse(JSON.stringify(db[k])) })); }
};

/* Sana: bugun (Toshkent), dars 18:00–19:30 */
const DAY_MS = Date.UTC(2026, 9, 19, 0, 0);           // 2026-10-19 dushanba (UTC)
const at = (hh, mm) => DAY_MS + ((hh - 5) * 60 + mm) * 60000; // Toshkent vaqtini UTC ms ga
const iso = '2026-10-19';
const wd = A.weekdayOf(iso);

db['groups/g1'] = { id: 'g1', code: 'B020', name: 'Arab A1', format: 'onlayn', status: 'faol', days: [wd], startTime: '18:00', endTime: '19:30', startDate: '2026-09-01', teacherId: 'st1', tgChat: '-100500' };
db['groups/g2'] = { id: 'g2', code: 'X1', name: 'Oflayn', format: 'oflayn', roomId: 'r1', status: 'faol', days: [wd], startTime: '18:00', endTime: '19:30', startDate: '2026-09-01' };
db['staff/st1'] = { id: 'st1', name: 'Ustoz', telegram: { id: '900' } };
[['s1', 'Madina', 'Karimova', '101'], ['s2', 'Sardor', 'Aliyev', '102'], ['s3', 'Bek', 'Toshev', null]].forEach(([id, f, l, tg], i) => {
  db['students/' + id] = { id, firstName: f, lastName: l, phone: '+99890000000' + i, telegram: tg ? { id: tg } : null };
  db['memberships/m' + id] = { id: 'm' + id, studentId: id, groupId: 'g1', status: 'faol' };
});

/* Soxta Zoom API */
const calls = [];
let recordingReady = false;
zoom.setFetch(async (url, opt) => {
  calls.push((opt && opt.method || 'GET') + ' ' + url.replace(/\?.*$/, ''));
  const J = (o, st) => ({ ok: (st || 200) < 300, status: st || 200, json: async () => o, arrayBuffer: async () => new ArrayBuffer(10) });
  if (/oauth\/token/.test(url)) return J({ access_token: 'T', expires_in: 3600 });
  if (/\/users\/me\/meetings$/.test(url)) {
    const b = JSON.parse(opt.body);
    ok('Konferensiya: cloud yozuv yoqilgan', b.settings.auto_recording === 'cloud');
    ok('Konferensiya: Toshkent vaqti 18:00', b.start_time === iso + 'T18:00:00' && b.timezone === 'Asia/Tashkent');
    return J({ id: 777, uuid: 'UU==', join_url: 'https://zoom.us/j/777', start_url: 'https://zoom.us/s/777', password: 'p1' });
  }
  if (/\/meetings\/777\/registrants$/.test(url)) {
    const b = JSON.parse(opt.body);
    return J({ registrant_id: 'R-' + b.first_name, join_url: 'https://zoom.us/w/777?tk=' + b.first_name });
  }
  if (/past_meetings/.test(url)) return J({ participants: [] });
  if (/metrics/.test(url)) return J({}, 400);
  if (/\/recordings$/.test(url)) {
    return recordingReady ? J({ share_url: 'https://zoom.us/rec/share/abc', recording_play_passcode: 'xyz', recording_files: [{ file_type: 'MP4', file_size: 300 * 1024 * 1024, download_url: 'https://zoom.us/dl/1', play_url: 'https://zoom.us/rec/play/1' }] }) : J({ message: 'yo‘q' }, 404);
  }
  return J({ message: 'nomaʼlum ' + url }, 404);
});

const sent = [], groupMsgs = [];
let n = 0;
const ctx = {
  stamp: () => '2026-10-19 18:' + String(n++ % 60).padStart(2, '0'),
  send: async (m) => { sent.push(m); return { id: 'x' }; },
  sendGroup: async (g, text) => { groupMsgs.push({ chat: g.tgChat, text }); return { ok: true }; },
  sendVideo: async () => { throw new Error('katta fayl yuborilmasligi kerak edi'); }
};
const kinds = k => sent.filter(m => m.dedupeKey.indexOf(':' + k + ':') > 0);

(async () => {
  console.log('\n1. Vaqt bo’yicha qadamlar');
  await zoom.tick(store, A, ctx, at(15, 30));
  ok('2,5 soat oldin — hali ochilmaydi', !db['zoomlesson/g1__' + iso]);
  await zoom.tick(store, A, ctx, at(16, 1));
  const rec = db['zoomlesson/g1__' + iso];
  ok('2 soat oldin konferensiya ochildi', rec && rec.meetingId === '777');
  ok('Oflayn guruhga konferensiya ochilmaydi', !db['zoomlesson/g2__' + iso]);
  ok('3 o’quvchiga shaxsiy havola', rec && Object.keys(rec.regs).length === 3, JSON.stringify(rec && rec.regs));
  ok('Hali eslatma yo’q', sent.length === 0);

  await zoom.tick(store, A, ctx, at(17, 0));
  ok('1 soat oldin: botga ulangan 2 o’quvchiga eslatma', kinds('h1').length === 2, kinds('h1').length);
  ok('Ustozga «Darsni boshlash» havolasi', sent.some(m => m.chatId === '900' && /zoom\.us\/s\/777/.test(m.text)));
  ok('Har o’quvchiga O’Z havolasi', kinds('h1').every(m => /tk=/.test(m.text)) && /tk=Madina/.test(kinds('h1').filter(m => m.studentId === 's1')[0].text));
  await zoom.tick(store, A, ctx, at(17, 10));
  ok('Takroriy tick — qayta yubormaydi', kinds('h1').length === 2);
  await zoom.tick(store, A, ctx, at(17, 45));
  ok('15 daqiqa oldin eslatma', kinds('m15').length === 2);
  await zoom.tick(store, A, ctx, at(18, 0));
  ok('Dars boshlanganda havola', kinds('start').length === 2);

  console.log('\n2. Webhook: kim qo’shildi');
  const body = JSON.stringify({ event: 'meeting.participant_joined', payload: { object: { id: '777', uuid: 'UU==', participant: { registrant_id: 'R-Madina', user_name: 'Madina', join_time: '2026-10-19T13:02:00Z' } } } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = 'v0=' + crypto.createHmac('sha256', 'whsec').update('v0:' + ts + ':' + body).digest('hex');
  ok('To’g’ri imzo qabul qilinadi', zoom.verify(body, { 'x-zm-request-timestamp': ts, 'x-zm-signature': sig }));
  ok('Soxta imzo rad etiladi', !zoom.verify(body, { 'x-zm-request-timestamp': ts, 'x-zm-signature': 'v0=00' }));
  ok('Eski vaqt belgisi rad etiladi', !zoom.verify(body, { 'x-zm-request-timestamp': String(Number(ts) - 900), 'x-zm-signature': sig }));
  await zoom.webhook(store, JSON.parse(body), ctx);
  /* Ism bo'yicha (registrant_id siz) ham topiladi */
  await zoom.webhook(store, { event: 'meeting.participant_joined', payload: { object: { id: '777', participant: { user_name: 'Bek Toshev', join_time: '2026-10-19T13:20:00Z' } } } }, ctx);
  await zoom.webhook(store, { event: 'meeting.participant_joined', payload: { object: { id: '777', participant: { user_name: 'Begona odam' } } } }, ctx);
  const r2 = db['zoomlesson/g1__' + iso];
  ok('Madina qo’shildi (shaxsiy havola)', !!r2.joined.s1);
  ok('Bek ism bo’yicha topildi', !!r2.joined.s3);
  ok('Begona ism alohida ro’yxatda', r2.guests.indexOf('Begona odam') >= 0);
  const v = await zoom.webhook(store, { event: 'endpoint.url_validation', payload: { plainToken: 'abc' } }, ctx);
  ok('URL tasdiqlash javobi', v.reply && v.reply.encryptedToken === crypto.createHmac('sha256', 'whsec').update('abc').digest('hex'));

  console.log('\n3. Qo’shilmaganlarga qayta xabar');
  await zoom.tick(store, A, ctx, at(18, 11));
  ok('Faqat qo’shilmagan Sardorga xabar', kinds('miss').length === 1 && kinds('miss')[0].studentId === 's2', JSON.stringify(kinds('miss').map(m => m.studentId)));

  console.log('\n4. Davomat va yozuv');
  await zoom.tick(store, A, ctx, at(19, 41));
  const L = db['lessons/g1__2026-10'];
  const att = L && L.items[iso] && L.items[iso].attendance;
  ok('Davomat yozildi', !!att);
  ok('Madina — keldi', att && att.ms1.status === 'keldi', att && JSON.stringify(att.ms1));
  ok('Sardor — kelmadi', att && att.ms2.status === 'kelmadi');
  ok('Bek 20 daqiqa kechikdi — kechikdi', att && att.ms3.status === 'kechikdi', att && JSON.stringify(att.ms3));
  recordingReady = true;
  await zoom.tick(store, A, ctx, at(19, 52));
  ok('Yozuv guruh chatiga yuborildi (katta fayl → havola)', groupMsgs.length === 1 && /rec\/share\/abc/.test(groupMsgs[0].text) && /xyz/.test(groupMsgs[0].text), JSON.stringify(groupMsgs));
  await zoom.tick(store, A, ctx, at(20, 30));
  ok('Yozuv ikki marta yuborilmaydi', groupMsgs.length === 1);

  console.log('\n5. O’qituvchi belgilagan davomatga tegmaydi');
  L.items[iso].attendance.ms2 = { status: 'sababli' };
  db['lessons/g1__2026-10'] = L;
  const rec3 = await store.get('zoomlesson/g1__' + iso);
  await zoom.writeAttendance(store, rec3, ctx);
  ok('Sababli o’zgarmadi', db['lessons/g1__2026-10'].items[iso].attendance.ms2.status === 'sababli');

  const ov = await zoom.overview(store, '');
  ok('ERP ro’yxati: 2 qo’shildi, 1 qo’shilmadi', ov.lessons[0].joined.length === 2 && ov.lessons[0].missing.length === 1);

  console.log('\n' + (fail ? '✗ XATOLAR BOR — ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o\'tdi, ' + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
