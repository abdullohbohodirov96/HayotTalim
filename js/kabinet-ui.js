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
    { id: 'darslar', label: 'Darslarim', icon: 'play', mob: true },
    { id: 'vazifalar', label: 'Uy vazifalarim', short: 'Vazifalar', icon: 'task', mob: true },
    { id: 'lugat', label: 'Lug’at yodlash', short: 'Lug’at', icon: 'award', mob: true },
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
      var fn = { asosiy: vHome, darslar: vLessons, vazifalar: vHomework, lugat: vVocab, jadval: vSchedule, tolov: vPay, fayllar: vFiles, savol: vAsk, profil: vProfile }[cur];
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
            g.zoomLink ? h('a', { class: 'btn primary sm', href: g.zoomLink, target: '_blank', rel: 'noopener' }, 'Darsga kirish (Zoom)') : null,
            g.recordingsLink ? h('a', { class: 'btn sm', href: g.recordingsLink, target: '_blank', rel: 'noopener' }, 'Dars yozuvlari') : null
          ]) : null
        ]);
      })) : h('p', { class: 'sp-muted' }, 'Hozircha guruhga yozilmagansiz.');
    }

    /* ---------- 1. Asosiy ---------- */
    function vHome(el) {
      var heroR = h('div', { class: 'sp-hero-r' }, loading());
      el.appendChild(h('section', { class: 'sp-hero' }, [
        h('div', { class: 'sp-hero-l' }, [
          h('span', { class: 'sp-eyebrow' }, 'Assalomu alaykum'),
          h('h1', {}, first ? first + '!' : 'Xush kelibsiz!'),
          h('p', { class: 'sp-hero-me' }, st.name + ' · kod ' + st.code),
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

    /* ---------- 2. Darslarim ---------- */
    function vLessons(el) {
      var box = h('div', {}, loading());
      el.appendChild(h('p', { class: 'sp-lead' }, 'Har bir dars: video → qissa → so’zlar → qoida → mashq → test, keyin uy vazifasi. Test 80% dan yuqori va vazifa yuborilgach keyingi dars ochiladi.'));
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
                h('span', { class: 'sp-ar' }, l.titleAr || '')
              ]),
              h('b', {}, l.n + '. ' + l.title),
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

    /** Takrorlash testi: har 2 darsdan keyin; 80% dan o'tilsa keyingi dars ochiladi */
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
          n0.g.zoomLink ? h('a', { class: 'btn sp-cta', href: n0.g.zoomLink, target: '_blank', rel: 'noopener' }, 'Zoom’ga kirish →')
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
