'use strict';
/* Kunlik murojaat hisoboti.
   Har kuni soat 19:00 (Toshkent) da ADMINLARGA (bot.staffChats) Telegramga
   umumiy hisobot yuboriladi: bugun nechta murojaat tushdi, manba bo'yicha
   (Telegram bot, Instagram, Target/Meta, Sayt/forma, Daraja testi) nechtadan,
   va so'nggi murojaatlar ro'yxati (ism, telefon, vaqt).

   Hech qanday yangi tizim emas — mavjud `leads/` (murojaatlar) ustidan ishlaydi
   va mavjud `bot.notifyStaff()` orqali yuboradi.

   Sozlamalar (ixtiyoriy env):
     LEAD_REPORT_TIME       — yuborish vaqti, "HH:MM" (standart 19:00)
     LEAD_REPORT_CHECK_MS   — tekshirish oralig'i (standart 60000)
     LEAD_REPORT_WINDOW_MIN — vaqt oynasi, daqiqa (standart 10)                */

const TZ_MS = 5 * 3600 * 1000; // Asia/Tashkent
function tzNow() { return new Date(Date.now() + TZ_MS); }
function todayStr() { return tzNow().toISOString().slice(0, 10); }
function stamp() { return tzNow().toISOString().slice(0, 16).replace('T', ' '); }

const REPORT_TIME = /^\d{1,2}:\d{2}$/.test(String(process.env.LEAD_REPORT_TIME || ''))
  ? process.env.LEAD_REPORT_TIME : '19:00';
const WINDOW_MIN = Number(process.env.LEAD_REPORT_WINDOW_MIN || 10);

function targetMin() {
  const [h, m] = REPORT_TIME.split(':').map(Number);
  return h * 60 + m;
}
function nowMin() { const d = tzNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); }

/** Murojaatni manbaga ajratish: source va src maydonlariga qarab. */
function classify(l) {
  const s = (String(l.source || '') + ' ' + String(l.src || '')).toLowerCase();
  if (/insta/.test(s)) return { key: 'instagram', icon: '📷', name: 'Instagram' };
  if (/target|meta|facebook|\bfb\b|reklama|ads/.test(s)) return { key: 'target', icon: '🎯', name: 'Target (Meta)' };
  if (/\bbot\b|telegram|\btg\b|kanal/.test(s)) return { key: 'telegram', icon: '✈️', name: 'Telegram' };
  if (/daraja/.test(s)) return { key: 'test', icon: '📝', name: 'Daraja testi' };
  if (/forma|sayt|web/.test(s)) return { key: 'web', icon: '🌐', name: 'Sayt / forma' };
  return { key: 'boshqa', icon: '•', name: String(l.source || 'Boshqa').slice(0, 24) };
}
const ORDER = ['telegram', 'instagram', 'target', 'web', 'test', 'boshqa'];

/** Berilgan kun uchun hisobot matni (oddiy matn — notifyStaff HTML-escape qiladi). */
async function buildReport(store, date) {
  date = date || todayStr();
  const leads = (await store.list('leads/')).map(x => x.data).filter(Boolean)
    .filter(l => String(l.createdAt || '').slice(0, 10) === date);

  const lines = [];
  lines.push('📊 Kunlik murojaat hisoboti — ' + date);
  lines.push('Bugun jami: ' + leads.length + ' ta murojaat');

  if (!leads.length) {
    lines.push('');
    lines.push('Bugun hali murojaat tushmadi.');
    return lines.join('\n');
  }

  const newN = leads.filter(l => !l.stage || String(l.stage) === 'yangi').length;
  lines.push('Yangi (aloqa qilinmagan): ' + newN);

  const groups = {};
  leads.forEach(l => {
    const c = classify(l);
    (groups[c.key] = groups[c.key] || { c, n: 0 }).n++;
  });
  lines.push('');
  lines.push('Manbalar bo‘yicha:');
  ORDER.forEach(k => { if (groups[k]) lines.push('  ' + groups[k].c.icon + ' ' + groups[k].c.name + ': ' + groups[k].n); });

  lines.push('');
  lines.push('So‘nggi murojaatlar:');
  leads.slice()
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 15)
    .forEach(l => {
      const c = classify(l);
      const t = String(l.createdAt || '').slice(11, 16);
      lines.push('  ' + c.icon + ' ' + (l.name || '—') + ' · ' + (l.phone || '—') + (t ? ' · ' + t : ''));
    });

  return lines.join('\n');
}

/** Vaqt kelganda bir marta yuboradi (kuniga bir marta). */
async function tick(store) {
  try {
    const diff = nowMin() - targetMin();
    if (diff < 0 || diff >= WINDOW_MIN) return;           // faqat 19:00..19:09 oynasida
    const today = todayStr();
    const st = (await store.get('meta/leadReport')) || {};
    if (st.lastDate === today) return;                    // bugun yuborilgan
    const text = await buildReport(store, today);
    let bot = null;
    try { bot = require('./bot'); } catch (e) { bot = null; }
    let res = { off: true };
    if (bot && typeof bot.notifyStaff === 'function') res = await bot.notifyStaff(text);
    await store.set('meta/leadReport', { lastDate: today, at: stamp(), sent: (res && res.queued) || 0 });
    if (res && res.queued) console.log('  Kunlik murojaat hisoboti yuborildi: ' + res.queued + ' adminga');
  } catch (e) {
    console.error('lead-report:', e.message);
  }
}

let timer = null;
function start(store) {
  if (timer) return timer;
  timer = setInterval(() => { tick(store).catch(() => { }); }, Number(process.env.LEAD_REPORT_CHECK_MS || 60 * 1000));
  if (timer.unref) timer.unref();
  return timer;
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, tick, buildReport, classify, REPORT_TIME };
