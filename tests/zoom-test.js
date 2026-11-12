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
  async all() { return Object.keys(db).map(k => ({ path: k, data: JSON.parse(JSON.stringify(db[k])) })); },
  async list(prefix) { return Object.keys(db).filter(k => k.indexOf(prefix) === 0).map(k => ({ path: k, data: JSON.parse(JSON.stringify(db[k])) })); }
};

/* Sana: bugun (Toshkent), dars 18:00–19:30 */
const DAY_MS = Date.UTC(2026, 9, 19, 0, 0);           // 2026-10-19 dushanba (UTC)
const at = (hh, mm) => DAY_MS + ((hh - 5) * 60 + mm) * 60000; // Toshkent vaqtini UTC ms ga
const iso = '2026-10-19';
const wd = A.weekdayOf(iso);

db['groups/g1'] = { id: 'g1', code: 'B020', name: 'Arab A1', format: 'onlayn', status: 'faol', days: [wd], startTime: '18:00', endTime: '19:30', startDate: '2026-09-01', teacherId: 'st1', tgChat: '-100500' };
db['groups/g2'] = { id: 'g2', code: 'X1', name: 'Oflayn', format: 'oflayn', roomId: 'r1', status: 'faol', days: [wd], startTime: '18:00', endTime: '19:30', startDate: '2026-09-01' };
db['staff/st1'] = { id: 'st1', name: 'Ustoz' };
/* Ustoz ERP hisobini botga ulagan — Telegram foydalanuvchi yozuvida */
db['users/u_st1'] = { id: 'u_st1', role: 'oqituvchi', staffId: 'st1', active: true, telegram: { id: '900' } };
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
  if ((!opt || !opt.method || opt.method === 'GET') && /\/meetings\/777$/.test(url)) { if (zoomDown) return J({ message: 'xato' }, 500); return J({ id: 777, start_url: 'https://zoom.us/s/777?zak=FRESH' }); }
  if (opt && opt.method === 'PATCH' && /\/meetings\/777$/.test(url)) { calls.push('PATCHBODY ' + opt.body); return { ok: true, status: 204, json: async () => ({}) }; }
  if (/\/users\/me\/meetings$/.test(url)) {
    const b = JSON.parse(opt.body);
    ok('Konferensiya: cloud yozuv yoqilgan', b.settings.auto_recording === 'cloud');
    ok('Konferensiya: ro‘yxatdan o‘tishsiz (mehmon bo‘lib kiradi)', b.settings.approval_type === 2 && !b.settings.meeting_authentication);
    ok('Konferensiya: kutish zali o‘chiq (kod havolada)', b.settings.waiting_room === false);
    ok('Konferensiya: Toshkent vaqti 18:00', b.start_time === iso + 'T18:00:00' && b.timezone === 'Asia/Tashkent');
    return J({ id: 777, uuid: 'UU==', join_url: 'https://zoom.us/j/777', start_url: 'https://zoom.us/s/777', password: 'p1' });
  }
  if (/\/meetings\/777\/registrants$/.test(url)) {
    const b = JSON.parse(opt.body);
    return J({ registrant_id: 'R-' + b.first_name, join_url: 'https://zoom.us/w/777?tk=' + b.first_name });
  }
  if (/\/live_meetings\/888\/events$/.test(url)) { liveCalls.push(opt.body); return J({}, 204); }
  if (/past_meetings\/777\/instances/.test(url)) return J({ meetings: multiInst ? [{ uuid: '/long==', start_time: iso + 'T03:00:00Z' }, { uuid: 'short==', start_time: iso + 'T05:00:00Z' }] : [] });
  if (multiInst && /\/meetings\/%252Flong%253D%253D\/recordings$/.test(url)) return J({ share_url: 'https://zoom.us/rec/share/LONG', recording_files: [{ file_type: 'MP4', file_size: 900, download_url: 'https://zoom.us/dl/L', recording_start: '2026-11-03T03:00:00Z', recording_end: '2026-11-03T04:15:00Z' }] });
  if (/past_meetings/.test(url)) return J({ participants: [] });
  if (/metrics/.test(url)) return J({}, 400);
  if (/\/recordings$/.test(url)) {
    return recordingReady ? J({ share_url: 'https://zoom.us/rec/share/abc', recording_play_passcode: 'xyz', recording_files: [{ file_type: 'MP4', file_size: 300 * 1024 * 1024, download_url: 'https://zoom.us/dl/1', play_url: 'https://zoom.us/rec/play/1' }] }) : J({ message: 'yo‘q' }, 404);
  }
  return J({ message: 'nomaʼlum ' + url }, 404);
});

let multiInst = false, zoomDown = false; const liveCalls = [];
const sent = [], groupMsgs = [], staffMsgs = [], otherStaff = [];
let n = 0;
const ctx = {
  stamp: () => '2026-10-19 18:' + String(n++ % 60).padStart(2, '0'),
  send: async (m) => { sent.push(m); return { id: 'x' }; },
  sendGroup: async (g, text) => { groupMsgs.push({ chat: g.tgChat, text }); return { ok: true }; },
  notifyDirectors: async (text, o) => { staffMsgs.push({ text, buttons: o && o.buttons }); return { queued: 1 }; },
  notifyStaff: async (text) => { otherStaff.push(text); return { queued: 1 }; },
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
  ok('Ochiq konferensiya (ro‘yxatsiz)', rec && rec.open === true && !calls.some(c => /registrants/.test(c)), JSON.stringify(rec && rec.regs));
  ok('Hali eslatma yo’q', sent.length === 0);

  await zoom.tick(store, A, ctx, at(17, 0));
  ok('1 soat oldin hali havola ketmaydi', kinds('h1').length === 0);
  const g60 = groupMsgs.filter(m => /Bugun darsingiz bor/.test(m.text));
  ok('1 soat oldin guruh chatiga «kechikmasdan kiring» eslatmasi (havolasiz)', g60.length === 1 && /Kechikmasdan kiring/.test(g60[0].text) && !/zoom\.us/.test(g60[0].text), JSON.stringify(groupMsgs));
  const t60 = sent.filter(m => /:t60$/.test(m.dedupeKey));
  ok('1 soat oldin ustozga arabcha eslatma (havolasiz)', t60.length === 1 && t60[0].chatId === '900' && /تذكير بالدرس/.test(t60[0].text) && !/[a-z]{4,}/.test(t60[0].text.replace(/Arab A1|B020|<\/?b>/g, '')) && !/zoom|api\/zoom/.test(t60[0].text), t60[0] && t60[0].text);
  await zoom.tick(store, A, ctx, at(17, 2));
  ok('1 soatlik eslatma qayta ketmaydi', groupMsgs.filter(m => /Bugun darsingiz bor/.test(m.text)).length === 1 && sent.filter(m => /:t60$/.test(m.dedupeKey)).length === 1);
  await zoom.tick(store, A, ctx, at(17, 30));
  ok('30 daqiqa oldin: botga ulangan 2 o’quvchiga havola', /30 daqiqadan keyin/.test((kinds('h1')[0] || {}).text || '') && kinds('h1').length === 2, kinds('h1').length);
  const tMsg = sent.filter(m => m.chatId === '900' && /:teacher$/.test(m.dedupeKey))[0];
  ok('Ustozga (botga ulangan ERP hisobi) «Darsni boshlash» havolasi — doimiy (eskirmaydigan)', tMsg && /\/api\/zoom\/start\?l=g1__2026-10-19&amp;k=[0-9a-f]{32}/.test(tMsg.text), tMsg && tMsg.text);
  ok('Ustoz xabarida eskiradigan Zoom start_url yo‘q', tMsg && !/zoom\.us\/s\/777/.test(tMsg.text));
  ok('Har o’quvchiga ismi yozilgan havola', kinds('h1').every(m => /zoom\.us\/j\/777\?uname=/.test(m.text)) && /uname=Madina%20Karimova/.test(kinds('h1').filter(m => m.studentId === 's1')[0].text));
  await zoom.tick(store, A, ctx, at(17, 35));
  ok('Takroriy tick — qayta yubormaydi', kinds('h1').length === 2);
  await zoom.tick(store, A, ctx, at(17, 45));
  ok('15 daqiqa oldin eslatma', kinds('m15').length === 2);
  ok('30/15 daqiqa oldin guruh chatiga havola hali ketmaydi', !groupMsgs.some(m => /zoom\.us/.test(m.text)), JSON.stringify(groupMsgs.map(m => m.text.slice(0, 30))));
  await zoom.tick(store, A, ctx, at(17, 55));
  const g5 = groupMsgs.filter(m => /5 daqiqadan keyin dars/.test(m.text));
  ok('5 daqiqa oldin guruh chatiga darsga kirish havolasi', g5.length === 1 && /zoom\.us\/(wc\/join|j)\/777/.test(g5[0].text), JSON.stringify(groupMsgs.slice(-1)));
  ok('Guruh chatiga ustoz (organizator) havolasi ketmaydi', !groupMsgs.some(m => /api\/zoom\/start|zoom\.us\/s\//.test(m.text)));
  await zoom.tick(store, A, ctx, at(18, 0));
  ok('Dars boshlanganda havola', kinds('start').length === 2);
  ok('Dars boshlanganda guruh chatiga ham «Dars boshlandi»', groupMsgs.some(m => /Dars boshlandi/.test(m.text) && /zoom\.us|app\.zoom\.us/.test(m.text)), JSON.stringify(groupMsgs.map(m => m.text.slice(0, 40))));

  console.log('\n2. Webhook: kim qo’shildi');
  const body = JSON.stringify({ event: 'meeting.participant_joined', payload: { object: { id: '777', uuid: 'UU==', participant: { user_name: 'Madina Karimova', join_time: '2026-10-19T13:02:00Z' } } } });
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
  ok('Madina qo’shildi (ism bo‘yicha)', !!r2.joined.s1);
  ok('Bek ism bo’yicha topildi', !!r2.joined.s3);
  ok('Begona ism alohida ro’yxatda', r2.guests.indexOf('Begona odam') >= 0);
  const v = await zoom.webhook(store, { event: 'endpoint.url_validation', payload: { plainToken: 'abc' } }, ctx);
  ok('URL tasdiqlash javobi', v.reply && v.reply.encryptedToken === crypto.createHmac('sha256', 'whsec').update('abc').digest('hex'));

  console.log('\n3. Qo’shilmaganlarga qayta xabar');
  await zoom.tick(store, A, ctx, at(18, 11));
  ok('Faqat qo’shilmagan Sardorga xabar', kinds('miss').length === 1 && kinds('miss')[0].studentId === 's2', JSON.stringify(kinds('miss').map(m => m.studentId)));
  /* Dars ketayotganda guruh chatiga 15 va 30 daqiqada qiziqtiruvchi eslatma (bitta, ilovasiz havola) */
  const liveMsgs = () => groupMsgs.filter(m => zoom.LIVE_POOL.g15.concat(zoom.LIVE_POOL.g30).some(t => m.text.indexOf(t.split('</b>')[0].replace(/^.*<b>/, '')) >= 0));
  await zoom.tick(store, A, ctx, at(18, 16));
  ok('15 daqiqada guruhga eslatma', liveMsgs().length === 1, JSON.stringify(groupMsgs.slice(-1)));
  await zoom.tick(store, A, ctx, at(18, 20));
  ok('Takroriy tick — 15 daqiqalik eslatma qayta ketmaydi', liveMsgs().length === 1);
  await zoom.tick(store, A, ctx, at(18, 31));
  ok('30 daqiqada guruhga ikkinchi eslatma (boshqa matn)', liveMsgs().length === 2 && liveMsgs()[0].text !== liveMsgs()[1].text);
  ok('Eslatmalarda faqat bitta havola — ilovasiz (brauzer)', liveMsgs().every(m => (m.text.match(/https?:\/\//g) || []).length === 1 && /app\.zoom\.us\/wc\/join\/|zoom\.us\/j\/777/.test(m.text)), JSON.stringify(liveMsgs().map(m => m.text)));

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
  const recMsgs = () => groupMsgs.filter(m => /Dars yozuvi/.test(m.text));
  ok('Guruh chatiga dars e’loni (havola, darslik) bordi', groupMsgs.some(m => /5 daqiqadan keyin dars/.test(m.text) && /zoom\.us\/j\/777/.test(m.text) && /kabinet/.test(m.text)), JSON.stringify(groupMsgs));
  await new Promise(r => setTimeout(r, 30));
  ok('Yozuv rahbariyatdan so‘ramasdan, avtomatik guruh chatiga yuborildi (katta fayl → havola)', recMsgs().length === 1 && /rec\/share\/abc/.test(recMsgs()[0].text) && /xyz/.test(recMsgs()[0].text), JSON.stringify(recMsgs()));
  ok('Rahbariyatdan tasdiq so‘ralmadi, faqat «yuborildi» xabari', !staffMsgs.some(m => /Dars yozuvi tayyor/.test(m.text)) && staffMsgs.some(m => /guruhga yuborildi/.test(m.text)), JSON.stringify(staffMsgs.map(m => m.text.slice(0, 50))));
  await zoom.tick(store, A, ctx, at(20, 30));
  await new Promise(r => setTimeout(r, 30));
  ok('Keyingi tick — qayta yuborilmaydi', recMsgs().length === 1);
  const dec2 = await zoom.decideRecording(store, 'g1__' + iso, true, 'Direktor', ctx);
  ok('Yozuv ikki marta yuborilmaydi', dec2.already === 'sent' && recMsgs().length === 1);

  console.log('\n5. O’qituvchi belgilagan davomatga tegmaydi');
  L.items[iso].attendance.ms2 = { status: 'sababli' };
  db['lessons/g1__2026-10'] = L;
  const rec3 = await store.get('zoomlesson/g1__' + iso);
  await zoom.writeAttendance(store, rec3, ctx);
  ok('Sababli o’zgarmadi', db['lessons/g1__2026-10'].items[iso].attendance.ms2.status === 'sababli');

  console.log('\n6. O’quvchi kabinetida shaxsiy havola va yozuv');
  const kab = require('../server/kabinet');
  const realToday = A.today;
  db['zoomlesson/g1__' + iso].end = '23:59';
  A.today = () => iso;
  const sum = await kab.summary(store, await store.get('students/s1'));
  A.today = realToday;
  const kg = (sum.groups || []).filter(g => g.id === 'g1')[0];
  ok('Kabinetda bugungi darsga ismli havola', kg && kg.zoomLink === 'https://zoom.us/j/777?uname=Madina%20Karimova', kg && kg.zoomLink);
  ok('Qo’shilgani ko’rinadi', kg && kg.zoomToday && kg.zoomToday.joined === true);
  ok('Dars yozuvi kabinetda', kg && kg.recordings && kg.recordings[0] && /rec\/share\/abc/.test(kg.recordings[0].url), kg && JSON.stringify(kg.recordings));

  const ov = await zoom.overview(store, '');
  ok('ERP ro’yxati: 2 qo’shildi, 1 qo’shilmadi', ov.lessons[0].joined.length === 2 && ov.lessons[0].missing.length === 1);

  console.log('\n9. Mehmon havolasi (sinov darsi)');
  const rg = db['zoomlesson/g1__' + iso];
  const gl = await zoom.guestLink(store, rg, 'Dinara Karimova', {});
  ok('Mehmonga ismli havola berildi (Zoom’ga so‘rovsiz)', gl.ok && gl.joinUrl === 'https://zoom.us/j/777?uname=Dinara%20Karimova', JSON.stringify(gl));
  const gl2 = await zoom.guestLink(store, db['zoomlesson/g1__' + iso], 'dinara karimova', {});
  ok('Shu ism qayta so‘ralsa — o‘sha havola, yangi ro‘yxat yo‘q', gl2.again && gl2.joinUrl === gl.joinUrl);
  ok('Bo‘sh ism rad etiladi', !!(await zoom.guestLink(store, rg, '  ', {})).error);
  ok('Yozuv tasdig‘i faqat direktorga (adminlarga emas)', !otherStaff.some(t => /yozuv/i.test(t)), JSON.stringify(otherStaff));
  console.log('\n10b. Yozuv faqat organizator (ustoz/administrator) kirganda boshlanadi');
  db['zoomlesson/gH__' + iso] = { id: 'gH__' + iso, groupId: 'g1', groupName: 'H guruh', date: iso, start: '18:00', end: '19:30', meetingId: '888', hostId: 'HOST1', recMode: 'host', sent: {}, joined: {}, guests: [], regs: {} };
  await zoom.webhook(store, { event: 'meeting.participant_joined', payload: { object: { id: '888', host_id: 'HOST1', participant: { id: '', user_name: 'Madina Karimova' } } } }, ctx);
  ok('O‘quvchi kirdi — yozuv boshlanmadi', liveCalls.length === 0 && !db['zoomlesson/gH__' + iso].recStartedAt);
  await zoom.webhook(store, { event: 'meeting.participant_joined', payload: { object: { id: '888', host_id: 'HOST1', participant: { id: 'HOST1', user_name: 'Ustoz Suhayib' } } } }, ctx);
  ok('Organizator kirdi — bulutga yozish yoqildi (Zoom API)', liveCalls.length === 1 && /recording\.start/.test(liveCalls[0]) && !!db['zoomlesson/gH__' + iso].recStartedAt, JSON.stringify(liveCalls));
  await zoom.webhook(store, { event: 'meeting.participant_joined', payload: { object: { id: '888', host_id: 'HOST1', participant: { id: 'HOST1', user_name: 'Ustoz Suhayib' } } } }, ctx);
  ok('Organizator qayta kirsa — ikkinchi marta yoqilmaydi', liveCalls.length === 1);

  console.log('\n11. Sinov seansi (40 soniya) haqiqiy dars yozuvi o‘rniga ketmaydi');
  ok('Yozuv konferensiya raqami bo‘yicha (oxirgi seans) so‘raladi', calls.some(c => /\/meetings\/777\/recordings$/.test(c)) && !calls.some(c => /\/meetings\/UU/.test(c)));
  multiInst = true;
  const frM = await zoom._fetchRecording(store, { meetingId: '777', date: iso });
  ok('Dars bir necha seansga bo‘lingan bo‘lsa — eng uzun yozuv olinadi', frM && /LONG/.test(frM.shareUrl) && frM.durSec === 75 * 60, JSON.stringify(frM));
  multiInst = false;
  const z = zoom.tooShort({ durSec: 40 }, { start: '18:00', end: '19:30' });
  ok('40 soniyalik yozuv «juda qisqa» deb topiladi', z === true && zoom.tooShort({ durSec: 75 * 60 }, { start: '18:00', end: '19:30' }) === false);
  ok('Davomiylik ko‘rinishi', zoom.fmtDur(4712) === '1:18:32' && zoom.fmtDur(40) === '0:40');
  const before = staffMsgs.length;
  const rf = await zoom.refetchRecording(store, 'g1__' + iso, ctx);
  const recBefore = groupMsgs.filter(m => /Dars yozuvi/.test(m.text)).length;
  await new Promise(r => setTimeout(r, 30));
  ok('«Qaytadan olish»: yozuv yangilandi va guruhga avtomatik qayta yuborildi', rf.ok && !!db['zoomlesson/g1__' + iso].recSent && groupMsgs.filter(m => /Dars yozuvi/.test(m.text)).length >= recBefore, JSON.stringify(rf));
  /* Juda qisqa yozuv (sinov seansi) — avtomatik ketmaydi, rahbariyatdan so'raladi */
  const sh = { id: 'gS__' + iso, groupId: 'g1', groupName: 'S guruh', date: iso, start: '18:00', end: '19:30', meetingId: '999', sent: {}, recording: { durSec: 40, files: [{ url: 'u', size: 1 }], shareUrl: 'https://zoom.us/rec/share/short' } };
  await zoom.askRecordingApproval(store, sh, ctx);
  ok('Juda qisqa yozuv — avtomatik emas, tasdiqqa (tugmalar bilan)', !sh.recAuto && staffMsgs.some(m => /rec\/share\/short/.test(m.text) && m.buttons), JSON.stringify(staffMsgs.slice(-1)));
  console.log('\n10. Eski (ro‘yxatli) konferensiya ochiq qilinadi');
  const rr = db['zoomlesson/g1__' + iso];
  rr.open = false; delete rr.openTried; rr.status = 'jonli';
  await zoom.tick(store, A, ctx, at(18, 30));
  ok('PATCH approval_type=2 yuborildi', calls.some(c => /PATCHBODY .*"approval_type":2/.test(c)));
  ok('Endi ochiq', db['zoomlesson/g1__' + iso].open === true);
  console.log('\n11. Ustoz havolasi — har bosilganda yangi start_url');
  const lid = 'g1__' + iso, tsig = (zoom.startPath({ id: lid }).match(/k=([0-9a-f]+)/) || [])[1];
  const f1 = await zoom.freshStart(store, lid, tsig, at(17, 55));
  ok('To‘g‘ri imzo — Zoom’dan YANGI start_url', f1.url === 'https://zoom.us/s/777?zak=FRESH', JSON.stringify(f1));
  const f2 = await zoom.freshStart(store, lid, tsig, at(20, 0));
  ok('Dars vaqtidan keyin ham (1 soatgacha) ishlaydi', f2.url === 'https://zoom.us/s/777?zak=FRESH');
  ok('Soxta imzo rad etiladi', (await zoom.freshStart(store, lid, '0'.repeat(32), at(18, 0))).error === 'link');
  ok('Imzosiz rad etiladi', (await zoom.freshStart(store, lid, '', at(18, 0))).error === 'link');
  ok('Boshqa dars imzosi bilan rad etiladi', (await zoom.freshStart(store, 'g2__' + iso, tsig, at(18, 0))).error === 'link');
  ok('Yo‘l bo‘yicha hujum rad etiladi', (await zoom.freshStart(store, '../users/admin', tsig, at(18, 0))).error === 'link');
  const hid = 'gH__' + iso, hsig = (zoom.startPath({ id: hid }).match(/k=([0-9a-f]+)/) || [])[1];
  db['zoomlesson/' + hid].end = '19:30'; db['zoomlesson/' + hid].joinUrl = 'https://zoom.us/j/888';
  const f4 = await zoom.freshStart(store, hid, hsig, at(20, 45));
  ok('Dars (19:30) tugaganidan 1 soatdan ko‘p o‘tgach — eskirgan', f4.error === 'past', JSON.stringify(f4));
  ok('Dars tugaganidan 50 daqiqa o‘tgach — hali ishlaydi', !!(await zoom.freshStart(store, hid, hsig, at(20, 20))).url);
  ok('Ertasi kuni — eskirgan', (await zoom.freshStart(store, lid, tsig, at(18, 0) + 86400000)).error === 'past');
  zoomDown = true;
  const f3 = await zoom.freshStart(store, lid, tsig, at(18, 0));
  ok('Zoom javob bermasa — oddiy kirish havolasi', f3.url === 'https://zoom.us/j/777' && f3.fallback === true, JSON.stringify(f3));
  zoomDown = false;
  const tov = await zoom.overview(store, iso);
  const ovl = (tov.lessons || []).filter(l => l.id === lid)[0];
  ok('ERP «Darsni boshlash (ustoz)» tugmasi ham doimiy havola', ovl && /^\/api\/zoom\/start\?l=/.test(ovl.startUrl), ovl && ovl.startUrl);
  const lr = db['zoomlesson/g1__' + iso];
  lr.recNote = 'Video bo‘lib yuborilmadi (Zoom’dan yuklab bo‘lmadi (HTTP 401)) — havola yuborildi'; delete lr.recParts;
  const dec3 = await zoom.decideRecording(store, 'g1__' + iso, true, 'Direktor', ctx);
  ok('Avval faqat havola ketgan bo‘lsa — video qayta yuboriladi', dec3.sending === true, JSON.stringify(dec3));
  if (dec3.job) await dec3.job;
  db['zoomlesson/g1__' + iso].recNote = ''; db['zoomlesson/g1__' + iso].recSent = 'x'; const dec4 = await zoom.decideRecording(store, 'g1__' + iso, true, 'Direktor', ctx);
  ok('Video yuborilgan bo‘lsa — qayta yuborilmaydi', dec4.already === 'sent');
  console.log('\n12. Yozuvni yuklab olish (Zoom 401)');
  let dlCalls = [];
  zoom.setFetch(async (url, opt) => {
    const h = (opt && opt.headers && opt.headers.Authorization) || '';
    dlCalls.push(url + (h ? ' [' + h + ']' : ''));
    const R = (st, o) => ({ ok: st < 300, status: st, json: async () => o || {}, arrayBuffer: async () => new ArrayBuffer(10) });
    if (/oauth\/token/.test(url)) return R(200, { access_token: 'T', expires_in: 3600 });
    if (/download_access_token/.test(url)) return R(200, { download_access_token: 'DAT' });
    if (/zoom\.us\/dl\/B/.test(url)) return h === 'Bearer T' ? R(200) : R(401);
    if (/zoom\.us\/dl\/D/.test(url)) return /access_token=DAT/.test(url) ? R(200) : R(401);
    return R(401);
  });
  const d1 = await zoom.zoomDownload('https://zoom.us/dl/B', { meetingId: '777' });
  ok('Bearer sarlavhasi bilan yuklab olinadi (havolada kalit yo‘q)', d1.ok && /\[Bearer T\]/.test(dlCalls.filter(c => /dl\/B/.test(c))[0]) && !/access_token/.test(dlCalls.filter(c => /dl\/B/.test(c))[0]), dlCalls.join(' | '));
  dlCalls = [];
  const d2 = await zoom.zoomDownload('https://zoom.us/dl/D', { meetingId: '777' });
  ok('Bearer ishlamasa — maxsus yuklab olish kaliti bilan', d2.ok && dlCalls.some(c => /meetings\/777\/recordings\?include_fields=download_access_token/.test(c)), dlCalls.join(' | '));
  let err = '';
  try { await zoom.zoomDownload('https://zoom.us/dl/X', { meetingId: '777' }); } catch (e) { err = e.message; }
  ok('Hech biri ishlamasa — aniq xato', /HTTP 401/.test(err), err);
  console.log('\n' + (fail ? '✗ XATOLAR BOR — ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o\'tdi, ' + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
