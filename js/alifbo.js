/* A0 — Alifbo (harf o'rgatish) darajasi.
   Brauzerda ham (A.Alifbo), serverda ham (server/shared.js) ishlaydi.

   Tuzilishi: 8 ta dars. 1–7: harflar guruhlab (har birida 3–5 harf),
   8: harakatlar (fatha, kasra, damma, sukun, shadda, tanvin).
   Har darsda: harflar kartochkasi (yolg'iz, boshida, o'rtada, oxirida
   yozilishi + ovozi) → test. Test 60% va undan yuqori bo'lsa keyingi
   dars ochiladi; ungacha keyingi darslar yopiq va xira turadi.

   Test SERVERDA baholanadi: savollar javobsiz beriladi.               */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};
  var PASS = 60;
  var TATWEEL = 'ـ';

  /* nc: o'zidan keyingi harfga ulanmaydi (ا د ذ ر ز و) */
  var LETTERS = [
    { ch: 'ا', name: 'Alif', sound: 'a / ā', tip: 'Cho‘ziq «a». O‘zidan keyingi harfga ulanmaydi.', nc: true, ex: 'أَب', exUz: 'ota' },
    { ch: 'ب', name: 'Bā', sound: 'b', tip: 'Ostida bitta nuqta.', ex: 'بَاب', exUz: 'eshik' },
    { ch: 'ت', name: 'Tā', sound: 't', tip: 'Ustida ikkita nuqta.', ex: 'تَمْر', exUz: 'xurmo' },
    { ch: 'ث', name: 'Sā', sound: 's (tishlar orasidan)', tip: 'Ustida uchta nuqta. Til uchi tishlar orasida — ingliz «th» kabi.', ex: 'ثَلْج', exUz: 'qor' },
    { ch: 'ج', name: 'Jīm', sound: 'j', tip: 'Ichida bitta nuqta.', ex: 'جَمَل', exUz: 'tuya' },
    { ch: 'ح', name: 'Ḥā', sound: 'h (bo‘g‘izdan, yumshoq)', tip: 'Nuqtasiz. Bo‘g‘izdan chiqadigan kuchli, xirildoqsiz «h».', ex: 'حَلِيب', exUz: 'sut' },
    { ch: 'خ', name: 'Xā', sound: 'x', tip: 'Ustida bitta nuqta. O‘zbekcha «x» kabi.', ex: 'خُبْز', exUz: 'non' },
    { ch: 'د', name: 'Dāl', sound: 'd', tip: 'Keyingi harfga ulanmaydi.', nc: true, ex: 'دَار', exUz: 'uy' },
    { ch: 'ذ', name: 'Zāl', sound: 'z (tishlar orasidan)', tip: 'Ustida bitta nuqta. Ingliz «this» dagi «th» kabi. Ulanmaydi.', nc: true, ex: 'ذَهَب', exUz: 'oltin' },
    { ch: 'ر', name: 'Rā', sound: 'r', tip: 'Ulanmaydi. Qatordan pastga tushib turadi.', nc: true, ex: 'رَجُل', exUz: 'erkak' },
    { ch: 'ز', name: 'Zāy', sound: 'z', tip: 'Ustida bitta nuqta. Ulanmaydi.', nc: true, ex: 'زَيْت', exUz: 'yog‘' },
    { ch: 'س', name: 'Sīn', sound: 's', tip: 'Uchta «tish», nuqtasiz.', ex: 'سَمَك', exUz: 'baliq' },
    { ch: 'ش', name: 'Shīn', sound: 'sh', tip: 'Uchta «tish» va ustida uchta nuqta.', ex: 'شَمْس', exUz: 'quyosh' },
    { ch: 'ص', name: 'Sād', sound: 's (qalin)', tip: 'Qalin, og‘iz to‘la «s».', ex: 'صَبْر', exUz: 'sabr' },
    { ch: 'ض', name: 'Dād', sound: 'd (qalin)', tip: 'Qalin «d». Faqat arab tilida bor tovush.', ex: 'ضَوْء', exUz: 'yorug‘lik' },
    { ch: 'ط', name: 'Tā (qalin)', sound: 't (qalin)', tip: 'Qalin «t».', ex: 'طَالِب', exUz: 'talaba' },
    { ch: 'ظ', name: 'Zā (qalin)', sound: 'z (qalin)', tip: 'Ustida bitta nuqta. Qalin «z».', ex: 'ظُهْر', exUz: 'peshin' },
    { ch: 'ع', name: '‘Ayn', sound: '‘ (bo‘g‘iz tovushi)', tip: 'Bo‘g‘izni siqib chiqariladigan tovush.', ex: 'عَيْن', exUz: 'ko‘z' },
    { ch: 'غ', name: 'G‘ayn', sound: 'g‘', tip: 'Ustida bitta nuqta. O‘zbekcha «g‘» kabi.', ex: 'غُرْفَة', exUz: 'xona' },
    { ch: 'ف', name: 'Fā', sound: 'f', tip: 'Ustida bitta nuqta.', ex: 'فِيل', exUz: 'fil' },
    { ch: 'ق', name: 'Qāf', sound: 'q', tip: 'Ustida ikkita nuqta. O‘zbekcha «q» kabi.', ex: 'قَلَم', exUz: 'qalam' },
    { ch: 'ك', name: 'Kāf', sound: 'k', tip: 'Yumshoq «k».', ex: 'كِتَاب', exUz: 'kitob' },
    { ch: 'ل', name: 'Lām', sound: 'l', tip: 'Baland harf.', ex: 'لَيْل', exUz: 'tun' },
    { ch: 'م', name: 'Mīm', sound: 'm', tip: 'Boshi dumaloq.', ex: 'مَاء', exUz: 'suv' },
    { ch: 'ن', name: 'Nūn', sound: 'n', tip: 'Ustida bitta nuqta.', ex: 'نُور', exUz: 'nur' },
    { ch: 'ه', name: 'Hā', sound: 'h (yengil)', tip: 'Yengil, nafas bilan aytiladigan «h».', ex: 'هِلَال', exUz: 'hilol (oy)' },
    { ch: 'و', name: 'Vāv', sound: 'v / ū', tip: 'Ulanmaydi. Cho‘ziq «u» ham bo‘ladi.', nc: true, ex: 'وَرْد', exUz: 'atirgul' },
    { ch: 'ي', name: 'Yā', sound: 'y / ī', tip: 'Ostida ikkita nuqta. Cho‘ziq «i» ham bo‘ladi.', ex: 'يَد', exUz: 'qo‘l' }
  ];
  /* Muallimi soniy uslubida har harfdan keyin o'qiladigan so'zlar [arabcha, ma'nosi] */
  var WORDS = [[["أَسَد", "sher"], ["أَرْض", "yer"], ["أَكَلَ", "yedi"]], [["بَحْر", "dengiz"], ["بَيْت", "uy"], ["بَلَغَ", "yetdi"]], [["تَمْر", "xurmo"], ["بِنْت", "qiz"], ["تَرَكَ", "qoldirdi"]], [["ثَلْج", "qor"], ["ثَوْب", "kiyim"], ["ثَبَتَ", "mustahkam turdi"]], [["جَمَل", "tuya"], ["جَبَل", "tog‘"], ["جَمَعَ", "yig‘di"]], [["حَبْل", "arqon"], ["لَحْم", "go‘sht"], ["حَمَلَ", "ko‘tardi"]], [["خُبْز", "non"], ["خَشَب", "yog‘och"], ["خَرَجَ", "chiqdi"]], [["دَرْس", "dars"], ["وَلَد", "o‘g‘il bola"], ["حَدَثَ", "sodir bo‘ldi"]], [["ذَهَب", "oltin"], ["ذِئْب", "bo‘ri"], ["أَخَذَ", "oldi"]], [["رَجُل", "erkak"], ["قَمَر", "oy"], ["رَكِبَ", "mindi"]], [["زَيْت", "yog‘"], ["زَمَن", "zamon, vaqt"], ["زَرَعَ", "ekdi"]], [["سَمَك", "baliq"], ["فَرَس", "ot"], ["سَمِعَ", "eshitdi"]], [["شَمْس", "quyosh"], ["شَجَر", "daraxtlar"], ["شَرِبَ", "ichdi"]], [["صَبْر", "sabr"], ["صَدْر", "ko‘krak"], ["صَبَرَ", "sabr qildi"]], [["ضَيْف", "mehmon"], ["أَرْض", "yer"], ["حَضَرَ", "keldi, qatnashdi"]], [["طَبْل", "nog‘ora"], ["مَطَر", "yomg‘ir"], ["طَلَبَ", "so‘radi"]], [["ظُهْر", "peshin"], ["حَظّ", "omad"], ["نَظَرَ", "qaradi"]], [["عَيْن", "ko‘z"], ["عِلْم", "ilm"], ["عَمِلَ", "ishladi"]], [["غَنَم", "qo‘ylar"], ["غَيْم", "bulut"], ["غَسَلَ", "yuvdi"]], [["فَم", "og‘iz"], ["فَرَس", "ot"], ["فَتَحَ", "ochdi"]], [["قَلَم", "qalam"], ["قَمَر", "oy"], ["قَعَدَ", "o‘tirdi"]], [["كَلْب", "it"], ["مَلِك", "podshoh"], ["كَتَبَ", "yozdi"]], [["لَيْل", "tun"], ["لَحْم", "go‘sht"], ["جَلَسَ", "o‘tirdi"]], [["مَطَر", "yomg‘ir"], ["قَلَم", "qalam"], ["مَسَحَ", "artdi"]], [["نَهْر", "daryo"], ["نَجْم", "yulduz"], ["نَزَلَ", "tushdi"]], [["هَرَم", "ehrom (piramida)"], ["نَهْر", "daryo"], ["ذَهَبَ", "ketdi"]], [["وَرْد", "atirgul"], ["وَلَد", "o‘g‘il bola"], ["وَقَفَ", "to‘xtadi"]], [["يَد", "qo‘l"], ["يَوْم", "kun"], ["يَكْتُبُ", "yozadi"]]];
  LETTERS.forEach(function (x, i) { x.words = WORDS[i] || []; });
  /** Harf mashqi: ba bi bu / ab ib ub */
  function drill(x) {
    var F = 'َ', K = 'ِ', D = 'ُ', S = 'ْ';
    if (x.ch === 'ا') return { open: ['أَ', 'إِ', 'أُ'], closed: [] };
    var c = x.ch;
    if (c === 'و') return { open: [c + F, c + K, c + D], closed: ['أَوْ'] };
    if (c === 'ي') return { open: [c + F, c + K, c + D], closed: ['أَيْ'] };
    return { open: [c + F, c + K, c + D], closed: ['أَ' + c + S, 'إِ' + c + S, 'أُ' + c + S] };
  }
  function L(ch) { return LETTERS.filter(function (x) { return x.ch === ch; })[0]; }

  /** Harfning to'rt shakli (tatvil bilan ulab ko'rsatamiz) */
  function forms(x) {
    if (x.nc) return { alone: x.ch, start: x.ch, middle: TATWEEL + x.ch, end: TATWEEL + x.ch };
    return { alone: x.ch, start: x.ch + TATWEEL, middle: TATWEEL + x.ch + TATWEEL, end: TATWEEL + x.ch };
  }

  var HARAKAT = [
    { id: 'fatha', mark: 'َ', name: 'Fatha', sound: 'a', tip: 'Harf ustidagi qiya chiziq — «a» o‘qiladi: بَ = ba' },
    { id: 'kasra', mark: 'ِ', name: 'Kasra', sound: 'i', tip: 'Harf ostidagi qiya chiziq — «i» o‘qiladi: بِ = bi' },
    { id: 'damma', mark: 'ُ', name: 'Damma', sound: 'u', tip: 'Harf ustidagi kichik «vov» — «u» o‘qiladi: بُ = bu' },
    { id: 'sukun', mark: 'ْ', name: 'Sukun', sound: '— (unlisiz)', tip: 'Kichik doira — harf unlisiz o‘qiladi: أَبْ = ab' },
    { id: 'shadda', mark: 'ّ', name: 'Shadda', sound: 'ikkilantirish', tip: 'Harf ikki marta o‘qiladi: رَبَّ = rabba' },
    { id: 'tanvin', mark: 'ً', name: 'Tanvin', sound: 'an / in / un', tip: 'Ikkita harakat — oxiriga «n» qo‘shiladi: كِتَابًا = kitāban' }
  ];

  var LESSONS = [
    { id: 'a0-1', n: 1, title: 'Alif, Bā, Tā, Sā', letters: ['ا', 'ب', 'ت', 'ث'], note: 'Bā, Tā, Sā — bir xil shakl, faqat nuqtalari farq qiladi.' },
    { id: 'a0-2', n: 2, title: 'Jīm, Ḥā, Xā', letters: ['ج', 'ح', 'خ'], note: 'Uchalasi bir shakl: nuqta ichida, nuqtasiz, ustida.' },
    { id: 'a0-3', n: 3, title: 'Dāl, Zāl, Rā, Zāy', letters: ['د', 'ذ', 'ر', 'ز'], note: 'To‘rttalasi ham keyingi harfga ulanmaydi.' },
    { id: 'a0-4', n: 4, title: 'Sīn, Shīn, Sād, Dād', letters: ['س', 'ش', 'ص', 'ض'], note: 'Sād va Dād — qalin tovushlar.' },
    { id: 'a0-5', n: 5, title: 'Tā, Zā, ‘Ayn, G‘ayn', letters: ['ط', 'ظ', 'ع', 'غ'], note: 'Qalin va bo‘g‘iz tovushlari.' },
    { id: 'a0-6', n: 6, title: 'Fā, Qāf, Kāf, Lām', letters: ['ف', 'ق', 'ك', 'ل'], note: 'Fā — bitta nuqta, Qāf — ikkita.' },
    { id: 'a0-7', n: 7, title: 'Mīm, Nūn, Hā, Vāv, Yā', letters: ['م', 'ن', 'ه', 'و', 'ي'], note: 'Alifboning oxirgi harflari.' },
    { id: 'a0-8', n: 8, title: 'Harakatlar: fatha, kasra, damma…', harakat: true, note: 'Harflarni bo‘g‘in qilib o‘qishni o‘rganamiz.' }
  ];
  function byId(id) { return LESSONS.filter(function (l) { return l.id === id; })[0] || null; }

  /* ---- Test savollari (deterministik aralashtirish) ---- */
  function seeded(seed) {
    var h = 2166136261;
    String(seed).split('').forEach(function (c) { h = Math.imul(h ^ c.charCodeAt(0), 16777619); });
    return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /** Bir dars testi. seed har urinishda boshqa — tartib o'zgaradi.
      Javob (answer) faqat serverda qoladi. */
  function buildTest(lesson, seed) {
    var rnd = seeded(lesson.id + ':' + (seed || ''));
    var qs = [];
    if (lesson.harakat) {
      var base = ['ب', 'ت', 'د', 'س', 'ك', 'م', 'ن', 'ل'];
      var trip = [['َ', 'a'], ['ِ', 'i'], ['ُ', 'u']];
      for (var i = 0; i < 8; i++) {
        var b = L(base[i % base.length]);
        var t = trip[Math.floor(rnd() * 3)];
        var lat = b.sound.split(' ')[0].replace('/', '').trim();
        var opts = shuffle(trip.map(function (x) { return lat + x[1]; }), rnd);
        qs.push({ kind: 'read', prompt: 'Qanday o‘qiladi?', show: b.ch + t[0], options: opts, answer: opts.indexOf(lat + t[1]) });
      }
      var hk = shuffle(HARAKAT, rnd).slice(0, 4);
      hk.forEach(function (x) {
        var o = shuffle(HARAKAT.filter(function (y) { return y.id !== x.id; }), rnd).slice(0, 3).concat([x]);
        o = shuffle(o, rnd);
        qs.push({ kind: 'mark', prompt: 'Bu belgi qanday ataladi?', show: 'ب' + x.mark, options: o.map(function (y) { return y.name; }), answer: o.indexOf(x) });
      });
      return shuffle(qs, rnd);
    }
    var own = lesson.letters.map(L);
    var prevIds = [];
    LESSONS.forEach(function (l) { if (l.n < lesson.n && l.letters) prevIds = prevIds.concat(l.letters); });
    var pool = LETTERS.filter(function (x) { return lesson.letters.indexOf(x.ch) < 0; });
    function wrong(x, n) { return shuffle(pool.concat(own.filter(function (y) { return y !== x; })), rnd).slice(0, n || 3); }
    own.forEach(function (x) {
      /* 1) harf → nomi */
      var o1 = shuffle([x].concat(wrong(x)), rnd);
      qs.push({ kind: 'name', prompt: 'Bu qaysi harf?', show: x.ch, options: o1.map(function (y) { return y.name; }), answer: o1.indexOf(x) });
      /* 2) nomi → harf */
      var o2 = shuffle([x].concat(wrong(x)), rnd);
      qs.push({ kind: 'pick', prompt: '«' + x.name + '» harfini toping', options: o2.map(function (y) { return y.ch; }), optionsAr: true, answer: o2.indexOf(x) });
      /* 3) so'z ichidagi shakl → harf (ulanadiganlar uchun o'rtadagi shakli) */
      var f = forms(x);
      var o3 = shuffle([x].concat(wrong(x)), rnd);
      qs.push({ kind: 'form', prompt: 'So‘z ichida shunday yoziladi. Qaysi harf?', show: x.nc ? f.end : f.middle, options: o3.map(function (y) { return y.name; }), answer: o3.indexOf(x) });
    });
    /* oldingi darslardan 2 ta takrorlash savoli */
    shuffle(prevIds, rnd).slice(0, 2).forEach(function (ch) {
      var x = L(ch);
      var o = shuffle([x].concat(shuffle(LETTERS.filter(function (y) { return y !== x; }), rnd).slice(0, 3)), rnd);
      qs.push({ kind: 'name', prompt: 'Takrorlash: bu qaysi harf?', show: x.ch, options: o.map(function (y) { return y.name; }), answer: o.indexOf(x) });
    });
    return shuffle(qs, rnd);
  }
  function publicTest(test) {
    return test.map(function (q) { var c = Object.assign({}, q); delete c.answer; return c; });
  }
  function grade(test, answers) {
    var ok = 0;
    test.forEach(function (q, i) { if (answers && Number(answers[i]) === q.answer) ok++; });
    return { correct: ok, total: test.length, percent: test.length ? Math.round(ok * 100 / test.length) : 0 };
  }

  /** Darslar holati: done | open | locked. progress = { lessons: { id: { best, tries } }, unlocked:{} } */
  function statuses(progress, opts) {
    var pl = (progress && progress.lessons) || {};
    var all = !(opts && opts.allOpen === false);   /* alifbo hammaga ochiq — xohlagan darsga o'tish mumkin */
    var manual = (progress && progress.unlocked) || {};
    var out = {}, prevDone = true;
    LESSONS.forEach(function (l, i) {
      var p = pl[l.id];
      var done = !!(p && p.best != null && p.best >= PASS);
      out[l.id] = done ? 'done' : ((all || i === 0 || prevDone || manual[l.id]) ? 'open' : 'locked');
      prevDone = done;
    });
    return out;
  }
  function view(progress, opts) {
    var st = statuses(progress, opts);
    var pl = (progress && progress.lessons) || {};
    var done = 0;
    var lessons = LESSONS.map(function (l) {
      if (st[l.id] === 'done') done++;
      var p = pl[l.id] || {};
      return { id: l.id, n: l.n, title: l.title, status: st[l.id], best: p.best == null ? null : p.best, last: p.last == null ? null : p.last, tries: p.tries || 0 };
    });
    return { pass: PASS, done: done, total: LESSONS.length, lessons: lessons };
  }

  /* ---- Studiya ovozi (assets/alif): n0..n27 harf nomi, w0..w27 misol so'z,
     s0..s30 bo'g'inlar (SYL tartibida). ---- */
  var SYL = ['بَ', 'بِ', 'بُ', 'تَ', 'تِ', 'تُ', 'دَ', 'دِ', 'دُ', 'سَ', 'سِ', 'سُ', 'كَ', 'كِ', 'كُ', 'مَ', 'مِ', 'مُ', 'نَ', 'نِ', 'نُ', 'لَ', 'لِ', 'لُ',
    'أَبْ', 'أَتْ', 'أَسْ', 'أَمْ', 'أَنْ', 'أَبَّ', 'بًا'];
  /* Bitta harf + sukun/shadda/tanvin — yozuvdagi ko'rinishi → ovozdagi bo'g'in */
  var SYL_ALIAS = { 'بْ': 'أَبْ', 'تْ': 'أَتْ', 'سْ': 'أَسْ', 'مْ': 'أَمْ', 'نْ': 'أَنْ', 'بّ': 'أَبَّ', 'بَّ': 'أَبَّ', 'بً': 'بًا' };
  var HK_SYL = { fatha: 'بَ', kasra: 'بِ', damma: 'بُ', sukun: 'أَبْ', shadda: 'أَبَّ', tanvin: 'بًا' };
  var VOW = { a: 'َ', i: 'ِ', u: 'ُ' };
  /* Qo'shimcha studiya yozuvlari (tekshirilgani qo'shiladi): matn → fayl nomi */
  var STUDIO = {};
  /** Matn → ovoz fayli nomi (yoki null) */
  function audioKey(t) {
    t = String(t || '').replace(/ـ/g, '').trim();
    if (!t) return null;
    var k = LETTERS.map(function (x) { return x.ch; }).indexOf(t);
    if (k >= 0) return 'n' + k;
    k = LETTERS.map(function (x) { return x.ex; }).indexOf(t);
    if (k >= 0) return 'w' + k;
    k = LETTERS.map(function (x) { return x.name; }).indexOf(t);
    if (k >= 0) return 'n' + k;
    var hk = HARAKAT.filter(function (x) { return x.name === t; })[0];
    if (hk) t = HK_SYL[hk.id];
    k = SYL.indexOf(SYL_ALIAS[t] || t);
    if (k === 30) return null;                       /* «بًا» yozuvi xato chiqqan — brauzer ovozi */
    if (k >= 0) return 's' + k;
    return STUDIO[t] || null;
  }
  /** Test variantining ovozi: q — savol, op — variant matni */
  function optionAudio(q, op) {
    if (q && q.kind === 'read') {
      var ch = String(q.show || '').charAt(0), v = String(op || '').slice(-1);
      return VOW[v] ? audioKey(ch + VOW[v]) : null;
    }
    return audioKey(op);
  }

  A.Alifbo = {
    SYL: SYL, audioKey: audioKey, optionAudio: optionAudio, drill: drill, STUDIO: STUDIO,
    PASS: PASS, LETTERS: LETTERS, HARAKAT: HARAKAT, LESSONS: LESSONS,
    byId: byId, letter: L, forms: forms, buildTest: buildTest, publicTest: publicTest,
    grade: grade, statuses: statuses, view: view
  };
})(typeof window !== 'undefined' ? window : globalThis);
