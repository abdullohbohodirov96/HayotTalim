/* O'quvchining o'qish faolligi: aqlli lug'at (oraliqli takrorlash), kunlik
   mashqlar, XP, streak, yutuqlar va «Mening rivojlanishim» statistikasi.

   Yozuvlar (barchasi faqat server orqali yoziladi — /api/doc dan yopiq):
     vocab/<id>              — markaz lug'ati: { id, ar, uz, tr, ex, exUz, lessons:[ref], level, active, createdAt, by }
                               ref: 'course:a1-01' (onlayn kurs darsi) yoki 'topic:<id>' (o'quv dasturi darsi)
     svocab/<sid>            — o'quvchining shaxsiy lug'ati: { words: { <wordId>: holat }, migrated }
     vhist/<sid>/<sana>      — shu kundagi takrorlashlar tarixi: { entries: [{ id, g, at, iv }] }
     daily/<sid>/<sana>      — kunlik topshiriqlar: { goals, done, xp:{kalit:XP}, seen:{}, quiz, rl }
     lsum/<sid>              — umumiy: { days:{ sana:{xp,new,rev,ok,again,tq,tqOk,rl} }, total, badges:{}, tqOkTotal }
     skillgrade/<id>         — ustoz bahosi: { studentId, skill, score 0–100, note, at, by }
     meta/learning           — sozlamalar (XP, kunlik qoidalar, yutuq shartlari)

   Qoidalar:
     — sana doim Toshkent vaqti (A.today());
     — XP kalitlari idempotent: bir so'z/savol/mashq uchun kuniga bir marta;
     — bir o'quvchi uchun yozuvlar navbat bilan (mutex) — parallel so'rov ikki marta yozmaydi;
     — natijalar (to'g'ri javob, takrorlash) faqat serverda tekshiriladi.                 */
'use strict';

const crypto = require('crypto');

const VOC = 'vocab/';
const SV = 'svocab/';
const HIST = 'vhist/';
const DAY = 'daily/';
const SUM = 'lsum/';
const SKILL = 'skillgrade/';
const CONF = 'meta/learning';

const LADDER = [1, 3, 7, 14, 30];          // boshlang'ich oraliqlar (kun)
const MATURE_DAYS = 14;                     // shu oraliqdan keyin — «barqaror yodlangan»
const SKILLS = ['vocabulary', 'grammar', 'reading', 'listening', 'writing', 'speaking'];

const DEF = {
  enabled: true,
  xp: { newWord: 5, review: 2, testCorrect: 5, rl: 20, allBonus: 30 },
  daily: { newWords: 5, reviews: 10, test: 5, rl: 1, minXp: 20 },
  badges: { wordMaster: 100, quizMaster: 100, streak7: 7, streak30: 30, streak100: 100 }
};

function clampInt(v, lo, hi, d) { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; }
function txt(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max || 300); }
function addDays(iso, d) { const x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); }
function dayDiff(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
function rid(p) { return (p || '') + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'); }
/** Arabcha matnni solishtirish uchun (harakatlarsiz) — takroriy so'zni aniqlash */
function normAr(t) { return String(t || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim(); }

/* ---------------- Navbat (bir o'quvchi — bir vaqtda bitta yozuv) ---------------- */
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => { });
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
}

/* ---------------- Sozlamalar ---------------- */
async function conf(store) {
  const s = (await store.get(CONF)) || {};
  const out = { enabled: s.enabled !== false, xp: {}, daily: {}, badges: {} };
  Object.keys(DEF.xp).forEach(k => { out.xp[k] = clampInt((s.xp || {})[k], 0, 500, DEF.xp[k]); });
  Object.keys(DEF.daily).forEach(k => { out.daily[k] = clampInt((s.daily || {})[k], 0, 100, DEF.daily[k]); });
  Object.keys(DEF.badges).forEach(k => { out.badges[k] = clampInt((s.badges || {})[k], 1, 10000, DEF.badges[k]); });
  if (out.daily.rl > 1) out.daily.rl = 1;
  return out;
}
async function saveConf(store, body, by) {
  const cur = await conf(store);
  const next = { enabled: body.enabled !== false, xp: {}, daily: {}, badges: {}, updatedBy: by || '' };
  Object.keys(DEF.xp).forEach(k => { next.xp[k] = clampInt((body.xp || {})[k], 0, 500, cur.xp[k]); });
  Object.keys(DEF.daily).forEach(k => { next.daily[k] = clampInt((body.daily || {})[k], 0, 100, cur.daily[k]); });
  Object.keys(DEF.badges).forEach(k => { next.badges[k] = clampInt((body.badges || {})[k], 1, 10000, cur.badges[k]); });
  if (next.daily.rl > 1) next.daily.rl = 1;
  await store.set(CONF, next);
  return conf(store);
}

/* ---------------- Markaz lug'ati ---------------- */
let dictCache = null, dictAt = 0;
function bustDict() { dictCache = null; }

/** Onlayn kursning o'zidagi so'zlar (js/course-a1.js) + markaz kiritgan so'zlar */
async function dictionary(A, store) {
  if (dictCache && Date.now() - dictAt < 60000) return dictCache;
  const out = [], byId = {};
  if (A.Course) {
    A.Course.LESSONS.forEach(l => {
      (l.words || []).forEach((w, k) => {
        const id = 'c-' + l.id + '-' + k;
        const ex = exampleFor(l, w.ar);
        const it = { id, ar: w.ar, uz: w.uz, tr: w.tr || '', ex: ex ? ex.ar : '', exUz: ex ? ex.uz : '',
          lessons: ['course:' + l.id], level: 'A1', builtin: true, oldKey: A.Course.wordKey(l.id, k) };
        out.push(it); byId[id] = it;
      });
    });
  }
  const custom = (await store.list(VOC)).map(r => r.data).filter(w => w && w.id && w.active !== false && w.ar && w.uz);
  custom.forEach(w => {
    const it = { id: w.id, ar: w.ar, uz: w.uz, tr: w.tr || '', ex: w.ex || '', exUz: w.exUz || '',
      lessons: Array.isArray(w.lessons) ? w.lessons.slice(0, 20) : [], level: w.level || '' };
    out.push(it); byId[it.id] = it;
  });
  dictCache = { list: out, byId };
  dictAt = Date.now();
  return dictCache;
}
/** Kurs qissasidan shu so'z qatnashgan gap (misol jumla) */
function exampleFor(lesson, ar) {
  const key = normAr(ar).split(' ')[0];
  if (!key || !lesson.dialog || !lesson.dialog.lines) return null;
  return lesson.dialog.lines.filter(x => normAr(x.ar).indexOf(key) >= 0)[0] || null;
}

/** Admin: so'z qo'shish / tahrirlash. Takroriy (bir xil arabcha + tarjima) so'z yaratilmaydi. */
async function saveWord(A, store, body, by, stamp) {
  const ar = txt(body.ar, 120), uz = txt(body.uz, 200);
  if (!ar || !/[؀-ۿ]/.test(ar)) return { error: 'Arabcha so‘zni kiriting.' };
  if (!uz) return { error: 'O‘zbekcha tarjimasini kiriting.' };
  const lessons = (Array.isArray(body.lessons) ? body.lessons : String(body.lessons || '').split(/[,;\s]+/))
    .map(x => txt(x, 60)).filter(x => /^(course:a1-\d\d|topic:[A-Za-z0-9_-]{1,40})$/.test(x));
  const id = body.id ? txt(body.id, 40) : '';
  const all = (await store.list(VOC)).map(r => r.data).filter(Boolean);
  const dup = all.filter(w => w.id !== id && w.active !== false && normAr(w.ar) === normAr(ar) && txt(w.uz).toLowerCase() === uz.toLowerCase())[0];
  if (dup) {
    /* Bor so'z — faqat yangi darslarni qo'shamiz */
    const merged = Array.from(new Set((dup.lessons || []).concat(lessons)));
    if (merged.length !== (dup.lessons || []).length) { dup.lessons = merged; await store.set(VOC + dup.id, dup); bustDict(); }
    return { ok: true, word: dup, duplicate: true };
  }
  const prev = id ? await store.get(VOC + id) : null;
  if (id && !prev) return { error: 'So‘z topilmadi.', code: 404 };
  const w = Object.assign({}, prev || {}, {
    id: prev ? prev.id : rid('w'), ar, uz, tr: txt(body.tr, 120), ex: txt(body.ex, 400), exUz: txt(body.exUz, 400),
    lessons, level: /^(A0|A1|A2|B1|B2|C1|C2)$/.test(String(body.level || '')) ? body.level : (prev ? prev.level || '' : ''),
    active: body.active !== false, updatedAt: stamp(), by: by || ''
  });
  if (!prev) w.createdAt = stamp();
  await store.set(VOC + w.id, w);
  bustDict();
  return { ok: true, word: w };
}
async function removeWord(store, id) {
  const w = await store.get(VOC + txt(id, 40));
  if (!w) return { error: 'So‘z topilmadi.', code: 404 };
  /* O'quvchilar tarixi buzilmasin — o'chirmaymiz, faolsizlantiramiz */
  w.active = false; await store.set(VOC + w.id, w); bustDict();
  return { ok: true };
}
/** CSV: ar;uz;tr;misol;misol tarjimasi;dars(lar);daraja — sarlavha qatori ixtiyoriy */
function parseCsv(text) {
  const rows = [];
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return rows;
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  function split(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  }
  let start = 0;
  if (!/[؀-ۿ]/.test(split(lines[0])[0] || '')) start = 1;     // sarlavha
  for (let i = start; i < lines.length && rows.length < 2000; i++) {
    const c = split(lines[i]);
    rows.push({ line: i + 1, ar: c[0], uz: c[1], tr: c[2], ex: c[3], exUz: c[4], lessons: c[5], level: c[6] });
  }
  return rows;
}
async function importCsv(A, store, text, by, stamp) {
  const rows = parseCsv(text);
  let added = 0, merged = 0; const errors = [];
  for (const r of rows) {
    const x = await saveWord(A, store, r, by, stamp);
    if (x.error) errors.push(r.line + '-qator: ' + x.error);
    else if (x.duplicate) merged++; else added++;
  }
  return { ok: true, total: rows.length, added, merged, errors: errors.slice(0, 50) };
}

/* ---------------- O'quvchi qaysi darslarni o'rgangan ---------------- */
async function studiedRefs(A, store, sid) {
  const refs = {};
  const cp = await store.get('courseprog/' + sid);
  if (cp && A.Course) {
    const st = A.Course.statuses(cp);
    Object.keys(cp.lessons || {}).forEach(lid => {
      const p = cp.lessons[lid] || {};
      if (st[lid] === 'done' || Object.keys(p.steps || {}).length) refs['course:' + lid] = 1;
    });
  }
  /* O'quv dasturi: o'quvchining faol guruhida o'tilgan darslar (dars jurnali) */
  const mems = (await store.list('memberships/')).map(r => r.data).filter(m => m && m.studentId === sid && m.status !== 'chiqdi');
  if (mems.length) {
    const gids = {}; mems.forEach(m => { gids[m.groupId] = 1; });
    (await store.list('lessonlog/')).map(r => r.data).forEach(l => { if (l && l.topicId && gids[l.groupId]) refs['topic:' + l.topicId] = 1; });
  }
  return refs;
}

/* ---------------- Shaxsiy lug'at ---------------- */
async function getSv(store, sid) {
  const d = (await store.get(SV + sid)) || { studentId: sid, words: {} };
  d.words = d.words || {};
  return d;
}
function newState(today, from) {
  return { addedAt: today, from: from || '', step: 0, ease: 2.5, iv: 0, due: today, reps: 0, lapses: 0, ok: 0, hard: 0, again: 0, last: null };
}
/** Darsda o'tilgan so'zlarni lug'atga qo'shadi (takrorsiz). Eski Leitner natijalari bir marta ko'chiriladi. */
async function sync(A, store, sid, today) {
  const dict = await dictionary(A, store);
  const refs = await studiedRefs(A, store, sid);
  const sv = await getSv(store, sid);
  let changed = false;
  dict.list.forEach(w => {
    if (sv.words[w.id]) return;
    const ref = w.lessons.filter(r => refs[r])[0];
    if (!ref) return;
    sv.words[w.id] = newState(today, ref); changed = true;
  });
  if (!sv.migrated) {
    const cp = await store.get('courseprog/' + sid);
    const old = (cp && cp.vocab) || {};
    dict.list.forEach(w => {
      const o = w.oldKey && old[w.oldKey];
      if (!o) return;
      const s = sv.words[w.id] || (sv.words[w.id] = newState(today, w.lessons[0]));
      if (s.reps) return;
      const step = Math.max(0, Math.min(LADDER.length, o.b || 0));
      s.step = step; s.iv = step ? LADDER[step - 1] : 0; s.reps = (o.ok || 0) + (o.bad || 0);
      s.ok = o.ok || 0; s.again = o.bad || 0; s.due = o.due || today; s.last = o.seen || null;
    });
    sv.migrated = true; changed = true;
  }
  if (changed) await store.set(SV + sid, sv);
  return { sv, dict };
}

/** Oraliqli takrorlash: g = 0 (bilmadim) | 1 (qiynalib esladim) | 2 (oson esladim) */
function schedule(s, g, today) {
  const n = Object.assign({}, s);
  n.reps = (n.reps || 0) + 1; n.last = today;
  if (g === 0) {
    n.lapses = (n.lapses || 0) + 1; n.again = (n.again || 0) + 1;
    n.ease = Math.max(1.3, +(n.ease - 0.2).toFixed(2));
    n.step = 0; n.iv = 1;                                   // unutdi — ertaga yana
  } else if (g === 1) {
    n.hard = (n.hard || 0) + 1;
    n.ease = Math.max(1.3, +(n.ease - 0.15).toFixed(2));
    const base = n.step ? LADDER[Math.min(n.step, LADDER.length) - 1] : 1;
    n.iv = Math.max(1, Math.round(Math.max(base, n.iv || 0) * 1.2 * (n.ease / 2.5)));
    if (!n.step) n.step = 1;                                // shu bosqichda qoladi
  } else {
    n.ok = (n.ok || 0) + 1;
    n.step = (n.step || 0) + 1;
    n.ease = Math.min(3.0, +(n.ease + 0.1).toFixed(2));
    const base = n.step <= LADDER.length ? LADDER[n.step - 1] : Math.round((n.iv || 30) * n.ease);
    n.iv = Math.max(1, Math.round(base * (n.ease / 2.6)));  // ease 2.6 da — aynan 1 → 3 → 7 → 14 → 30
  }
  n.iv = Math.min(n.iv, 365);
  n.due = addDays(today, n.iv);
  return n;
}
function wordStatus(s, today) {
  if (!s.reps) return 'yangi';
  if (s.iv >= MATURE_DAYS && s.lapses * 3 <= s.reps) return 'barqaror';
  if (s.due <= today) return 'takrorlash';
  return 'organilmoqda';
}

/** O'quvchiga lug'at: so'zlar (holati bilan) va hisob */
async function vocabView(A, store, sid, today) {
  const { sv, dict } = await sync(A, store, sid, today);
  const lessonTitle = await lessonTitles(A, store);
  const words = Object.keys(sv.words).map(id => {
    const w = dict.byId[id]; if (!w) return null;
    const s = sv.words[id];
    const ref = s.from || w.lessons[0] || '';
    return { id, ar: w.ar, uz: w.uz, tr: w.tr, ex: w.ex, exUz: w.exUz, lesson: ref, lessonTitle: lessonTitle[ref] || '',
      status: wordStatus(s, today), due: s.due, iv: s.iv, reps: s.reps, lapses: s.lapses, addedAt: s.addedAt, last: s.last };
  }).filter(Boolean);
  const cnt = { total: words.length, yangi: 0, takrorlash: 0, organilmoqda: 0, barqaror: 0 };
  words.forEach(w => { cnt[w.status]++; });
  cnt.learned = cnt.total - cnt.yangi;
  return { words, counts: cnt, today };
}
async function lessonTitles(A, store) {
  const t = {};
  if (A.Course) A.Course.LESSONS.forEach(l => { t['course:' + l.id] = l.n + '-dars · ' + l.title; });
  (await store.list('topics/')).map(r => r.data).forEach(x => { if (x && x.id) t['topic:' + x.id] = x.title || ''; });
  return t;
}

/** Kartochkalar to'plami: avval muddati kelganlar, keyin yangi so'zlar */
async function deck(A, store, sid, today, opts) {
  const { sv, dict } = await sync(A, store, sid, today);
  const c = await conf(store);
  const day = await getDay(store, sid, today, c, sv);
  const ids = Object.keys(sv.words).filter(id => dict.byId[id]);
  const due = ids.filter(id => sv.words[id].reps && sv.words[id].due <= today)
    .sort((a, b) => String(sv.words[a].due).localeCompare(String(sv.words[b].due)));
  const fresh = ids.filter(id => !sv.words[id].reps);
  const newLeft = Math.max(0, Math.max(c.daily.newWords, 5) * 2 - (day.done.newWords || 0));
  let pick = due.slice(0, 30).concat(fresh.slice(0, Math.min(newLeft, 10)));
  if (opts && opts.extra && !pick.length) {
    pick = ids.filter(id => sv.words[id].reps).sort(() => Math.random() - .5).slice(0, 10);
  }
  return {
    cards: pick.slice(0, 30).map(id => {
      const w = dict.byId[id], s = sv.words[id];
      return { id, ar: w.ar, uz: w.uz, tr: w.tr, ex: w.ex, exUz: w.exUz, isNew: !s.reps, iv: s.iv,
        preview: [0, 1, 2].map(g => schedule(s, g, today).iv) };
    })
  };
}

/** Kartochka javoblari (serverda hisoblanadi) */
async function review(A, store, sid, items, today, stamp) {
  return withLock(sid, async () => {
    const { sv } = await sync(A, store, sid, today);
    const c = await conf(store);
    const day = await getDay(store, sid, today, c, sv);
    const hist = (await store.get(HIST + sid + '/' + today)) || { entries: [] };
    let saved = 0;
    (Array.isArray(items) ? items : []).slice(0, 60).forEach(it => {
      const id = txt(it && it.id, 60), g = Number(it && it.g);
      if (!sv.words[id] || [0, 1, 2].indexOf(g) < 0) return;
      const s = sv.words[id];
      const wasNew = !s.reps;
      sv.words[id] = schedule(s, g, today);
      hist.entries.push({ id, g, at: stamp(), iv: sv.words[id].iv });
      day.stat.reviews = (day.stat.reviews || 0) + 1;
      if (g === 0) day.stat.again = (day.stat.again || 0) + 1; else day.stat.ok = (day.stat.ok || 0) + 1;
      /* XP va kunlik topshiriq: bir so'z — kuniga bir marta */
      if (wasNew) {
        if (!day.seen['n:' + id]) { day.seen['n:' + id] = 1; day.done.newWords = (day.done.newWords || 0) + 1; award(day, 'new:' + id, c.xp.newWord); }
      } else if (!day.seen['r:' + id] && !day.seen['n:' + id]) {
        day.seen['r:' + id] = 1; day.done.reviews = (day.done.reviews || 0) + 1; award(day, 'rev:' + id, c.xp.review);
      }
      saved++;
    });
    if (hist.entries.length > 2000) hist.entries = hist.entries.slice(-2000);
    finishDay(day, c);
    await store.set(SV + sid, sv);
    await store.set(HIST + sid + '/' + today, hist);
    await putDay(store, sid, day);
    const sum = await updateSum(A, store, sid, day, c);
    return { ok: true, saved, day: dayPublic(day), xpTotal: sum.total, streak: streakOf(sum, today, c) };
  });
}

/* ---------------- Kunlik topshiriqlar ---------------- */
function award(day, key, amount) {
  if (day.xp[key] != null) return 0;
  day.xp[key] = amount; return amount;
}
async function getDay(store, sid, today, c, sv, level) {
  let d = await store.get(DAY + sid + '/' + today);
  if (d) { d.xp = d.xp || {}; d.seen = d.seen || {}; d.done = d.done || {}; d.stat = d.stat || {}; return d; }
  /* Maqsadlar kun boshida o'quvchining lug'atiga qarab belgilanadi */
  const words = sv ? Object.keys(sv.words).map(k => sv.words[k]) : [];
  const fresh = words.filter(s => !s.reps).length, seen = words.filter(s => s.reps).length;
  const pool = words.length;
  const a0 = level === 'A0';
  d = {
    studentId: sid, date: today,
    goals: {
      newWords: Math.min(c.daily.newWords, fresh),
      reviews: Math.min(c.daily.reviews, seen),
      test: (pool >= 4 || a0) ? c.daily.test : 0,
      rl: (pool >= 4 || a0) ? c.daily.rl : 0
    },
    done: {}, xp: {}, seen: {}, stat: {}, a0
  };
  return d;
}
async function putDay(store, sid, day) { await store.set(DAY + sid + '/' + day.date, day); }
function taskDone(day, k) { return day.goals[k] > 0 && (day.done[k] || 0) >= day.goals[k]; }
function finishDay(day, c) {
  const ks = Object.keys(day.goals).filter(k => day.goals[k] > 0);
  if (ks.length && ks.every(k => taskDone(day, k))) award(day, 'bonus', c.xp.allBonus);
}
function dayXp(day) { return Object.keys(day.xp || {}).reduce((s, k) => s + (Number(day.xp[k]) || 0), 0); }
function dayPublic(day) {
  return { date: day.date, goals: day.goals, done: day.done, xp: dayXp(day), bonus: day.xp.bonus != null,
    quizOpen: !!(day.quiz && day.quiz.qs && Object.keys(day.quiz.ans || {}).length < day.quiz.qs.length),
    rlDone: taskDone(day, 'rl') };
}

/** Kunlik test: 5 savol (o'quvchining so'zlari yoki A0 alifbosi). Javob faqat serverda. */
async function quizStart(A, store, sid, today, level) {
  return withLock(sid, async () => {
    const { sv, dict } = await sync(A, store, sid, today);
    const c = await conf(store);
    const day = await getDay(store, sid, today, c, sv, level);
    if (!day.goals.test) return { error: 'Bugun test uchun so‘zlar hali yetarli emas.', code: 400 };
    if (day.quiz && day.quiz.qs && Object.keys(day.quiz.ans || {}).length < day.quiz.qs.length) {
      await putDay(store, sid, day);
      return { ok: true, quiz: quizPublic(day.quiz) };
    }
    const n = Math.max(1, day.goals.test);
    const qs = level === 'A0' ? await a0Questions(A, store, sid, n, 'test') : wordQuestions(sv, dict, n, false);
    if (!qs.length) return { error: 'Savol tuzib bo‘lmadi.', code: 400 };
    day.quiz = { id: rid('q'), qs, ans: {} };
    await putDay(store, sid, day);
    return { ok: true, quiz: quizPublic(day.quiz) };
  });
}
function quizPublic(q) {
  return { id: q.id, qs: q.qs.map((x, i) => ({ i, prompt: x.prompt, show: x.show || '', say: x.say || '', optionsAr: !!x.optionsAr,
    options: x.options, answered: q.ans[i] != null ? { pick: q.ans[i], right: x.answer } : null })) };
}
async function quizAnswer(A, store, sid, today, body) {
  return withLock(sid, async () => {
    const c = await conf(store);
    const day = await store.get(DAY + sid + '/' + today);
    if (!day || !day.quiz || day.quiz.id !== String(body.quizId || '')) return { error: 'Test eskirgan — qaytadan boshlang.', code: 409 };
    day.xp = day.xp || {}; day.done = day.done || {}; day.stat = day.stat || {}; day.seen = day.seen || {};
    const i = Number(body.i), q = day.quiz.qs[i];
    if (!q) return { error: 'Savol topilmadi.', code: 400 };
    if (day.quiz.ans[i] != null) return { ok: true, right: q.answer, correct: day.quiz.ans[i] === q.answer, repeat: true, day: dayPublic(day) };
    const pick = Number(body.pick);
    day.quiz.ans[i] = pick;
    const correct = pick === q.answer;
    day.stat.tq = (day.stat.tq || 0) + 1;
    if (correct) { day.stat.tqOk = (day.stat.tqOk || 0) + 1; award(day, 'q:' + day.quiz.id + ':' + i, c.xp.testCorrect); }
    /* Topshiriq: 5 ta savolga javob berish (to'g'ri bo'lishi shart emas, XP — faqat to'g'risiga) */
    day.done.test = Math.min(day.goals.test, (day.done.test || 0) + 1);
    if (q.skill) { day.stat['sk_' + q.skill] = (day.stat['sk_' + q.skill] || 0) + 1; if (correct) day.stat['skOk_' + q.skill] = (day.stat['skOk_' + q.skill] || 0) + 1; }
    finishDay(day, c);
    await putDay(store, sid, day);
    const sum = await updateSum(A, store, sid, day, c);
    return { ok: true, right: q.answer, correct, day: dayPublic(day), xpTotal: sum.total, streak: streakOf(sum, today, c) };
  });
}

/** Reading / Listening mashqi: 5 ta topshiriq, ≥ 60% — bajarildi (XP bir marta) */
async function rlStart(A, store, sid, today, level) {
  return withLock(sid, async () => {
    const { sv, dict } = await sync(A, store, sid, today);
    const c = await conf(store);
    const day = await getDay(store, sid, today, c, sv, level);
    if (!day.goals.rl) return { error: 'Bugun mashq uchun so‘zlar hali yetarli emas.', code: 400 };
    const qs = level === 'A0' ? await a0Questions(A, store, sid, 5, 'listen') : wordQuestions(sv, dict, 5, true);
    if (!qs.length) return { error: 'Mashq tuzib bo‘lmadi.', code: 400 };
    day.rl = { id: rid('r'), qs, at: Date.now() };
    await putDay(store, sid, day);
    return { ok: true, rl: { id: day.rl.id, qs: qs.map((x, i) => ({ i, kind: x.skill, prompt: x.prompt, show: x.show || '', say: x.say || '', optionsAr: !!x.optionsAr, options: x.options })) } };
  });
}
async function rlSubmit(A, store, sid, today, body) {
  return withLock(sid, async () => {
    const c = await conf(store);
    const day = await store.get(DAY + sid + '/' + today);
    if (!day || !day.rl || day.rl.id !== String(body.rlId || '')) return { error: 'Mashq eskirgan — qaytadan boshlang.', code: 409 };
    day.xp = day.xp || {}; day.done = day.done || {}; day.stat = day.stat || {}; day.seen = day.seen || {};
    const ans = Array.isArray(body.answers) ? body.answers : [];
    let ok = 0;
    const res = day.rl.qs.map((q, i) => { const r = Number(ans[i]) === q.answer; if (r) ok++;
      day.stat['sk_' + q.skill] = (day.stat['sk_' + q.skill] || 0) + 1; if (r) day.stat['skOk_' + q.skill] = (day.stat['skOk_' + q.skill] || 0) + 1;
      return { right: q.answer, correct: r }; });
    const percent = Math.round(ok * 100 / day.rl.qs.length);
    day.stat.rlTries = (day.stat.rlTries || 0) + 1;
    day.stat.rlBest = Math.max(day.stat.rlBest || 0, percent);
    const passed = percent >= 60;
    if (passed) { day.done.rl = 1; award(day, 'rl', c.xp.rl); }
    day.rl = null;                                     // bir mashq — bir yuborish
    finishDay(day, c);
    await putDay(store, sid, day);
    const sum = await updateSum(A, store, sid, day, c);
    return { ok: true, percent, passed, results: res, day: dayPublic(day), xpTotal: sum.total, streak: streakOf(sum, today, c) };
  });
}

function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }
/** So'zlar bo'yicha savollar. rl=true bo'lsa — tinglash va o'qish (misol jumla) */
function wordQuestions(sv, dict, n, rl) {
  const mine = Object.keys(sv.words).filter(id => dict.byId[id]);
  const seen = mine.filter(id => sv.words[id].reps);
  const pool = shuffle(seen.length >= n ? seen : mine).slice(0, n);
  const all = mine.length >= 4 ? mine : dict.list.map(w => w.id);
  return pool.map((id, k) => {
    const w = dict.byId[id];
    const others = shuffle(all.filter(x => x !== id && dict.byId[x] && dict.byId[x].uz !== w.uz)).slice(0, 3).map(x => dict.byId[x]);
    if (others.length < 2) return null;
    const kind = rl ? (w.ex && k % 2 ? 'reading' : 'listening') : (k % 3 === 2 ? 'uz2ar' : 'ar2uz');
    const opts = shuffle([w].concat(others));
    const q = { answer: opts.indexOf(w), skill: kind === 'reading' ? 'reading' : kind === 'listening' ? 'listening' : 'vocabulary' };
    if (kind === 'uz2ar') { q.prompt = '«' + w.uz + '» — arabchasi qaysi?'; q.options = opts.map(x => x.ar); q.optionsAr = true; }
    else if (kind === 'listening') { q.prompt = 'Tinglang va ma’nosini tanlang'; q.say = w.ar; q.options = opts.map(x => x.uz); }
    else if (kind === 'reading') { q.prompt = 'Gapni o‘qing: belgilangan so‘zning ma’nosi?'; q.show = w.ex; q.mark = w.ar; q.options = opts.map(x => x.uz); }
    else { q.prompt = 'Ma’nosini tanlang'; q.show = w.ar; q.options = opts.map(x => x.uz); }
    return q;
  }).filter(Boolean);
}
/** A0 (alifbo) o'quvchisi: o'tilgan darslardan savollar */
async function a0Questions(A, store, sid, n, kind) {
  const F = A.Alifbo; if (!F) return [];
  const doc = (await store.get('alifprog/' + sid)) || { lessons: {} };
  const st = F.statuses(doc);
  const open = F.LESSONS.filter(l => st[l.id] !== 'locked');
  if (!open.length) return [];
  const qs = [];
  shuffle(open).forEach(l => {
    if (qs.length >= n * 3) return;
    F.buildTest(l, rid('s')).forEach(q => { if (q && q.options && q.answer != null) qs.push(q); });
  });
  const pick = shuffle(qs.filter(q => kind !== 'listen' || q.audio)).concat(shuffle(qs.filter(q => kind === 'listen' && !q.audio)));
  return pick.slice(0, n).map(q => ({
    prompt: q.prompt, show: q.show || '', say: q.audio ? q.audio : '', options: q.options, optionsAr: !!q.optionsAr,
    answer: typeof q.answer === 'number' ? q.answer : q.options.indexOf(q.answer), skill: q.audio ? 'listening' : 'reading'
  })).filter(q => q.answer >= 0);
}

/* ---------------- XP, streak, yutuqlar ---------------- */
async function updateSum(A, store, sid, day, c) {
  const sum = (await store.get(SUM + sid)) || { studentId: sid, days: {}, badges: {} };
  sum.days = sum.days || {}; sum.badges = sum.badges || {};
  /* Shu kunning yozuvi kun hujjatidan QAYTA hisoblanadi — necha marta chaqirilsa ham bir xil */
  sum.days[day.date] = {
    xp: dayXp(day), new: day.done.newWords || 0, rev: day.done.reviews || 0,
    reviews: day.stat.reviews || 0, ok: day.stat.ok || 0, again: day.stat.again || 0,
    tq: day.stat.tq || 0, tqOk: day.stat.tqOk || 0, rl: day.done.rl ? 1 : 0, rlBest: day.stat.rlBest || 0,
    sk: Object.keys(day.stat).filter(k => /^sk(Ok)?_/.test(k)).reduce((o, k) => { o[k] = day.stat[k]; return o; }, {})
  };
  sum.total = Object.keys(sum.days).reduce((s, d) => s + (sum.days[d].xp || 0), 0);
  sum.tqOkTotal = Object.keys(sum.days).reduce((s, d) => s + (sum.days[d].tqOk || 0), 0);
  const st = streakOf(sum, day.date, c);
  sum.bestStreak = Math.max(sum.bestStreak || 0, st.best);
  /* Yutuqlar — shartlar bajarilgan kuni bir marta beriladi va qaytarib olinmaydi */
  const sv = await getSv(store, sid);
  const mature = Object.keys(sv.words).filter(k => wordStatus(sv.words[k], day.date) === 'barqaror').length;
  const anyWork = Object.keys(sum.days).some(d => sum.days[d].reviews || sum.days[d].tq || sum.days[d].rl);
  const conds = {
    firstStep: anyWork,
    wordMaster: mature >= c.badges.wordMaster,
    streak7: sum.bestStreak >= c.badges.streak7,
    streak30: sum.bestStreak >= c.badges.streak30,
    quizMaster: sum.tqOkTotal >= c.badges.quizMaster,
    streak100: sum.bestStreak >= c.badges.streak100
  };
  Object.keys(conds).forEach(k => { if (conds[k] && !sum.badges[k]) sum.badges[k] = day.date; });
  await store.set(SUM + sid, sum);
  return sum;
}
/** Streak: kunlik minimal XP ni bajargan ketma-ket kunlar (Toshkent sanasi bo'yicha) */
function streakOf(sum, today, c) {
  const min = Math.max(1, c.daily.minXp);
  const active = d => !!(sum.days && sum.days[d] && sum.days[d].xp >= min);
  let cur = 0, d = active(today) ? today : addDays(today, -1);
  while (active(d)) { cur++; d = addDays(d, -1); }
  /* Eng uzun streak — butun tarix bo'yicha */
  const days = Object.keys(sum.days || {}).filter(active).sort();
  let best = 0, run = 0, prev = null;
  days.forEach(x => { run = prev && dayDiff(prev, x) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x; });
  return { current: cur, best: Math.max(best, sum.bestStreak || 0), todayDone: active(today), minXp: min };
}
const BADGES = [
  { id: 'firstStep', title: 'Birinchi qadam', about: 'Birinchi mashq bajarildi', icon: '👣' },
  { id: 'wordMaster', title: 'So‘z ustasi', about: 'N ta so‘z barqaror yodlandi', icon: '📚' },
  { id: 'streak7', title: '7 kunlik streak', about: 'N kun ketma-ket mashq', icon: '🔥' },
  { id: 'streak30', title: '30 kunlik streak', about: 'N kun ketma-ket mashq', icon: '🏅' },
  { id: 'quizMaster', title: 'Test ustasi', about: 'N ta to‘g‘ri javob', icon: '🎯' },
  { id: 'streak100', title: 'Sabr chempioni', about: 'N kun ketma-ket mashq', icon: '🏆' }
];
function badgeList(sum, c) {
  return BADGES.map(b => ({ id: b.id, title: b.title, icon: b.icon, about: b.about.replace('N', c.badges[b.id] || ''), at: (sum.badges || {})[b.id] || null }));
}

/** «Kunlik mashqlar» sahifasi */
async function dailyView(A, store, sid, today, level) {
  return withLock(sid, async () => {
    const { sv } = await sync(A, store, sid, today);
    const c = await conf(store);
    const day = await getDay(store, sid, today, c, sv, level);
    if (!(await store.get(DAY + sid + '/' + today))) await putDay(store, sid, day);   // maqsadlar kun boshida qotadi
    const sum = (await store.get(SUM + sid)) || { days: {}, badges: {} };
    const last7 = [];
    for (let i = 6; i >= 0; i--) { const d = addDays(today, -i); last7.push({ date: d, xp: ((sum.days || {})[d] || {}).xp || 0 }); }
    return { enabled: c.enabled, rules: c.xp, minXp: c.daily.minXp, day: dayPublic(day), xpTotal: sum.total || 0,
      streak: streakOf(sum, today, c), last7, badges: badgeList(sum, c), a0: level === 'A0' };
  });
}

/* ---------------- «Mening rivojlanishim» ---------------- */
function weekOf(iso) { const d = new Date(iso + 'T00:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10); }
async function progress(A, store, sid, today, level) {
  const c = await conf(store);
  const vv = await vocabView(A, store, sid, today);
  const sum = (await store.get(SUM + sid)) || { days: {}, badges: {} };
  const days = sum.days || {};
  /* Kurs: A0 (alifbo) yoki A1 (onlayn kurs) */
  let course = null, tests = [], hw = { submitted: 0, accepted: 0, returned: 0, pending: 0, total: 0 }, stepDates = [];
  if (level === 'A0' && A.Alifbo) {
    const doc = (await store.get('alifprog/' + sid)) || { lessons: {} };
    const v = A.Alifbo.view(doc);
    course = { code: 'A0', title: 'A0 — o‘qish va yozish (alifbo)', done: v.done, total: v.total };
    v.lessons.forEach(l => {
      if (l.best != null) tests.push({ label: l.n + '-dars', percent: l.best });
      if (l.hw) { hw.submitted++; if (l.hw.ok) hw.accepted++; }
    });
    hw.total = v.total;
    Object.keys(doc.lessons || {}).forEach(k => { const st = doc.lessons[k].steps || {}; Object.keys(st).forEach(s => { if (typeof st[s] === 'string') stepDates.push(st[s].slice(0, 10)); }); });
  } else if (A.Course) {
    const doc = (await store.get('courseprog/' + sid)) || { lessons: {} };
    const v = A.Course.buildView(doc, today);
    const done = v.lessons.filter(l => l.status === 'done').length;
    course = { code: 'A1', title: v.course.title, done, total: v.lessons.length };
    v.lessons.forEach(l => {
      if (l.testBest != null) tests.push({ label: l.n + '-dars', percent: l.testBest });
      if (l.hw && l.hw.submittedAt) { hw.submitted++; if (l.hw.status === 'qabul') hw.accepted++; else if (l.hw.status === 'qayta') hw.returned++; else hw.pending++; }
    });
    hw.total = v.lessons.length;
    Object.keys(doc.lessons || {}).forEach(k => { const st = doc.lessons[k].steps || {}; Object.keys(st).forEach(s => { if (typeof st[s] === 'string') stepDates.push(st[s].slice(0, 10)); }); });
  }
  if (course) course.percent = course.total ? Math.round(course.done * 100 / course.total) : 0;
  /* Kunlik faollik: XP + bajarilgan dars bosqichlari */
  const stepsByDay = {}; stepDates.forEach(d => { stepsByDay[d] = (stepsByDay[d] || 0) + 1; });
  const act = n => { const out = []; for (let i = n - 1; i >= 0; i--) { const d = addDays(today, -i); const x = days[d] || {}; out.push({ date: d, xp: x.xp || 0, reviews: x.reviews || 0, tq: x.tq || 0, steps: stepsByDay[d] || 0 }); } return out; };
  /* Haftalar bo'yicha o'zlashtirish: takrorlashda eslab qolish ulushi */
  const weeks = {};
  Object.keys(days).forEach(d => { if (dayDiff(d, today) > 84) return; const w = weekOf(d); const x = weeks[w] || (weeks[w] = { ok: 0, all: 0, tqOk: 0, tq: 0 }); x.ok += days[d].ok || 0; x.all += days[d].reviews || 0; x.tqOk += days[d].tqOk || 0; x.tq += days[d].tq || 0; });
  const weekly = Object.keys(weeks).sort().map(w => ({ week: w, recall: weeks[w].all ? Math.round(weeks[w].ok * 100 / weeks[w].all) : null, test: weeks[w].tq ? Math.round(weeks[w].tqOk * 100 / weeks[w].tq) : null }));
  /* Lug'at boyligining o'sishi (so'z qo'shilgan sanalar bo'yicha) */
  const added = {}; vv.words.forEach(w => { if (w.reps) { const d = w.addedAt || today; added[d] = (added[d] || 0) + 1; } });
  let acc = 0; const growth = []; const start = addDays(today, -29);
  Object.keys(added).filter(d => d < start).forEach(d => { acc += added[d]; });
  for (let i = 29; i >= 0; i--) { const d = addDays(today, -i); acc += added[d] || 0; growth.push({ date: d, words: acc }); }
  /* Kunlik test natijalari */
  const quiz = Object.keys(days).sort().filter(d => days[d].tq).slice(-30).map(d => ({ date: d, percent: Math.round(days[d].tqOk * 100 / days[d].tq) }));
  const streak = streakOf(sum, today, c);
  return {
    level, course, today,
    vocab: vv.counts, tests, quiz, homework: hw,
    xpTotal: sum.total || 0, streak, badges: badgeList(sum, c),
    activity7: act(7), activity30: act(30), weekly, growth,
    skills: await skills(store, sid, days, tests)
  };
}
/** Ko'nikmalar: faqat haqiqiy baholash bo'lsa foiz; bo'lmasa — «hali baholanmagan» */
async function skills(store, sid, days, tests) {
  const tot = {}; Object.keys(days).forEach(d => { const sk = days[d].sk || {}; Object.keys(sk).forEach(k => { tot[k] = (tot[k] || 0) + sk[k]; }); });
  let rev = 0, ok = 0; Object.keys(days).forEach(d => { rev += days[d].reviews || 0; ok += days[d].ok || 0; });
  const grades = (await store.list(SKILL)).map(r => r.data).filter(g => g && g.studentId === sid);
  const lastGrade = {};
  grades.sort((a, b) => String(a.at).localeCompare(String(b.at))).forEach(g => { lastGrade[g.skill] = g; });
  const pct = (a, b) => b ? Math.round(a * 100 / b) : null;
  const MIN = 5;
  const auto = {
    vocabulary: (rev + (tot.sk_vocabulary || 0)) >= MIN ? { score: pct(ok + (tot.skOk_vocabulary || 0), rev + (tot.sk_vocabulary || 0)), basis: (rev + (tot.sk_vocabulary || 0)) + ' ta javob' } : null,
    reading: (tot.sk_reading || 0) >= MIN ? { score: pct(tot.skOk_reading, tot.sk_reading), basis: tot.sk_reading + ' ta o‘qish topshirig‘i' } : null,
    listening: (tot.sk_listening || 0) >= MIN ? { score: pct(tot.skOk_listening, tot.sk_listening), basis: tot.sk_listening + ' ta tinglash topshirig‘i' } : null,
    grammar: tests.length >= 2 ? { score: Math.round(tests.reduce((s, t) => s + t.percent, 0) / tests.length), basis: tests.length + ' ta dars testi' } : null
  };
  return SKILLS.map(k => {
    const g = lastGrade[k];
    if (g) return { id: k, score: g.score, basis: 'ustoz bahosi · ' + String(g.at).slice(0, 10), by: 'teacher' };
    if (auto[k]) return { id: k, score: auto[k].score, basis: auto[k].basis, by: 'auto' };
    return { id: k, score: null, basis: 'Hali baholanmagan' };
  });
}
async function setSkillGrade(store, body, by, stamp) {
  const skill = String(body.skill || '');
  if (SKILLS.indexOf(skill) < 0) return { error: 'Ko‘nikma noto‘g‘ri.' };
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) return { error: 'Baho 0–100 oralig‘ida bo‘lsin.' };
  const g = { id: rid('sg'), studentId: txt(body.studentId, 40), skill, score: Math.round(score), note: txt(body.note, 300), at: stamp(), by: by || '' };
  await store.set(SKILL + g.id, g);
  return { ok: true, grade: g };
}

/* ---------------- Ustoz va admin ---------------- */
/** Bir nechta o'quvchi bo'yicha qisqa statistika */
async function staffRows(A, store, sids, today) {
  const c = await conf(store);
  const dict = await dictionary(A, store);
  const rows = [];
  for (const sid of sids) {
    const sum = (await store.get(SUM + sid)) || { days: {} };
    const sv = await getSv(store, sid);
    const days = sum.days || {};
    const active7 = Object.keys(days).filter(d => dayDiff(d, today) < 7 && dayDiff(d, today) >= 0 && (days[d].xp || 0) > 0).length;
    const lastActive = Object.keys(days).filter(d => (days[d].xp || 0) > 0 || days[d].reviews).sort().pop() || null;
    const ws = Object.keys(sv.words).map(k => ({ id: k, s: sv.words[k] }));
    const learned = ws.filter(x => x.s.reps).length, mature = ws.filter(x => wordStatus(x.s, today) === 'barqaror').length;
    const due = ws.filter(x => x.s.reps && x.s.due <= today).length;
    /* Qiyin so'zlar: eng ko'p unutilganlari */
    const hard = ws.filter(x => x.s.lapses >= 2).sort((a, b) => b.s.lapses - a.s.lapses).slice(0, 5)
      .map(x => { const w = dict.byId[x.id]; return w ? { ar: w.ar, uz: w.uz, lapses: x.s.lapses } : null; }).filter(Boolean);
    /* Kurs */
    let course = null, weak = [], hw = { submitted: 0, accepted: 0, returned: 0 };
    const cp = await store.get('courseprog/' + sid);
    const ap = await store.get('alifprog/' + sid);
    if (cp && A.Course) {
      const v = A.Course.buildView(cp, today);
      course = { code: 'A1', done: v.lessons.filter(l => l.status === 'done').length, total: v.lessons.length };
      v.lessons.forEach(l => { if (l.testBest != null && l.testBest < 70) weak.push(l.n + '-dars «' + l.title + '» · test ' + l.testBest + '%');
        if (l.hw && l.hw.submittedAt) { hw.submitted++; if (l.hw.status === 'qabul') hw.accepted++; if (l.hw.status === 'qayta') hw.returned++; } });
    }
    if (ap && A.Alifbo) {
      const v = A.Alifbo.view(ap);
      course = { code: 'A0', done: v.done, total: v.total };
      v.lessons.forEach(l => { if (l.best != null && l.best < 70) weak.push('A0 ' + l.n + '-dars «' + l.title + '» · test ' + l.best + '%');
        if (l.hw) { hw.submitted++; if (l.hw.ok) hw.accepted++; } });
    }
    if (course) course.percent = course.total ? Math.round(course.done * 100 / course.total) : 0;
    rows.push({ studentId: sid, xp: sum.total || 0, streak: streakOf(sum, today, c).current, active7, lastActive,
      vocab: { learned, mature, due }, course, homework: hw, weak: weak.slice(0, 4), hardWords: hard });
  }
  return rows;
}
/** Admin: umumiy faollik */
async function adminStats(A, store, today) {
  const sums = (await store.list(SUM)).map(r => r.data).filter(Boolean);
  const dict = await dictionary(A, store);
  const out = { students: sums.length, xpTotal: 0, activeToday: 0, active7: 0, reviews30: 0, words: dict.list.length,
    custom: dict.list.filter(w => !w.builtin).length, perDay: [] };
  const per = {};
  sums.forEach(s => {
    const days = s.days || {};
    out.xpTotal += s.total || 0;
    if ((days[today] || {}).xp) out.activeToday++;
    if (Object.keys(days).some(d => dayDiff(d, today) < 7 && dayDiff(d, today) >= 0 && days[d].xp)) out.active7++;
    Object.keys(days).forEach(d => { if (dayDiff(d, today) < 30 && dayDiff(d, today) >= 0) { out.reviews30 += days[d].reviews || 0; per[d] = (per[d] || 0) + (days[d].xp ? 1 : 0); } });
  });
  for (let i = 29; i >= 0; i--) { const d = addDays(today, -i); out.perDay.push({ date: d, active: per[d] || 0 }); }
  return out;
}
async function wordsAdmin(A, store) {
  const dict = await dictionary(A, store);
  const custom = (await store.list(VOC)).map(r => r.data).filter(Boolean);
  const titles = await lessonTitles(A, store);
  return {
    builtin: dict.list.filter(w => w.builtin).map(w => ({ id: w.id, ar: w.ar, uz: w.uz, tr: w.tr, ex: w.ex, lessons: w.lessons })),
    custom: custom.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),
    lessons: Object.keys(titles).map(k => ({ ref: k, title: titles[k] }))
  };
}

module.exports = {
  LADDER, SKILLS, DEF, conf, saveConf, dictionary, bustDict, saveWord, removeWord, parseCsv, importCsv,
  sync, schedule, wordStatus, vocabView, deck, review, dailyView, quizStart, quizAnswer, rlStart, rlSubmit,
  progress, streakOf, setSkillGrade, staffRows, adminStats, wordsAdmin, studiedRefs, addDays, normAr, withLock
};
