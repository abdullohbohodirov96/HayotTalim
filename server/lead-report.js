'use strict';
/* Kunlik murojaat hisoboti.
   Har kuni soat 19:00 (Toshkent) da adminlar va botga ulangan xodimlarga
   (direktor, admin, menejer) to'liq hisobot: bugun nechta murojaat tushdi,
   nechtasi bilan bog'lanildi / bog'lanilmadi, holat bo'yicha (nima dedi),
   manba, kim bog'landi, har bir murojaat izohi bilan va umumiy holat.

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

/* Holat turi: voronka bosqichlari bo'yicha (A.funnelStages bo'lmasa — nomidan) */
function stageInfo(funnels, l) {
  const f = funnels.filter(x => x.id === l.funnelId)[0];
  const stages = f && Array.isArray(f.stages) && f.stages.length ? f.stages : null;
  const st = stages ? stages.filter(x => x.id === l.stage)[0] : null;
  const label = (st && (st.label || st.name)) || String(l.stage || 'yangi');
  const first = stages ? stages[0].id : 'yangi';
  const type = (st && st.type) || (/oquvchi|won/.test(String(l.stage)) ? 'won' : /rad|lost/.test(String(l.stage)) ? 'lost' : '');
  return { label, isFirst: String(l.stage || first) === String(first), type };
}
function contacted(l, si) { return !!(l.contactedAt || l.studentId || !si.isFirst); }
function cut(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }

/** Berilgan kun uchun to'liq hisobot (oddiy matn — notifyStaff HTML-escape qiladi). */
async function buildReport(store, date) {
  date = date || todayStr();
  const funnels = (await store.list('funnels/')).map(x => x.data).filter(Boolean);
  const all = (await store.list('leads/')).map(x => x.data).filter(Boolean);
  const leads = all.filter(l => String(l.createdAt || '').slice(0, 10) === date)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

  const L = [];
  L.push('📊 KUNLIK HISOBOT — ' + date);
  L.push('');
  L.push('📥 Bugun tushgan murojaatlar: ' + leads.length + ' ta');
  if (!leads.length) { L.push('Bugun murojaat tushmadi.'); return L.join('\n'); }

  const info = leads.map(l => ({ l, si: stageInfo(funnels, l), c: classify(l) }));
  const ok = info.filter(x => contacted(x.l, x.si));
  const won = info.filter(x => x.si.type === 'won' || x.l.studentId);
  const lost = info.filter(x => x.si.type === 'lost');
  L.push('✅ Bog‘lanildi: ' + ok.length + ' ta');
  L.push('⏳ Bog‘lanilmagan: ' + (leads.length - ok.length) + ' ta');
  if (won.length) L.push('🎓 O‘quvchi bo‘ldi: ' + won.length + ' ta');
  if (lost.length) L.push('❌ Rad etdi: ' + lost.length + ' ta');

  /* Holatlar bo'yicha: «shunchasi shunaqa dedi» */
  const byStage = {};
  info.forEach(x => { byStage[x.si.label] = (byStage[x.si.label] || 0) + 1; });
  L.push('');
  L.push('📌 Holat bo‘yicha:');
  Object.keys(byStage).sort((a, b) => byStage[b] - byStage[a]).forEach(k => L.push('  • ' + k + ': ' + byStage[k]));

  const groups = {};
  info.forEach(x => { (groups[x.c.key] = groups[x.c.key] || { c: x.c, n: 0 }).n++; });
  L.push('');
  L.push('📣 Manba bo‘yicha:');
  ORDER.forEach(k => { if (groups[k]) L.push('  ' + groups[k].c.icon + ' ' + groups[k].c.name + ': ' + groups[k].n); });

  const byWho = {};
  ok.forEach(x => { const w = x.l.contactedBy || '—'; byWho[w] = (byWho[w] || 0) + 1; });
  if (ok.length && Object.keys(byWho).some(k => k !== '—')) {
    L.push('');
    L.push('👥 Kim bog‘landi:');
    Object.keys(byWho).sort((a, b) => byWho[b] - byWho[a]).forEach(k => L.push('  • ' + k + ': ' + byWho[k]));
  }

  /* Har bir murojaat — izohi bilan */
  L.push('');
  L.push('📝 Murojaatlar (izohi bilan):');
  info.forEach((x, i) => {
    const l = x.l;
    const t = String(l.createdAt || '').slice(11, 16);
    L.push('');
    L.push((i + 1) + '. ' + x.c.icon + ' ' + cut(l.name || '—', 40) + ' · ' + (l.phone || '—') + (t ? ' · ' + t : ''));
    L.push('   Holat: ' + x.si.label + (contacted(l, x.si) ? (l.contactedBy ? ' (' + l.contactedBy + ')' : '') : ' — ⏳ bog‘lanilmagan'));
    const extra = [l.src ? 'Reklama: ' + cut(l.src, 60) : '', l.region ? 'Hudud: ' + l.region : '', l.wantTime ? 'Vaqt: ' + l.wantTime : ''].filter(Boolean).join(' · ');
    if (extra) L.push('   ' + extra);
    if (l.note) L.push('   💬 ' + cut(l.note, 220));
  });

  /* Umumiy: shu kunga qadar ochiq qolgan, bog'lanilmagan murojaatlar */
  const old = all.filter(l => String(l.createdAt || '').slice(0, 10) < date)
    .map(l => ({ l, si: stageInfo(funnels, l) }))
    .filter(x => !contacted(x.l, x.si) && x.si.type !== 'lost' && x.si.type !== 'won');
  const dueToday = all.filter(l => l.nextContact && l.nextContact <= date)
    .map(l => ({ l, si: stageInfo(funnels, l) })).filter(x => x.si.type !== 'won' && x.si.type !== 'lost' && !x.l.studentId);
  L.push('');
  L.push('📈 Umumiy:');
  L.push('  • Konversiya bugun: ' + Math.round(100 * won.length / leads.length) + '% (' + won.length + '/' + leads.length + ')');
  L.push('  • Avvalgi kunlardan bog‘lanilmagan: ' + old.length + ' ta');
  L.push('  • Bugungacha qo‘ng‘iroq qilinishi kerak: ' + dueToday.length + ' ta');
  return L.join('\n');
}

/** Telegram 4096 belgidan uzun xabarni qabul qilmaydi — qatorlar bo'yicha bo'lamiz */
function splitText(text, max) {
  max = max || 3500;
  const parts = []; let cur = '';
  String(text).split('\n').forEach(line => {
    if ((cur + '\n' + line).length > max && cur) { parts.push(cur); cur = line; }
    else cur = cur ? cur + '\n' + line : line;
  });
  if (cur) parts.push(cur);
  return parts;
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
    let sent = 0;
    if (bot && typeof bot.notifyStaff === 'function') {
      const parts = splitText(text);
      for (let i = 0; i < parts.length; i++) {
        const r = await bot.notifyStaff(parts.length > 1 ? parts[i] + (i < parts.length - 1 ? '\n…(davomi)' : '') : parts[i]);
        sent = Math.max(sent, (r && r.queued) || 0);
      }
    }
    await store.set('meta/leadReport', { lastDate: today, at: stamp(), sent });
    if (sent) console.log('  Kunlik murojaat hisoboti yuborildi: ' + sent + ' xodimga');
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

module.exports = { start, stop, tick, buildReport, classify, splitText, REPORT_TIME };
