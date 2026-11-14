'use strict';
/**
 * Murojaatlarni menejerlar orasida foiz bo'yicha taqsimlash.
 * Sozlama: meta/settings.leadSplit = { enabled: true, rules: [{ userId, pct }] }
 * Hisoblagich: meta/leadsplit = { sig, counts: { userId: n }, total } (mijozga berilmaydi).
 *
 * Usul — «og'irlikli navbat»: har yangi murojaat kimning ulushi eng ko'p
 * kam qolgan bo'lsa, o'shanga beriladi. 80/20 da: A, A, B, A, A, A, A, B ...
 * Shuning uchun kichik sonlarda ham nisbat aniq saqlanadi (tasodifiy emas).
 * Taqsimlash faqat KIMGA MAS'UL ekanini belgilaydi — murojaatlar hammaga ko'rinadi.
 */
let chain = Promise.resolve();

function pick(rules, st) {
  const sum = rules.reduce((a, r) => a + Number(r.pct), 0);
  let best = null, bestD = -Infinity;
  rules.forEach(r => {
    const d = (st.total + 1) * Number(r.pct) / sum - (st.counts[r.userId] || 0);
    if (d > bestD + 1e-9) { bestD = d; best = r; }
  });
  return best;
}

async function activeRules(store) {
  const s = (await store.get('meta/settings')) || {};
  const cfg = s.leadSplit || {};
  if (!cfg.enabled || !Array.isArray(cfg.rules)) return [];
  const users = (await store.list('users/')).map(x => x.data).filter(Boolean);
  return cfg.rules
    .map(r => ({ userId: String(r.userId || ''), pct: Math.max(0, Math.min(100, Number(r.pct) || 0)) }))
    .filter(r => r.pct > 0 && users.some(u => u.id === r.userId && u.active !== false));
}

/** Yangi murojaatga mas'ul tanlaydi (agar hali tanlanmagan bo'lsa). lead obyektini o'zgartirib qaytaradi. */
function assign(store, lead) {
  if (!lead || lead.ownerStaffId) return Promise.resolve(lead);
  const run = chain.then(async () => {
    const rules = await activeRules(store);
    if (!rules.length) return lead;
    const st = (await store.get('meta/leadsplit')) || {};
    const sig = rules.map(r => r.userId + ':' + r.pct).join(',');
    /* Foizlar o'zgarsa — hisob yangidan boshlanadi */
    if (st.sig !== sig || !st.counts) { st.sig = sig; st.counts = {}; st.total = 0; }
    const r = pick(rules, st);
    st.counts[r.userId] = (st.counts[r.userId] || 0) + 1;
    st.total = (st.total || 0) + 1;
    await store.set('meta/leadsplit', st);
    lead.ownerStaffId = r.userId;
    lead.autoAssigned = true;
    return lead;
  });
  chain = run.catch(() => { });
  return run.catch(e => { console.error('leadSplit:', e.message); return lead; });
}

module.exports = { assign, _t: { pick } };
