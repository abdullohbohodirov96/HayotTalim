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

function addDays(d, n) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
/* «Ko'tarmadi» urinishlari: tugma bilan qayd etilgani yoki (eski yozuvlar) izohdagi so'zlar */
const NOANS_RE = /ko.?tarma(di|yapti|gan|yap)|javob berma|o.?chirilgan|o.?chiq ekan|недоступ|не отвеч|не бер[её]т|trubka olma|aloqa yo.?q/gi;
function noAnswerCount(l) {
  const legacy = (String(l.note || '').match(NOANS_RE) || []).length;
  return Math.max(Number(l.noAnswer) || 0, legacy);
}
function lastNoAnsAt(l) { const g = Array.isArray(l.noAnswerLog) ? l.noAnswerLog : []; return g.length ? String(g[g.length - 1].at || '') : ''; }
/* Oxirgi «ko'tarmadi»dan keyin gaplashilgan bo'lsa (bosqich «yangi/bog'lanildi» dan oldinga siljigan) — ochiq emas */
function reachedAfter(l) {
  const t = lastNoAnsAt(l);
  return (Array.isArray(l.stageLog) ? l.stageLog : []).some(e => (!t || String(e.at) > t) && e.to && !/^(yangi|boglanildi)$/.test(String(e.to)) && e.from);
}
function touchedOn(l, date) {
  const on = x => String(x || '').slice(0, 10) === date;
  return on(l.contactedAt) || on(l.trialBookedAt) ||
    (Array.isArray(l.stageLog) && l.stageLog.some(e => on(e.at))) ||
    (Array.isArray(l.noAnswerLog) && l.noAnswerLog.some(e => on(e.at)));
}
function whatToday(funnels, l, date) {
  const on = x => String(x || '').slice(0, 10) === date;
  const parts = [];
  const moves = (Array.isArray(l.stageLog) ? l.stageLog : []).filter(e => on(e.at) && e.from);
  if (moves.length) {
    const f = funnels.filter(x => x.id === l.funnelId)[0];
    const lab = id => { const st = f && Array.isArray(f.stages) ? f.stages.filter(x => x.id === id)[0] : null; return (st && (st.label || st.name)) || id; };
    parts.push(lab(moves[0].from) + ' → ' + lab(moves[moves.length - 1].to));
  }
  const na = (Array.isArray(l.noAnswerLog) ? l.noAnswerLog : []).filter(e => on(e.at)).length;
  if (na) parts.push('📵 ko‘tarmadi ×' + na + ' (jami ' + noAnswerCount(l) + ')');
  if (l.by || (moves.length && moves[moves.length - 1].by)) parts.push('(' + (moves.length ? moves[moves.length - 1].by : '') + ')');
  return parts.length ? ' · ' + parts.join(' ').replace(/ \(\)$/, '') : '';
}

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

  const X = [];
  /* --- Sinov darsiga yozilganlar (qachon tushganidan qat'i nazar) --- */
  const booked = all.filter(l => String(l.trialBookedAt || '').slice(0, 10) === date)
    .sort((a, b) => String(a.trialBookedAt).localeCompare(String(b.trialBookedAt)));
  X.push('🎯 Bugun sinov darsiga yozildi: ' + booked.length + ' ta');
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(date, -i);
    week.push(d.slice(8, 10) + '.' + d.slice(5, 7) + ': ' + all.filter(l => String(l.trialBookedAt || '').slice(0, 10) === d).length);
  }
  X.push('   7 kun: ' + week.join(' · '));
  booked.forEach((l, i) => {
    const when = l.trialDate ? String(l.trialDate).slice(0, 10).split('-').reverse().slice(0, 2).join('.') + (l.trialTime ? ' ' + l.trialTime : '') : 'sana yo‘q';
    X.push('   ' + (i + 1) + '. ' + cut(l.name || '—', 30) + ' · ' + (l.phone || '—') + ' · dars: ' + when + (l.trialBookedBy ? ' (' + l.trialBookedBy + ')' : ''));
  });
  const tmr = addDays(date, 1);
  const tomorrow = all.filter(l => String(l.trialDate || '').slice(0, 10) === tmr && !l.studentId && /sinov/i.test(String(l.stage || '')));
  if (tomorrow.length) X.push('🗓 Ertaga sinov darsi: ' + tomorrow.length + ' ta — bugun kechqurun eslatma yuboring');

  /* --- Bugun ishlangan (oldingi kunlardan) murojaatlar: holati va raqami --- */
  const worked = all.filter(l => String(l.createdAt || '').slice(0, 10) !== date && touchedOn(l, date));
  if (worked.length) {
    X.push('');
    X.push('🔄 Bugun ishlangan murojaatlar (oldingi kunlardan): ' + worked.length + ' ta');
    worked.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).forEach((l, i) => {
      const si = stageInfo(funnels, l);
      X.push('   ' + (i + 1) + '. ' + cut(l.name || '—', 30) + ' · ' + (l.phone || '—') + ' — ' + si.label + whatToday(funnels, l, date));
    });
  }

  /* --- Telefonni ko'tarmaganlar (ochiq) --- */
  const silent = all.map(l => ({ l, si: stageInfo(funnels, l), n: noAnswerCount(l) }))
    .filter(x => x.n > 0 && x.si.type !== 'won' && x.si.type !== 'lost' && !x.l.studentId && !/sinov/i.test(String(x.l.stage || '')) && !reachedAfter(x.l));
  if (silent.length) {
    X.push('');
    X.push('📵 Telefonni ko‘tarmaganlar (ochiq): ' + silent.length + ' ta');
    const grp = [['1 marta', x => x.n === 1], ['2 marta', x => x.n === 2], ['3–5 marta', x => x.n >= 3 && x.n <= 5], ['6+ marta', x => x.n >= 6]];
    grp.forEach(([name, f]) => {
      const g = silent.filter(f);
      if (!g.length) return;
      X.push('  ▸ ' + name + ': ' + g.length + ' ta');
      g.slice(0, 25).forEach(x => X.push('     • ' + cut(x.l.name || '—', 28) + ' · ' + (x.l.phone || '—') + (x.l.nextContact ? ' · keyingi: ' + String(x.l.nextContact).slice(5).split('-').reverse().join('.') : '')));
      if (g.length > 25) X.push('     … yana ' + (g.length - 25) + ' ta');
    });
    X.push('  👉 1–2 marta: bugun boshqa soatda yana qo‘ng‘iroq + Telegram xabar.');
    X.push('  👉 3–5 marta: ertalab/kechqurun (boshqa vaqt), boshqa xodim nomidan yozish.');
    X.push('  👉 6+ marta: oxirgi Telegram xabar → «Rad etdi: aloqa yo‘q», «yangi guruh ochilganda» ro‘yxatiga.');
  }

  if (!leads.length) { L.push('Bugun yangi murojaat tushmadi.'); L.push(''); L.push(...X); return L.join('\n'); }

  const info = leads.map(l => ({ l, si: stageInfo(funnels, l), c: classify(l) }));
  const ok = info.filter(x => contacted(x.l, x.si));
  const won = info.filter(x => x.si.type === 'won' || x.l.studentId);
  const lost = info.filter(x => x.si.type === 'lost');
  L.push('✅ Bog‘lanildi: ' + ok.length + ' ta');
  L.push('⏳ Bog‘lanilmagan: ' + (leads.length - ok.length) + ' ta');
  if (won.length) L.push('🎓 O‘quvchi bo‘ldi: ' + won.length + ' ta');
  if (lost.length) L.push('❌ Rad etdi: ' + lost.length + ' ta');
  L.push(...X);

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
    const nn = noAnswerCount(l);
    L.push('   Holat: ' + x.si.label + (contacted(l, x.si) ? (l.contactedBy ? ' (' + l.contactedBy + ')' : '') : ' — ⏳ bog‘lanilmagan') + (nn ? ' · 📵 ko‘tarmadi ×' + nn : ''));
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
