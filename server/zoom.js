/* Zoom avtomatlashtirish: har bir onlayn dars uchun konferensiya, eslatmalar,
   kim qo'shildi / qo'shilmadi, davomat va dars yozuvi guruhga.

   Ulash (Render → Environment):
     ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET — Zoom Marketplace'da
       "Server-to-Server OAuth" ilovasidan (scope: meeting:write:admin,
       meeting:read:admin, recording:read:admin, report:read:admin, user:read:admin)
     ZOOM_WEBHOOK_SECRET — o'sha ilovadagi "Secret Token" (Event Subscriptions:
       meeting.participant_joined, meeting.ended, recording.completed;
       manzil: https://<sayt>/api/zoom/webhook)
     ZOOM_USER — konferensiya kim nomidan ochiladi (email yoki "me", standart "me")

   Har bir dars: zoomlesson/<groupId>__<sana>
     { id, groupId, date, start, end, meetingId, uuid, joinUrl, startUrl, password,
       regs:{studentId:{regId, joinUrl}}, sent:{h1,m15,start,miss}, joined:{studentId:{at,name}},
       guests:[name], attMarked, recording:{shareUrl, password, files}, recSent, status, error } */
'use strict';
const crypto = require('crypto');

const COL = 'zoomlesson/';
const BEFORE_CREATE_MIN = 120;   // konferensiya darsdan 2 soat oldin ochiladi
const MISS_AFTER_MIN = 10;       // 10 daqiqadan keyin qo'shilmaganlarga qayta xabar
const TG_VIDEO_MAX = 49 * 1024 * 1024;  // Telegram bot 50 MB gacha fayl yubora oladi

function env(k) { return String(process.env[k] || '').trim(); }
function configured() { return !!(env('ZOOM_ACCOUNT_ID') && env('ZOOM_CLIENT_ID') && env('ZOOM_CLIENT_SECRET')); }
function webhookReady() { return !!env('ZOOM_WEBHOOK_SECRET'); }

/* ---------------- Zoom API ---------------- */
let tok = { v: '', until: 0 };
let fetchImpl = (...a) => fetch(...a);
function setFetch(fn) { fetchImpl = fn; tok = { v: '', until: 0 }; }

async function token() {
  if (tok.v && Date.now() < tok.until) return tok.v;
  const basic = Buffer.from(env('ZOOM_CLIENT_ID') + ':' + env('ZOOM_CLIENT_SECRET')).toString('base64');
  const r = await fetchImpl('https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' +
    encodeURIComponent(env('ZOOM_ACCOUNT_ID')), { method: 'POST', headers: { Authorization: 'Basic ' + basic } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Zoom token: ' + (j.reason || j.error || r.status));
  tok = { v: j.access_token, until: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000 };
  return tok.v;
}
async function api(method, p, body) {
  const t = await token();
  const r = await fetchImpl('https://api.zoom.us/v2' + p, {
    method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 204) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Zoom ' + method + ' ' + p.split('?')[0] + ': ' + (j.message || r.status)); e.status = r.status; e.code = j.code; throw e; }
  return j;
}
/* UUID "/" bilan boshlansa yoki "//" bo'lsa — ikki marta kodlanadi (Zoom qoidasi) */
function uuidPath(u) {
  const s = String(u || '');
  return /^\/|\/\//.test(s) ? encodeURIComponent(encodeURIComponent(s)) : encodeURIComponent(s);
}

/* ---------------- Vaqt (Asia/Tashkent) ---------------- */
function nowLocal(ms) { return new Date((ms || Date.now()) + 5 * 3600 * 1000); }
function todayIso(ms) { return nowLocal(ms).toISOString().slice(0, 10); }
function minOfDay(ms) { const d = nowLocal(ms); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
function toMin(hhmm) { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function hm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }

/* ---------------- Yordamchilar ---------------- */
async function listCol(store, col) {
  return (await store.list(col)).filter(r => r.path.split('/').length === 2).map(r => r.data).filter(Boolean);
}
function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function normName(s) { return String(s || '').toLowerCase().replace(/[^a-zа-яёўқғҳ0-9]+/gi, ' ').trim(); }
function stName(s) { return [s.firstName, s.lastName].filter(Boolean).join(' ') || s.name || ''; }
function isOnline(g) { return g && (g.format === 'onlayn' || (!g.format && !g.roomId)); }
function groupLabel(g) { return (g.code ? g.code + ' · ' : '') + (g.name || ''); }

/** Bugungi onlayn darslar (ko'chirilgan / bekor qilinganlarsiz) */
async function todaysLessons(store, A, iso) {
  const ym = iso.slice(0, 7);
  const groups = (await listCol(store, 'groups/')).filter(g => g.status !== 'yakunlangan' && g.zoomAuto !== false && isOnline(g));
  const out = [];
  for (const g of groups) {
    const doc = await store.get('lessons/' + g.id + '__' + ym);
    (A.monthLessons(g, ym, doc) || []).forEach(l => {
      if (l.date !== iso || l.movedTo || /bekor|ko.?chirildi/i.test(String(l.status || ''))) return;
      const s = toMin(l.start), e = toMin(l.end);
      if (s == null) return;
      out.push({ group: g, date: iso, start: s, end: e == null ? s + 90 : e });
    });
  }
  return out;
}

/** Guruhning faol o'quvchilari (a'zolik bilan) */
async function members(store, groupId) {
  const mems = (await listCol(store, 'memberships/')).filter(m => m.groupId === groupId && m.status === 'faol');
  const out = [];
  for (const m of mems) {
    const s = await store.get('students/' + m.studentId);
    if (s && s.status !== 'o’chirilgan' && s.status !== 'chiqdi') out.push({ m, s });
  }
  return out;
}

/* ---------------- Konferensiya yaratish ---------------- */
async function createMeeting(store, A, L, ctx) {
  const g = L.group;
  const settings = (await store.get('meta/settings')) || {};
  const center = settings.centerName || 'Sabo Academy';
  const startIso = L.date + 'T' + hm(L.start) + ':00';
  const mt = await api('POST', '/users/' + encodeURIComponent(env('ZOOM_USER') || 'me') + '/meetings', {
    topic: center + ' — ' + groupLabel(g) + ' (' + L.date + ')',
    type: 2, start_time: startIso, timezone: 'Asia/Tashkent', duration: Math.max(30, L.end - L.start),
    /* Kod (passcode) qoladi: Zoom kamida bitta himoyani talab qiladi (kod yoki kutish zali yoki akkaunt).
       Kod havolaning ichida (pwd=) — havolani bosgan odamdan so'ralmaydi; kutish zali esa o'quvchini to'xtatib qo'yardi. */
    settings: {
      join_before_host: true, jbh_time: 15, waiting_room: false, mute_upon_entry: true,
      auto_recording: 'cloud', approval_type: 2,   /* ro'yxatdan o'tishsiz: havolani bosgan mehmon bo'lib kiradi */
      meeting_authentication: false,
      /* Kirishda o'quvchidan bir marta rozilik so'raladi — keyin ustoz uning mikrofonini o'zi yoqa oladi */
      request_permission_to_unmute_participants: true
    }
  });
  const rec = {
    id: g.id + '__' + L.date, groupId: g.id, groupName: groupLabel(g), date: L.date,
    start: hm(L.start), end: hm(L.end), meetingId: String(mt.id), uuid: mt.uuid || '',
    joinUrl: mt.join_url || '', startUrl: mt.start_url || '', password: mt.password || '',
    regs: {}, open: true, sent: {}, joined: {}, guests: [], status: 'yaratildi', createdAt: ctx.stamp()
  };
  /* Ro'yxatdan o'tish yo'q — har kimga bitta havola, faqat ismi oldindan yozilgan bo'ladi
     (uname): davomat ism bo'yicha aniqlanadi, odamdan forma ham, akkaunt ham so'ralmaydi. */
  await store.set(COL + rec.id, rec);
  return rec;
}

/* ---------------- Xabarlar ----------------
   Matnlar meta/zoomtpl da saqlanadi (Zoom darslar → Xabar matnlari), bo'lmasa — standart.
   O'rinbosarlar: {guruh} {sana} {vaqt} {havola} {parol} {darslik} {ustoz_havola}           */
const TPL_DEF = {
  h1: '⏰ <b>30 daqiqadan keyin dars</b>\n\n📚 {guruh}\n🕒 {vaqt}\n\n👉 Darsga kirish: {havola}{parol}\n📖 Darslik: {darslik}',
  m15: '⏳ <b>15 daqiqadan keyin dars boshlanadi</b>\n\n📚 {guruh}\n🕒 {vaqt}\n\n👉 Darsga kirish: {havola}{parol}',
  start: '🔴 <b>Dars boshlandi!</b> Hoziroq qo’shiling\n\n📚 {guruh}\n🕒 {vaqt}\n\n👉 Darsga kirish: {havola}{parol}',
  miss: '❗ <b>Siz hali darsga qo’shilmadingiz.</b> Dars davom etyapti — hoziroq kiring\n\n📚 {guruh}\n🕒 {vaqt}\n\n👉 Darsga kirish: {havola}{parol}',
  group: '📣 <b>Bugun dars bor!</b>\n\n📚 {guruh}\n📅 {sana} · 🕒 {vaqt}\n\n👉 Zoom havola: {havola}{parol}\n📖 Darslik: {darslik}\n\nKechikmang, darsda ko’rishguncha! 🙂',
  /* Ustoz arab tilida so'zlashadi — unga keladigan xabar arabcha va to'liq yo'riqnoma bilan */
  teacher: '👨‍🏫 <b>بدء الدرس</b> (للمعلّم)\n\n📚 {guruh}\n📅 {sana} · 🕒 {vaqt} (بتوقيت طشقند)\n\n' +
    '👉 <b>رابط بدء الدرس (بصلاحية المضيف):</b>\n{ustoz_havola}\n\n' +
    '📌 <b>تعليمات مهمّة:</b>\n' +
    '1️⃣ يُرجى الدخول من هذا الرابط فقط، فهو يفتح الدرس بصلاحية المضيف. هذا الرابط خاص بالمعلّم، لا يُرسَل للطلاب.\n' +
    '2️⃣ الطلاب يصلهم رابطهم تلقائيًا من البوت قبل الدرس بـ30 دقيقة، ويدخلون مباشرة دون تطبيق ودون انتظار.\n' +
    '3️⃣ التسجيل يبدأ تلقائيًا مع بدء الدرس. لا حاجة للضغط على «تسجيل»، ويُرجى عدم إيقافه.\n' +
    '4️⃣ يدخل الطلاب والميكروفون مغلق. لتشغيل صوت طالب: «المشاركون» ← بجانب اسمه «تشغيل الصوت». إن وافق الطالب مسبقًا يُفتح صوته فورًا، وإلا يضغط هو على «موافق».\n' +
    '5️⃣ لكتم صوت الجميع: «المشاركون» ← «كتم صوت الجميع».\n' +
    '6️⃣ عند الخروج المؤقت يُضغط «مغادرة الاجتماع» وليس «إنهاء للجميع»، وإلا يبدأ تسجيل جديد ويضيع التسجيل الكامل.\n' +
    '7️⃣ في نهاية الدرس فقط: «إنهاء الاجتماع للجميع». يُرسَل التسجيل للطلاب بعد موافقة المدير.\n\n' +
    'بالتوفيق 🌿'
};
const TPL_KEYS = Object.keys(TPL_DEF);
async function templates(store) {
  const t = (await store.get('meta/zoomtpl')) || {};
  const out = {}; TPL_KEYS.forEach(k => { out[k] = typeof t[k] === 'string' && t[k].trim() ? t[k] : TPL_DEF[k]; });
  /* Eslatma endi 30 daqiqa oldin ketadi — saqlangan eski matndagi «1 soatdan keyin» ham moslanadi */
  if (/1 soatdan keyin/.test(out.h1)) out.h1 = out.h1.replace(/1 soatdan keyin/g, '30 daqiqadan keyin');
  /* Ustoz xabarining eski (o'zbekcha) standart matni saqlangan bo'lsa — yangi arabcha yo'riqnoma */
  if (/Darsni boshlash<\/b> \(ustoz uchun\)/.test(out.teacher) && out.teacher.length < 120) out.teacher = TPL_DEF.teacher;
  out.groupOn = t.groupOn !== false;
  return out;
}
async function saveTemplates(store, body) {
  const t = {};
  TPL_KEYS.forEach(k => { if (typeof (body && body[k]) === 'string') t[k] = String(body[k]).replace(/\u0000/g, '').slice(0, 1500); });
  t.groupOn = !(body && body.groupOn === false);
  await store.set('meta/zoomtpl', t);
  return templates(store);
}
function siteUrl(settings) { return String((settings && settings.siteUrl) || process.env.SITE_URL || 'https://saboacademy.uz').replace(/\/+$/, ''); }
/** Matnni to'ldirish: HTML belgilar (<b>) shablonda qoladi, qiymatlar xavfsiz qilinadi */
function fill(tpl, v) {
  return String(tpl).replace(/\{(guruh|sana|vaqt|havola|parol|darslik|ustoz_havola)\}/g, (m, k) => {
    if (k === 'parol') return v.parol ? '\n🔑 Parol: <code>' + esc(v.parol) + '</code>' : '';
    /* Faqat bitta havola — ilovasiz, brauzerda ochiladigan (Zoom o'rnatish shart emas) */
    if (k === 'havola') return esc(browserLink(v.havola) || v.havola || '');
    return esc(v[k] == null ? '' : v[k]);
  });
}
function vars(rec, link, pass, settings) {
  return { guruh: rec.groupName, sana: rec.date, vaqt: rec.start + '–' + rec.end, havola: link || '', parol: pass || '',
    darslik: siteUrl(settings) + '/kabinet', ustoz_havola: rec.startUrl || '' };
}
/** Ilovasiz kirish havolasi: Zoom'ning brauzer versiyasi (app.zoom.us/wc/join/ID?pwd=…).
    O'quvchi telefoniga Zoom o'rnatmasdan Safari/Chrome'da darsga kiradi. */
function browserLink(url) {
  const m = /^https:\/\/[a-z0-9.-]*zoom\.us\/j\/(\d{9,12})(\?[^#\s]*)?/i.exec(String(url || ''));
  if (!m) return '';
  return 'https://app.zoom.us/wc/join/' + m[1] + (m[2] || '');
}
/** Zoom havolasiga ism qo'shish — kirganda ism oldindan yozilgan bo'ladi */
function withName(url, name) {
  const u = String(url || ''), n = String(name || '').trim();
  if (!u || !n) return u;
  return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'uname=' + encodeURIComponent(n.slice(0, 60));
}
function linkFor(rec, sid, s) {
  if (rec.regs && rec.regs[sid] && rec.regs[sid].joinUrl) return rec.regs[sid].joinUrl;
  return rec.open && s ? withName(rec.joinUrl, stName(s)) : rec.joinUrl;
}
/** Parol alohida kerakmi (havolada pwd= bo'lmasa) */
function needPass(rec, link) { return rec.password && !/[?&]pwd=/.test(String(link || '')) && !/[?&]tk=/.test(String(link || '')) ? rec.password : ''; }
async function notifyStudents(store, rec, kind, ctx, onlyMissing) {
  let n = 0;
  const T = await templates(store), settings = (await store.get('meta/settings')) || {};
  for (const { s } of await members(store, rec.groupId)) {
    if (onlyMissing && rec.joined && rec.joined[s.id]) continue;
    const chats = [];
    if (s.telegram && s.telegram.id) chats.push(String(s.telegram.id));
    if (!chats.length) continue;
    const link = linkFor(rec, s.id, s);
    const text = fill(T[kind], vars(rec, link, needPass(rec, link), settings));
    for (const chatId of chats) {
      await ctx.send({ kind: 'elon', chatId, studentId: s.id, text, dedupeKey: 'zoom:' + rec.id + ':' + kind + ':' + s.id });
      n++;
    }
  }
  return n;
}
async function notifyTeacher(store, rec, ctx) {
  const g = await store.get('groups/' + rec.groupId);
  const st = g && g.teacherId ? await store.get('staff/' + g.teacherId) : null;
  let chat = st && st.telegram && st.telegram.id ? String(st.telegram.id) : '';
  /* Ustoz ERP hisobini botga ulagan bo'lsa — Telegram hisob foydalanuvchida (users/) turadi */
  if (!chat && g && g.teacherId) {
    const u = (await listCol(store, 'users/')).filter(x => x && x.active !== false && x.staffId === g.teacherId && x.telegram && x.telegram.id)[0];
    if (u) chat = String(u.telegram.id);
  }
  if (!chat || !rec.startUrl) return false;
  const T = await templates(store), settings = (await store.get('meta/settings')) || {};
  await ctx.send({ kind: 'elon', chatId: chat, dedupeKey: 'zoom:' + rec.id + ':teacher', text: fill(T.teacher, vars(rec, rec.joinUrl, '', settings)) });
  return true;
}
/* Dars boshlangach guruh chatiga 15 va 30 daqiqada — har kuni boshqacha matn (bir xil bo'lib zeriktirmasin) */
const LIVE_POOL = {
  g15: [
    '🔥 <b>Dars qizib ketdi!</b>\n\n📚 {guruh} — o‘quvchilar allaqachon mashq qilyapti. Hali kirmagan bo‘lsangiz, kech emas — hoziroq qo‘shiling 👇\n\n👉 {havola}{parol}',
    '🎙 <b>Darsda jonli muloqot ketyapti!</b>\n\nO‘quvchilar ustoz bilan birga gapiryapti va takrorlayapti. Siz ham qo‘shiling 👇\n\n👉 {havola}{parol}',
    '⏱ <b>Dars boshlanganiga 15 daqiqa bo‘ldi</b>\n\n📚 {guruh} — eng qiziq qismi endi boshlanyapti. Kirib oling 👇\n\n👉 {havola}{parol}',
    '✨ <b>Bugungi dars juda qiziq!</b>\n\nO‘quvchilar savollarga javob beryapti. Siz ham ishtirok eting — har bir dars keyingisiga poydevor 👇\n\n👉 {havola}{parol}',
    '📣 <b>Guruhdoshlaringiz darsda!</b>\n\nKechikkan bo‘lsangiz ham qo‘shiling — darsning asosiy qismi hali oldinda 👇\n\n👉 {havola}{parol}',
    '🚀 <b>Dars to‘liq quvvat bilan ketyapti!</b>\n\n📚 {guruh}. Bitta bosish — va siz ham darsdasiz 👇\n\n👉 {havola}{parol}'
  ],
  g30: [
    '💪 <b>Dars davom etyapti — yarmiga yetdik!</b>\n\n📚 {guruh}. Hali ham qo‘shilsangiz bo‘ladi, mashqlar ketyapti 👇\n\n👉 {havola}{parol}',
    '🗣 <b>Hozir darsda gapirish mashqi!</b>\n\nO‘quvchilar arabcha jumla tuzyapti. Bunday imkoniyatni qo‘ldan boy bermang 👇\n\n👉 {havola}{parol}',
    '⭐ <b>Bugun o‘quvchilar zo‘r natija ko‘rsatyapti!</b>\n\nSiz ham qo‘shilib, bilimingizni mustahkamlang 👇\n\n👉 {havola}{parol}',
    '⏳ <b>Darsning ikkinchi yarmi boshlandi</b>\n\nTakrorlash va yangi mavzu davom etyapti. Hali ulgurasiz 👇\n\n👉 {havola}{parol}',
    '🤝 <b>Sizni darsda kutyapmiz!</b>\n\n📚 {guruh} — ustoz va guruhdoshlaringiz shu yerda. Bitta bosish kifoya 👇\n\n👉 {havola}{parol}',
    '📖 <b>Darsni o‘tkazib yubormang!</b>\n\nBugungi mavzu keyingi darslar uchun juda muhim. Hoziroq qo‘shiling 👇\n\n👉 {havola}{parol}'
  ]
};
/** Kun va guruhga qarab matn tanlash: qayta urinishda o'sha matn, ertasi kuni boshqasi */
function livePick(kind, rec) {
  const pool = LIVE_POOL[kind] || [];
  let h = 0; String(rec.groupId || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
  const day = Math.floor(Date.parse(String(rec.date || '1970-01-01') + 'T00:00:00Z') / 86400000) || 0;
  return pool.length ? pool[(day + h) % pool.length] : '';
}
/** Dars ketayotganda guruh chatiga eslatma (faqat bitta, ilovasiz havola bilan) */
async function notifyGroupLive(store, rec, kind, ctx) {
  const g = await store.get('groups/' + rec.groupId);
  const T = await templates(store);
  if (!g || !g.tgChat || !T.groupOn || !ctx.sendGroup) return false;
  const settings = (await store.get('meta/settings')) || {};
  await ctx.sendGroup(g, fill(livePick(kind, rec), vars(rec, rec.joinUrl, needPass(rec, rec.joinUrl), settings)));
  return true;
}
/** Guruhning Telegram chatiga umumiy e'lon (guruh botga ulangan bo'lsa) */
async function notifyGroup(store, rec, ctx) {
  const g = await store.get('groups/' + rec.groupId);
  const T = await templates(store);
  if (!g || !g.tgChat || !T.groupOn || !ctx.sendGroup) return false;
  const settings = (await store.get('meta/settings')) || {};
  await ctx.sendGroup(g, fill(T.group, vars(rec, rec.joinUrl, rec.password, settings)));
  return true;
}

/* ---------------- Kim qo'shildi ---------------- */
async function markJoined(store, rec, p) {
  rec.joined = rec.joined || {}; rec.guests = rec.guests || [];
  const regId = String(p.registrant_id || '');
  let sid = '';
  if (regId) sid = Object.keys(rec.regs || {}).filter(k => rec.regs[k].regId === regId)[0] || '';
  const em = String(p.email || p.user_email || '');
  if (!sid && /^s[a-z0-9]+@/i.test(em)) {
    const key = em.slice(1, em.indexOf('@'));
    sid = Object.keys(rec.regs || {}).filter(k => String(k).replace(/[^a-zA-Z0-9]/g, '') === key)[0] || '';
  }
  if (!sid) {
    const nm = normName(p.user_name || p.name);
    if (nm) {
      const list = await members(store, rec.groupId);
      const hit = list.filter(({ s }) => {
        const a = normName(stName(s)), b = normName([s.lastName, s.firstName].join(' ')), f = normName(s.firstName);
        return nm === a || nm === b || (f && f.length > 2 && nm.split(' ')[0] === f);
      });
      if (hit.length === 1) sid = hit[0].s.id;
    }
  }
  const at = String(p.join_time || '').replace('T', ' ').slice(0, 16) || '';
  if (sid) { if (!rec.joined[sid]) rec.joined[sid] = { at, name: String(p.user_name || p.name || '') }; return sid; }
  const gn = String(p.user_name || p.name || '').slice(0, 60);
  if (gn && rec.guests.indexOf(gn) < 0) rec.guests.push(gn);
  return '';
}

/* Jonli ro'yxat (webhook bo'lmasa): Business tarifda metrics ishlaydi; bo'lmasa — jim */
async function pollLive(store, rec) {
  try {
    const j = await api('GET', '/metrics/meetings/' + rec.meetingId + '/participants?type=live&page_size=300');
    for (const p of (j.participants || [])) await markJoined(store, rec, p);
    return true;
  } catch (e) { return false; }
}
async function pollPast(store, rec) {
  try {
    /* Raqam bo'yicha — konferensiyaning OXIRGI seansi (darsdan oldin sinab ochib-yopilgan bo'lsa ham, haqiqiy dars) */
    const id = rec.meetingId;
    const j = await api('GET', '/past_meetings/' + id + '/participants?page_size=300');
    for (const p of (j.participants || [])) await markJoined(store, rec, p);
    return true;
  } catch (e) { return false; }
}

/* Davomatga yozish: o'qituvchi belgilagan bo'lsa — tegilmaydi */
async function writeAttendance(store, rec, ctx) {
  const ym = rec.date.slice(0, 7);
  const path = 'lessons/' + rec.groupId + '__' + ym;
  const doc = (await store.get(path)) || { id: rec.groupId + '__' + ym, groupId: rec.groupId, month: ym, items: {} };
  doc.items = doc.items || {};
  const day = doc.items[rec.date] = doc.items[rec.date] || {};
  day.attendance = day.attendance || {};
  const startMin = toMin(rec.start);
  let n = 0;
  for (const { m, s } of await members(store, rec.groupId)) {
    if (day.attendance[m.id] && day.attendance[m.id].status) continue;
    const j = rec.joined && rec.joined[s.id];
    let status = 'kelmadi';
    if (j) {
      const jm = toMin(String(j.at || '').slice(11, 16));
      /* Zoom vaqti UTC — Toshkentga +5 soat */
      const local = jm == null ? null : (jm + 300) % 1440;
      status = local != null && startMin != null && local > startMin + 10 ? 'kechikdi' : 'keldi';
    }
    day.attendance[m.id] = { status, by: 'zoom' };
    n++;
  }
  if (n) {
    day.markedBy = day.markedBy || 'Zoom (avtomatik)';
    day.markedAt = day.markedAt || ctx.stamp();
    await store.set(path, doc);
  }
  return n;
}

/* ---------------- Dars yozuvi ---------------- */
async function fetchRecording(store, rec) {
  /* Raqam bo'yicha — oxirgi seans yozuvi. Konferensiya yaratilgandagi uuid birinchi (masalan, sinov uchun
     ochib-yopilgan 40 soniyalik) seansga tegishli bo'lishi mumkin — shuning uchun ishlatilmaydi. */
  const id = rec.meetingId;
  const j = await api('GET', '/meetings/' + id + '/recordings');
  return recFromPayload(j);
}
function recFromPayload(j) {
  const raw = (j.recording_files || []).filter(f => f.file_type === 'MP4' && f.status !== 'processing');
  const files = raw.map(f => ({ size: Number(f.file_size || 0), url: f.download_url || '', play: f.play_url || '', type: f.recording_type || '',
    sec: Math.max(0, Math.round((Date.parse(f.recording_end || '') - Date.parse(f.recording_start || '')) / 1000)) || 0 }));
  if (!files.length) return null;
  const durSec = Math.max.apply(null, files.map(f => f.sec || 0)) || (Number(j.duration) || 0) * 60;
  return { shareUrl: j.share_url || '', password: j.recording_play_passcode || j.password || '', files, durSec, start: j.start_time || '' };
}
function fmtDur(sec) {
  sec = Math.round(Number(sec) || 0); if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}
/** Yozuv dars uchun juda qisqami (sinov seansi bo'lishi mumkin) — rejalashtirilgan vaqtning 25% idan va 10 daqiqadan kam */
function tooShort(r, rec) {
  if (!r || !r.durSec) return false;
  const plan = (toMin(rec.end) - toMin(rec.start)) || 90;
  return r.durSec < Math.min(10 * 60, plan * 60 * 0.25);
}
/* Yozuv tayyor bo'lganda — avval rahbariyatga (bot): ko'rib, «✅ Guruhga yuborish» bosilgandan keyingina
   guruh chatiga boradi. ERP «Zoom darslar» sahifasida ham shu tugma bor. */
function recLink(r) { return r.shareUrl || (r.files && r.files[0] && r.files[0].play) || ''; }
async function askRecordingApproval(store, rec, ctx) {
  if (rec.recAsked || rec.recSent || !rec.recording) return;
  rec.recPending = true;
  const notify = ctx.notifyDirectors || ctx.notifyStaff;
  if (!notify) return;
  const r = rec.recording, link = recLink(r);
  const txt = '📹 Dars yozuvi tayyor — ' + rec.groupName + '\n📅 ' + rec.date + ' · ' + rec.start +
    (r.durSec ? '\n⏱ Davomiyligi: ' + fmtDur(r.durSec) + (tooShort(r, rec) ? ' ⚠️ juda qisqa — haqiqiy dars yozuvimi, tekshiring' : '') : '') +
    (link ? '\n▶️ ' + link + (r.password ? '\n🔑 Parol: ' + r.password : '') : '') +
    '\n\nKo‘rib chiqing. «✅ Guruhga yuborish» ni bossangiz, o‘quvchilar guruhiga boradi.';
  try {
    await notify(txt, { buttons: [[{ text: '✅ Guruhga yuborish', callback_data: 'zr:' + rec.id }, { text: '❌ Yubormaslik', callback_data: 'zx:' + rec.id }]] });
    rec.recAsked = ctx.stamp();
  } catch (e) { }
}
/** Tasdiq: guruhga yuborish (yoki rad etish). Takror bosilsa — ikkinchi marta yubormaydi. */
/** Noto'g'ri video kelgan bo'lsa: yozuvni Zoom'dan qaytadan (oxirgi seans) olish va yana tasdiqqa yuborish */
async function refetchRecording(store, id, ctx) {
  const rec = await store.get(COL + String(id || ''));
  if (!rec || !rec.meetingId) return { error: 'Dars topilmadi.', code: 404 };
  const old = rec.recording;
  const fr = await fetchRecording(store, rec);
  if (!fr) return { error: 'Zoom’da bu dars yozuvi hali tayyor emas.', code: 404 };
  const same = old && old.files && old.files[0] && fr.files[0] && old.files[0].url === fr.files[0].url;
  ['recSent', 'recAsked', 'recPending', 'recRejected', 'recSending', 'recBy', 'recNote', 'recParts', 'recShort'].forEach(k => { delete rec[k]; });
  rec.recording = fr;
  await askRecordingApproval(store, rec, ctx);
  await store.set(COL + rec.id, rec);
  return { ok: true, durSec: fr.durSec || 0, dur: fmtDur(fr.durSec), same: !!same };
}
async function decideRecording(store, id, approve, who, ctx) {
  const rec = await store.get(COL + String(id || ''));
  if (!rec || !rec.recording) return { error: 'Yozuv topilmadi.', code: 404 };
  if (rec.recSent) return { ok: true, already: 'sent', by: rec.recBy || '' };
  if (!approve) {
    rec.recPending = false; rec.recRejected = ctx.stamp(); rec.recBy = who || '';
    await store.set(COL + rec.id, rec);
    return { ok: true, rejected: true };
  }
  if (rec.recSending && Date.now() - Number(rec.recSending) < 90 * 60 * 1000) return { ok: true, already: 'sending' };
  rec.recSending = Date.now(); rec.recBy = who || '';
  await store.set(COL + rec.id, rec);
  /* Yuborish uzoq davom etishi mumkin (katta videoni bo'lish) — fonda; tugagach rahbariyatga natija */
  const job = (async () => {
    let sent = false;
    try { sent = await sendRecording(store, rec, ctx); } catch (e) { rec.recNote = e.message; }
    if (sent) { rec.recSent = ctx.stamp(); rec.recPending = false; delete rec.recRejected; }
    delete rec.recSending;
    await store.set(COL + rec.id, rec);
    const notifyR = ctx.notifyDirectors || ctx.notifyStaff;
    if (notifyR) {
      const txt = sent
        ? '✅ Dars yozuvi guruhga yuborildi — ' + rec.groupName + ' (' + rec.date + ')' + (rec.recParts ? '\n🎬 Video ' + rec.recParts + ' qismda' : '') + (rec.recNote ? '\n⚠️ ' + rec.recNote : '')
        : '⚠️ Dars yozuvi guruhga yuborilmadi — ' + rec.groupName + ': ' + (rec.recNote || 'nomaʼlum xato');
      try { await notifyR(txt); } catch (e) { }
    }
    return sent;
  })();
  return { ok: true, sending: true, job };
}
async function sendRecording(store, rec, ctx) {
  const g = await store.get('groups/' + rec.groupId);
  if (!g || !g.tgChat) { rec.recNote = 'Guruh Telegramga ulanmagan'; return false; }
  const r = rec.recording;
  const caption = '📹 <b>Dars yozuvi</b> — ' + esc(rec.groupName) + '\n📅 ' + rec.date + ' · ' + rec.start;
  /* Kichik fayl bo'lsa — videoning o'zi guruhga; katta bo'lsa — ko'rish havolasi */
  const small = (r.files || []).filter(f => f.size > 0 && f.size <= TG_VIDEO_MAX && f.url).sort((a, b) => b.size - a.size)[0];
  if (small && ctx.sendVideo && !ctx.sendBigVideo) {
    try {
      const t = await token();
      const res = await fetchImpl(small.url + (small.url.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + encodeURIComponent(t));
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        await ctx.sendVideo(g.tgChat, buf, caption);
        return true;
      }
    } catch (e) { rec.recNote = 'Video yuborilmadi: ' + e.message; }
  }
  /* Katta video: sifatini buzmasdan 50 MB lik bo'laklarga bo'lib, VIDEO qilib yuboramiz (1/5, 2/5 …) */
  if (ctx.sendBigVideo) {
    const pref = ['shared_screen_with_speaker_view', 'shared_screen_with_gallery_view', 'active_speaker', 'speaker_view', 'gallery_view', 'shared_screen'];
    const big = (r.files || []).filter(f => f.url && f.size > 0)
      .sort((a, b) => ((pref.indexOf(a.type) + 1 || 99) - (pref.indexOf(b.type) + 1 || 99)) || (b.size - a.size))[0];
    if (big) {
      try {
        const t = await token();
        const url = big.url + (big.url.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + encodeURIComponent(t);
        const res = await ctx.sendBigVideo(g.tgChat, url, caption);
        rec.recParts = res && res.parts; delete rec.recNote;
        return true;
      } catch (e) { rec.recNote = 'Video bo‘lib yuborilmadi (' + e.message + ') — havola yuborildi'; }
    }
  }
  const link = r.shareUrl || (r.files[0] && r.files[0].play) || '';
  if (!link) return false;
  await ctx.sendGroup(g, caption + '\n\n▶️ Ko’rish: ' + link + (r.password ? '\n🔑 Parol: ' + r.password : ''));
  return true;
}

/* ---------------- Asosiy sikl (har daqiqa) ---------------- */
async function tick(store, A, ctx, nowMs) {
  if (!configured()) return { skipped: true };
  const iso = todayIso(nowMs), now = minOfDay(nowMs);
  const done = [];
  for (const L of await todaysLessons(store, A, iso)) {
    const id = L.group.id + '__' + iso;
    let rec = await store.get(COL + id);
    if (!rec) {
      if (now < L.start - BEFORE_CREATE_MIN || now > L.end) continue;
      try { rec = await createMeeting(store, A, L, ctx); done.push('yaratildi ' + id); }
      catch (e) {
        await store.set(COL + id, { id, groupId: L.group.id, groupName: groupLabel(L.group), date: iso, start: hm(L.start), end: hm(L.end), status: 'xato', error: e.message, sent: {}, at: ctx.stamp(), retryAt: Date.now() });
        continue;
      }
    }
    if (rec.status === 'xato') {
      /* 10 daqiqada bir qayta urinish */
      if (!rec.retryAt || Date.now() - rec.retryAt > 10 * 60 * 1000) {
        await store.del(COL + id).catch(() => { });
      }
      continue;
    }
    rec.sent = rec.sent || {};
    let changed = false;
    /* Avval ro'yxatdan o'tish bilan ochilgan konferensiya — ochiq qilamiz (umumiy havola forma so'ramasin) */
    if (!rec.open && rec.meetingId && rec.status !== 'tugadi' && !rec.openTried) {
      rec.openTried = ctx.stamp(); changed = true;
      try { await api('PATCH', '/meetings/' + rec.meetingId, { settings: { approval_type: 2 } }); rec.open = true; done.push('ochiq ' + id); }
      catch (e) { rec.openError = e.message; }
    }
    const step = async (key, cond, fn) => { if (!rec.sent[key] && cond) { await fn(); rec.sent[key] = ctx.stamp(); changed = true; done.push(key + ' ' + id); } };
    /* Havola darsdan 30 daqiqa oldin: o'quvchilarga, ustozga (organizator havolasi) va guruh chatiga */
    await step('h1', now >= L.start - 30 && now < L.end, async () => { await notifyStudents(store, rec, 'h1', ctx); await notifyTeacher(store, rec, ctx); await notifyGroup(store, rec, ctx).catch(() => { }); });
    await step('m15', now >= L.start - 15 && now < L.end, () => notifyStudents(store, rec, 'm15', ctx));
    await step('start', now >= L.start && now < L.end, () => notifyStudents(store, rec, 'start', ctx));
    /* Dars ketayotganda guruh chatiga: 15 va 30 daqiqada (dars tugashiga 5 daqiqadan ko'p qolgan bo'lsa) */
    await step('g15', now >= L.start + 15 && now < L.start + 28 && now < L.end - 5, () => notifyGroupLive(store, rec, 'g15', ctx).catch(() => { }));
    await step('g30', now >= L.start + 30 && now < L.end - 5, () => notifyGroupLive(store, rec, 'g30', ctx).catch(() => { }));
    if (!rec.sent.miss && now >= L.start + MISS_AFTER_MIN && now < L.end) {
      if (!webhookReady()) await pollLive(store, rec);
      await step('miss', true, () => notifyStudents(store, rec, 'miss', ctx, true));
    }
    /* Dars tugagach: aniq ro'yxat va davomat */
    if (!rec.attMarked && now >= L.end + 10) {
      await pollPast(store, rec);
      rec.attCount = await writeAttendance(store, rec, ctx);
      rec.attMarked = ctx.stamp(); rec.status = 'tugadi'; changed = true; done.push('davomat ' + id);
    }
    /* Yozuv: webhook kelmasa — har 10 daqiqada tekshiramiz (6 soatgacha) */
    /* Dars erta tugatilishi ham mumkin — yozuvni dars boshlanganidan 30 daqiqa o'tib tekshira boshlaymiz */
    if (!rec.recSent && !rec.recording && now >= L.start + 30 && now <= L.end + 360 && (rec.recCheckMin == null || now - rec.recCheckMin >= 10)) {
      rec.recCheckMin = now; rec.recCheck = Date.now(); changed = true;
      try {
        if (!rec.recording) {
          const fr = await fetchRecording(store, rec);
          /* Juda qisqa (sinov seansi) — dars tugagach 2 soatgacha haqiqiy yozuvni kutamiz */
          if (fr && tooShort(fr, rec) && now < L.end + 120) rec.recShort = fr.durSec;
          else rec.recording = fr;
        }
        if (rec.recording && !rec.recAsked) { await askRecordingApproval(store, rec, ctx); done.push('yozuv tayyor ' + id); }
      } catch (e) { rec.recNote = e.message; }
    }
    /* Yozuv bor, lekin rahbariyatga xabar hali ketmagan (masalan, webhook orqali kelgan) */
    if (rec.recording && !rec.recSent && !rec.recAsked && !rec.recRejected) { await askRecordingApproval(store, rec, ctx); changed = true; }
    if (changed) await store.set(COL + id, rec);
  }
  return { done };
}

/* ---------------- Webhook ---------------- */
function verify(raw, headers) {
  const sec = env('ZOOM_WEBHOOK_SECRET');
  if (!sec) return false;
  const ts = String(headers['x-zm-request-timestamp'] || '');
  const sig = String(headers['x-zm-signature'] || '');
  if (!ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const want = 'v0=' + crypto.createHmac('sha256', sec).update('v0:' + ts + ':' + raw).digest('hex');
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
async function byMeeting(store, meetingId) {
  const all = await listCol(store, COL);
  return all.filter(r => String(r.meetingId) === String(meetingId)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}
async function webhook(store, body, ctx) {
  const ev = String(body.event || '');
  const obj = (body.payload && body.payload.object) || {};
  if (ev === 'endpoint.url_validation') {
    const plain = String((body.payload && body.payload.plainToken) || '');
    return { reply: { plainToken: plain, encryptedToken: crypto.createHmac('sha256', env('ZOOM_WEBHOOK_SECRET')).update(plain).digest('hex') } };
  }
  const rec = obj.id ? await byMeeting(store, obj.id) : null;
  /* Oxirgi xabar — Zoom darslar sahifasida ko'rinadi (webhook haqiqatan kelayotganini bilish uchun) */
  try { await store.set('meta/zoomhook', { at: ctx.stamp(), event: ev, meetingId: String(obj.id || ''), known: !!rec }); } catch (e) { }
  if (!rec) return { ok: true, ignored: true };
  if (ev === 'meeting.participant_joined' && obj.participant) {
    if (obj.uuid && !rec.uuid) rec.uuid = obj.uuid;
    await markJoined(store, rec, obj.participant);
    rec.status = 'jonli';
  } else if (ev === 'meeting.started') {
    if (obj.uuid) rec.uuid = obj.uuid; rec.status = 'jonli';
  } else if (ev === 'meeting.ended') {
    if (obj.uuid) rec.uuid = obj.uuid; rec.status = 'tugadi';
  } else if (ev === 'recording.completed') {
    const r = recFromPayload(obj);
    const nowM = minOfDay(), endM = toMin(rec.end) || 0;
    if (r && tooShort(r, rec) && todayIso() === rec.date && nowM < endM + 120) { rec.recShort = r.durSec; }
    else if (r) {
      if (!r.shareUrl && obj.share_url) r.shareUrl = obj.share_url;
      rec.recording = r;
      if (!rec.recSent) await askRecordingApproval(store, rec, ctx);
    }
  } else return { ok: true, ignored: true };
  await store.set(COL + rec.id, rec);
  return { ok: true };
}

/* ERP uchun ro'yxat: kim qo'shildi / qo'shilmadi */
async function overview(store, fromIso) {
  const all = (await listCol(store, COL)).filter(r => !fromIso || r.date >= fromIso)
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const out = [];
  for (const r of all.slice(0, 60)) {
    const list = await members(store, r.groupId);
    out.push({
      id: r.id, groupId: r.groupId, groupName: r.groupName, date: r.date, start: r.start, end: r.end,
      status: r.status, error: r.error || '', regError: r.regError || '', open: !!r.open, openError: r.open ? '' : (r.openError || ''), joinUrl: r.joinUrl || '', startUrl: r.startUrl || '',
      sent: r.sent || {}, attMarked: !!r.attMarked, recSent: !!r.recSent, recPending: !!(r.recording && !r.recSent && !r.recRejected), recRejected: !!r.recRejected, recBy: r.recBy || '', recNote: r.recNote || '',
      recording: r.recording ? { shareUrl: r.recording.shareUrl, password: r.recording.password, dur: fmtDur(r.recording.durSec) } : null,
      joined: list.filter(x => r.joined && r.joined[x.s.id]).map(x => ({ id: x.s.id, name: stName(x.s), at: r.joined[x.s.id].at })),
      missing: list.filter(x => !(r.joined && r.joined[x.s.id])).map(x => ({ id: x.s.id, name: stName(x.s), tg: !!(x.s.telegram && x.s.telegram.id) })),
      guests: r.guests || []
    });
  }
  /* Kalitlar haqiqatan ishlayaptimi — token olib ko'ramiz (keshlangan) */
  let auth = null;
  if (configured()) { try { await token(); auth = { ok: true }; } catch (e) { auth = { ok: false, error: e.message }; } }
  const hook = await store.get('meta/zoomhook').catch(() => null);
  return { configured: configured(), auth, webhook: webhookReady(), lastHook: hook || null, lessons: out };
}

/* ---------------- Mehmon havolasi (sinov darsiga keluvchi, botsiz) ----------------
   Konferensiya ro'yxatdan o'tish bilan ochilgan: umumiy havola ism/email so'raydigan
   formaga olib boradi. Mehmon uchun tizim o'zi ro'yxatdan o'tkazadi — shaxsiy havola
   bosilganda forma ham, Zoom akkaunt ham so'ralmaydi. */
async function guestLink(store, rec, name, settings) {
  const nm = String(name || '').replace(/[<>\u0000]/g, '').trim().slice(0, 60);
  if (!nm) return { error: 'Mehmonning ismini yozing.', code: 400 };
  rec.guestRegs = rec.guestRegs || [];
  const old = rec.guestRegs.filter(g => g.name.toLowerCase() === nm.toLowerCase())[0];
  if (old) return { ok: true, joinUrl: old.joinUrl, name: old.name, again: true };
  if (rec.guestRegs.length >= 50) return { error: 'Bu darsga 50 tadan ortiq mehmon qo‘shib bo‘lmaydi.', code: 400 };
  if (rec.open) {   /* ochiq konferensiya: ro'yxatsiz, ismli havola */
    const joinUrl = withName(rec.joinUrl, nm);
    rec.guestRegs.push({ name: nm, joinUrl });
    await store.set(COL + rec.id, rec);
    return { ok: true, joinUrl, name: nm };
  }
  const host = ((settings && settings.siteUrl) || process.env.SITE_URL || 'https://saboacademy.uz').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const parts = nm.split(/\s+/);
  const r = await api('POST', '/meetings/' + rec.meetingId + '/registrants', {
    email: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '@' + host,
    first_name: parts[0].slice(0, 60), last_name: (parts.slice(1).join(' ') || '-').slice(0, 60)
  });
  const joinUrl = r.join_url || '';
  if (!joinUrl) return { error: 'Zoom havola bermadi.', code: 502 };
  rec.guestRegs.push({ name: nm, regId: String(r.registrant_id || r.id || ''), joinUrl });
  await store.set(COL + rec.id, rec);
  return { ok: true, joinUrl, name: nm };
}

module.exports = {
  browserLink, livePick, LIVE_POOL, refetchRecording, fmtDur, tooShort, decideRecording, askRecordingApproval, guestLink, withName, linkFor,
  COL, configured, webhookReady, tick, webhook, verify, overview, notifyStudents, createMeeting, templates, saveTemplates, fill, vars, TPL_DEF, isOnline,
  todaysLessons, markJoined, writeAttendance, setFetch, _t: { toMin, hm, todayIso, minOfDay, uuidPath, recFromPayload }
};
