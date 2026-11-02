/* Darsliklar guruh sur'atida ochiladi.

   Qoida: o'quvchining guruhi N ta dars o'tkazgan bo'lsa, darslikning birinchi
   N ta darsi ochiq. Dars «o'tdi» deb hisoblanadi, qachonki guruh jadvalidagi
   shu kun keldi va dars tugash vaqti (endTime) o'tdi. Bayram/dam olish kunlari
   (holidays/) hisobga kirmaydi.

   O'quvchi darsni tez tugatsa ham, keyingisi guruh darsi tugamaguncha ochilmaydi.
   Guruh oldinga ketsa, o'quvchi orqada qolgan bo'lsa ham o'sha darslar ochilib
   turadi (yetib olishi uchun).

   Natija (pace) faqat o'qish uchun: yozuvga saqlanmaydi (enumerable emas),
   statuses() uni progress.pace dan oladi.

   Guruh topilmasa yoki jadvali to'liq bo'lmasa (boshlanish sanasi, kunlar,
   tugash vaqti) — null: eski qoida (oldingi dars tugagach ochiladi) ishlaydi. */
'use strict';

const TZ_MS = 5 * 3600 * 1000;             // Toshkent vaqti
const LEVEL_RE = /\b(A0|A1|A2|B1|B2|C1|C2)\b/i;

function listCol(store, col) {
  return store.list(col).then(rows => rows
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean));
}

function groupLevel(g, courses) {
  let lv = String(g.level || '').toUpperCase();
  if (!LEVEL_RE.test(lv) && g.courseId) {
    const c = courses.filter(x => x.id === g.courseId)[0];
    lv = String((c && c.level) || '').toUpperCase();
    if (!LEVEL_RE.test(lv) && c) { const m = LEVEL_RE.exec(String(c.name || '')); lv = m ? m[1].toUpperCase() : ''; }
  }
  if (!LEVEL_RE.test(lv)) { const m = LEVEL_RE.exec(String(g.name || '')); lv = m ? m[1].toUpperCase() : ''; }
  return lv;
}

function minutes(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function isoDay(d) { return d.toISOString().slice(0, 10); }
/** 1 = Dushanba … 7 = Yakshanba (guruh shaklidagi raqamlash) */
function weekday(d) { const w = d.getUTCDay(); return w === 0 ? 7 : w; }

function holidayOn(hols, date, groupId) {
  return hols.some(h => h.active !== false &&
    (!h.from || date >= String(h.from)) && (!h.to || date <= String(h.to || h.from)) &&
    (h.scope !== 'guruh' || String(h.groupId) === String(groupId)));
}

/**
 * Guruh jadvali bo'yicha nechta dars o'tgan va keyingisi qachon.
 * @returns {{n:number, next:{date:string,start:string,end:string}|null}|null}
 */
function schedule(g, hols, nowMs) {
  const days = (g.days || []).map(Number).filter(x => x >= 1 && x <= 7);
  const endMin = minutes(g.endTime);
  if (!g.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(g.startDate)) || !days.length || endMin == null) return null;
  const now = new Date((nowMs || Date.now()) + TZ_MS);
  const today = isoDay(now);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const d = new Date(String(g.startDate) + 'T00:00:00Z');
  let n = 0, next = null, guard = 0;
  while (guard++ < 800) {
    const s = isoDay(d);
    if (days.indexOf(weekday(d)) >= 0 && !holidayOn(hols, s, g.id)) {
      const held = s < today || (s === today && nowMin >= endMin);
      if (held) n++;
      else { next = { date: s, start: String(g.startTime || ''), end: String(g.endTime || '') }; break; }
    }
    if (s > today && guard > 400) break;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  /* Ustoz qo'lda ochgan/yopgan darslar (Zoom darslar → Guruhlar) */
  const off = Math.round(Number(g.paceOffset) || 0);
  return { n: Math.max(0, n + off), next };
}

/**
 * O'quvchining shu darajadagi guruhi (A0 → Alifbo, A1 → kurs) sur'ati.
 * @param level 'A0' | 'A1'
 */
async function forStudent(store, sid, level, nowMs) {
  const [mems, groups, courses, hols] = await Promise.all([
    listCol(store, 'memberships'), listCol(store, 'groups'), listCol(store, 'courses'), listCol(store, 'holidays')
  ]);
  const gIds = mems.filter(m => String(m.studentId) === String(sid) && m.status !== 'chiqdi').map(m => m.groupId);
  const mine = groups.filter(g => gIds.indexOf(g.id) >= 0 && g.status !== 'yakunlangan');
  const g = mine.filter(x => groupLevel(x, courses) === level)[0];
  if (!g) return null;
  const s = schedule(g, hols, nowMs);
  if (!s) return null;
  return { n: s.n, next: s.next, groupId: g.id, group: String(g.name || '') };
}

/** Yozuvga pace ni yozilmaydigan (JSON ga chiqmaydigan) qilib qo'shish */
async function attach(store, sid, doc, level) {
  if (!doc) return doc;
  let p = null;
  try { p = await forStudent(store, sid, level); } catch (e) { p = null; }
  Object.defineProperty(doc, 'pace', { value: p, enumerable: false, configurable: true, writable: true });
  return doc;
}

module.exports = { schedule, forStudent, attach, groupLevel };
