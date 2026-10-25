/* O'quvchi kabineti — alohida sahifa (portal).
   Bo'limlar: Asosiy · Darslarim · Uy vazifalarim · Dars jadvali · To'lovlarim ·
   Fayllarim · Savol-javob · Profil.
   Ma'lumot: serverda — /api/kabinet/* ; demo (brauzer) rejimida — mahalliy nusxa.
   Manzil: #kabinet?b=<bo'lim> — sahifa yangilansa ham shu bo'lim ochiladi.   */
(function (global) {
  'use strict';
  var A = global.A;
  var UI = A.UI, h = UI.h, D = A.Data;

  var NAV = [
    { id: 'asosiy', label: 'Asosiy', icon: 'home', mob: true },
    { id: 'alifbo', label: 'A0 — o‘qish va yozish', short: 'A0', icon: 'edit' },
    { id: 'darslar', label: 'Darslarim', icon: 'play', mob: true },
    { id: 'vazifalar', label: 'Uy vazifalarim', short: 'Vazifalar', icon: 'task', mob: true },
    { id: 'lugat', label: 'Lug’at yodlash', short: 'Lug’at', icon: 'award', mob: true },
    { id: 'reyting', label: 'Reyting va ballarim', short: 'Reyting', icon: 'award' },
    { id: 'jadval', label: 'Dars jadvali', icon: 'calendar' },
    { id: 'tolov', label: 'To’lovlarim', short: 'To’lov', icon: 'wallet' },
    { id: 'fayllar', label: 'Fayllarim', icon: 'upload' },
    { id: 'savol', label: 'Savol-javob', icon: 'chat' },
    { id: 'profil', label: 'Profil', icon: 'person' }
  ];
  var DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
  var DAYS_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
  var MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

  function som(n) { return A.som ? A.som(n) + ' so’m' : String(n); }
  function dateLabel(iso) { return iso ? (A.dateLabel ? A.dateLabel(iso) : iso) : ''; }
  function sizeLabel(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function ico(name) { return UI.icon(name); }

  /* ---------- Ma'lumot manbai ---------- */
  function makeSource(d) {
    var sid = d.student.id;
    if (D.mode === 'server') {
      return {
        course: function () { return D.api('GET', 'api/kabinet/course'); },
        review: function (rid, answers) { return D.kabPost('api/kabinet/course/review', { reviewId: rid, answers: answers }); },
        vocab: function (items) { return D.kabPost('api/kabinet/course/vocab', { items: items }); },
        payments: function () { return D.api('GET', 'api/kabinet/payments'); },
        top: function () { return D.api('GET', 'api/kabinet/top'); },
        alif: function () { return D.api('GET', 'api/kabinet/alif'); },
        alifStart: function (lid) { return D.kabPost('api/kabinet/alif/start', { lessonId: lid }); },
        alifSubmit: function (sessId, answers) { return D.kabPost('api/kabinet/alif/submit', { sessId: sessId, answers: answers }); },
        alifStep: function (lid, step) { return D.kabPost('api/kabinet/alif/step', { lessonId: lid, step: step }); },
        alifHwStart: function (lid) { return D.kabPost('api/kabinet/alif/start', { lessonId: lid, kind: 'hw' }); },
        alifHw: function (lid, answers, tasks, files) { return D.kabPost('api/kabinet/alif/hw', { lessonId: lid, answers: answers, tasks: tasks, files: files }); },
        files: function () { return D.api('GET', 'api/kabinet/files'); },
        learning: function () { return D.api('GET', 'api/kabinet/learning?studentId=' + encodeURIComponent(sid)); },
        upload: function (f) { return D.kabPost('api/kabinet/files/upload', f); },
        password: function (o, n) { return D.kabPost('api/kabinet/password', { old: o, password: n }); },
        ask: function (gid, text) { return D.kabPost('api/kabinet/question', { groupId: gid, text: text }); },
        fileUrl: function (f) { return 'api/kabinet/file?id=' + encodeURIComponent(f.id); }
      };
    }
    /* Demo: brauzerdagi ma'lumot */
    var FK = 'kab_files_' + sid;
    function localAlif() { try { return JSON.parse(localStorage.getItem('a0_' + sid) || 'null') || { lessons: {} }; } catch (e) { return { lessons: {} }; } }
    function saveAlif(doc) { try { localStorage.setItem('a0_' + sid, JSON.stringify(doc)); } catch (e) { } }
    function localFiles() { try { return JSON.parse(localStorage.getItem(FK) || '[]'); } catch (e) { return []; } }
    return {
      course: async function () { return A.CourseLocal.view(sid); },
      review: async function (rid, answers) { return A.CourseLocal.review(sid, rid, answers); },
      vocab: async function (items) { return A.CourseLocal.vocab(sid, items); },
      payments: async function () {
        var inv = D.all('invoices').filter(function (i) { return i.studentId === sid; });
        var pays = D.all('payments');
        var paid = A.paidByInvoice(pays);
        var b = (D.settings && D.settings.bot) || {};
        return {
          payments: pays.filter(function (p) { return p.studentId === sid && !p.voided && p.type !== 'advance'; })
            .sort(function (a, c) { return String(c.date).localeCompare(String(a.date)); })
            .map(function (p) { return { id: p.id, date: p.date, amount: p.amount, type: p.type || 'payment', method: p.method || '', receiptNo: p.receiptNo || '' }; }),
          invoices: inv.sort(function (a, c) { return String(c.month).localeCompare(String(a.month)); }).map(function (i) {
            var g = D.one('groups', i.groupId);
            return { id: i.id, month: i.month, monthLabel: A.monthLabel(i.month), group: g ? g.name : '', amount: Math.round(i.final || 0), remaining: A.invoiceRemaining(i, paid), dueDate: i.dueDate || '' };
          }),
          card: b.payCard ? { number: b.payCard, holder: b.payHolder || '' } : { number: '9860 0000 0000 0000', holder: 'Namuna karta' },
          botUsername: b.username || ''
        };
      },
      files: async function () {
        var own = localFiles();
        /* Kursga yuklangan vazifa rasmlari ham shu ro'yxatda */
        var doc = A.CourseLocal.doc(sid);
        Object.keys(doc.lessons || {}).forEach(function (lid) {
          var hw = doc.lessons[lid].hw; if (!hw) return;
          (hw.files || []).forEach(function (f, i) {
            own.push({ id: lid + '_' + i, name: f.name || 'vazifa.jpg', type: /pdf/.test(f.name) ? 'application/pdf' : 'image/jpeg', bytes: Math.round((f.dataUrl || '').length * 0.75), at: hw.submittedAt || '', purpose: 'kurs-vazifa', dataUrl: f.dataUrl });
          });
        });
        return { files: own };
      },
      learning: async function () { return { homework: [], quizzes: [], questions: [], canSubmit: true }; },
      top: async function () { return { enabled: false }; },
      alif: async function () { return A.Alifbo.view(localAlif()); },
      alifStart: async function (lid) { var l = A.Alifbo.byId(lid); var seed = String(Date.now()); var t = A.Alifbo.buildTest(l, seed); try { sessionStorage.setItem('alif_sess', JSON.stringify({ lid: lid, seed: seed })); } catch (e) { } return { sessId: seed, questions: A.Alifbo.publicTest(t) }; },
      alifSubmit: async function (sessId, answers) {
        var ss = {}; try { ss = JSON.parse(sessionStorage.getItem('alif_sess') || '{}'); } catch (e) { }
        var l = A.Alifbo.byId(ss.lid); var g = A.Alifbo.grade(A.Alifbo.buildTest(l, ss.seed), answers);
        var doc = localAlif(); var p = doc.lessons[l.id] = doc.lessons[l.id] || {};
        p.last = g.percent; p.tries = (p.tries || 0) + 1; if (p.best == null || g.percent > p.best) p.best = g.percent;
        p.steps = p.steps || {}; p.steps.test = 1;
        saveAlif(doc);
        return { result: g, passed: g.percent >= A.Alifbo.PASS, view: A.Alifbo.view(doc) };
      },
      alifStep: async function (lid, step) { var doc = localAlif(); var p = doc.lessons[lid] = doc.lessons[lid] || {}; p.steps = p.steps || {}; p.steps[step] = 1; saveAlif(doc); return { view: A.Alifbo.view(doc) }; },
      alifHwStart: async function (lid) { var l = A.Alifbo.byId(lid); return { questions: A.Alifbo.publicTest(A.Alifbo.buildHomework(l)), tasks: A.Alifbo.hwTasks(l) }; },
      alifHw: async function (lid, answers, tasks) {
        var l = A.Alifbo.byId(lid); var g = A.Alifbo.grade(A.Alifbo.buildHomework(l), answers);
        var doc = localAlif(); var p = doc.lessons[lid] = doc.lessons[lid] || {};
        p.hw = { at: new Date().toISOString().slice(0, 16).replace('T', ' '), auto: g, tasks: tasks || {} }; p.steps = p.steps || {}; p.steps.hw = 1;
        saveAlif(doc);
        return { result: g, passed: g.percent >= A.Alifbo.PASS, view: A.Alifbo.view(doc) };
      },
      upload: async function (f) {
        var list = localFiles();
        var rec = { id: 'l' + Date.now(), name: f.name, type: f.type, bytes: Math.round(f.data.length * 0.75), at: new Date().toISOString().slice(0, 16).replace('T', ' '), purpose: 'oquvchi-fayl', note: f.note || '' };
        if (f.data.length < 1500000) rec.dataUrl = 'data:' + f.type + ';base64,' + f.data;
        list.unshift(rec);
        try { localStorage.setItem(FK, JSON.stringify(list.slice(0, 30))); } catch (e) { throw new Error('Demo rejimda joy tugadi.'); }
        return { file: rec };
      },
      password: async function () { throw new Error('Demo rejimda parol o’zgartirilmaydi.'); },
      ask: async function () { throw new Error('Demo rejimda savol yuborilmaydi.'); },
      fileUrl: function (f) { return f.dataUrl || ''; }
    };
  }

  /* ---------- Yordamchilar ---------- */
  /** Guruh jadvalidan keyingi darslar (bugundan boshlab) */
  function upcoming(groups, count) {
    var out = [];
    var now = new Date();
    for (var add = 0; add < 21 && out.length < count * 3; add++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
      var wd = (d.getDay() + 6) % 7 + 1;                         // 1 = Dushanba
      groups.forEach(function (g) {
        if ((g.days || []).map(Number).indexOf(wd) < 0) return;
        var t = String(g.startTime || '00:00').split(':');
        var at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(t[0]) || 0, Number(t[1]) || 0);
        var e = String(g.endTime || g.startTime || '00:00').split(':');
        var end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(e[0]) || 0, Number(e[1]) || 0);
        if (end < now) return;
        out.push({ at: at, end: end, g: g, live: at <= now && now <= end });
      });
    }
    out.sort(function (a, b) { return a.at - b.at; });
    return out.slice(0, count);
  }
  function whenLabel(x) {
    var now = new Date();
    var d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var d1 = new Date(x.at.getFullYear(), x.at.getMonth(), x.at.getDate());
    var diff = Math.round((d1 - d0) / 86400000);
    var day = diff === 0 ? 'Bugun' : diff === 1 ? 'Ertaga' : DAYS[(x.at.getDay() + 6) % 7] + ', ' + x.at.getDate() + '-' + MONTHS[x.at.getMonth()];
    return day + ' · ' + (x.g.startTime || '') + (x.g.endTime ? '–' + x.g.endTime : '');
  }
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onerror = function () { reject(new Error('Fayl o’qilmadi')); };
      rd.onload = function () {
        var url = String(rd.result);
        if (!/^image\//.test(file.type)) { resolve({ type: file.type, b64: url.split(',')[1] }); return; }
        var img = new Image();
        img.onload = function () {
          var max = 1800, k = Math.min(1, max / Math.max(img.width, img.height));
          var cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve({ type: 'image/jpeg', b64: cv.toDataURL('image/jpeg', 0.85).split(',')[1] });
        };
        img.onerror = function () { resolve({ type: file.type, b64: url.split(',')[1] }); };
        img.src = url;
      };
      rd.readAsDataURL(file);
    });
  }
  function hwState(l) {
    if (l.status === 'locked') return { id: 'yopiq', label: 'Yopiq', cls: 'muted' };
    var hw = l.hw;
    if (hw && hw.status === 'qabul') return { id: 'qabul', label: 'Qabul qilindi' + (hw.grade ? ' · baho ' + hw.grade : ''), cls: 'ok' };
    if (hw && hw.status === 'qayta') return { id: 'qayta', label: 'Qayta topshiring', cls: 'warn' };
    if (hw && hw.submittedAt) return { id: 'tekshir', label: 'Ustoz tekshirmoqda', cls: 'info' };
    return { id: 'bajar', label: 'Bajarish kerak', cls: 'todo' };
  }
  var STEP_IDS = ['video', 'dialog', 'words', 'grammar', 'practice', 'test', 'homework'];
  function stepsDone(l) { return STEP_IDS.filter(function (s) { return l.steps && l.steps[s]; }).length; }

  /* =================== Portal =================== */
  function render(root, d, opts) {
    opts = opts || {};
    var src = makeSource(d);
    if (A.Speak) A.Speak.loadMap();
    var st = d.student, fin = d.finance || {}, att = d.attendance || {};
    var groups = d.groups || [];
    var first = String(st.name || '').trim().split(/\s+/).slice(-1)[0] || '';
    var cache = {};
    function load(key) {
      if (!cache[key]) cache[key] = src[key]().catch(function (e) { delete cache[key]; throw e; });
      return cache[key];
    }

    function sectionFromHash() {
      var m = /[?&]b=([a-z]+)/.exec(String(location.hash || ''));
      var id = m ? m[1] : '';
      if (!id) { try { id = sessionStorage.getItem('kab_b') || ''; sessionStorage.removeItem('kab_b'); } catch (e) { } }
      id = id || 'asosiy';
      return NAV.some(function (n) { return n.id === id; }) ? id : 'asosiy';
    }
    var cur = sectionFromHash();

    UI.clear(root);
    root.className = 'kab-card sp';
    var side = h('aside', { class: 'sp-side' });
    var top = h('header', { class: 'sp-top' });
    var view = h('div', { class: 'sp-view' });
    var tabs = h('nav', { class: 'sp-tabs', 'aria-label': 'Bo’limlar' });
    root.appendChild(side);
    root.appendChild(h('div', { class: 'sp-main' }, [top, view]));
    root.appendChild(tabs);

    function go(id) {
      cur = id;
      try { history.replaceState(null, '', location.pathname + '#kabinet' + (id === 'asosiy' ? '' : '?b=' + id)); } catch (e) { }
      paintNav(); paintTop(); paintView();
      try { window.scrollTo(0, 0); } catch (e) { }
    }
    function goLesson(id, step) {
      try {
        if (id) sessionStorage.setItem('kurs_last', id); if (step) sessionStorage.setItem('kurs_step', step);
        sessionStorage.setItem('kab_b', cur);           // darsdan qaytganda shu bo'lim ochiladi
      } catch (e) { }
      if (opts.openCourse) opts.openCourse();
    }

    function paintNav() {
      UI.clear(side);
      side.appendChild(h('div', { class: 'sp-brand' }, [
        h('img', { src: A.LOGO || '', alt: '' }),
        h('div', {}, [h('b', {}, opts.centerName || 'Sabo Academy'), h('span', {}, 'O’quvchi kabineti')])
      ]));
      side.appendChild(h('div', { class: 'sp-nav' }, NAV.map(function (n) {
        return h('button', {
          type: 'button', class: 'sp-nav-i' + (n.id === cur ? ' on' : ''), 'data-b': n.id,
          onclick: function () { go(n.id); }
        }, [ico(n.icon), h('span', {}, n.label), h('i', { class: 'sp-badge', 'data-badge': n.id, hidden: true })]);
      })));
      side.appendChild(h('div', { class: 'sp-side-foot' }, [
        h('span', {}, 'Savol bo’lsa:'),
        h('b', {}, (d.center && d.center.phone) || 'markaz administratori')
      ]));

      UI.clear(tabs);
      var mob = NAV.filter(function (n) { return n.mob; });
      mob.forEach(function (n) {
        tabs.appendChild(h('button', {
          type: 'button', class: 'sp-tab' + (n.id === cur ? ' on' : ''), onclick: function () { go(n.id); }
        }, [ico(n.icon), h('span', {}, n.short || n.label), h('i', { class: 'sp-badge', 'data-badge': n.id, hidden: true })]));
      });
      var moreOn = !NAV.filter(function (n) { return n.id === cur; })[0].mob;
      tabs.appendChild(h('button', { type: 'button', class: 'sp-tab' + (moreOn ? ' on' : ''), onclick: openMore }, [ico('layers'), h('span', {}, 'Yana')]));
      paintBadges();
    }
    function openMore() {
      var list = h('div', { class: 'sp-more' }, NAV.filter(function (n) { return !n.mob; }).map(function (n) {
        return h('button', { type: 'button', class: 'sp-more-i', onclick: function () { m.close(true); go(n.id); } }, [ico(n.icon), h('span', {}, n.label), ico('right')]);
      }));
      var m = UI.modal({ title: 'Bo’limlar', body: list, actions: [{ label: 'Yopish' }] });
    }
    var badges = {};
    function paintBadges() {
      Array.prototype.forEach.call(root.querySelectorAll('[data-badge]'), function (el) {
        var n = badges[el.getAttribute('data-badge')];
        el.hidden = !n; el.textContent = n ? String(n) : '';
      });
    }

    function paintTop() {
      UI.clear(top);
      var n = NAV.filter(function (x) { return x.id === cur; })[0];
      top.appendChild(h('div', { class: 'sp-top-l' }, [
        h('img', { class: 'sp-top-logo', src: A.LOGO || '', alt: '' }),
        h('div', {}, [h('span', { class: 'sp-top-k' }, 'O’quvchi kabineti'), h('b', {}, n.label)])
      ]));
      top.appendChild(h('div', { class: 'sp-top-r' }, [
        h('button', { type: 'button', class: 'sp-me', onclick: function () { go('profil'); } }, [
          UI.avatar(st.name), h('span', { class: 'sp-me-n' }, st.name)
        ]),
        h('div', { class: 'kab-out' }, h('button', { class: 'btn sm', type: 'button', onclick: function () { if (opts.logout) opts.logout(); } }, 'Chiqish'))
      ]));
    }

    function paintView() {
      UI.clear(view);
      var fn = { asosiy: vHome, alifbo: vAlif, reyting: vRating, darslar: vLessons, vazifalar: vHomework, lugat: vVocab, jadval: vSchedule, tolov: vPay, fayllar: vFiles, savol: vAsk, profil: vProfile }[cur];
      fn(view);
      if (A.I18N && A.I18N.apply) { try { A.I18N.apply(view); } catch (e) { } }
    }
    function card(title, body, extra) {
      return h('section', { class: 'sp-card' + (extra && extra.cls ? ' ' + extra.cls : '') }, [
        title ? h('div', { class: 'sp-card-h' }, [h('h3', {}, title), extra && extra.action ? extra.action : null]) : null
      ].concat(body));
    }
    function loading() { return h('p', { class: 'sp-muted' }, 'Yuklanmoqda…'); }
    function fail(el, e) { UI.clear(el); el.appendChild(h('p', { class: 'err-msg' }, (e && e.message) || 'Yuklanmadi.')); }
    function empty(icon, title, text) {
      return h('div', { class: 'sp-empty' }, [h('div', { class: 'sp-empty-i' }, ico(icon)), h('b', {}, title), text ? h('span', {}, text) : null]);
    }
    function groupsBlock() {
      return groups.length ? h('div', { class: 'kab-groups' }, groups.map(function (g) {
        return h('div', { class: 'kab-group' }, [
          h('b', {}, (g.code ? g.code + ' · ' : '') + g.name),
          g.teacher ? h('div', { class: 'small' }, 'O’qituvchi: ' + g.teacher) : null,
          h('div', { class: 'small muted' }, [g.daysText, (g.startTime && g.endTime) ? g.startTime + '–' + g.endTime : '', g.room].filter(Boolean).join('  ·  ')),
          (g.zoomLink || g.recordingsLink) ? h('div', { class: 'rowflex', style: 'gap:6px;margin-top:8px' }, [
            g.zoomLink ? h('a', { class: 'btn primary sm', href: g.zoomLink, target: '_blank', rel: 'noopener' }, g.zoomToday ? 'Bugungi darsga kirish (Zoom)' : 'Darsga kirish (Zoom)') : null,
            g.recordingsLink ? h('a', { class: 'btn sm', href: g.recordingsLink, target: '_blank', rel: 'noopener' }, 'Dars yozuvlari') : null
          ]) : null,
          g.zoomToday && g.zoomToday.password ? h('div', { class: 'small muted', style: 'margin-top:6px' }, 'Zoom paroli: ' + g.zoomToday.password) : null,
          (g.recordings && g.recordings.length) ? h('details', { class: 'kab-recs' }, [
            h('summary', {}, '📹 Dars yozuvlari (' + g.recordings.length + ')'),
            h('ul', {}, g.recordings.map(function (r) {
              return h('li', {}, [h('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.date + (r.start ? ' · ' + r.start : '')),
                r.password ? h('span', { class: 'small muted' }, '  parol: ' + r.password) : null]);
            }))
          ]) : null
        ]);
      })) : h('p', { class: 'sp-muted' }, 'Hozircha guruhga yozilmagansiz.');
    }

    /* ---------- 1. Asosiy ---------- */
    function vHome(el) {
      var heroR = h('div', { class: 'sp-hero-r' }, loading());
      el.appendChild(h('section', { class: 'sp-hero' }, [
        h('div', { class: 'sp-hero-l' }, [
          h('span', { class: 'sp-eyebrow' }, 'Xush kelibsiz'),
          h('h1', {}, first ? first + '!' : 'Xush kelibsiz!'),
          h('p', { class: 'sp-hero-me' }, st.name + ' · kod ' + st.code),
          d.level ? h('button', { type: 'button', class: 'sp-lvl', onclick: function () { if (d.level.code === 'A0') go('alifbo'); } }, 'Darajangiz: ' + d.level.code + ' · ' + d.level.name + (d.level.code === 'A0' ? ' →' : '')) : null,
          h('p', {}, 'Bugun ham bir qadam: darsni davom ettiring, vazifani yuboring — keyingi dars o’zi ochiladi.')
        ]),
        heroR
      ]));

      var nx = upcoming(groups, 1)[0];
      var tiles = h('div', { class: 'sp-tiles' });
      el.appendChild(tiles);
      var tLessons = tile('play', 'Darslar', '…', 'darslar');
      var tHw = tile('task', 'Vazifalar', '…', 'vazifalar');
      var tNext = tile('calendar', 'Keyingi dars', nx ? whenLabel(nx).split(' · ')[0] : '—', 'jadval', nx ? (nx.g.startTime || '') : 'jadval yo’q');
      var tPay = fin.debt > 0
        ? tile('wallet', 'To’lov', som(fin.debt), 'tolov', (fin.overdue > 0 ? 'qarz' : 'to’lov kuni') + (fin.next && fin.next.dueDate ? ' · ' + dateLabel(fin.next.dueDate) + (fin.overdue > 0 ? ' edi' : ' gacha') : ''), fin.overdue > 0 ? 'bad' : '')
        : tile('wallet', 'To’lov', 'Qarz yo’q', 'tolov', fin.next && fin.next.dueDate ? 'keyingi: ' + dateLabel(fin.next.dueDate) : '', 'ok');
      [tLessons, tHw, tNext, tPay].forEach(function (t) { tiles.appendChild(t.node); });

      var grid = h('div', { class: 'sp-grid2' });
      el.appendChild(grid);
      var colL = h('div', { class: 'sp-col' }), colR = h('div', { class: 'sp-col' });
      grid.appendChild(colL); grid.appendChild(colR);

      var todo = h('div', {}, loading());
      colL.appendChild(card('Bugungi ishlar', [todo]));
      colL.appendChild(card('Guruhlarim', [groupsBlock()], { action: h('button', { class: 'sp-link', onclick: function () { go('jadval'); } }, 'Jadval →') }));

      colR.appendChild(card('To’lov', [
        fin.debt > 0
          ? h('div', { class: 'kab-money' + (fin.overdue > 0 ? ' bad' : '') }, [h('span', {}, fin.overdue > 0 ? 'Qarz' : 'To’lanishi kerak'), h('b', {}, A.somFull ? A.somFull(fin.debt) : som(fin.debt))])
          : h('div', { class: 'kab-money ok' }, [h('span', {}, 'To’lov'), h('b', {}, fin.advance > 0 ? 'Balansda +' + som(fin.advance) : 'Qarz yo’q')]),
        fin.next ? h('div', { class: 'kab-line' }, [h('span', {}, fin.next.upcoming ? 'Keyingi hisob' : 'Keyingi to’lov'),
          h('b', {}, (fin.next.upcoming ? '' : som(fin.next.amount) + ' · ') + dateLabel(fin.next.dueDate) + ' gacha')]) : null,
        h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: function () { go('tolov'); } }, 'Batafsil va to’lash')
      ]));
      colR.appendChild(card('Davomat', [attBlock()]));
      var ptsBox = h('div', {}, loading());
      var ptsCard = card('Ballarim', [ptsBox], { action: h('button', { class: 'sp-link', onclick: function () { go('reyting'); } }, 'Reyting →') });
      colR.insertBefore(ptsCard, colR.firstChild);
      load('top').then(function (t) {
        if (!t || !t.enabled || !t.me) { ptsCard.remove(); return; }
        UI.clear(ptsBox);
        ptsBox.appendChild(h('div', { class: 'gm-me' }, [
          h('div', { class: 'gm-pts' }, [h('b', {}, String(t.me.points)), h('span', {}, 'ball')]),
          h('div', { class: 'gm-rank' }, [h('b', {}, t.me.rank + '-o’rin'), h('span', {}, t.me.count + ' o’quvchi orasida')])
        ]));
      }).catch(function () { ptsCard.remove(); });

      load('course').then(function (cv) {
        var ls = cv.lessons || [];
        var done = ls.filter(function (l) { return l.status === 'done'; }).length;
        var curL = ls.filter(function (l) { return l.status === 'open'; })[0];
        var pct = ls.length ? Math.round(done * 100 / ls.length) : 0;
        tLessons.set(done + ' / ' + ls.length, curL ? 'joriy: ' + curL.n + '-dars' : 'kurs tugadi');
        var need = ls.filter(function (l) { var s = hwState(l).id; return s === 'bajar' || s === 'qayta'; });
        var wait = ls.filter(function (l) { return hwState(l).id === 'tekshir'; });
        tHw.set(String(need.length), wait.length ? wait.length + ' ta tekshirilmoqda' : 'bajarish kerak', need.length ? 'warn' : '');
        badges.vazifalar = ls.filter(function (l) { return hwState(l).id === 'qayta'; }).length || 0;
        paintBadges();

        UI.clear(heroR);
        heroR.appendChild(h('div', { class: 'sp-ring', style: '--p:' + pct }, [h('b', {}, pct + '%'), h('span', {}, done + '/' + ls.length + ' dars')]));
        heroR.appendChild(h('div', { class: 'sp-hero-next' }, [
          h('span', {}, curL ? 'Joriy dars' : 'Tabriklaymiz!'),
          h('b', {}, curL ? curL.n + '. ' + curL.title : 'A1 kursi tugadi'),
          curL ? h('span', { class: 'sp-ar' }, curL.titleAr || '') : null,
          h('button', { class: 'btn sp-cta', type: 'button', onclick: function () { goLesson(curL ? curL.id : (ls[0] && ls[0].id)); } }, curL ? 'Darsni davom ettirish →' : 'Darslarni ko’rish →')
        ]));

        UI.clear(todo);
        var items = [];
        if (nx) items.push(todoItem('calendar', nx.live ? 'Dars hozir ketmoqda!' : 'Keyingi jonli dars', whenLabel(nx) + ' · ' + nx.g.name,
          nx.g.zoomLink ? h('a', { class: 'btn sm primary', href: nx.g.zoomLink, target: '_blank', rel: 'noopener' }, 'Zoom') : null));
        var back = ls.filter(function (l) { return hwState(l).id === 'qayta'; })[0];
        if (back) items.push(todoItem('alert', 'Vazifa qaytarildi', back.n + '. ' + back.title + (back.hw && back.hw.comment ? ' — «' + back.hw.comment + '»' : ''),
          h('button', { class: 'btn sm primary', onclick: function () { goLesson(back.id, 'homework'); } }, 'Qayta yuborish'), 'warn'));
        if (curL) {
          var sd = stepsDone(curL);
          items.push(todoItem('play', curL.n + '-dars: ' + curL.title, sd + ' / 7 bosqich bajarildi',
            h('button', { class: 'btn sm primary', onclick: function () { goLesson(curL.id); } }, 'Davom etish')));
        }
        var openRv = (cv.reviews || []).filter(function (r) { return r.status === 'open'; })[0];
        if (openRv) items.push(todoItem('award', openRv.title + ' testi', openRv.sub + ' — o’tsangiz keyingi dars ochiladi',
          h('button', { class: 'btn sm primary', onclick: function () { go('lugat'); startReview(openRv.id); } }, 'Boshlash'), 'warn'));
        var vdue = cv.vocab ? cv.vocab.due + cv.vocab.fresh : 0;
        if (vdue) items.push(todoItem('award', 'Lug’at yodlash', vdue + ' ta so’z bugun takrorlanadi',
          h('button', { class: 'btn sm', onclick: function () { go('lugat'); startCards(); } }, 'Kartochkalar')));
        if (fin.debt > 0) items.push(todoItem('wallet', 'To’lov', som(fin.debt) + (fin.next && fin.next.dueDate ? ' · ' + dateLabel(fin.next.dueDate) + ' gacha' : ''),
          h('button', { class: 'btn sm', onclick: function () { go('tolov'); } }, 'To’lash'), 'bad'));
        if (!items.length) items.push(h('p', { class: 'sp-muted' }, 'Hammasi bajarilgan. Barakalla!'));
        items.forEach(function (x) { todo.appendChild(x); });
      }).catch(function (e) { fail(heroR, e); UI.clear(todo); });
    }
    function tile(icon, label, value, target, hint, cls) {
      var v = h('b', {}, value), hn = h('span', {}, hint || '');
      var node = h('button', { type: 'button', class: 'sp-tile ' + (cls || ''), onclick: function () { go(target); } }, [
        h('i', { class: 'sp-tile-i' }, ico(icon)), h('div', {}, [h('small', {}, label), v, hn])
      ]);
      return {
        node: node, set: function (val, hint2, c) {
          v.textContent = val; hn.textContent = hint2 || ''; if (c != null) node.className = 'sp-tile ' + c;
        }
      };
    }
    function todoItem(icon, title, text, action, cls) {
      return h('div', { class: 'sp-todo ' + (cls || '') }, [
        h('i', { class: 'sp-todo-i' }, ico(icon)),
        h('div', { class: 'sp-todo-t' }, [h('b', {}, title), h('span', {}, text)]),
        action
      ]);
    }
    function attBlock() {
      if (!att.total) return h('p', { class: 'sp-muted' }, 'Hozircha davomat yozuvi yo’q.');
      return h('div', {}, [
        h('div', { class: 'kab-stats' }, [
          h('div', {}, [h('b', {}, String(att.attended)), h('span', {}, 'Keldi')]),
          h('div', {}, [h('b', {}, String(att.missed)), h('span', {}, 'Kelmadi')]),
          h('div', {}, [h('b', {}, String(att.late)), h('span', {}, 'Kechikdi')]),
          h('div', {}, [h('b', {}, String(att.excused)), h('span', {}, 'Sababli')])
        ]),
        h('div', { class: 'small muted' }, 'Jami dars: ' + att.total + (att.percent != null ? '  ·  ' + att.percent + '%' : ''))
      ]);
    }

    /* ================= A0: «Nabra» — 24 dars (2 oy), ketma-ket ochiladi =================
       Dars bosqichlari: 1) Yodlash  2) Video  3) Mashq  4) Test  5) Uy vazifasi.
       Keyingi dars: test ≥ 60% va uy vazifasi topshirilgach ochiladi.               */
    var A0P = { cur: null, gen: 0 };
    /** Ovozni to'xtatish (video, «hammasini tinglash» va h.k.) */
    function a0Stop() {
      A0P.gen++;
      if (A0P.cur) { try { A0P.cur.pause(); } catch (e) { } A0P.cur = null; }
      try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) { }
    }
    /** Bitta ovoz: studiya fayli bo'lsa — o'sha, bo'lmasa brauzer ovozi. Promise tugaganda resolve. */
    function a0PlayUrl(url, fallbackAr, rate) {
      return new Promise(function (res) {
        var done = false, fin = function () { if (!done) { done = true; res(); } };
        if (!url) {
          if (fallbackAr && A.CourseSay) {
            try { var r = A.CourseSay(fallbackAr, 0.8); if (r && r.then) { r.then(fin, fin); setTimeout(fin, 6000); return; } } catch (e) { }
            setTimeout(fin, 1100 + String(fallbackAr).length * 90); return;
          }
          setTimeout(fin, 400); return;
        }
        try {
          if (A0P.cur) A0P.cur.pause();
          var a = new Audio(url); A0P.cur = a;
          if (rate) a.playbackRate = rate;
          a.onended = fin; a.onerror = function () { if (fallbackAr && A.CourseSay) { try { A.CourseSay(fallbackAr, 0.8); } catch (e) { } setTimeout(fin, 1500); } else fin(); };
          var p = a.play(); if (p && p.catch) p.catch(a.onerror);
          setTimeout(fin, 90000);
        } catch (e) { fin(); }
      });
    }
    function a0Say(text) { var F = A.Alifbo; return a0PlayUrl(F.audioUrl(text), text); }
    /** Harf: arabcha nomi (+ ixtiyoriy o'zbekcha maxraj tushuntirishi) */
    function a0SayLetter(ch, withTip) {
      var F = A.Alifbo, x = F.letter(ch);
      return a0Say(x.say).then(function () { if (withTip) return a0PlayUrl(F.uzUrl('t' + (x.n < 10 ? '0' : '') + x.n), null); });
    }
    function a0Steps(lv) { return (lv && lv.steps) || {}; }

    /* ---------- Darslar ro'yxati: 8 hafta ---------- */
    function vAlif(el) {
      var F = A.Alifbo;
      var box = h('div', {}, loading());
      el.appendChild(h('p', { class: 'sp-lead' }, 'A0 — «Nabra» darsligi bo‘yicha arab tilida o‘qish va yozish: 24 dars, 2 oy (haftasiga 3 dars). Har darsda: so‘z va harflarni yodlash → video dars → mashq → test → uy vazifasi. Keyingi dars oldingisi tugagach ochiladi.'));
      el.appendChild(box);
      cache.alif = null;
      load('alif').then(function (v) {
        UI.clear(box);
        box.appendChild(h('div', { class: 'cr-mini', style: 'margin-bottom:14px' }, [h('div', { class: 'cr-bar' }, h('i', { style: 'width:' + Math.round(v.done * 100 / v.total) + '%' })), h('span', { class: 'small' }, v.done + ' / ' + v.total + ' dars tugadi')]));
        var nextOpen = v.lessons.filter(function (l) { return l.status === 'open'; })[0];
        if (nextOpen) box.appendChild(h('div', { class: 'a0-cta' }, [
          h('div', {}, [h('span', { class: 'a0-eyebrow' }, 'Davom etish · ' + nextOpen.week + '-hafta'), h('b', {}, nextOpen.n + '-dars: ' + nextOpen.title)]),
          h('button', { class: 'btn primary', type: 'button', onclick: function () { openAlif(nextOpen.id); } }, 'Darsni ochish →')
        ]));
        for (var w = 1; w <= 8; w++) {
          var ls = v.lessons.filter(function (l) { return l.week === w; });
          box.appendChild(h('div', { class: 'a0-week' }, [
            h('div', { class: 'a0-week-h' }, [h('span', { class: 'a0-week-n' }, w + '-hafta'), h('span', { class: 'small muted' }, ls.map(function (l) { return l.n; }).join(', ') + '-darslar')]),
            h('div', { class: 'sp-lessons' }, ls.map(function (l) {
              var locked = l.status === 'locked', L0 = F.byId(l.id);
              var stp = a0Steps(l), nDone = F.STEPS.filter(function (s) { return stp[s.id]; }).length;
              return h('button', { type: 'button', class: 'sp-lesson ' + l.status, onclick: function () {
                if (locked) { UI.toast('Bu dars oldingi dars tugagach ochiladi: test ' + F.PASS + '% va uy vazifasi.', 'warn'); return; }
                openAlif(l.id);
              } }, [
                h('div', { class: 'sp-lesson-top' }, [
                  h('span', { class: 'sp-lesson-n' }, l.status === 'done' ? '✓' : locked ? '🔒' : String(l.n)),
                  h('span', { class: 'sp-ar' + (locked ? ' sp-blur' : ''), lang: 'ar', dir: 'rtl' }, L0.titleAr)
                ]),
                h('b', { class: locked ? 'sp-blur' : '' }, l.n + '. ' + l.title),
                locked ? h('span', { class: 'sp-lock-note' }, '🔒 Oldingi dars tugagach ochiladi') : null,
                h('span', { class: 'sp-lesson-s' }, locked ? 'Yopiq' : l.status === 'done' ? 'Tugadi · test ' + l.best + '%' + (l.hw && l.hw.percent != null ? ' · vazifa ' + l.hw.percent + '%' : '')
                  : (nDone ? nDone + ' / 5 bosqich' + (l.best != null ? ' · test ' + l.best + '%' : '') : 'Boshlanmagan')),
                locked ? null : h('span', { class: 'a0-dots' }, F.STEPS.map(function (s) { return h('i', { class: stp[s.id] ? 'on' : '' }); }))
              ]);
            }))
          ]));
        }
      }).catch(function (e) { fail(box, e); });
    }

    /* ---------- Bitta dars ---------- */
    function openAlif(lid, step) {
      a0Stop();
      var F = A.Alifbo, l = F.byId(lid);
      UI.clear(view);
      var wrap = h('div', { class: 'a0-wrap' });
      view.appendChild(wrap);
      wrap.appendChild(loading());
      load('alif').then(function (v) {
        var lv = v.lessons.filter(function (x) { return x.id === lid; })[0];
        if (!lv || lv.status === 'locked') { UI.toast('Bu dars hali yopiq.', 'warn'); go('alifbo'); return; }
        var stp = a0Steps(lv);
        if (!step) { step = 'learn'; for (var i = 0; i < F.STEPS.length; i++) if (!stp[F.STEPS[i].id]) { step = F.STEPS[i].id; break; } if (lv.status === 'done') step = 'learn'; }
        paint(lv, step);
      }).catch(function (e) { fail(wrap, e); });

      function mark(stepId) {
        if (D.mode !== 'server' && !src.alifStep) return Promise.resolve();
        return (src.alifStep ? src.alifStep(lid, stepId) : Promise.resolve()).then(function (r) { if (r && r.view) cache.alif = Promise.resolve(r.view); }).catch(function () { });
      }
      function goStep(s) { a0Stop(); load('alif').then(function (v) { paint(v.lessons.filter(function (x) { return x.id === lid; })[0], s); }); try { window.scrollTo(0, 0); } catch (e) { } }
      function nextBtn(label, fn) { return h('div', { class: 'a0-next' }, h('button', { class: 'btn primary lg', type: 'button', onclick: fn }, [label, ' →'])); }

      function paint(lv, s) {
        UI.clear(wrap);
        var stp = a0Steps(lv);
        wrap.appendChild(h('div', { class: 'a0-head' }, [
          h('button', { class: 'sp-link', type: 'button', onclick: function () { a0Stop(); go('alifbo'); } }, '← Darslar'),
          h('span', { class: 'a0-eyebrow' }, 'A0 · ' + l.week + '-hafta · ' + l.n + '-dars · darslik ' + l.book + '-bo‘lim'),
          h('h2', {}, l.title),
          h('div', { class: 'a0-titlear', lang: 'ar', dir: 'rtl' }, l.titleAr)
        ]));
        wrap.appendChild(h('nav', { class: 'a0-steps' }, F.STEPS.map(function (x, i) {
          return h('button', { type: 'button', class: 'a0-step' + (x.id === s ? ' on' : '') + (stp[x.id] ? ' seen' : '') + (x.home ? ' home' : ''), onclick: function () { goStep(x.id); } },
            [h('span', { class: 'a0-step-n' }, stp[x.id] ? '✓' : String(i + 1)), h('span', {}, (x.home ? '🏠 ' : '') + x.label)]);
        })));
        var body = h('section', { class: 'a0-panel' });
        wrap.appendChild(body);
        ({ learn: stepLearn, video: stepVideo, practice: stepPractice, test: stepTest, hw: stepHw })[s](body, lv);
      }

      /* ---- 1. Yodlash: kitob sahifasi ---- */
      function stepLearn(body) {
        var items = [];   /* «Hammasini tinglash» uchun: {el, play} */
        body.appendChild(h('div', { class: 'a0-ph' }, [
          h('span', { class: 'a0-eyebrow dark' }, '1-qadam · yodlash'),
          h('h3', {}, l.kind === 'letters' ? 'Harflarni yodlang' : l.kind === 'texts' ? 'Matnlarni tinglang va o‘qing' : 'Tinglang, takrorlang, yodlang'),
          h('p', {}, 'Har bir ' + (l.kind === 'letters' || l.kind === 'forms' ? 'harfni' : 'so‘zni') + ' bosing — diktor to‘g‘ri talaffuz qilib beradi. Ovoz chiqarib takrorlang.')
        ]));
        var allBtn = h('button', { class: 'btn sm', type: 'button' }, '🔊 Hammasini ketma-ket tinglash');
        body.appendChild(h('div', { class: 'a0-tools' }, allBtn));
        F.blocks(l).forEach(function (bl) { body.appendChild(renderBlock(bl, items)); });
        allBtn.onclick = function () {
          if (allBtn._on) { a0Stop(); allBtn._on = false; allBtn.textContent = '🔊 Hammasini ketma-ket tinglash'; return; }
          a0Stop(); var g = A0P.gen; allBtn._on = true; allBtn.textContent = '⏸ To‘xtatish';
          (function next(i) {
            if (g !== A0P.gen || i >= items.length) { allBtn._on = false; allBtn.textContent = '🔊 Hammasini ketma-ket tinglash'; items.forEach(function (it) { it.el.classList.remove('play'); }); return; }
            items.forEach(function (it) { it.el.classList.remove('play'); });
            items[i].el.classList.add('play');
            try { items[i].el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { }
            items[i].play().then(function () { setTimeout(function () { next(i + 1); }, 450); });
          })(0);
        };
        body.appendChild(nextBtn('Yodladim — video darsga o‘tish', function () { mark('learn'); goStep('video'); }));
      }
      function tapAr(text, cls, sub, playFn) {
        var el = h('button', { type: 'button', class: 'a0-tap ' + (cls || ''), lang: 'ar', dir: 'rtl' }, [h('span', { class: 'a0-ar' }, text), sub ? h('small', { dir: 'ltr', lang: 'uz' }, sub) : null]);
        var play = playFn || function () { return a0Say(text); };
        el.onclick = function () { a0Stop(); el.classList.add('play'); play().then(function () { el.classList.remove('play'); }); };
        return { el: el, play: play };
      }
      function renderBlock(bl, items) {
        if (bl.t === 'rule') return h('div', { class: 'a0-rule' }, [h('b', {}, '📌 Eslatma'), h('p', {}, bl.uz)]);
        if (bl.t === 'letters') return h('div', { class: 'a0-letters' }, bl.list.map(function (ch) {
          var x = F.letter(ch);
          var playName = function () { return a0SayLetter(ch, false); };
          var card = h('div', { class: 'a0-lcard' });
          var big = h('button', { type: 'button', class: 'a0-lbig', lang: 'ar', dir: 'rtl', onclick: function () { a0Stop(); playName(); } }, x.show);
          card.appendChild(h('div', { class: 'a0-lhead' }, [h('span', { class: 'a0-lnum' }, String(x.n)), h('div', {}, [h('b', {}, x.name), h('span', { lang: 'ar', dir: 'rtl' }, x.nameAr)]), big]));
          card.appendChild(h('img', { class: 'a0-limg', src: x.img, alt: x.name + ' — chiqish joyi', loading: 'lazy' }));
          card.appendChild(h('span', { class: 'a0-place' }, x.place));
          card.appendChild(h('p', { class: 'a0-tip' }, x.tip));
          card.appendChild(h('button', { class: 'btn sm a0-lsay', type: 'button', onclick: function () { a0Stop(); a0SayLetter(ch, true); } }, '🔊 Tinglash'));
          items.push({ el: card, play: playName });
          return card;
        }));
        if (bl.t === 'forms') {
          var rows = bl.list.map(function (ch) {
            var x = F.letter(ch), f = F.forms(x);
            var cells = [['Alohida', f.alone], ['So‘z boshida', f.start], ['O‘rtasida', f.middle], ['Oxirida', f.end]].map(function (p) {
              if (!p[1]) return h('div', { class: 'a0-fcell none' }, [h('span', {}, '—'), h('small', {}, p[0])]);
              var t = tapAr(p[1], 'a0-fcell', p[0], function () { return a0SayLetter(ch, false); });
              return t.el;
            });
            var row = h('div', { class: 'a0-frow' + (x.nc ? ' nc' : '') }, [h('div', { class: 'a0-fname' }, [h('b', {}, x.name), h('span', { class: 'a0-ar' }, x.show)])].concat(cells));
            items.push({ el: row, play: function () { return a0SayLetter(ch, false); } });
            return row;
          });
          return h('div', { class: 'a0-block' }, [bl.title ? h('h4', {}, bl.title) : null, h('div', { class: 'a0-forms' }, rows)]);
        }
        if (bl.t === 'grid') return h('div', { class: 'a0-block' }, [h('h4', {}, bl.title), h('div', { class: 'a0-grid' + (bl.big ? ' big' : '') }, bl.items.map(function (w, i) {
          var lt = bl.letters ? F.letter(w) : null;
          var t = tapAr(w, '', lt ? lt.name : F.translit(w), lt ? function () { return a0Say(lt.say); } : null);
          t.el.insertBefore(h('i', { class: 'a0-n' }, String(i + 1)), t.el.firstChild);
          items.push(t); return t.el;
        }))]);
        if (bl.t === 'pairs') return h('div', { class: 'a0-block' }, [h('h4', {}, bl.title || 'Qisqa → cho‘ziq'), h('div', { class: 'a0-pairs' }, bl.items.map(function (p) {
          var a = tapAr(p[0], 'short', F.translit(p[0])), b = tapAr(p[1], 'long', F.translit(p[1]));
          items.push(a); items.push(b);
          return h('div', { class: 'a0-pair', dir: 'rtl' }, [a.el, h('span', { class: 'a0-arrow' }, '←'), b.el]);
        }))]);
        if (bl.t === 'sets') return h('div', { class: 'a0-block' }, [
          h('h4', {}, 'Qamariy harflar — 14 ta (ل o‘qiladi)'),
          h('div', { class: 'a0-grid big set q' }, F.BOOK.qamar.map(function (c) { var t = tapAr(c, '', F.letter(c).name, function () { return a0Say(F.letter(c).say); }); return t.el; })),
          h('p', { class: 'a0-mn', lang: 'ar', dir: 'rtl' }, 'يَجْمَعُهَا: (أَبْغِ حَجَّكَ وَخَفْ عَقِيمَهُ)'),
          h('h4', {}, 'Shamsiy harflar — 14 ta (ل o‘qilmaydi, harf ikkilanadi)'),
          h('div', { class: 'a0-grid big set s' }, F.BOOK.shams.map(function (c) { var t = tapAr(c, '', F.letter(c).name, function () { return a0Say(F.letter(c).say); }); return t.el; }))
        ]);
        if (bl.t === 'tanvinRules') return h('div', { class: 'a0-block' }, [h('h4', {}, 'Tanvin qoidalari')].concat(bl.ar.map(function (s, i) {
          var t = tapAr(s, 'a0-sent', bl.uz[i]); items.push(t); return t.el;
        })));
        if (bl.t === 'tanvin') {
          var marks = ['ً', 'ٌ', 'ٍ'];
          return h('div', { class: 'a0-block' }, [h('h4', {}, 'Harflar tanvin bilan: -an · -un · -in'), h('div', { class: 'a0-tanvin' }, F.LETTERS.map(function (x) {
            return h('div', { class: 'a0-trow', dir: 'rtl' }, marks.map(function (m) { var w = F.withMark(x, m); var t = tapAr(w, '', F.translit(w)); items.push(t); return t.el; }));
          }))]);
        }
        if (bl.t === 'text') {
          var tr = h('p', { class: 'a0-tr', hidden: true }, bl.uz);
          var t = tapAr(bl.ar, 'a0-text');
          items.push(t);
          return h('div', { class: 'a0-block a0-textbox' }, [
            h('div', { class: 'a0-texth' }, [h('b', { lang: 'ar', dir: 'rtl' }, bl.title + ' (' + bl.n + ')'), h('button', { class: 'btn sm', type: 'button', onclick: function () { tr.hidden = !tr.hidden; } }, 'Tarjimasi')]),
            t.el, tr
          ]);
        }
        return h('div');
      }

      /* ---- 2. Video: diktor tushuntiradi, so'ng hamma narsa birma-bir o'qiladi ---- */
      function stepVideo(body) {
        body.appendChild(h('div', { class: 'a0-ph' }, [
          h('span', { class: 'a0-eyebrow dark' }, '2-qadam · video dars'),
          h('h3', {}, '🎬 ' + l.n + '-dars: ' + l.title),
          h('p', {}, 'Diktor darsni tushuntiradi, keyin hamma ' + (l.kind === 'letters' || l.kind === 'forms' ? 'harflarni' : 'so‘zlarni') + ' birma-bir o‘qib beradi. Har biridan keyin o‘zingiz ham ovoz chiqarib takrorlang.')
        ]));
        var seq = [{ intro: true }].concat(F.readItems(l));
        var stage = h('div', { class: 'a0-stage' });
        var cap = h('div', { class: 'a0-cap' });
        var bar = h('div', { class: 'a0-vbar' }, h('i'));
        var cnt = h('span', { class: 'a0-vcnt' }, '');
        body.appendChild(h('div', { class: 'a0-video' }, [stage, cap, bar]));
        var idx = 0, playing = false;
        var bPlay = h('button', { class: 'btn primary', type: 'button' }, '▶ Boshlash');
        var ctr = h('div', { class: 'a0-vctl' }, [
          h('button', { class: 'btn sm', type: 'button', onclick: function () { show(Math.max(0, idx - 1), playing); } }, '⏪'),
          bPlay,
          h('button', { class: 'btn sm', type: 'button', onclick: function () { show(Math.min(seq.length - 1, idx + 1), playing); } }, '⏩'),
          h('button', { class: 'btn sm', type: 'button', onclick: function () { show(0, true); } }, '↺ Boshidan'),
          cnt
        ]);
        body.appendChild(ctr);
        var endBox = h('div', { hidden: true });
        body.appendChild(endBox);
        function draw(i) {
          var it = seq[i];
          UI.clear(stage); UI.clear(cap);
          stage.className = 'a0-stage' + (it.intro ? ' intro' : it.text ? ' text' : '');
          if (it.intro) {
            stage.appendChild(h('div', { class: 'a0-vlogo' }, [h('span', {}, 'SABO ACADEMY · A0'), h('b', {}, l.n + '-dars'), h('div', { lang: 'ar', dir: 'rtl' }, l.titleAr), h('em', {}, l.title)]));
            cap.textContent = l.intro;
          } else if (it.letter && !it.forms) {
            var x = F.letter(it.letter);
            stage.appendChild(h('div', { class: 'a0-vletter' }, [
              h('img', { src: x.img, alt: '' }),
              h('div', {}, [h('div', { class: 'a0-vbig', lang: 'ar', dir: 'rtl' }, x.show), h('b', {}, x.name + ' · ' + x.nameAr), h('span', { class: 'a0-place' }, x.place)])
            ]));
            cap.textContent = x.tip;
          } else if (it.forms) {
            var x2 = F.letter(it.letter), f = F.forms(x2);
            stage.appendChild(h('div', { class: 'a0-vforms', lang: 'ar', dir: 'rtl' }, [f.alone, f.start, f.middle, f.end].filter(Boolean).map(function (t) { return h('span', {}, t); })));
            cap.textContent = x2.name + ': alohida · boshida · o‘rtasida · oxirida';
          } else {
            stage.appendChild(h('div', { class: 'a0-vbig' + (it.text || it.ar.length > 24 ? ' long' : ''), lang: 'ar', dir: 'rtl' }, it.ar));
            if (!it.text && it.ar.length <= 24) cap.textContent = F.translit(it.ar);
            else if (it.text) { var tx = F.BOOK.texts.filter(function (t) { return t.ar === it.ar; })[0]; cap.textContent = tx ? tx.uz : ''; }
          }
          bar.firstChild.style.width = Math.round(i * 100 / (seq.length - 1)) + '%';
          cnt.textContent = (i + 1) + ' / ' + seq.length;
        }
        function playOne(i) {
          var it = seq[i];
          if (it.intro) return a0PlayUrl(F.uzUrl(l.id), null).then(function () { if (!F.uzUrl(l.id)) return new Promise(function (r) { setTimeout(r, 4000); }); });
          if (it.letter && !it.forms && l.kind === 'letters') return a0SayLetter(it.letter, true);
          return a0Say(it.say || it.ar);
        }
        function show(i, autoplay) {
          a0Stop(); idx = i; draw(i);
          playing = !!autoplay; bPlay.textContent = playing ? '⏸ Pauza' : '▶ Davom';
          if (!playing) return;
          var g = A0P.gen;
          playOne(i).then(function () {
            if (g !== A0P.gen) return;
            /* o'quvchi takrorlashi uchun pauza */
            setTimeout(function () {
              if (g !== A0P.gen) return;
              if (i + 1 < seq.length) show(i + 1, true);
              else finish();
            }, i === 0 ? 600 : (seq[i].text ? 2500 : 1300));
          });
        }
        function finish() {
          playing = false; bPlay.textContent = '↺ Qayta ko‘rish';
          mark('video');
          endBox.hidden = false; UI.clear(endBox);
          endBox.appendChild(h('div', { class: 'a0-done' }, [h('b', {}, '✓ Video tugadi'), h('span', {}, 'Endi mashqlarda o‘zingizni tekshiring.')]));
        }
        bPlay.onclick = function () { if (playing) { a0Stop(); playing = false; bPlay.textContent = '▶ Davom'; } else show(idx, true); };
        draw(0);
        body.appendChild(nextBtn('Tekshirish mashqlariga o‘tish', function () { mark('video'); goStep('practice'); }));
      }

      /* ---- Savol kartochkasi (mashq va test uchun umumiy) ---- */
      function questionCard(qq, onPick, instant) {
        var box = h('div', { class: 'a0-q' });
        box.appendChild(h('div', { class: 'a0-qp' }, qq.prompt));
        if (qq.show) box.appendChild(h('div', { class: 'a0-qshow', lang: 'ar', dir: 'rtl' }, qq.show));
        if (qq.audio) {
          var ab = h('button', { class: 'btn', type: 'button', onclick: function () { a0Stop(); a0Say(qq.audio); } }, '🔊 Eshitish');
          box.appendChild(h('div', { class: 'a0-qaudio' }, ab));
          setTimeout(function () { a0Say(qq.audio); }, 250);
        }
        var opts = h('div', { class: 'a0-opts' + (qq.optionsAr ? ' ar' : '') });
        qq.options.forEach(function (op, k) {
          opts.appendChild(h('button', { type: 'button', class: 'a0-opt', lang: qq.optionsAr ? 'ar' : null, dir: qq.optionsAr ? 'rtl' : null, onclick: function (e) {
            Array.prototype.forEach.call(opts.children, function (b) { b.disabled = true; });
            if (instant) {
              var ok = k === qq.answer;
              e.currentTarget.classList.add(ok ? 'ok' : 'bad');
              if (!ok && opts.children[qq.answer]) opts.children[qq.answer].classList.add('ok');
              if (qq.audioAfter) a0Say(qq.audioAfter);
              onPick(k, ok);
            } else { e.currentTarget.classList.add('pick'); onPick(k); }
          } }, op));
        });
        box.appendChild(opts);
        return box;
      }

      /* ---- 3. Mashq: darhol tekshiriladi ---- */
      function stepPractice(body) {
        var qs = F.buildPractice(l), i = 0, right = 0;
        body.appendChild(h('div', { class: 'a0-ph' }, [
          h('span', { class: 'a0-eyebrow dark' }, '3-qadam · tekshirish mashqlari'),
          h('h3', {}, 'O‘zingizni tekshiring'),
          h('p', {}, 'Javobni tanlang — to‘g‘ri yoki xato ekanini darhol ko‘rasiz. Xato qilsangiz, to‘g‘ri javobni eslab qoling.')
        ]));
        var area = h('div', {});
        body.appendChild(area);
        function draw() {
          UI.clear(area);
          if (i >= qs.length) {
            var pct = Math.round(right * 100 / qs.length);
            mark('practice');
            area.appendChild(h('div', { class: 'a0-result' }, [
              h('div', { class: 'a0-big ' + (pct >= F.PASS ? 'ok' : 'bad') }, right + ' / ' + qs.length),
              h('p', {}, pct >= F.PASS ? 'Yaxshi! Endi testni topshiring.' : 'Yana bir bor yodlash qismini ko‘rib chiqing, keyin mashqni qayta ishlang.'),
              h('div', { class: 'a0-row' }, [
                h('button', { class: 'btn', type: 'button', onclick: function () { i = 0; right = 0; draw(); } }, '↺ Qayta ishlash'),
                h('button', { class: 'btn primary', type: 'button', onclick: function () { goStep('test'); } }, 'Testga o‘tish →')
              ])
            ]));
            return;
          }
          area.appendChild(h('div', { class: 'sp-cbar' }, h('i', { style: 'width:' + Math.round(i * 100 / qs.length) + '%' })));
          area.appendChild(h('div', { class: 'small muted', style: 'margin:6px 0' }, (i + 1) + ' / ' + qs.length + '  ·  to‘g‘ri: ' + right));
          var nxt = h('div', { class: 'a0-next', hidden: true }, h('button', { class: 'btn primary', type: 'button', onclick: function () { a0Stop(); i++; draw(); } }, 'Keyingisi →'));
          area.appendChild(questionCard(qs[i], function (k, ok) { if (ok) right++; nxt.hidden = false; }, true));
          area.appendChild(nxt);
        }
        draw();
      }

      /* ---- 4. Test: serverda baholanadi ---- */
      function stepTest(body) {
        body.appendChild(h('div', { class: 'a0-ph' }, [
          h('span', { class: 'a0-eyebrow dark' }, '4-qadam · test'),
          h('h3', {}, l.n + '-dars testi'),
          h('p', {}, 'Kamida ' + F.PASS + '% to‘plang. Javoblar test oxirida tekshiriladi. Istalgancha qayta topshirish mumkin.')
        ]));
        var area = h('div', {}, h('div', { class: 'a0-next' }, h('button', { class: 'btn primary lg', type: 'button', onclick: start }, 'Testni boshlash →')));
        body.appendChild(area);
        function start() {
          UI.clear(area); area.appendChild(loading());
          src.alifStart(lid).then(function (t) {
            var qs = t.questions, ans = [], i = 0;
            function draw() {
              UI.clear(area);
              if (i >= qs.length) { send(); return; }
              area.appendChild(h('div', { class: 'sp-cbar' }, h('i', { style: 'width:' + Math.round(i * 100 / qs.length) + '%' })));
              area.appendChild(h('div', { class: 'small muted', style: 'margin:6px 0' }, (i + 1) + ' / ' + qs.length));
              area.appendChild(questionCard(qs[i], function (k) { ans[i] = k; setTimeout(function () { a0Stop(); i++; draw(); }, 550); }, false));
            }
            function send() {
              area.appendChild(loading());
              src.alifSubmit(t.sessId, ans).then(function (r) {
                cache.alif = Promise.resolve(r.view); delete cache.top;
                UI.clear(area);
                area.appendChild(h('div', { class: 'a0-result' }, [
                  h('div', { class: 'a0-big ' + (r.passed ? 'ok' : 'bad') }, r.result.percent + '%'),
                  h('h3', {}, r.passed ? 'Barakalla! Testdan o‘tdingiz' : 'O‘tish uchun kamida ' + F.PASS + '% kerak'),
                  h('p', { class: 'muted' }, r.result.correct + ' / ' + r.result.total + ' to‘g‘ri.' + (r.passed ? ' Endi uy vazifasini bajaring — shundan keyin keyingi dars ochiladi.' : ' Yodlash va mashqni yana ko‘rib chiqing.')),
                  h('div', { class: 'a0-row' }, [
                    h('button', { class: 'btn', type: 'button', onclick: function () { goStep(r.passed ? 'test' : 'learn'); } }, r.passed ? '↺ Qayta topshirish' : '← Yodlashga qaytish'),
                    r.passed ? h('button', { class: 'btn primary', type: 'button', onclick: function () { goStep('hw'); } }, 'Uy vazifasiga o‘tish →')
                      : h('button', { class: 'btn primary', type: 'button', onclick: start }, 'Qayta urinish')
                  ])
                ]));
              }).catch(function (e) { fail(area, e); });
            }
            draw();
          }).catch(function (e) { fail(area, e); });
        }
      }

      /* ---- 5. Uy vazifasi: daftar + avtomatik savollar ---- */
      function stepHw(body, lv) {
        body.appendChild(h('div', { class: 'a0-ph home' }, [
          h('span', { class: 'a0-eyebrow dark' }, '5-qadam · uy vazifasi (daftar, ' + l.n + '-dars)'),
          h('h3', {}, '🏠 Uy vazifasi'),
          h('p', {}, 'Daftardagi topshiriqlarni bajaring, keyin bu yerda savollarga javob bering va «Topshirish»ni bosing. Avtomatik qismdan kamida ' + F.PASS + '% to‘plasangiz, keyingi dars ochiladi.')
        ]));
        body.appendChild(h('div', { class: 'a0-rule' }, [h('b', {}, '📌 Eslatma'), h('p', {}, l.rule)]));
        if (lv.hw && lv.hw.at) body.appendChild(h('div', { class: 'a0-done' }, [h('b', {}, '✓ Topshirilgan · ' + lv.hw.at), h('span', {}, 'Avtomatik qism: ' + lv.hw.percent + '%' + (lv.hw.ok ? ' — qabul qilindi.' : ' — kamida ' + F.PASS + '% kerak, qayta topshiring.'))]));
        var area = h('div', {}, loading());
        body.appendChild(area);
        var fileIds = [];
        (src.alifHwStart ? src.alifHwStart(lid) : Promise.resolve({ questions: F.publicTest(F.buildHomework(l)), tasks: F.hwTasks(l) })).then(function (t) {
          UI.clear(area);
          var done = {}, ans = [];
          /* Daftar topshiriqlari */
          area.appendChild(h('h4', { class: 'a0-h4' }, 'Daftarda bajaring'));
          area.appendChild(h('div', { class: 'a0-tasks' }, t.tasks.map(function (tk, i) {
            var cb = h('input', { type: 'checkbox', onchange: function () { done[tk.id] = cb.checked; } });
            var kids = [h('label', { class: 'a0-task-h' }, [cb, h('span', {}, (i + 1) + '. ' + tk.title)])];
            if (tk.sample && tk.sample.length) kids.push(h('div', { class: 'a0-sample', lang: 'ar', dir: 'rtl' }, tk.sample.map(function (s) { return h('span', {}, s); })));
            if (tk.id === 'oqi') kids.push(h('button', { class: 'btn sm', type: 'button', onclick: function () { goStep('learn'); } }, '🔊 Darsdagi ovozlar bilan o‘qish'));
            return h('div', { class: 'a0-task' }, kids);
          })));
          /* Daftar rasmi (ixtiyoriy) */
          var upSt = h('span', { class: 'small muted' }, '');
          var inp = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async function () {
            var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
            upSt.textContent = 'Yuklanmoqda…';
            try { var sh = await shrink(f); var r = await src.upload({ name: 'A0-' + l.n + '-dars-daftar.jpg', type: sh.type, data: sh.b64, note: 'A0 ' + l.n + '-dars uy vazifasi' }); if (r && r.file && r.file.id) fileIds.push(r.file.id); upSt.textContent = '✓ Rasm yuborildi (' + fileIds.length + ')'; }
            catch (e) { upSt.textContent = e.message || 'Yuklanmadi'; }
          } });
          area.appendChild(h('div', { class: 'a0-upload' }, [h('button', { class: 'btn sm', type: 'button', onclick: function () { inp.click(); } }, '📷 Daftar rasmini yuborish (ixtiyoriy)'), upSt, inp]));
          /* Avtomatik savollar */
          area.appendChild(h('h4', { class: 'a0-h4' }, 'Savollarga javob bering'));
          t.questions.forEach(function (qq, i) {
            var c = questionCard(qq, function (k) {
              ans[i] = k;
              Array.prototype.forEach.call(c.querySelectorAll('.a0-opt'), function (b, j) { b.disabled = false; b.classList.toggle('pick', j === k); });
            }, false);
            c.insertBefore(h('span', { class: 'a0-qn' }, String(i + 1)), c.firstChild);
            area.appendChild(c);
          });
          var msg = h('p', { class: 'small', hidden: true });
          area.appendChild(msg);
          area.appendChild(h('div', { class: 'a0-next' }, h('button', { class: 'btn primary lg', type: 'button', onclick: function (e) {
            var miss = t.questions.filter(function (qq, i) { return ans[i] == null; }).length;
            if (miss) { msg.hidden = false; msg.textContent = 'Hali ' + miss + ' ta savolga javob bermadingiz.'; return; }
            var btn = e.currentTarget; btn.disabled = true;
            src.alifHw(lid, ans, done, fileIds).then(function (r) {
              cache.alif = Promise.resolve(r.view); delete cache.top;
              var nx = r.view.lessons.filter(function (x) { return x.n === l.n + 1; })[0];
              UI.clear(area);
              area.appendChild(h('div', { class: 'a0-result' }, [
                h('div', { class: 'a0-big ' + (r.passed ? 'ok' : 'bad') }, r.result.percent + '%'),
                h('h3', {}, r.passed ? 'Uy vazifasi qabul qilindi!' : 'Kamida ' + F.PASS + '% kerak — qayta urinib ko‘ring'),
                h('p', { class: 'muted' }, r.passed ? (nx ? (nx.status === 'locked' ? 'Keyingi dars testdan o‘tgach ochiladi.' : 'Keyingi dars ochildi: ' + nx.n + '. ' + nx.title) : 'Tabriklaymiz — A0 kursini tugatdingiz! Endi A1 darslariga o‘tasiz.') : r.result.correct + ' / ' + r.result.total + ' to‘g‘ri.'),
                h('div', { class: 'a0-row' }, [
                  h('button', { class: 'btn', type: 'button', onclick: function () { go('alifbo'); } }, 'Darslar ro‘yxati'),
                  r.passed && nx && nx.status !== 'locked' ? h('button', { class: 'btn primary', type: 'button', onclick: function () { openAlif(nx.id, 'learn'); } }, 'Keyingi dars →')
                    : (!r.passed ? h('button', { class: 'btn primary', type: 'button', onclick: function () { goStep('hw'); } }, 'Qayta topshirish') : null)
                ])
              ]));
            }).catch(function (er) { btn.disabled = false; msg.hidden = false; msg.textContent = er.message || 'Yuborilmadi'; });
          } }, 'Topshirish →')));
        }).catch(function (e) { fail(area, e); });
      }
    }

    /* ---------- Reyting va ballarim (gamifikatsiya) ---------- */
    function vRating(el) {
      var box = h('div', {}, loading());
      el.appendChild(box);
      load('top').then(function (t) {
        UI.clear(box);
        if (!t || !t.enabled) { box.appendChild(empty('award', 'Reyting hozircha yoqilmagan', 'Markaz ball tizimini yoqqanda shu yerda ballaringiz chiqadi.')); return; }
        var me = t.me, R = t.rules || {};
        if (me) {
          box.appendChild(h('section', { class: 'sp-hero gm-hero' }, [
            h('div', { class: 'sp-hero-l' }, [
              h('span', { class: 'sp-eyebrow' }, 'Mening natijam'),
              h('h1', {}, me.points + ' ball'),
              h('p', {}, me.rank === 1 ? 'Siz markazda 1-o’rindasiz! 🏆' : me.rank + '-o’rin · ' + me.count + ' o’quvchi orasida. Yuqoriga ko’tarilish uchun darsga keling va vazifani a’lo bajaring.')
            ]),
            h('div', { class: 'gm-parts' }, [
              part('Davomat', me.parts.keldi + me.parts.kechikdi + ' dars'),
              part('Baholar', me.parts.grades + ' ta · ' + me.parts.gradePts + ' ball'),
              part('Testlar', (me.parts.tests + me.parts.quizzes) + ' ta'),
              me.parts.bonus ? part('Bonus', (me.parts.bonus > 0 ? '+' : '') + me.parts.bonus) : null
            ])
          ]));
        }
        box.appendChild(h('div', { class: 'gm-prizes' }, [
          prize('🥇', '1-o’rin', 'Tekin o’qiydi'), prize('🥈', '2-o’rin', '50% chegirma'), prize('🥉', '3-o’rin', '20% chegirma')
        ]));
        box.appendChild(card('Top o’quvchilar — butun markaz', [board(t.top)]));
        (t.groups || []).forEach(function (g) {
          box.appendChild(card('Guruh reytingi: ' + g.name, [board(g.top), g.myRank ? h('p', { class: 'sp-muted' }, 'Guruhda siz ' + g.myRank + '-o’rindasiz (' + g.count + ' kishi).') : null]));
        });
        box.appendChild(card('Ball qanday to’planadi?', [h('div', { class: 'gm-rules' }, [
          rule('Darsga keldingiz', R.keldi), rule('Kechikib keldingiz', R.kechikdi),
          rule('Ustoz «5» qo’ydi', R.grade5), rule('«4» baho', R.grade4), rule('«3» baho', R.grade3),
          rule('Dars testidan o’tdingiz (60%+)', R.testPass), rule('Markaz testidan o’tdingiz', R.quizPass)
        ])]));
      }).catch(function (e) { fail(box, e); });
      function prize(m, k, v) { return h('div', { class: 'gm-prize' }, [h('span', {}, m), h('small', {}, k), h('b', {}, v)]); }
      function part(k, v) { return h('div', { class: 'gm-part' }, [h('span', {}, k), h('b', {}, v)]); }
      function rule(k, v) { return h('div', { class: 'gm-rule' }, [h('span', {}, k), h('b', {}, '+' + (v || 0))]); }
      function board(list) {
        if (!list || !list.length) return h('p', { class: 'sp-muted' }, 'Hozircha ball yo’q.');
        return h('ol', { class: 'gm-board' }, list.map(function (r) {
          return h('li', { class: 'gm-row' + (r.me ? ' me' : '') + (r.rank <= 3 ? ' top' + r.rank : '') }, [
            h('span', { class: 'gm-n' }, r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : String(r.rank)),
            h('span', { class: 'gm-name' }, r.short + (r.me ? ' (siz)' : '')),
            h('b', { class: 'gm-v' }, r.points + ' ball')
          ]);
        }));
      }
    }

    /* ---------- 2. Darslarim ---------- */
    function vLessons(el) {
      var box = h('div', {}, loading());
      el.appendChild(h('p', { class: 'sp-lead' }, 'Har bir dars: video → qissa → so’zlar → qoida → mashq → test, keyin uy vazifasi. Test va uy vazifasi 60% dan yuqori bo’lsa keyingi dars ochiladi.'));
      el.appendChild(box);
      load('course').then(function (cv) {
        UI.clear(box);
        var units = (A.Course && A.Course.UNITS) || [{ id: null, title: '' }];
        units.forEach(function (u) {
          var ls = cv.lessons.filter(function (l) { return !u.id || l.unit === u.id; });
          if (!ls.length) return;
          box.appendChild(h('div', { class: 'sp-unit' }, [h('span', {}, u.n ? u.n + '-bo’lim' : ''), h('b', {}, u.title || ''), u.ar ? h('span', { class: 'sp-ar' }, u.ar) : null]));
          box.appendChild(h('div', { class: 'sp-lessons' }, ls.map(function (l) {
            var rv = (cv.reviews || []).filter(function (r) { return r.after === l.id; })[0];
            return [lessonCard(l), rv ? reviewCard(rv) : null];
          })));
        });
      }).catch(function (e) { fail(box, e); });
    }
    function reviewCard(rv) {
      var locked = rv.status === 'locked';
      return h('button', {
        type: 'button', class: 'sp-lesson sp-rv ' + rv.status,
        onclick: function () {
          if (locked) { UI.toast('Bu takrorlash ' + rv.sub.replace(' so’zlari', '') + ' tugagach ochiladi.', 'warn'); return; }
          go('lugat'); startReview(rv.id);
        }
      }, [
        h('div', { class: 'sp-lesson-top' }, [h('span', { class: 'sp-lesson-n' }, rv.status === 'done' ? '✓' : '🔁'), h('span', { class: 'sp-rv-k' }, 'Takrorlash')]),
        h('b', {}, rv.title),
        h('span', { class: 'sp-lesson-s' }, rv.sub),
        h('span', { class: 'sp-lesson-s' }, rv.status === 'done' ? 'O’tildi · ' + rv.best + '%' : locked ? 'Yopiq' : (rv.best != null ? 'Oxirgi: ' + rv.best + '% · qayta urining' : 'Ochiq — keyingi dars shundan keyin'))
      ]);
    }
    function lessonCard(l) {
      return (function () {
            var sd = stepsDone(l);
            var locked = l.status === 'locked';
            return h('button', {
              type: 'button', class: 'sp-lesson ' + l.status,
              onclick: function () {
                if (locked) { UI.toast('Bu dars oldingi dars va vazifa tugagach ochiladi.', 'warn'); return; }
                goLesson(l.id);
              }
            }, [
              h('div', { class: 'sp-lesson-top' }, [
                h('span', { class: 'sp-lesson-n' }, l.status === 'done' ? '✓' : locked ? '🔒' : String(l.n)),
                h('span', { class: 'sp-ar sp-blur' }, locked ? 'كتاب جديد' : (l.titleAr || ''))
              ]),
              h('b', { class: locked ? 'sp-blur' : '' }, l.n + '. ' + (locked ? 'Yangi dars mavzusi' : l.title)),
              locked ? h('span', { class: 'sp-lock-note' }, '🔒 Oldingi dars tugagach ochiladi') : null,
              h('div', { class: 'sp-steps' }, STEP_IDS.map(function (s) { return h('i', { class: l.steps && l.steps[s] ? 'on' : '' }); })),
              h('span', { class: 'sp-lesson-s' }, locked ? 'Yopiq' : l.status === 'done' ? 'Tugallangan' + (l.testBest != null ? ' · test ' + l.testBest + '%' : '')
                : sd ? sd + ' / 7 bosqich' : 'Boshlanmagan')
            ]);
      })();
    }

    /* ---------- 3. Uy vazifalarim ---------- */
    var hwFilter = 'hammasi';
    function vHomework(el) {
      var bar = h('div', { class: 'sp-chips' });
      var box = h('div', {}, loading());
      el.appendChild(bar); el.appendChild(box);
      var extra = h('div', {});
      el.appendChild(extra);
      Promise.all([load('course'), load('learning').catch(function () { return {}; })]).then(function (r) {
        var cv = r[0], lr = r[1] || {};
        var ls = cv.lessons;
        var F = [
          { id: 'hammasi', label: 'Hammasi', f: function () { return true; } },
          { id: 'bajar', label: 'Bajarish kerak', f: function (l) { var s = hwState(l).id; return s === 'bajar' || s === 'qayta'; } },
          { id: 'tekshir', label: 'Tekshirilmoqda', f: function (l) { return hwState(l).id === 'tekshir'; } },
          { id: 'qabul', label: 'Qabul qilingan', f: function (l) { return hwState(l).id === 'qabul'; } }
        ];
        function draw() {
          UI.clear(bar);
          F.forEach(function (x) {
            var n = ls.filter(function (l) { return l.status !== 'locked' && x.f(l); }).length;
            bar.appendChild(h('button', { type: 'button', class: 'sp-chip' + (hwFilter === x.id ? ' on' : ''), onclick: function () { hwFilter = x.id; draw(); } }, x.label + ' · ' + n));
          });
          UI.clear(box);
          var fx = F.filter(function (x) { return x.id === hwFilter; })[0];
          var rows = ls.filter(function (l) { return hwFilter === 'hammasi' ? true : (l.status !== 'locked' && fx.f(l)); });
          if (!rows.length) { box.appendChild(empty('check', 'Bu ro’yxat bo’sh', 'Boshqa bo’limni tanlang.')); return; }
          rows.forEach(function (l) {
            var s = hwState(l);
            var hw = l.hw || {};
            var prompt = '';
            try { var L = A.Course.byId(l.id); prompt = ((L.homework && L.homework.write) || []).map(function (w) { return w.prompt; }).join(' '); } catch (e) { }
            box.appendChild(h('div', { class: 'sp-hw ' + s.id }, [
              h('div', { class: 'sp-hw-h' }, [
                h('span', { class: 'sp-hw-n' }, String(l.n)),
                h('div', { class: 'sp-hw-t' }, [h('b', {}, l.title), h('span', {}, prompt || 'Darsdagi uy vazifasi')]),
                h('span', { class: 'sp-pill ' + s.cls }, s.label)
              ]),
              hw.comment ? h('div', { class: 'sp-hw-c' }, [h('b', {}, 'Ustoz izohi: '), hw.comment]) : null,
              (hw.texts && hw.texts.length && hw.texts[0]) ? h('div', { class: 'sp-hw-ans', dir: 'auto' }, hw.texts.join('\n')) : null,
              (hw.fileIds && hw.fileIds.length) ? h('div', { class: 'sp-hw-files' }, hw.fileIds.map(function (fid, i) {
                return h('a', { class: 'sp-filechip', href: src.fileUrl({ id: fid }), target: '_blank', rel: 'noopener' }, [ico('link'), 'Fayl ' + (i + 1)]);
              })) : null,
              h('div', { class: 'sp-hw-f' }, [
                hw.auto ? h('span', { class: 'sp-muted' }, 'Test qismi: ' + hw.auto.correct + '/' + hw.auto.total) : h('span', { class: 'sp-muted' }, l.status === 'locked' ? 'Oldingi dars tugagach ochiladi' : 'Rasm yoki PDF yuklash mumkin'),
                l.status === 'locked' ? null : h('button', {
                  class: 'btn sm ' + (s.id === 'bajar' || s.id === 'qayta' ? 'primary' : ''), type: 'button',
                  onclick: function () { goLesson(l.id, 'homework'); }
                }, s.id === 'bajar' ? 'Vazifani bajarish' : s.id === 'qayta' ? 'Qayta yuborish' : 'Ochish')
              ])
            ]));
          });
        }
        draw();

        /* Ustoz guruhga bergan vazifalar va testlar */
        UI.clear(extra);
        if ((lr.homework || []).length) {
          extra.appendChild(card('Guruh vazifalari (ustozdan)', lr.homework.slice(0, 10).map(function (w) {
            return h('div', { class: 'kab-item' }, [
              h('b', {}, w.title || 'Vazifa'), w.text ? h('span', {}, w.text) : null,
              h('span', { class: 'small muted' }, dateLabel(w.date) + (w.dueDate ? ' · muddat: ' + dateLabel(w.dueDate) : '') + (w.group ? ' · ' + w.group : ''))
            ]);
          })));
        }
        if ((lr.quizzes || []).length) {
          extra.appendChild(card('Testlar', lr.quizzes.slice(0, 10).map(function (q) {
            return h('div', { class: 'kab-item' }, [
              h('b', {}, q.title),
              h('span', { class: 'small muted' }, q.done ? ('Natija: ' + q.score + '/' + q.total + ' (' + q.percent + '%)') : (q.count + ' savol' + (q.due ? ' · muddat: ' + dateLabel(q.due) : ''))),
              (!q.done && lr.canSubmit && opts.runQuiz) ? h('button', { class: 'btn sm primary', type: 'button', onclick: function () { opts.runQuiz(q, st.id); } }, 'Testni ishlash') : null
            ]);
          })));
        }
      }).catch(function (e) { fail(box, e); });
    }

    /* ---------- 4. Lug'at yodlash ---------- */
    var vocabFilter = 'hammasi';
    function sayAr(t) { if (A.CourseSay) A.CourseSay(t, 0.75); }
    function boxDots(b) {
      return h('span', { class: 'sp-boxes', title: b == null ? 'hali ko’rilmagan' : (b + '/5 bosqich') },
        [0, 1, 2, 3, 4].map(function (k) { return h('i', { class: b != null && b > k ? 'on' : '' }); }));
    }
    function vVocab(el) {
      var box = h('div', {}, loading());
      el.appendChild(box);
      load('course').then(function (cv) {
        UI.clear(box);
        var today = A.today ? A.today() : new Date().toISOString().slice(0, 10);
        var vs = vocabOf(cv, today);
        /* Holat kartochkalari */
        var rvDone = (cv.reviews || []).filter(function (r) { return r.status === 'done'; }).length;
        box.appendChild(h('div', { class: 'sp-tiles' }, [
          statTile('award', 'Ochiq so’zlar', String(vs.total), 'o’tilgan darslardan'),
          statTile('check', 'Yodlangan', String(vs.learned), '3+ marta to’g’ri', 'ok'),
          statTile('clock', 'Bugun takrorlash', String(vs.due + vs.fresh), vs.fresh ? vs.fresh + ' tasi yangi' : 'kartochkalarda', vs.due + vs.fresh ? 'warn' : ''),
          statTile('task', 'Takrorlash testlari', rvDone + ' / ' + (cv.reviews || []).length, 'har 2 darsda bitta')
        ]));
        /* Bugungi mashg'ulot */
        var n = Math.min(15, vs.due + vs.fresh);
        box.appendChild(h('section', { class: 'sp-vhero' }, [
          h('div', {}, [
            h('span', { class: 'sp-eyebrow' }, 'Bugungi mashg’ulot'),
            h('h2', {}, n ? n + ' ta so’z sizni kutmoqda' : 'Bugungi takrorlash bajarilgan ✓'),
            h('p', {}, 'Kartochkada so’zni ko’ring va tinglang, ma’nosini eslang. Bilsangiz — so’z kamroq takrorlanadi, bilmasangiz — ertaga yana chiqadi.')
          ]),
          h('div', { class: 'sp-vhero-b' }, [
            h('button', { class: 'btn sp-cta', type: 'button', onclick: function () { startCards(); } }, n ? 'Kartochkalarni boshlash →' : 'Baribir mashq qilish →'),
            h('button', { class: 'btn sp-cta2', type: 'button', onclick: function () { startCards({ reverse: true }); } }, 'O’zbekcha → arabcha')
          ])
        ]));
        /* Takrorlash testlari */
        box.appendChild(card('Takrorlash testlari — har 2 darsdan keyin', [h('div', { class: 'sp-rvlist' }, (cv.reviews || []).map(function (rv) {
          var locked = rv.status === 'locked';
          return h('div', { class: 'sp-rvrow ' + rv.status }, [
            h('span', { class: 'sp-rvrow-n' }, rv.status === 'done' ? '✓' : locked ? '🔒' : '🔁'),
            h('div', { class: 'sp-rvrow-t' }, [h('b', {}, rv.title), h('span', {}, rv.sub + (rv.best != null ? ' · eng yaxshi natija ' + rv.best + '%' : ''))]),
            locked ? h('span', { class: 'sp-pill muted' }, 'Yopiq')
              : h('button', { class: 'btn sm ' + (rv.status === 'open' ? 'primary' : ''), type: 'button', onclick: function () { startReview(rv.id); } }, rv.status === 'done' ? 'Yana ishlash' : 'Boshlash')
          ]);
        }))]));
        /* So'zlar ro'yxati */
        var chips = h('div', { class: 'sp-chips' });
        var list = h('div', { class: 'sp-wlist' });
        function drawList() {
          UI.clear(chips);
          [['hammasi', 'Hammasi'], ['yangi', 'Yodlanmagan'], ['yod', 'Yodlangan']].forEach(function (c) {
            chips.appendChild(h('button', { type: 'button', class: 'sp-chip' + (vocabFilter === c[0] ? ' on' : ''), onclick: function () { vocabFilter = c[0]; drawList(); } }, c[1]));
          });
          UI.clear(list);
          var ws = vs.words.filter(function (w) { return vocabFilter === 'hammasi' || (vocabFilter === 'yod' ? w.b >= 3 : !(w.b >= 3)); });
          if (!ws.length) { list.appendChild(empty('award', 'Bu ro’yxat bo’sh', '')); return; }
          var lastN = null;
          ws.forEach(function (w) {
            if (w.n !== lastN) { lastN = w.n; list.appendChild(h('div', { class: 'sp-wgroup' }, w.n + '-dars · ' + A.Course.byId(w.lessonId).title)); }
            list.appendChild(h('div', { class: 'sp-word' }, [
              h('button', { class: 'sp-word-say', type: 'button', 'aria-label': 'Tinglash', onclick: function () { sayAr(w.ar); } }, '🔊'),
              h('b', { class: 'sp-word-ar', lang: 'ar', dir: 'rtl' }, w.ar),
              h('span', { class: 'sp-word-tr' }, w.tr),
              h('span', { class: 'sp-word-uz' }, w.uz),
              boxDots(w.b)
            ]));
          });
        }
        drawList();
        box.appendChild(card('Mening lug’atim', [chips, list]));
      }).catch(function (e) { fail(box, e); });
    }
    function statTile(icon, label, value, hint, cls) {
      return h('div', { class: 'sp-tile ' + (cls || '') }, [h('i', { class: 'sp-tile-i' }, ico(icon)), h('div', {}, [h('small', {}, label), h('b', {}, value), h('span', {}, hint || '')])]);
    }
    /* Ochiq darslar so'zlari va ularning Leitner holati (serverdagi view dan) */
    function vocabOf(cv, today) {
      var open = {};
      cv.lessons.forEach(function (l) { if (l.status !== 'locked') open[l.id] = 1; });
      var map = (cv.vocab && cv.vocab.map) || {};
      var learned = 0, due = 0, fresh = 0;
      var words = A.Course.allWords().filter(function (w) { return open[w.lessonId]; }).map(function (w) {
        var v = map[w.key];
        w.b = v ? v.b : null; w.due = v ? v.due : null;
        if (!v) fresh++; else { if (v.b >= 3) learned++; if (!v.due || v.due <= today) due++; }
        return w;
      });
      return { words: words, total: words.length, learned: learned, due: due, fresh: fresh };
    }

    /** Kartochkalar sessiyasi (Leitner): avval muddati kelganlar, keyin yangilar */
    function startCards(o) {
      o = o || {};
      load('course').then(function (cv) {
        var today = A.today ? A.today() : new Date().toISOString().slice(0, 10);
        var vs = vocabOf(cv, today);
        var due = vs.words.filter(function (w) { return w.b != null && (!w.due || w.due <= today); });
        var fresh = vs.words.filter(function (w) { return w.b == null; });
        var deck = due.concat(fresh).slice(0, 15);
        if (!deck.length) deck = vs.words.slice().sort(function () { return Math.random() - .5; }).slice(0, 10);
        if (!deck.length) { UI.toast('Hali ochiq so’z yo’q.', 'warn'); return; }
        var results = [], i = 0, shown = false;
        UI.clear(view);
        var wrap = h('div', { class: 'sp-cards' });
        view.appendChild(wrap);
        function finish() {
          UI.clear(wrap);
          var ok = results.filter(function (r) { return r.ok; }).length;
          wrap.appendChild(h('div', { class: 'sp-card sp-cdone' }, [
            h('div', { class: 'sp-cdone-big' }, ok + ' / ' + results.length),
            h('h2', {}, ok === results.length ? 'Ajoyib! Hammasini bildingiz' : 'Yaxshi! Bilmaganlaringiz ertaga yana chiqadi'),
            h('div', { class: 'rowflex', style: 'gap:8px;justify-content:center;flex-wrap:wrap' }, [
              h('button', { class: 'btn', type: 'button', onclick: function () { delete cache.course; go('lugat'); } }, 'Lug’atga qaytish'),
              h('button', { class: 'btn primary', type: 'button', onclick: function () { delete cache.course; startCards(o); } }, 'Yana bir to’plam')
            ])
          ]));
          src.vocab(results).then(function () { delete cache.course; }).catch(function (e) { UI.toast(e.message || 'Saqlanmadi', 'bad'); });
        }
        function draw() {
          if (i >= deck.length) { finish(); return; }
          var w = deck[i]; shown = false;
          UI.clear(wrap);
          var bar = h('div', { class: 'sp-cbar' }, h('i', { style: 'width:' + Math.round(i * 100 / deck.length) + '%' }));
          var animEl = h('div', { class: 'sp-canim' }); animEl.innerHTML = A.CourseAnim ? A.CourseAnim.render(w.anim, '') : '';
          var front = o.reverse
            ? [h('div', { class: 'sp-cq' }, 'Arabchasini eslang:'), h('div', { class: 'sp-cuz-big' }, w.uz)]
            : [animEl, h('div', { class: 'sp-car', lang: 'ar', dir: 'rtl' }, w.ar), h('button', { class: 'sp-csay', type: 'button', onclick: function (e) { e.stopPropagation(); sayAr(w.ar); } }, '🔊 Tinglash')];
          var back = h('div', { class: 'sp-cback' }, o.reverse
            ? [animEl, h('div', { class: 'sp-car', lang: 'ar', dir: 'rtl' }, w.ar), h('span', { class: 'sp-ctr' }, w.tr)]
            : [h('div', { class: 'sp-cuz' }, w.uz), h('span', { class: 'sp-ctr' }, w.tr)]);
          back.hidden = true;
          var actions = h('div', { class: 'sp-cact' }, [
            h('button', { class: 'btn lg sp-show', type: 'button', onclick: reveal }, 'Ko’rsatish')
          ]);
          function reveal() {
            if (shown) return; shown = true; back.hidden = false;
            if (o.reverse) sayAr(w.ar);
            UI.clear(actions);
            actions.appendChild(h('button', { class: 'btn lg sp-no', type: 'button', onclick: function () { results.push({ key: w.key, ok: false }); i++; draw(); } }, '✗ Bilmadim'));
            actions.appendChild(h('button', { class: 'btn lg sp-yes', type: 'button', onclick: function () { results.push({ key: w.key, ok: true }); i++; draw(); } }, '✓ Bildim'));
          }
          wrap.appendChild(h('div', { class: 'sp-chead' }, [
            h('button', { class: 'sp-link', type: 'button', onclick: function () { if (results.length) src.vocab(results).catch(function () { }); delete cache.course; go('lugat'); } }, '← Chiqish'),
            h('span', {}, (i + 1) + ' / ' + deck.length), boxDots(w.b)
          ]));
          wrap.appendChild(bar);
          wrap.appendChild(h('div', { class: 'sp-flash', onclick: reveal }, front.concat([back])));
          wrap.appendChild(actions);
          if (!o.reverse) sayAr(w.ar);
        }
        draw();
      }).catch(function (e) { UI.toast(e.message || 'Yuklanmadi', 'bad'); });
    }

    /** Takrorlash testi: har 2 darsdan keyin; 60% dan o'tilsa keyingi dars ochiladi */
    function startReview(rid) {
      var rv = A.Course.reviewById(rid); if (!rv) return;
      var qs = A.Course.buildReview(rv);
      var ans = [], i = 0;
      UI.clear(view);
      var wrap = h('div', { class: 'sp-cards' });
      view.appendChild(wrap);
      function draw() {
        UI.clear(wrap);
        if (i >= qs.length) { send(); return; }
        var q = qs[i];
        wrap.appendChild(h('div', { class: 'sp-chead' }, [
          h('button', { class: 'sp-link', type: 'button', onclick: function () { go('lugat'); } }, '← Chiqish'),
          h('b', {}, rv.title), h('span', {}, (i + 1) + ' / ' + qs.length)
        ]));
        wrap.appendChild(h('div', { class: 'sp-cbar' }, h('i', { style: 'width:' + Math.round(i * 100 / qs.length) + '%' })));
        var card0 = h('div', { class: 'sp-flash test' }, [h('div', { class: 'sp-cq' }, q.prompt)]);
        if (q.show) card0.appendChild(h('div', { class: 'sp-car', lang: 'ar', dir: 'rtl' }, q.show));
        if (q.say) { card0.appendChild(h('button', { class: 'sp-csay big', type: 'button', onclick: function () { sayAr(q.say); } }, '🔊 Yana tinglash')); setTimeout(function () { sayAr(q.say); }, 250); }
        if (q.anim && A.CourseAnim) { var an = h('div', { class: 'sp-canim' }); an.innerHTML = A.CourseAnim.render(q.anim, ''); card0.appendChild(an); }
        wrap.appendChild(card0);
        wrap.appendChild(h('div', { class: 'sp-opts' + (q.optionsAr ? ' ar' : '') }, q.options.map(function (op, k) {
          return h('button', { class: 'sp-opt', type: 'button', lang: q.optionsAr ? 'ar' : null, dir: q.optionsAr ? 'rtl' : null, onclick: function (e) {
            ans[i] = k;
            var good = k === q.answer;
            e.currentTarget.classList.add(good ? 'ok' : 'bad');
            if (!good) { var right = e.currentTarget.parentNode.children[q.answer]; if (right) right.classList.add('ok'); }
            Array.prototype.forEach.call(e.currentTarget.parentNode.children, function (b) { b.disabled = true; });
            setTimeout(function () { i++; draw(); }, good ? 550 : 1300);
          } }, op);
        })));
      }
      function send() {
        wrap.appendChild(loading());
        src.review(rid, ans).then(function (r) {
          delete cache.course;
          UI.clear(wrap);
          wrap.appendChild(h('div', { class: 'sp-card sp-cdone' }, [
            h('div', { class: 'sp-cdone-big ' + (r.passed ? 'ok' : 'bad') }, r.result.percent + '%'),
            h('h2', {}, r.passed ? 'Barakalla! ' + rv.title + ' o’tildi' : 'O’tish uchun ' + A.Course.PASS + '% kerak'),
            h('p', { class: 'sp-muted' }, r.passed ? 'Keyingi dars ochildi. Xato qilgan so’zlaringiz lug’at kartochkalarida tez-tez chiqadi.'
              : 'Xato so’zlar kartochkalarga qo’shildi. Ularni takrorlab, testni qayta ishlang.'),
            h('div', { class: 'rowflex', style: 'gap:8px;justify-content:center;flex-wrap:wrap' }, [
              r.passed ? h('button', { class: 'btn primary', type: 'button', onclick: function () { go('darslar'); } }, 'Darslarimga →')
                : h('button', { class: 'btn primary', type: 'button', onclick: function () { startCards(); } }, 'Kartochkalar bilan takrorlash'),
              h('button', { class: 'btn', type: 'button', onclick: function () { startReview(rid); } }, 'Qayta ishlash')
            ])
          ]));
        }).catch(function (e) { UI.clear(wrap); wrap.appendChild(h('p', { class: 'err-msg' }, e.message || 'Saqlanmadi')); });
      }
      draw();
    }

    /* ---------- 4. Dars jadvali ---------- */
    function vSchedule(el) {
      var nx = upcoming(groups, 8);
      if (nx[0]) {
        var n0 = nx[0];
        el.appendChild(h('section', { class: 'sp-next' + (n0.live ? ' live' : '') }, [
          h('div', {}, [
            h('span', { class: 'sp-eyebrow' }, n0.live ? 'Dars hozir ketmoqda' : 'Keyingi jonli dars'),
            h('h2', {}, whenLabel(n0)),
            h('p', {}, n0.g.name + (n0.g.teacher ? ' · ' + n0.g.teacher : '') + ' · ' + (n0.g.room || 'Onlayn'))
          ]),
          n0.g.zoomLink ? h('div', { class: 'sp-zoom' }, [
            h('a', { class: 'btn sp-cta', href: n0.g.zoomLink, target: '_blank', rel: 'noopener' },
              n0.g.zoomToday && n0.g.zoomToday.joined ? 'Darsga qaytish →' : 'Zoom’ga kirish →'),
            n0.g.zoomToday && n0.g.zoomToday.personal ? h('span', { class: 'sp-zoom-n' }, 'Shaxsiy havolangiz — davomat o’zi belgilanadi') : null,
            n0.g.zoomToday && n0.g.zoomToday.password ? h('span', { class: 'sp-zoom-n' }, 'Parol: ' + n0.g.zoomToday.password) : null
          ])
            : h('span', { class: 'sp-muted light' }, 'Zoom havolasi dars oldidan beriladi')
        ]));
      }
      /* Haftalik jadval */
      var week = h('div', { class: 'sp-week' }, DAYS_SHORT.map(function (dn, i) {
        var wd = i + 1;
        var gs = groups.filter(function (g) { return (g.days || []).map(Number).indexOf(wd) >= 0; });
        var today = ((new Date().getDay() + 6) % 7 + 1) === wd;
        return h('div', { class: 'sp-day' + (gs.length ? ' has' : '') + (today ? ' today' : '') },
          [h('b', {}, dn)].concat(gs.length ? gs.map(function (g) { return h('span', {}, g.startTime || ''); }) : [h('span', { class: 'sp-muted' }, '—')]));
      }));
      el.appendChild(card('Haftalik jadval', [week]));
      el.appendChild(card('Yaqin darslar', nx.length ? nx.map(function (x) {
        return h('div', { class: 'kab-line' }, [h('span', {}, whenLabel(x)), h('b', {}, x.g.name)]);
      }) : [h('p', { class: 'sp-muted' }, 'Jadval hali belgilanmagan.')]));
      el.appendChild(card('Guruhlarim', [groupsBlock()]));
    }

    /* ---------- 5. To'lovlarim ---------- */
    function vPay(el) {
      el.appendChild(h('section', { class: 'sp-paybig ' + (fin.overdue > 0 ? 'bad' : 'ok') }, [
        h('div', {}, [
          h('span', { class: 'sp-eyebrow' }, fin.debt > 0 ? 'To’lanishi kerak' : 'Holat'),
          h('h2', {}, fin.debt > 0 ? som(fin.debt) : 'Qarzingiz yo’q ✓'),
          fin.next ? h('p', {}, (fin.next.upcoming ? 'Keyingi hisob: ' : 'Muddat: ') + dateLabel(fin.next.dueDate) + ' gacha') : null,
          fin.overdue > 0 ? h('p', { class: 'sp-od' }, 'Muddati o’tgan: ' + som(fin.overdue)) : null
        ]),
        fin.advance > 0 ? h('div', { class: 'sp-adv' }, [h('small', {}, 'Balansda'), h('b', {}, '+' + som(fin.advance))]) : null
      ]));
      var how = h('div', {}, loading());
      var inv = h('div', {}, loading());
      var hist = h('div', {}, loading());
      el.appendChild(card('Qanday to’lash mumkin', [how]));
      el.appendChild(h('div', { class: 'sp-grid2' }, [card('Oylik hisoblar', [inv]), card('To’lovlar tarixi', [hist])]));
      load('payments').then(function (p) {
        UI.clear(how);
        if (p.card) {
          var num = String(p.card.number);
          how.appendChild(h('div', { class: 'sp-cardbox' }, [
            h('div', { class: 'sp-bankcard' }, [
              h('small', {}, 'Humo / Uzcard'),
              h('b', {}, num.replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 ')),
              h('span', {}, p.card.holder || '')
            ]),
            h('div', { class: 'sp-steps-how' }, [
              h('p', {}, [h('b', {}, '1. '), 'Telegram botimizda «To’lov qilish 💳» tugmasini bosing — aniq summa chiqadi.']),
              h('p', {}, [h('b', {}, '2. '), 'Shu kartaga o’tkazing va «To’ladim ✅» ni bosing.']),
              h('p', {}, [h('b', {}, '3. '), 'Pul tushishi bilan to’lov avtomatik tasdiqlanadi, kvitansiya botga keladi.']),
              h('div', { class: 'rowflex', style: 'gap:8px;margin-top:8px;flex-wrap:wrap' }, [
                h('button', {
                  class: 'btn sm', type: 'button', onclick: function () {
                    try { navigator.clipboard.writeText(num.replace(/\s/g, '')); UI.toast('Karta raqami nusxalandi.', 'ok'); }
                    catch (e) { UI.toast(num, 'ok'); }
                  }
                }, 'Raqamni nusxalash'),
                p.botUsername ? h('a', { class: 'btn sm primary', href: 'https://t.me/' + p.botUsername, target: '_blank', rel: 'noopener' }, 'Botda to’lash') : null
              ])
            ])
          ]));
        } else {
          how.appendChild(h('p', { class: 'sp-muted' }, 'To’lovni markaz administratori orqali qiling.'));
        }
        UI.clear(inv);
        if (!p.invoices.length) inv.appendChild(h('p', { class: 'sp-muted' }, 'Hisob yo’q.'));
        p.invoices.slice(0, 12).forEach(function (i) {
          var cls = i.remaining <= 0 ? 'ok' : (i.dueDate && i.dueDate < (A.today ? A.today() : '') ? 'bad' : 'warn');
          inv.appendChild(h('div', { class: 'sp-inv' }, [
            h('div', {}, [h('b', {}, i.monthLabel), h('span', {}, (i.group ? i.group + ' · ' : '') + (i.dueDate ? 'muddat ' + dateLabel(i.dueDate) : ''))]),
            h('div', { class: 'sp-inv-r' }, [h('b', {}, som(i.amount)),
              h('span', { class: 'sp-pill ' + cls }, i.remaining <= 0 ? 'To’langan' : 'Qoldiq ' + som(i.remaining))])
          ]));
        });
        UI.clear(hist);
        if (!p.payments.length) hist.appendChild(h('p', { class: 'sp-muted' }, 'Hali to’lov yo’q.'));
        p.payments.slice(0, 15).forEach(function (x) {
          hist.appendChild(h('div', { class: 'sp-inv' }, [
            h('div', {}, [h('b', {}, dateLabel(x.date)), h('span', {}, (x.receiptNo || '') + (x.method ? ' · ' + x.method : ''))]),
            h('div', { class: 'sp-inv-r' }, [h('b', { class: x.type === 'refund' ? 'neg' : 'pos' }, (x.type === 'refund' ? '−' : '+') + som(x.amount))])
          ]));
        });
      }).catch(function (e) { fail(how, e); UI.clear(inv); UI.clear(hist); });
    }

    /* ---------- 6. Fayllarim ---------- */
    function vFiles(el) {
      var input = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, hidden: true });
      var note = h('input', { type: 'text', class: 'sp-input', placeholder: 'Izoh (ixtiyoriy): masalan, «3-dars daftar ishi»', maxlength: 300 });
      var status = h('p', { class: 'sp-muted', hidden: true });
      var drop = h('label', { class: 'sp-drop' }, [
        input,
        h('div', { class: 'sp-drop-i' }, ico('upload')),
        h('b', {}, 'Rasm yoki PDF yuklang'),
        h('span', {}, 'Daftar sahifasi rasmi, skrinshot yoki PDF — 10 MB gacha. Telefonda kamera ham ochiladi.')
      ]);
      ['dragover', 'dragenter'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) { e.preventDefault(); send(e.dataTransfer.files); });
      input.addEventListener('change', function () { send(input.files); input.value = ''; });
      var list = h('div', {}, loading());
      el.appendChild(card('Ustozga fayl yuborish', [drop, note, status]));
      el.appendChild(card('Yuborilgan fayllar', [list]));

      async function send(fl) {
        var arr = Array.prototype.slice.call(fl || []);
        if (!arr.length) return;
        for (var i = 0; i < arr.length; i++) {
          var f = arr[i];
          if (!/^image\/|application\/pdf/.test(f.type)) { UI.toast(f.name + ': faqat rasm yoki PDF.', 'bad'); continue; }
          status.hidden = false; status.textContent = 'Yuklanmoqda: ' + f.name + '…';
          try {
            var sh = await shrink(f);
            if (sh.b64.length * 0.75 > 10 * 1048576) throw new Error('Fayl juda katta (10 MB gacha).');
            await src.upload({ name: f.name.replace(/\.(heic|png|webp)$/i, '.jpg'), type: sh.type, data: sh.b64, note: note.value });
            UI.toast('Yuborildi: ' + f.name, 'ok');
          } catch (e) { UI.toast(e.message || 'Yuklanmadi.', 'bad'); }
        }
        status.hidden = true; note.value = '';
        delete cache.files; drawList();
      }
      function drawList() {
        UI.clear(list); list.appendChild(loading());
        load('files').then(function (r) {
          UI.clear(list);
          if (!r.files.length) { list.appendChild(empty('upload', 'Hali fayl yo’q', 'Yuklagan fayllaringiz va vazifa rasmlaringiz shu yerda turadi.')); return; }
          list.appendChild(h('div', { class: 'sp-files' }, r.files.map(function (f) {
            var url = src.fileUrl(f);
            var isImg = /^image\//.test(f.type);
            return h('a', { class: 'sp-file', href: url || '#', target: '_blank', rel: 'noopener', onclick: function (e) { if (!url) e.preventDefault(); } }, [
              h('div', { class: 'sp-file-th' + (isImg ? '' : ' pdf') }, isImg && url ? h('img', { src: url, alt: '', loading: 'lazy' }) : h('span', {}, isImg ? 'IMG' : 'PDF')),
              h('div', { class: 'sp-file-t' }, [
                h('b', {}, f.name),
                h('span', {}, [f.purpose === 'kurs-vazifa' ? 'Uy vazifasi' : 'Fayl', f.at, f.bytes ? sizeLabel(f.bytes) : ''].filter(Boolean).join(' · ')),
                f.note ? h('span', { class: 'sp-file-n' }, f.note) : null
              ])
            ]);
          })));
        }).catch(function (e) { fail(list, e); });
      }
      drawList();
    }

    /* ---------- 7. Savol-javob ---------- */
    function vAsk(el) {
      var ta = h('textarea', { class: 'sp-input', rows: 3, placeholder: 'Savolingizni yozing — ustoz shu yerda javob beradi' });
      var gid = groups[0] && groups[0].id;
      el.appendChild(card('Ustozga savol', [
        ta,
        h('div', { style: 'display:flex;justify-content:flex-end;margin-top:8px' }, h('button', {
          class: 'btn primary', type: 'button', onclick: function (e) {
            var text = String(ta.value || '').trim();
            if (!text) { UI.toast('Savolni yozing.', 'bad'); return; }
            if (!gid) { UI.toast('Savol yuborish uchun guruhga yozilgan bo’lish kerak.', 'bad'); return; }
            UI.busy(e.currentTarget, async function () {
              try { await src.ask(gid, text); ta.value = ''; UI.toast('Savol yuborildi.', 'ok'); delete cache.learning; paintView(); }
              catch (ex) { UI.toast(ex.message || 'Yuborilmadi.', 'bad'); }
            });
          }
        }, 'Yuborish'))
      ]));
      var box = h('div', {}, loading());
      el.appendChild(card('Savollarim', [box]));
      load('learning').then(function (lr) {
        UI.clear(box);
        var qs = lr.questions || [];
        if (!qs.length) { box.appendChild(empty('chat', 'Savol yo’q', 'Tushunmagan joyingiz bo’lsa, yuqorida yozing.')); return; }
        qs.forEach(function (q) {
          var ans = (q.answers || [])[q.answers ? q.answers.length - 1 : 0];
          box.appendChild(h('div', { class: 'sp-qa' }, [
            h('div', { class: 'sp-q' }, [h('b', {}, q.text), h('span', {}, q.at || '')]),
            ans ? h('div', { class: 'sp-a' }, [h('small', {}, 'Ustoz javobi'), h('span', {}, ans.text)]) : h('span', { class: 'sp-pill info' }, 'Javob kutilmoqda')
          ]));
        });
      }).catch(function (e) { fail(box, e); });
    }

    /* ---------- 8. Profil ---------- */
    function vProfile(el) {
      el.appendChild(h('section', { class: 'sp-profile' }, [
        UI.avatar(st.name),
        h('div', {}, [h('h2', {}, st.name), h('span', {}, 'Shaxsiy kod: ' + st.code)]),
      ]));
      if (!d.hasOwnPassword && D.mode === 'server') {
        el.appendChild(h('div', { class: 'sp-warnbox' }, [ico('key'), h('div', {}, [
          h('b', {}, 'Parolingiz hozircha shaxsiy kodingiz. '),
          'Xavfsizlik uchun pastda o’zingiz parol qo’ying — kodni bilgan boshqa odam kira olmaydi.'
        ])]));
      }
      var oldI = h('input', { type: 'password', class: 'sp-input', autocomplete: 'current-password', placeholder: 'Joriy parol (yoki shaxsiy kod)' });
      var n1 = h('input', { type: 'password', class: 'sp-input', autocomplete: 'new-password', placeholder: 'Yangi parol (kamida 6 belgi)' });
      var n2 = h('input', { type: 'password', class: 'sp-input', autocomplete: 'new-password', placeholder: 'Yangi parolni takrorlang' });
      el.appendChild(h('div', { class: 'sp-grid2' }, [
        card('Parolni o’zgartirish', [oldI, n1, n2, h('button', {
          class: 'btn primary', type: 'button', style: 'margin-top:4px', onclick: function (e) {
            if (n1.value !== n2.value) { UI.toast('Yangi parollar bir xil emas.', 'bad'); return; }
            if (n1.value.length < 6) { UI.toast('Parol kamida 6 belgidan iborat bo’lsin.', 'bad'); return; }
            UI.busy(e.currentTarget, async function () {
              try { await src.password(oldI.value, n1.value); d.hasOwnPassword = true; UI.toast('Parol o’zgartirildi.', 'ok'); paintView(); }
              catch (ex) { UI.toast(ex.message || 'O’zgarmadi.', 'bad'); }
            });
          }
        }, 'Saqlash')], { cls: 'sp-form' }),
        card('Kirish ma’lumoti', [
          h('div', { class: 'kab-line' }, [h('span', {}, 'Login'), h('b', {}, 'telefon raqamingiz yoki kod ' + st.code)]),
          h('div', { class: 'kab-line' }, [h('span', {}, 'Sahifa manzili'), h('b', {}, location.host + '/kabinet')]),
          h('div', { class: 'kab-line' }, [h('span', {}, 'Guruhlar'), h('b', {}, groups.map(function (g) { return g.name; }).join(', ') || '—')]),
          h('button', { class: 'btn', type: 'button', style: 'margin-top:8px', onclick: function () { if (opts.logout) opts.logout(); } }, 'Hisobdan chiqish')
        ])
      ]));
    }

    paintNav(); paintTop(); paintView();
    /* Badge uchun kurs ma'lumotini oldindan yuklaymiz */
    load('course').then(function (cv) {
      badges.vazifalar = cv.lessons.filter(function (l) { return hwState(l).id === 'qayta'; }).length;
      badges.lugat = (cv.vocab ? cv.vocab.due + cv.vocab.fresh : 0) + (cv.reviews || []).filter(function (r) { return r.status === 'open'; }).length;
      paintBadges();
      /* Darsdan «Takrorlash» tugmasi bilan kelgan bo'lsa — testni darhol ochamiz */
      var m = /[?&]rv=(r\d+)/.exec(String(location.hash || ''));
      if (m && cur === 'lugat') startReview(m[1]);
    }).catch(function () { });
    return { go: go };
  }

  A.StudentPortal = { render: render, upcoming: upcoming };
})(typeof window !== 'undefined' ? window : globalThis);
