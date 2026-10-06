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
            texts: p.hw.texts || [], fileIds: p.hw.fileIds || [], files: p.hw.files || [] });
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
      }, [UI.icon('play'), 'Darslarni ko’rish (o’quvchi ko’rinishi)'])
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
        { id: 'oquvchilar', label: 'O’quvchilar va darslar' }
      ], tab, function (id) { App.go('course', { tab: id }); }));

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
      else if (f.name) out.push(h('span', { class: 'pill mute' }, f.name));
    });
    if (D.mode === 'server') {
      (p.fileIds || []).forEach(function (id, i) {
        out.push(h('a', { class: 'btn sm', href: 'api/file?id=' + encodeURIComponent(id), target: '_blank', rel: 'noopener' }, [UI.icon('down'), 'Fayl ' + (i + 1)]));
      });
    }
    return out.length ? h('div', { class: 'cr-filelinks' }, out) : null;
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
