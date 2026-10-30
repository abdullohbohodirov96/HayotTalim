/* Xodimlar paneli: aqlli lug'at va o'quvchilar rivojlanishi.
     «Lug'at bazasi»          — so'z kiritish/tahrirlash, darsga bog'lash, CSV import,
                                kunlik mashq va XP qoidalari, yutuq shartlari, umumiy faollik;
     «O'quvchilar rivojlanishi» — ustoz o'z o'quvchilarining faolligi, lug'ati, vazifalari,
                                qiyin mavzulari; yozish va gapirishga baho qo'yish.
   Ma'lumot faqat server yo'llari orqali (api/learning/*) — huquqlar serverda tekshiriladi. */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  A.Pages = A.Pages || {};

  var LEVELS = ['', 'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var SKILL_UZ = { vocabulary: 'Lug‘at', grammar: 'Grammatika', reading: 'O‘qish', listening: 'Tinglash', writing: 'Yozish', speaking: 'Gapirish' };

  function box(t) { return h('div', { class: 'card' }, h('div', { class: 'card-body' }, h('p', { class: 'muted', style: 'margin:0' }, t || 'Yuklanmoqda…'))); }
  function err(e) { UI.toast((e && e.message) || 'Xato yuz berdi.', 'bad'); }
  function loader(view, App, key, fetcher, painter) {
    App._lrn = App._lrn || {};
    var c = App._lrn[key];
    if (c && c.done) { if (c.error) view.appendChild(box('Yuklab bo‘lmadi: ' + c.error)); else painter(c.data); return; }
    view.appendChild(box());
    fetcher().then(function (d) { App._lrn[key] = { done: true, data: d }; App.render(); })
      .catch(function (e) { App._lrn[key] = { done: true, error: e.message }; App.render(); });
  }
  function drop(App, prefix) { Object.keys(App._lrn || {}).forEach(function (k) { if (k.indexOf(prefix) === 0) delete App._lrn[k]; }); }
  function inp(id, label, value, o) {
    o = o || {};
    var el = o.area ? h('textarea', { id: id, class: 'input', rows: o.rows || 2, lang: o.ar ? 'ar' : null, dir: o.ar ? 'rtl' : null }, value || '')
      : h('input', { id: id, class: 'input', value: value || '', type: o.type || 'text', lang: o.ar ? 'ar' : null, dir: o.ar ? 'rtl' : null, placeholder: o.ph || '' });
    if (o.ar) el.style.fontFamily = "'Amiri', serif";
    if (o.ar) el.style.fontSize = '20px';
    return h('label', { class: 'field' }, [h('span', {}, label), el]);
  }
  function val(root, id) { var e = root.querySelector('#' + id); return e ? e.value.trim() : ''; }

  /* ================= LUG'AT BAZASI ================= */
  A.Pages.vocabAdmin = function (view, route, App) {
    if (!App.can('curriculum.view') && !App.can('curriculum.edit')) return App.guard('curriculum.view');
    var canEdit = App.can('curriculum.edit'), canRules = App.can('settings.edit');
    var canStats = App.can('reports.learning') && App.user && App.user.role !== 'oqituvchi';
    view.appendChild(UI.pageHead('Lug‘at bazasi', 'O‘quvchilarning shaxsiy lug‘ati shu so‘zlardan to‘ldiriladi — dars o‘rganilganda avtomatik', [
      canEdit ? h('button', { class: 'btn primary', onclick: function () { wordForm(App, null); } }, [UI.icon('plus'), 'So‘z qo‘shish']) : null,
      canEdit ? h('button', { class: 'btn', onclick: function () { csvImport(App); } }, [UI.icon('upload'), 'CSV import']) : null,
      canRules ? h('button', { class: 'btn', onclick: function () { rulesForm(App); } }, [UI.icon('gear'), 'XP va kunlik qoidalar']) : null
    ]));
    if (canStats) {
      loader(view, App, 'lv:stats', function () { return D.api('GET', 'api/learning/stats'); }, function (s) {
        view.appendChild(h('div', { class: 'tiles' }, [
          UI.tile({ label: 'Bugun mashq qilgan', value: String(s.activeToday) }),
          UI.tile({ label: 'Oxirgi 7 kunda faol', value: String(s.active7) }),
          UI.tile({ label: '30 kunda takrorlash', value: String(s.reviews30) }),
          UI.tile({ label: 'Lug‘atdagi so‘zlar', value: String(s.words), hint: s.custom + ' tasi markaz kiritgan' })
        ]));
        var max = Math.max(1, Math.max.apply(null, s.perDay.map(function (d) { return d.active; })));
        view.appendChild(UI.card('Kunlik faol o‘quvchilar — 30 kun', [h('div', { class: 'lv-bars' }, s.perDay.map(function (d) {
          return h('div', { class: 'lv-bar', title: d.date + ': ' + d.active + ' ta o‘quvchi' }, [h('i', { style: 'height:' + (d.active ? Math.max(4, d.active * 100 / max) : 0) + '%' }), h('span', {}, d.date.slice(8))]);
        }))]));
      });
    }
    loader(view, App, 'lv:words', function () { return D.api('GET', 'api/learning/words'); }, function (d) {
      App._lvWords = d;
      var q = route.q || '';
      var titles = {}; d.lessons.forEach(function (l) { titles[l.ref] = l.title; });
      var rows = d.custom.map(function (w) { return Object.assign({ kind: 'markaz' }, w); })
        .concat(d.builtin.map(function (w) { return Object.assign({ kind: 'kurs' }, w); }));
      var search = h('input', { class: 'input', id: 'lv-q', type: 'search', placeholder: 'Qidirish: arabcha, o‘zbekcha…', value: q, style: 'max-width:340px' });
      var tblBox = h('div');
      function paint() {
        var qq = search.value.trim().toLowerCase().replace(/[ً-ٰٟ]/g, '');
        var list = rows.filter(function (w) {
          if (w.active === false) return false;
          if (!qq) return true;
          return (String(w.ar).replace(/[ً-ٰٟ]/g, '') + ' ' + w.uz + ' ' + (w.tr || '')).toLowerCase().indexOf(qq) >= 0;
        });
        UI.clear(tblBox);
        if (!list.length) { tblBox.appendChild(UI.empty({ title: 'So‘z topilmadi', text: canEdit ? 'Yangi so‘z qo‘shing yoki CSV fayldan yuklang.' : '' })); return; }
        tblBox.appendChild(UI.table([
          { key: 'ar', label: 'Arabcha', render: function (w) { return h('span', { lang: 'ar', dir: 'rtl', style: "font-family:'Amiri',serif;font-size:20px" }, w.ar); } },
          { key: 'uz', label: 'Tarjima' },
          { key: 'tr', label: 'Talaffuz' },
          { key: 'ex', label: 'Misol', render: function (w) { return w.ex ? h('span', { lang: 'ar', dir: 'rtl', style: "font-family:'Amiri',serif;font-size:16px" }, w.ex) : '—'; } },
          { key: 'lessons', label: 'Dars', render: function (w) { return (w.lessons || []).map(function (r) { return titles[r] || r; }).join(', ') || '— (bog‘lanmagan)'; } },
          { key: 'kind', label: 'Manba', render: function (w) { return w.kind === 'kurs' ? 'Onlayn kurs' : 'Markaz'; } },
          canEdit ? { key: 'act', label: '', render: function (w) {
            if (w.kind === 'kurs') return h('span', { class: 'small muted' }, 'kurs faylida');
            return h('div', { class: 'rowflex', style: 'gap:6px' }, [
              h('button', { class: 'btn sm', type: 'button', onclick: function () { wordForm(App, w); } }, 'Tahrir'),
              h('button', { class: 'btn sm danger', type: 'button', onclick: function () { removeWord(App, w); } }, 'O‘chirish')
            ]);
          } } : null
        ].filter(Boolean), list, { page: 50 }));
      }
      search.addEventListener('input', paint);
      paint();
      view.appendChild(UI.card('So‘zlar · ' + rows.filter(function (w) { return w.active !== false; }).length + ' ta', [h('div', { style: 'margin-bottom:10px' }, search), tblBox]));
    });
  };

  function lessonPicker(selected) {
    var d = A.App && A.App._lvWords; var lessons = d ? d.lessons : [];
    var sel = {}; (selected || []).forEach(function (r) { sel[r] = 1; });
    var wrap = h('div', { class: 'lv-lessons', id: 'lv-lessons' }, lessons.length ? lessons.map(function (l) {
      return h('label', { class: 'lv-chk' }, [h('input', { type: 'checkbox', value: l.ref, checked: !!sel[l.ref] }), h('span', {}, l.title || l.ref)]);
    }) : h('p', { class: 'small muted' }, 'Hali dars yo‘q — «O‘quv dasturi» bo‘limida dars qo‘shing.'));
    return h('div', { class: 'field' }, [h('span', {}, 'Qaysi darsga tegishli (o‘quvchi shu darsni o‘rganganda lug‘atiga qo‘shiladi)'), wrap]);
  }
  function wordForm(App, w) {
    w = w || {};
    var lvl = h('select', { class: 'input', id: 'lv-level' }, LEVELS.map(function (l) { return h('option', { value: l, selected: (w.level || '') === l }, l || '— daraja —'); }));
    var body = h('div', { class: 'form-grid' }, [
      inp('lv-ar', 'Arabcha so‘z (harakatlari bilan) *', w.ar, { ar: true }),
      inp('lv-uz', 'O‘zbekcha tarjima *', w.uz),
      inp('lv-tr', 'Talaffuz (lotincha)', w.tr, { ph: 'masalan: kitabun' }),
      h('label', { class: 'field' }, [h('span', {}, 'Daraja'), lvl]),
      inp('lv-ex', 'Misol jumla (arabcha)', w.ex, { ar: true, area: true }),
      inp('lv-exuz', 'Misol jumla tarjimasi', w.exUz, { area: true }),
      lessonPicker(w.lessons)
    ]);
    UI.modal({
      title: w.id ? 'So‘zni tahrirlash' : 'Yangi so‘z', body: body, wide: true,
      actions: [{ label: 'Bekor qilish' }, { label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
        var lessons = Array.prototype.map.call(body.querySelectorAll('#lv-lessons input:checked'), function (c) { return c.value; });
        btn.disabled = true;
        D.api('POST', 'api/learning/word', { id: w.id || '', ar: val(body, 'lv-ar'), uz: val(body, 'lv-uz'), tr: val(body, 'lv-tr'), ex: val(body, 'lv-ex'), exUz: val(body, 'lv-exuz'), level: val(body, 'lv-level'), lessons: lessons })
          .then(function (r) { UI.toast(r.duplicate ? 'Bu so‘z bor edi — darsi qo‘shildi' : 'Saqlandi', 'ok'); close(); drop(App, 'lv:'); App.render(); })
          .catch(function (e) { btn.disabled = false; err(e); });
      } }]
    });
  }
  function removeWord(App, w) {
    UI.confirm('So‘zni o‘chirish', '«' + w.uz + '» lug‘at bazasidan olib tashlanadi. O‘quvchilarning takrorlash tarixi saqlanadi.', 'O‘chirish', true).then(function (yes) {
      if (!yes) return;
      D.api('POST', 'api/learning/word/delete', { id: w.id }).then(function () { UI.toast('O‘chirildi', 'ok'); drop(App, 'lv:'); App.render(); }).catch(err);
    });
  }
  function csvImport(App) {
    var ta = h('textarea', { class: 'input', id: 'lv-csv', rows: 9, placeholder: 'arabcha;tarjima;talaffuz;misol;misol tarjimasi;dars;daraja\nكِتَابٌ;kitob;kitabun;هَذَا كِتَابٌ;Bu kitob;course:a1-01;A1', style: 'font-family:monospace' });
    var file = h('input', { type: 'file', id: 'lv-file', accept: '.csv,text/csv,text/plain' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      if (f.size > 4e6) { UI.toast('Fayl juda katta (4 MB gacha).', 'bad'); return; }
      var r = new FileReader(); r.onload = function () { ta.value = String(r.result || ''); }; r.readAsText(f, 'utf-8');
    });
    var refs = (App._lvWords ? App._lvWords.lessons : []).slice(0, 40).map(function (l) { return h('li', {}, [h('code', {}, l.ref), ' — ', l.title]); });
    UI.modal({
      title: 'CSV dan so‘z yuklash', wide: true,
      body: [
        h('p', { class: 'small', style: 'margin-top:0' }, 'Ustunlar: arabcha; tarjima; talaffuz; misol; misol tarjimasi; dars; daraja. Ajratuvchi — nuqtali vergul yoki vergul. Birinchi qator sarlavha bo‘lsa, o‘tkazib yuboriladi. Bor so‘z qayta yaratilmaydi — faqat yangi darsi qo‘shiladi. Excel’da «CSV UTF-8» sifatida saqlang.'),
        file, ta,
        refs.length ? h('details', { class: 'small' }, [h('summary', {}, 'Dars kodlari'), h('ul', {}, refs)]) : null
      ],
      actions: [{ label: 'Bekor qilish' }, { label: 'Yuklash', cls: 'primary', onClick: function (close, btn) {
        if (!ta.value.trim()) { UI.toast('Matn bo‘sh.', 'bad'); return; }
        btn.disabled = true;
        D.api('POST', 'api/learning/import', { csv: ta.value }).then(function (r) {
          close(); drop(App, 'lv:'); App.render();
          UI.modal({ title: 'Import natijasi', body: [
            h('p', {}, r.total + ' ta qatordan: ' + r.added + ' ta yangi so‘z, ' + r.merged + ' tasi mavjud so‘zga birlashtirildi.'),
            r.errors.length ? h('ul', { class: 'small' }, r.errors.map(function (e) { return h('li', {}, e); })) : h('p', { class: 'small muted' }, 'Xato yo‘q.')
          ], actions: [{ label: 'Yopish', cls: 'primary' }] });
        }).catch(function (e) { btn.disabled = false; err(e); });
      } }]
    });
  }
  function rulesForm(App) {
    D.api('GET', 'api/learning/settings').then(function (s) {
      var r = s.rules;
      var num = function (id, label, v) { return inp(id, label, String(v), { type: 'number' }); };
      var body = h('div', {}, [
        h('h3', { class: 'lv-h' }, 'XP miqdorlari'),
        h('div', { class: 'form-grid' }, [
          num('x-newWord', 'Yangi so‘z (har biri)', r.xp.newWord), num('x-review', 'Takrorlangan so‘z', r.xp.review),
          num('x-testCorrect', 'To‘g‘ri test javobi', r.xp.testCorrect), num('x-rl', 'Reading / Listening mashqi', r.xp.rl),
          num('x-allBonus', 'Hammasi bajarilsa — bonus', r.xp.allBonus)
        ]),
        h('h3', { class: 'lv-h' }, 'Kunlik topshiriqlar'),
        h('div', { class: 'form-grid' }, [
          num('d-newWords', 'Yangi so‘z soni', r.daily.newWords), num('d-reviews', 'Takrorlash soni', r.daily.reviews),
          num('d-test', 'Test savollari', r.daily.test), num('d-rl', 'Reading/Listening (0 yoki 1)', r.daily.rl),
          num('d-minXp', 'Streak uchun kunlik minimal XP', r.daily.minXp)
        ]),
        h('h3', { class: 'lv-h' }, 'Yutuq shartlari'),
        h('div', { class: 'form-grid' }, [
          num('b-wordMaster', '«So‘z ustasi»: barqaror so‘zlar', r.badges.wordMaster), num('b-quizMaster', '«Test ustasi»: to‘g‘ri javoblar', r.badges.quizMaster),
          num('b-streak7', 'Streak yutug‘i 1 (kun)', r.badges.streak7), num('b-streak30', 'Streak yutug‘i 2 (kun)', r.badges.streak30),
          num('b-streak100', '«Sabr chempioni» (kun)', r.badges.streak100)
        ]),
        h('p', { class: 'small muted' }, 'O‘zgarish ertangi kunlik topshiriqlardan kuchga kiradi. Berilgan XP va yutuqlar qaytarib olinmaydi.')
      ]);
      var pick = function (pre, keys) { var o = {}; keys.forEach(function (k) { o[k] = Number(val(body, pre + k)); }); return o; };
      UI.modal({ title: 'XP va kunlik mashq qoidalari', body: body, wide: true, actions: [{ label: 'Bekor qilish' }, { label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
        btn.disabled = true;
        D.api('POST', 'api/learning/settings', {
          enabled: true,
          xp: pick('x-', ['newWord', 'review', 'testCorrect', 'rl', 'allBonus']),
          daily: pick('d-', ['newWords', 'reviews', 'test', 'rl', 'minXp']),
          badges: pick('b-', ['wordMaster', 'quizMaster', 'streak7', 'streak30', 'streak100'])
        }).then(function () { UI.toast('Qoidalar saqlandi', 'ok'); close(); }).catch(function (e) { btn.disabled = false; err(e); });
      } }] });
    }).catch(err);
  }

  /* ================= O'QUVCHILAR RIVOJLANISHI ================= */
  A.Pages.studentProgress = function (view, route, App) {
    if (!App.can('lesson.log') && !App.can('reports.learning') && !App.can('student.view')) return App.guard('lesson.log');
    var gid = route.group || '';
    view.appendChild(UI.pageHead('O‘quvchilar rivojlanishi', App.user && App.user.role === 'oqituvchi' ? 'Faqat sizning guruhlaringiz o‘quvchilari' : 'Lug‘at, kunlik mashqlar, darslar va vazifalar'));
    loader(view, App, 'sp:' + gid, function () { return D.api('GET', 'api/learning/students' + (gid ? '?group=' + encodeURIComponent(gid) : '')); }, function (d) {
      var sel = h('select', { class: 'input', id: 'sp-group', style: 'max-width:320px', onchange: function () { App.go('studentProgress', sel.value ? { group: sel.value } : {}); } },
        [h('option', { value: '' }, 'Hamma guruhlar')].concat(d.groups.map(function (g) { return h('option', { value: g.id, selected: g.id === gid }, g.name); })));
      view.appendChild(h('div', { style: 'margin-bottom:12px' }, sel));
      var rows = d.rows.slice().sort(function (a, b) { return (b.lastActive || '').localeCompare(a.lastActive || '') || b.xp - a.xp; });
      var active7 = rows.filter(function (r) { return r.active7 > 0; }).length;
      view.appendChild(h('div', { class: 'tiles' }, [
        UI.tile({ label: 'O‘quvchilar', value: String(rows.length) }),
        UI.tile({ label: '7 kunda faol', value: active7 + ' / ' + rows.length }),
        UI.tile({ label: 'O‘rtacha kurs bajarilishi', value: rows.length ? Math.round(rows.reduce(function (s, r) { return s + (r.course ? r.course.percent : 0); }, 0) / rows.length) + '%' : '—' }),
        UI.tile({ label: 'Takrorlashi kechikkan', value: String(rows.filter(function (r) { return r.vocab.due >= 20; }).length), hint: '20+ so‘z kutmoqda' })
      ]));
      if (!rows.length) { view.appendChild(UI.empty({ title: 'O‘quvchi yo‘q', text: 'Guruhga o‘quvchi qo‘shilgach shu yerda ko‘rinadi.' })); return; }
      var ago = function (dte) {
        if (!dte) return 'hali yo‘q';
        var n = Math.round((Date.parse(d.today + 'T00:00:00Z') - Date.parse(dte + 'T00:00:00Z')) / 864e5);
        return n <= 0 ? 'bugun' : n === 1 ? 'kecha' : n + ' kun oldin';
      };
      view.appendChild(UI.table([
        { key: 'name', label: 'O‘quvchi', render: function (r) { return h('div', {}, [h('b', {}, r.name), h('div', { class: 'small muted' }, r.groups.map(function (g) { return g.name; }).join(', '))]); } },
        { key: 'last', label: 'So‘nggi faollik', render: function (r) { var a = ago(r.lastActive); return h('span', { class: 'pill ' + (r.lastActive && a !== 'hali yo‘q' && (a === 'bugun' || a === 'kecha') ? 'ok' : r.active7 ? '' : 'bad') }, a); } },
        { key: 'act', label: 'Faollik (7 kun)', render: function (r) { return r.active7 + ' kun · 🔥 ' + r.streak; } },
        { key: 'course', label: 'Darslar', render: function (r) { return r.course ? r.course.code + ': ' + r.course.done + '/' + r.course.total + ' (' + r.course.percent + '%)' : '—'; } },
        { key: 'vocab', label: 'Lug‘at', render: function (r) { return r.vocab.learned + ' o‘rgangan · ' + r.vocab.mature + ' barqaror' + (r.vocab.due ? ' · ' + r.vocab.due + ' kutmoqda' : ''); } },
        { key: 'hw', label: 'Uy vazifasi', render: function (r) { return r.homework.submitted + ' topshirgan · ' + r.homework.accepted + ' qabul' + (r.homework.returned ? ' · ' + r.homework.returned + ' qaytarilgan' : ''); } },
        { key: 'xp', label: 'XP', right: true },
        { key: 'weak', label: 'Qiyinchilik', render: function (r) {
          var items = r.weak.concat(r.hardWords.map(function (w) { return w.uz + ' (' + w.lapses + ' marta unutgan)'; }));
          return items.length ? h('span', { class: 'small' }, items.slice(0, 3).join('; ')) : h('span', { class: 'small muted' }, '—');
        } }
      ], rows, { page: 60, onRow: function (r) { studentDetail(App, r); } }));
    });
  };
  function studentDetail(App, r) {
    var body = h('div', {}, box());
    var m = UI.modal({ title: r.name, body: body, wide: true, autofocus: false, actions: [{ label: 'Yopish' }] });
    D.api('GET', 'api/learning/student?id=' + encodeURIComponent(r.studentId)).then(function (p) {
      UI.clear(body);
      var c = p.course || {};
      body.appendChild(h('div', { class: 'tiles' }, [
        UI.tile({ label: 'Kurs', value: (c.code || p.level || '—') + ' · ' + (c.percent || 0) + '%', hint: (c.done || 0) + ' / ' + (c.total || 0) + ' dars' }),
        UI.tile({ label: 'Lug‘at', value: String(p.vocab.learned || 0), hint: (p.vocab.barqaror || 0) + ' barqaror · ' + (p.vocab.takrorlash || 0) + ' kutmoqda' }),
        UI.tile({ label: 'XP', value: String(p.xpTotal), hint: '🔥 ' + p.streak.current + ' kun (eng uzun ' + p.streak.best + ')' }),
        UI.tile({ label: 'Uy vazifasi', value: p.homework.submitted + ' / ' + p.homework.total, hint: p.homework.accepted + ' qabul' })
      ]));
      var max = Math.max(1, Math.max.apply(null, p.activity30.map(function (d) { return d.xp; })));
      body.appendChild(h('h3', { class: 'lv-h' }, 'Faollik — 30 kun (XP)'));
      body.appendChild(h('div', { class: 'lv-bars' }, p.activity30.map(function (d) {
        return h('div', { class: 'lv-bar', title: d.date + ': ' + d.xp + ' XP, ' + d.reviews + ' takrorlash, ' + d.steps + ' dars bosqichi' }, [h('i', { style: 'height:' + (d.xp ? Math.max(4, d.xp * 100 / max) : 0) + '%' }), h('span', {}, d.date.slice(8))]);
      })));
      if (p.tests.length) {
        body.appendChild(h('h3', { class: 'lv-h' }, 'Dars testlari'));
        body.appendChild(h('div', { class: 'small' }, p.tests.map(function (t) { return t.label + ': ' + t.percent + '%'; }).join(' · ')));
      }
      body.appendChild(h('h3', { class: 'lv-h' }, 'Ko‘nikmalar'));
      var canGrade = App.can('lesson.log') || App.can('student.edit');
      body.appendChild(h('div', { class: 'lv-skills' }, p.skills.map(function (s) {
        return h('div', { class: 'lv-skill' }, [
          h('b', {}, SKILL_UZ[s.id] || s.id),
          h('span', { class: s.score == null ? 'muted' : '' }, s.score == null ? 'Hali baholanmagan' : s.score + '%'),
          s.score == null ? null : h('small', { class: 'muted' }, s.basis || ''),
          canGrade ? h('button', { class: 'btn sm', type: 'button', onclick: function () { gradeForm(App, r, s, function () { m.close(true); studentDetail(App, r); }); } }, 'Baho qo‘yish') : null
        ]);
      })));
    }).catch(function (e) { UI.clear(body); body.appendChild(box('Yuklab bo‘lmadi: ' + e.message)); });
  }
  function gradeForm(App, r, s, done) {
    var body = h('div', { class: 'form-grid' }, [
      inp('sg-score', SKILL_UZ[s.id] + ' — baho (0–100)', s.by === 'teacher' && s.score != null ? String(s.score) : '', { type: 'number' }),
      inp('sg-note', 'Izoh (ixtiyoriy)', '', { area: true })
    ]);
    UI.modal({ title: r.name + ' · ' + SKILL_UZ[s.id], body: body, actions: [{ label: 'Bekor qilish' }, { label: 'Saqlash', cls: 'primary', onClick: function (close, btn) {
      btn.disabled = true;
      D.api('POST', 'api/learning/skill', { studentId: r.studentId, skill: s.id, score: Number(val(body, 'sg-score')), note: val(body, 'sg-note') })
        .then(function () { UI.toast('Baho saqlandi', 'ok'); close(); done(); }).catch(function (e) { btn.disabled = false; err(e); });
    } }] });
  }

  /* ================= VIDEO DARSLIKLAR ================= */
  /* Hamma yuklangan videolar bir joyda: dars videolari (A1), o'quvchilarga
     yuborilgan va o'quvchilar yuklagan video fayllar. Har birini shu yerda
     ko'rib tekshirish mumkin. */
  A.Pages.videoLib = function (view, route, App) {
    if (!App.can('curriculum.view')) return App.guard('curriculum.view');
    view.appendChild(UI.pageHead('Video darsliklar', 'O‘quvchilarga yuklangan barcha videolar — bosib ko‘ring va tekshiring', []));
    var box = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    view.appendChild(box);
    function mb(b) { return b ? (b / 1048576).toFixed(1) + ' MB' : '—'; }
    function play(title, url) {
      var v = h('video', { src: url, controls: true, playsinline: true, preload: 'metadata', style: 'width:100%;max-height:70vh;border-radius:12px;background:#000' });
      var info = h('p', { class: 'small muted', style: 'margin-top:6px' }, 'Yuklanmoqda…');
      v.addEventListener('loadedmetadata', function () {
        var d = Math.round(v.duration || 0);
        info.textContent = '✓ Video ochildi · davomiyligi ' + Math.floor(d / 60) + ':' + ('0' + d % 60).slice(-2) + ' · ' + v.videoWidth + '×' + v.videoHeight;
      });
      v.addEventListener('error', function () { info.textContent = '⚠ Video ochilmadi — fayl buzilgan yoki serverda yo‘q. Qayta yuklang.'; info.className = 'small err-msg'; });
      UI.modal({ title: title, wide: true, body: [v, info], actions: [{ label: 'Yopish', onClick: function (c) { try { v.pause(); } catch (e) { } c(); } }] });
    }
    D.api('GET', 'api/videos').then(function (r) {
      UI.clear(box);
      var ok = r.lessons.filter(function (l) { return l.state === 'ok'; }).length;
      var bad = r.lessons.filter(function (l) { return l.state === 'broken'; }).length;
      box.appendChild(h('p', { style: 'margin:0 2px 12px' }, [
        h('b', {}, 'Dars videolari: ' + ok + ' / ' + r.lessons.length), '  ·  ',
        bad ? h('b', { style: 'color:var(--bad,#c0392b)' }, '⚠ buzilgan: ' + bad) : 'buzilgan yo‘q', '  ·  ',
        'boshqa video fayllar: ' + r.files.length
      ]));
      box.appendChild(UI.card('🎬 Dars videolari (A1 kursi)', UI.table([
        { label: 'Dars', render: function (l) { return h('b', {}, l.n + '. ' + l.title); } },
        { label: 'Holat', render: function (l) {
          return l.state === 'ok' ? h('span', { class: 'pill ok' }, '✓ yuklangan')
            : l.state === 'broken' ? h('span', { class: 'pill bad' }, '⚠ buzilgan — qayta yuklang')
              : h('span', { class: 'pill muted' }, 'video yo‘q');
        } },
        { label: 'Fayl', render: function (l) { return l.name ? h('div', { class: 'small' }, [l.name, h('div', { class: 'muted' }, mb(l.size))]) : '—'; } },
        { label: 'Kim / qachon', render: function (l) { return l.at ? h('span', { class: 'small' }, (l.by || '—') + ' · ' + l.at) : '—'; } },
        { label: '', render: function (l) {
          return l.state === 'none' ? null : h('button', { class: 'btn sm primary', onclick: function () { play(l.n + '. ' + l.title, 'api/lesson-video?l=' + encodeURIComponent(l.id) + '&v=' + encodeURIComponent(l.at || '')); } }, '▶ Ko‘rish');
        } }
      ], r.lessons, { page: 40 }), null, true));
      box.appendChild(h('p', { class: 'small muted', style: 'margin:6px 2px 16px' }, 'Video yuklash yoki almashtirish: O‘quv dasturi → «Dars ovozlari va videolari».'));
      box.appendChild(UI.card('📁 Boshqa video fayllar (materiallar, o‘quvchi yuklaganlari)', r.files.length ? UI.table([
        { label: 'Fayl', render: function (f) { return h('div', { class: 'small' }, [h('b', {}, f.name), h('div', { class: 'muted' }, mb(f.size))]); } },
        { label: 'Kimniki', render: function (f) { return h('span', { class: 'small' }, (f.student ? '👤 ' + f.student + ' · ' : '') + (f.byKind === 'oquvchi' ? 'o‘quvchi yukladi' : (f.owner || '—'))); } },
        { label: 'Turi', render: function (f) { return h('span', { class: 'small muted' }, f.purpose || '—'); } },
        { label: 'Qachon', render: function (f) { return h('span', { class: 'mono small' }, f.at || ''); } },
        { label: '', render: function (f) { return h('button', { class: 'btn sm', onclick: function () { play(f.name, 'api/file?id=' + encodeURIComponent(f.id)); } }, '▶ Ko‘rish'); } }
      ], r.files, { page: 30 }) : h('p', { class: 'muted' }, 'Boshqa video fayl yo‘q.'), null, true));
      if (r.pending.length) {
        box.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('⏳ Chala qolgan yuklashlar', h('div', {}, r.pending.map(function (p) {
          return h('p', { class: 'small' }, p.name + ' · ' + mb(p.size) + ' · ' + (p.by || '—') + ' · ' + p.at + ' — yuklash tugamagan, qayta yuklang');
        })), null, true)));
      }
    }).catch(function (e) { UI.clear(box); box.appendChild(h('p', { class: 'err-msg' }, e.message || 'Yuklanmadi.')); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
