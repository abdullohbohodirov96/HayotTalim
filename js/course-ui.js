/* Onlayn kurs — o'quvchi platformasi (#kurs).
   Darslar ketma-ket ochiladi: so'zlar → matn → qoida → mashq → test → vazifa.
   Server bo'lsa progress serverda (kabinet sessiyasi bilan), demo rejimida —
   brauzerda. Baholash va ochilish qoidasi A.Course da, server ham shuni
   ishlatadi.                                                                  */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, h = UI.h, D = A.Data, C = A.Course;

  /* ================= Ma'lumot manbai ================= */
  var LOCAL_PREFIX = 'kurs_prog_';
  function localDoc(sid) {
    try { var d = JSON.parse(localStorage.getItem(LOCAL_PREFIX + sid) || 'null'); if (d) return d; } catch (e) { }
    return { studentId: sid, lessons: {}, unlocked: {} };
  }
  function localSave(sid, doc) { try { localStorage.setItem(LOCAL_PREFIX + sid, JSON.stringify(doc)); } catch (e) { } }
  function stampNow() { return A.nowStamp ? A.nowStamp() : new Date().toISOString().slice(0, 16).replace('T', ' '); }

  function viewOf(doc) {
    doc.reviews = doc.reviews || {}; doc.vocab = doc.vocab || {};
    return C.buildView(doc, (A.today ? A.today() : new Date().toISOString().slice(0, 10)));
  }

  /** Manba: server (kabinet) yoki demo (brauzer). preview — ustoz ko'rinishi, hammasi ochiq, saqlanmaydi */
  function makeSource(opts) {
    if (opts.preview) {
      var pv = { lessons: {}, unlocked: {} };
      C.LESSONS.forEach(function (l) { pv.unlocked[l.id] = true; });
      return {
        kind: 'preview', canAct: true,
        load: async function () { return viewOf(pv); },
        step: async function () { return { view: viewOf(pv) }; },
        test: async function (lid, answers) { var g = C.gradeTest(C.byId(lid), answers); return { result: g, passed: g.percent >= C.PASS, view: viewOf(pv) }; },
        homework: async function (lid, body) { return { auto: C.gradeHomeworkAuto(C.byId(lid), body.autoAnswers), view: viewOf(pv) }; },
        upload: async function (f) { return { file: { id: 'preview', name: f.name } }; }
      };
    }
    if (D.mode === 'server') {
      return {
        kind: 'server', canAct: true,
        load: async function () {
          /* Sahifa #kurs da yangilansa CSRF siri yo'q bo'ladi — sessiyadan olamiz */
          if (!D.kabCsrf) { var me = await D.api('GET', 'api/kabinet/me'); D.kabCsrf = me.csrf || ''; }
          var d = await D.api('GET', 'api/kabinet/course'); this.canAct = d.canAct !== false; return d;
        },
        step: function (lid, step) { return D.kabPost('api/kabinet/course/step', { lessonId: lid, step: step }); },
        test: function (lid, answers) { return D.kabPost('api/kabinet/course/test', { lessonId: lid, answers: answers }); },
        homework: function (lid, body) { return D.kabPost('api/kabinet/course/homework', Object.assign({ lessonId: lid }, body)); },
        upload: function (f) { return D.kabPost('api/kabinet/course/upload', f); }
      };
    }
    /* Demo: brauzerda */
    var sid = opts.studentId || 'demo';
    return {
      kind: 'local', canAct: true,
      load: async function () { return viewOf(localDoc(sid)); },
      step: async function (lid, step) {
        var doc = localDoc(sid); var p = doc.lessons[lid] = doc.lessons[lid] || {};
        p.steps = p.steps || {}; if (!p.steps[step]) p.steps[step] = stampNow();
        localSave(sid, doc); return { view: viewOf(doc) };
      },
      test: async function (lid, answers) {
        var doc = localDoc(sid); var g = C.gradeTest(C.byId(lid), answers);
        var p = doc.lessons[lid] = doc.lessons[lid] || {};
        p.testLast = g.percent; p.testTries = (p.testTries || 0) + 1;
        if (p.testBest == null || g.percent > p.testBest) p.testBest = g.percent;
        p.steps = p.steps || {}; if (g.percent >= C.PASS && !p.steps.test) p.steps.test = stampNow();
        localSave(sid, doc); return { result: g, passed: g.percent >= C.PASS, view: viewOf(doc) };
      },
      homework: async function (lid, body) {
        var doc = localDoc(sid); var auto = C.gradeHomeworkAuto(C.byId(lid), body.autoAnswers);
        var p = doc.lessons[lid] = doc.lessons[lid] || {};
        p.hw = { auto: auto, autoAnswers: body.autoAnswers, texts: body.texts, fileIds: body.fileIds, files: body.files || [],
          fillAnswers: body.fillAnswers || [], trAnswers: body.trAnswers || [],
          written: C.gradeWritten ? C.gradeWritten(C.byId(lid), body.fillAnswers, body.trAnswers) : null,
          readPercent: body.readPercent == null ? null : body.readPercent,
          submittedAt: stampNow(), status: 'tekshirilmoqda', grade: null, comment: '' };
        p.steps = p.steps || {}; p.steps.homework = p.steps.homework || stampNow();
        localSave(sid, doc); return { auto: auto, view: viewOf(doc) };
      },
      upload: async function (f) { return { file: { id: 'loc' + Date.now().toString(36), name: f.name, type: f.type, dataUrl: 'data:' + f.type + ';base64,' + f.data } }; }
    };
  }

  /* ================= Ovoz (talaffuz) ================= */
  /* Ovoz umumiy modulda (js/speak.js): studiya ovozi → qurilma ovozi */
  A.CourseSay = function (t, r) { return say(t, r); };
  function say(text, rate) {
    if (A.Speak) return A.Speak.say(text, { rate: rate || 0.8 });
  }
  function sayBtn(text, label) {
    return h('button', {
      class: 'cr-say', type: 'button', 'aria-label': label || 'Tinglash',
      onclick: function (e) { e.stopPropagation(); say(text); }
    }, [speakerSvg(), label ? h('span', {}, label) : null]);
  }
  function speakerSvg() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'cr-ico');
    s.innerHTML = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>';
    return s;
  }
  function anim(key, label) {
    var d = h('div', { class: 'cr-anim' });
    d.innerHTML = A.CourseAnim.render(key, label || '');
    return d;
  }
  function ar(text, cls) { return h('span', { class: 'cr-ar ' + (cls || ''), lang: 'ar', dir: 'rtl' }, text); }

  /** Ovozli o'qish tugashini kutish (qissani ketma-ket o'qish uchun) */
  function sayAsync(text, rate, who) {
    return A.Speak ? A.Speak.say(text, { rate: rate || 0.8, who: who }) : Promise.resolve(false);
  }
  function stopSpeech() { if (A.Speak) A.Speak.stop(); }

  /* ---- Nutqni tanish: o'quvchi o'zi o'qiydi, brauzer eshitib tekshiradi ---- */
  var SR = global.SpeechRecognition || global.webkitSpeechRecognition || null;
  function listen(opts) {
    var rec = new SR();
    rec.lang = 'ar-SA';
    rec.continuous = !!opts.continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    var finalText = '';
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i];
        if (r.isFinal) finalText += ' ' + r[0].transcript; else interim += ' ' + r[0].transcript;
      }
      if (opts.onText) opts.onText((finalText + ' ' + interim).trim(), false);
    };
    rec.onerror = function (e) { if (opts.onError) opts.onError(e.error || 'xato'); };
    rec.onend = function () { if (opts.onEnd) opts.onEnd(finalText.trim()); };
    try { rec.start(); } catch (e) { if (opts.onError) opts.onError('start'); }
    return { stop: function () { try { rec.stop(); } catch (e) { } } };
  }
  function srError(code) {
    if (code === 'not-allowed' || code === 'service-not-allowed') return 'Mikrofonga ruxsat bering (brauzer manzil satridagi 🔒 belgisi).';
    if (code === 'no-speech') return 'Ovoz eshitilmadi. Yana bir bor balandroq o’qing.';
    if (code === 'network') return 'Internet kerak: ovozni tekshirish onlayn ishlaydi.';
    return 'Ovozni tekshirib bo’lmadi. Chrome brauzerida urinib ko’ring.';
  }
  /** So'zlarni rangga bo'yab ko'rsatish: yashil — to'g'ri o'qildi, qizil — o'tkazib yuborildi */
  function markedAr(text, marks) {
    var toks = String(text).split(/\s+/);
    var k = 0;
    return h('div', { class: 'cr-marked', dir: 'rtl', lang: 'ar' }, toks.map(function (t) {
      var hasLetters = C.normAr(t).length > 0;
      var m = hasLetters ? marks[k++] : true;
      return h('span', { class: m ? 'g' : 'r' }, t + ' ');
    }));
  }

  /* ---- Ovoz yozish (ustoz eshitishi uchun) ---- */
  function canRecord() { return !!(global.MediaRecorder && global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  async function startRecorder() {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    var type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].filter(function (t) {
      try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; }
    })[0] || '';
    var mr = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    var chunks = [];
    mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mr.start();
    return {
      stop: function () {
        return new Promise(function (resolve) {
          mr.onstop = function () {
            stream.getTracks().forEach(function (t) { t.stop(); });
            resolve(new Blob(chunks, { type: (mr.mimeType || type || 'audio/webm').split(';')[0] }));
          };
          try { mr.stop(); } catch (e) { resolve(new Blob(chunks)); }
        });
      }
    };
  }
  function blobB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.onerror = rej; r.readAsDataURL(blob);
    });
  }

  /* ---- Arab klaviaturasi (telefonda arabcha klaviatura bo'lmasa) ---- */
  var KB_ROWS = ['ض ص ث ق ف غ ع ه خ ح ج', 'ش س ي ب ل ا ت ن م ك ط', 'ذ ء ؤ ر ى ة و ز ظ د', 'أ إ آ ئ لا َ ُ ِ ّ ْ ؟'];
  var kbTarget = null, kbEl = null;
  function kbFocus(el) { el.addEventListener('focus', function () { kbTarget = el; }); }
  function kbInsert(ch) {
    var t = kbTarget; if (!t) { UI.toast('Avval javob maydonini bosing.', 'warn'); return; }
    var a = t.selectionStart == null ? t.value.length : t.selectionStart, b = t.selectionEnd == null ? a : t.selectionEnd;
    if (ch === '⌫') { if (a === b && a > 0) a--; t.value = t.value.slice(0, a) + t.value.slice(b); t.selectionStart = t.selectionEnd = a; }
    else { t.value = t.value.slice(0, a) + ch + t.value.slice(b); t.selectionStart = t.selectionEnd = a + ch.length; }
    try { t.dispatchEvent(new Event('input')); } catch (e) { }
  }
  function keyboardToggle() {
    return h('button', {
      type: 'button', class: 'btn sm cr-kb-btn', onclick: function () {
        if (kbEl && kbEl.parentNode) { kbEl.parentNode.removeChild(kbEl); kbEl = null; document.body.classList.remove('kb-open'); return; }
        kbEl = h('div', { class: 'cr-kb', dir: 'rtl' }, KB_ROWS.map(function (row) {
          return h('div', { class: 'cr-kb-row' }, row.split(' ').map(function (ch) {
            return h('button', { type: 'button', class: 'cr-kb-k', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { kbInsert(ch); } }, ch);
          }));
        }).concat([h('div', { class: 'cr-kb-row' }, [
          h('button', { type: 'button', class: 'cr-kb-k wide', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { kbInsert(' '); } }, 'bo’sh joy'),
          h('button', { type: 'button', class: 'cr-kb-k', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { kbInsert('⌫'); } }, '⌫'),
          h('button', { type: 'button', class: 'cr-kb-k', onclick: function () { if (kbEl && kbEl.parentNode) kbEl.parentNode.removeChild(kbEl); kbEl = null; document.body.classList.remove('kb-open'); } }, '✕')
        ])]));
        document.body.appendChild(kbEl);
        document.body.classList.add('kb-open');
      }
    }, '⌨️ Arab klaviaturasi');
  }

  /**
   * Qissa paneli: tinglash (butun matn — qator-qator ajratib), tezlik, tarjima,
   * har qatorni o'zi o'qib tekshirish (mikrofon).
   * opts: { compact, readCheck, onScore(lineIndex, percent) }
   */
  function storyPanel(lesson, opts) {
    opts = opts || {};
    var lines = lesson.dialog.lines;
    var st = { uz: !opts.compact, rate: 0.8, playing: false, scores: {} };
    var wrap = h('div', { class: 'cr-story' + (opts.compact ? ' compact' : '') });
    var list = h('div', { class: 'cr-dialog' });
    var rows = [];
    var playBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: function () { st.playing ? stopAll() : playAll(); } });
    function setPlay() { UI.clear(playBtn); playBtn.appendChild(speakerSvg()); playBtn.appendChild(document.createTextNode(st.playing ? ' To’xtatish' : ' Qissani tinglash')); }
    setPlay();
    async function playAll() {
      st.playing = true; setPlay();
      stopSpeech();
      for (var i = 0; i < lines.length && st.playing; i++) {
        rows.forEach(function (r, k) { r.classList.toggle('now', k === i); });
        if (!opts.compact) { try { rows[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { } }
        await sayAsync(lines[i].ar, st.rate, i % 2 ? 'B' : 'A');
        await new Promise(function (r) { setTimeout(r, 350); });
      }
      rows.forEach(function (r) { r.classList.remove('now'); });
      st.playing = false; setPlay();
    }
    function stopAll() { st.playing = false; stopSpeech(); setPlay(); rows.forEach(function (r) { r.classList.remove('now'); }); }

    function paint() {
      UI.clear(list); rows = [];
      lines.forEach(function (ln, i) {
        var res = h('div', { class: 'cr-readres' });
        if (st.scores[i]) { res.appendChild(markedAr(ln.ar, st.scores[i].marks)); res.appendChild(h('span', { class: 'cr-readpct ' + (st.scores[i].percent >= 70 ? 'ok' : 'bad') }, st.scores[i].percent + '%')); }
        var mic = (opts.readCheck && SR) ? h('button', {
          class: 'cr-say mic', type: 'button', 'aria-label': 'O’zim o’qiyman',
          onclick: function (e) {
            e.stopPropagation();
            var b = e.currentTarget;
            if (b.classList.contains('rec')) return;
            stopAll();
            b.classList.add('rec');
            UI.clear(res); res.appendChild(h('span', { class: 'cr-listen' }, '🎤 Eshitayapman… gapni o’qing'));
            var ctl = listen({
              onText: function (t) { UI.clear(res); res.appendChild(h('span', { class: 'cr-listen', dir: 'rtl' }, t || '…')); },
              onError: function (code) { b.classList.remove('rec'); UI.clear(res); res.appendChild(h('span', { class: 'cr-readpct bad' }, srError(code))); },
              onEnd: function (t) {
                b.classList.remove('rec');
                if (!t) return;
                var c = C.compareAr(ln.ar, t);
                st.scores[i] = c;
                UI.clear(res); res.appendChild(markedAr(ln.ar, c.marks));
                res.appendChild(h('span', { class: 'cr-readpct ' + (c.percent >= 70 ? 'ok' : 'bad') }, c.percent >= 90 ? c.percent + '% — a’lo!' : c.percent >= 70 ? c.percent + '% — yaxshi' : c.percent + '% — yana urinib ko’ring'));
                if (opts.onScore) opts.onScore(i, c.percent, st.scores);
              }
            });
            setTimeout(function () { ctl.stop(); }, 9000);
          }
        }, '🎤') : null;
        var row = h('div', { class: 'cr-line ' + (i % 2 ? 'r' : 'l') }, [
          h('span', { class: 'cr-who' }, ln.whoUz),
          h('div', { class: 'cr-bubble' }, [
            h('div', { class: 'cr-bubble-ar' }, [ar(ln.ar, opts.compact ? '' : 'md'), sayBtn(ln.ar), mic]),
            st.uz ? h('div', { class: 'cr-bubble-uz' }, ln.uz) : null,
            res
          ])
        ]);
        rows.push(row);
        list.appendChild(row);
      });
    }
    var rateBtn = h('button', { class: 'btn sm', type: 'button', onclick: function (e) {
      st.rate = st.rate === 0.8 ? 0.55 : 0.8; e.currentTarget.textContent = st.rate === 0.8 ? '🐢 Sekinroq' : '🐇 Oddiy tezlik';
    } }, '🐢 Sekinroq');
    var trBtn = h('button', { class: 'btn sm', type: 'button', onclick: function (e) {
      st.uz = !st.uz; e.currentTarget.textContent = st.uz ? 'Tarjimani yashirish' : 'Tarjimani ko’rsatish'; paint();
    } }, st.uz ? 'Tarjimani yashirish' : 'Tarjimani ko’rsatish');
    wrap.appendChild(h('div', { class: 'cr-story-bar' }, [playBtn, rateBtn, trBtn]));
    paint();
    wrap.appendChild(list);
    wrap.stop = stopAll;
    return wrap;
  }

  /* ================= Asosiy sahifa ================= */
  function renderCourse(opts) {
    opts = opts || {};
    var wrap = document.getElementById('auth');
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    if (A._ctaOff) { A._ctaOff(); A._ctaOff = null; }
    wrap.hidden = false;
    wrap.className = 'cr';
    UI.clear(wrap);

    var src = makeSource(opts);
    if (A.Speak) A.Speak.loadMap();
    var state = { view: null, lessonId: null, step: 'words' };

    var head = h('header', { class: 'cr-top' });
    var side = h('aside', { class: 'cr-side' });
    var main = h('main', { class: 'cr-main' });
    wrap.appendChild(head);
    wrap.appendChild(h('div', { class: 'cr-body' }, [side, main]));

    function paintHead() {
      UI.clear(head);
      var v = state.view;
      var done = v ? v.lessons.filter(function (l) { return l.status === 'done'; }).length : 0;
      var total = C.LESSONS.length;
      var pct = Math.round(done * 100 / total);
      head.appendChild(h('div', { class: 'cr-top-in' }, [
        h('button', { class: 'cr-brand', type: 'button', onclick: function () { location.hash = ''; A.renderLanding(); } }, [
          h('img', { src: A.LOGO || '', alt: '' }),
          h('div', {}, [h('b', {}, 'Onlayn darsxona'), h('span', {}, C.title)])
        ]),
        opts.preview ? h('span', { class: 'cr-chip warn' }, 'Ustoz ko’rinishi — natija saqlanmaydi') : null,
        opts.studentName ? h('span', { class: 'cr-chip' }, opts.studentName) : null,
        h('div', { class: 'cr-progress', title: done + ' / ' + total + ' dars' }, [
          h('div', { class: 'cr-bar' }, h('i', { style: 'width:' + pct + '%' })),
          h('span', {}, done + '/' + total + ' dars')
        ]),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { if (opts.onExit) opts.onExit(); else { location.hash = 'kabinet'; A.renderKabinet && A.renderKabinet(); } }
        }, opts.preview ? 'Yopish' : 'Kabinet')
      ]));
    }

    function paintSide() {
      UI.clear(side);
      var v = state.view;
      C.UNITS.forEach(function (u) {
        side.appendChild(h('div', { class: 'cr-unit' }, [
          h('span', { class: 'cr-unit-n' }, u.n + '-bo’lim'),
          h('b', {}, u.title), ar(u.ar, 'sm')
        ]));
        v.lessons.filter(function (l) { return l.unit === u.id; }).forEach(function (l) {
          var cur = l.id === state.lessonId;
          var icon = l.status === 'done' ? '✓' : (l.status === 'locked' ? '🔒' : String(l.n));
          side.appendChild(h('button', {
            type: 'button', class: 'cr-lesson ' + l.status + (cur ? ' cur' : ''),
            'aria-disabled': l.status === 'locked' ? 'true' : 'false',
            onclick: function () {
              if (l.status === 'locked') { UI.toast(gateMsg(l.id), 'warn'); return; }
              openLesson(l.id, firstStepFor(l));
            }
          }, [
            h('span', { class: 'cr-lesson-ico' }, icon),
            h('span', { class: 'cr-lesson-t' }, [h('b', {}, l.n + '. ' + l.title), ar(l.titleAr, 'sm')]),
            l.testBest != null ? h('span', { class: 'cr-lesson-s' }, l.testBest + '%') : null
          ]));
        });
      });
      side.appendChild(h('div', { class: 'cr-rule' }, [
        h('b', {}, 'Qanday ochiladi?'),
        h('p', {}, 'Har darsda so’z testidan ' + C.PASS + '% to’plang va uy vazifasini yuboring — keyingi dars o’zi ochiladi.')
      ]));
      /* Telefonda (gorizontal lenta) joriy darsni ko'rinadigan joyga suramiz */
      var curEl = side.querySelector('.cr-lesson.cur');
      if (curEl && side.scrollWidth > side.clientWidth) {
        side.scrollLeft = Math.max(0, curEl.offsetLeft - side.offsetLeft - 16);
      }
    }

    /** Dars nega yopiq: oldingi dars yoki takrorlash testi */
    function gateMsg(id) {
      var i = C.indexOf(id);
      var gate = i > 0 && C.reviewAfter ? C.reviewAfter(C.LESSONS[i - 1].id) : null;
      var prev = i > 0 ? lessonView(C.LESSONS[i - 1].id) : null;
      if (gate && prev && prev.status === 'done') return 'Avval «' + gate.title + '» testini topshiring (Kabinet → Lug’at yodlash).';
      return 'Bu dars oldingi dars va vazifa tugagach ochiladi.';
    }
    function goReview(rid) {
      try { sessionStorage.setItem('kab_b', 'lugat'); } catch (e) { }
      location.hash = 'kabinet?b=lugat&rv=' + rid;
      if (A.renderKabinet) A.renderKabinet();
    }
    function lessonView(id) { return state.view.lessons.filter(function (l) { return l.id === id; })[0]; }
    function firstStepFor(lv) {
      if (lv.status === 'done') return 'video';
      var order = C.STEPS.map(function (s) { return s.id; });
      for (var i = 0; i < order.length; i++) if (!lv.steps[order[i]]) return order[i];
      return 'homework';
    }

    function openLesson(id, step) {
      state.lessonId = id; state.step = step || 'words';
      try { sessionStorage.setItem('kurs_last', id); } catch (e) { }
      paintSide(); paintMain();
      main.scrollTop = 0; window.scrollTo({ top: 0 });
    }

    async function markStep(step) {
      if (src.kind === 'preview') return;
      try { var r = await src.step(state.lessonId, step); if (r && r.view) { state.view = r.view; paintHead(); paintSide(); } } catch (e) { }
    }

    function paintMain() {
      if (kbEl && kbEl.parentNode) { kbEl.parentNode.removeChild(kbEl); kbEl = null; document.body.classList.remove('kb-open'); }
      UI.clear(main);
      var lesson = C.byId(state.lessonId);
      var lv = lessonView(lesson.id);
      var unit = C.unitOf(lesson);
      main.appendChild(h('div', { class: 'cr-lhead' }, [
        h('div', {}, [
          h('span', { class: 'cr-eyebrow' }, unit.n + '-bo’lim · ' + unit.title + ' · ' + lesson.n + '-dars'),
          h('h1', {}, [lesson.title, ' ', ar(lesson.titleAr)]),
          h('p', { class: 'cr-goal' }, lesson.goal)
        ])
      ]));
      /* Bosqichlar */
      function stepBtn(s, i) {
        var seen = !!lv.steps[s.id];
        return h('button', {
          type: 'button', class: 'cr-step' + (s.id === state.step ? ' on' : '') + (seen ? ' seen' : ''),
          onclick: function () { stopSpeech(); state.step = s.id; paintMain(); }
        }, [h('span', { class: 'cr-step-n' }, seen ? '✓' : String(i + 1)), h('span', {}, s.label)]);
      }
      var inClass = C.STEPS.filter(function (s) { return s.part !== 'uyda'; });
      var atHome = C.STEPS.filter(function (s) { return s.part === 'uyda'; });
      var stepper = h('nav', { class: 'cr-steps grouped' }, [
        h('div', { class: 'cr-stepgrp' }, [h('span', { class: 'cr-stepgrp-t' }, '📖 Darsda'), h('div', { class: 'cr-stepgrp-b' }, inClass.map(function (s) { return stepBtn(s, C.STEPS.indexOf(s)); }))]),
        h('div', { class: 'cr-stepgrp home' }, [h('span', { class: 'cr-stepgrp-t' }, '🏠 Uyda'), h('div', { class: 'cr-stepgrp-b' }, atHome.map(function (s) { return stepBtn(s, C.STEPS.indexOf(s)); }))])
      ]);
      main.appendChild(stepper);
      /* Telefonda joriy bosqich ko'rinadigan joyga suriladi */
      setTimeout(function () {
        var on = stepper.querySelector('.cr-step.on');
        if (on && stepper.scrollWidth > stepper.clientWidth) stepper.scrollLeft = Math.max(0, on.offsetLeft - stepper.offsetLeft - 40);
      }, 0);
      var body = h('section', { class: 'cr-panel' });
      main.appendChild(body);
      ({ video: stepVideo, words: stepWords, dialog: stepDialog, grammar: stepGrammar, practice: stepPractice, test: stepTest, homework: stepHomework })[state.step](body, lesson, lv);
    }

    function nextBtn(label, onClick) {
      return h('div', { class: 'cr-next' }, h('button', { class: 'btn primary lg', type: 'button', onclick: onClick }, [label, ' →']));
    }
    function goStep(step) { state.step = step; paintMain(); main.scrollIntoView({ block: 'start' }); }

    /* ---- 1. So'zlar ---- */
    function stepWords(body, lesson) {
      body.appendChild(h('div', { class: 'cr-ph' }, [
        h('h2', {}, 'Yangi so’zlar'),
        h('p', {}, 'Har bir so’zni tinglang va animatsiyaga qarab ma’nosini eslab qoling.'),
        h('button', { class: 'btn sm', type: 'button', onclick: function () {
          var i = 0; (function next() { if (i >= lesson.words.length) return; say(lesson.words[i].ar); i++; setTimeout(next, 1900); })();
        } }, [speakerSvg(), 'Hammasini tinglash'])
      ]));
      body.appendChild(h('div', { class: 'cr-words' }, lesson.words.map(function (wd) {
        return h('div', { class: 'cr-word', tabindex: '0', onclick: function () { say(wd.ar); } }, [
          anim(wd.anim, wd.uz),
          h('div', { class: 'cr-word-txt' }, [
            ar(wd.ar, 'lg'),
            h('span', { class: 'cr-tr' }, wd.tr),
            h('b', { class: 'cr-uz' }, wd.uz)
          ]),
          sayBtn(wd.ar)
        ]);
      })));
      body.appendChild(nextBtn('Qoidaga o’tish', function () { markStep('words'); goStep('grammar'); }));
    }

    /* ---- 2. Qissa: tinglash, o'zi o'qib tekshirish ---- */
    /* ---- 1. Video: darsga kirgan o'quvchi avval qissani videoda ko'radi ---- */
    function stepVideo(body, lesson) {
      body.appendChild(h('div', { class: 'cr-ph' }, [
        h('span', { class: 'cr-eyebrow dark' }, 'Darsda · 1-qadam'),
        h('h2', {}, '🎬 ' + lesson.dialog.title + ' — videoni ko’ring'),
        h('p', {}, 'Avval qissani videoda tomosha qiling: kim nima deyotganini harakatdan tushunasiz. Keyin qissani o’zingiz o’qiysiz.')
      ]));
      var vbox = h('div', { class: 'cr-video' });
      body.appendChild(vbox);
      (async function () {
        /* Markaz yuklagan MP4 bo'lsa — o'sha; bo'lmasa harakatli sahna (ovoz bilan) */
        var mp4 = null;
        if (D.mode === 'server') { try { var vi = await D.api('GET', 'api/lesson-video?l=' + encodeURIComponent(lesson.id) + '&info=1'); if (vi && vi.has) mp4 = 'api/lesson-video?l=' + encodeURIComponent(lesson.id); } catch (e) { } }
        var anim = h('div', {});
        function mountAnim() {
          if (anim.firstChild) return;
          var have = { lines: [], words: [] };
          (async function () {
            if (D.mode === 'server') { try { have = await D.api('GET', 'api/qissa-audio?l=' + encodeURIComponent(lesson.id)); } catch (e) { } }
            var sc = A.QissaVideo.scriptFor(lesson);
            A.QissaVideo.mount(anim, lesson, {
              audioUrl: function (i) { return have.lines.indexOf(i) >= 0 ? 'api/qissa-audio?l=' + lesson.id + '&i=' + i : null; },
              wordUrl: function (text) {
                var k = sc.recap ? sc.recap.words.map(function (w) { return w[0]; }).indexOf(text) : -1;
                return k >= 0 && have.words.indexOf(k) >= 0 ? 'api/qissa-audio?l=' + lesson.id + '&w=' + k : null;
              },
              onEnd: function () { markStep('video'); }
            });
          })();
        }
        if (mp4) {
          var vid = h('video', { class: 'cr-mp4', controls: true, playsinline: true, preload: 'metadata', src: mp4 });
          vid.addEventListener('ended', function () { markStep('video'); });
          vbox.appendChild(vid);
          vbox.appendChild(h('button', { class: 'btn sm', type: 'button', style: 'margin-top:8px', onclick: function (e) {
            e.currentTarget.remove(); vid.pause(); vid.hidden = true; vbox.appendChild(anim); mountAnim();
          } }, 'Harakatli versiyani ochish (takrorlash rejimi bilan)'));
        } else if (A.QissaVideo) { vbox.appendChild(anim); mountAnim(); }
      })();
      body.appendChild(nextBtn('Qissani o’qishga o’tish', function () { stopSpeech(); markStep('video'); goStep('dialog'); }));
    }

    function stepDialog(body, lesson) {
      var sum = h('div', { class: 'cr-readsum', hidden: true });
      body.appendChild(h('div', { class: 'cr-ph' }, [
        h('span', { class: 'cr-eyebrow dark' }, 'Darsda · qissa'),
        h('h2', {}, lesson.dialog.title),
        h('p', {}, lesson.dialog.scene)
      ]));
      body.appendChild(h('div', { class: 'cr-howread' }, [
        h('b', {}, '1. Tinglang'), h('span', {}, ' — «Qissani tinglash»: har bir gap navbat bilan o’qiladi va belgilanadi. '),
        h('b', {}, '2. O’zingiz o’qing'), h('span', {}, SR ? ' — gap yonidagi 🎤 ni bosib, ovoz chiqarib o’qing: to’g’ri o’qilgan so’zlar yashil, xatolari qizil bo’ladi.' : ' — ovoz chiqarib o’qing. (Talaffuzni avtomatik tekshirish Chrome brauzerida ishlaydi.)')
      ]));
      var panel = storyPanel(lesson, {
        readCheck: true,
        onScore: function (i, pct, all) {
          var ks = Object.keys(all);
          var avg = Math.round(ks.reduce(function (a, k) { return a + all[k].percent; }, 0) / ks.length);
          sum.hidden = false; UI.clear(sum);
          sum.appendChild(h('b', {}, 'O’qish natijasi: ' + avg + '%'));
          sum.appendChild(h('span', {}, ks.length + ' / ' + lesson.dialog.lines.length + ' gap tekshirildi'));
        }
      });
      body.appendChild(panel);
      body.appendChild(sum);
      body.appendChild(nextBtn('Yangi so’zlarga o’tish', function () { panel.stop(); markStep('dialog'); goStep('words'); }));
    }

    /* ---- 3. Qoida ---- */
    function stepGrammar(body, lesson) {
      body.appendChild(h('div', { class: 'cr-ph' }, [h('h2', {}, lesson.grammar.title), h('p', {}, 'Qoidani o’qing va misollarni tinglang.')]));
      lesson.grammar.points.forEach(function (pt, i) {
        body.appendChild(h('div', { class: 'cr-rulecard' }, [
          h('span', { class: 'cr-rulecard-n' }, String(i + 1)),
          h('div', {}, [
            h('p', {}, pt.rule),
            h('div', { class: 'cr-ex' }, pt.ex.map(function (ex) {
              return h('div', { class: 'cr-ex-row' }, [ar(ex.ar, 'md'), h('span', {}, ex.uz), sayBtn(ex.ar.replace(/←/g, '،'))]);
            }))
          ])
        ]));
      });
      body.appendChild(nextBtn('Mashqqa o’tish', function () { markStep('grammar'); goStep('practice'); }));
    }

    /* ---- 4. Mashq (darhol tekshiriladi) ---- */
    function choiceBlock(item, onAnswer, opt) {
      opt = opt || {};
      var done = false;
      var box = h('div', { class: 'cr-q' });
      box.appendChild(h('p', { class: 'cr-q-t' }, item.q || item.prompt));
      if (item.show) box.appendChild(h('div', { class: 'cr-q-show' }, [ar(item.show, 'xl'), sayBtn(item.show)]));
      if (item.anim) box.appendChild(anim(item.anim));
      var opts = h('div', { class: 'cr-opts' + (item.optionsAr || isAr(item.options) ? ' ar' : '') });
      item.options.forEach(function (o, i) {
        var b = h('button', { type: 'button', class: 'cr-opt' }, isAr([o]) ? ar(o, 'md') : o);
        b.addEventListener('click', function () {
          if (done && !opt.free) return;
          if (opt.free) {
            Array.prototype.forEach.call(opts.children, function (x) { x.classList.remove('sel'); });
            b.classList.add('sel'); onAnswer(i); return;
          }
          done = true;
          var ok = i === item.answer;
          b.classList.add(ok ? 'ok' : 'bad');
          if (!ok && opts.children[item.answer]) opts.children[item.answer].classList.add('ok');
          onAnswer(i, ok);
        });
        opts.appendChild(b);
      });
      box.appendChild(opts);
      return box;
    }
    function isAr(list) { return (list || []).some(function (s) { return /[؀-ۿ]/.test(String(s)); }); }

    function orderBlock(item, onDone) {
      var picked = [];
      var pool = item.words.slice().sort(function (a, b) { return a.length - b.length || (a < b ? 1 : -1); });
      var box = h('div', { class: 'cr-q' }, [h('p', { class: 'cr-q-t' }, 'So’zlarni tartib bilan tering: «' + item.uz + '»')]);
      var line = h('div', { class: 'cr-order-line', dir: 'rtl' });
      var bank = h('div', { class: 'cr-order-bank', dir: 'rtl' });
      var res = h('div', { class: 'cr-q-res' });
      function paint() {
        UI.clear(line); UI.clear(bank);
        picked.forEach(function (wd, i) {
          line.appendChild(h('button', { type: 'button', class: 'cr-tok on', onclick: function () { picked.splice(i, 1); paint(); } }, ar(wd, 'md')));
        });
        pool.forEach(function (wd) {
          if (picked.indexOf(wd) >= 0) return;
          bank.appendChild(h('button', { type: 'button', class: 'cr-tok', onclick: function () {
            picked.push(wd); paint();
            if (picked.length === item.words.length) {
              var ok = C.checkPractice(item, picked);
              res.textContent = ok ? 'To’g’ri! ✓' : 'Tartib noto’g’ri. To’g’risi: ' + item.words.join(' ');
              res.className = 'cr-q-res ' + (ok ? 'ok' : 'bad');
              if (ok) say(item.words.join(' '));
              onDone(ok);
            }
          } }, ar(wd, 'md')));
        });
      }
      paint();
      box.appendChild(line); box.appendChild(bank); box.appendChild(res);
      return box;
    }

    function stepPractice(body, lesson) {
      var score = 0, answered = 0, total = lesson.practice.length;
      var bar = h('div', { class: 'cr-score' });
      function upd() { bar.textContent = 'Natija: ' + score + ' / ' + total + (answered === total ? (score === total ? ' — a’lo!' : ' — xatolarni qayta ko’rib chiqing') : ''); }
      body.appendChild(h('div', { class: 'cr-ph' }, [h('h2', {}, 'Savol-javob mashqi'), h('p', {}, 'Har bir javob darhol tekshiriladi. Bu bosqich baholanmaydi.')]));
      lesson.practice.forEach(function (it) {
        if (it.type === 'order') {
          body.appendChild(orderBlock(it, function (ok) { answered++; if (ok) score++; upd(); }));
        } else {
          body.appendChild(choiceBlock(it, function (i, ok) {
            answered++; if (ok) score++; upd();
            var opt = it.options[i]; if (isAr([opt])) say(opt);
          }));
        }
      });
      upd();
      body.appendChild(bar);
      body.appendChild(nextBtn('So’z testiga o’tish', function () { markStep('practice'); goStep('test'); }));
    }

    /* ---- 5. So'z testi ---- */
    function stepTest(body, lesson, lv) {
      var test = C.buildTest(lesson);
      var answers = [], idx = 0;
      body.appendChild(h('div', { class: 'cr-ph' }, [
        h('h2', {}, 'So’z testi'),
        h('p', {}, test.length + ' ta savol. O’tish uchun kamida ' + C.PASS + '% to’plang. ' +
          (lv.testBest != null ? 'Eng yaxshi natijangiz: ' + lv.testBest + '%.' : ''))
      ]));
      var holder = h('div');
      body.appendChild(holder);
      function q() {
        UI.clear(holder);
        if (idx >= test.length) return finish();
        var item = test[idx];
        holder.appendChild(h('div', { class: 'cr-testbar' }, [
          h('div', { class: 'cr-bar' }, h('i', { style: 'width:' + Math.round(idx * 100 / test.length) + '%' })),
          h('span', {}, (idx + 1) + ' / ' + test.length)
        ]));
        var chosen = null;
        var blk = choiceBlock({ prompt: item.prompt, show: item.show, anim: item.anim, options: item.options, optionsAr: item.optionsAr },
          function (i) { chosen = i; nb.disabled = false; }, { free: true });
        holder.appendChild(blk);
        var nb = h('button', { class: 'btn primary lg', type: 'button', disabled: true, onclick: function () {
          answers.push(chosen); idx++; q();
        } }, idx === test.length - 1 ? 'Yakunlash' : 'Keyingi savol');
        holder.appendChild(h('div', { class: 'cr-next' }, nb));
      }
      async function finish() {
        UI.clear(holder);
        holder.appendChild(h('p', { class: 'muted' }, 'Natija hisoblanmoqda…'));
        try {
          var r = await src.test(lesson.id, answers);
          state.view = r.view; paintHead(); paintSide();
          UI.clear(holder);
          var pass = r.passed;
          holder.appendChild(h('div', { class: 'cr-result ' + (pass ? 'ok' : 'bad') }, [
            h('div', { class: 'cr-result-big' }, r.result.percent + '%'),
            h('b', {}, pass ? 'Test topshirildi!' : 'Hali yetarli emas'),
            h('p', {}, r.result.correct + ' / ' + r.result.total + ' to’g’ri. ' +
              (pass ? 'Endi uy vazifasini bajaring.' : 'So’zlarni yana takrorlang va qayta urinib ko’ring.')),
            h('div', { class: 'rowflex', style: 'gap:8px;justify-content:center' }, [
              h('button', { class: 'btn', type: 'button', onclick: function () { goStep(pass ? 'test' : 'words'); } }, pass ? 'Qayta topshirish' : 'So’zlarni takrorlash'),
              pass ? h('button', { class: 'btn primary', type: 'button', onclick: function () { goStep('homework'); } }, 'Uy vazifasiga o’tish →')
                : h('button', { class: 'btn primary', type: 'button', onclick: function () { goStep('test'); } }, 'Qayta urinish')
            ])
          ]));
        } catch (e) {
          UI.clear(holder);
          holder.appendChild(h('div', { class: 'banner bad' }, h('div', {}, e.message || 'Natija saqlanmadi.')));
        }
      }
      q();
    }

    /* ---- 6. Uy vazifasi ---- */
    function stepHomework(body, lesson, lv) {
      var hw = lesson.homework;
      var cur = lv.hw;
      body.appendChild(h('div', { class: 'cr-ph' }, [
        h('span', { class: 'cr-eyebrow dark' }, 'Uyda · mustaqil'),
        h('h2', {}, 'Uy vazifasi'),
        h('p', {}, 'Qissa tepada turadi — unga qarab mashqlarni bajaring. Daftarga yozgan bo’lsangiz, oxirida rasmini yoki PDF ni yuklang.')
      ]));
      if (cur && cur.submittedAt) {
        var stTxt = cur.status === 'qabul' ? 'Ustoz qabul qildi ✓' : (cur.status === 'qayta' ? 'Qayta topshirish kerak' : 'Ustoz tekshirmoqda');
        body.appendChild(h('div', { class: 'cr-hwstat ' + (cur.status || '') }, [
          h('b', {}, stTxt),
          h('span', {}, 'Yuborildi: ' + cur.submittedAt + (cur.auto ? ' · test qismi ' + cur.auto.correct + '/' + cur.auto.total : '')),
          cur.written ? h('span', {}, 'Bo’sh joy: ' + cur.written.fillOk + '/' + cur.written.fillTotal + ' · tarjima ' + cur.written.trPercent + '%' + (cur.readPercent != null ? ' · o’qish ' + cur.readPercent + '%' : '')) : null,
          cur.grade ? h('span', {}, 'Baho: ' + cur.grade + ' / 5') : null,
          cur.comment ? h('p', {}, 'Ustoz izohi: ' + cur.comment) : null
        ]));
        if (cur.status !== 'qayta') {
          var nxt = nextLessonId(lesson.id);
          var nv = nxt ? lessonView(nxt) : null;
          var gateRv = C.reviewAfter ? C.reviewAfter(lesson.id) : null;
          var gateOpen = gateRv && lv.status === 'done' && !(state.view.reviews || []).some(function (r) { return r.id === gateRv.id && r.status === 'done'; });
          body.appendChild(gateOpen && src.kind !== 'preview'
            ? h('div', { class: 'cr-gate' }, [
              h('b', {}, '🔁 ' + gateRv.title + ' vaqti!'),
              h('span', {}, gateRv.sub + ' bo’yicha qisqa test. ' + C.PASS + '% dan o’tsangiz keyingi dars ochiladi.'),
              h('button', { class: 'btn primary lg', type: 'button', onclick: function () { goReview(gateRv.id); } }, 'Takrorlash testiga o’tish →')
            ])
            : nv && nv.status !== 'locked'
              ? nextBtn('Keyingi darsga o’tish', function () { openLesson(nxt, 'video'); })
              : h('p', { class: 'muted small' }, nxt ? 'Keyingi dars test ' + C.PASS + '% dan o’tilgach ochiladi.' : 'Bu bo’limdagi oxirgi dars. Barakalla!'));
          return;
        }
      } else if (cur && cur.status === 'qayta') {
        body.appendChild(h('div', { class: 'cr-hwstat qayta' }, [h('b', {}, 'Ustoz vazifani qaytardi'), cur.comment ? h('p', {}, 'Izoh: ' + cur.comment) : null]));
      }
      /* Qissa doim tepada ko'rinib turadi — vazifa pastda */
      var pinBody = storyPanel(lesson, { compact: true });
      var pin = h('div', { class: 'cr-pin' }, [
        h('div', { class: 'cr-pin-h' }, [h('b', {}, '📖 Qissa: ' + lesson.dialog.title), h('button', { type: 'button', class: 'cr-pin-tg', onclick: function (e) {
          pin.classList.toggle('min'); e.currentTarget.textContent = pin.classList.contains('min') ? 'Ochish ▾' : 'Yig’ish ▴';
        } }, 'Yig’ish ▴')]),
        pinBody
      ]);
      body.appendChild(pin);
      body.appendChild(h('div', { class: 'cr-kbbar' }, [h('span', { class: 'small muted' }, 'Telefoningizda arabcha harf bo’lmasa:'), keyboardToggle()]));
      var exN = 0;
      function exCard(title, sub, kids) {
        exN++;
        return h('section', { class: 'cr-ex-card' }, [
          h('div', { class: 'cr-ex-h' }, [h('span', { class: 'cr-ex-n' }, exN + '-mashq'), h('div', {}, [h('b', {}, title), sub ? h('span', {}, sub) : null])])
        ].concat(kids));
      }

      /* 1. Ovoz chiqarib o'qish: yozib olinadi (ustoz eshitadi) va avtomatik tekshiriladi */
      var reading = { percent: null, fileId: null };
      if (canRecord() || SR) {
        var rStat = h('div', { class: 'cr-readres' });
        var rBtn = h('button', { type: 'button', class: 'btn primary' }, '🎤 O’qishni boshlash');
        var recCtl = null, srCtl = null, heard = '';
        rBtn.addEventListener('click', async function () {
          if (recCtl || srCtl) {
            rBtn.disabled = true; rBtn.textContent = 'Saqlanmoqda…';
            if (srCtl) srCtl.stop();
            var blob = recCtl ? await recCtl.stop() : null;
            recCtl = null;
            setTimeout(async function () {
              srCtl = null;
              UI.clear(rStat);
              var full = lesson.dialog.lines.map(function (l) { return l.ar; }).join(' ');
              if (heard) {
                var c = C.compareAr(full, heard);
                reading.percent = c.percent;
                rStat.appendChild(h('span', { class: 'cr-readpct ' + (c.percent >= 70 ? 'ok' : 'bad') }, 'Talaffuz: ' + c.percent + '%'));
                rStat.appendChild(markedAr(full, c.marks));
              }
              if (blob && blob.size > 800) {
                rStat.appendChild(h('audio', { controls: true, src: URL.createObjectURL(blob), class: 'cr-audio' }));
                try {
                  var b64 = await blobB64(blob);
                  var up = await src.upload({ name: 'oqish-' + lesson.id + '.' + (/mp4/.test(blob.type) ? 'm4a' : 'webm'), type: blob.type || 'audio/webm', data: b64 });
                  reading.fileId = up.file.id; reading.file = up.file;
                  rStat.appendChild(h('span', { class: 'small muted' }, '✓ Ovozingiz saqlandi — ustoz eshitadi.'));
                } catch (ex) { rStat.appendChild(h('span', { class: 'small muted' }, 'Ovoz yuklanmadi: ' + (ex.message || ''))); }
              }
              rBtn.disabled = false; rBtn.textContent = '🎤 Qaytadan o’qish';
            }, 600);
            return;
          }
          heard = '';
          UI.clear(rStat); rStat.appendChild(h('span', { class: 'cr-listen' }, '🔴 Yozilmoqda… qissani boshidan oxirigacha o’qing, keyin «Tugatdim» ni bosing.'));
          try { if (canRecord()) recCtl = await startRecorder(); } catch (e) { recCtl = null; }
          if (SR) srCtl = listen({ continuous: true, onText: function (t) { heard = t; }, onEnd: function (t) { if (t) heard = t; }, onError: function () { } });
          if (!recCtl && !srCtl) { UI.clear(rStat); rStat.appendChild(h('span', { class: 'cr-readpct bad' }, 'Mikrofonga ruxsat bering.')); return; }
          rBtn.textContent = '⏹ Tugatdim';
        });
        body.appendChild(exCard('Qissani ovoz chiqarib o’qing', 'Ovozingiz yozib olinadi va ustozga boradi' + (SR ? '; talaffuz avtomatik tekshiriladi' : ''), [
          h('div', { class: 'cr-q' }, [rBtn, rStat])
        ]));
      }

      /* 2. Qissa bo'yicha savollar (tanlash) */
      var autoAns = [];
      body.appendChild(exCard('Qissa bo’yicha savollar', 'To’g’ri javobni belgilang', hw.auto.map(function (it, i) {
        return choiceBlock({ q: (i + 1) + '. ' + it.q, options: it.options }, function (k) { autoAns[i] = k; }, { free: true });
      })));

      /* 3. Bo'sh joyni to'ldiring (yozish) — kitobdagidek */
      var wr = C.buildWritten ? C.buildWritten(lesson) : { fill: [], tr: [] };
      var fillInputs = wr.fill.map(function (f) {
        var inp = h('input', { type: 'text', class: 'cr-fill-in', dir: 'rtl', lang: 'ar', autocomplete: 'off', placeholder: '…' });
        kbFocus(inp);
        return { f: f, inp: inp };
      });
      /* Yordam darhol berilmaydi: o'quvchi avval o'zi urinadi. Xato tekshirsa yoki
         40 soniya o'tsa «💡 Yordam» chiqadi; har bosishda bittadan kuchliroq ishora. */
      function hintBox(levels, onUse) {
        var used = 0;
        var area = h('div', { class: 'cr-hints' });
        var btn = h('button', { type: 'button', class: 'cr-hint-btn', hidden: true, onclick: function () {
          if (used >= levels.length) return;
          var lv = levels[used++];
          area.appendChild(typeof lv === 'function' ? lv() : h('div', { class: 'cr-hint' }, lv));
          if (onUse) onUse(used);
          btn.textContent = used >= levels.length ? '💡 Yordam tugadi' : '💡 Yana yordam (' + used + '/' + levels.length + ')';
          if (used >= levels.length) btn.disabled = true;
        } }, '💡 Yordam');
        var timer = setTimeout(function () { btn.hidden = false; }, 40000);
        return { btn: btn, area: area, show: function () { btn.hidden = false; }, done: function () { clearTimeout(timer); btn.hidden = true; }, used: function () { return used; } };
      }
      function sameWord(a, b) {
        var x = C.normAr(a).replace(/^ال/, ''), y = C.normAr(b).replace(/^ال/, '');
        return !!x && (x === y || (y.length > 3 && C.compareAr(y, x).percent === 100));
      }
      if (fillInputs.length) {
        body.appendChild(exCard('Bo’sh joyga mos so’zni yozing', 'Qissadagi gaplar — tushib qolgan so’zni arabcha yozing. Avval o’zingiz urinib ko’ring, qiyin bo’lsa «💡 Yordam» chiqadi.', fillInputs.map(function (x, i) {
          var parts = x.f.text.split('_____');
          var plain = C.normAr(x.f.answer);
          var hb = hintBox([
            'Gapning tarjimasi: «' + x.f.uz + '»',
            'So’zning ma’nosi: «' + x.f.hint + '»',
            'Birinchi harfi: «' + plain.charAt(0) + '» · jami ' + plain.replace(/\s/g, '').length + ' ta harf',
            function () { return h('div', { class: 'cr-hint' }, [h('span', {}, 'So’zni tinglang va yozing: '), h('button', { type: 'button', class: 'cr-say', onclick: function () { say(x.f.answer); } }, speakerSvg())]); }
          ], function (n) { x.hints = n; });
          var mark = h('span', { class: 'cr-fill-mark' });
          var chk = h('button', { type: 'button', class: 'btn sm', onclick: function () {
            var v = x.inp.value.trim();
            if (!v) { x.inp.focus(); return; }
            if (sameWord(v, x.f.answer)) {
              mark.textContent = '✓ To’g’ri!'; mark.className = 'cr-fill-mark ok'; x.inp.classList.add('ok'); x.inp.classList.remove('bad'); hb.done();
            } else {
              x.tries = (x.tries || 0) + 1;
              mark.textContent = '✗ Yana urinib ko’ring'; mark.className = 'cr-fill-mark bad'; x.inp.classList.add('bad'); hb.show();
            }
          } }, 'Tekshirish');
          x.inp.addEventListener('input', function () { mark.textContent = ''; x.inp.classList.remove('ok', 'bad'); });
          x.inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); chk.click(); } });
          return h('div', { class: 'cr-fill' }, [
            h('div', { class: 'cr-fill-ar', dir: 'rtl', lang: 'ar' }, [h('span', { class: 'cr-fill-n' }, (i + 1) + '.'), parts[0], x.inp, parts[1] || '']),
            h('div', { class: 'cr-fill-ctl' }, [chk, mark, hb.btn]),
            hb.area
          ]);
        })));
      }

      /* 4. Tarjima: o'zbekchadan arabchaga yozing */
      var trInputs = wr.tr.map(function (t) {
        var ta = h('textarea', { class: 'cr-ta', rows: 2, dir: 'rtl', lang: 'ar', placeholder: 'arabcha yozing…' });
        kbFocus(ta);
        return { t: t, ta: ta };
      });
      if (trInputs.length) {
        body.appendChild(exCard('Arabchaga tarjima qiling', 'Qissadagi gaplarni eslab, arabcha yozing. Tekshirib ko’ring — qiyin bo’lsa yordam chiqadi.', trInputs.map(function (x, i) {
          var words = String(x.t.ar).split(/\s+/);
          var hb = hintBox([
            'Birinchi so’zi: «' + words[0] + '»',
            'Gapda ' + words.length + ' ta so’z bor. Boshlanishi: «' + words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(' ') + ' …»',
            function () { return h('div', { class: 'cr-hint' }, [h('span', {}, 'Gapni tinglang va yozing: '), h('button', { type: 'button', class: 'cr-say', onclick: function () { say(x.t.ar); } }, speakerSvg())]); }
          ], function (n) { x.hints = n; });
          var res = h('div', { class: 'cr-tr-res' });
          var chk = h('button', { type: 'button', class: 'btn sm', onclick: function () {
            var v = x.ta.value.trim(); if (!v) { x.ta.focus(); return; }
            var c = C.compareAr(x.t.ar, v);
            UI.clear(res);
            if (c.percent === 100) { res.appendChild(h('span', { class: 'cr-fill-mark ok' }, '✓ A’lo, to’liq to’g’ri!')); hb.done(); }
            else {
              res.appendChild(h('span', { class: 'cr-fill-mark ' + (c.percent >= 70 ? 'ok' : 'bad') }, c.percent + '% to’g’ri — yashil so’zlar to’g’ri, qolganini to’g’rilang'));
              /* To'g'ri yozilgan so'zlar ko'rinadi, qolgani bo'sh joy — javob oshkor bo'lmaydi */
              var k = 0;
              res.appendChild(h('div', { class: 'cr-marked', dir: 'rtl', lang: 'ar' }, String(x.t.ar).split(/\s+/).map(function (w) {
                var okw = C.normAr(w) ? c.marks[k++] : true;
                return h('span', { class: okw ? 'g' : 'gap' }, okw ? w + ' ' : '＿＿＿ ');
              })));
              hb.show();
            }
          } }, 'Tekshirish');
          return h('div', { class: 'cr-q' }, [h('p', { class: 'cr-q-t' }, (i + 1) + '. «' + x.t.uz + '»'), x.ta,
            h('div', { class: 'cr-fill-ctl' }, [chk, hb.btn]), res, hb.area]);
        })));
      }

      /* 5. Yozma ish */
      var texts = hw.write.map(function (wrt) {
        var ta = h('textarea', { class: 'cr-ta', rows: 4, dir: 'auto', placeholder: wrt.hint || '' });
        kbFocus(ta);
        return { wr: wrt, ta: ta };
      });
      body.appendChild(exCard('Yozma ish', 'O’zingiz haqingizda yozing (daftarga yozsangiz — rasmini pastda yuklang)', texts.map(function (x) {
        return h('div', { class: 'cr-q' }, [h('p', { class: 'cr-q-t' }, '✍️ ' + x.wr.prompt), x.ta]);
      })));
      texts = texts.map(function (x) { return x.ta; });

      /* Fayl yuklash: rasm yoki PDF */
      var uploaded = [];
      var list = h('div', { class: 'cr-files' });
      var inp = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,application/pdf', multiple: true, class: 'cr-file-in', id: 'cr-file-' + lesson.id });
      inp.addEventListener('change', async function () {
        var fs = Array.prototype.slice.call(inp.files || []);
        for (var i = 0; i < fs.length; i++) {
          var f = fs[i];
          if (f.size > 9 * 1024 * 1024) { UI.toast(f.name + ': 9 MB dan katta.', 'warn'); continue; }
          var row = h('div', { class: 'cr-file' }, [h('span', {}, f.name), h('span', { class: 'muted small' }, 'yuklanmoqda…')]);
          list.appendChild(row);
          try {
            var data = await shrink(f);
            var r = await src.upload({ name: f.name, type: data.type, data: data.b64 });
            uploaded.push(r.file);
            row.lastChild.textContent = '✓ yuklandi';
          } catch (e) { row.lastChild.textContent = e.message || 'yuklanmadi'; }
        }
        inp.value = '';
      });
      body.appendChild(exCard('Daftar rasmi yoki PDF', 'Ixtiyoriy: daftarga yozganlaringizni rasmga olib yuklang', [h('div', { class: 'cr-q' }, [
        h('label', { class: 'btn', for: inp.id }, '📷 Rasm yoki PDF tanlash'), inp, list
      ])]));
      var err = h('div', { class: 'err-msg', hidden: true });
      body.appendChild(err);
      body.appendChild(h('div', { class: 'cr-next' }, h('button', {
        class: 'btn primary lg', type: 'button', onclick: function (e) {
          err.hidden = true;
          var miss = hw.auto.filter(function (x, i) { return autoAns[i] == null; }).length;
          if (miss) { err.hidden = false; err.textContent = '2-mashq: barcha savollarni belgilang.'; return; }
          var tv = texts.map(function (t) { return t.value.trim(); });
          var fa = fillInputs.map(function (x) { return x.inp.value.trim(); });
          var ta2 = trInputs.map(function (x) { return x.ta.value.trim(); });
          if (fa.filter(Boolean).length < Math.min(2, fa.length) && !uploaded.length) {
            err.hidden = false; err.textContent = 'Bo’sh joyni to’ldirish mashqini bajaring (yoki daftar rasmini yuklang).'; return;
          }
          if (!tv.some(function (t) { return t.length >= 2; }) && !uploaded.length && !ta2.some(Boolean)) {
            err.hidden = false; err.textContent = 'Yozma ishni yozing yoki daftaringiz rasmini yuklang.'; return;
          }
          if (reading.fileId) uploaded.push(reading.file);
          UI.busy(e.currentTarget, async function () {
            try {
              var r = await src.homework(lesson.id, {
                autoAnswers: autoAns, texts: tv, fillAnswers: fa, trAnswers: ta2, readPercent: reading.percent,
                hints: { fill: fillInputs.map(function (x) { return x.hints || 0; }), tr: trInputs.map(function (x) { return x.hints || 0; }) },
                fileIds: uploaded.map(function (f) { return f.id; }),
                files: uploaded.map(function (f) { return { name: f.name, dataUrl: f.dataUrl || '' }; })
              });
              state.view = r.view; paintHead(); paintSide();
              try { if (kbEl && kbEl.parentNode) kbEl.parentNode.removeChild(kbEl); kbEl = null; document.body.classList.remove('kb-open'); } catch (e2) { }
              UI.toast('Vazifa yuborildi. Savollar: ' + r.auto.correct + '/' + r.auto.total, 'ok');
              goStep('homework');
            } catch (ex) { err.hidden = false; err.textContent = ex.message || 'Yuborilmadi.'; }
          });
        }
      }, 'Vazifani yuborish')));
    }
    function nextLessonId(id) { var i = C.indexOf(id); return C.LESSONS[i + 1] ? C.LESSONS[i + 1].id : null; }

    /* Rasmni kichraytirish (telefondagi 5–10 MB surat → ~1 MB), PDF o'zgarmaydi */
    function shrink(file) {
      return new Promise(function (resolve, reject) {
        var rd = new FileReader();
        rd.onerror = function () { reject(new Error('Fayl o’qilmadi')); };
        rd.onload = function () {
          var url = String(rd.result);
          if (!/^image\//.test(file.type)) { resolve({ type: file.type, b64: url.split(',')[1] }); return; }
          var img = new Image();
          img.onload = function () {
            var max = 1600, w = img.width, hh = img.height, k = Math.min(1, max / Math.max(w, hh));
            var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(hh * k);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            var out = cv.toDataURL('image/jpeg', 0.82);
            resolve({ type: 'image/jpeg', b64: out.split(',')[1] });
          };
          img.onerror = function () { resolve({ type: file.type, b64: url.split(',')[1] }); };
          img.src = url;
        };
        rd.readAsDataURL(file);
      });
    }

    /* ---- Yuklash ---- */
    main.appendChild(h('p', { class: 'muted', style: 'padding:24px' }, 'Darslar yuklanmoqda…'));
    (async function () {
      try {
        state.view = await src.load();
      } catch (e) {
        UI.clear(main);
        main.appendChild(h('div', { class: 'cr-panel' }, [
          h('h2', {}, 'Kirish kerak'),
          h('p', {}, 'Darslarni ko’rish uchun o’quvchi kabinetiga login va parolingiz bilan kiring.'),
          h('button', { class: 'btn primary', type: 'button', onclick: function () { location.hash = 'kabinet'; A.renderKabinet(); } }, 'Kabinetga kirish')
        ]));
        return;
      }
      var last = null;
      try { last = sessionStorage.getItem('kurs_last'); } catch (e) { }
      var lv = last && lessonView(last);
      if (!lv || lv.status === 'locked') {
        lv = state.view.lessons.filter(function (l) { return l.status === 'open'; })[0] || state.view.lessons[0];
      }
      paintHead();
      var wantStep = null;
      /* Sahifa ikki marta chizilishi mumkin (hash + to'g'ridan-to'g'ri chaqiruv) — biroz kutib o'chiramiz */
      try { wantStep = sessionStorage.getItem('kurs_step'); setTimeout(function () { try { sessionStorage.removeItem('kurs_step'); } catch (e) { } }, 2500); } catch (e) { }
      var okStep = wantStep && C.STEPS.some(function (x) { return x.id === wantStep; }) && lv.id === last;
      openLesson(lv.id, okStep ? wantStep : firstStepFor(lv));
    })();
  }

  A.renderCourse = renderCourse;
  A.CourseLocal = {
    doc: localDoc, save: localSave, PREFIX: LOCAL_PREFIX,
    view: function (sid) { return viewOf(localDoc(sid)); },
    /* demo: takrorlash va lug'at (server mantiqi bilan bir xil) */
    review: function (sid, rid, answers) {
      var doc = localDoc(sid); doc.reviews = doc.reviews || {}; doc.vocab = doc.vocab || {};
      var rv = C.reviewById(rid); var g = C.gradeReview(rv, answers);
      var r = doc.reviews[rid] = doc.reviews[rid] || {};
      r.last = g.percent; r.tries = (r.tries || 0) + 1; if (r.best == null || g.percent > r.best) r.best = g.percent;
      var today = A.today ? A.today() : new Date().toISOString().slice(0, 10);
      C.buildReview(rv).forEach(function (q) { C.vocabUpdate(doc.vocab, q.key, g.wrong.indexOf(q.key) < 0, today); });
      localSave(sid, doc);
      return { result: g, passed: g.percent >= C.PASS, view: viewOf(doc) };
    },
    vocab: function (sid, items) {
      var doc = localDoc(sid); doc.vocab = doc.vocab || {};
      var today = A.today ? A.today() : new Date().toISOString().slice(0, 10);
      (items || []).forEach(function (it) { C.vocabUpdate(doc.vocab, it.key, !!it.ok, today); });
      localSave(sid, doc); return { view: viewOf(doc) };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
