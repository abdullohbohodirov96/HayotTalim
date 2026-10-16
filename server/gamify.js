/* Gamifikatsiya: o'quvchi ballari va reyting (Top o'quvchilar).

   Ballar ALOHIDA saqlanmaydi — har safar mavjud yozuvlardan hisoblanadi:
     — davomat (keldi / kechikdi),
     — ustoz qo'ygan baho (onlayn kurs uy vazifasi, 1–5),
     — dars testi 60% dan yuqori o'tilgani,
     — markaz testlari (quiz) dan o'tilgani,
     — ustoz bergan qo'shimcha (bonus) ballar.
   Shuning uchun ball "chizib" bo'lmaydi: baho o'zgarsa — ball ham o'zgaradi.

   Sozlama: meta/settings.gamify  { enabled, keldi, kechikdi, grade5..grade1, testPass, quizPass }
   Bonus:   gamibonus/<id>        { id, studentId, points, reason, at, by }              */
'use strict';

const DEF = {
  enabled: true,
  keldi: 5,        // darsga keldi
  kechikdi: 2,     // kechikib keldi
  grade5: 10,      // "5" baho
  grade4: 7,
  grade3: 4,
  grade2: 1,
  grade1: 0,
  testPass: 5,     // dars testi ≥ 60%
  quizPass: 5      // markaz testidan o'tdi
};
const PASS = 60;
const BONUS = 'gamibonus/';
const KEYS = Object.keys(DEF).filter(k => k !== 'enabled');

function conf(settings) {
  const g = Object.assign({}, DEF, (settings && settings.gamify) || {});
  KEYS.forEach(k => { const n = Number(g[k]); g[k] = Number.isFinite(n) ? Math.max(0, Math.min(1000, Math.round(n))) : DEF[k]; });
  g.enabled = g.enabled !== false;
  return g;
}

async function listCol(store, col) {
  return (await store.list(col))
    .filter(r => r.path.split('/').length === 2)
    .map(r => r.data).filter(Boolean);
}

/** "Abdullayev Sardor" → "Sardor A." (reytingda to'liq familiya ko'rsatilmaydi) */
function shortName(st) {
  const first = String(st.firstName || '').trim();
  const last = String(st.lastName || '').trim();
  if (first) return first + (last ? ' ' + last[0].toUpperCase() + '.' : '');
  const parts = String(st.name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1] + ' ' + parts[0][0].toUpperCase() + '.';
  return parts[0] || 'O’quvchi';
}
function fullName(st) {
  return [st.lastName, st.firstName].filter(Boolean).join(' ') || st.name || '';
}

/**
 * Hamma faol o'quvchining ballini hisoblash.
 * @returns {{ conf, rows: [{studentId, name, short, points, parts, groups:[{id,name}]}] }}
 */
async function compute(store) {
  const settings = (await store.get('meta/settings')) || {};
  const c = conf(settings);
  const students = (await listCol(store, 'students/'))
    .filter(s => s && s.id && s.status !== 'o’chirilgan' && s.status !== 'chiqdi');
  const byId = {};
  students.forEach(s => {
    byId[s.id] = {
      studentId: s.id, name: fullName(s), short: shortName(s), points: 0,
      parts: { keldi: 0, kechikdi: 0, grades: 0, gradePts: 0, tests: 0, quizzes: 0, bonus: 0 },
      groups: []
    };
  });

  /* A'zolik → o'quvchi (davomat a'zolik kaliti bilan yozilishi mumkin) */
  const mems = await listCol(store, 'memberships/');
  const groups = await listCol(store, 'groups/');
  const gName = {};
  groups.forEach(g => { gName[g.id] = (g.code ? g.code + ' · ' : '') + (g.name || ''); });
  const memToStudent = {};
  mems.forEach(m => {
    if (!m || !m.id) return;
    memToStudent[m.id] = String(m.studentId || '');
    const r = byId[m.studentId];
    if (r && m.status !== 'chiqdi' && gName[m.groupId] != null &&
      !r.groups.some(x => x.id === m.groupId)) r.groups.push({ id: m.groupId, name: gName[m.groupId] });
  });

  /* 1. Davomat */
  const lessonDocs = (await store.list('lessons/')).map(r => r.data).filter(Boolean);
  for (const doc of lessonDocs) {
    const dates = {};
    if (doc.items) Object.keys(doc.items).forEach(d => { dates[d] = 1; });
    if (doc.marks) Object.keys(doc.marks).forEach(d => { dates[d] = 1; });
    Object.keys(dates).forEach(date => {
      const seen = {};
      const day = doc.items && doc.items[date];
      if (day && day.attendance) {
        Object.keys(day.attendance).forEach(k => { const v = day.attendance[k]; seen[k] = String((v && v.status) || v || ''); });
      }
      const m = doc.marks && doc.marks[date];
      if (m) Object.keys(m).forEach(k => { if (!seen[k]) seen[k] = String(m[k] || ''); });
      Object.keys(seen).forEach(k => {
        const sid = byId[k] ? k : memToStudent[k];
        const r = sid && byId[sid];
        if (!r) return;
        if (seen[k] === 'keldi') { r.parts.keldi++; r.points += c.keldi; }
        else if (seen[k] === 'kechikdi') { r.parts.kechikdi++; r.points += c.kechikdi; }
      });
    });
  }

  /* 2. Onlayn kurs: ustoz bahosi va dars testlari */
  const progs = await listCol(store, 'courseprog/');
  progs.forEach(doc => {
    const r = byId[doc.studentId];
    if (!r || !doc.lessons) return;
    Object.keys(doc.lessons).forEach(lid => {
      const p = doc.lessons[lid] || {};
      if (p.testBest != null && Number(p.testBest) >= PASS) { r.parts.tests++; r.points += c.testPass; }
      const gr = p.hw && p.hw.status === 'qabul' ? Math.round(Number(p.hw.grade)) : NaN;
      if (gr >= 1 && gr <= 5) { r.parts.grades++; const add = c['grade' + gr]; r.parts.gradePts += add; r.points += add; }
    });
  });

  /* 2b. A0 Alifbo darslari: har bir o'tilgan dars testi */
  const alif = (await store.list('alifprog/')).filter(r => r.path.split('/').length === 2);
  alif.forEach(rec => {
    const sid = rec.path.split('/')[1];
    const r = byId[sid];
    const ls = rec.data && rec.data.lessons;
    if (!r || !ls) return;
    Object.keys(ls).forEach(k => { if (ls[k] && Number(ls[k].best) >= PASS) { r.parts.tests++; r.points += c.testPass; } });
  });

  /* 3. Markaz testlari (quiz) — har bir testdan bir marta */
  const qres = await listCol(store, 'quizres/');
  const quizSeen = {};
  qres.forEach(q => {
    const r = byId[q.studentId];
    if (!r || !q.passed) return;
    const key = q.studentId + '|' + (q.quizId || q.id);
    if (quizSeen[key]) return;
    quizSeen[key] = 1;
    r.parts.quizzes++; r.points += c.quizPass;
  });

  /* 4. Ustoz bonusi (manfiy ham bo'lishi mumkin — jarima) */
  const bon = await listCol(store, BONUS);
  bon.forEach(b => {
    const r = byId[b.studentId];
    const n = Math.round(Number(b.points));
    if (!r || !Number.isFinite(n)) return;
    r.parts.bonus += n; r.points += n;
  });

  const rows = Object.keys(byId).map(k => byId[k]);
  rows.forEach(r => { if (r.points < 0) r.points = 0; });
  rows.sort((a, b) => b.points - a.points || a.short.localeCompare(b.short));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.points !== prev) { rank = i + 1; prev = r.points; } r.rank = rank; });
  return { conf: c, rows };
}

function rankWithin(rows) {
  const out = rows.slice().sort((a, b) => b.points - a.points || a.short.localeCompare(b.short));
  let rank = 0, prev = null;
  return out.map((r, i) => { if (r.points !== prev) { rank = i + 1; prev = r.points; } return Object.assign({}, r, { rank }); });
}

/** O'quvchi kabineti uchun: o'z bali + markaz va guruh reytingi (faqat qisqa ism) */
async function forStudent(store, studentId, limit) {
  const { conf: c, rows } = await compute(store);
  if (!c.enabled) return { enabled: false };
  const lim = limit || 10;
  const me = rows.find(r => r.studentId === String(studentId)) || null;
  const pub = r => ({ short: r.short, points: r.points, rank: r.rank, me: r.studentId === String(studentId) });
  const groupTops = (me ? me.groups : []).map(g => {
    const list = rankWithin(rows.filter(r => r.groups.some(x => x.id === g.id)));
    const mine = list.find(r => r.studentId === String(studentId));
    return { id: g.id, name: g.name, myRank: mine ? mine.rank : null, count: list.length, top: list.slice(0, lim).map(pub) };
  });
  return {
    enabled: true,
    rules: c,
    me: me ? { points: me.points, rank: me.rank, count: rows.length, parts: me.parts } : null,
    top: rows.slice(0, lim).map(pub),
    groups: groupTops
  };
}

/** ERP uchun: to'liq jadval (filtr: guruh) */
async function forStaff(store, groupId) {
  const { conf: c, rows } = await compute(store);
  const list = groupId ? rankWithin(rows.filter(r => r.groups.some(x => x.id === groupId))) : rows;
  return { enabled: c.enabled, rules: c, rows: list };
}

async function saveConf(store, body) {
  const settings = (await store.get('meta/settings')) || {};
  const next = {};
  KEYS.forEach(k => { if (body[k] != null && body[k] !== '') next[k] = body[k]; });
  next.enabled = body.enabled !== false && body.enabled !== 'false';
  settings.gamify = conf({ gamify: Object.assign({}, settings.gamify || {}, next) });
  await store.set('meta/settings', settings);
  return settings.gamify;
}

async function addBonus(store, data, opts) {
  const crypto = require('crypto');
  const n = Math.round(Number(data.points));
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 500) return { error: 'Ball −500 dan 500 gacha bo’lishi kerak (0 emas).' };
  const st = await store.get('students/' + String(data.studentId || ''));
  if (!st) return { error: 'O’quvchi topilmadi.' };
  const rec = {
    id: 'gb' + crypto.randomBytes(6).toString('hex'),
    studentId: st.id, points: n,
    reason: String(data.reason || '').replace(/\u0000/g, '').slice(0, 200),
    at: (opts && opts.stamp) ? opts.stamp() : new Date().toISOString(),
    by: (opts && opts.by) || ''
  };
  await store.set(BONUS + rec.id, rec);
  return { ok: true, bonus: rec };
}

module.exports = { DEF, conf, compute, forStudent, forStaff, saveConf, addBonus, shortName };
