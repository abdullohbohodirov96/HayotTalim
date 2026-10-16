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
    settings: {
      join_before_host: true, jbh_time: 15, waiting_room: false, mute_upon_entry: true,
      auto_recording: 'cloud', approval_type: 0, registration_type: 1,
      registrants_email_notification: false, registrants_confirmation_email: false,
      meeting_authentication: false
    }
  });
  const rec = {
    id: g.id + '__' + L.date, groupId: g.id, groupName: groupLabel(g), date: L.date,
    start: hm(L.start), end: hm(L.end), meetingId: String(mt.id), uuid: mt.uuid || '',
    joinUrl: mt.join_url || '', startUrl: mt.start_url || '', password: mt.password || '',
    regs: {}, sent: {}, joined: {}, guests: [], status: 'yaratildi', createdAt: ctx.stamp()
  };
  /* Har o'quvchiga shaxsiy havola (ro'yxatdan o'tkazish) — kim kirganini aniq bilamiz.
     Zoom tarifi ruxsat bermasa — umumiy havola, ism bo'yicha solishtiramiz. */
  const host = (settings.siteUrl || process.env.SITE_URL || 'https://saboacademy.uz').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  for (const { s } of await members(store, g.id)) {
    try {
      const r = await api('POST', '/meetings/' + rec.meetingId + '/registrants', {
        email: 's' + String(s.id).replace(/[^a-zA-Z0-9]/g, '') + '@' + host,
        first_name: String(s.firstName || stName(s) || 'O’quvchi').slice(0, 60),
        last_name: String(s.lastName || '').slice(0, 60) || '-'
      });
      rec.regs[s.id] = { regId: String(r.registrant_id || r.id || ''), joinUrl: r.join_url || '' };
    } catch (e) { rec.regError = e.message; break; }
  }
  await store.set(COL + rec.id, rec);
  return rec;
}

/* ---------------- Xabarlar ---------------- */
function linkFor(rec, sid) { return (rec.regs && rec.regs[sid] && rec.regs[sid].joinUrl) || rec.joinUrl; }
async function notifyStudents(store, rec, kind, ctx, onlyMissing) {
  let n = 0;
  for (const { s } of await members(store, rec.groupId)) {
    if (onlyMissing && rec.joined && rec.joined[s.id]) continue;
    const chats = [];
    if (s.telegram && s.telegram.id) chats.push(String(s.telegram.id));
    if (!chats.length) continue;
    const link = linkFor(rec, s.id);
    const head = {
      h1: '⏰ <b>1 soatdan keyin dars</b>',
      m15: '⏳ <b>15 daqiqadan keyin dars boshlanadi</b>',
      start: '🔴 <b>Dars boshlandi!</b> Hoziroq qo’shiling',
      miss: '❗ <b>Siz hali darsga qo’shilmadingiz.</b> Dars davom etyapti — hoziroq kiring'
    }[kind];
    const text = head + '\n\n📚 ' + esc(rec.groupName) + '\n🕒 ' + rec.start + '–' + rec.end +
      '\n\n👉 Darsga kirish: ' + esc(link) + (rec.password && !(rec.regs && rec.regs[s.id]) ? '\n🔑 Parol: <code>' + esc(rec.password) + '</code>' : '');
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
  const chat = st && st.telegram && st.telegram.id ? String(st.telegram.id) : '';
  if (!chat || !rec.startUrl) return false;
  await ctx.send({ kind: 'elon', chatId: chat, dedupeKey: 'zoom:' + rec.id + ':teacher',
    text: '👩‍🏫 <b>Darsni boshlash</b> (ustoz uchun)\n📚 ' + esc(rec.groupName) + ' · ' + rec.start + '\n\n' + esc(rec.startUrl) });
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
    const id = rec.uuid ? uuidPath(rec.uuid) : rec.meetingId;
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
  const id = rec.uuid ? uuidPath(rec.uuid) : rec.meetingId;
  const j = await api('GET', '/meetings/' + id + '/recordings');
  return recFromPayload(j);
}
function recFromPayload(j) {
  const files = (j.recording_files || []).filter(f => f.file_type === 'MP4' && f.status !== 'processing')
    .map(f => ({ size: Number(f.file_size || 0), url: f.download_url || '', play: f.play_url || '', type: f.recording_type || '' }));
  if (!files.length) return null;
  return { shareUrl: j.share_url || '', password: j.recording_play_passcode || j.password || '', files };
}
async function sendRecording(store, rec, ctx) {
  const g = await store.get('groups/' + rec.groupId);
  if (!g || !g.tgChat) { rec.recNote = 'Guruh Telegramga ulanmagan'; return false; }
  const r = rec.recording;
  const caption = '📹 <b>Dars yozuvi</b> — ' + esc(rec.groupName) + '\n📅 ' + rec.date + ' · ' + rec.start;
  /* Kichik fayl bo'lsa — videoning o'zi guruhga; katta bo'lsa — ko'rish havolasi */
  const small = (r.files || []).filter(f => f.size > 0 && f.size <= TG_VIDEO_MAX && f.url).sort((a, b) => b.size - a.size)[0];
  if (small && ctx.sendVideo) {
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
    const step = async (key, cond, fn) => { if (!rec.sent[key] && cond) { await fn(); rec.sent[key] = ctx.stamp(); changed = true; done.push(key + ' ' + id); } };
    await step('h1', now >= L.start - 60 && now < L.end, async () => { await notifyStudents(store, rec, 'h1', ctx); await notifyTeacher(store, rec, ctx); });
    await step('m15', now >= L.start - 15 && now < L.end, () => notifyStudents(store, rec, 'm15', ctx));
    await step('start', now >= L.start && now < L.end, () => notifyStudents(store, rec, 'start', ctx));
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
    if (!rec.recSent && now >= L.end + 20 && now <= L.end + 360 && (!rec.recCheck || Date.now() - rec.recCheck > 10 * 60 * 1000)) {
      rec.recCheck = Date.now(); changed = true;
      try {
        if (!rec.recording) rec.recording = await fetchRecording(store, rec);
        if (rec.recording && await sendRecording(store, rec, ctx)) { rec.recSent = ctx.stamp(); done.push('yozuv ' + id); }
      } catch (e) { rec.recNote = e.message; }
    }
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
    if (r) {
      if (!r.shareUrl && obj.share_url) r.shareUrl = obj.share_url;
      rec.recording = r;
      if (!rec.recSent) { try { if (await sendRecording(store, rec, ctx)) rec.recSent = ctx.stamp(); } catch (e) { rec.recNote = e.message; } }
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
      status: r.status, error: r.error || '', regError: r.regError || '', joinUrl: r.joinUrl || '', startUrl: r.startUrl || '',
      sent: r.sent || {}, attMarked: !!r.attMarked, recSent: !!r.recSent, recNote: r.recNote || '',
      recording: r.recording ? { shareUrl: r.recording.shareUrl, password: r.recording.password } : null,
      joined: list.filter(x => r.joined && r.joined[x.s.id]).map(x => ({ id: x.s.id, name: stName(x.s), at: r.joined[x.s.id].at })),
      missing: list.filter(x => !(r.joined && r.joined[x.s.id])).map(x => ({ id: x.s.id, name: stName(x.s), tg: !!(x.s.telegram && x.s.telegram.id) })),
      guests: r.guests || []
    });
  }
  return { configured: configured(), webhook: webhookReady(), lessons: out };
}

module.exports = {
  COL, configured, webhookReady, tick, webhook, verify, overview, notifyStudents, createMeeting,
  todaysLessons, markJoined, writeAttendance, setFetch, _t: { toMin, hm, todayIso, minOfDay, uuidPath, recFromPayload }
};
