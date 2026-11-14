'use strict';
/* Hozir saytda nechta odam bor — faqat xotirada (bazaga tegmaydi). */
const ALIVE_MS = 2.5 * 60 * 1000;
const seen = new Map();                 // sid → { kind, at }
let day = '', dayIds = new Map();       // sid → kind (bugun)
const tzDate = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

function touch(sid, kind) {
  const now = Date.now();
  seen.set(sid, { kind, at: now });
  const d = tzDate();
  if (d !== day) { day = d; dayIds = new Map(); }
  if (!dayIds.has(sid) || kind !== 'site') dayIds.set(sid, kind);
  if (seen.size > 5000) sweep(now);
}
function sweep(now) { for (const [k, v] of seen) if (now - v.at > ALIVE_MS) seen.delete(k); }
function stats() {
  const now = Date.now(); sweep(now);
  const live = { total: 0, site: 0, kabinet: 0, erp: 0 };
  for (const v of seen.values()) { live.total++; live[v.kind]++; }
  if (tzDate() !== day) { day = tzDate(); dayIds = new Map(); }
  const today = { total: dayIds.size, site: 0, kabinet: 0, erp: 0 };
  for (const k of dayIds.values()) today[k]++;
  return { live, today, since: day };
}
module.exports = { touch, stats };
