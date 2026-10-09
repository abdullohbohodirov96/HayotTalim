/* Markaz Telegram boti.
   Ulash: o'quvchiga administrator bir martalik kod beradi (masalan 7KQ3M2).
   O'quvchi /start bosib shu kodni yozadi — faqat shunda hisob bog'lanadi.
   Kodi bo'lmasa, ism va guruh kodini yozadi; ulashni ADMINISTRATOR tasdiqlaydi.
   Ism bo'yicha avtomatik ulash yo'q — chunki ismlar bir xil bo'lishi mumkin.

   Xabarlar: har bir turini alohida yoqish/o'chirish mumkin, takrorlanmaydi,
   yuborilgan/xato holati saqlanadi va xato bo'lsa qayta urinadi.            */
'use strict';

const kabinet = require('./kabinet');
const link = require('./link');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = 'https://api.telegram.org/bot' + TOKEN + '/';

let store, stamp, A;
let recordPayment = null;      // index.js beradi: karta to'lovini yozish
const paybot = require('./paybot');
const faq = require('./bot-faq');
let offset = 0;
let running = false;
let timers = [];

/* Xabar yuborish yo'li. Sinovlarda soxta yo'l qo'yiladi — haqiqiy odamlarga yozilmaydi. */
let transport = null;
function setTransport(fn) { transport = fn; }

const MAX_TRIES = 3;
const RETRY_MS = [0, 60 * 1000, 10 * 60 * 1000];   // 1-urinish darhol, keyin 1 daq, 10 daq
const KINDS = ['davomat', 'tolov', 'qarz', 'elon', 'ulash'];

/* Navbat bo'sh bo'lsa baza shuncha vaqtda bir marta so'raladi (ehtiyot tekshiruvi).
   Yangi xabar yoki tasdiq paydo bo'lsa — kutmasdan uyg'onadi (wake). */
const IDLE_MS = Number(process.env.BOT_IDLE_MS || 10 * 60 * 1000);

/* ---------------- Telegram API ---------------- */
async function tg(method, params) {
  const res = await fetch(API + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  const data = await res.json();
  if (!data.ok) throw new Error(method + ': ' + (data.description || 'xato'));
  return data.result;
}
async function sendMessage(chatId, text, keyboard) {
  if (transport) return transport(chatId, text, keyboard);
  return tg('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: keyboard ? { keyboard: keyboard, resize_keyboard: true } : { remove_keyboard: true }
  });
}

/** Token ko'rinishi: "lt<hex>.<sir>" */
function link_looksLikeToken(t) {
  return /^\s*lt[a-f0-9]{6,}\.[A-Za-z0-9_-]{16,}\s*$/.test(String(t || ''));
}

/** Telegram HTML uchun xavfsiz matn */
function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PAY_BTN = 'To’lov qilish 💳';
const PAID_BTN = 'To’ladim ✅';
const BACK_BTN = 'Orqaga';
const PAY_KB = [[{ text: PAID_BTN }], [{ text: BACK_BTN }]];
const MENU = [
  [{ text: PAY_BTN }],
  [{ text: 'Ma’lumotim' }, { text: 'To’lovim' }],
  [{ text: 'Davomatim' }, { text: 'Jadvalim' }],
  [{ text: 'Kabinet (veb)' }, { text: 'Markazga yozish' }]
];

/* ---------------- Ma'lumot yordamchilari ---------------- */
async function settings() {
  return (await store.get('meta/settings')) || {};
}
async function botConf() {
  const s = await settings();
  const b = s.bot || {};
  const n = b.notify || {};
  return {
    welcome: b.welcome || 'Assalomu alaykum!',
    username: b.username || '',
    notify: {
      davomat: n.davomat !== false && b.notifyAttendance !== false,
      tolov: n.tolov !== false && b.notifyPayment !== false,
      qarz: n.qarz !== false && b.notifyDebt !== false,
      elon: n.elon !== false,
      ulash: n.ulash !== false
    },
    remindDays: Number(b.remindDays || 3),      // muddatdan necha kun o'tsa eslatiladi
    remindEvery: Number(b.remindEvery || 7)     // necha kunda bir marta
  };
}
async function listCol(name) {
  const rows = await store.list(name + '/');
  return rows.filter(r => r.path.split('/').length === 2).map(r => r.data);
}
async function findStudentByChat(chatId) {
  const students = await listCol('students');
  return students.filter(s => s.telegram && String(s.telegram.id) === String(chatId))[0] || null;
}

async function getState(chatId) {
  return (await store.get('botstate/' + chatId)) || { chatId: String(chatId), step: 'start' };
}
async function setState(chatId, st) {
  st.chatId = String(chatId);
  st.updatedAt = stamp();
  await store.set('botstate/' + chatId, st);
}

/* ---------------- Bir martalik kod ---------------- */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // chalkashadigan harflar yo'q (O/0, I/1)
function makeCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
function normCode(t) {
  return String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
/** Kod bo'yicha o'quvchini topish. Muddati o'tgan yoki ishlatilgan kod yaramaydi. */
async function studentByCode(code) {
  const c = normCode(code);
  if (c.length !== 6) return null;
  const students = await listCol('students');
  const now = Date.now();
  return students.filter(s => {
    const lk = s.botLink;
    if (!lk || normCode(lk.code) !== c) return false;
    if (lk.usedAt) return false;
    if (lk.expiresAt && Date.parse(lk.expiresAt) < now) return false;
    return true;
  })[0] || null;
}

/* ---------------- Shaxsiy kod urinishlari (taxmin qilishdan himoya) ----------------
   Bitta suhbatdan 5 ta noto'g'ri urinishdan keyin 15 daqiqa kutiladi.          */
const codeTries = new Map();
const CODE_MAX = Number(process.env.BOT_CODE_MAX_TRIES || 5);
const CODE_LOCK_MS = Number(process.env.BOT_CODE_LOCK_MS || 15 * 60 * 1000);
function codeGate(chatId) {
  const rec = codeTries.get(String(chatId));
  if (!rec) return { ok: true };
  if (Date.now() - rec.first > CODE_LOCK_MS) { codeTries.delete(String(chatId)); return { ok: true }; }
  if (rec.n < CODE_MAX) return { ok: true };
  return { ok: false, wait: Math.max(1, Math.ceil((CODE_LOCK_MS - (Date.now() - rec.first)) / 60000)) };
}
function codeFail(chatId) {
  const k = String(chatId);
  const rec = codeTries.get(k);
  if (!rec || Date.now() - rec.first > CODE_LOCK_MS) codeTries.set(k, { n: 1, first: Date.now() });
  else rec.n++;
  if (codeTries.size > 5000) codeTries.clear();
}
function codeOk(chatId) { codeTries.delete(String(chatId)); }

/* ---------------- Moliya: har bir yozuv alohida hujjatda ---------------- */
async function finData() {
  const all = await store.all();
  const invoices = [], payments = [];
  all.forEach(({ path: p, data }) => {
    const parts = p.split('/');
    if (parts.length !== 2 || !data) return;
    if (parts[0] === 'invoices') invoices.push(data);
    else if (parts[0] === 'payments') payments.push(data);
  });
  return { invoices, payments };
}

async function balanceText(student) {
  const { invoices, payments } = await finData();
  const bal = A.balanceOf(student.id, invoices, payments);
  const overdue = A.overdueOf(student.id, invoices, payments, A.today());
  const lines = [];
  lines.push('<b>To’lov holati</b>');
  lines.push('Hisoblangan: ' + A.som(bal.charged) + ' so’m');
  lines.push('To’langan: ' + A.som(bal.received) + ' so’m');
  if (bal.debt > 0) {
    lines.push('Qarz: <b>' + A.som(bal.debt) + ' so’m</b>');
    if (overdue > 0) lines.push('Shundan muddati o’tgan: ' + A.som(overdue) + ' so’m');
    lines.push('To’lash uchun «' + PAY_BTN + '» tugmasini bosing.');
  } else if (bal.advance > 0) {
    lines.push('Avans: ' + A.som(bal.advance) + ' so’m');
  } else {
    lines.push('Qarzingiz yo’q. Rahmat!');
  }
  const paid = A.paidByInvoice(payments);
  const open = invoices
    .filter(i => i.studentId === student.id && A.invoiceRemaining(i, paid) > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  if (open.length) {
    lines.push('');
    lines.push('<b>To’lanmagan oylar</b>');
    for (const i of open.slice(0, 6)) {
      const g = await store.get('groups/' + i.groupId);
      lines.push('• ' + A.monthLabel(i.month) + (g ? ' — ' + g.name : '') +
        ': ' + A.som(A.invoiceRemaining(i, paid)) + ' so’m');
    }
  }
  return lines.join('\n');
}

async function attendanceText(student) {
  const mems = (await listCol('memberships')).filter(m => m.studentId === student.id);
  const rows = [];
  const all = await store.all();
  for (const m of mems) {
    const g = await store.get('groups/' + m.groupId);
    all.forEach(({ path: p, data }) => {
      if (p.indexOf('lessons/' + m.groupId + '__') !== 0) return;
      Object.keys((data && data.items) || {}).forEach(date => {
        const att = (data.items[date].attendance || {})[m.id];
        if (att && att.status) rows.push({ date, status: att.status, group: g ? g.name : '' });
      });
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return 'Hozircha davomat yozuvi yo’q.';
  const labels = { keldi: 'Keldi', kelmadi: 'Kelmadi', kechikdi: 'Kechikdi', sababli: 'Sababli' };
  const stats = { keldi: 0, kelmadi: 0, kechikdi: 0, sababli: 0 };
  rows.forEach(r => { if (stats[r.status] != null) stats[r.status]++; });
  const out = ['<b>Oxirgi darslar</b>'];
  rows.slice(0, 10).forEach(r => out.push('• ' + A.dateLabel(r.date) + ' — ' + (labels[r.status] || r.status)));
  out.push('');
  out.push('Jami: keldi ' + stats.keldi + ', kelmadi ' + stats.kelmadi +
    ', kechikdi ' + stats.kechikdi + ', sababli ' + stats.sababli);
  return out.join('\n');
}

async function scheduleText(student) {
  const mems = (await listCol('memberships')).filter(m => m.studentId === student.id && m.status === 'faol');
  if (!mems.length) return 'Siz hozircha guruhga yozilmagansiz.';
  const out = ['<b>Dars jadvalingiz</b>'];
  for (const m of mems) {
    const g = await store.get('groups/' + m.groupId);
    if (!g) continue;
    const days = (g.days || []).map(d => A.WEEKDAYS[d - 1]).join(', ');
    const room = g.roomId ? await store.get('rooms/' + g.roomId) : null;
    out.push('');
    out.push('<b>' + (g.code ? g.code + ' · ' : '') + g.name + '</b>');
    out.push(days + '  ' + g.startTime + '–' + g.endTime);
    if (A.isOffline(g) && room) out.push('Xona: ' + room.name);
    const zoom = A.safeUrl ? A.safeUrl(g.zoomLink) : '';
    const rec = A.safeUrl ? A.safeUrl(g.recordingsLink) : '';
    if (zoom) out.push('Darsga kirish (Zoom): ' + esc(zoom));
    if (rec) out.push('Dars yozuvlari: ' + esc(rec));
  }
  return out.join('\n');
}

/* ---------------- Navbat: takrorlanmaslik va qayta urinish ---------------- */

/** Bir xil xabar ikki marta ketmasin */
function dedupeKey(msg) {
  return msg.dedupeKey || (msg.kind + ':' + msg.chatId + ':' + hash(String(msg.text)));
}
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Xabarni navbatga qo'yish. Bir xil kalit bilan yaqinda yuborilgan bo'lsa — qo'yilmaydi.
 * windowMs: shu vaqt ichida takroriy hisoblanadi (standart 24 soat).
 */
async function enqueue(msg, windowMs) {
  /* Shaxsiy xabar faqat SHAXSIY suhbatga boradi.
     Telegramda guruh/kanal identifikatori manfiy raqam bo'ladi — bunday
     manzilga o'quvchining ismi, qarzi yoki davomati yuborilmaydi.          */
  if (String((msg && msg.chatId) || '').charAt(0) === '-') {
    return { skipped: 'guruh', id: null };
  }
  const key = dedupeKey(msg);
  const rows = (await store.list('botout/')).map(r => r.data).filter(Boolean);
  const limit = Date.now() - (windowMs == null ? 24 * 3600 * 1000 : windowMs);
  const dup = rows.filter(m => dedupeKey(m) === key &&
    m.status !== 'failed' &&
    Date.parse(m.createdAt || 0) >= limit)[0];
  if (dup) return { skipped: true, id: dup.id };
  const id = msg.id || ('out_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  const rec = Object.assign({
    id, status: 'pending', tries: 0, createdAt: stamp()
  }, msg, { id, dedupeKey: key });
  await store.set('botout/' + id, rec);
  wake();                                   // navbatchi darhol uyg'onadi
  return { skipped: false, id };
}

/* ---------------- Uyg'otish: bo'sh navbat uchun bazani bezovta qilmaymiz ----------------
   Ilgari har 5 soniyada botout/ va botreq/ so'ralardi (soatiga ~1440 so'rov, hech nima
   bo'lmasa ham). Endi: yangi xabar navbatga qo'yilganda yoki administrator tasdiqlaganda
   wake() chaqiriladi; aks holda IDLE_MS da bir marta ehtiyot tekshiruvi bo'ladi. */
let wakeup = null;          // kutayotgan va'dani uyg'otish
let woken = false;          // kutish boshlanmasdan oldin kelgan uyg'otish
function wake() {
  woken = true;
  if (wakeup) { const w = wakeup; wakeup = null; w(); }
}
function waitFor(ms) {
  if (woken) { woken = false; return Promise.resolve(); }
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; woken = false; clearTimeout(t); wakeup = null; resolve(); };
    const t = setTimeout(finish, ms);
    if (t.unref) t.unref();
    wakeup = finish;
  });
}

/** Navbatni yuborish: xato bo'lsa belgilaydi va keyin qayta urinadi */
async function flushQueue(now) {
  const conf = await botConf();
  const t = now || Date.now();
  const rows = (await store.list('botout/')).map(r => r.data).filter(Boolean);
  let sent = 0, failed = 0, skipped = 0;
  let nextAt = 0;                          // keyingi qayta urinish vaqti (uyg'onish uchun)

  for (const m of rows) {
    if (m.status !== 'pending' && m.status !== 'error') continue;
    if (m.nextTryAt && Date.parse(m.nextTryAt) > t) {
      const at = Date.parse(m.nextTryAt);
      if (!nextAt || at < nextAt) nextAt = at;
      continue;
    }
    // xabar turi o'chirilgan bo'lsa — yubormaymiz va shunday deb belgilaymiz
    if (m.kind && conf.notify[m.kind] === false) {
      m.status = 'skipped';
      m.error = 'Bu turdagi xabarlar o’chirilgan.';
      await store.set('botout/' + m.id, m);
      skipped++;
      continue;
    }
    m.tries = (m.tries || 0) + 1;
    try {
      await sendMessage(m.chatId, m.text);
      m.status = 'sent';
      m.sentAt = stamp();
      m.error = '';
      sent++;
    } catch (e) {
      m.error = String(e.message).slice(0, 140);
      if (m.tries >= MAX_TRIES) {
        m.status = 'failed';
        failed++;
      } else {
        m.status = 'error';
        const at = t + RETRY_MS[Math.min(m.tries, RETRY_MS.length - 1)];
        m.nextTryAt = new Date(at).toISOString();
        if (!nextAt || at < nextAt) nextAt = at;
      }
    }
    await store.set('botout/' + m.id, m);
  }

  // eski yozuvlarni tozalash (oxirgi 200 tasi qoladi)
  const done = rows.filter(m => m.status === 'sent' || m.status === 'skipped');
  if (done.length > 200) {
    done.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    for (const old of done.slice(0, done.length - 200)) await store.del('botout/' + old.id);
  }
  return { sent, failed, skipped, nextAt };
}

/**
 * Markaz xodimlariga xabar (masalan saytdagi formadan murojaat kelganda).
 * Chat ID lar sozlamada: bot.staffChats — vergul bilan yoki ro'yxat ko'rinishida.
 * Bot o'chiq bo'lsa yoki ID berilmagan bo'lsa — hech narsa qilinmaydi.
 */
/** Sozlamadagi administrator chatlari (bot.staffChats) */
async function staffChatIds() {
  const s = (await store.get('meta/settings')) || {};
  const raw = (s.bot && (s.bot.staffChats || s.bot.adminChatId)) || '';
  return (Array.isArray(raw) ? raw : String(raw).split(/[,\s]+/))
    .map(x => String(x).trim()).filter(x => /^-?\d{3,20}$/.test(x));
}
async function isStaffChat(chatId) {
  return (await staffChatIds()).indexOf(String(chatId)) >= 0;
}

async function notifyStaff(text) {
  if (!store) return { queued: 0, off: true };
  /* Xabar Telegramga HTML rejimida ketadi. Ichida foydalanuvchi yozgan
     matn (ism, savol, izoh) bo'ladi — u HTML sifatida o'qilmasin. */
  text = esc(String(text == null ? '' : text));
  const ids = await staffChatIds();
  let queued = 0;
  for (const chatId of ids) {
    const r = await enqueue({
      kind: 'elon', chatId, text,
      dedupeKey: 'staff:' + chatId + ':' + hash(String(text))
    }, 5 * 60 * 1000);
    if (!r.skipped) queued++;
  }
  return { queued };
}

/* ---------------- To'lov muddati eslatmasi ---------------- */

/**
 * Muddati o'tgan qarzi bor, botga ulangan o'quvchilarga eslatma.
 * Bir o'quvchiga remindEvery kunda bir martadan ko'p yozilmaydi.
 */
async function remindDebtors(todayIso) {
  const conf = await botConf();
  if (!conf.notify.qarz) return { queued: 0, skipped: 0, off: true };
  const today = todayIso || A.today();
  const { invoices, payments } = await finData();
  const students = (await listCol('students')).filter(s => s.telegram && s.telegram.id);
  const paid = A.paidByInvoice(payments);
  let queued = 0, skipped = 0;

  for (const s of students) {
    const open = invoices.filter(i => i.studentId === s.id && A.invoiceRemaining(i, paid) > 0 && i.dueDate);
    if (!open.length) continue;
    // eng eski muddati o'tgan hisob
    /* Bo'lib to'lashda ikkinchi qism muddati hali kelmagan bo'lsa, birinchi
       yarmi to'langan hisob uchun eslatma yuborilmaydi. */
    const late = open.filter(i => daysBetween(i.dueDate, today) >= conf.remindDays &&
      A.invoiceOverdueAmount(i, paid, today) > 0)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
    if (!late) continue;

    const total = open.reduce((x, i) => x + A.invoiceRemaining(i, paid), 0);
    const text = 'Eslatma: to’lov muddati o’tdi.\n' +
      A.monthLabel(late.month) + ' uchun to’lov muddati: ' + A.dateLabel(late.dueDate) + '\n' +
      'To’lanmagan summa: ' + A.som(total) + ' so’m\n' +
      'Savol bo’lsa, markazga yozing.';

    // kalit: bir o'quvchiga remindEvery kunda bir marta
    const r = await enqueue({
      studentId: s.id, chatId: String(s.telegram.id), text, kind: 'qarz',
      dedupeKey: 'qarz:' + s.id
    }, conf.remindEvery * 24 * 3600 * 1000);
    if (r.skipped) skipped++; else queued++;
  }

  /* Muddatidan OLDIN eslatma: to'lov kuni yaqinlashganda (karta sozlangan bo'lsa) */
  const pc = paybot.payConf(await settings());
  if (pc.card && pc.preDays > 0) {
    for (const s of students) {
      const soon = invoices.filter(i => i.studentId === s.id && i.dueDate && A.invoiceRemaining(i, paid) > 0 &&
        daysBetween(today, i.dueDate) >= 0 && daysBetween(today, i.dueDate) <= pc.preDays);
      for (const inv of soon) {
        const text = 'Eslatma: ' + A.monthLabel(inv.month) + ' uchun to’lov muddati — ' + A.dateLabel(inv.dueDate) + '.\n' +
          'Summa: ' + A.som(A.invoiceRemaining(inv, paid)) + ' so’m\n' +
          'To’lash uchun «' + PAY_BTN + '» tugmasini bosing — karta raqami va aniq summa chiqadi.';
        const r = await enqueue({
          studentId: s.id, chatId: String(s.telegram.id), text, kind: 'qarz',
          dedupeKey: 'oldin:' + inv.id
        }, 40 * 24 * 3600 * 1000);
        if (r.skipped) skipped++; else queued++;
      }
    }
  }
  return { queued, skipped };
}

/* ---------------- Kunlik o'qish eslatmasi ----------------
   Onlayn kursdagi o'quvchiga kuniga bir marta: bugun takrorlanadigan
   so'zlar soni, joriy dars va (bo'lsa) ochiq takrorlash testi.
   Hech narsa qilish kerak bo'lmasa — xabar yuborilmaydi.               */
async function remindStudy(todayIso) {
  const conf = await botConf();
  if (!conf.notify.elon || !A.Course) return { queued: 0 };
  const today = todayIso || A.today();
  const base = String(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  const students = (await listCol('students')).filter(s => s.telegram && s.telegram.id && s.status !== 'o’chirilgan');
  let queued = 0;
  for (const s of students) {
    const doc = await store.get('courseprog/' + s.id);
    if (!doc) continue;                                   // kursni boshlamagan
    doc.lessons = doc.lessons || {}; doc.unlocked = doc.unlocked || {}; doc.reviews = doc.reviews || {}; doc.vocab = doc.vocab || {};
    const v = A.Course.buildView(doc, today);
    const cur = v.lessons.filter(l => l.status === 'open')[0];
    const rv = (v.reviews || []).filter(r => r.status === 'open')[0];
    const back = v.lessons.filter(l => l.hw && l.hw.status === 'qayta')[0];
    const words = v.vocab.due + v.vocab.fresh;
    const parts = [];
    if (back) parts.push('• «' + back.title + '» vazifasini qayta yuboring');
    if (rv) parts.push('• ' + rv.title + ' testi ochiq — o’tsangiz keyingi dars ochiladi');
    else if (cur) parts.push('• ' + cur.n + '-dars «' + cur.title + '»ni davom ettiring');
    if (words) parts.push('• ' + words + ' ta so’zni lug’atda takrorlang (5 daqiqa)');
    if (!parts.length) continue;
    const text = '📚 Bugungi mashg’ulot:\n' + parts.join('\n') + (base ? '\n\nKabinet: ' + base + '/kabinet' : '\n\n«Kabinet (veb)» tugmasini bosing.');
    const r = await enqueue({ studentId: s.id, chatId: String(s.telegram.id), text, kind: 'elon', dedupeKey: 'oqish:' + s.id + ':' + today }, 20 * 3600 * 1000);
    if (!r.skipped) queued++;
  }
  return { queued };
}

function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso + 'T00:00:00Z'), b = Date.parse(toIso + 'T00:00:00Z');
  if (isNaN(a) || isNaN(b)) return -1;
  return Math.round((b - a) / 86400000);
}

/* ---------------- Ulash jarayoni ---------------- */
/** Bog'langandan keyin: holatni yozamiz va ma'lumotni yuboramiz */
async function afterLink(chatId, student, st) {
  st.step = 'linked';
  st.studentId = student.id;
  await setState(chatId, st);
  let info = '';
  try { info = kabinet.summaryText(await kabinet.summary(store, student)); } catch (e) { info = ''; }
  await sendMessage(chatId,
    'Tayyor! Siz <b>' + esc(student.lastName) + ' ' + esc(student.firstName) + '</b> sifatida ulandingiz.\n' +
    (info ? '\n' + info + '\n' : '') +
    '\nEndi davomat va to’lovlar haqida xabar olasiz.', MENU);
}

/** Bir martalik havola (token) bilan bog'lash — yagona to'g'ri yo'l */
async function linkWithToken(chatId, token, from, st) {
  const gate = codeGate(chatId);
  if (!gate.ok) {
    await sendMessage(chatId, 'Juda ko’p urinish. ' + gate.wait + ' daqiqadan keyin qayta urinib ko’ring.');
    return false;
  }
  const r = await link.use(store, token, { stamp, usedBy: String(chatId) });
  if (!r.ok) {
    codeFail(chatId);
    const why = {
      ishlatilgan: 'Bu havola allaqachon ishlatilgan.',
      muddati: 'Havola muddati tugagan.',
      topilmadi: 'Havola yaroqsiz.'
    }[r.reason] || 'Havola yaroqsiz.';
    await sendMessage(chatId, why + ' Administratordan yangi havola so’rang.');
    return false;
  }
  codeOk(chatId);
  // administrator bergan havola mavjud bog'lanishni ham almashtira oladi
  const at = await link.attach(store, {
    studentId: r.studentId, chatId, from, stamp, via: 'havola', force: true
  });
  if (!at.ok) {
    await sendMessage(chatId, 'Bog’lab bo’lmadi. Administrator bilan bog’laning.');
    return false;
  }
  if (at.replaced) {
    try {
      await sendMessage(at.replaced,
        'Bu hisob boshqa Telegram profiliga bog’landi. Agar bu siz bo’lmasangiz, ' +
        'darhol markaz administratoriga xabar bering.');
    } catch (e) { }
  }
  await afterLink(chatId, at.student, st);
  return true;
}

async function handleLinkFlow(chatId, text, from, st) {
  /* 1) Kod kutilmoqda.
     Ikki xil kod qabul qilinadi:
       — shaxsiy kod: 4 xonali raqam (masalan 4077), o'quvchida doim bitta;
       — bir martalik kod: 6 belgili (eski usul, administrator beradi).       */
  if (st.step === 'code') {
    // Havola (token) — yagona bog'lash yo'li
    if (link_looksLikeToken(text)) {
      await linkWithToken(chatId, text.trim(), from, st);
      return;
    }
    // 4 xonali shaxsiy kod BOG'LAMAYDI: u maxfiy emas.
    const digits = kabinet.normCode(text);
    /* Yangi kodlar 5 xonali; eski o'quvchilarda 4 xonalisi qolgan
       bo'lishi mumkin — ikkalasi ham qabul qilinadi.               */
    if (kabinet.validCode(digits) && /^\s*\d{4,5}\s*$/.test(text)) {
      codeFail(chatId);
      await sendMessage(chatId,
        'Shaxsiy kod bilan bog’lash o’chirilgan — u maxfiy emas.\n\n' +
        'Markaz administratoridan <b>bir martalik havola</b> so’rang: u yuborgan ' +
        'havolani bossangiz, hisobingiz shu suhbatga bog’lanadi.\n' +
        'Kodingiz bo’lmasa, <b>ismim</b> deb yozing — administrator tasdiqlaydi.');
      return;
    }
    if (/^ismim/i.test(text.trim())) {
      st.step = 'name';
      await setState(chatId, st);
      await sendMessage(chatId, 'Ism va familiyangizni to’liq yozing.');
      return;
    }
    await sendMessage(chatId, 'Shaxsiy kodingizni yozing — 5 ta raqam, masalan: <code>40771</code>');
    return;
  }

  /* 2) Ism */
  if (st.step === 'name') {
    const name = text.trim();
    if (name.length < 3) {
      await sendMessage(chatId, 'Iltimos, ism va familiyangizni to’liq yozing.');
      return;
    }
    st.name = name;
    st.step = 'group';
    await setState(chatId, st);
    await sendMessage(chatId,
      'Rahmat, ' + name + '.\n\nEndi <b>guruh kodingizni</b> yozing, masalan: <code>B020</code>');
    return;
  }

  /* 3) Guruh kodi → administratorga so'rov */
  if (st.step === 'group') {
    /* Kod qanday yozilsa ham topilsin: "b 020", "B-020", "b020" → B020 */
    const code = normCode(text);
    const groups = await listCol('groups');
    const group = groups.filter(g => g.code && normCode(g.code) === code)[0];
    if (!group) {
      await sendMessage(chatId, 'Bunday guruh kodi topilmadi: <b>' + code + '</b>\nKodni tekshirib, qayta yozing.');
      return;
    }
    await store.set('botreq/req_' + chatId, {
      id: 'req_' + chatId, chatId: String(chatId), username: (from && from.username) || '',
      name: st.name, groupCode: code, groupId: group.id,
      status: 'kutilmoqda', createdAt: stamp()
    });
    st.step = 'waiting';
    await setState(chatId, st);
    await sendMessage(chatId,
      'So’rovingiz administratorga yuborildi.\n' +
      'U tasdiqlagach, sizga xabar keladi. Rahmat!');
    return;
  }

  if (st.step === 'waiting') {
    await sendMessage(chatId, 'So’rovingiz ko’rib chiqilmoqda. Administrator tasdiqlagach xabar beramiz.');
    return;
  }
}

/* ---------------- Telegram guruhiga ulanish ----------------
   Bot guruhga qo'shilganda guruh NOMIDAGI kodni (4 raqam) topadi va
   o'sha o'quv guruhiga bog'lanadi. Kod topilmasa — qanday qilishni tushuntiradi.
   Ulangach guruhga "ulandim" xabari boradi.                                */

/** Guruh nomidan kodga o'xshash bo'laklarni ajratib olish.
    Avval faqat 4 xonali raqam qidirilardi — shuning uchun "B020" kabi
    kodlar topilmasdi. Endi harf-raqamli bo'laklar ham olinadi.

    Eng kami 3 belgi: "A1", "B2" kabi ikki belgili bo'laklar DARAJA nomi
    bo'lib, guruh nomlarida doim uchraydi ("Kechki A1"). Ularni kod deb
    olsak, bot noto'g'ri guruhga ulanib qolishi mumkin edi.               */
function codesInTitle(title) {
  const out = [];
  String(title || '').split(/[^A-Za-z0-9]+/).forEach(w => {
    const c = normCode(w);
    if (c.length >= 3 && c.length <= 12 && /\d/.test(c) && out.indexOf(c) < 0) out.push(c);
  });
  return out;
}

async function allGroups() {
  const rows = await store.list('groups/');
  return rows.filter(r => r.path.split('/').length === 2).map(r => r.data).filter(Boolean);
}

/** Guruh nomiga qarab o'quv guruhini topish */
async function groupByTitle(title) {
  const codes = codesInTitle(title);
  if (!codes.length) return { error: 'kod-yoq' };
  const groups = await allGroups();
  const hits = groups.filter(g => g.code && codes.indexOf(normCode(g.code)) >= 0);
  if (!hits.length) return { error: 'topilmadi', codes };
  /* Bir nechta kod mos kelsa ham, hammasi BITTA guruhga tegishli bo'lsa — mayli */
  const uniq = [];
  hits.forEach(g => { if (uniq.indexOf(g.id) < 0) uniq.push(g.id); });
  if (uniq.length > 1) return { error: 'kop', codes };
  return { group: hits[0] };
}

/** Guruhni shu Telegram suhbatiga bog'lash */
async function linkGroupChat(chatId, title) {
  const r = await groupByTitle(title);
  if (r.error === 'kod-yoq') {
    await sendMessage(chatId,
      'Assalomu alaykum! Bu guruhni markazga bog’lash uchun guruh nomiga ' +
      '<b>guruh kodini</b> qo’shing — 4 ta raqam, masalan: <code>Arab tili A1 · 4821</code>\n' +
      'Kodni ERP’dagi guruh sahifasidan olasiz. Nomni o’zgartirgach <code>/ulash</code> deb yozing.');
    return null;
  }
  if (r.error === 'topilmadi') {
    await sendMessage(chatId,
      'Guruh nomidagi kod (' + r.codes.join(', ') + ') markazdagi hech bir guruhga to’g’ri kelmadi. ' +
      'Kodni tekshirib, <code>/ulash</code> deb yozing.');
    return null;
  }
  if (r.error === 'kop') {
    await sendMessage(chatId, 'Nomda bir nechta kod bor. Faqat bittasini qoldiring va <code>/ulash</code> deb yozing.');
    return null;
  }
  const g = r.group;
  const already = String(g.tgChat || '') === String(chatId);
  const rec = Object.assign({}, g, { tgChat: String(chatId), tgTitle: String(title || ''), tgAt: stamp() });
  await store.set('groups/' + g.id, rec);
  await sendMessage(chatId,
    (already ? '✅ Bog’lanish yangilandi' : '✅ Ulandim!') + '\n\n' +
    'Bu guruh <b>' + (g.name || g.id) + '</b> guruhiga bog’landi (kod <code>' + g.code + '</code>).\n' +
    'Endi shu yerga e’lon, dars va to’lov xabarlarini yubora olaman.');
  return rec;
}

/** Guruhdan kelgan xabar/hodisa */
async function onGroupUpdate(chatId, title, text) {
  const t = String(text || '').trim().toLowerCase();
  if (t === '/ulash' || t === '/start' || t.indexOf('/ulash@') === 0 || t.indexOf('/start@') === 0) {
    return linkGroupChat(chatId, title);
  }
  if (t === '/id' || t.indexOf('/id@') === 0) {
    return sendMessage(chatId, 'Suhbat raqami: <code>' + chatId + '</code>');
  }
  return null;
}

/** ERP’dan guruhga xabar yuborish */
async function sendToGroup(group, text) {
  if (!group || !group.tgChat) return { ok: false, error: 'Guruh Telegramga ulanmagan.' };
  await sendMessage(group.tgChat, String(text || '').slice(0, 3500));
  return { ok: true };
}


/* ---------------- Bepul darsga ro'yxat (lid voronkasi) ----------------
   Reklama → t.me/<bot>?start=dars_reels1 → ism → raqam (bitta tugma) →
   hudud → murojaat (lead) yaratiladi va yopiq kanal havolasi beriladi.
   "dars_" dan keyingi qism reklama belgisi (src) bo'lib saqlanadi —
   qaysi reklama nechta odam olib kelgani Murojaatlar hisobotida ko'rinadi. */
const REG_BTN = 'Bepul darsga yozilish';
const REG_PHONE_BTN = '📱 Raqamni yuborish';
const FAQ_BTN = '❓ Savollar';
const ADMIN_BTN = '📞 Administrator';
const STUDENT_BTN = '🎓 Men o’quvchiman';
const CANCEL_BTN = 'Bekor qilish';
const SITE_BTN = '🌐 Sayt';
const GUEST_MENU = [[{ text: REG_BTN }], [{ text: FAQ_BTN }, { text: ADMIN_BTN }], [{ text: SITE_BTN }, { text: STUDENT_BTN }]];

/* Mehmon (hali o'quvchi emas) savoli: avval bilim bazasidan javob, topilmasa
   administratorga yetkazish uchun raqam so'raladi va murojaat ochiladi.     */
async function guestQuestion(chatId, text, from, st) {
  const s = await settings();
  const ctx = faq.context(s);
  const byNum = faq.faqByNumber(text);
  if (byNum) { await sendMessage(chatId, byNum, GUEST_MENU); return; }
  const a = faq.answer(text, ctx);
  if (a) {
    await sendMessage(chatId, a.text + '\n\nYana savolingiz bo’lsa, yozavering 🙂', GUEST_MENU);
    return;
  }
  const q = String(text || '').replace(/[<>]/g, '').trim().slice(0, 500);
  if (q.length < 3) { await sendMessage(chatId, 'Savolingizni yozing yoki pastdagi tugmalardan tanlang.', GUEST_MENU); return; }
  /* Ro'yxatdan o'tgan bo'lsa — raqami bor: darhol murojaatga yoziladi */
  if (st.leadId) {
    await saveGuestQuestion(chatId, st, from, q, null);
    await sendMessage(chatId, 'Savolingizni administratorga yetkazdim ✅ Tez orada javob beradi.', GUEST_MENU);
    return;
  }
  st.step = 'ask_phone'; st.q = q;
  await setState(chatId, st);
  await sendMessage(chatId, 'Bu savolga administratorimiz aniq javob beradi.\n' +
    'Javob berishi uchun <b>telefon raqamingizni</b> yuboring — pastdagi tugmani bosing yoki raqamni yozing.',
    [[{ text: REG_PHONE_BTN, request_contact: true }], [{ text: CANCEL_BTN }]]);
}
async function saveGuestQuestion(chatId, st, from, q, phone) {
  let lead = st.leadId ? await store.get('leads/' + st.leadId) : null;
  const name = String((from && (from.first_name || '')) + ' ' + ((from && from.last_name) || '')).trim().slice(0, 60) || 'Telegram';
  if (lead) {
    lead = Object.assign({}, lead, { note: (lead.note ? lead.note + '\n' : '') + 'Botdan savol: ' + q, nextContact: A.today() });
  } else {
    const funnels = await listCol('funnels');
    const funnel = funnels.filter(f => f.isDefault)[0] || funnels[0];
    const stages = funnel ? A.funnelStages(funnel) : [];
    lead = {
      id: 'led_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      funnelId: funnel ? funnel.id : '', name, phone: phone || '',
      courseId: '', source: 'Bot', src: 'savol', region: '', district: '',
      ownerStaffId: '', stage: stages[0] ? stages[0].id : 'yangi',
      note: 'Botdan savol: ' + q, nextContact: A.today(),
      chatId: String(chatId), tgUser: String((from && from.username) || '').slice(0, 40),
      createdAt: stamp(), viaBot: true
    };
  }
  await store.set('leads/' + lead.id, lead);
  st.leadId = lead.id;
  notifyStaff('Botga savol keldi\nIsm: ' + lead.name + (lead.phone ? '\nTelefon: ' + lead.phone : '') +
    (lead.tgUser ? '\nTelegram: @' + lead.tgUser : '') + '\nSavol: ' + q).catch(() => { });
  return lead;
}

function regSrc(payload) {
  return String(payload || '').replace(/^dars_?/i, '').replace(/^r_/i, '')
    .replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 40);
}
function regionKeyboard() {
  const rows = [];
  const list = A.REGIONS || [];
  for (let i = 0; i < list.length; i += 2) {
    rows.push(list.slice(i, i + 2).map(t => ({ text: t })));
  }
  return rows;
}
function freeLessonText(s) {
  const fl = s.freeLesson || {};
  const L = [];
  if (fl.title) L.push('<b>' + esc(fl.title) + '</b>');
  if (fl.date) L.push('Sana: ' + esc(A.dateLabel ? A.dateLabel(fl.date) : fl.date) + (fl.time ? ', soat ' + esc(fl.time) : ''));
  const ch = A.safeUrl ? A.safeUrl(fl.channel) : '';
  if (ch) L.push('Dars shu yopiq kanalda bo’ladi:\n' + esc(ch));
  else L.push('Dars havolasini darsdan oldin shu yerga yuboramiz.');
  return L.join('\n');
}
async function startRegistration(chatId, src, from) {
  const st = { chatId: String(chatId), step: 'reg_name', reg: { src: regSrc(src) } };
  const first = String((from && from.first_name) || '').trim().slice(0, 60);
  if (first) st.reg.suggest = first;
  await setState(chatId, st);
  const s = await settings();
  const fl = s.freeLesson || {};
  await sendMessage(chatId,
    'Assalomu alaykum! ' + (fl.title ? '«' + esc(fl.title) + '» bepul darsiga' : 'Bepul darsga') +
    ' yozilish uchun 3 ta qisqa savol.\n\n<b>Ismingiz nima?</b>',
    first ? [[{ text: first }]] : null);
}
async function finishRegistration(chatId, st, from) {
  const r = st.reg || {};
  const s = await settings();
  const funnels = await listCol('funnels');
  const funnel = funnels.filter(f => f.isDefault)[0] || funnels[0];
  const leads = await listCol('leads');
  const digits = A.phoneDigits(r.phone);
  const recent = leads.filter(l => A.phoneDigits(l.phone) === digits &&
    Date.parse(String(l.createdAt || '').replace(' ', 'T') + ':00') > Date.now() - 30 * 864e5)[0];
  let lead;
  if (recent) {
    lead = Object.assign({}, recent, {
      chatId: String(chatId), region: r.region || recent.region || '',
      src: recent.src || r.src || '', freeLessonAt: stamp()
    });
  } else {
    const stages = funnel ? A.funnelStages(funnel) : [];
    lead = {
      id: 'led_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      funnelId: funnel ? funnel.id : '', name: r.name, phone: r.phone,
      courseId: '', source: 'Bot', src: r.src || '', region: r.region || '', district: '',
      ownerStaffId: '', stage: stages[0] ? stages[0].id : 'yangi',
      note: 'Bepul darsga ro’yxatdan o’tdi', nextContact: A.today(),
      chatId: String(chatId), tgUser: String((from && from.username) || '').slice(0, 40),
      createdAt: stamp(), viaBot: true, freeLessonAt: stamp()
    };
  }
  await store.set('leads/' + lead.id, lead);
  st.step = 'registered'; st.leadId = lead.id;
  await setState(chatId, st);
  await sendMessage(chatId, 'Rahmat, ' + esc(r.name) + '! Siz ro’yxatdan o’tdingiz ✅\n\n' + freeLessonText(s) +
    '\n\nDarsdan oldin shu yerga eslatma yuboramiz.');
  if (!recent) {
    notifyStaff('Yangi ro’yxat (bot)\nIsm: ' + r.name + '\nTelefon: ' + r.phone +
      (r.region ? '\nHudud: ' + r.region : '') + (r.src ? '\nReklama: ' + r.src : '')).catch(() => { });
  }
}
/** Ro'yxat qadamlarini yuritadi. true qaytarsa — xabar shu yerda ko'rib chiqildi. */
async function handleRegistration(chatId, text, contact, from, st) {
  if (st.step === 'reg_name') {
    const name = String(text || '').replace(/[<>]/g, '').trim().slice(0, 60);
    if (name.length < 2 || name.charAt(0) === '/') {
      await sendMessage(chatId, 'Ismingizni yozing (masalan: Madina).');
      return true;
    }
    st.reg = Object.assign({}, st.reg, { name });
    st.step = 'reg_phone';
    await setState(chatId, st);
    await sendMessage(chatId, 'Telefon raqamingizni yuboring — pastdagi tugmani bosing yoki raqamni yozing.',
      [[{ text: REG_PHONE_BTN, request_contact: true }]]);
    return true;
  }
  if (st.step === 'reg_phone') {
    let phone = '';
    if (contact && contact.phone_number) {
      /* Faqat o'z raqami: boshqa odamning kontaktini ulashsa qabul qilinmaydi */
      if (contact.user_id && from && from.id && String(contact.user_id) !== String(from.id)) {
        await sendMessage(chatId, 'Iltimos, o’zingizning raqamingizni yuboring.',
          [[{ text: REG_PHONE_BTN, request_contact: true }]]);
        return true;
      }
      phone = A.normPhone(String(contact.phone_number));
    } else if (A.phoneDigits(text).length >= 9) {
      phone = A.normPhone(String(text));
    }
    if (!phone) {
      await sendMessage(chatId, 'Raqam to’liq emas. Tugmani bosing yoki raqamni +998 90 123 45 67 ko’rinishida yozing.',
        [[{ text: REG_PHONE_BTN, request_contact: true }]]);
      return true;
    }
    st.reg = Object.assign({}, st.reg, { phone });
    st.step = 'reg_region';
    await setState(chatId, st);
    await sendMessage(chatId, 'Qaysi hududdansiz?', regionKeyboard());
    return true;
  }
  if (st.step === 'reg_region') {
    const region = String(text || '').trim();
    if ((A.REGIONS || []).indexOf(region) < 0) {
      await sendMessage(chatId, 'Ro’yxatdan hududingizni tanlang.', regionKeyboard());
      return true;
    }
    st.reg = Object.assign({}, st.reg, { region });
    await finishRegistration(chatId, st, from);
    return true;
  }
  if (st.step === 'registered' && text !== '/start') {
    const hit = text ? faq.answer(text, faq.context(await settings())) : null;
    /* Salomlashsa — ro'yxatda ekanini eslatamiz; boshqa savolga javob beramiz */
    if (text && text !== REG_BTN && text.charAt(0) !== '/' && !(hit && hit.id === 'salom') &&
        [FAQ_BTN, ADMIN_BTN, STUDENT_BTN].indexOf(text) < 0) {
      await guestQuestion(chatId, text, from, st); return true;
    }
    if ([FAQ_BTN, ADMIN_BTN, STUDENT_BTN].indexOf(text) >= 0) return false;
    const s = await settings();
    await sendMessage(chatId, 'Siz bepul darsga yozilgansiz ✅\n\n' + freeLessonText(s) +
      '\n\nSavolingiz bo’lsa, administrator tez orada siz bilan bog’lanadi.');
    return true;
  }
  return false;
}

/* ---------------- Xabarlarni qayta ishlash ---------------- */
/* ---------------- Administrator menyusi (botda) ----------------
   Sozlamadagi xodimlar chatiga /start bosilganda shu menyu chiqadi:
   viktorina savolini darhol kanalga yuborish, yangi savol qo'shish,
   viktorina holati va oxirgi arizalar.                               */
const ADM_SEND = '📤 Savolni hozir yuborish';
const ADM_ADD = '➕ Savol qo‘shish';
const ADM_STATUS = '📊 Viktorina holati';
const ADM_LEADS = '📝 Yangi arizalar';
const ADM_TOGGLE = '⏯ Viktorinani yoqish/o‘chirish';
const ADM_CANCEL = '✖️ Bekor qilish';
const ADM_NOW = '📤 Hozir kanalga';
const ADM_QUEUE = '⏭ Navbatga (keyingi)';
const ADM_SKIP = 'O‘tkazib yuborish';
const ADMIN_MENU = [[{ text: ADM_SEND }, { text: ADM_ADD }], [{ text: ADM_STATUS }, { text: ADM_LEADS }], [{ text: ADM_TOGGLE }]];
const ADM_CANCEL_KB = [[{ text: ADM_CANCEL }]];

function siteBase() {
  return String(process.env.PUBLIC_URL || process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'https://hayottalim.uz').replace(/\/$/, '');
}
function quizPreview(q) {
  return '<b>' + esc(q.question) + '</b>\n' +
    q.options.map((o, i) => (i === q.correct ? '✅ ' : '▫️ ') + esc(o)).join('\n') +
    (q.explain ? '\n💡 ' + esc(q.explain) : '');
}
/* Bitta xabarda tayyor savol:
     Savol matni?
     - noto'g'ri variant
     + to'g'ri variant
     - noto'g'ri variant                                        */
function parseQuickQuiz(text) {
  const lines = String(text || '').split('\n').map(x => x.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const opts = [], marks = [];
  for (const l of lines.slice(1)) {
    const m = l.match(/^([+\-*•✅])\s*(.+)$/);
    if (!m) return null;
    opts.push(m[2].trim()); marks.push(m[1] === '+' || m[1] === '✅');
  }
  if (marks.filter(Boolean).length !== 1) return null;
  return { question: lines[0], options: opts, correct: marks.indexOf(true) };
}
async function quizStatusText() {
  const conf = await quizConf();
  const all = await quizList();
  const fresh = all.filter(q => !q.sentAt);
  const nx = await nextQuiz();
  const now = tashkentNow();
  let nextSlot = '';
  if (conf.on) {
    if (conf.start && now.date < conf.start) nextSlot = conf.start + ', ' + conf.slots[0];
    else {
      const later = conf.slots.filter(sl => Number(sl.slice(0, 2)) * 60 + Number(sl.slice(3, 5)) > now.mins);
      nextSlot = later.length ? 'bugun ' + later[0] : 'ertaga ' + conf.slots[0];
    }
  }
  const logs = (await store.list('tgquizlog/')).map(r => r.data).filter(Boolean)
    .sort((a, b) => String(b.date + b.slot).localeCompare(String(a.date + a.slot))).slice(0, 3);
  return '📊 <b>Kanal viktorinasi</b>\n' +
    'Holat: ' + (conf.on ? '✅ yoqilgan' : '⏸ o‘chirilgan') + '\n' +
    'Kanal: ' + esc(conf.channel) + '\n' +
    'Vaqtlar (Toshkent): ' + conf.slots.join(', ') + '\n' +
    'Boshlanish: ' + esc(conf.start) + '\n' +
    (nextSlot ? 'Keyingi yuborish: ' + nextSlot + '\n' : '') +
    'Savollar: ' + all.length + ' ta, hali yuborilmagan: <b>' + fresh.length + '</b> ta' +
    (fresh.length ? ' (≈' + Math.floor(fresh.length / Math.max(1, conf.slots.length)) + ' kunga yetadi)' : '') + '\n' +
    (nx ? '\nNavbatdagi savol:\n' + quizPreview(nx) + '\n' : '') +
    (logs.length ? '\nOxirgilari:\n' + logs.map(l => '• ' + l.date + ' ' + l.slot + ' — ' + esc(l.status)).join('\n') : '');
}
async function leadsText() {
  const leads = (await listCol('leads')).filter(Boolean)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 10);
  if (!leads.length) return '📝 Hozircha ariza yo‘q.';
  const today = A.today();
  const nToday = (await listCol('leads')).filter(l => String(l.createdAt || '').slice(0, 10) === today).length;
  return '📝 <b>Oxirgi arizalar</b> (bugun: ' + nToday + ' ta)\n\n' +
    leads.map((l, i) => (i + 1) + '. <b>' + esc(l.name || '—') + '</b> — ' + esc(l.phone || 'raqamsiz') + '\n' +
      '   ' + esc(String(l.createdAt || '').slice(0, 16)) + ' · ' + esc(l.source || l.src || 'sayt') +
      (l.note ? '\n   ' + esc(String(l.note).split('\n').pop().slice(0, 80)) : '')).join('\n') +
    '\n\nHammasi ERP da: ' + siteBase() + '/#leads';
}
async function adminAddQuiz(q, front) {
  const all = await quizList();
  const id = 'b' + Date.now().toString(36);
  let order;
  if (front) {
    const fresh = all.filter(x => !x.sentAt);
    order = (fresh.length ? Math.min.apply(null, fresh.map(x => x.order || 0)) : 1000) - 1;
  } else {
    order = all.reduce((m, x) => Math.max(m, x.order || 0), 1000) + 1;
  }
  const c = cleanQuiz(Object.assign({ id, kind: 'admin' }, q), order);
  if (!c) throw new Error('Savol noto‘g‘ri: savol 300, variant 100 belgidan oshmasin, 2–10 ta variant bo‘lsin.');
  c.createdAt = stamp(); c.byChat = 'bot';
  await store.set('tgquiz/' + c.id, c);
  return c;
}
async function adminMessage(chatId, text, st) {
  const ad = st.adm || {};
  const reset = async () => { delete st.adm; await setState(chatId, st); };

  if (text === '/start' || text === '/admin' || text === '/menu') {
    await reset();
    await sendMessage(chatId, '👋 Assalomu alaykum! Bu <b>administrator menyusi</b>.\n\n' +
      ADM_SEND + ' — navbatdagi savol darhol kanalga ketadi\n' +
      ADM_ADD + ' — o‘zingiz savol yozasiz\n' +
      ADM_STATUS + ' — nechta savol qolgani, keyingi vaqt\n' +
      ADM_LEADS + ' — oxirgi arizalar\n\n' +
      'Tez yo‘l: savolni bitta xabarda yozing —\n<code>Savol matni?\n- variant\n+ to‘g‘ri variant\n- variant</code>', ADMIN_MENU);
    return true;
  }
  if (text === ADM_CANCEL) { await reset(); await sendMessage(chatId, 'Bekor qilindi.', ADMIN_MENU); return true; }

  /* --- savol qo'shish bosqichlari --- */
  if (ad.step === 'q') {
    const quick = parseQuickQuiz(text);
    if (quick) { st.adm = { step: 'confirm', q: quick }; await setState(chatId, st); await sendMessage(chatId, 'Tekshiring:\n\n' + quizPreview(Object.assign({ explain: '' }, quick)), [[{ text: ADM_NOW }, { text: ADM_QUEUE }], [{ text: ADM_CANCEL }]]); return true; }
    const qt = String(text || '').trim();
    if (qt.length < 3 || qt.length > 300) { await sendMessage(chatId, 'Savol 3–300 belgi bo‘lsin. Qayta yozing:', ADM_CANCEL_KB); return true; }
    st.adm = { step: 'opts', q: { question: qt } }; await setState(chatId, st);
    await sendMessage(chatId, 'Endi <b>javob variantlarini</b> yozing — har birini yangi qatordan (2–10 ta, har biri 100 belgigacha):', ADM_CANCEL_KB);
    return true;
  }
  if (ad.step === 'opts') {
    const opts = String(text || '').split('\n').map(x => x.replace(/^[\-*•+\d.)\s]+/, '').trim()).filter(Boolean);
    if (opts.length < 2 || opts.length > 10 || opts.some(o => o.length > 100)) {
      await sendMessage(chatId, '2 tadan 10 tagacha variant kerak, har biri yangi qatordan. Qayta yozing:', ADM_CANCEL_KB); return true;
    }
    ad.q.options = opts; ad.step = 'correct'; st.adm = ad; await setState(chatId, st);
    await sendMessage(chatId, 'Qaysi biri <b>to‘g‘ri javob</b>?\n' + opts.map((o, i) => (i + 1) + ') ' + esc(o)).join('\n'),
      [opts.map((o, i) => ({ text: String(i + 1) })), [{ text: ADM_CANCEL }]]);
    return true;
  }
  if (ad.step === 'correct') {
    const n = Number(String(text).trim());
    if (!(n >= 1 && n <= ad.q.options.length)) { await sendMessage(chatId, '1 dan ' + ad.q.options.length + ' gacha raqam yuboring.'); return true; }
    ad.q.correct = n - 1; ad.step = 'explain'; st.adm = ad; await setState(chatId, st);
    await sendMessage(chatId, 'Izoh (javobdan keyin ko‘rinadi, 200 belgigacha) — yozing yoki o‘tkazib yuboring:', [[{ text: ADM_SKIP }], [{ text: ADM_CANCEL }]]);
    return true;
  }
  if (ad.step === 'explain') {
    ad.q.explain = text === ADM_SKIP ? '' : String(text || '').trim().slice(0, 200);
    ad.step = 'confirm'; st.adm = ad; await setState(chatId, st);
    await sendMessage(chatId, 'Tekshiring:\n\n' + quizPreview(ad.q), [[{ text: ADM_NOW }, { text: ADM_QUEUE }], [{ text: ADM_CANCEL }]]);
    return true;
  }
  if (ad.step === 'confirm' && (text === ADM_NOW || text === ADM_QUEUE)) {
    try {
      const q = await adminAddQuiz(ad.q, true);
      if (text === ADM_NOW) {
        await sendQuiz(q, (await quizConf()).channel);
        await sendMessage(chatId, '✅ Savol kanalga yuborildi.', ADMIN_MENU);
      } else {
        await sendMessage(chatId, '✅ Savol navbatga qo‘shildi — keyingi vaqtda birinchi bo‘lib ketadi.', ADMIN_MENU);
      }
    } catch (e) {
      await sendMessage(chatId, '⚠️ ' + esc(e.message || e), ADMIN_MENU);
    }
    await reset();
    return true;
  }
  if (ad.step === 'confirm') { await sendMessage(chatId, 'Tugmalardan birini tanlang.', [[{ text: ADM_NOW }, { text: ADM_QUEUE }], [{ text: ADM_CANCEL }]]); return true; }

  /* --- menyu tugmalari --- */
  if (text === ADM_ADD || text === '/savol') {
    st.adm = { step: 'q' }; await setState(chatId, st);
    await sendMessage(chatId, '<b>Savol matnini</b> yozing (300 belgigacha).\n\nYoki hammasini bitta xabarda:\n' +
      '<code>Savol matni?\n- variant\n+ to‘g‘ri variant\n- variant</code>', ADM_CANCEL_KB);
    return true;
  }
  if (text === ADM_SEND || text === '/yubor') {
    try {
      const conf = await quizConf();
      const q = await nextQuiz();
      if (!q) { await sendMessage(chatId, 'Savollar yo‘q. «' + ADM_ADD + '» bilan qo‘shing.', ADMIN_MENU); return true; }
      await sendQuiz(q, conf.channel);
      await sendMessage(chatId, '✅ Kanalga yuborildi (' + esc(conf.channel) + '):\n\n' + quizPreview(q), ADMIN_MENU);
    } catch (e) {
      await sendMessage(chatId, '⚠️ Yuborilmadi: ' + esc(e.message || e) + '\n\nBot kanalda administrator ekanini tekshiring.', ADMIN_MENU);
    }
    return true;
  }
  if (text === ADM_STATUS || text === '/holat') { await sendMessage(chatId, await quizStatusText(), ADMIN_MENU); return true; }
  if (text === ADM_LEADS || text === '/arizalar') { await sendMessage(chatId, await leadsText(), ADMIN_MENU); return true; }
  if (text === ADM_TOGGLE) {
    const s = (await store.get('meta/settings')) || {};
    s.bot = Object.assign({}, s.bot || {});
    s.bot.quizOn = s.bot.quizOn === false;
    await store.set('meta/settings', s);
    await sendMessage(chatId, s.bot.quizOn ? '✅ Viktorina yoqildi — savollar vaqtida ketadi.' : '⏸ Viktorina to‘xtatildi. Qayta yoqish uchun shu tugmani bosing.', ADMIN_MENU);
    return true;
  }
  /* Tez yo'l: menyusiz, bitta xabarda tayyor savol */
  const quick = parseQuickQuiz(text);
  if (quick) {
    st.adm = { step: 'confirm', q: quick }; await setState(chatId, st);
    await sendMessage(chatId, 'Tekshiring:\n\n' + quizPreview(Object.assign({ explain: '' }, quick)), [[{ text: ADM_NOW }, { text: ADM_QUEUE }], [{ text: ADM_CANCEL }]]);
    return true;
  }
  if (text && text.charAt(0) !== '/') {
    await sendMessage(chatId, 'Administrator menyusidan tanlang 👇', ADMIN_MENU);
    return true;
  }
  return false;
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = String(msg.text || '').trim();
  const chatType = String((msg.chat && msg.chat.type) || 'private');

  /* MUHIM: shaxsiy ma'lumot FAQAT shaxsiy suhbatda.
     Guruh, supergroup va kanalda bu yo'l umuman ishlamaydi — u yerda
     xabarni hamma ko'radi. Guruh uchun alohida onGroupUpdate bor.          */
  if (chatType !== 'private') {
    return onGroupUpdate(chatId, (msg.chat && msg.chat.title) || '', text);
  }

  const conf = await botConf();
  let st = await getState(chatId);
  const student = await findStudentByChat(chatId);

  // Chat ID ni bilish (sozlamalarga yozish uchun) — hamma uchun ochiq, zararsiz
  if (text === '/id') {
    return sendMessage(chatId, 'Shu suhbat raqami (chat ID):\n<code>' + chatId + '</code>\n\n' +
      'Sozlamalar → Telegram bot bo’limiga shu raqamni yozsangiz, saytdagi ' +
      'formadan kelgan murojaatlar shu yerga tushadi.');
  }

  /* Administrator chati (Sozlamalar → Telegram bot → xodimlar chat ID) —
     alohida boshqaruv menyusi. Chat ID ni Telegram o'zi beradi, uni
     soxtalashtirib bo'lmaydi. */
  if (await isStaffChat(chatId)) {
    if (await adminMessage(chatId, text, st)) return;
  }

  // /start <token> — administrator yuborgan bir martalik havola
  if (/^\/start\s+\S+/.test(text)) {
    const payload = text.replace(/^\/start\s+/, '').trim();
    if (link_looksLikeToken(payload)) {
      st = st && st.chatId ? st : { chatId: String(chatId), step: 'code', codeTries: 0 };
      await linkWithToken(chatId, payload, msg.from || {}, st);
      return;
    }
    if (!student && /^(dars|r_)/i.test(payload)) {
      return startRegistration(chatId, payload, msg.from || {});
    }
  }

  /* Bepul darsga ro'yxat — tugma yoki davom etayotgan qadam */
  if (!student && text === REG_BTN) return startRegistration(chatId, '', msg.from || {});
  if (!student && /^reg_|^registered$/.test(String(st.step || ''))) {
    if (await handleRegistration(chatId, text, msg.contact, msg.from || {}, st)) return;
  }

  if (text === '/start' || /^\/start\s/.test(text)) {
    if (student) {
      st.step = 'linked'; st.studentId = student.id;
      await setState(chatId, st);
      let info = '';
      try { info = kabinet.summaryText(await kabinet.summary(store, student)); } catch (e) { info = ''; }
      await sendMessage(chatId,
        conf.welcome + '\n\n' + (info || ('Siz <b>' + student.lastName + ' ' + student.firstName +
          '</b> sifatida ulangansiz.')), MENU);
      return;
    }
    st = { chatId: String(chatId), step: 'code', codeTries: 0, leadId: st.leadId || undefined };
    await setState(chatId, st);
    await sendMessage(chatId,
      conf.welcome + '\n\nMen ' + esc((await settings()).centerName || 'Sabo Academy') + ' yordamchisiman 🤖 ' +
      'Kurslar, darslar vaqti, tekin dars va daraja testi haqidagi <b>savolingizni yozing</b> — darhol javob beraman.\n\n' +
      '🎁 Birinchi dars tekin — «' + REG_BTN + '» tugmasini bosing.\n' +
      '🎓 Markaz o’quvchisi bo’lsangiz — «' + STUDENT_BTN + '» (administrator bergan havola orqali ulanasiz).',
      GUEST_MENU);
    return;
  }

  if (!student) {
    if (text === FAQ_BTN) return sendMessage(chatId, faq.faqListText(), GUEST_MENU);
    if (text === SITE_BTN) {
      const a = faq.TOPICS.filter(t => t.id === 'sayt')[0];
      return sendMessage(chatId, a.answer(faq.context(await settings())), GUEST_MENU);
    }
    if (text === ADMIN_BTN) {
      const c = faq.context(await settings());
      return sendMessage(chatId, '📞 Administrator: ' + c.phone + '\n🌐 ' + c.site +
        '\n\nSavolingizni shu yerga yozsangiz ham bo’ladi — administratorga yetkazaman.', GUEST_MENU);
    }
    if (text === STUDENT_BTN) {
      st.step = 'code'; st.codeTries = 0; st.studentMode = true;
      await setState(chatId, st);
      return sendMessage(chatId, 'Administrator bergan <b>bir martalik havolani</b> bosing — hisobingiz shu suhbatga bog’lanadi.\n' +
        'Havolangiz bo’lmasa, <b>ismim</b> deb yozing — administrator tasdiqlaydi.', GUEST_MENU);
    }
    if (st.step === 'ask_phone') {
      if (text === CANCEL_BTN) { st.step = 'code'; delete st.q; await setState(chatId, st); return sendMessage(chatId, 'Bekor qilindi.', GUEST_MENU); }
      let phone = '';
      const contact = msg.contact;
      if (contact && contact.phone_number && (!contact.user_id || !msg.from || String(contact.user_id) === String(msg.from.id))) {
        phone = A.normPhone(String(contact.phone_number));
      } else if (A.phoneDigits(text).length >= 9) phone = A.normPhone(text);
      /* Raqam o'rniga boshqa savol yozsa (masalan «sayt bormi?») va unga
         javob bo'lsa — raqam so'rashni to'xtatib, javob beramiz. */
      if (!phone && text && faq.answer(text, faq.context(await settings()))) {
        st.step = 'code'; delete st.q;
        await setState(chatId, st);
        return guestQuestion(chatId, text, msg.from || {}, st);
      }
      if (!phone) {
        return sendMessage(chatId, 'Raqamni +998 90 123 45 67 ko’rinishida yozing yoki tugmani bosing.',
          [[{ text: REG_PHONE_BTN, request_contact: true }], [{ text: CANCEL_BTN }]]);
      }
      const q = st.q || '';
      st.step = 'code'; delete st.q;
      await saveGuestQuestion(chatId, st, msg.from || {}, q, phone);
      await setState(chatId, st);
      return sendMessage(chatId, 'Rahmat! Savolingiz administratorga yuborildi ✅ Tez orada shu raqamga javob beradi.', GUEST_MENU);
    }
    /* Kod, havola, "ismim" yoki o'quvchini ulash qadamlari — eski yo'l */
    const linkish = link_looksLikeToken(text) || /^\s*\d{4,5}\s*$/.test(text) || /^ismim/i.test(text.trim());
    if (/^(name|group|waiting)$/.test(String(st.step || '')) || linkish) {
      if (!/^(code|name|group|waiting)$/.test(String(st.step || ''))) { st.step = 'code'; st.codeTries = st.codeTries || 0; }
      return handleLinkFlow(chatId, text, msg.from || {}, st);
    }
    if (text && text.charAt(0) !== '/') return guestQuestion(chatId, text, msg.from || {}, st);
    if (st.step === 'start') {
      st.step = 'code'; st.codeTries = 0;
      await setState(chatId, st);
      await sendMessage(chatId, 'Boshlash uchun shaxsiy kodingizni yozing — 4 ta raqam (masalan 4077). ' +
        'Kodingiz bo’lmasa, "ismim" deb yozing.');
      return;
    }
    return handleLinkFlow(chatId, text, msg.from || {}, st);
  }

  /* --- Ulangan o'quvchi --- */
  if (st.step === 'writing') {
    const id = 'in_' + Date.now() + '_' + chatId;
    await store.set('botin/' + id, {
      id, studentId: student.id, chatId: String(chatId),
      text: text, at: stamp(), status: 'yangi'
    });
    st.step = 'linked';
    await setState(chatId, st);
    await sendMessage(chatId, 'Xabaringiz markazga yuborildi. Tez orada javob beramiz.', MENU);
    return;
  }

  if (text === 'Ma’lumotim' || text === '/malumot' || text === '/info') {
    return sendMessage(chatId, kabinet.summaryText(await kabinet.summary(store, student)), MENU);
  }
  if (text === 'To’lovim' || text === '/tolov') return sendMessage(chatId, await balanceText(student), MENU);
  if (text === PAY_BTN || text === '/pay' || text === '/tolash') return payStart(chatId, student);
  if (text === PAID_BTN) return payPressed(chatId, student);
  if (text === BACK_BTN) return sendMessage(chatId, 'Asosiy menyu.', MENU);
  if (text === 'Davomatim' || text === '/davomat') return sendMessage(chatId, await attendanceText(student), MENU);
  if (text === 'Jadvalim' || text === '/jadval') return sendMessage(chatId, await scheduleText(student), MENU);
  /* Vebdagi kabinetga xavfsiz kirish: bir martalik, 15 daqiqalik havola.
     Havola faqat shu shaxsiy suhbatga yuboriladi.                          */
  if (text === 'Kabinet (veb)' || text === '/kabinet') {
    const base = String(process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
    if (!base) {
      return sendMessage(chatId, 'Veb manzil sozlanmagan. Administrator bilan bog’laning.', MENU);
    }
    const made = await link.create(store, {
      studentId: student.id, kind: 'kabinet', ttlMs: 15 * 60 * 1000, byUserId: 'bot', stamp
    });
    return sendMessage(chatId,
      'Kabinetga kirish havolasi (15 daqiqa amal qiladi, bir marta ishlaydi):\n' +
      base + '/#kabinet?t=' + made.token + '\n\n' +
      'Havolani hech kimga bermang — u sizning hisobingizni ochadi.', MENU);
  }

  if (text === 'Markazga yozish' || text === '/yozish') {
    st.step = 'writing';
    await setState(chatId, st);
    return sendMessage(chatId, 'Xabaringizni yozing — u markaz administratoriga yetkaziladi.');
  }

  /* O'quvchining erkin savoli — bilim bazasidan javob */
  if (text && text.charAt(0) !== '/') {
    const a = faq.answer(text, faq.context(await settings())) ;
    if (a && a.id !== 'salom') return sendMessage(chatId, a.text, MENU);
  }
  return sendMessage(chatId, 'Quyidagi tugmalardan birini tanlang. Savolingiz bo’lsa — «Markazga yozish» tugmasini bosing.', MENU);
}

/* ---------------- Kanal viktorinasi ----------------
   Har kuni 3 marta (Toshkent vaqti bilan) kanalga Telegram «Quiz» so'rovnomasi
   yuboriladi. Savollar bazada: tgquiz/<id> (javobi bilan — mijozga berilmaydi).
   Har bir vaqt uchun tgquizlog/<sana>-<soat> yoziladi — bir slot ikki marta
   ketmaydi (server qayta ishga tushsa ham). Server uxlab qolgan bo'lsa,
   o'tib ketgan slot 3 soat ichida uyg'onganda yuboriladi, undan kech — o'tkaziladi. */
const QUIZ_BANK = require('./quiz-bank');
const QUIZ_SLOTS = (process.env.QUIZ_SLOTS || '09:00,14:00,20:00').split(',').map(x => x.trim()).filter(x => /^\d{2}:\d{2}$/.test(x));
const QUIZ_LATE_MIN = 180;
let quizTg = null;                       // sinovda soxta Telegram
function quizApi(method, params) { return quizTg ? quizTg(method, params) : tg(method, params); }

function tashkentNow(ms) {
  const d = new Date((ms || Date.now()) + 5 * 3600 * 1000);       // UTC+5, yozgi vaqt yo'q
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), hm: iso.slice(11, 16), mins: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
async function quizConf() {
  const b = ((await settings()).bot) || {};
  return {
    on: b.quizOn !== false,
    channel: String(b.quizChannel || process.env.QUIZ_CHANNEL || '@SaboAcademy').trim(),
    /* Shu sanadan (Toshkent vaqti) boshlab yuboriladi */
    start: /^\d{4}-\d{2}-\d{2}$/.test(String(b.quizStart || '')) ? b.quizStart : (process.env.QUIZ_START || '2026-10-10'),
    slots: QUIZ_SLOTS
  };
}
function cleanQuiz(q, order) {
  const opts = (Array.isArray(q.options) ? q.options : []).map(o => String(o).trim()).filter(Boolean).slice(0, 10);
  const correct = Number(q.correct);
  if (!q.id || !/^[A-Za-z0-9_\-]{2,40}$/.test(String(q.id))) return null;
  if (!q.question || String(q.question).length > 300) return null;
  if (opts.length < 2 || opts.some(o => o.length > 100)) return null;
  if (!(correct >= 0 && correct < opts.length)) return null;
  return {
    id: String(q.id), kind: String(q.kind || '').slice(0, 30), question: String(q.question).trim(),
    options: opts, correct, explain: String(q.explain || '').slice(0, 200), order: Number(order) || 0
  };
}
/** Fayldagi savollarni bazaga qo'shadi (borini o'zgartirmaydi) */
async function ensureQuizBank() {
  let added = 0;
  for (let i = 0; i < QUIZ_BANK.length; i++) {
    const q = cleanQuiz(QUIZ_BANK[i], 1000 + i);
    if (!q) continue;
    if (await store.get('tgquiz/' + q.id)) continue;
    await store.set('tgquiz/' + q.id, Object.assign(q, { createdAt: stamp() }));
    added++;
  }
  return added;
}
async function quizList() {
  return (await store.list('tgquiz/')).map(r => r.data).filter(Boolean)
    .sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
}
/** Navbatdagi savol: hali yuborilmagani; hammasi ketgan bo'lsa — eng uzoq vaqt oldin ketgani */
async function nextQuiz() {
  const all = await quizList();
  if (!all.length) return null;
  const fresh = all.filter(q => !q.sentAt);
  if (fresh.length) return fresh[0];
  return all.slice().sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt)))[0];
}
async function sendQuiz(q, channel) {
  const res = await quizApi('sendPoll', {
    chat_id: channel,
    question: q.question,
    options: q.options.map(t => ({ text: t })),
    type: 'quiz',
    correct_option_id: q.correct,
    explanation: q.explain || undefined,
    is_anonymous: true
  });
  q.sentAt = stamp(); q.sentCount = (q.sentCount || 0) + 1;
  q.messageId = res && res.message_id ? res.message_id : null;
  await store.set('tgquiz/' + q.id, q);
  return res;
}
/** Har 5 daqiqada: vaqti kelgan slot bo'lsa — bitta savol yuboradi */
async function quizTick(nowMs) {
  const conf = await quizConf();
  if (!conf.on || !conf.channel) return { sent: 0 };
  const now = tashkentNow(nowMs);
  if (conf.start && now.date < conf.start) return { sent: 0, waiting: conf.start };
  let sent = 0;
  for (const slot of conf.slots) {
    const sm = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5));
    if (now.mins < sm || now.mins - sm > QUIZ_LATE_MIN) continue;
    const key = 'tgquizlog/' + now.date + '-' + slot.replace(':', '');
    if (await store.get(key)) continue;
    const q = await nextQuiz();
    if (!q) return { sent };
    await store.set(key, { date: now.date, slot, quizId: q.id, at: stamp(), status: 'yuborilmoqda' });
    try {
      await sendQuiz(q, conf.channel);
      await store.set(key, { date: now.date, slot, quizId: q.id, at: stamp(), status: 'yuborildi' });
      sent++;
    } catch (e) {
      await store.set(key, { date: now.date, slot, quizId: q.id, at: stamp(), status: 'xato', error: String(e.message || e).slice(0, 200) });
      console.error('kanal viktorina:', e.message);
    }
  }
  return { sent };
}
/** Administrator yangi savollar qo'shadi (JSON ro'yxat) */
async function addQuizzes(items) {
  const all = await quizList();
  let order = all.reduce((m, q) => Math.max(m, q.order || 0), 1000) + 1;
  const ok = [], bad = [];
  for (const it of (Array.isArray(items) ? items : []).slice(0, 200)) {
    const q = cleanQuiz(it, order);
    if (!q) { bad.push(it && it.id ? String(it.id) : '?'); continue; }
    const old = await store.get('tgquiz/' + q.id);
    if (old && old.sentAt) { bad.push(q.id + ' (allaqachon yuborilgan)'); continue; }
    await store.set('tgquiz/' + q.id, Object.assign(q, { createdAt: stamp() }));
    ok.push(q.id); order++;
  }
  return { added: ok.length, ok, bad };
}

/* ---------------- Karta orqali to'lov ---------------- */
function payCtx() {
  return { store, stamp, A, confirm: confirmClaim, notifyStaff };
}
async function nextDueText(student) {
  try {
    const sum = await kabinet.summary(store, student);
    const fin = sum && sum.finance;
    if (fin && fin.debt > 0) return 'Qolgan qarz: ' + A.som(fin.debt) + ' so’m';
    if (fin && fin.next && fin.next.dueDate) return 'Keyingi to’lov: <b>' + A.dateLabel(fin.next.dueDate) + '</b> gacha';
  } catch (e) { }
  return '';
}
async function payStart(chatId, student) {
  const conf = paybot.payConf(await settings());
  if (!conf.card) {
    return sendMessage(chatId, 'Karta orqali to’lov hali sozlanmagan. Markaz administratoriga murojaat qiling.', MENU);
  }
  const r = await paybot.startClaim(payCtx(), student, chatId);
  if (r.none) {
    const nx = await nextDueText(student);
    return sendMessage(chatId, 'Hozir to’lanadigan summa yo’q ✅' + (nx ? '\n' + nx : ''), MENU);
  }
  const c = r.claim;
  const lines = [
    '<b>To’lov</b>',
    'To’lanadigan summa: <b>' + paybot.fmt(c.amount) + ' so’m</b>',
    c.tail ? '<i>Aynan shu summani o’tkazing — oxirgi ' + c.tail + ' so’m to’lovingizni avtomatik tanish uchun (keyingi oyga avans bo’lib o’tadi).</i>' : '',
    '',
    'Karta: <code>' + esc(paybot.cardFmt(conf.card)) + '</code>',
    conf.holder ? 'Egasi: ' + esc(conf.holder) : '',
    '',
    'Pulni o’tkazgach «' + PAID_BTN + '» tugmasini bosing. Kartaga tushishi bilan to’lov avtomatik tasdiqlanadi.'
  ].filter((x, i, arr) => x !== '' || (arr[i - 1] !== '' && i > 0));
  return sendMessage(chatId, lines.join('\n'), PAY_KB);
}
async function payPressed(chatId, student) {
  const c = await paybot.markPaid(payCtx(), student);
  if (!c) return sendMessage(chatId, 'Avval «' + PAY_BTN + '» tugmasini bosing — summa va karta raqami chiqadi.', MENU);
  await sendMessage(chatId, 'Rahmat! ' + paybot.fmt(c.amount) + ' so’m to’lovingiz tekshirilmoqda. ' +
    'Kartaga tushishi bilan shu yerga tasdiq keladi (odatda bir necha daqiqa).', MENU);
  try { await paybot.reconcile(payCtx()); } catch (e) { console.error('paybot:', e.message); }
}
/** Mos kelgan kirim: to'lovni yozish va o'quvchiga xabar */
async function confirmClaim(claim, tx) {
  if (!recordPayment) throw new Error('to’lov yozuvchisi yo’q');
  const rec = await recordPayment({
    studentId: claim.studentId, amount: tx.amount, extId: tx.id,
    note: 'Karta (avtomatik): ' + (tx.card4 ? '*' + tx.card4 + ' · ' : '') + 'da’vo ' + claim.id
  });
  claim.status = 'tasdiqlandi'; claim.txId = tx.id; claim.paymentId = rec.id; claim.receiptNo = rec.receiptNo;
  claim.confirmedAt = stamp();
  await store.set('payclaim/' + claim.id, claim);
  tx.status = 'mos'; tx.claimId = claim.id;
  await store.set('banktx/' + tx.id, tx);
  const student = await store.get('students/' + claim.studentId);
  const nx = student ? await nextDueText(student) : '';
  const text = '✅ To’lovingiz qabul qilindi!\n' +
    'Summa: <b>' + paybot.fmt(tx.amount) + ' so’m</b>\n' +
    'Kvitansiya: ' + esc(rec.receiptNo || '') + (nx ? '\n' + nx : '') + '\nRahmat!';
  try { await sendMessage(claim.chatId, text, MENU); }
  catch (e) {
    await enqueue({ studentId: claim.studentId, chatId: claim.chatId, text, kind: 'elon', dedupeKey: 'paid:' + claim.id }, 0);
  }
  return rec;
}
/** Bank bildirishnomasi keldi (kanal yoki guruh) */
async function onBankPost(chat, msg) {
  const conf = paybot.payConf(await settings());
  if (!paybot.isBankChat(conf, chat)) return false;
  const text = msg.text || msg.caption || '';
  const tx = await paybot.saveBankTx(payCtx(), text, chat.id, msg.message_id);
  if (tx) { try { await paybot.reconcile(payCtx()); } catch (e) { console.error('paybot:', e.message); } }
  return true;
}

/* ---------------- Administrator tasdig'i ---------------- */
async function notifyApproved() {
  const reqs = (await store.list('botreq/')).map(r => r.data).filter(Boolean);
  for (const r of reqs) {
    if (r.status === 'tasdiqlangan' && !r.notified) {
      try {
        await sendMessage(r.chatId, 'Hisobingiz tasdiqlandi! Menyudan foydalanishingiz mumkin.', MENU);
        const st = await getState(r.chatId);
        st.step = 'linked';
        await setState(r.chatId, st);
      } catch (e) { /* keyingi aylanishda qayta urinadi */ }
      r.notified = true;
      await store.set('botreq/' + r.id, r);
    }
    if (r.status === 'rad' && !r.notified) {
      try {
        await sendMessage(r.chatId, 'Kechirasiz, so’rovingiz tasdiqlanmadi. Administrator bilan bog’laning.');
      } catch (e) { }
      r.notified = true;
      await store.set('botreq/' + r.id, r);
    }
  }
}

/* ---------------- Uzoq so'rov (long polling) ---------------- */
async function poll() {
  while (running) {
    try {
      const updates = await tg('getUpdates', {
        offset, timeout: 25, allowed_updates: ['message', 'my_chat_member', 'channel_post']
      });
      for (const u of updates) {
        offset = u.update_id + 1;
        // botni guruhga qo'shishdi — darhol ulashga urinamiz
        const cm = u.my_chat_member;
        /* Bank bildirishnomasi kanali */
        if (u.channel_post && u.channel_post.chat) {
          try { await onBankPost(u.channel_post.chat, u.channel_post); } catch (e) { console.error('bot bank:', e.message); }
          continue;
        }
        if (cm && cm.chat && cm.chat.type === 'channel' &&
          /administrator|member/.test(String((cm.new_chat_member || {}).status || ''))) {
          try {
            await notifyStaff('Bot kanalga qo’shildi: ' + (cm.chat.title || '') + '\nKanal raqami: ' + cm.chat.id +
              '\nAgar bu karta bildirishnomalari kanali bo’lsa — shu raqamni ERP → Telegram bot → Sozlamalar → «Bildirishnoma kanali» ga yozing.');
          } catch (e) { }
          continue;
        }
        if (cm && cm.chat && /group/.test(String(cm.chat.type || '')) &&
          /member|administrator/.test(String((cm.new_chat_member || {}).status || ''))) {
          try { await linkGroupChat(cm.chat.id, cm.chat.title); }
          catch (e) { console.error('bot guruh:', e.message); }
          continue;
        }
        if (u.message && (u.message.text || u.message.contact)) {
          const chat = u.message.chat || {};
          try {
            if (/group/.test(String(chat.type || ''))) {
              if (await onBankPost(chat, u.message)) continue;
              if (u.message.text) await onGroupUpdate(chat.id, chat.title, u.message.text);
            }
            else { await onMessage(u.message); wake(); }
          } catch (e) { console.error('bot message:', e.message); }
        }
      }
    } catch (e) {
      console.error('bot poll:', e.message);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

/**
 * Navbatchi. Bazani faqat kerak bo'lganda so'raydi:
 *   — uyg'otish kelganda (yangi xabar, administrator tasdig'i, botdagi suhbat);
 *   — qayta urinish vaqti kelganda;
 *   — aks holda IDLE_MS da bir marta (ehtiyot tekshiruvi).
 * Shuning uchun bo'sh turganda baza deyarli bezovta qilinmaydi.
 */
async function queueLoop(opts) {
  const idle = (opts && opts.idleMs) || IDLE_MS;
  while (running) {
    let nextAt = 0;
    try {
      const r = await flushQueue();
      nextAt = r && r.nextAt ? r.nextAt : 0;
      await notifyApproved();
    } catch (e) { console.error('bot queue:', e.message); }
    let waitMs = idle;
    if (nextAt) waitMs = Math.max(500, Math.min(idle, nextAt - Date.now()));
    await waitFor(waitMs);
  }
}

/** Kuniga bir marta qarz eslatmasi */
function startReminders() {
  let lastDay = '';
  const t = setInterval(async () => {
    try {
      const today = A.today();
      if (today === lastDay) return;
      lastDay = today;
      const r = await remindDebtors(today);
      if (r.queued) console.log('  Bot: ' + r.queued + ' ta qarz eslatmasi navbatga qo’yildi.');
      const rs = await remindStudy(today);
      if (rs.queued) console.log('  Bot: ' + rs.queued + ' ta o’qish eslatmasi navbatga qo’yildi.');
    } catch (e) { console.error('bot remind:', e.message); }
  }, 30 * 60 * 1000);
  if (t.unref) t.unref();
  timers.push(t);
  /* Kanal viktorinasi: savollar bazaga, keyin har 5 daqiqada vaqt tekshiriladi */
  ensureQuizBank().then(n => { if (n) console.log('  Kanal viktorinasi: ' + n + ' ta savol qo’shildi.'); })
    .catch(e => console.error('viktorina bank:', e.message));
  const tq = setInterval(() => { quizTick().catch(e => console.error('viktorina:', e.message)); }, 5 * 60 * 1000);
  if (tq.unref) tq.unref();
  timers.push(tq);
  setTimeout(() => { quizTick().catch(() => { }); }, 20 * 1000);
  /* Kirim va da'volarni har 2 daqiqada solishtirish (kechikkan «To'ladim» uchun) */
  const t2 = setInterval(() => { paybot.reconcile(payCtx()).catch(e => console.error('paybot:', e.message)); }, 2 * 60 * 1000);
  if (t2.unref) t2.unref();
  timers.push(t2);
}

/* Bot profili Telegramda: ko'rinadigan ism, /start dan oldingi tavsif va
   qisqa tavsif markaz nomidan olinadi. Faqat FARQ bo'lsa yuboriladi
   (Telegram bu so'rovlarni cheklaydi). Rasmni @BotFather orqali qo'yiladi. */
function botProfileTexts(name) {
  return {
    name: String(name).slice(0, 64),
    description: (name + ' — arab va xorijiy tillar markazi 🗣️\n\n' +
      'Bu bot orqali:\n🎁 Tekin darsga yozilasiz\n❓ Savollaringizga darhol javob olasiz\n' +
      '🎓 O‘quvchilar: to‘lov, davomat, dars jadvali va kabinet\n\nBoshlash uchun «Start» ni bosing 👇').slice(0, 512),
    short: (name + ' — arab tilini gapirib o‘rganamiz. Tekin dars va savollar uchun bot.').slice(0, 120)
  };
}
async function syncBotProfile() {
  const s = (await store.get('meta/settings')) || {};
  const t = botProfileTexts(String(s.centerName || process.env.APP_NAME || 'Sabo Academy'));
  const curName = await tg('getMyName', {}).catch(() => null);
  if (curName && curName.name !== t.name) await tg('setMyName', { name: t.name });
  const curDesc = await tg('getMyDescription', {}).catch(() => null);
  if (curDesc && curDesc.description !== t.description) await tg('setMyDescription', { description: t.description });
  const curShort = await tg('getMyShortDescription', {}).catch(() => null);
  if (curShort && curShort.short_description !== t.short) await tg('setMyShortDescription', { short_description: t.short });
  await tg('setMyCommands', { commands: [
    { command: 'start', description: 'Boshlash / asosiy menyu' },
    { command: 'id', description: 'Chat raqamini bilish' }
  ] }).catch(() => { });
}

function start(ctx) {
  store = ctx.store; stamp = ctx.stamp; A = ctx.A;
  if (ctx.recordPayment) recordPayment = ctx.recordPayment;
  if (ctx.send) setTransport(ctx.send);
  if (!TOKEN && !ctx.send) { console.log('  Bot: token yo’q, ishga tushmadi.'); return; }
  running = true;
  startReminders();
  if (ctx.send) return;                       // sinov rejimi: tashqi yuborish
  tg('getMe').then(async me => {
    console.log('  Telegram bot ishga tushdi: @' + me.username);
    /* Saytdagi "botga yozish" havolalari doim HAQIQATAN ishlayotgan botga
       olib borsin: token almashtirilsa, nom ham o'zi yangilanadi. */
    try {
      const s = (await store.get('meta/settings')) || {};
      const cur = String((s.bot && s.bot.username) || '').replace(/^@/, '');
      if (me.username && cur.toLowerCase() !== String(me.username).toLowerCase()) {
        s.bot = Object.assign({}, s.bot || {}, { username: me.username });
        await store.set('meta/settings', s);
      }
    } catch (e) { console.error('bot nomi:', e.message); }
    syncBotProfile().catch(e => console.error('bot profili:', e.message));
    poll();
    queueLoop();
  }).catch(e => {
    console.error('  Bot ulanmadi: ' + e.message);
    running = false;
  });
}

function stop() {
  running = false;
  wake();                                     // kutayotgan navbatchi darhol to'xtasin
  timers.forEach(t => clearInterval(t));
  timers = [];
}

/** Sinov uchun: ichki funksiyalarni ochamiz (haqiqiy Telegram ishlatilmaydi) */
function _test(ctx) {
  store = ctx.store; stamp = ctx.stamp; A = ctx.A;
  if (ctx.recordPayment) recordPayment = ctx.recordPayment;
  if (ctx.send) setTransport(ctx.send);
  if (ctx.tg) quizTg = ctx.tg;
  return {
    onMessage, flushQueue, enqueue, remindDebtors, notifyApproved,
    makeCode, normCode, studentByCode, botConf, getState, setState,
    balanceText, attendanceText, scheduleText, daysBetween, KINDS, MAX_TRIES,
    handleLinkFlow, findStudentByChat, notifyStaff,
    startRegistration, handleRegistration, regSrc,
    linkGroupChat, onGroupUpdate, sendToGroup, codesInTitle,
    wake, remindStudy, payStart, payPressed, onBankPost, confirmClaim, PAY_BTN, PAID_BTN,
    ensureQuizBank, quizTick, nextQuiz, quizList, addQuizzes, tashkentNow, quizConf, botProfileTexts,
    /** Sinovda navbatchini qo'lda ishga tushirish/to'xtatish */
    startQueue: function (opts) { running = true; queueLoop(opts); },
    stopQueue: function () { running = false; wake(); }
  };
}

/** ERP dan qo'lda tasdiq: bot ishlamayotgan bo'lsa ham to'lov yoziladi */
function init(ctx) {
  store = ctx.store; stamp = ctx.stamp; A = ctx.A;
  if (ctx.recordPayment) recordPayment = ctx.recordPayment;
}
async function confirmClaimManual(claim, tx) {
  if (!store) throw new Error('Bot moduli ishga tushmagan.');
  return confirmClaim(claim, tx);
}

/** Administrator uchun: viktorina boshqaruvi */
const quiz = {
  list: quizList, add: addQuizzes, conf: quizConf, ensure: ensureQuizBank, slots: QUIZ_SLOTS,
  async sendNext() {
    if (!TOKEN && !quizTg) throw new Error('Bot tokeni yo’q.');
    const conf = await quizConf();
    const q = await nextQuiz();
    if (!q) throw new Error('Savollar yo’q.');
    await sendQuiz(q, conf.channel);
    return q;
  },
  async logs() {
    return (await store.list('tgquizlog/')).map(r => r.data).filter(Boolean)
      .sort((a, b) => String(b.date + b.slot).localeCompare(String(a.date + a.slot))).slice(0, 30);
  }
};
module.exports = { start, stop, setTransport, makeCode, normCode, wake, notifyStaff, sendToGroup, confirmClaimManual, init, _test, quiz };
