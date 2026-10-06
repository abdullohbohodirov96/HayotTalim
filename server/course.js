/* Onlayn kurs: o'quvchi taraqqiyoti, ketma-ket ochilish, uy vazifasi.

   Yozuv: courseprog/<studentId>
     {
       studentId,
       lessons: {
         <lessonId>: {
           steps:   { words: '2026-10-07 10:00', dialog: …, … },
           testBest, testLast, testTries,
           hw: { auto:{correct,total,percent}, autoAnswers:[], texts:[], fileIds:[],
                 submittedAt, status:'tekshirilmoqda'|'qabul'|'qayta', grade, comment,
                 reviewedAt, reviewedBy }
         }
       },
       unlocked: { <lessonId>: true }     // ustoz/admin qo'lda ochgan darslar
     }

   Qoidalar (js/course-a1.js dagi A.Course bilan bir xil):
     — birinchi dars doim ochiq;
     — keyingi dars: oldingi darsning testi ≥ 80% VA vazifasi topshirilgan bo'lsa;
     — ustoz/admin istalgan darsgacha qo'lda ochib bera oladi;
     — ustoz vazifani «qayta topshir» deb qaytarsa, dars tugagan hisoblanmaydi.
   Test va vazifaning avtomatik qismini SERVER o'zi baholaydi.                */
'use strict';

const COL = 'courseprog/';

function txt(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').slice(0, max || 2000); }

function empty(sid) { return { studentId: String(sid), lessons: {}, unlocked: {}, reviews: {}, vocab: {} }; }

async function get(store, sid) {
  const d = await store.get(COL + sid);
  if (!d) return empty(sid);
  d.lessons = d.lessons || {};
  d.unlocked = d.unlocked || {};
  d.reviews = d.reviews || {};
  d.vocab = d.vocab || {};
  return d;
}
async function put(store, sid, doc) { await store.set(COL + sid, doc); }

/** O'quvchiga ko'rsatiladigan holat (darslar, takrorlashlar, lug'at) — js/course-a1.js dagi bilan bir xil */
function view(A, doc) {
  return A.Course.buildView(doc, A.today());
}

function lessonOpen(A, doc, lessonId) {
  const st = A.Course.statuses(doc);
  return st[lessonId] === 'open' || st[lessonId] === 'done';
}

/** Bosqich ko'rildi deb belgilash */
async function markStep(A, store, sid, body, stamp) {
  const C = A.Course;
  const lesson = C.byId(String(body.lessonId || ''));
  const step = String(body.step || '');
  if (!lesson) return { error: 'Dars topilmadi.', code: 404 };
  if (!C.STEPS.some(s => s.id === step)) return { error: 'Noma’lum bosqich.', code: 400 };
  const doc = await get(store, sid);
  if (!lessonOpen(A, doc, lesson.id)) return { error: 'Bu dars hali yopiq.', code: 403 };
  const p = doc.lessons[lesson.id] = doc.lessons[lesson.id] || {};
  p.steps = p.steps || {};
  if (!p.steps[step]) p.steps[step] = stamp();
  await put(store, sid, doc);
  return { ok: true, view: view(A, doc) };
}

/** So'z testi: server javoblarni o'zi baholaydi */
async function submitTest(A, store, sid, body, stamp) {
  const C = A.Course;
  const lesson = C.byId(String(body.lessonId || ''));
  if (!lesson) return { error: 'Dars topilmadi.', code: 404 };
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 50).map(Number) : [];
  const doc = await get(store, sid);
  if (!lessonOpen(A, doc, lesson.id)) return { error: 'Bu dars hali yopiq.', code: 403 };
  const g = C.gradeTest(lesson, answers);
  const p = doc.lessons[lesson.id] = doc.lessons[lesson.id] || {};
  p.testLast = g.percent;
  p.testTries = (p.testTries || 0) + 1;
  if (p.testBest == null || g.percent > p.testBest) p.testBest = g.percent;
  p.steps = p.steps || {};
  if (!p.steps.test && g.percent >= C.PASS) p.steps.test = stamp();
  await put(store, sid, doc);
  return { ok: true, result: g, passed: g.percent >= C.PASS, view: view(A, doc) };
}

/** Uy vazifasini topshirish: avtomatik qism + yozma javob + fayllar (rasm, pdf) */
async function submitHomework(A, store, sid, body, stamp, files) {
  const C = A.Course;
  const lesson = C.byId(String(body.lessonId || ''));
  if (!lesson) return { error: 'Dars topilmadi.', code: 404 };
  const doc = await get(store, sid);
  if (!lessonOpen(A, doc, lesson.id)) return { error: 'Bu dars hali yopiq.', code: 403 };
  const autoAnswers = Array.isArray(body.autoAnswers) ? body.autoAnswers.slice(0, 30).map(Number) : [];
  const texts = (Array.isArray(body.texts) ? body.texts : []).slice(0, 5).map(t => txt(t, 3000));
  /* Fayl faqat SHU o'quvchi yuklagan bo'lsa qabul qilinadi */
  const fileIds = [];
  for (const fid of (Array.isArray(body.fileIds) ? body.fileIds : []).slice(0, 10)) {
    const rec = await files.meta(store, String(fid));
    if (rec && rec.byKind === 'oquvchi' && String(rec.by) === String(sid)) fileIds.push(rec.id);
  }
  const hasWork = texts.some(t => t.trim().length >= 2) || fileIds.length > 0 ||
    (Array.isArray(body.fillAnswers) && body.fillAnswers.some(t => String(t || '').trim())) ||
    (Array.isArray(body.trAnswers) && body.trAnswers.some(t => String(t || '').trim().length >= 2));
  if (!hasWork) return { error: 'Yozma javob yozing yoki daftaringiz rasmini yuklang.', code: 400 };
  const auto = C.gradeHomeworkAuto(lesson, autoAnswers);
  /* Kitobdagidek yozma mashqlar: bo'sh joyni to'ldirish va tarjima — server o'zi baholaydi */
  const fillAnswers = (Array.isArray(body.fillAnswers) ? body.fillAnswers : []).slice(0, 10).map(t => txt(t, 200));
  const trAnswers = (Array.isArray(body.trAnswers) ? body.trAnswers : []).slice(0, 10).map(t => txt(t, 600));
  const written = C.gradeWritten ? C.gradeWritten(lesson, fillAnswers, trAnswers) : null;
  /* Qissani ovoz chiqarib o'qish natijasi (brauzerdagi nutqni tanish) — ustoz uchun ma'lumot */
  const rp = Number(body.readPercent);
  const readPercent = Number.isFinite(rp) ? Math.max(0, Math.min(100, Math.round(rp))) : null;
  const hints = body.hints && typeof body.hints === 'object' ? {
    fill: (Array.isArray(body.hints.fill) ? body.hints.fill : []).slice(0, 10).map(x => Math.max(0, Math.min(9, Number(x) || 0))),
    tr: (Array.isArray(body.hints.tr) ? body.hints.tr : []).slice(0, 10).map(x => Math.max(0, Math.min(9, Number(x) || 0)))
  } : null;
  const p = doc.lessons[lesson.id] = doc.lessons[lesson.id] || {};
  p.hw = {
    auto, autoAnswers, texts, fileIds, fillAnswers, trAnswers, written, readPercent, hints,
    submittedAt: stamp(), status: 'tekshirilmoqda', grade: null, comment: ''
  };
  p.steps = p.steps || {};
  p.steps.homework = p.steps.homework || stamp();
  await put(store, sid, doc);
  return { ok: true, auto, view: view(A, doc) };
}

/** Takrorlash testi (har 2 darsdan keyin). O'tilsa keyingi dars ochiladi;
    xato so'zlar lug'atda boshiga qaytadi, to'g'rilari keyingi qutiga o'tadi. */
async function submitReview(A, store, sid, body, stamp) {
  const C = A.Course;
  const rv = C.reviewById(String(body.reviewId || ''));
  if (!rv) return { error: 'Takrorlash topilmadi.', code: 404 };
  const doc = await get(store, sid);
  const rs = C.reviewStatuses(doc).filter(r => r.id === rv.id)[0];
  if (!rs || rs.status === 'locked') return { error: 'Avval shu ikki darsni tugating.', code: 403 };
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, 80).map(Number) : [];
  const g = C.gradeReview(rv, answers);
  const r = doc.reviews[rv.id] = doc.reviews[rv.id] || {};
  r.last = g.percent; r.tries = (r.tries || 0) + 1; r.at = stamp();
  if (r.best == null || g.percent > r.best) r.best = g.percent;
  const today = A.today();
  C.buildReview(rv).forEach(q => C.vocabUpdate(doc.vocab, q.key, g.wrong.indexOf(q.key) < 0, today));
  await put(store, sid, doc);
  return { ok: true, result: g, passed: g.percent >= C.PASS, view: view(A, doc) };
}

/** Lug'at kartochkalari natijasi: [{key, ok}] — faqat ochiq darslar so'zlari */
async function vocabMark(A, store, sid, body) {
  const C = A.Course;
  const doc = await get(store, sid);
  const open = {};
  C.vocabState(doc, A.today()).words.forEach(w => { open[w.key] = 1; });
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 60);
  let n = 0;
  items.forEach(it => {
    const key = String((it && it.key) || '');
    if (!open[key]) return;
    C.vocabUpdate(doc.vocab, key, !!it.ok, A.today()); n++;
  });
  await put(store, sid, doc);
  return { ok: true, saved: n, view: view(A, doc) };
}

/* ---------------- Ustoz / admin ---------------- */

/** Vazifani tekshirish: qabul (baho, izoh) yoki qayta topshirishga qaytarish */
async function review(A, store, body, user, stamp) {
  const sid = String(body.studentId || '');
  const lesson = A.Course.byId(String(body.lessonId || ''));
  if (!sid || !lesson) return { error: 'O’quvchi yoki dars topilmadi.', code: 404 };
  const doc = await get(store, sid);
  const p = doc.lessons[lesson.id];
  if (!p || !p.hw || !p.hw.submittedAt) return { error: 'Vazifa hali topshirilmagan.', code: 400 };
  const decision = body.decision === 'qayta' ? 'qayta' : 'qabul';
  const grade = body.grade == null || body.grade === '' ? null : Math.max(1, Math.min(5, Math.round(Number(body.grade))));
  p.hw.status = decision;
  p.hw.grade = decision === 'qabul' ? grade : null;
  p.hw.comment = txt(body.comment, 1000);
  p.hw.reviewedAt = stamp();
  p.hw.reviewedBy = user ? user.name : '';
  /* Qayta topshirish: dars tugamagan hisoblanadi, o'quvchi vazifani yana yuboradi */
  if (decision === 'qayta') p.hw.submittedAt = null;
  await put(store, sid, doc);
  return { ok: true, doc, lesson, decision };
}

/** O'quvchini tanlangan darsgacha o'tkazish (shu darsgacha hammasi ochiladi) */
async function moveTo(A, store, body) {
  const sid = String(body.studentId || '');
  const C = A.Course;
  const idx = C.indexOf(String(body.lessonId || ''));
  if (!sid || idx < 0) return { error: 'O’quvchi yoki dars topilmadi.', code: 404 };
  const doc = await get(store, sid);
  doc.unlocked = {};
  for (let i = 0; i <= idx; i++) doc.unlocked[C.LESSONS[i].id] = true;
  await put(store, sid, doc);
  return { ok: true, doc };
}

/** Bir nechta o'quvchining qisqa holati (ustoz paneli uchun) */
async function overview(A, store, studentIds) {
  const C = A.Course;
  const out = [];
  for (const sid of studentIds) {
    const doc = await get(store, sid);
    const st = C.statuses(doc);
    let current = null, done = 0;
    C.LESSONS.forEach(l => {
      if (st[l.id] === 'done') done++;
      if (!current && st[l.id] === 'open') current = l.id;
    });
    const pending = [];
    C.LESSONS.forEach(l => {
      const p = doc.lessons[l.id];
      if (p && p.hw && p.hw.submittedAt && p.hw.status === 'tekshirilmoqda') {
        pending.push({
          lessonId: l.id, title: l.title, n: l.n, submittedAt: p.hw.submittedAt,
          auto: p.hw.auto, texts: p.hw.texts || [], fileIds: p.hw.fileIds || [],
          written: p.hw.written || null, readPercent: p.hw.readPercent == null ? null : p.hw.readPercent,
          fillAnswers: p.hw.fillAnswers || [], trAnswers: p.hw.trAnswers || []
        });
      }
    });
    const lessons = {};
    C.LESSONS.forEach(l => {
      const p = doc.lessons[l.id] || {};
      lessons[l.id] = {
        status: st[l.id], testBest: p.testBest == null ? null : p.testBest,
        hw: p.hw ? { status: p.hw.status, grade: p.hw.grade, submittedAt: p.hw.submittedAt,
          auto: p.hw.auto, texts: p.hw.texts || [], fileIds: p.hw.fileIds || [], comment: p.hw.comment || '' } : null
      };
    });
    const vs = C.vocabState(doc, A.today());
    out.push({ studentId: sid, done, total: C.LESSONS.length, current, pending, lessons,
      reviews: C.reviewStatuses(doc), vocab: { total: vs.total, learned: vs.learned, due: vs.due } });
  }
  return out;
}

module.exports = { COL, get, view, markStep, submitTest, submitHomework, submitReview, vocabMark, review, moveTo, overview };
