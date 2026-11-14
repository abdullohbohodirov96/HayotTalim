'use strict';
/**
 * Qayta aloqa eslatmasi: murojaatda «Keyingi bog'lanish» kuni + VAQTI qo'yilgan bo'lsa,
 * mas'ul xodimga Telegram orqali 15 daqiqa oldin va aynan o'sha vaqtda xabar boradi.
 * Mas'ul bo'lmasa — vaqtni qo'ygan xodimga, u ham bo'lmasa — murojaatlar bilan ishlovchi xodimlarga.
 * O'qish xotiradagi nusxadan (baza uyg'onmaydi); yozuv faqat xabar ketganda (meta: leadrem2/...).
 */
const BEFORE_MIN = 15, LATE_MIN = 30;
const sentMem = new Set();

function atMs(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '').slice(0, 10)) || !/^\d{2}:\d{2}$/.test(String(time || ''))) return 0;
  return Date.parse(String(date).slice(0, 10) + 'T' + time + ':00+05:00');
}

async function tick(store, A, bot, nowMs) {
  const now = nowMs || Date.now();
  const leads = (await store.list('leads/')).map(x => x.data).filter(l => l && l.nextContact && l.nextContactTime);
  if (!leads.length) return [];
  const funnels = (await store.list('funnels/')).map(x => x.data).filter(Boolean);
  const users = (await store.list('users/')).map(x => x.data).filter(u => u && u.active !== false);
  const done = [];
  for (const l of leads) {
    const at = atMs(l.nextContact, l.nextContactTime);
    if (!at || now < at - BEFORE_MIN * 60000 || now > at + LATE_MIN * 60000) continue;
    const fn = funnels.filter(f => f.id === (l.funnelId || 'fnl_asosiy'))[0] || (A.DEFAULT_FUNNELS || [])[0];
    const st = fn && A.stageOf ? A.stageOf(fn, l.stage) : null;
    if (st && (st.type === 'won' || st.type === 'lost')) continue;
    const kind = now >= at ? 'at' : 'pre';
    const key = 'leadrem2/' + l.id + '__' + String(l.nextContact).slice(0, 10) + '_' + l.nextContactTime.replace(':', '') + '_' + kind;
    if (sentMem.has(key)) continue;
    if (await store.get(key)) { sentMem.add(key); continue; }
    if (kind === 'pre' && await store.get(key.replace(/_pre$/, '_at'))) { sentMem.add(key); continue; }
    const owner = l.ownerStaffId ? users.filter(u => u.id === l.ownerStaffId || (u.staffId && u.staffId === l.ownerStaffId))[0] : null;
    const setter = !owner && l.remById ? users.filter(u => u.id === l.remById)[0] : null;
    const who = owner || setter;
    const text = (kind === 'pre' ? '⏰ 15 daqiqadan keyin qayta aloqa' : '📞 Qayta aloqa vaqti keldi!') +
      '\nMurojaat: ' + (l.name || '—') + '\nTelefon: ' + (l.phone || '—') + '\nVaqt: ' + String(l.nextContact).slice(0, 10) + ' ' + l.nextContactTime +
      (l.note ? '\nOxirgi izoh: ' + String(l.note).split('\n').pop().slice(0, 300) : '') + (who ? '' : '\n(Mas’ul belgilanmagan)');
    let r = null;
    try {
      if (who) r = await bot.notifyUser(who.id, text);
      if (!who || (r && (r.notLinked || r.off))) await bot.notifyStaff(text + (who ? '\n(' + (who.name || '') + ' Telegram botga ulanmagan)' : ''));
    } catch (e) { continue; }
    await store.set(key, { leadId: l.id, kind, at: new Date(now).toISOString(), to: who ? who.id : 'staff' });
    sentMem.add(key); done.push(key);
  }
  return done;
}
module.exports = { tick, atMs };
