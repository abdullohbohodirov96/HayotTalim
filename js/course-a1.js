/* Onlayn kurs: A1 daraja — darslar mazmuni va kurs mantiqi.
   Brauzerda ham, serverda ham bir xil ishlaydi (server/shared.js orqali
   yuklanadi): test savollari, baholash va darslar ochilishi qoidasi
   BITTA joyda — o'quvchi brauzerdagi natijani "chizib" bera olmaydi,
   server javoblarni o'zi qayta tekshiradi.

   Mazmun: darslikning 2-bo'limi (Oila) va 3-bo'limi (Uy-joy) mavzulari va
   so'z boyligi asosida yozilgan original darslar. Dialog va matnlar
   markaz uchun alohida tuzilgan.

   Har bir dars bosqichlari:
     1. so'zlar   — yangi so'zlarni yodlash: animatsiya, talaffuz
     2. video     — qissa videoda (yodlangan so'zlar endi tanish)
     3. dialog    — matn, tarjima, ovoz
     3. qoida     — grammatika va misollar
     4. mashq     — savol-javob (darhol tekshiriladi)
     5. test      — so'zlar bo'yicha, 60% dan o'tish kerak
     6. vazifa    — uy vazifasi: avtomatik qism + ustoz tekshiradigan qism
   Keyingi dars: test o'tilgan VA vazifa topshirilgan bo'lsa ochiladi.
   Ustoz istalgan darsni qo'lda ham ochib bera oladi.                      */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};

  var PASS = 60;   // test va uy vazifasi: 60% va undan yuqori — o'tdi

  var UNITS = [
    { id: 'u1', n: 1, title: 'Tanishuv', ar: 'التَّعَارُفُ' }
  ];

  /* so'z: ar — harakatli yozuv, tr — o'qilishi, uz — tarjima, anim — animatsiya kaliti */
  function w(ar, tr, uz, anim, extra) {
    var o = { ar: ar, tr: tr, uz: uz, anim: anim };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  var LESSONS = [
    /* ===================== 2-BO'LIM: OILA ===================== */
    {
      id: 'a1-01', unit: 'u1', n: 1,
      title: 'Sen kimsan?', titleAr: 'مَنْ أَنْتَ؟',
      goal: 'O’zini tanishtirish: ism, davlat/shahar, yosh.',
      cast: { A: 'man', B: 'man' },
      words: [
        w('اِسْمٌ', 'ismun', 'ism', 'name'),
        w('أَهْلًا وَسَهْلًا', 'ahlan wa sahlan', 'xush kelibsiz', 'welcome'),
        w('مِنْ أَيْنَ أَنْتَ؟', 'min ayna anta', 'qayerdansan?', 'where'),
        w('قَطَرُ', 'qatar', 'Qatar', 'Qatar'),
        w('الدَّوْحَةُ', 'ad-dawha', 'Doha', 'Doha'),
        w('مِصْرُ', 'misr', 'Misr', 'Egypt'),
        w('الْقَاهِرَةُ', 'al-qahira', 'Qohira', 'Cairo'),
        w('كَمْ عُمْرُكَ؟', 'kam umruka', 'yoshing nechada?', 'age')
      ],
      dialog: {
        title: 'Tanishuv',
        scene: 'Ahmad va Yusuf birinchi marta uchrashib tanishadi.',
        lines: [
          { who: 'أَحْمَدُ', whoUz: 'Ahmad', ar: 'السَّلَامُ عَلَيْكُمْ!', uz: 'Assalomu alaykum!' },
          { who: 'يُوسُفُ', whoUz: 'Yusuf', ar: 'وَعَلَيْكُمُ السَّلَامُ! أَهْلًا وَسَهْلًا.', uz: 'Va alaykum assalom! Xush kelibsiz.' },
          { who: 'أَحْمَدُ', whoUz: 'Ahmad', ar: 'اسْمِي أَحْمَدُ. مَا اسْمُكَ؟', uz: 'Mening ismim Ahmad. Isming nima?' },
          { who: 'يُوسُفُ', whoUz: 'Yusuf', ar: 'اِسْمِي يُوسُفُ.', uz: 'Mening ismim Yusuf.' },
          { who: 'أَحْمَدُ', whoUz: 'Ahmad', ar: 'يَا يُوسُفُ! مِنْ أَيْنَ أَنْتَ؟', uz: 'Yusuf! Qayerdansan?' },
          { who: 'يُوسُفُ', whoUz: 'Yusuf', ar: 'أَنَا مِنْ قَطَرَ، مِنْ مَدِينَةِ الدَّوْحَةِ. وَأَنْتَ؟', uz: 'Men Qatardan, Doha shahridanman. Sen-chi?' },
          { who: 'أَحْمَدُ', whoUz: 'Ahmad', ar: 'أَنَا مِنْ مِصْرَ، مِنَ الْقَاهِرَةِ.', uz: 'Men Misrdan, Qohiradanman.' },
          { who: 'يُوسُفُ', whoUz: 'Yusuf', ar: 'كَمْ عُمْرُكَ يَا أَحْمَدُ؟', uz: 'Yoshing nechada, Ahmad?' },
          { who: 'أَحْمَدُ', whoUz: 'Ahmad', ar: 'عُمْرِي ثَلَاثُونَ عَامًا. وَكَمْ عُمْرُكَ أَنْتَ؟', uz: 'Yoshim o’ttizda. Sening yoshing-chi?' },
          { who: 'يُوسُفُ', whoUz: 'Yusuf', ar: 'عُمْرِي عِشْرُونَ عَامًا.', uz: 'Yoshim yigirmada.' }
        ]
      },
      practice: [
        { type: 'choice', q: 'Bo’sh joyni to’ldiring:  مَا ___؟  (— اِسْمِي يَاسِرٌ)', options: ['اسْمُكَ', 'عُمْرِي', 'أَيْنَ'], answer: 0 },
        { type: 'choice', q: 'Bo’sh joyni to’ldiring:  مِنْ ___ أَنْتَ؟', options: ['أَيْنَ', 'عُمْرِي', 'أَهْلًا'], answer: 0 },
        { type: 'choice', q: 'To’g’ri so’roq:  ___ عُمْرُكَ؟', options: ['كَمْ', 'مَنْ', 'أَيْنَ'], answer: 0 },
        { type: 'choice', q: 'Yusuf nechada?  (عُمْرُ يُوسُفَ)', options: ['20', '15', '10'], answer: 0 },
        { type: 'choice', q: 'Ahmad qayerdan?  (أَحْمَدُ مِنْ)', options: ['مِصْرَ', 'الْمَغْرِبِ', 'السُّعُودِيَّةِ'], answer: 0 },
        { type: 'order', uz: 'Men Misrdanman.', words: ['أَنَا', 'مِنْ', 'مِصْرَ'] },
        { type: 'order', uz: 'Yoshim o’ttizda.', words: ['عُمْرِي', 'ثَلَاثُونَ', 'عَامًا'] }
      ],
      homework: {
        auto: [
          { q: 'أَنَا ___ قَطَرَ.', options: ['مِنْ', 'مَا', 'كَمْ'] },
          { q: '___ اسْمُكَ؟', options: ['مَا', 'مِنْ', 'كَمْ'] },
          { q: '«yoshing nechada?» — arabchada:', options: ['كَمْ عُمْرُكَ؟', 'مَا اسْمُكَ؟', 'مِنْ أَيْنَ أَنْتَ؟'] },
          { q: 'عُمْرِي عِشْرُونَ ___.', options: ['عَامًا', 'اسْمِي', 'مِنْ'] },
          { q: '«qayerdansan?» — arabchada:', options: ['مِنْ أَيْنَ أَنْتَ؟', 'كَمْ عُمْرُكَ؟', 'مَا اسْمُكَ؟'] }
        ],
        write: [
          { prompt: 'O’zingizni 3 ta gap bilan tanishtiring: ism, shahar/davlat, yosh.', hint: 'Masalan: اِسْمِي ... . أَنَا مِنْ ... . عُمْرِي ... عَامًا.' }
        ]
      }
    }
  ];

  /* ---------------- Yordamchilar ---------------- */
  function byId(id) {
    for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i];
    return null;
  }
  function indexOf(id) {
    for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return i;
    return -1;
  }
  function unitOf(lesson) {
    for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === lesson.unit) return UNITS[i];
    return null;
  }

  /* Tasodifiy bo'lmagan aralashtirish: bir dars har doim bir xil test beradi,
     shuning uchun server ham aynan shu testni qayta tuzib, tekshira oladi. */
  function seeded(seedStr) {
    var h = 2166136261;
    for (var i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return function () {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      return (h % 100000) / 100000;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** So'zlar testi: har so'zga bitta savol, savol turi navbat bilan almashadi.
      Turlari: ar→uz (arabcha so'z, ma'nosini tanlash), uz→ar, anim→ar (animatsiyaga
      qarab so'zni tanlash). Javob variantlari shu darsning boshqa so'zlaridan. */
  function buildTest(lesson) {
    var rnd = seeded('test:' + lesson.id);
    var words = lesson.words;
    var kinds = ['ar2uz', 'anim2ar', 'uz2ar'];
    return words.map(function (wd, i) {
      var kind = kinds[i % kinds.length];
      var others = shuffle(words.filter(function (x) { return x !== wd; }), rnd).slice(0, 3);
      var opts = shuffle([wd].concat(others), rnd);
      var q = { id: lesson.id + ':t' + i, kind: kind, word: wd.ar, anim: kind === 'anim2ar' ? wd.anim : null };
      if (kind === 'ar2uz') {
        q.prompt = 'Bu so’zning ma’nosi qanday?';
        q.show = wd.ar;
        q.options = opts.map(function (x) { return x.uz; });
      } else if (kind === 'uz2ar') {
        q.prompt = '«' + wd.uz + '» — arabchada qanday?';
        q.options = opts.map(function (x) { return x.ar; });
        q.optionsAr = true;
      } else {
        q.prompt = 'Animatsiyada nima ko’rsatilgan?';
        q.options = opts.map(function (x) { return x.ar; });
        q.optionsAr = true;
      }
      q.answer = opts.indexOf(wd);
      return q;
    });
  }

  /** Javoblar: savol tartibida tanlangan variant raqamlari */
  function gradeTest(lesson, answers) {
    var test = buildTest(lesson);
    var ok = 0;
    test.forEach(function (q, i) { if (answers && Number(answers[i]) === q.answer) ok++; });
    return { correct: ok, total: test.length, percent: test.length ? Math.round(ok * 100 / test.length) : 0 };
  }
  /* Uy vazifasi savollarining javoblari brauzerga yuborilmaydi — ular faqat
     serverda (server/course-keys.js). keys berilmasa natija hisoblanmaydi. */
  function gradeHomeworkAuto(lesson, answers, keys) {
    var items = (lesson.homework && lesson.homework.auto) || [];
    var ok = 0;
    if (!keys) return { correct: 0, total: items.length, percent: 0, pending: true };
    items.forEach(function (q, i) { if (answers && answers[i] != null && Number(answers[i]) === keys[i]) ok++; });
    return { correct: ok, total: items.length, percent: items.length ? Math.round(ok * 100 / items.length) : 0 };
  }
  /** Mashq javobini tekshirish (darhol, brauzerda) */
  function checkPractice(item, value) {
    if (item.type === 'order') {
      return Array.isArray(value) && value.join(' ') === item.words.join(' ');
    }
    return Number(value) === item.answer;
  }

  /** Dars tugaganmi: test o'tilgan va vazifa topshirilgan */
  /** Uy vazifasining avtomatik qismi o'tildimi (60%+). Avtomatik savol bo'lmasa — o'tgan. */
  function hwPassed(hw) {
    if (!hw || !hw.submittedAt) return false;
    var a = hw.auto;
    if (!a || !a.total || a.pending) return true;
    return Number(a.percent) >= PASS;
  }
  function lessonDone(p) {
    return !!(p && p.testBest != null && p.testBest >= PASS && hwPassed(p.hw));
  }

  /** Har bir darsning holati: 'done' | 'open' | 'locked'
      progress = { lessons: { [id]: {...} }, unlocked: { [id]: true } } */
  function statuses(progress) {
    var pl = (progress && progress.lessons) || {};
    var manual = (progress && progress.unlocked) || {};
    var out = {};
    var prevDone = true;
    LESSONS.forEach(function (l, i) {
      var p = pl[l.id];
      var done = lessonDone(p);
      /* Har REVIEW_EVERY darsdan keyin takrorlash testi bor: undan o'tmaguncha keyingi dars yopiq */
      var gate = i > 0 ? reviewAfter(LESSONS[i - 1].id) : null;
      var gateOk = !gate || reviewPassed(progress, gate.id);
      var open = i === 0 || (prevDone && gateOk) || !!manual[l.id] || !!(progress && progress.all);   // all — to'liq dostup (ko'rish/test hisobi)
      out[l.id] = done ? 'done' : (open ? 'open' : 'locked');
      prevDone = done;
    });
    return out;
  }

  /* ================= LUG'AT VA TAKRORLASH =================
     — Har REVIEW_EVERY (2) darsdan keyin «Takrorlash» testi: shu ikki darsning
       barcha so'zlari + oldingi darslardan bir nechta so'z (unutilmasin).
     — Lug'at kartochkalari: Leitner qutilari (0…5). Har to'g'ri javobda so'z
       keyingi qutiga o'tadi va kamroq takrorlanadi, xatoda — boshiga qaytadi.  */
  var REVIEW_EVERY = 2;
  var REVIEWS = [];
  (function () {
    for (var i = REVIEW_EVERY - 1, n = 1; i < LESSONS.length; i += REVIEW_EVERY, n++) {
      var ids = LESSONS.slice(i - REVIEW_EVERY + 1, i + 1).map(function (l) { return l.id; });
      REVIEWS.push({ id: 'r' + n, n: n, after: LESSONS[i].id, lessons: ids,
        title: n + '-takrorlash', sub: ids.map(function (x) { return byId(x).n; }).join('–') + '-darslar so’zlari' });
    }
  })();
  function reviewAfter(lessonId) { return REVIEWS.filter(function (r) { return r.after === lessonId; })[0] || null; }
  function reviewById(id) { return REVIEWS.filter(function (r) { return r.id === id; })[0] || null; }
  function reviewPassed(progress, rid) {
    var r = progress && progress.reviews && progress.reviews[rid];
    return !!(r && r.best != null && r.best >= PASS);
  }
  function wordKey(lessonId, k) { return lessonId + ':' + k; }
  function allWords() {
    var out = [];
    LESSONS.forEach(function (l) { l.words.forEach(function (w, k) { out.push({ key: wordKey(l.id, k), lessonId: l.id, n: l.n, ar: w.ar, tr: w.tr, uz: w.uz, anim: w.anim }); }); });
    return out;
  }
  function reviewWords(rv) {
    var own = allWords().filter(function (w) { return rv.lessons.indexOf(w.lessonId) >= 0; });
    var firstIdx = indexOf(rv.lessons[0]);
    var older = allWords().filter(function (w) { return indexOf(w.lessonId) < firstIdx; });
    var rnd = seeded('rev-old:' + rv.id);
    return own.concat(shuffle(older, rnd).slice(0, 6));
  }
  /** Takrorlash testi: har so'zga bitta savol; javob variantlari butun lug'atdan */
  function buildReview(rv) {
    var words = reviewWords(rv);
    var pool = allWords();
    var rnd = seeded('review:' + rv.id);
    var kinds = ['ar2uz', 'uz2ar', 'listen', 'anim2ar'];
    return shuffle(words, rnd).map(function (wd, i) {
      var kind = kinds[i % kinds.length];
      var others = shuffle(pool.filter(function (x) { return x.uz !== wd.uz && x.ar !== wd.ar; }), rnd).slice(0, 3);
      var opts = shuffle([wd].concat(others), rnd);
      var q = { id: rv.id + ':q' + i, kind: kind, word: wd.ar, key: wd.key };
      if (kind === 'ar2uz') { q.prompt = 'Ma’nosini tanlang'; q.show = wd.ar; q.options = opts.map(function (x) { return x.uz; }); }
      else if (kind === 'listen') { q.prompt = 'Tinglang va ma’nosini tanlang'; q.say = wd.ar; q.options = opts.map(function (x) { return x.uz; }); }
      else if (kind === 'uz2ar') { q.prompt = '«' + wd.uz + '» — arabchada?'; q.options = opts.map(function (x) { return x.ar; }); q.optionsAr = true; }
      else { q.prompt = 'Rasmda nima?'; q.anim = wd.anim; q.options = opts.map(function (x) { return x.ar; }); q.optionsAr = true; }
      q.answer = opts.indexOf(wd);
      return q;
    });
  }
  function gradeReview(rv, answers) {
    var t = buildReview(rv), ok = 0, wrong = [];
    t.forEach(function (q, i) { if (answers && Number(answers[i]) === q.answer) ok++; else wrong.push(q.key); });
    return { correct: ok, total: t.length, percent: t.length ? Math.round(ok * 100 / t.length) : 0, wrong: wrong };
  }
  /* Leitner: qutidagi so'z necha kundan keyin qayta so'raladi */
  var BOX_DAYS = [0, 1, 3, 7, 14, 30];
  function addDays(iso, d) { var x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); }
  function vocabUpdate(vocab, key, ok, today) {
    var v = vocab[key] || { b: 0, ok: 0, bad: 0 };
    if (ok) { v.b = Math.min(5, (v.b || 0) + 1); v.ok = (v.ok || 0) + 1; }
    else { v.b = 0; v.bad = (v.bad || 0) + 1; }
    v.due = addDays(today, BOX_DAYS[v.b]);
    v.seen = today;
    vocab[key] = v;
    return v;
  }
  /** Ochiq darslarning so'zlari va ularning holati */
  function vocabState(progress, today) {
    var st = statuses(progress), vocab = (progress && progress.vocab) || {};
    var words = allWords().filter(function (w) { return st[w.lessonId] !== 'locked'; });
    var learned = 0, due = 0, fresh = 0;
    words.forEach(function (w) {
      var v = vocab[w.key];
      w.b = v ? v.b : null; w.due = v ? v.due : null;
      if (!v) fresh++;
      else { if (v.b >= 3) learned++; if (!v.due || v.due <= today) due++; }
    });
    return { words: words, total: words.length, learned: learned, due: due, fresh: fresh };
  }
  function reviewStatuses(progress) {
    var st = statuses(progress);
    return REVIEWS.map(function (r) {
      var lastDone = st[r.after] === 'done';
      var rec = (progress && progress.reviews && progress.reviews[r.id]) || {};
      return { id: r.id, n: r.n, title: r.title, sub: r.sub, after: r.after, lessons: r.lessons,
        status: reviewPassed(progress, r.id) ? 'done' : (lastDone ? 'open' : 'locked'),
        best: rec.best == null ? null : rec.best, tries: rec.tries || 0 };
    });
  }
  /** O'quvchiga ko'rsatiladigan umumiy holat (server va brauzer bir xil) */
  function buildView(doc, today) {
    var st = statuses(doc);
    var vs = vocabState(doc, today || '9999-12-31');
    return {
      course: { code: 'A1', title: 'Arab tili — A1 (Oila, Uy-joy)', pass: PASS },
      lessons: LESSONS.map(function (l) {
        var p = (doc.lessons || {})[l.id] || {};
        var hw = p.hw || null;
        return {
          id: l.id, n: l.n, unit: l.unit, title: l.title, titleAr: l.titleAr, status: st[l.id],
          steps: p.steps || {}, testBest: p.testBest == null ? null : p.testBest, testTries: p.testTries || 0,
          hw: hw ? {
            submittedAt: hw.submittedAt || null, status: hw.status || null, auto: hw.auto || null,
            grade: hw.grade == null ? null : hw.grade, comment: hw.comment || '', texts: hw.texts || [],
            fileIds: hw.fileIds || [], files: hw.files || [], written: hw.written || null,
            readPercent: hw.readPercent == null ? null : hw.readPercent,
            fillAnswers: hw.fillAnswers || [], trAnswers: hw.trAnswers || []
          } : null
        };
      }),
      reviews: reviewStatuses(doc),
      vocab: { total: vs.total, learned: vs.learned, due: vs.due, fresh: vs.fresh, map: doc.vocab || {} }
    };
  }

  /* «Darsda» o'tiladigan bosqichlar va «Uyda» bajariladigan vazifa alohida guruh */
  var STEPS = [
    { id: 'words', label: 'So’z yodlash', part: 'darsda' },
    { id: 'video', label: 'Video', part: 'darsda' },
    { id: 'dialog', label: 'Qissa', part: 'darsda' },
    { id: 'grammar', label: 'Qoida', part: 'darsda' },
    { id: 'practice', label: 'Mashq', part: 'darsda' },
    { id: 'test', label: 'Test', part: 'darsda' },
    { id: 'homework', label: 'Uy vazifasi', part: 'uyda' }
  ];

  /* ---------- Arab matnini solishtirish (harakatlarsiz) ---------- */
  function normAr(t) {
    return String(t || '')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')          // harakat, tatvil
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')     // alif turlari → ا
      .replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A')
      .replace(/[^\u0621-\u064A\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function lev(a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) d[i] = [i];
    for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
  }
  /** O'qilgan (yoki yozilgan) matnni namuna bilan solishtirish: so'zma-so'z */
  function compareAr(expected, got) {
    var ew = normAr(expected).split(' ').filter(Boolean);
    var gw = normAr(got).split(' ').filter(Boolean);
    var used = {};
    var marks = ew.map(function (w) {
      for (var k = 0; k < gw.length; k++) {
        if (used[k]) continue;
        var g = gw[k], ok = g === w || (w.length > 3 && lev(g, w) <= 1) ||
          (g.length > 2 && (g === 'ال' + w || 'ال' + g === w || g === 'و' + w || 'و' + g === w));
        if (ok) { used[k] = 1; return true; }
      }
      return false;
    });
    var ok = marks.filter(Boolean).length;
    return { marks: marks, words: ew, percent: ew.length ? Math.round(ok * 100 / ew.length) : 0 };
  }

  /** Kitobdagidek yozma mashqlar — qissa va so'zlardan avtomatik tuziladi:
      fill: gapdagi darsning so'zi tushirib qoldirilgan — o'quvchi yozadi;
      tr:   qissadagi qisqa gaplarni arabchaga tarjima qilish.            */
  function buildWritten(lesson) {
    var lines = (lesson.dialog && lesson.dialog.lines) || [];
    var wordsN = (lesson.words || []).map(function (w) { return { w: w, n: normAr(w.ar).replace(/^ال/, '') }; });
    var fill = [];
    lines.forEach(function (ln, li) {
      if (fill.length >= 4) return;
      var toks = String(ln.ar).split(/\s+/);
      for (var t = 0; t < toks.length; t++) {
        var nt = normAr(toks[t]).replace(/^و/, '').replace(/^ال/, '');
        var hit = nt && wordsN.filter(function (x) { return x.n && (nt === x.n || nt.indexOf(x.n) === 0 && nt.length - x.n.length <= 2); })[0];
        if (hit) {
          var shown = toks.slice(); shown[t] = '_____';
          fill.push({ id: lesson.id + ':f' + li, text: shown.join(' '), answer: toks[t].replace(/[.,،؟!?]/g, ''), uz: ln.uz, hint: hit.w.uz });
          break;
        }
      }
    });
    var tr = lines.filter(function (ln) { return normAr(ln.ar).split(' ').length <= 6; })
      .slice(0, 3).map(function (ln, i) { return { id: lesson.id + ':r' + i, uz: ln.uz, ar: ln.ar }; });
    return { fill: fill, tr: tr };
  }
  function gradeWritten(lesson, fillAns, trAns) {
    var w = buildWritten(lesson);
    var fOk = 0;
    w.fill.forEach(function (f, i) {
      var a = normAr(fillAns && fillAns[i]), b = normAr(f.answer);
      if (a && (a === b || (b.length > 3 && lev(a, b) <= 1))) fOk++;
    });
    var trPct = w.tr.length ? Math.round(w.tr.reduce(function (s, t, i) {
      return s + compareAr(t.ar, (trAns && trAns[i]) || '').percent;
    }, 0) / w.tr.length) : 0;
    return { fillOk: fOk, fillTotal: w.fill.length, trPercent: trPct };
  }

  A.Course = {
    code: 'A1', title: 'Arab tili — A1 (Oila, Uy-joy)',
    PASS: PASS, hwPassed: hwPassed, UNITS: UNITS, LESSONS: LESSONS, STEPS: STEPS,
    byId: byId, indexOf: indexOf, unitOf: unitOf,
    buildTest: buildTest, gradeTest: gradeTest, gradeHomeworkAuto: gradeHomeworkAuto,
    checkPractice: checkPractice, lessonDone: lessonDone, statuses: statuses,
    normAr: normAr, compareAr: compareAr, buildWritten: buildWritten, gradeWritten: gradeWritten,
    REVIEW_EVERY: REVIEW_EVERY, REVIEWS: REVIEWS, reviewById: reviewById, reviewAfter: reviewAfter, reviewPassed: reviewPassed,
    buildReview: buildReview, gradeReview: gradeReview, reviewWords: reviewWords, allWords: allWords, wordKey: wordKey,
    vocabUpdate: vocabUpdate, vocabState: vocabState, reviewStatuses: reviewStatuses, buildView: buildView, BOX_DAYS: BOX_DAYS
  };
})(typeof window !== 'undefined' ? window : globalThis);
