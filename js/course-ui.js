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
    var st = C.statuses(doc);
    return {
      course: { code: C.code, title: C.title, pass: C.PASS },
      lessons: C.LESSONS.map(function (l) {
        var p = doc.lessons[l.id] || {};
        return {
          id: l.id, n: l.n, unit: l.unit, title: l.title, titleAr: l.titleAr, status: st[l.id],
          steps: p.steps || {}, testBest: p.testBest == null ? null : p.testBest, testTries: p.testTries || 0,
          hw: p.hw || null
        };
      })
    };
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
          submittedAt: stampNow(), status: 'tekshirilmoqda', grade: null, comment: '' };
        p.steps = p.steps || {}; p.steps.homework = p.steps.homework || stampNow();
        localSave(sid, doc); return { auto: auto, view: viewOf(doc) };
      },
      upload: async function (f) { return { file: { id: 'loc' + Date.now().toString(36), name: f.name, type: f.type, dataUrl: 'data:' + f.type + ';base64,' + f.data } }; }
    };
  }

  /* ================= Ovoz (talaffuz) ================= */
  var voice = null;
  function pickVoice() {
    try {
      var vs = global.speechSynthesis ? speechSynthesis.getVoices() : [];
      voice = vs.filter(function (v) { return /^ar/i.test(v.lang); })[0] || null;
    } catch (e) { voice = null; }
  }
  if (global.speechSynthesis) { pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { } }
  function say(text, rate) {
    if (!global.speechSynthesis) { UI.toast('Bu brauzerda ovoz yo’q.', 'warn'); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = (voice && voice.lang) || 'ar-SA';
      if (voice) u.voice = voice;
      u.rate = rate || 0.8;
      speechSynthesis.speak(u);
    } catch (e) { }
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
              if (l.status === 'locked') { UI.toast('Bu dars oldingi dars tugagach ochiladi.', 'warn'); return; }
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

    function lessonView(id) { return state.view.lessons.filter(function (l) { return l.id === id; })[0]; }
    function firstStepFor(lv) {
      if (lv.status === 'done') return 'words';
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
      var stepper = h('nav', { class: 'cr-steps' }, C.STEPS.map(function (s, i) {
        var seen = !!lv.steps[s.id];
        return h('button', {
          type: 'button', class: 'cr-step' + (s.id === state.step ? ' on' : '') + (seen ? ' seen' : ''),
          onclick: function () { state.step = s.id; paintMain(); }
        }, [h('span', { class: 'cr-step-n' }, seen ? '✓' : String(i + 1)), h('span', {}, s.label)]);
      }));
      main.appendChild(stepper);
      var body = h('section', { class: 'cr-panel' });
      main.appendChild(body);
      ({ words: stepWords, dialog: stepDialog, grammar: stepGrammar, practice: stepPractice, test: stepTest, homework: stepHomework })[state.step](body, lesson, lv);
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
      body.appendChild(nextBtn('Matnga o’tish', function () { markStep('words'); goStep('dialog'); }));
    }

    /* ---- 2. Matn / dialog ---- */
    function stepDialog(body, lesson) {
      var show = { uz: true };
      var list = h('div', { class: 'cr-dialog' });
      function paint() {
        UI.clear(list);
        lesson.dialog.lines.forEach(function (ln, i) {
          list.appendChild(h('div', { class: 'cr-line ' + (i % 2 ? 'r' : 'l') }, [
            h('span', { class: 'cr-who' }, ln.whoUz),
            h('div', { class: 'cr-bubble' }, [
              h('div', { class: 'cr-bubble-ar' }, [ar(ln.ar, 'md'), sayBtn(ln.ar)]),
              show.uz ? h('div', { class: 'cr-bubble-uz' }, ln.uz) : null
            ])
          ]));
        });
      }
      body.appendChild(h('div', { class: 'cr-ph' }, [
        h('h2', {}, lesson.dialog.title),
        h('p', {}, lesson.dialog.scene),
        h('div', { class: 'rowflex', style: 'gap:8px' }, [
          h('button', { class: 'btn sm', type: 'button', onclick: function () {
            var i = 0; (function next() { if (i >= lesson.dialog.lines.length) return; say(lesson.dialog.lines[i].ar); i++; setTimeout(next, 3200); })();
          } }, [speakerSvg(), 'Butun matnni tinglash']),
          h('button', { class: 'btn sm', type: 'button', onclick: function (e) {
            show.uz = !show.uz; e.currentTarget.textContent = show.uz ? 'Tarjimani yashirish' : 'Tarjimani ko’rsatish'; paint();
          } }, 'Tarjimani yashirish')
        ])
      ]));
      paint();
      body.appendChild(list);
      body.appendChild(nextBtn('Qoidaga o’tish', function () { markStep('dialog'); goStep('grammar'); }));
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
        h('h2', {}, 'Uy vazifasi'),
        h('p', {}, 'Test qismini belgilang, yozma topshiriqni bajaring. Daftaringizda yozgan bo’lsangiz — rasmini yoki PDF ni yuklang.')
      ]));
      if (cur && cur.submittedAt) {
        var stTxt = cur.status === 'qabul' ? 'Ustoz qabul qildi ✓' : (cur.status === 'qayta' ? 'Qayta topshirish kerak' : 'Ustoz tekshirmoqda');
        body.appendChild(h('div', { class: 'cr-hwstat ' + (cur.status || '') }, [
          h('b', {}, stTxt),
          h('span', {}, 'Yuborildi: ' + cur.submittedAt + (cur.auto ? ' · test qismi ' + cur.auto.correct + '/' + cur.auto.total : '')),
          cur.grade ? h('span', {}, 'Baho: ' + cur.grade + ' / 5') : null,
          cur.comment ? h('p', {}, 'Ustoz izohi: ' + cur.comment) : null
        ]));
        if (cur.status !== 'qayta') {
          var nxt = nextLessonId(lesson.id);
          var nv = nxt ? lessonView(nxt) : null;
          body.appendChild(nv && nv.status !== 'locked'
            ? nextBtn('Keyingi darsga o’tish', function () { openLesson(nxt, 'words'); })
            : h('p', { class: 'muted small' }, nxt ? 'Keyingi dars test ' + C.PASS + '% dan o’tilgach ochiladi.' : 'Bu bo’limdagi oxirgi dars. Barakalla!'));
          return;
        }
      } else if (cur && cur.status === 'qayta') {
        body.appendChild(h('div', { class: 'cr-hwstat qayta' }, [h('b', {}, 'Ustoz vazifani qaytardi'), cur.comment ? h('p', {}, 'Izoh: ' + cur.comment) : null]));
      }
      var autoAns = [];
      hw.auto.forEach(function (it, i) {
        body.appendChild(choiceBlock({ q: (i + 1) + '. ' + it.q, options: it.options }, function (k) { autoAns[i] = k; }, { free: true }));
      });
      var texts = hw.write.map(function (wr) {
        var ta = h('textarea', { class: 'cr-ta', rows: 4, dir: 'auto', placeholder: wr.hint || '' });
        body.appendChild(h('div', { class: 'cr-q' }, [h('p', { class: 'cr-q-t' }, '✍️ ' + wr.prompt), ta]));
        return ta;
      });
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
      body.appendChild(h('div', { class: 'cr-q' }, [
        h('p', { class: 'cr-q-t' }, '📎 Daftaringiz rasmi yoki PDF (ixtiyoriy)'),
        h('label', { class: 'btn', for: inp.id }, 'Rasm yoki PDF tanlash'), inp, list
      ]));
      var err = h('div', { class: 'err-msg', hidden: true });
      body.appendChild(err);
      body.appendChild(h('div', { class: 'cr-next' }, h('button', {
        class: 'btn primary lg', type: 'button', onclick: function (e) {
          err.hidden = true;
          var miss = hw.auto.filter(function (x, i) { return autoAns[i] == null; }).length;
          if (miss) { err.hidden = false; err.textContent = 'Test qismidagi barcha savollarni belgilang.'; return; }
          var tv = texts.map(function (t) { return t.value.trim(); });
          if (!tv.some(function (t) { return t.length >= 2; }) && !uploaded.length) {
            err.hidden = false; err.textContent = 'Yozma javob yozing yoki daftaringiz rasmini yuklang.'; return;
          }
          UI.busy(e.currentTarget, async function () {
            try {
              var r = await src.homework(lesson.id, {
                autoAnswers: autoAns, texts: tv,
                fileIds: uploaded.map(function (f) { return f.id; }),
                files: uploaded.map(function (f) { return { name: f.name, dataUrl: f.dataUrl || '' }; })
              });
              state.view = r.view; paintHead(); paintSide();
              UI.toast('Vazifa yuborildi. Test qismi: ' + r.auto.correct + '/' + r.auto.total, 'ok');
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
          h('p', {}, 'Darslarni ko’rish uchun o’quvchi kabinetiga shaxsiy kodingiz bilan kiring.'),
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
      openLesson(lv.id, firstStepFor(lv));
    })();
  }

  A.renderCourse = renderCourse;
  A.CourseLocal = { doc: localDoc, save: localSave, PREFIX: LOCAL_PREFIX, view: function (sid) { return viewOf(localDoc(sid)); } };
})(typeof window !== 'undefined' ? window : globalThis);
