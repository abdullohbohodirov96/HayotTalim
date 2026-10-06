/* ERP: Onlayn kurs — ustoz va admin paneli.
   — Tekshirish kerak: o'quvchilar yuborgan uy vazifalari (matn, rasm, PDF),
     avtomatik test qismi natijasi; «Qabul» (baho, izoh) yoki «Qayta topshirsin».
   — O'quvchilar: kim qaysi darsda, test natijalari; istalgan darsga o'tkazish.
   — Darslarni o'quvchi ko'rinishida ochib ko'rish.
   Ustoz faqat o'z guruhlaridagi o'quvchilarni ko'radi (server cheklaydi). */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, h = UI.h, D = A.Data, C = A.Course;

  /* ---------- Manba: server yoki demo (brauzer) ---------- */
  function localOverview() {
    var studs = D.all('students').filter(function (s) { return s.status === 'faol'; });
    var rows = studs.map(function (s) {
      var doc = A.CourseLocal.doc(s.id);
      var st = C.statuses(doc);
      var done = 0, current = null, pending = [], lessons = {};
      C.LESSONS.forEach(function (l) {
        if (st[l.id] === 'done') done++;
        if (!current && st[l.id] === 'open') current = l.id;
        var p = doc.lessons[l.id] || {};
        if (p.hw && p.hw.submittedAt && p.hw.status === 'tekshirilmoqda') {
          pending.push({ lessonId: l.id, title: l.title, n: l.n, submittedAt: p.hw.submittedAt, auto: p.hw.auto,
            texts: p.hw.texts || [], fileIds: p.hw.fileIds || [], files: p.hw.files || [],
            written: p.hw.written || null, readPercent: p.hw.readPercent == null ? null : p.hw.readPercent,
            fillAnswers: p.hw.fillAnswers || [], trAnswers: p.hw.trAnswers || [] });
        }
        lessons[l.id] = { status: st[l.id], testBest: p.testBest == null ? null : p.testBest, hw: p.hw || null };
      });
      var groups = A.Q ? A.Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; })
        .map(function (m) { var g = D.one('groups', m.groupId); return g ? { id: g.id, name: g.name } : null; }).filter(Boolean) : [];
      return { studentId: s.id, name: s.lastName + ' ' + s.firstName, groups: groups, done: done, total: C.LESSONS.length, current: current, pending: pending, lessons: lessons };
    });
    rows.sort(function (a, b) { return (b.pending.length - a.pending.length) || a.name.localeCompare(b.name); });
    return { rows: rows, lessons: C.LESSONS.map(function (l) { return { id: l.id, n: l.n, title: l.title }; }) };
  }
  var Src = {
    overview: async function () { return D.mode === 'server' ? D.api('GET', 'api/course/overview') : localOverview(); },
    review: async function (body) {
      if (D.mode === 'server') return D.api('POST', 'api/course/review', body);
      var doc = A.CourseLocal.doc(body.studentId);
      var p = doc.lessons[body.lessonId];
      if (!p || !p.hw) throw new Error('Vazifa topilmadi.');
      p.hw.status = body.decision; p.hw.comment = body.comment || '';
      p.hw.grade = body.decision === 'qabul' ? (Number(body.grade) || null) : null;
      p.hw.reviewedAt = A.nowStamp();
      if (body.decision === 'qayta') p.hw.submittedAt = null;
      A.CourseLocal.save(body.studentId, doc);
      return { ok: true };
    },
    move: async function (body) {
      if (D.mode === 'server') return D.api('POST', 'api/course/move', body);
      var doc = A.CourseLocal.doc(body.studentId);
      doc.unlocked = {};
      var idx = C.indexOf(body.lessonId);
      for (var i = 0; i <= idx; i++) doc.unlocked[C.LESSONS[i].id] = true;
      A.CourseLocal.save(body.studentId, doc);
      return { ok: true };
    }
  };

  function lessonName(id) { var l = C.byId(id); return l ? l.n + '. ' + l.title : '—'; }

  A.Pages.course = function (view, route, App) {
    App.guard('lesson.log');
    var tab = route.tab || 'tekshirish';
    view.appendChild(UI.pageHead('Onlayn kurs', C.title + ' · ' + C.LESSONS.length + ' ta dars, darslar ketma-ket ochiladi', [
      h('button', {
        class: 'btn', onclick: function () {
          A.renderCourse({
            preview: true,
            onExit: function () {
              document.getElementById('auth').hidden = true;
              document.getElementById('app').hidden = false;
              App.go('course');
            }
          });
        }
      }, [UI.icon('play'), 'Darslarni ko’rish (o’quvchi ko’rinishi)']),
      D.mode === 'server' && (App.can('settings.edit') || App.can('curriculum.edit')) ? h('button', {
        class: 'btn', onclick: function () { ttsModal(); }
      }, '🎙 Ovoz va video') : null
    ]));
    var body = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    view.appendChild(body);

    (async function () {
      var data;
      try { data = await Src.overview(); }
      catch (e) { UI.clear(body); body.appendChild(UI.empty({ title: 'Ma’lumot olinmadi', text: e.message })); return; }
      UI.clear(body);
      var rows = data.rows || [];
      var pendingAll = [];
      rows.forEach(function (r) { r.pending.forEach(function (p) { pendingAll.push({ r: r, p: p }); }); });

      var tiles = h('div', { class: 'tiles' });
      tiles.appendChild(UI.tile({ label: 'Tekshirish kerak', value: pendingAll.length, hint: 'uy vazifasi' }));
      tiles.appendChild(UI.tile({ label: 'O’quvchilar', value: rows.length, hint: 'kursda' }));
      var avg = rows.length ? Math.round(rows.reduce(function (s, r) { return s + r.done; }, 0) / rows.length * 10) / 10 : 0;
      tiles.appendChild(UI.tile({ label: 'O’rtacha o’tilgan dars', value: avg, hint: 'jami ' + C.LESSONS.length }));
      body.appendChild(tiles);

      body.appendChild(UI.tabs([
        { id: 'tekshirish', label: 'Tekshirish kerak (' + pendingAll.length + ')' },
        { id: 'oquvchilar', label: 'O’quvchilar va darslar' },
        { id: 'fayllar', label: 'O’quvchilar fayllari' }
      ], tab, function (id) { App.go('course', { tab: id }); }));

      if (tab === 'fayllar') {
        var fbox = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
        body.appendChild(UI.card(null, fbox, null, null, true));
        (async function () {
          var fr;
          try { fr = D.mode === 'server' ? await D.api('GET', 'api/course/files') : { files: [] }; }
          catch (e) { UI.clear(fbox); fbox.appendChild(h('p', { class: 'err-msg' }, e.message || 'Yuklanmadi.')); return; }
          UI.clear(fbox);
          if (!fr.files.length) { fbox.appendChild(UI.empty({ title: 'Fayl yo’q', text: 'O’quvchilar kabinetdagi «Fayllarim» bo’limidan yuborgan fayllar shu yerda ko’rinadi.' })); return; }
          fbox.appendChild(UI.table([
            { label: 'O’quvchi', render: function (f) { return h('b', {}, f.studentName); } },
            { label: 'Fayl', render: function (f) {
              var url = 'api/file?id=' + encodeURIComponent(f.id);
              if (/^audio\//.test(f.type)) return h('audio', { controls: true, preload: 'none', src: url, class: 'cr-audio' });
              return h('a', { href: url, target: '_blank', rel: 'noopener' }, f.name);
            } },
            { label: 'Turi', render: function (f) { return f.purpose === 'kurs-vazifa' ? UI.pill('Uy vazifasi', 'ok') : UI.pill('Fayl', 'mute'); } },
            { label: 'Izoh', render: function (f) { return h('span', { class: 'small' }, f.note || '—'); } },
            { label: 'Vaqt', render: function (f) { return h('span', { class: 'small muted' }, f.at); } }
          ], fr.files, { page: 50 }));
        })();
        return;
      }

      if (tab === 'tekshirish') {
        if (!pendingAll.length) {
          body.appendChild(UI.card(null, UI.empty({ title: 'Hammasi tekshirilgan', text: 'O’quvchilar yangi vazifa yuborganda shu yerda paydo bo’ladi va Telegramga xabar keladi.' })));
          return;
        }
        pendingAll.forEach(function (x) { body.appendChild(reviewCard(x.r, x.p, App)); });
      } else {
        body.appendChild(UI.card(null, UI.table([
          { label: 'O’quvchi', render: function (r) { return h('div', {}, [h('b', {}, r.name), h('div', { class: 'small muted' }, (r.groups || []).map(function (g) { return g.name; }).join(', ') || '—')]); } },
          { label: 'Hozirgi dars', render: function (r) { return r.current ? lessonName(r.current) : (r.done === r.total ? UI.pill('Kurs tugadi', 'ok') : '—'); } },
          {
            label: 'Taraqqiyot', render: function (r) {
              var pct = Math.round(r.done * 100 / r.total);
              return h('div', { class: 'cr-mini' }, [h('div', { class: 'cr-bar' }, h('i', { style: 'width:' + pct + '%' })), h('span', { class: 'small' }, r.done + '/' + r.total)]);
            }
          },
          {
            label: 'Darslar', render: function (r) {
              return h('div', { class: 'cr-dots' }, (data.lessons || []).map(function (l) {
                var x = r.lessons[l.id] || {};
                var cls = x.status === 'done' ? 'ok' : (x.status === 'open' ? 'open' : 'lock');
                return h('span', { class: 'cr-dot ' + cls, title: l.n + '-dars: ' + (x.testBest != null ? x.testBest + '%' : 'test yo’q') }, String(l.n));
              }));
            }
          },
          { label: 'Takrorlash · lug’at', render: function (r) {
            return h('div', {}, [
              h('div', { class: 'cr-dots' }, (r.reviews || []).map(function (rv) {
                return h('span', { class: 'cr-dot ' + (rv.status === 'done' ? 'ok' : rv.status === 'open' ? 'open' : 'lock'), title: rv.title + (rv.best != null ? ': ' + rv.best + '%' : '') }, 'T' + rv.n);
              })),
              r.vocab ? h('div', { class: 'small muted' }, r.vocab.learned + '/' + r.vocab.total + ' so’z yodlangan') : null
            ]);
          } },
          { label: 'Kutilmoqda', render: function (r) { return r.pending.length ? UI.pill(r.pending.length + ' vazifa', 'warn') : h('span', { class: 'muted' }, '—'); } },
          {
            label: '', right: true, render: function (r) {
              return h('button', { class: 'btn sm', onclick: function () { moveForm(r, data.lessons, App); } }, 'Darsga o’tkazish');
            }
          }
        ], rows, { page: 100 }), null, null, true));
      }
    })();
  };

  function fileLinks(p) {
    var out = [];
    (p.files || []).forEach(function (f) {
      if (f.dataUrl && /^data:image\//.test(f.dataUrl)) out.push(h('a', { href: f.dataUrl, target: '_blank', class: 'cr-thumb' }, h('img', { src: f.dataUrl, alt: f.name })));
      else if (f.dataUrl && /^data:audio\//.test(f.dataUrl)) out.push(h('audio', { controls: true, src: f.dataUrl, class: 'cr-audio' }));
      else if (f.name && !f.id) out.push(h('span', { class: 'pill mute' }, f.name));
    });
    if (D.mode === 'server') {
      var metas = {};
      (p.files || []).forEach(function (f) { if (f.id) metas[f.id] = f; });
      (p.fileIds || []).forEach(function (id, i) {
        var m = metas[id] || {};
        var url = 'api/file?id=' + encodeURIComponent(id);
        if (/^audio\//.test(m.type || '')) out.push(h('div', { class: 'cr-audio-w' }, [h('span', { class: 'small muted' }, '🎤 Qissani o’qishi:'), h('audio', { controls: true, preload: 'none', src: url, class: 'cr-audio' })]));
        else if (/^image\//.test(m.type || '')) out.push(h('a', { href: url, target: '_blank', rel: 'noopener', class: 'cr-thumb' }, h('img', { src: url, alt: m.name || '', loading: 'lazy' })));
        else out.push(h('a', { class: 'btn sm', href: url, target: '_blank', rel: 'noopener' }, [UI.icon('down'), m.name || ('Fayl ' + (i + 1))]));
      });
    }
    return out.length ? h('div', { class: 'cr-filelinks' }, out) : null;
  }

  /* Bo'sh joy va tarjima javoblari — to'g'ri javob yonida */
  function writtenBlock(lesson, p) {
    if (!C.buildWritten || (!(p.fillAnswers || []).length && !(p.trAnswers || []).length)) return null;
    var w = C.buildWritten(lesson);
    var rows = [];
    w.fill.forEach(function (f, i) {
      var a = (p.fillAnswers || [])[i] || '';
      var ok = a && C.normAr(a) === C.normAr(f.answer);
      rows.push(h('div', { class: 'cr-wr ' + (ok ? 'ok' : 'no') }, [
        h('span', { class: 'cr-ar', dir: 'rtl' }, f.text.replace('_____', '[' + (a || '—') + ']')),
        ok ? h('span', { class: 'small' }, '✓') : h('span', { class: 'small muted' }, 'to’g’risi: ' + f.answer)
      ]));
    });
    w.tr.forEach(function (t, i) {
      var a = (p.trAnswers || [])[i] || '';
      var c = C.compareAr(t.ar, a);
      rows.push(h('div', { class: 'cr-wr ' + (c.percent >= 70 ? 'ok' : 'no') }, [
        h('span', { class: 'small muted' }, '«' + t.uz + '» →'),
        h('span', { class: 'cr-ar', dir: 'rtl' }, a || '—'),
        h('span', { class: 'small muted' }, c.percent + '%')
      ]));
    });
    return h('div', { class: 'cr-wrs' }, rows);
  }

  function reviewCard(r, p, App) {
    var lesson = C.byId(p.lessonId);
    var grade = UI.field({ label: 'Baho', type: 'select', value: '5', options: [5, 4, 3, 2, 1].map(function (n) { return { value: String(n), label: String(n) }; }) });
    var comment = UI.field({ label: 'Izoh (o’quvchiga boradi)', type: 'textarea', placeholder: 'Masalan: Barakalla! هَذِهِ so’zini to’g’ri ishlatgansiz.' });
    function act(decision, btn) {
      UI.busy(btn, async function () {
        try {
          await Src.review({ studentId: r.studentId, lessonId: p.lessonId, decision: decision, grade: grade.input.value, comment: comment.input.value });
          UI.toast(decision === 'qabul' ? 'Qabul qilindi. O’quvchiga xabar ketdi.' : 'Qayta topshirishga qaytarildi.', 'ok');
          App.render();
        } catch (e) { UI.toast(e.message || 'Saqlanmadi', 'bad'); }
      });
    }
    return UI.card(null, h('div', { class: 'cr-review' }, [
      h('div', { class: 'cr-review-head' }, [
        h('div', {}, [h('b', {}, r.name), h('div', { class: 'small muted' }, lesson.n + '-dars «' + lesson.title + '» · yuborildi ' + p.submittedAt)]),
        p.auto ? UI.pill('Test qismi: ' + p.auto.correct + '/' + p.auto.total, p.auto.percent >= 80 ? 'ok' : 'warn') : null
      ]),
      h('div', { class: 'rowflex', style: 'gap:6px;flex-wrap:wrap;margin:4px 0' }, [
        p.readPercent != null ? UI.pill('🎤 O’qish: ' + p.readPercent + '%', p.readPercent >= 70 ? 'ok' : 'warn') : null,
        p.written ? UI.pill('To’ldirish: ' + p.written.fillOk + '/' + p.written.fillTotal, p.written.fillOk >= p.written.fillTotal - 1 ? 'ok' : 'warn') : null,
        p.written ? UI.pill('Tarjima: ' + p.written.trPercent + '%', p.written.trPercent >= 70 ? 'ok' : 'warn') : null
      ]),
      writtenBlock(lesson, p),
      h('div', { class: 'cr-review-task' }, lesson.homework.write.map(function (wr) { return h('div', { class: 'small muted' }, 'Topshiriq: ' + wr.prompt); })),
      (p.texts || []).filter(function (t) { return t && t.trim(); }).length
        ? h('div', { class: 'cr-review-text', dir: 'auto' }, p.texts.filter(function (t) { return t && t.trim(); }).join('\n\n'))
        : h('p', { class: 'small muted' }, 'Yozma javob yo’q — faylni ko’ring.'),
      fileLinks(p),
      h('div', { class: 'form-grid' }, [grade.wrap, comment.wrap]),
      h('div', { class: 'rowflex', style: 'gap:8px;justify-content:flex-end' }, [
        h('button', { class: 'btn', onclick: function (e) { act('qayta', e.currentTarget); } }, 'Qayta topshirsin'),
        h('button', { class: 'btn primary', onclick: function (e) { act('qabul', e.currentTarget); } }, 'Qabul qilish')
      ])
    ]));
  }

  /* Dars ovozlari (ElevenLabs) va dars videolari (MP4) */
  function ttsModal() {
    var list = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    var timers = [];
    UI.modal({
      title: 'Dars ovozlari va videolari',
      body: [
        h('p', { class: 'small muted' }, 'Ovoz: darsning barcha so’zlari, qissa gaplari (Maryam va Zaynab ovozida) va qoida misollari studiya ovozida yoziladi — o’quvchi «🔊» ni bosganda shu ovoz chalinadi, qurilmada arabcha ovoz bo’lishi shart emas. ' +
          'Serverda ELEVENLABS_API_KEY kerak; har yaratish ElevenLabs kreditini sarflaydi (bir dars ≈ 25–30 ta qisqa ovoz).'),
        h('p', { class: 'small muted' }, 'Video: MP4 (60 MB gacha) yuklasangiz, o’quvchi darsni shu videodan boshlaydi. Yuklanmasa — harakatli sahna ko’rsatiladi.'),
        list
      ],
      actions: [{ label: 'Yopish', onClick: function (close) { timers.forEach(clearInterval); close(); } }]
    });
    UI.clear(list);
    C.LESSONS.forEach(function (l) {
      var aStat = h('span', { class: 'small muted' }, '…');
      var vStat = h('span', { class: 'small muted' }, '…');
      var aBtn = h('button', { class: 'btn sm primary', onclick: function (e) {
        UI.busy(e.currentTarget, async function () {
          try { await D.api('POST', 'api/course/tts', { lessonId: l.id }); watch(); UI.toast('Ovoz yaratish boshlandi.', 'ok'); }
          catch (ex) { UI.toast(ex.message || 'Boshlanmadi', 'bad'); }
        });
      } }, 'Ovoz yaratish');
      var file = h('input', { type: 'file', accept: 'video/mp4', hidden: true });
      var vBtn = h('button', { class: 'btn sm', onclick: function () { file.click(); } }, 'MP4 yuklash');
      var vDel = h('button', { class: 'btn sm', hidden: true, onclick: function (e) {
        UI.busy(e.currentTarget, async function () {
          try { await D.api('POST', 'api/course/video', { lessonId: l.id, remove: true }); refresh(); } catch (ex) { UI.toast(ex.message, 'bad'); }
        });
      } }, 'O’chirish');
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; if (!f) return;
        if (f.size > 60 * 1024 * 1024) { UI.toast('Video 60 MB dan katta.', 'bad'); return; }
        vStat.textContent = 'Yuklanmoqda…';
        var rd = new FileReader();
        rd.onload = async function () {
          try {
            await D.api('POST', 'api/course/video', { lessonId: l.id, name: f.name, type: 'video/mp4', data: String(rd.result).split(',')[1] });
            UI.toast('Video yuklandi.', 'ok'); refresh();
          } catch (ex) { vStat.textContent = ex.message || 'Yuklanmadi'; }
        };
        rd.readAsDataURL(f);
        file.value = '';
      });
      list.appendChild(h('div', { class: 'list-item', style: 'flex-wrap:wrap;gap:8px' }, [
        h('div', { class: 'main-col', style: 'min-width:200px' }, [h('b', {}, l.n + '. ' + l.title), h('span', {}, ['🎙 ', aStat]), h('span', {}, ['🎬 ', vStat])]),
        h('div', { class: 'rowflex', style: 'gap:6px;flex-wrap:wrap' }, [aBtn, vBtn, vDel, file])
      ]));
      function refresh() {
        D.api('GET', 'api/qissa-audio?l=' + l.id).then(function (st) {
          if (st.job && st.job.running) { aStat.textContent = 'Yaratilmoqda: ' + st.job.done + ' / ' + st.job.total; aBtn.disabled = true; return; }
          aBtn.disabled = false;
          if (st.job && st.job.error) aStat.textContent = 'Xato: ' + st.job.error;
          else aStat.textContent = st.items ? '✓ studiya ovozi (' + st.items + ' ta) · ' + (st.at || '') : 'Studiya ovozi yo’q (qurilma ovozi)';
          aBtn.textContent = st.items ? 'Qayta yaratish' : 'Ovoz yaratish';
        }).catch(function () { aStat.textContent = '—'; });
        D.api('GET', 'api/lesson-video?l=' + l.id + '&info=1').then(function (v) {
          vStat.textContent = v.has ? '✓ ' + v.name + ' · ' + (v.at || '') : 'MP4 yo’q (harakatli sahna ko’rsatiladi)';
          vDel.hidden = !v.has; vBtn.textContent = v.has ? 'Almashtirish' : 'MP4 yuklash';
        }).catch(function () { vStat.textContent = '—'; });
      }
      function watch() { refresh(); var t = setInterval(function () { refresh(); if (!aBtn.disabled) clearInterval(t); }, 2500); timers.push(t); }
      refresh();
    });
  }

  function moveForm(r, lessons, App) {
    var f = UI.field({
      label: 'Qaysi darsgacha ochilsin', type: 'select', value: r.current || (lessons[0] && lessons[0].id),
      options: lessons.map(function (l) { return { value: l.id, label: l.n + '. ' + l.title }; })
    });
    UI.modal({
      title: r.name + ' — darsga o’tkazish',
      body: [h('p', { class: 'small muted' }, 'Tanlangan darsgacha barcha darslar ochiladi. O’quvchining natijalari o’chmaydi.'), f.wrap],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'O’tkazish', cls: 'primary', onClick: function (c, btn) {
            UI.busy(btn, async function () {
              try { await Src.move({ studentId: r.studentId, lessonId: f.input.value }); c(); UI.toast('O’tkazildi.', 'ok'); App.render(); }
              catch (e) { UI.toast(e.message || 'Saqlanmadi', 'bad'); }
            });
          }
        }
      ]
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
