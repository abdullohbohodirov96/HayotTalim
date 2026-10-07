/* Albyana ERP — ilova: kirish, menyu, yo'naltirish */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;

  var App = {
    user: null,
    route: { name: 'dashboard' },
    _renderTimer: null,

    /* ---------- Huquq ---------- */
    can: function (perm) { return A.can(App.user, perm); },
    guard: function (perm) {
      if (!App.can(perm)) {
        var e = new Error('Sizda bu amal uchun ruxsat yo’q.');
        e.code = 'forbidden';
        throw e;
      }
      return true;
    },

    _hashLock: false,

    go: function (name, params) {
      App.route = Object.assign({ name: name }, params || {});
      App.pushHash(App.route);
      App.render();
      window.scrollTo(0, 0);
    },

    /** Joriy sahifani manzil satriga yozish — Orqaga tugmasi va yangilash ishlaydi */
    pushHash: function (r) {
      var h = routeToHash(r);
      if (('#' + location.hash.replace(/^#/, '')) === h) return;
      App._hashLock = true;
      try { location.hash = h; } catch (e) { }
      setTimeout(function () { App._hashLock = false; }, 0);
    },

    /** Oldingi sahifaga qaytish (saqlagandan keyin shu yerda qolib ketmasin) */
    back: function (fallback) {
      if (history.length > 1) { history.back(); return; }
      App.go(fallback || 'dashboard');
    },

    render: function () {
      if (!App.user) return;
      /* Hisob-kitob keshini tozalaymiz: u FAQAT shu chizish davomida
         yashaydi, shuning uchun ekranda hech qachon eski raqam
         qolmaydi (to'lov yozilgach darhol yangilanadi).            */
      if (A.Q && A.Q.resetCache) A.Q.resetCache();
      var view = document.getElementById('view');
      UI.clear(view);
      renderNav();
      var page = A.Pages[App.route.name];
      if (!page) { view.appendChild(UI.empty({ title: 'Sahifa topilmadi' })); return; }
      try {
        page(view, App.route, App);
      } catch (e) {
        console.error(e);
        view.appendChild(h('div', { class: 'banner warn' }, [
          h('div', {}, [h('b', {}, 'Sahifani ochib bo’lmadi. '), e.message || String(e)])
        ]));
      }
    },
    softRender: function () {
      clearTimeout(App._renderTimer);
      App._renderTimer = setTimeout(function () { App.render(); }, 120);
    }
  };

  function hidePreRender() {
    var initial = document.getElementById('seo-prerender');
    if (initial) initial.remove();
  }

  /* ---------- Manzil satri (hash) bilan ishlash ---------- */
  function routeToHash(r) {
    if (!r || !r.name) return '#dashboard';
    var parts = Object.keys(r).filter(function (k) {
      return k !== 'name' && r[k] != null && r[k] !== '' && r[k] !== false;
    });
    return '#' + r.name + (parts.length
      ? '?' + parts.map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(r[k]); }).join('&')
      : '');
  }
  function hashToRoute() {
    var h = String(location.hash || '').replace(/^#/, '');
    if (!h) return null;
    var i = h.indexOf('?');
    var name = i < 0 ? h : h.slice(0, i);
    if (!name || !A.Pages[name]) return null;
    var r = { name: name };
    if (i >= 0) {
      h.slice(i + 1).split('&').filter(Boolean).forEach(function (kv) {
        var j = kv.indexOf('=');
        var k = decodeURIComponent(j < 0 ? kv : kv.slice(0, j));
        var v = j < 0 ? '' : decodeURIComponent(kv.slice(j + 1));
        r[k] = (v === 'true') ? true : v;
      });
    }
    return r;
  }
  function onHashChange() {
    if (App._hashLock) return;
    // Kirmagan foydalanuvchi: ochiq sahifalar orasida yurish (orqaga/oldinga ham ishlaydi)
    if (!App.user) {
      var where = String(location.hash || '').replace('#', '').split('?')[0];
      if (where === 'kabinet') { renderKabinet(); return; }
      if (where === 'kurs') { openCourse(); return; }
      if (where === 'test' || where === 'daraja') { renderTest(); return; }
      if (where === 'ustoz') { renderTeacherFromHash(); return; }
      if (where === 'kirish' || where === 'login') { renderLogin(null); return; }
      if (!where) { renderLanding(); return; }
      return;
    }
    var r = hashToRoute();
    if (!r) return;
    App.route = r;
    App.render();
    window.scrollTo(0, 0);
  }

  /* ---------- Menyu ---------- */
  var NAV = [
    { id: 'dashboard', label: 'Bosh sahifa', icon: 'home', perm: 'nav.dashboard' },
    { id: 'leads', label: 'Murojaatlar', icon: 'phone', perm: 'nav.leads' },
    { id: 'students', label: 'O’quvchilar', icon: 'users', perm: 'nav.students' },
    { id: 'groups', label: 'Guruhlar', icon: 'layers', perm: 'nav.groups' },
    { id: 'schedule', label: 'Jadval', icon: 'calendar', perm: 'nav.schedule' },
    { id: 'attendance', label: 'Davomat', icon: 'check', perm: 'nav.attendance' },
    { id: 'curriculum', label: 'O’quv dasturi', icon: 'layers', perm: 'nav.curriculum' },
    { id: 'learning', label: 'Dars jarayoni', icon: 'task', perm: 'lesson.log' },
    { id: 'course', label: 'Onlayn kurs', icon: 'play', perm: 'lesson.log' },
    { id: 'finance', label: 'Moliya', icon: 'wallet', perm: 'nav.finance' },
    { id: 'staff', label: 'Xodimlar', icon: 'badge', perm: 'nav.staff' },
    { id: 'reports', label: 'Hisobotlar', icon: 'chart', perm: 'nav.reports' },
    { id: 'progress', label: 'O’quv natijalari', icon: 'chart', perm: 'reports.learning' },
    { id: 'chat', label: 'Suhbat', icon: 'chat', perm: 'nav.chat' },
    { id: 'tasks', label: 'Vazifalar', icon: 'task', perm: 'nav.tasks' },
    { id: 'bot', label: 'Telegram bot', icon: 'bot', perm: 'nav.bot' },
    { id: 'settings', label: 'Sozlamalar', icon: 'gear', perm: 'settings.edit' }
  ];

  function allowedNav() {
    return NAV.filter(function (n) { return App.can(n.perm); });
  }

  function renderNav() {
    var nav = UI.clear(document.getElementById('nav'));
    allowedNav().forEach(function (n) {
      var active = App.route.name === n.id ||
        (n.id === 'students' && App.route.name === 'student') ||
        (n.id === 'groups' && App.route.name === 'group');
      var b = h('button', {
        type: 'button', 'aria-current': active ? 'page' : null,
        onclick: function () { App.go(n.id); }
      }, [UI.icon(n.icon), n.label]);
      nav.appendChild(b);
    });

    var tabbar = UI.clear(document.getElementById('tabbar'));
    quickItems().forEach(function (n) {
      tabbar.appendChild(h('button', {
        type: 'button',
        'aria-current': (!n.action && App.route.name === n.id) ? 'page' : null,
        onclick: n.action || function () { App.go(n.id); }
      }, [UI.icon(n.icon), h('span', {}, n.label)]));
    });
    tabbar.appendChild(h('button', {
      type: 'button', onclick: openMenuSheet
    }, [UI.icon('layers'), h('span', {}, 'Menyu')]));
  }

  /**
   * Telefon pastki menyusi — rolga mos, ko'pi bilan 5 ta element
   * (beshinchisi doim "Menyu").
   */
  function quickItems() {
    var role = App.user.role;
    var want = {
      admin: ['dashboard', 'students', 'PAY', 'attendance'],
      oqituvchi: ['schedule', 'course', 'attendance'],
      direktor: ['dashboard', 'students', 'finance', 'reports'],
      buxgalter: ['dashboard', 'finance', 'PAY', 'reports']
    }[role] || ['dashboard', 'students', 'attendance', 'finance'];

    var out = [];
    want.forEach(function (id) {
      if (id === 'PAY') {
        if (App.can('payment.create')) {
          out.push({
            id: 'PAY', label: 'To’lov', icon: 'money',
            action: function () { A.paymentForm(null, App); }
          });
        }
        return;
      }
      var n = NAV.filter(function (x) { return x.id === id; })[0];
      if (n && App.can(n.perm)) {
        out.push({ id: n.id, label: n.id === 'schedule' && role === 'oqituvchi' ? 'Darslarim' : n.label, icon: n.icon });
      }
    });
    // bo'sh joy qolsa — ruxsat bor boshqa bo'limlar bilan to'ldiramiz
    allowedNav().forEach(function (n) {
      if (out.length >= 4) return;
      if (out.some(function (x) { return x.id === n.id; })) return;
      out.push({ id: n.id, label: n.label, icon: n.icon });
    });
    return out.slice(0, 4);
  }

  function openMenuSheet() {
    var list = h('div', { class: 'menu-sheet' }, allowedNav().map(function (n) {
      var here = App.route.name === n.id;
      return h('button', {
        class: 'menu-item', type: 'button',
        'aria-current': here ? 'page' : null,
        onclick: function () { m.close(); App.go(n.id); }
      }, [
        UI.icon(n.icon),
        h('b', {}, n.label)
      ]);
    }));
    /* Til va mavzu telefonda yuqoridagi tasmadan olib tashlandi — u har
       sahifada bir qator joyni yeb turardi. Endi shu yerda, bir bosishda. */
    var langRow = h('div', { class: 'menu-lang' }, A.I18N.langs.map(function (l) {
      return h('button', {
        type: 'button', class: 'btn sm' + (A.I18N.lang === l.id ? ' primary' : ''),
        'aria-pressed': A.I18N.lang === l.id ? 'true' : 'false',
        lang: l.id, dir: l.id === 'ar' ? 'rtl' : 'ltr',
        onclick: function () {
          A.I18N.set(l.id);
          if (A.renderLangPick) A.renderLangPick();
          m.close();
          App.render();
        }
      }, l.short);
    }).concat([
      h('button', {
        type: 'button', class: 'btn sm', 'aria-label': 'Yorug’ / qorong’i',
        onclick: function () { toggleTheme(); }
      }, [UI.icon('sun')])
    ]));
    var tools = h('div', { class: 'menu-tools' }, [
      h('div', { class: 'small muted' }, 'Til va mavzu'),
      langRow
    ]);
    var m = UI.modal({
      title: 'Menyu', body: h('div', {}, [tools, list]),
      actions: [{ label: 'Chiqish', cls: 'danger', onClick: function (c) { c(); logout(); } }]
    });
  }

  /* ---------- Kirish ---------- */
  async function hashPass(login, pass, salt) {
    return await A.sha256(login.toLowerCase() + '::' + pass + '::' + salt);
  }

  /* Markaz nomi: avval serverdagi nom, bo'lmasa brauzerdagi nusxa, oxirida standart.
     Eski nusxa qolib ketmasin uchun server nomi kelganda yangilanadi. */
  function centerNameNow() {
    return (D.settings && D.settings.centerName) || 'Arab tili markazi';
  }
  async function refreshCenterName() {
    try {
      var r = await fetch('/api/public', { credentials: 'same-origin' });
      if (!r.ok) return;
      var j = await r.json();
      if (!j || !j.centerName) return;
      if (D.settings && D.settings.centerName !== j.centerName) {
        D.settings.centerName = j.centerName;           // eski nusxani tuzatamiz
      }
      var el = document.getElementById('login-center');
      if (el) el.textContent = j.centerName;
    } catch (e) { /* internet yo'q — shu holicha qoladi */ }
  }

  function renderLogin(msg) {
    if (A.leaveSite) A.leaveSite();
    hidePreRender();
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'screen login-screen';
    UI.clear(wrap);

    var fLogin = UI.field({ label: 'Login', id: 'login-user', required: true, autocomplete: 'username' });
    var fPass = UI.field({ label: 'Parol', id: 'login-pass', type: 'password', required: true, autocomplete: 'current-password' });
    var err = h('div', { class: 'err-msg', hidden: true });
    var hint = D.all('users').some(function (u) { return u.login === 'admin' && u.isDefault; })
      ? h('div', { class: 'banner info', style: 'margin:0' }, h('div', {}, [
        h('b', {}, 'Birinchi kirish: '), 'login ', h('b', {}, 'admin'), ', parol ', h('b', {}, '1234'), '. Sozlamalar bo’limida parolni albatta o’zgartiring.'
      ]))
      : null;

    var btn = h('button', { class: 'btn primary block lg', type: 'submit' }, 'Kirish');
    var formEl = h('form', { class: 'login', onsubmit: onSubmit }, [
      h('div', { class: 'brandline' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('h1', { id: 'login-center' }, centerNameNow()),
          h('div', { class: 'sub' }, 'O’quv markazi boshqaruv tizimi')
        ])
      ]),
      msg ? h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, msg)) : null,
      hint,
      fLogin.wrap, fPass.wrap, err, btn,
      h('div', { class: 'small muted', style: 'text-align:center' },
        D.mode === 'local'
          ? 'Diqqat: baza ulanmadi, ma’lumotlar faqat shu brauzerda saqlanadi.'
          : 'Ma’lumotlar markaz bazasida saqlanadi.'),
      D.mode === 'server' ? h('div', { class: 'login-alt' }, [
        h('span', { class: 'small muted' }, 'O’quvchimisiz?'),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = 'kabinet'; renderKabinet(); }
        }, 'Shaxsiy kod bilan kirish')
      ]) : null,
      h('button', {
        class: 'btn sm ghost login-back', type: 'button',
        onclick: function () { location.hash = ''; renderLanding(); }
      }, [UI.icon('back'), h('span', {}, 'Saytga qaytish')])
    ]);
    /* Kirish sahifasi ham saytning ko'rinishida: to'q fon va naqsh */
    wrap.appendChild(h('div', { class: 'login-art', 'aria-hidden': 'true' }, [
      khatamSvg('khatam'),
      h('span', { class: 'login-ar' }, 'العربية')
    ]));
    wrap.appendChild(formEl);
    refreshCenterName();

    function onSubmit(e) {
      e.preventDefault();
      err.hidden = true;
      var login = fLogin.input.value.trim().toLowerCase();
      var pass = fPass.input.value;
      if (!login || !pass) { err.hidden = false; err.textContent = 'Login va parolni kiriting.'; return; }
      UI.busy(btn, async function () {
        if (D.mode === 'server') {
          try {
            var su = await D.serverLogin(login, pass);
            await startSession(su);
          } catch (ex) {
            err.hidden = false;
            err.textContent = ex.message || 'Kirishda xatolik.';
          }
          return;
        }
        var user = D.all('users').filter(function (u) { return String(u.login).toLowerCase() === login; })[0];
        if (!user || user.active === false) {
          err.hidden = false; err.textContent = 'Login yoki parol xato.'; return;
        }
        var hashed = await hashPass(user.login, pass, user.salt);
        if (hashed !== user.hash) { err.hidden = false; err.textContent = 'Login yoki parol xato.'; return; }
        await startSession(user);
      });
    }
  }


  /* ---------- O'quvchi kabineti (kirishsiz, shaxsiy kod bilan) ----------
     O'quvchi 4 xonali kodini kiritadi va o'z ma'lumotini ko'radi:
     guruhi, jadvali, keyingi to'lovi va davomati. Xodimlar tizimiga aloqasi yo'q. */
  /* Bir xil sahifa ikki marta chizilmasin: tugma manzilni o'zgartiradi VA sahifani
     chizadi, so'ng «hashchange» ham xuddi shu sahifani yana chizardi — natijada ikki
     nusxa bir-biriga xalal berardi (ovoz, test, kartochkalar). 600 ms ichida takror
     chaqiruv o'tkazib yuboriladi. */
  var lastView = { key: '', at: 0 };
  /** Ochiq saytdan chiqqanda uning taymer va kuzatuvchilarini to'xtatamiz —
      kabinet va darslarda fon ishlari sekinlashtirmasin. */
  function leaveSite() {
    if (A._ctaOff) { A._ctaOff(); A._ctaOff = null; }
    if (A._scrollFxOff) { A._scrollFxOff(); A._scrollFxOff = null; }
    if (A._typeRO) { try { A._typeRO.disconnect(); } catch (e) { } A._typeRO = null; }
    if (typeTimer) { clearTimeout(typeTimer); typeTimer = null; }
  }
  A.leaveSite = leaveSite;
  function dupView(name) {
    var key = name + '|' + String(location.hash || '');
    var now = Date.now();
    if (lastView.key === key && now - lastView.at < 600) return true;
    lastView = { key: key, at: now };
    return false;
  }

  function renderKabinet(prefill) {
    if (dupView('kabinet')) return;
    leaveSite();
    hidePreRender();
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'screen';
    UI.clear(wrap);

    var err = h('div', { class: 'err-msg', hidden: true });
    var result = h('div', { class: 'kab-result' });
    var info = h('p', { class: 'small muted', style: 'margin:0' }, 'Tekshirilmoqda…');

    var box = h('div', { class: 'login kabinet' }, [
      h('div', { class: 'brandline' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('h1', { id: 'kab-center' }, centerNameNow()),
          h('div', { class: 'sub', id: 'kab-sub' }, 'Shaxsiy kabinet')
        ])
      ]),
      info, err, result,
      h('div', { class: 'login-alt' }, [
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = ''; renderLanding(); }
        }, 'Bosh sahifa'),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = ''; renderLogin(null); }
        }, 'Xodimlar kirishi')
      ])
    ]);
    wrap.appendChild(box);
    refreshCenterName();
    /* Demo (serversiz) rejim: namunaviy o'quvchi kabineti brauzerdagi ma'lumotdan */
    if (D.mode !== 'server') { info.hidden = true; showInfo(localKab()); return; }
    start();

    function localKab() {
      var st = D.all('students').filter(function (s) { return s.status === 'faol'; })[0] ||
        { id: 'demo', firstName: 'O’quvchi', lastName: 'Demo', code: '0000' };
      var names = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
      var groups = D.all('memberships').filter(function (m) { return m.studentId === st.id && m.status !== 'chiqdi'; })
        .map(function (m) {
          var g = D.one('groups', m.groupId); if (!g) return null;
          var t = D.one('staff', g.teacherId);
          return {
            id: g.id, code: g.code || '', name: g.name, teacher: t ? t.name : '',
            daysText: (g.days || []).map(function (d) { return names[d - 1] || ''; }).join(', '),
            startTime: g.startTime || '', endTime: g.endTime || '', room: A.isOffline && A.isOffline(g) ? '' : 'Onlayn',
            zoomLink: A.safeUrl ? A.safeUrl(g.zoomLink) : ''
          };
        }).filter(Boolean);
      var inv = D.all('invoices'), pay = D.all('payments');
      var bal = A.balanceOf(st.id, inv, pay);
      var paid = A.paidByInvoice(pay);
      var open = inv.filter(function (i) { return i.studentId === st.id && A.invoiceRemaining(i, paid) > 0; })
        .sort(function (a, b) { return String(a.month).localeCompare(String(b.month)); });
      var next = open.length
        ? { amount: A.invoiceRemaining(open[0], paid), dueDate: open[0].dueDate || (open[0].month + '-05') }
        : { amount: 0, upcoming: true, dueDate: A.addMonths(A.today().slice(0, 7), 1) + '-05' };
      return {
        kind: 'student',
        student: { id: st.id, code: String(st.code || '0000'), name: ((st.lastName || '') + ' ' + (st.firstName || '')).trim() },
        center: { phone: (D.settings && D.settings.phone) || '' },
        groups: groups,
        finance: { debt: bal.debt, advance: bal.advance, overdue: A.overdueOf(st.id, inv, pay, A.today()), next: next },
        attendance: { total: 0, attended: 0, missed: 0, late: 0, excused: 0, percent: null, last: [] }
      };
    }

    /* Kirish tartibi:
       1) manzilda bir martalik havola (?t=...) bo'lsa — uni sessiyaga almashtiramiz;
       2) sessiya bo'lsa — ma'lumot darhol chiqadi (kod qayta so'ralmaydi);
       3) bo'lmasa — 4 xonali kod so'raladi. */
    async function start() {
      var token = tokenFromHash();
      if (token) {
        try {
          await D.api('POST', 'api/kabinet/session', { token: token });
          cleanHash();
        } catch (ex) {
          info.hidden = true;
          err.hidden = false;
          err.textContent = ex.message || 'Havola yaroqsiz.';
          showForm();
          return;
        }
      }
      var d;
      try {
        d = await D.api('GET', 'api/kabinet/me');
        D.kabCsrf = d.csrf || '';
      } catch (ex) {
        info.hidden = true;
        showForm();
        return;
      }
      info.hidden = true;
      showInfo(d);
    }

    function tokenFromHash() {
      var m = /[?&]t=([A-Za-z0-9_.-]+)/.exec(String(location.hash || ''));
      return m ? m[1] : '';
    }
    function cleanHash() {
      try { history.replaceState(null, '', location.pathname + '#kabinet'); } catch (e) { }
    }

    /* 4 xonali shaxsiy kod bilan kirish.
       Kod yozilgandan keyin 30 kunlik sessiya beriladi — shu qurilmada
       qayta yozish shart emas. Umumiy kompyuterda “Chiqish” tugmasi bor. */
    function showForm() {
      UI.clear(result);
      var sub0 = document.getElementById('kab-sub');
      if (sub0) sub0.textContent = 'O’quvchi kabineti — kirish';
      var login = h('input', {
        id: 'kab-login', class: 'kab-in', type: 'text', autocomplete: 'username', inputmode: 'tel',
        placeholder: '+998 90 123 45 67 yoki kod', 'aria-label': 'Login'
      });
      var pass = h('input', {
        id: 'kab-pass', class: 'kab-in', type: 'password', autocomplete: 'current-password',
        placeholder: 'Parol', 'aria-label': 'Parol'
      });
      var eye = h('button', { type: 'button', class: 'kab-eye', 'aria-label': 'Parolni ko’rsatish', onclick: function () {
        pass.type = pass.type === 'password' ? 'text' : 'password'; eye.textContent = pass.type === 'password' ? '👁' : '🙈';
      } }, '👁');
      var btn = h('button', { id: 'kab-go', class: 'btn primary lg block', type: 'submit' }, 'Kirish');
      var form = h('form', { class: 'kab-form', onsubmit: function (e) { e.preventDefault(); go(); } }, [
        h('label', { class: 'kab-lb', for: 'kab-login' }, 'Login — telefon raqamingiz yoki shaxsiy kodingiz'),
        login,
        h('label', { class: 'kab-lb', for: 'kab-pass' }, 'Parol'),
        h('div', { class: 'kab-passw' }, [pass, eye]),
        btn
      ]);
      [login, pass].forEach(function (i) { i.addEventListener('input', function () { err.hidden = true; }); });

      async function go() {
        var l = String(login.value || '').trim(), p = String(pass.value || '');
        if (!l || !p) { err.hidden = false; err.textContent = 'Login va parolni yozing.'; return; }
        btn.disabled = true; btn.textContent = 'Tekshirilmoqda…'; err.hidden = true;
        try {
          var d = await D.api('POST', 'api/kabinet', { login: l, password: p });
          D.kabCsrf = d.csrf || '';
          showInfo(d);
        } catch (ex) {
          btn.disabled = false; btn.textContent = 'Kirish';
          pass.value = ''; pass.focus();
          err.hidden = false;
          err.textContent = ex.message || 'Login yoki parol noto’g’ri.';
        }
      }

      result.appendChild(h('div', { class: 'kab-howto' }, [
        form,
        h('div', { class: 'kab-hint' }, [
          h('b', {}, 'Birinchi marta kiryapsizmi? '),
          'Parol — administrator bergan 4 xonali shaxsiy kodingiz. Kirgach, «Profil» bo’limida o’zingiz yangi parol qo’ying.'
        ]),
        h('p', { class: 'small muted' }, 'Kodni bilmasangiz markaz administratoridan so’rang. Telegram botdagi «Kabinet (veb)» tugmasi ham kabinetni ochadi.')
      ]));
      try { login.focus(); } catch (e) { }
    }

    /* Kabinet ikki xil bo'ladi: o'quvchi va ota-ona.
       Ota-onaga farzandlari ro'yxati chiqadi. */
    function portalOn(on) {
      box.className = 'login kabinet' + (on ? ' portal' : '');
      wrap.className = on ? 'screen kab-screen' : 'screen';
    }
    function logoutBtn() {
      return h('div', { class: 'kab-out' }, [
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: async function () {
            if (D.mode !== 'server') { location.hash = ''; renderLanding(); return; }
            try { await D.api('POST', 'api/kabinet/logout', {}); } catch (e) { }
            err.hidden = true;
            portalOn(false);
            showForm();
          }
        }, 'Chiqish')
      ]);
    }
    function portalBar(name, subText) {
      return h('header', { class: 'kp-bar' }, [
        h('button', { class: 'kp-brand', type: 'button', onclick: function () { location.hash = ''; renderLanding(); } }, [
          h('img', { src: LOGO, alt: '' }),
          h('div', {}, [h('b', {}, centerNameNow()), h('span', {}, subText)])
        ]),
        h('div', { class: 'kp-who' }, [
          UI.avatar(name),
          h('div', { class: 'main-col' }, [h('b', {}, name)])
        ]),
        logoutBtn()
      ]);
    }
    function goLesson(id) {
      try { if (id) sessionStorage.setItem('kurs_last', id); } catch (e) { }
      location.hash = 'kurs'; openCourse();
    }

    function showInfo(d) {
      if (d && d.kind === 'parent') return showParent(d);
      UI.clear(result);
      portalOn(true);
      var root = h('div', {});
      result.appendChild(root);
      A.StudentPortal.render(root, d, {
        centerName: centerNameNow(),
        openCourse: function () { location.hash = 'kurs'; openCourse(); },
        runQuiz: runQuiz,
        logout: async function () {
          if (D.mode !== 'server') { location.hash = ''; renderLanding(); return; }
          try { await D.api('POST', 'api/kabinet/logout', {}); } catch (e) { }
          err.hidden = true;
          try { history.replaceState(null, '', location.pathname + '#kabinet'); } catch (e) { }
          portalOn(false);
          showForm();
        }
      });
    }

    /* ---- Ota-ona kabineti: farzandlar ro'yxati ---- */
    function showParent(d) {
      UI.clear(result);
      portalOn(true);
      var kids = d.children || [];
      result.appendChild(h('div', { class: 'kab-card kp' }, [
        portalBar(d.parent.name, 'Ota-ona kabineti' + (d.parent.relation ? ' · ' + d.parent.relation : '')),
        h('div', { class: 'kp-phead' }, [
          h('h1', {}, d.parent.name),
          h('span', {}, 'Ota-ona kabineti' + (d.parent.relation ? ' · ' + d.parent.relation : ''))
        ]),
        kids.length ? null : h('p', { class: 'muted small' },
          'Sizga hali farzand biriktirilmagan. Markazga murojaat qiling.'),
        h('div', { class: 'kab-sec kp-kids' }, kids.map(function (k) {
          var fin = k.finance || {}, att = k.attendance || {};
          return h('div', { class: 'kab-kid' }, [
            h('b', {}, k.student.name),
            h('span', { class: 'small muted' },
              (k.groups || []).map(function (g) { return g.name; }).join(', ') || 'Guruhga yozilmagan'),
            h('div', { class: 'kab-line' }, [
              h('span', {}, 'To’lov'),
              h('b', {}, fin.debt > 0 ? A.somFull(fin.debt) + ' qarz' : 'Qarz yo’q')
            ]),
            h('div', { class: 'kab-line' }, [
              h('span', {}, 'Davomat'),
              h('b', {}, att.total
                ? (att.percent != null ? att.percent + '%' : att.attended + '/' + att.total)
                : 'Yozuv yo’q')
            ]),
            k.quizzes && k.quizzes.count ? h('div', { class: 'kab-line' }, [
              h('span', {}, 'Testlar'),
              h('b', {}, k.quizzes.count + ' ta · o’rtacha ' + (k.quizzes.avgPercent || 0) + '%')
            ]) : null,
            k.level ? h('div', { class: 'kab-line' }, [
              h('span', {}, 'Daraja'), h('b', {}, k.level)
            ]) : null,
            learnSection(k.student.id, false)
          ]);
        })),
        h('div', { class: 'small muted', style: 'margin-top:10px' },
          'Savol bo’lsa markazga murojaat qiling' + (d.center.phone ? ': ' + d.center.phone : '.'))
      ]));
    }

    /* ---- O'quv bo'limi (ikkala kabinetda ham) ---- */
    function learnSection(studentId, canAct) {
      var wrapEl = h('div', { class: 'kab-sec' },
        h('p', { class: 'small muted' }, 'O’quv ma’lumoti yuklanmoqda…'));
      (async function () {
        var d;
        try {
          d = await D.api('GET', 'api/kabinet/learning?studentId=' + encodeURIComponent(studentId));
        } catch (ex) { UI.clear(wrapEl); return; }
        UI.clear(wrapEl);
        var act = canAct && d.canSubmit;

        /* Uy vazifalari */
        if ((d.homework || []).length) {
          wrapEl.appendChild(h('h3', {}, 'Uy vazifasi'));
          d.homework.slice(0, 5).forEach(function (w) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, w.title || 'Vazifa'),
              w.text ? h('span', {}, w.text) : null,
              h('span', { class: 'small muted' },
                A.dateLabel(w.date) + (w.dueDate ? ' · muddat: ' + A.dateLabel(w.dueDate) : '') +
                (w.group ? ' · ' + w.group : ''))
            ]));
          });
        }

        /* Testlar */
        if ((d.quizzes || []).length) {
          wrapEl.appendChild(h('h3', {}, 'Testlar'));
          d.quizzes.slice(0, 8).forEach(function (q) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, q.title),
              h('span', { class: 'small muted' },
                q.done ? ('Natija: ' + q.score + '/' + q.total + ' (' + q.percent + '%)')
                  : (q.count + ' savol' + (q.due ? ' · muddat: ' + A.dateLabel(q.due) : ''))),
              (act && !q.done) ? h('button', {
                class: 'btn sm primary', type: 'button',
                onclick: function () { runQuiz(q, studentId); }
              }, 'Testni ishlash') : null
            ]));
          });
        }

        /* Qo'shimcha darslar */
        if ((d.makeups || []).length) {
          wrapEl.appendChild(h('h3', {}, 'Qo’shimcha dars'));
          d.makeups.forEach(function (m) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, A.dateLabel(m.date) + (m.time ? ' ' + m.time : '')),
              h('span', { class: 'small muted' },
                'Qoldirilgan dars: ' + A.dateLabel(m.missedDate) + ' · ' + m.status +
                (m.room ? ' · ' + m.room : ''))
            ]));
          });
        }

        /* Savol-javob */
        wrapEl.appendChild(h('h3', {}, 'Savol-javob'));
        if (act) {
          var gid = ((d.progress && d.progress.groups) || [])[0];
          wrapEl.appendChild(h('button', {
            class: 'btn sm', type: 'button',
            onclick: function () { askForm(studentId); }
          }, 'Ustozga savol berish'));
        }
        if ((d.questions || []).length) {
          d.questions.slice(0, 8).forEach(function (q) {
            wrapEl.appendChild(h('div', { class: 'kab-item' }, [
              h('b', {}, q.text),
              h('span', { class: 'small muted' }, q.at + (q.mine ? ' · siz so’radingiz' : '')),
              (q.answers || []).length
                ? h('span', {}, 'Javob: ' + q.answers[q.answers.length - 1].text)
                : h('span', { class: 'small muted' }, 'Javob kutilmoqda')
            ]));
          });
        } else {
          wrapEl.appendChild(h('p', { class: 'small muted' }, 'Savol yo’q.'));
        }
      })();
      return wrapEl;
    }

    /* Kabinetda test ishlash */
    function runQuiz(q, studentId) {
      (async function () {
        var t;
        try { t = await D.kabPost('api/kabinet/quiz/start', { quizId: q.id }); }
        catch (ex) { UI.toast(ex.message || 'Testni ochib bo’lmadi.', 'bad'); return; }
        var pos = 0, chosen = {};
        var qbody = h('div', { class: 'test-body' });
        var m = UI.modal({ title: t.quiz.title || 'Test', body: qbody, actions: [{ label: 'Yopish' }] });

        function draw() {
          UI.clear(qbody);
          var qq = t.questions[pos];
          if (!qq) return send();
          qbody.appendChild(h('div', {}, [
            h('div', { class: 'test-bar' },
              h('span', { style: 'width:' + Math.round(pos / t.questions.length * 100) + '%' })),
            h('div', { class: 'test-meta' }, [
              h('span', { class: 'test-kind' }, ''),
              h('span', { class: 'test-count small muted', dir: 'ltr' },
                (pos + 1) + ' / ' + t.questions.length)
            ]),
            h('p', { class: 'test-q', dir: 'auto' }, qq.text),
            h('div', { class: 'test-opts' }, qq.options.map(function (o, i) {
              return h('button', {
                class: 'test-opt', type: 'button', dir: 'auto',
                onclick: function () { chosen[qq.id] = i; pos++; draw(); }
              }, o);
            }))
          ]));
        }
        async function send() {
          UI.clear(qbody);
          qbody.appendChild(h('p', { class: 'small muted' }, 'Hisoblanmoqda…'));
          try {
            var r = await D.kabPost('api/kabinet/quiz/submit', {
              sessionId: t.id,
              answers: Object.keys(chosen).map(function (id) { return { id: id, choice: chosen[id] }; })
            });
            UI.clear(qbody);
            qbody.appendChild(h('div', { class: 'test-res' }, [
              h('div', { class: 'test-level' }, [
                h('span', { class: 'small muted' }, 'Natijangiz'),
                h('b', {}, r.result.percent + '%'),
                h('span', {}, r.result.score + ' / ' + r.result.total)
              ]),
              h('p', { class: 'small muted' },
                r.result.passed ? 'Test topshirildi.' : 'O’tish foiziga yetmadi.')
            ]));
            setTimeout(function () { m.close(true); start(); }, 2500);
          } catch (ex) {
            UI.clear(qbody);
            qbody.appendChild(h('p', { class: 'err-msg' }, ex.message || 'Xato.'));
          }
        }
        draw();
      })();
    }

    /* Ustozga savol */
    function askForm(studentId) {
      (async function () {
        var d;
        try { d = await D.api('GET', 'api/kabinet/learning?studentId=' + encodeURIComponent(studentId)); }
        catch (ex) { return; }
        var groups = (d.questions || []).map(function (q) { return q.groupId; });
        var gid = groups[0] || (d.progress && d.progress.groups && d.progress.groups[0] &&
          d.progress.groups[0].id) || '';
        var ta = h('textarea', { rows: 4, placeholder: 'Savolingizni yozing' });
        UI.modal({
          title: 'Ustozga savol',
          body: h('div', { class: 'f' }, [ta]),
          actions: [{ label: 'Bekor qilish' }, {
            label: 'Yuborish', cls: 'primary', onClick: function (close, btn) {
              var text = String(ta.value || '').trim();
              if (!text) { UI.toast('Savolni yozing.', 'bad'); return; }
              UI.busy(btn, async function () {
                try {
                  await D.kabPost('api/kabinet/question', { groupId: gid, text: text });
                  close(true); UI.toast('Savol yuborildi.', 'ok'); start();
                } catch (ex) { UI.toast(ex.message || 'Yuborilmadi.', 'bad'); }
              });
            }
          }]
        });
      })();
    }
  }
  A.renderKabinet = renderKabinet;

  /* Onlayn kurs sahifasi (#kurs). Serverda — kabinet sessiyasi bilan.
     Demo (brauzer) rejimida — namunaviy o'quvchi nomidan. */
  function openCourse() {
    if (dupView('kurs')) return;
    leaveSite();
    if (!A.renderCourse) return;
    if (D.mode === 'server') { A.renderCourse({}); return; }
    var st = D.all('students').filter(function (s) { return s.status === 'faol'; })[0];
    A.renderCourse({
      studentId: st ? st.id : 'demo',
      studentName: st ? (st.lastName + ' ' + st.firstName) : 'Demo o’quvchi',
      onExit: function () { location.hash = 'kabinet'; renderKabinet(); }
    });
  }
  A.openCourse = openCourse;


  /* ================= DARAJA ANIQLASH TESTI (A1 → C2) =================
     Kirishsiz ishlaydi. Savollar serverdan JAVOBSIZ keladi, natijani ham
     server hisoblaydi — shuning uchun brauzerda "to'g'ri javob" yo'q va
     darajani o'zboshimchalik bilan yozib bo'lmaydi. */
  /* Test sahifasining o'z matnlari — uch tilda (savollar serverdan keladi) */
  var TEST_T = {
    uz: {
      title: 'Daraja aniqlash testi', sub: 'A1 · A2 · B1 · B2 · C1 · C2',
      pick: 'Test tilini tanlang', start: 'Testni boshlash',
      loading: 'Savollar yuklanmoqda…', back: 'Orqaga', skip: 'Bilmayman',
      home: 'Bosh sahifa', done: 'Savollar tugadi. Natijani ko’rish uchun tugmani bosing.',
      hint: 'Ism va telefonni yozsangiz, markaz siz uchun mos guruhni taklif qiladi. Yozmasangiz ham natija ko’rinadi.',
      name: 'Ismingiz (ixtiyoriy)', phone: 'Telefon (ixtiyoriy)',
      see: 'Natijani ko’rish', calc: 'Hisoblanmoqda…',
      your: 'Sizning darajangiz', total: 'Umumiy natija',
      note: 'Bu natija taxminiy. Aniq daraja ustoz bilan qisqa suhbatdan keyin belgilanadi.',
      apply: 'Ariza qoldirish', again: 'Qayta topshirish',
      errStart: 'Testni boshlab bo’lmadi.', errSend: 'Natijani olishda xato.',
      changeLang: 'Tilni almashtirish',
      rules: '20 ta savol · 10 daqiqa',
      rulesNote: 'Vaqt tugaganda javoblaringiz o’zi yuboriladi.',
      time: 'Qolgan vaqt',
      timeUp: 'Vaqt tugadi — belgilangan javoblaringiz yuborildi.'
    },
    ru: {
      title: 'Тест на определение уровня', sub: 'A1 · A2 · B1 · B2 · C1 · C2',
      pick: 'Выберите язык теста', start: 'Начать тест',
      loading: 'Загрузка вопросов…', back: 'Назад', skip: 'Не знаю',
      home: 'На главную', done: 'Вопросы закончились. Нажмите кнопку, чтобы увидеть результат.',
      hint: 'Если укажете имя и телефон, центр предложит подходящую группу. Без них результат тоже виден.',
      name: 'Ваше имя (необязательно)', phone: 'Телефон (необязательно)',
      see: 'Посмотреть результат', calc: 'Подсчёт…',
      your: 'Ваш уровень', total: 'Общий результат',
      note: 'Результат приблизительный. Точный уровень определяется после короткой беседы с преподавателем.',
      apply: 'Оставить заявку', again: 'Пройти заново',
      errStart: 'Не удалось начать тест.', errSend: 'Ошибка при получении результата.',
      changeLang: 'Сменить язык',
      rules: '20 вопросов · 10 минут',
      rulesNote: 'Когда время выйдет, ответы отправятся сами.',
      time: 'Осталось времени',
      timeUp: 'Время вышло — отмеченные ответы отправлены.'
    },
    ar: {
      title: 'اختبار تحديد المستوى', sub: 'A1 · A2 · B1 · B2 · C1 · C2',
      pick: 'اختر لغة الاختبار', start: 'ابدأ الاختبار',
      loading: 'جارٍ تحميل الأسئلة…', back: 'السابق', skip: 'لا أعرف',
      home: 'الصفحة الرئيسية', done: 'انتهت الأسئلة. اضغط الزر لعرض النتيجة.',
      hint: 'إذا كتبت اسمك ورقمك اقترح عليك المركز المجموعة المناسبة. وتظهر النتيجة من دونهما أيضاً.',
      name: 'الاسم (اختياري)', phone: 'الهاتف (اختياري)',
      see: 'عرض النتيجة', calc: 'جارٍ الحساب…',
      your: 'مستواك', total: 'النتيجة الإجمالية',
      note: 'هذه النتيجة تقريبية. يُحدَّد المستوى بدقّة بعد حديث قصير مع الأستاذ.',
      apply: 'أرسل طلباً', again: 'أعد الاختبار',
      errStart: 'تعذّر بدء الاختبار.', errSend: 'خطأ في جلب النتيجة.',
      changeLang: 'تغيير اللغة',
      rules: '٢٠ سؤالاً · ١٠ دقائق',
      rulesNote: 'عند انتهاء الوقت تُرسَل إجاباتك تلقائياً.',
      time: 'الوقت المتبقّي',
      timeUp: 'انتهى الوقت — أُرسلت إجاباتك المحدَّدة.'
    }
  };
  var TEST_LANGS = [
    { id: 'uz', label: 'O’zbekcha' },
    { id: 'ru', label: 'Русский' },
    { id: 'ar', label: 'العربية' }
  ];

  /* ================= DARAJA ANIQLASH TESTI (A1 → C2) =================
     Kirishsiz ishlaydi. Savollar serverdan JAVOBSIZ keladi, natijani ham
     server hisoblaydi — shuning uchun brauzerda "to'g'ri javob" yo'q va
     darajani o'zboshimchalik bilan yozib bo'lmaydi.
     Uch til: o'zbek, rus, arab (arabchada sahifa o'ngdan chapga). */
  function renderTest() {
    if (dupView('test')) return;
    leaveSite();
    hidePreRender();
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'screen';
    UI.clear(wrap);

    /* Boshlang'ich til: saytdagi til mos kelsa — o'sha, aks holda o'zbekcha */
    var cur = (A.I18N && A.I18N.lang) || 'uz';
    var LANG = TEST_T[cur] ? cur : 'uz';
    var T = function () { return TEST_T[LANG]; };
    var rtl = function () { return LANG === 'ar'; };

    var err = h('div', { class: 'err-msg', hidden: true });
    var body = h('div', { class: 'test-body' });
    var head = h('div', {}, []);
    /* Sanoq — test davomida yuqorida turadi */
    var clockV = h('b', { class: 'test-clock-v', dir: 'ltr' }, '');
    var clock = h('div', { class: 'test-clock', hidden: true, role: 'timer' }, [
      UI.icon('clock'), h('span', { class: 'test-clock-l' }, ''), clockV
    ]);

    var homeBtn = h('button', {
      class: 'btn sm', type: 'button',
      onclick: function () { stopClock(); location.hash = ''; renderLanding(); }
    }, T().home);
    var box = h('div', { class: 'login test-box' }, [head, clock, err, body,
      h('div', { class: 'login-alt' }, [homeBtn])
    ]);
    wrap.appendChild(box);

    var SES = null, QS = [], LVLS = [], pos = 0, picked = {};
    /* Vaqt chegarasi: serverdan `limitSec` keladi. Sanoq faqat ko'rsatish
       uchun — haqiqiy chegarani server tekshiradi (sessiya muddati). */
    var endAt = 0, tick = null, timeUp = false;

    function stopClock() {
      if (tick) { clearInterval(tick); tick = null; }
      clock.hidden = true;
    }
    function drawClock() {
      var left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
      var m = Math.floor(left / 60), s = left % 60;
      clockV.textContent = m + ':' + (s < 10 ? '0' : '') + s;
      clock.classList.toggle('low', left <= 60);
      if (left <= 0) {
        if (tick) { clearInterval(tick); tick = null; }
        timeUp = true;
        finish(true);
      }
    }
    function startClock(sec) {
      stopClock();
      if (!(sec > 0)) return;
      endAt = Date.now() + sec * 1000;
      timeUp = false;
      clock.hidden = false;
      clock.querySelector('.test-clock-l').textContent = T().time;
      drawClock();
      tick = setInterval(drawClock, 1000);
    }

    paintHead();
    pickLang();

    function paintHead() {
      UI.clear(head);
      box.setAttribute('dir', rtl() ? 'rtl' : 'ltr');
      homeBtn.textContent = T().home;
      head.appendChild(h('div', { class: 'brandline' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('h1', {}, T().title),
          h('div', { class: 'sub' }, T().sub)
        ])
      ]));
    }

    /* 1-qadam: til tanlash */
    function pickLang() {
      UI.clear(body);
      err.hidden = true;
      stopClock();
      body.appendChild(h('div', { class: 'test-lang' }, [
        h('div', { class: 'test-rules' }, [
          UI.icon('clock'), h('b', {}, T().rules)
        ]),
        h('p', { class: 'small muted' }, T().rulesNote),
        h('p', { class: 'small muted' }, T().pick),
        h('div', { class: 'test-lang-row' }, TEST_LANGS.map(function (l) {
          return h('button', {
            class: 'btn' + (l.id === LANG ? ' primary' : ''), type: 'button',
            lang: l.id, dir: l.id === 'ar' ? 'rtl' : 'ltr',
            onclick: function () { LANG = l.id; paintHead(); pickLang(); }
          }, l.label);
        })),
        h('button', {
          class: 'btn primary lg', type: 'button',
          onclick: function () { start(); }
        }, T().start)
      ]));
    }

    async function start() {
      UI.clear(body);
      body.appendChild(h('p', { class: 'small muted' }, T().loading));
      try {
        var d = await D.api('POST', 'api/test/start', { lang: LANG });
        SES = d.id; QS = d.questions || []; LVLS = d.levels || [];
        LANG = TEST_T[d.lang] ? d.lang : LANG;
        paintHead();
        pos = 0; picked = {};
        if (!QS.length) throw new Error(T().errStart);
        startClock(Number(d.limitSec) || 0);
        step();
      } catch (ex) {
        UI.clear(body);
        stopClock();
        err.hidden = false;
        err.textContent = ex.message || T().errStart;
        body.appendChild(h('button', {
          class: 'btn', type: 'button', onclick: function () { pickLang(); }
        }, T().changeLang));
      }
    }

    /* Bitta savol — bosgan zahoti keyingisiga o'tadi */
    function step() {
      var q = QS[pos];
      UI.clear(body);
      if (!q) return finish();

      var bar = h('div', { class: 'test-bar' },
        h('span', { style: 'width:' + Math.round(pos / QS.length * 100) + '%' }));

      var opts = h('div', { class: 'test-opts' }, q.options.map(function (o, i) {
        return h('button', {
          class: 'test-opt', type: 'button', dir: 'auto',
          onclick: function () { picked[q.id] = i; pos++; step(); }
        }, o);
      }));

      body.appendChild(h('div', {}, [
        bar,
        h('div', { class: 'test-meta' }, [
          h('span', { class: 'test-kind' }, q.kindLabel || q.kind || ''),
          h('span', { class: 'test-count small muted', dir: 'ltr' }, (pos + 1) + ' / ' + QS.length)
        ]),
        /* Savol matni tanlangan tilda; arabchada o'ngdan chapga */
        h('p', { class: 'test-q', dir: rtl() ? 'rtl' : 'ltr' }, q.text),
        opts,
        h('div', { class: 'test-nav' }, [
          pos > 0 ? h('button', {
            class: 'btn sm', type: 'button',
            onclick: function () { pos--; step(); }
          }, T().back) : null,
          h('button', {
            class: 'btn sm ghost', type: 'button',
            onclick: function () { delete picked[q.id]; pos++; step(); }
          }, T().skip)
        ])
      ]));
    }

    /* Oxirida: ism/telefon (ixtiyoriy) va yuborish.
       `auto` — vaqt tugadi, savol qoldi-qolmadi javoblar darrov ketadi. */
    function finish(auto) {
      if (!auto) stopClock();
      UI.clear(body);
      var nameI = h('input', { id: 'test-name', type: 'text', placeholder: T().name, maxlength: '80' });
      var phoneI = h('input', { id: 'test-phone', type: 'tel', placeholder: T().phone, maxlength: '30' });
      var btn = h('button', { class: 'btn primary', type: 'submit' }, T().see);

      body.appendChild(h('form', {
        class: 'test-end',
        onsubmit: function (e) { e.preventDefault(); send(); }
      }, [
        auto ? h('p', { class: 'test-timeup' }, T().timeUp) : h('p', {}, T().done),
        h('p', { class: 'small muted' }, T().hint),
        nameI, phoneI, btn
      ]));
      /* Vaqt tugagan bo'lsa kutib turmaymiz — server muhlati ham
         tugab qolmasin. Ism/telefonsiz ham natija chiqadi. */
      if (auto) send();

      async function send() {
        btn.disabled = true; btn.textContent = T().calc; err.hidden = true;
        var ans = Object.keys(picked).map(function (id) { return { id: id, choice: picked[id] }; });
        try {
          var r = await D.api('POST', 'api/test/submit', {
            sessionId: SES, answers: ans,
            name: nameI.value, phone: phoneI.value
          });
          show(r);
        } catch (ex) {
          btn.disabled = false; btn.textContent = T().see;
          err.hidden = false;
          err.textContent = ex.message || T().errSend;
        }
      }
    }

    function show(r) {
      stopClock();
      UI.clear(body);
      var info = r.info || {};
      var list = (r.levels && r.levels.length) ? r.levels : LVLS;
      var rows = list.map(function (l) {
        var p = (r.perLevel || {})[l.code] || { ok: 0, total: 0 };
        /* Daraja o'tilgan: 4 savolli darajada 3 ta, 3 savollida 2 ta.
           Shu qoida serverdagi passFor() bilan bir xil. */
        var okAll = p.total && p.ok >= (p.total >= 4 ? 3 : 2);
        return h('div', { class: 'test-row' + (okAll ? ' ok' : '') }, [
          h('b', {}, l.code),
          h('span', { class: 'small' }, l.name),
          h('span', { class: 'small muted' }, p.ok + '/' + p.total)
        ]);
      });

      body.appendChild(h('div', { class: 'test-res' }, [
        h('div', { class: 'test-level' }, [
          h('span', { class: 'small muted' }, T().your),
          h('b', {}, r.level),
          h('span', {}, info.name || '')
        ]),
        info.about ? h('p', { class: 'small' }, info.about) : null,
        h('div', { class: 'test-score small muted' },
          T().total + ': ' + r.score + ' / ' + r.total),
        h('div', { class: 'test-rows' }, rows),
        h('p', { class: 'small muted' }, T().note),
        h('div', { class: 'test-nav' }, [
          h('button', {
            class: 'btn primary', type: 'button',
            onclick: function () { location.hash = ''; renderLanding(); setTimeout(function () { scrollTo('ariza'); }, 60); }
          }, T().apply),
          h('button', {
            class: 'btn sm', type: 'button',
            onclick: function () { pickLang(); }
          }, T().again)
        ])
      ]));
    }
  }
  A.renderTest = renderTest;


  /* ================= SAYT (kirishsiz sahifa) =================
     Markaz haqida ma'lumot, kurslar va pastda ariza formasi.
     Forma to'ldirilsa — murojaat "Murojaatlar" bo'limiga tushadi va
     administratorlarga (ichki suhbat + Telegram bot) xabar boradi. */
  var PUBLIC = null;

  async function publicInfo() {
    if (PUBLIC) return PUBLIC;
    try {
      var r = await fetch('api/public', { credentials: 'same-origin' });
      PUBLIC = r.ok ? await r.json() : {};
    } catch (e) { PUBLIC = {}; }
    A._pub = PUBLIC;
    return PUBLIC;
  }


  /** Fon bezagi: qog'oz rangli fon, arab-islom geometriyasidagi "xatam"
      (sakkiz burchakli yulduz) naqshi va sekin suzuvchi yorug'lik dog'lari.
      Naqsh logotip ranglarida chiziladi. Faqat ko'rinish uchun — bosishga
      xalaqit bermaydi, harakat kamaytirilgan rejimda to'xtab turadi. */
  function siteBackdrop() {
    return h('div', { class: 'site-bg', 'aria-hidden': 'true' }, [
      khatamSvg('khatam'),
      h('div', { class: 'glow g1' }),
      h('div', { class: 'glow g2' }),
      h('div', { class: 'glow g3' })
    ]);
  }

  /** Xatam yulduzi naqshi — takrorlanadigan SVG katak.
      Geometriya: {8/3} yulduz (tashqi radius R, ichki radius 0.4142·R) va
      uni bog'lab turuvchi sakkiz burchaklar. Naqsh qadimiy kitob bezaklaridan. */
  function khatamSvg(cls) {
    var NS = 'http://www.w3.org/2000/svg';
    var S = 132, R = 40, r = R * 0.4142, half = S / 2;
    function poly(cx, cy, n, rad, rad2, start) {
      var p = [];
      for (var k = 0; k < n; k++) {
        var a = (start + k * (360 / n)) * Math.PI / 180;
        var rr = (rad2 != null && k % 2) ? rad2 : rad;
        p.push((cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2));
      }
      return 'M' + p.join('L') + 'Z';
    }
    var d = [
      poly(half, half, 16, R, r, -90),
      poly(0, 0, 16, R, r, -90), poly(S, 0, 16, R, r, -90),
      poly(0, S, 16, R, r, -90), poly(S, S, 16, R, r, -90),
      poly(half, half, 8, r * 1.02, null, -67.5),
      poly(0, half, 8, r * 0.9, null, -67.5), poly(S, half, 8, r * 0.9, null, -67.5),
      poly(half, 0, 8, r * 0.9, null, -67.5), poly(half, S, 8, r * 0.9, null, -67.5)
    ].join('');

    var id = 'khatam-' + Math.random().toString(36).slice(2, 8);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    var defs = document.createElementNS(NS, 'defs');
    var pat = document.createElementNS(NS, 'pattern');
    pat.setAttribute('id', id);
    pat.setAttribute('width', S); pat.setAttribute('height', S);
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.1');
    path.setAttribute('stroke-linejoin', 'round');
    pat.appendChild(path);
    defs.appendChild(pat);
    svg.appendChild(defs);
    var rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', '100%'); rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'url(#' + id + ')');
    svg.appendChild(rect);
    return svg;
  }

  /** Saytdagi harakat (motion).
      Qoida: JS ishlamasa ham sahifa to'liq ko'rinadi — harakat faqat shu
      yerda yoqiladi (html.js-reveal). Harakat kamaytirilgan rejimda CSS
      hammasini o'chiradi, JS esa siljish (parallaks) hisobini o'tkazmaydi.

      Nimalar bor:
        1) hero ketma-ket ochiladi (sarlavha, chiziq, matn, tugmalar, raqamlar);
        2) bo'limlar aylantirilganda yumshoq chiqadi, kartalar birin-ketin;
        3) tepada tilla o'qish chizig'i;
        4) fon naqshi aylantirilganda sekin siljiydi;
        5) tepa panel yopishganda ostida chiziq paydo bo'ladi.            */
  function siteMotion(topBar) {
    var root = document.documentElement;
    if (!('IntersectionObserver' in window)) return;
    root.classList.add('js-reveal');

    var slow = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* --- 1. Ketma-ketlik uchun tartib raqami --- */
    function order(sel, hostSel) {
      Array.prototype.forEach.call(document.querySelectorAll(hostSel), function (host) {
        Array.prototype.forEach.call(host.querySelectorAll(sel), function (el, i) {
          el.style.setProperty('--i', i);
        });
      });
    }
    var hero = document.querySelector('.site .site-hero');
    if (hero) {
      Array.prototype.forEach.call(hero.querySelectorAll('.hero-text > *'), function (el, i) {
        el.style.setProperty('--d', i);
      });
      order('.hero-stat', '.site .hero-stats');
      /* Keyingi kadrda yoqamiz — boshlang'ich holat brauzerga yetib borsin */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { hero.classList.add('lit'); });
      });
    }

    /* --- 2. Bo'limlar va kartalar --- */
    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (row) {
        if (!row.isIntersecting) return;
        var el = row.target;
        ['.feat-grid > *', '.course-grid > *', '.tch-grid > *', '.slot-grid > *',
          '.site-contact .contact-row'].forEach(function (sel) {
            Array.prototype.forEach.call(el.querySelectorAll(sel), function (x, i) {
              x.style.setProperty('--i', i);
            });
          });
        el.classList.add('seen');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(document.querySelectorAll('.site .reveal'), function (el) {
      io.observe(el);
    });
    /* Keyin yuklanadigan kartalar (ustozlar, kurslar, vaqtlar) uchun ham */
    A._siteSeen = function (host) {
      if (!host) return;
      var sec = host.closest ? host.closest('.reveal') : null;
      if (sec && sec.classList.contains('seen')) {
        Array.prototype.forEach.call(host.children, function (x, i) { x.style.setProperty('--i', i); });
      }
    };

    /* --- 3. Tilla o'qish chizig'i --- */
    if (!slow) {
      var bar = h('div', { class: 'site-scroll', 'aria-hidden': 'true' });
      document.getElementById('auth').appendChild(bar);
      var khatam = document.querySelector('.site-bg .khatam');
      var tick = false;
      var onScroll = function () {
        if (tick) return;
        tick = true;
        requestAnimationFrame(function () {
          tick = false;
          var max = document.documentElement.scrollHeight - window.innerHeight;
          var y = window.scrollY || 0;
          bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')';
          /* --- 4. Fon naqshi sekin siljiydi --- */
          if (khatam) khatam.style.transform = 'translate3d(0,' + (-y * 0.06).toFixed(1) + 'px,0)';
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      A._scrollFxOff = function () { window.removeEventListener('scroll', onScroll); };
      onScroll();
    }

    /* --- 5. Yopishqoq tepa panel --- */
    if (!topBar) return;
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
    topBar.parentNode.insertBefore(probe, topBar);
    new IntersectionObserver(function (rows) {
      topBar.classList.toggle('stuck', !rows[0].isIntersecting);
    }, { threshold: 1 }).observe(probe);
  }

  /** O'q ikonkasi — tugma ustiga kelganda oldinga siljiydi (CSS: .ico-go). */
  function goIcon() {
    var i = UI.icon('right');
    i.classList.add('ico-go');
    return i;
  }

  /** Bosilganini sezdirish: tugma bosilganda rangi o'zgaradi va bosilgan
      joydan tilla to'lqin tarqaladi.

      Nega JS bilan: to'lqin bosilgan NUQTADAN chiqishi kerak, buni faqat
      CSS bilan qilib bo'lmaydi. Rang o'zgarishi esa CSS'da (:active) —
      ya'ni JS ishlamasa ham bosilganini ko'rinadi.

      "Harakatni kamaytirish" yoqilgan bo'lsa to'lqin qo'shilmaydi.       */
  function siteTouch(host) {
    if (!host || !host.addEventListener || !host.querySelectorAll) return;
    if (host.__siteTouch) return;                 // har chizishda qayta ulanmasin
    host.__siteTouch = true;
    var SEL = '.btn, .chip, .faq-q, .tch-card, .lvl, .soc-btn, .site-phone, .hero-tel, .foot-link';
    var slow = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function hit(e) {
      var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
      /* Faqat ochiq sayt sahifasida: kabinet, darslar va ERP shu konteynerda chizilganda
         to'lqin tugma ichiga qo'shilib, bosish "o'tib ketardi" (tugma ishlamay qolardi). */
      if (!t || t.disabled || !host.contains(t) || !t.closest('.site')) return;
      t.classList.add('pressing');
      if (slow) return;
      var r = t.getBoundingClientRect();
      if (!r.width) return;
      var d = Math.max(r.width, r.height) * 2.1;
      var s = document.createElement('span');
      s.className = 'rip';
      s.style.width = s.style.height = Math.round(d) + 'px';
      s.style.left = Math.round((e.clientX || (r.left + r.width / 2)) - r.left - d / 2) + 'px';
      s.style.top = Math.round((e.clientY || (r.top + r.height / 2)) - r.top - d / 2) + 'px';
      t.appendChild(s);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 620);
    }
    function off() {
      Array.prototype.forEach.call(host.querySelectorAll('.pressing'), function (x) {
        x.classList.remove('pressing');
      });
    }
    host.addEventListener('pointerdown', hit, { passive: true });
    window.addEventListener('pointerup', off, { passive: true });
    window.addEventListener('pointercancel', off, { passive: true });
    /* Klaviatura bilan bosilganda ham sezilsin */
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (t && t.closest('.site')) t.classList.add('pressing');
    });
    host.addEventListener('keyup', off);
  }

  /* Hero'da yozilib turadigan qatorlar.
     Markaz Sozlamalarda o'z iboralarini yozadi; yozmagan bo'lsa standart
     ro'yxat ishlatiladi. Iboralar markaz ma'lumoti — tarjima qilinmaydi.

     Harakat: matn harf-harf yoziladi, bir oz turadi, keyin o'chiriladi va
     keyingisi yoziladi. "Harakatni kamaytirish" yoqilgan bo'lsa yozilmaydi —
     iboralar shunchaki navbat bilan almashadi.                            */
  var TAGLINES = [
    'Qur’onni tushunib o’qing',
    'Noldan boshlab — 1 yilda',
    'Ayol ustoz bilan jonli Zoom darslar',
    'Uydan chiqmasdan, butun O’zbekiston bo’ylab'
  ];
  var typeTimer = null;

  function startTyping(list) {
    var el = document.getElementById('hero-type-txt');
    if (!el) return;
    if (typeTimer) { clearTimeout(typeTimer); typeTimer = null; }

    var rows = (list && list.length ? list : TAGLINES)
      .map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    if (!rows.length) return;

    var box = el.parentNode;
    /* Sahifa SAKRAMASLIGI uchun eng baland ibora bo'yicha joy ajratamiz.
       Matn kattalashgandan keyin uzun ibora ikki qatorga tushadi — shuning
       uchun balandlikni har bir iborani o'lchab topamiz, uzunligiga qarab
       taxmin qilmaymiz. Oyna kengligi o'zgarsa qayta o'lchanadi.        */
    function reserve() {
      var keep = el.textContent;
      box.style.minHeight = '';
      var max = 0;
      rows.forEach(function (t) {
        el.textContent = t;
        var hgt = box.offsetHeight;
        if (hgt > max) max = hgt;
      });
      el.textContent = keep;
      if (max) box.style.minHeight = max + 'px';
    }
    reserve();
    if (typeof ResizeObserver === 'function') {
      try {
        if (A._typeRO) A._typeRO.disconnect();
        var last = box.clientWidth;
        A._typeRO = new ResizeObserver(function () {
          if (!document.body.contains(box)) { A._typeRO.disconnect(); return; }
          if (Math.abs(box.clientWidth - last) < 8) return;
          last = box.clientWidth;
          reserve();
        });
        A._typeRO.observe(box.parentNode || box);
      } catch (e) { }
    }
    /* Shrift kech yuklansa — qayta o'lchaymiz */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { reserve(); }).catch(function () { });
    }
    var slow = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (rows.length === 1) { el.textContent = rows[0]; box.classList.add('done'); return; }

    if (slow) {
      /* Harakatsiz rejim: 4 soniyada bir almashadi */
      var k = 0;
      el.textContent = rows[0];
      box.classList.add('done');
      var tick = function () {
        k = (k + 1) % rows.length;
        el.textContent = rows[k];
        typeTimer = setTimeout(tick, 4000);
      };
      typeTimer = setTimeout(tick, 4000);
      return;
    }

    /* Harakat: yozilayotganda kursor tez, ibora tugaganda bir lahza
       porlaydi, keyin o'chiriladi. "full" klassi shu porlashni beradi. */
    var i = 0, pos = 0, del = false;
    function step() {
      var txt = rows[i];
      if (!del) {
        pos++;
        el.textContent = txt.slice(0, pos);
        if (pos >= txt.length) {
          box.classList.add('full');
          del = true; typeTimer = setTimeout(step, 2100); return;
        }
        typeTimer = setTimeout(step, 48 + Math.random() * 38);
      } else {
        box.classList.remove('full');
        pos--;
        el.textContent = txt.slice(0, pos);
        if (pos <= 0) { del = false; i = (i + 1) % rows.length; typeTimer = setTimeout(step, 340); return; }
        typeTimer = setTimeout(step, 24);
      }
    }
    el.textContent = '';
    typeTimer = setTimeout(step, 700);
  }

  /* ====================== OCHIQ SAYT ======================
     Tuzilishi: tepa panel → hero → afzalliklar → bosqichlar (narx) →
     ustozlar → dars vaqtlari → ariza (bepul sinov darsi) → savol-javob →
     pastki qism.

     Muhim qoida: markaz haqidagi DA'VOLAR (litsenziya, foiz, "standart"
     kabi) kodda yozilmaydi. Ular Sozlamalardan keladi va bo'sh bo'lsa
     bo'lim umuman ko'rinmaydi — saytda tekshirilmagan gap turmasin.   */
  function renderLanding() {
    if (dupView('landing')) return;
    hidePreRender();
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'site';
    UI.clear(wrap);
    /* Oldingi chizishdan qolgan kuzatuvchini uzamiz */
    if (A._ctaOff) { A._ctaOff(); A._ctaOff = null; }

    var name = centerNameNow();

    /* Ishonch qatoridagi odam siluetlari. Bu CHIZMA — haqiqiy odamning
       surati emas va yuz chizilmaydi: faqat bosh va yelka.
       Uch xil: ro'mol o'ragan, do'ppili va oddiy — markazda ayollar va
       erkaklar uchun alohida guruhlar borligini bildiradi.            */
    function personSvg(kind) {
      var NS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 40 40');
      svg.setAttribute('class', 'proof-person');
      svg.setAttribute('aria-hidden', 'true');
      /* Har bir shakl: [yo'l, ustiga qo'yiladimi]. Ustiga qo'yiladigan
         qism oqish rangda chiziladi — bir xil rangda bo'lsa silueti
         ichida ko'rinmay ketardi (ro'mol chekkasi, do'ppi).          */
      var d = [];
      if (kind === 'rumol') {
        /* Ro'mol boshni o'rab, yelkagacha tushadi */
        d.push(['M20 6.4c-6 0-9.6 4.4-9.6 10.2 0 3.4 1 5.8 2.3 7.5' +
          'c-4.1 1.6-6.7 4.7-6.7 8.6V35h28v-2.3c0-3.9-2.6-7-6.7-8.6' +
          'c1.3-1.7 2.3-4.1 2.3-7.5 0-5.8-3.6-10.2-9.6-10.2z', 0]);
        /* Ro'mol ostidan ko'rinadigan yuz o'rni — chiziqsiz, bo'sh */
        d.push(['M20 10.8c-3.4 0-5.4 2.6-5.4 6.1s2 6.4 5.4 6.4' +
          's5.4-2.9 5.4-6.4-2-6.1-5.4-6.1z', 1]);
      } else if (kind === 'duppi') {
        d.push(['M20 9.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4z', 0]);
        d.push(['M20 23.8c-6.6 0-12 3.9-12 8.7V35h24v-2.5c0-4.8-5.4-8.7-12-8.7z', 0]);
        /* Do'ppi — boshdan kengroq gumbaz */
        d.push(['M12.2 12.6a7.8 7.8 0 0 1 15.6 0z', 1]);
      } else {
        d.push(['M20 8.4a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2z', 0]);
        d.push(['M20 23.4c-6.8 0-12.4 4-12.4 9V35h24.8v-2.6c0-5-5.6-9-12.4-9z', 0]);
      }
      d.forEach(function (s) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', s[0]);
        if (s[1]) { p.setAttribute('fill', '#fff'); p.setAttribute('fill-opacity', '.34'); }
        else { p.setAttribute('fill', 'currentColor'); }
        svg.appendChild(p);
      });
      return svg;
    }

    /* ---------- Tepa panel ---------- */
    var navBtn = function (label, id) {
      return h('button', {
        class: 'btn sm ghost', type: 'button',
        onclick: function () { scrollTo(id); }
      }, label);
    };
    var topIn = h('div', { class: 'site-top-in' }, [
      h('button', {
        class: 'site-brand', type: 'button',
        onclick: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [
          h('b', { id: 'site-name' }, name),
          h('span', {}, 'Onlayn arab tili markazi')
        ])
      ]),
      h('nav', { class: 'site-nav' }, [
        navBtn('Darajalar', 'bosqichlar'),
        navBtn('Narx', 'narx'),
        navBtn('Ustozlar', 'ustozlar'),
        h('a', { class: 'site-phone', id: 'site-call', href: '#ariza' },
          [UI.icon('phone'), h('span', { id: 'site-call-text' }, 'Bog’lanish')]),
        h('button', {
          class: 'btn sm ghost', type: 'button',
          onclick: function () { location.hash = 'test'; renderTest(); }
        }, [UI.icon('task'), 'Daraja testi']),
        h('button', {
          class: 'btn sm', type: 'button',
          onclick: function () { location.hash = 'kabinet'; renderKabinet(); }
        }, [UI.icon('card'), 'O’quvchi kabineti']),
        h('button', {
          class: 'btn sm primary', type: 'button',
          onclick: function () { location.hash = 'kirish'; renderLogin(null); }
        }, [UI.icon('person'), 'Kirish'])
      ])
    ]);
    var top = h('header', { class: 'site-top' }, topIn);

    /* ---------- Hero ---------- */
    var statsBox = h('div', { class: 'hero-stats', id: 'hero-stats' });
    var heroBadge = h('span', { class: 'hero-pill', id: 'hero-pill', hidden: true });
    var hero = h('section', { class: 'site-hero' }, [
      heroBadge,
      h('div', { class: 'hero-text' }, [
        h('span', { class: 'hero-eyebrow' }, 'Ayollar uchun onlayn arab tili'),
        h('h1', {}, [h('span', { class: 'gold', id: 'site-name-hero' }, name)]),
        h('div', { class: 'hero-type' }, [
          h('span', { class: 'hero-type-txt', id: 'hero-type-txt' }, ''),
          h('span', { class: 'hero-type-cur', 'aria-hidden': 'true' })
        ]),
        h('div', { class: 'hero-rule', 'aria-hidden': 'true' }),
        h('p', { class: 'hero-lead', id: 'site-about' },
          'Noldan boshlab 1 yilda: Qur’onni tushunib o’qiysiz va arabcha gapirasiz. ' +
          'Ayol ustoz bilan jonli Zoom darslar, har bir dars yozuvi — butun O’zbekiston bo’ylab, uydan chiqmasdan.'),
        h('div', { class: 'hero-cta' }, [
          h('button', {
            class: 'btn gold xl', type: 'button', id: 'hero-free-btn',
            onclick: function () { goFreeLesson(); }
          }, [h('span', {}, 'Bepul darsga yozilish'), goIcon()]),
          h('button', {
            class: 'btn on-dark lg', type: 'button',
            onclick: function () { location.hash = 'test'; renderTest(); }
          }, ['Darajangizni bepul aniqlang', goIcon()])
        ]),
        /* Ishonch qatori. Doiralardagi shakllar — CHIZILGAN siluetlar,
           haqiqiy odamlarning surati EMAS: biz o'quvchilarning suratini
           saytga qo'ymaymiz. Yuz ham chizilmaydi — faqat bosh va yelka.
           Yozuvni markaz Sozlamada o'zi yozadi, bo'sh bo'lsa butun
           qator ko'rinmaydi.                                          */
        h('div', { class: 'hero-proof', id: 'hero-proof', hidden: true }, [
          h('span', { class: 'proof-dots', 'aria-hidden': 'true' },
            ['rumol', 'duppi', 'oddiy'].map(function (kind, i) {
              return h('span', { class: 'proof-dot d' + (i + 1) }, personSvg(kind));
            })),
          h('span', { class: 'proof-text', id: 'hero-proof-text' }, '')
        ]),
        h('div', { class: 'hero-meta' }, [
          h('a', { class: 'hero-tel', id: 'hero-tel', href: '#ariza' },
            [UI.icon('phone'), h('span', { id: 'hero-tel-text' }, '')]),
          h('span', { class: 'hero-hours', id: 'hero-hours', hidden: true })
        ])
      ]),
      /* Hero rasmi: jonli onlayn dars oynasi (chizma — haqiqiy
         odamlar surati emas, yuzlar chizilmaydi). Markaz g'oyasini
         bir qarashda ko'rsatadi: dars uydan, ekran orqali, ayollar
         guruhida, ustoz doskada harflarni tushuntiryapti.            */
      h('div', { class: 'hero-art lesson-art', 'aria-hidden': 'true' }, [
        h('div', { class: 'zm' }, [
          h('div', { class: 'zm-top' }, [
            h('span', { class: 'zm-live' }, 'JONLI'),
            h('span', { class: 'zm-title' }, 'Arab tili · 12-dars'),
            h('span', { class: 'zm-time' }, '00:34:12')
          ]),
          h('div', { class: 'zm-body' }, [
            h('div', { class: 'zm-board' }, [
              h('div', { class: 'zm-ar' }, 'كِتَابٌ'),
              h('div', { class: 'zm-tr' }, 'kitābun — kitob'),
              h('div', { class: 'zm-letters' }, ['ك', 'ت', 'ا', 'ب'].map(function (l) { return h('span', {}, l); }))
            ]),
            h('div', { class: 'zm-side' }, ['Ustoz', 'Madina', 'Zarina', 'Nodira'].map(function (n, i) {
              return h('div', { class: 'zm-tile' + (i === 0 ? ' host' : '') }, [
                h('span', { class: 'zm-ava' }, personSvg('rumol')),
                h('span', { class: 'zm-name' }, n)
              ]);
            }))
          ]),
          h('div', { class: 'zm-bar' }, [h('i'), h('i'), h('i', { class: 'end' })])
        ]),
        h('div', { class: 'zm-chip c1' }, [UI.icon('play'), 'Har dars yozib olinadi']),
        h('div', { class: 'zm-chip c2' }, [UI.icon('users'), 'Faqat ayollar guruhi'])
      ])
    ]);

    /* ---------- Natija yo'li: 1 yil — 4 bosqich ---------- */
    function stepCard(n, when, title, text) {
      return h('div', { class: 'rm-step' }, [
        h('span', { class: 'rm-dot' }, n),
        h('span', { class: 'rm-when' }, when),
        h('b', {}, title),
        h('p', {}, text)
      ]);
    }
    var roadmap = h('section', { class: 'site-sec reveal rm-sec', id: 'natija' }, [
      h('div', { class: 'sec-eyebrow' }, 'Natija yo’li'),
      h('h2', {}, 'Noldan 1 yilda — qadam-baqadam'),
      h('p', { class: 'sec-note' }, 'Har bir bosqichda nimani o’rganishingiz oldindan ma’lum. Sakrab o’tish yo’q.'),
      h('div', { class: 'rm-line' }, [
        stepCard('1', '1-oy', 'Harflar va o’qish', 'Arab alifbosi, harakatlar, so’zlarni bo’g’inlab o’qish.'),
        stepCard('2', '3-oy', 'Qur’onni ravon o’qish', 'Tajvid asoslari, Fotiha va qisqa suralarni xatosiz o’qish.'),
        stepCard('3', '6-oy', 'Ma’noni tushunish', 'Asosiy grammatika va 1000 ta ko’p uchraydigan so’z.'),
        stepCard('4', '12-oy', 'Arabcha gaplashish', 'Kundalik suhbat, matn o’qib tushunish, A2–B1 daraja.')
      ])
    ]);

    /* ---------- Dars qanday o'tadi: 3 qadam ---------- */
    function howCard(icon, n, title, text) {
      return h('div', { class: 'how-card' }, [
        h('div', { class: 'how-top' }, [h('span', { class: 'how-ico' }, UI.icon(icon)), h('span', { class: 'how-n' }, n)]),
        h('b', {}, title), h('p', {}, text)
      ]);
    }
    var howSec = h('section', { class: 'site-sec reveal how-sec', id: 'jarayon' }, [
      h('div', { class: 'sec-eyebrow' }, 'Qanday ishlaydi'),
      h('h2', {}, 'Boshlash uchun 3 qadam'),
      h('div', { class: 'how-grid' }, [
        howCard('play', '01', 'Bepul darsga yoziling', 'Telegram bot orqali 1 daqiqada. Jonli ochiq darsda usulimizni ko’rasiz.'),
        howCard('users', '02', 'Guruhga qo’shiling', 'Haftada 3 marta Zoom’da jonli dars. Guruhda 10 kishigacha, faqat ayollar.'),
        howCard('check', '03', 'Har kuni o’sing', 'Dars yozuvlari, uy vazifasi va ustoz izohlari — hammasi kabinetingizda.')
      ])
    ]);

    /* Izohlar tasmasi — hero ostida, birinchi blokdan keyin darrov.
       Kartalar uzluksiz aylanib turadi: chapdan xira bo'lib chiqadi,
       o'ngga xira bo'lib kirib ketadi. Tezlik kartalar soniga qarab
       sozlanadi — ikkita izoh bilan ham bir tekis yuradi.            */
    var revTrack = h('div', { class: 'rev-track', id: 'rev-track' });
    var revMarquee = h('div', { class: 'rev-marquee', id: 'rev-marquee' }, [
      h('div', { class: 'rev-mask' }, revTrack),
      /* Chetlardagi xiralik — orqadagi kartani xiralashtiradi */
      h('div', { class: 'rev-edge l', 'aria-hidden': 'true' }),
      h('div', { class: 'rev-edge r', 'aria-hidden': 'true' })
    ]);
    /* Hali bironta tasdiqlangan izoh bo'lmasa — tasma o'rniga shu qator.
       Tasmaning o'zi ko'rinib turadi, aks holda o'quvchi birinchi
       izohni qoldiradigan joy qolmasdi.                              */
    var revEmpty = h('p', { class: 'rev-empty', id: 'rev-empty', hidden: true },
      'Hozircha izoh yo’q — birinchi bo’lib siz yozing.');
    var revBand = h('section', { class: 'rev-band', id: 'rev-band' }, [
      h('div', { class: 'rev-band-head' }, [
        h('span', { class: 'rev-band-t' }, 'O’quvchilarimiz nima deydi'),
        h('button', {
          class: 'btn sm gold', type: 'button', onclick: function () { openReview(); }
        }, [UI.icon('edit'), h('span', {}, 'Izoh qoldirish')])
      ]),
      revEmpty,
      revMarquee
    ]);

    /* Ko'rsatkichlar — hero ostida alohida to'q tasma.
       Sozlamada yozilmagan bo'lsa butun tasma ko'rinmaydi.              */
    var statsBand = h('section', { class: 'stat-band reveal', id: 'stat-band', hidden: true }, statsBox);

    /* Zapusk tasmasi: bepul dars sanasi, chegirmali narx, "7/20 joy band"
       va tugashiga qolgan vaqt. Sozlamada yoqilmasa ko'rinmaydi.        */
    var promoBand = h('section', { class: 'site-sec promo-band', id: 'promo-band', hidden: true });
    var botUser = '';
    function botLink() {
      if (!botUser) return '';
      var src = A.siteSrc();
      return 'https://t.me/' + botUser + '?start=dars' + (src ? '_' + src : '');
    }
    function goFreeLesson() {
      var l = botLink();
      if (l) { window.open(l, '_blank', 'noopener'); return; }
      scrollTo('ariza'); if (fName.input) fName.input.focus();
    }

    /* ---------- Nega biz: chapda naqshli panel, o'ngda ro'yxat ---------- */
    function whyRow(t) {
      return h('li', {}, [UI.icon('check'), h('span', {}, t)]);
    }
    var feats = h('section', { class: 'site-sec reveal', id: 'imkoniyatlar' }, [
      h('div', { class: 'why-wrap' }, [
        h('div', { class: 'why-art' }, [
          khatamSvg('khatam-in'),
          h('div', { class: 'why-art-in' }, [
            h('span', { class: 'why-ar', 'aria-hidden': 'true' }, 'العربية'),
            h('img', { src: LOGO, alt: '' }),
            h('div', { class: 'why-badge' }, [
              h('b', { id: 'why-badge-v' }, 'A1–C2'),
              h('span', {}, 'to’liq dastur')
            ])
          ])
        ]),
        h('div', { class: 'why-text' }, [
          h('div', { class: 'sec-eyebrow' }, 'Nega biz'),
          h('h2', {}, 'Uydan chiqmasdan, ayol ustoz bilan'),
          h('p', { class: 'sec-note' },
            'Darslar jonli: ustozni ko’rasiz, savol berasiz, xatoingiz o’sha zahoti ' +
            'tuzatiladi. Dars qoldirsangiz — yozuvi Telegram guruhda turadi. ' +
            'Noldan boshlab bir yilda Qur’onni tushunib o’qish va arabcha suhbatga yetasiz.'),
          h('ul', { class: 'why-list' }, [
            whyRow('Faqat ayollar guruhi va ayol ustoz'),
            whyRow('Haftada 3 marta jonli Zoom dars, har biri 80 daqiqa'),
            whyRow('Har bir dars yozib olinadi — qoldirsangiz ham ortda qolmaysiz'),
            whyRow('Kichik guruh: 10 kishigacha, har biriga vaqt yetadi'),
            whyRow('Butun O’zbekiston va chet eldan qatnashish mumkin'),
            whyRow('Uy vazifasi, davomat va to’lov — shaxsiy kabinetda')
          ]),
          h('button', {
            class: 'btn primary lg', type: 'button',
            onclick: function () { scrollTo('ustozlar'); }
          }, ['Ustozlar bilan tanishing', goIcon()])
        ])
      ])
    ]);

    /* ---------- Darajalar ----------
       Kurslar har xil emas — DARAJA har xil. Ro'yxat serverdan keladi
       (server/levels.js), daraja testi ham xuddi shu ro'yxat bilan
       ishlaydi. Ya'ni sayt hech narsa o'ylab topmaydi.                 */
    var lvlGrid = h('div', { class: 'lvl-grid' }, h('div', { class: 'muted small' }, 'Yuklanmoqda…'));
    var levelsSec = h('section', { class: 'site-sec reveal', id: 'bosqichlar' }, [
      h('div', { class: 'sec-mid' }, [
        h('div', { class: 'sec-eyebrow center' }, 'O’quv dasturi'),
        h('h2', {}, 'Bitta dastur — olti daraja'),
        h('p', { class: 'sec-note center' },
          'Guruhlar faqat daraja bilan farq qiladi, narx esa hammasida bir xil. ' +
          'Qaysi darajadan boshlashni bepul test bir necha daqiqada aniqlaydi.')
      ]),
      lvlGrid
    ]);

    /* ---------- Bitta narx ---------- */
    var priceBox = h('div', { class: 'price-wrap' });
    var priceSec = h('section', { class: 'site-sec reveal', id: 'narx' }, [priceBox]);

    /* ---------- Ustozlar ---------- */
    var teachBox = h('div', { class: 'tch-grid' }, h('div', { class: 'muted small' }, 'Yuklanmoqda…'));
    var teachers = h('section', { class: 'site-sec reveal', id: 'ustozlar' }, [
      h('div', { class: 'sec-split' }, [
        h('div', {}, [
          h('div', { class: 'sec-eyebrow' }, 'Ustozlar'),
          h('h2', {}, 'Darsni kim olib boradi')
        ]),
        h('p', { class: 'sec-note' },
          'Darslarni tajribali ayol ustoz olib boradi. Noldan boshlovchilar bilan ' +
          'ishlashni biladi: har bir harf va qoidani sabr bilan, tushunarli qilib o’rgatadi.')
      ]),
      teachBox
    ]);

    /* ---------- Dars vaqtlari ---------- */
    var slotBox = h('div', { class: 'slot-grid' });
    var timetable = h('section', { class: 'site-sec reveal', id: 'vaqt' }, [
      h('div', { class: 'sec-eyebrow' }, 'Jadval'),
      h('h2', {}, 'Dars vaqtlari'),
      h('p', { class: 'muted', id: 'slot-lead' }, 'Har bir dars 80 daqiqa, Zoom orqali.'),
      slotBox
    ]);

    /* ---------- Ariza: bepul sinov darsi ---------- */
    var fName = UI.field({ label: 'Ism va familiyangiz', id: 'lead-name', required: true, placeholder: 'Ism familiya' });
    var fPhone = UI.field({
      label: 'Telefon raqamingiz', id: 'lead-phone', required: true,
      placeholder: '+998 90 123 45 67', inputmode: 'tel'
    });
    /* "Qaysi kurs" savoli yo'q: markazda bitta yo'nalish bor, narx ham
       bitta. Shuning uchun ariza kursga O'ZI biriktiriladi — odamdan
       ortiqcha savol so'ralmaydi.                                      */
    var leadCourse = '';
    var fRegion = UI.field({
      label: 'Qayerdansiz?', id: 'lead-region', type: 'select',
      options: [{ value: '', label: 'Hududni tanlang' }].concat(A.REGIONS.map(function (r) { return { value: r, label: r }; }))
    });
    var fTime = UI.field({
      label: 'Dars uchun qulay vaqt', id: 'lead-time', type: 'select',
      options: [{ value: '', label: 'Farqi yo’q' }]
    });
    /* Hozirgi daraja — uchta tanlov (chip) */
    var LVL = [
      { id: 'noldan', label: 'Noldan (alifbo)' },
      { id: 'oqiy', label: 'O’qiy olaman' },
      { id: 'gram', label: 'Grammatikani bilaman' }
    ];
    var lvlPick = '';
    var lvlBox = h('div', { class: 'chip-row' }, LVL.map(function (o) {
      var b = h('button', { class: 'chip', type: 'button' }, o.label);
      b.addEventListener('click', function () {
        lvlPick = (lvlPick === o.id) ? '' : o.id;
        clearPill();
        Array.prototype.forEach.call(lvlBox.children, function (x) { x.classList.remove('on'); });
        if (lvlPick) b.classList.add('on');
      });
      return b;
    }));
    /* Daraja kartasidan kelgan tanlov shu yerda ko'rinadi. */
    var lvlPill = h('div', { class: 'lvl-pill', id: 'lead-level-pill', hidden: true });
    var lvlWrap = h('div', { class: 'field full' }, [
      h('label', {}, 'Hozirgi arab tili darajangiz'), lvlPill, lvlBox
    ]);
    function clearPill() { lvlPill.hidden = true; UI.clear(lvlPill); }
    function pickLevel(code, label) {
      lvlPick = code;
      Array.prototype.forEach.call(lvlBox.children, function (x) { x.classList.remove('on'); });
      UI.clear(lvlPill);
      lvlPill.hidden = false;
      lvlPill.appendChild(h('span', { class: 'lvl-pill-in', id: 'lead-level-text' },
        code + ' — ' + label));
      lvlPill.appendChild(h('button', {
        class: 'lvl-pill-x', type: 'button', 'aria-label': 'Olib tashlash',
        onclick: function () { lvlPick = ''; clearPill(); }
      }, '×'));
      scrollTo('ariza');
      if (fName.input) fName.input.focus();
    }

    var err = h('div', { class: 'err-msg', hidden: true });
    var okBox = h('div', { class: 'lead-ok', hidden: true });
    var btn = h('button', { class: 'btn gold block lg', type: 'submit' },
      ['Bepul sinov darsiga yozilish', goIcon()]);

    var form = h('form', {
      class: 'lead-form', onsubmit: function (e) { e.preventDefault(); sendLead(); }
    }, [
      h('b', { class: 'form-title' }, 'Ro’yxatdan o’tish formasi'),
      h('p', { class: 'form-note' }, 'Ma’lumotlaringiz maxfiy, administratorimiz siz bilan bog’lanadi.'),
      fName.wrap, fPhone.wrap, fRegion.wrap, lvlWrap, fTime.wrap, err, btn,
      h('p', { class: 'form-fine' },
        'Tugmani bosish orqali siz shaxsiy ma’lumotlaringiz qayta ishlanishiga rozilik bildirasiz.')
    ]);

    function benefit(icon, t) {
      return h('div', { class: 'ben-row' }, [h('span', { class: 'ben-ico' }, UI.icon(icon)), h('span', {}, t)]);
    }
    var apply = h('section', { class: 'site-sec reveal', id: 'ariza' }, [
      h('div', { class: 'apply-wrap' }, [
        h('div', { class: 'apply-left' }, [
          h('span', { class: 'hero-eyebrow' }, 'Bepul ochiq dars'),
          h('h2', {}, 'Bir dars qatnashib ko’ring — keyin qaror qilasiz'),
          h('p', {}, 'Raqamingizni qoldiring yoki Telegram botimiz orqali yoziling: ' +
            'bepul dars havolasini va eslatmani yuboramiz.'),
          h('div', { class: 'ben-list' }, [
            benefit('play', 'Jonli bepul dars — darsning o’zida natija ko’rasiz'),
            benefit('check', 'Dars oxirida kursga qabul va chegirma'),
            benefit('layers', 'Mos guruh va qulay vaqt taklifi')
          ]),
          h('a', { class: 'btn primary lg', id: 'apply-bot-btn', hidden: true, target: '_blank', rel: 'noopener' },
            [UI.icon('bot'), 'Telegram bot orqali yozilish']),
          h('div', { class: 'apply-soc', id: 'apply-soc', hidden: true }),
          h('div', { class: 'site-contact', id: 'contact-box' }, [
            h('div', { class: 'contact-row', id: 'site-phone-row', hidden: true }, [
              UI.icon('phone'), h('a', { id: 'site-phone-link', href: '#' }, '')
            ]),
            h('div', { class: 'contact-row', id: 'site-addr-row', hidden: true }, [
              UI.icon('home'), h('span', { id: 'site-addr' }, '')
            ]),
            h('div', { class: 'contact-row', id: 'site-time-row', hidden: true }, [
              UI.icon('calendar'), h('span', { id: 'site-time' }, '')
            ]),
            h('div', { class: 'contact-row', id: 'site-tg-row', hidden: true }, [
              UI.icon('bot'), h('a', { id: 'site-tg', href: '#', target: '_blank', rel: 'noopener' }, '')
            ])
          ])
        ]),
        h('div', { class: 'apply-card' }, [form, okBox])
      ])
    ]);

    /* ---------- Savol-javob ---------- */
    var faqBox = h('div', { class: 'faq-list' });
    var faq = h('section', { class: 'site-sec reveal', id: 'savollar', hidden: true }, [
      h('div', { class: 'sec-mid' }, [
        h('div', { class: 'sec-eyebrow center' }, 'Savol-javob'),
        h('h2', {}, 'Tez-tez beriladigan savollar')
      ]),
      faqBox
    ]);

    /* Izohlar faqat TEPADAGI tasmada ko'rsatiladi (rev-band).
       Pastdagi to'liq ro'yxat olib tashlandi — bitta joy yetarli,
       "Izoh qoldirish" tugmasi ham o'sha tasmaning yonida turadi. */

    /* ---------- Pastdagi chaqiruv tasmasi ---------- */
    var ctaBand = h('section', { class: 'cta-band reveal' }, [
      h('div', { class: 'cta-ico' }, UI.icon('calendar')),
      h('div', { class: 'cta-text' }, [
        h('b', {}, 'Bepul sinov darsiga yozilish'),
        h('span', {}, 'Guruhni, ustozni va dars uslubini o’zingiz ko’rasiz — keyin qaror qilasiz.')
      ]),
      h('button', {
        class: 'btn gold lg', type: 'button',
        onclick: function () { scrollTo('ariza'); if (fName.input) fName.input.focus(); }
      }, ['Ariza qoldirish', goIcon()])
    ]);

    /* ---------- Pastki qism ---------- */
    var foot = h('footer', { class: 'site-foot' }, [
      h('div', { class: 'foot-cols' }, [
        h('div', { class: 'foot-col' }, [
          h('div', { class: 'foot-brand' }, [
            h('img', { class: 'logo-sm', src: LOGO, alt: '', width: 34, height: 34 }),
            h('b', { id: 'foot-name' }, name)
          ]),
          h('p', { class: 'foot-about', id: 'foot-about' }, '')
        ]),
        h('div', { class: 'foot-col' }, [
          h('b', {}, 'Bo’limlar'),
          h('button', { class: 'foot-link', type: 'button', onclick: function () { scrollTo('bosqichlar'); } }, 'Darajalar'),
          h('button', { class: 'foot-link', type: 'button', onclick: function () { scrollTo('narx'); } }, 'Narx'),
          h('button', { class: 'foot-link', type: 'button', onclick: function () { scrollTo('ustozlar'); } }, 'Ustozlar'),
          h('button', { class: 'foot-link', type: 'button', onclick: function () { scrollTo('vaqt'); } }, 'Dars vaqtlari'),
          h('button', {
            class: 'foot-link', type: 'button',
            onclick: function () { location.hash = 'test'; renderTest(); }
          }, 'Daraja testi')
        ]),
        h('div', { class: 'foot-col' }, [
          h('b', {}, 'Bog’lanish'),
          h('a', { class: 'foot-link', id: 'foot-phone', href: '#ariza' }, ''),
          h('span', { class: 'foot-line', id: 'foot-addr' }, ''),
          h('span', { class: 'foot-line', id: 'foot-hours' }, '')
        ]),
        h('div', { class: 'foot-col' }, [
          h('b', {}, 'Ijtimoiy tarmoqlar'),
          h('div', { class: 'foot-soc', id: 'foot-soc' })
        ])
      ]),
      h('div', { class: 'foot-bar' }, [
        h('span', {}, '© ' + new Date().getFullYear() + ' ' + name),
        h('div', { class: 'rowflex' }, [
          h('button', {
            class: 'btn sm ghost', type: 'button',
            onclick: function () { location.hash = 'kabinet'; renderKabinet(); }
          }, 'O’quvchi kabineti'),
          h('button', {
            class: 'btn sm ghost', type: 'button',
            onclick: function () { location.hash = 'kirish'; renderLogin(null); }
          }, 'Xodimlar kirishi')
        ])
      ])
    ]);

    /* Telefonda pastda doim turadigan tasma: yozilish va qo'ng'iroq.
       Kompyuterda ko'rinmaydi (CSS), chunki u yerda tepadagi tugmalar
       baribir ko'z oldida turadi.                                     */
    var ctaBar = h('div', { class: 'site-cta-bar', id: 'cta-bar' }, [
      h('a', {
        class: 'cta-bar-tel', id: 'cta-bar-tel', href: '#ariza',
        'aria-label': 'Qo’ng’iroq qilish'
      }, UI.icon('phone')),
      h('button', {
        class: 'btn gold cta-bar-go', type: 'button',
        onclick: function () { scrollTo('ariza'); }
      }, [h('span', {}, 'Darsga yozilish'), goIcon()])
    ]);

    wrap.appendChild(siteBackdrop());
    wrap.appendChild(top);
    wrap.appendChild(h('div', { class: 'site-wrap' },
      [hero, promoBand, statsBand, roadmap, feats, howSec, priceSec, teachers,
        levelsSec, timetable, revBand, apply, faq, ctaBand, foot]));
    wrap.appendChild(ctaBar);
    /* Hero'dagi "Darsga yozilish" ko'rinib turganda pastki tasma kerak
       emas — u ko'zdan yo'qolgandan keyin chiqadi.                     */
    (function () {
      var heroBtn = wrap.querySelector('.site-hero .btn.gold.xl');
      if (!heroBtn) { ctaBar.classList.add('on'); return; }
      var waiting = false;
      function check() {
        waiting = false;
        var r = heroBtn.getBoundingClientRect();
        /* Hero tugmasi ekrandan chiqib ketgan bo'lsa — tasma chiqadi */
        ctaBar.classList.toggle('on', r.bottom <= 0);
      }
      function onScroll() {
        if (waiting) return;
        waiting = true;
        if (window.requestAnimationFrame) window.requestAnimationFrame(check);
        else setTimeout(check, 16);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      /* Ekran o'lchami o'zgarsa tasma qaytadan yig'iladi — nusxalar
         soni ekran kengligiga bog'liq.                              */
      var reTmr = null;
      function onResize() {
        onScroll();
        clearTimeout(reTmr);
        reTmr = setTimeout(function () { if (A._revRebuild) A._revRebuild(); }, 220);
      }
      window.addEventListener('resize', onResize, { passive: true });
      A._ctaOff = function () {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        window.removeEventListener('resize', onResize);
        clearTimeout(reTmr);
      };
      check();
    })();
    A.I18N.apply(wrap);
    fillPublic();
    siteMotion(top);
    siteTouch(wrap);

    function scrollTo(id) {
      var el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function show(id) { var el = document.getElementById(id); if (el) el.hidden = false; }
    function setText(id, t) { var el = document.getElementById(id); if (el) el.textContent = t; }

    async function fillPublic() {
      var d = await publicInfo();

      if (d.centerName) {
        ['site-name', 'site-name-hero', 'foot-name'].forEach(function (k) { setText(k, d.centerName); });
      }
      if (d.about) { setText('site-about', d.about); setText('foot-about', d.about); }

      /* Telefon — uch joyda */
      if (d.phone) {
        var tel = 'tel:' + String(d.phone).replace(/[^+0-9]/g, '');
        show('site-phone-row');
        var pl = document.getElementById('site-phone-link');
        if (pl) { pl.textContent = d.phone; pl.href = tel; }
        [['site-call', 'site-call-text'], ['hero-tel', 'hero-tel-text']].forEach(function (pair) {
          var a = document.getElementById(pair[0]);
          if (a) { a.href = tel; setText(pair[1], d.phone); }
        });
        var fp = document.getElementById('foot-phone');
        if (fp) { fp.textContent = d.phone; fp.href = tel; }
        /* Telefondagi pastki tasmadagi qo'ng'iroq tugmasi */
        var cb = document.getElementById('cta-bar-tel');
        if (cb) cb.href = tel;
      }
      if (d.address) { show('site-addr-row'); setText('site-addr', d.address); setText('foot-addr', d.address); }
      if (d.workStart && d.workEnd) {
        show('site-time-row');
        var hrs = 'Ish vaqti: ' + d.workStart + '–' + d.workEnd;
        setText('site-time', hrs);
        setText('foot-hours', hrs);
        var hh = document.getElementById('hero-hours');
        if (hh) { hh.hidden = false; hh.textContent = hrs; }
      }
      if (d.telegram) {
        show('site-tg-row');
        var tg = document.getElementById('site-tg');
        var u = String(d.telegram).replace(/^@/, '');
        if (tg) { tg.textContent = '@' + u; tg.href = 'https://t.me/' + u; }
      }
      paintSocial(d);
      botUser = String(d.telegram || '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
      var abb = document.getElementById('apply-bot-btn');
      if (abb && botUser) { abb.hidden = false; abb.href = botLink(); }
      paintPromo(d.promo, d.freeLesson);
      paintBadge(d.heroBadge);
      paintProof(d.heroProof);
      paintStats(d.stats, d.lessonMinutes);
      startTyping(d.taglines);
      paintLevels(d.levels || []);
      paintPrice(d.courses || []);
      paintTeachers(d.teachers || []);
      paintSlots(d.workStart || '08:00', d.workEnd || '22:00', d.lessonMinutes || 90, d.breakMinutes, d.lessonTimes);
      paintFaq(d.faq || []);
      paintReviews(d.reviews || []);
      setLeadCourse(d.courses || []);
      paintTimePick(d.workStart || '08:00', d.workEnd || '22:00', d.lessonMinutes || 90, d.breakMinutes, d.lessonTimes);
      if (A._siteSeen) {
        A._siteSeen(teachBox); A._siteSeen(slotBox);
        A._siteSeen(lvlGrid); A._siteSeen(statsBox);
      }
      A.I18N.apply(wrap);
    }

    function paintPromo(p, fl) {
      var box = document.getElementById('promo-band');
      if (!box) return;
      UI.clear(box);
      if (!p && !fl) { box.hidden = true; return; }
      box.hidden = false;
      var kids = [];
      if (fl && (fl.title || fl.date)) {
        kids.push(h('div', { class: 'promo-free' }, [
          h('span', { class: 'sec-eyebrow' }, 'Bepul ochiq dars'),
          h('b', {}, fl.title || 'Bepul dars'),
          fl.date ? h('span', { class: 'muted' }, A.dateLabel(fl.date) + (fl.time ? ', soat ' + fl.time : '')) : null
        ]));
      }
      if (p) {
        var left = p.seats ? Math.max(0, p.seats - (p.used || 0)) : null;
        var cd = h('span', { class: 'promo-cd', id: 'promo-cd' });
        kids.push(h('div', { class: 'promo-offer' }, [
          h('span', { class: 'sec-eyebrow' }, p.open ? 'Zapusk chegirmasi' : 'Chegirma yopildi'),
          h('div', { class: 'promo-price' }, [
            h('b', {}, A.som(p.price) + ' so’m'),
            p.regular ? h('s', { class: 'muted' }, A.som(p.regular) + ' so’m') : null,
            h('span', { class: 'muted small' }, ' — birinchi oy')
          ]),
          p.seats ? h('div', { class: 'promo-seats' }, [
            h('div', { class: 'promo-bar' }, h('i', { style: 'width:' + Math.min(100, Math.round((p.used || 0) * 100 / p.seats)) + '%' })),
            h('span', { class: 'small' }, (p.used || 0) + '/' + p.seats + ' joy band' + (left != null && p.open ? ' · ' + left + ' ta qoldi' : ''))
          ]) : null,
          p.open && p.endDate ? cd : null
        ]));
        if (p.open && p.endDate) {
          var end = Date.parse(p.endDate + 'T' + (p.endTime || '23:59') + ':00+05:00');
          var tick = function () {
            var ms = end - Date.now();
            if (!document.body.contains(cd)) return;
            if (ms <= 0) { cd.textContent = 'Muddat tugadi'; return; }
            var dd = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5), mm = Math.floor(ms % 36e5 / 6e4);
            cd.textContent = 'Tugashiga: ' + (dd ? dd + ' kun ' : '') + hh + ' soat ' + mm + ' daqiqa';
            setTimeout(tick, 30000);
          };
          tick();
        }
      }
      kids.push(h('button', { class: 'btn gold lg', type: 'button', onclick: function () { goFreeLesson(); } },
        ['Bepul darsga yozilish', goIcon()]));
      box.appendChild(h('div', { class: 'promo-in' }, kids));
    }

    function paintBadge(txt) {
      var el = document.getElementById('hero-pill');
      if (!el) return;
      if (!txt) { el.hidden = true; return; }
      el.hidden = false;
      UI.clear(el);
      el.appendChild(UI.icon('award'));
      el.appendChild(h('span', {}, txt));
    }

    /* Ko'rsatkichlar tasmasi. Standart qatorlar — markazning da'vosi
       emas, dasturning o'zidagi haqiqat: CEFR bo'yicha 6 daraja va
       darsning uzunligi Sozlamadan olinadi. Qolganini markaz yozadi. */
    var STAT_ICO = ['layers', 'users', 'calendar', 'clock'];
    function paintStats(list, minutes) {
      UI.clear(statsBox);
      var rows = (list && list.length) ? list : [
        { v: '1 yil', t: 'noldan natijagacha' },
        { v: (minutes || 80) + ' daqiqa', t: 'jonli Zoom dars' },
        { v: '3 marta', t: 'haftasiga dars' }
      ];
      rows.forEach(function (r, i) {
        statsBox.appendChild(h('div', { class: 'hero-stat', style: '--i:' + i }, [
          h('span', { class: 'stat-ico' }, UI.icon(STAT_ICO[i % STAT_ICO.length])),
          h('div', {}, [h('b', {}, r.v), h('span', {}, r.t)])
        ]));
      });
      var band = document.getElementById('stat-band');
      if (band) band.hidden = !statsBox.children.length;
    }

    /* Ijtimoiy tarmoqlar. Manzillarni markaz Sozlamada yozadi —
       yozilmagani ko'rinmaydi.                                          */
    /* Ijtimoiy tarmoqlar. Telegram va Instagram logotiplari — o'sha
       xizmatlarning rasmiy belgilari (markaz rahbari yuborgan fayllar),
       assets/ papkasida turadi. Tugmada asosiysi LOGOTIP; yozuv esa
       qaysi kanal ekanini ajratish uchun kichik qilib beriladi.        */
    function socialList(d) {
      var out = [];
      if (d.tgChannel) {
        out.push({ logo: 'tg', name: 'Telegram kanal', sub: '', url: tgUrl(d.tgChannel) });
      }
      if (d.instagram) {
        out.push({ logo: 'ig', name: 'Instagram', sub: '', url: instaUrl(d.instagram) });
      }
      if (d.telegram) {
        out.push({ logo: 'tg', name: 'Telegram bot', sub: '', url: tgUrl(d.telegram) });
      }
      /* Qabul manzillari — filial nomi bilan */
      if (d.tgQabul) {
        out.push({ logo: 'tg', name: 'Qabul', sub: d.tgQabulLabel || '', url: tgUrl(d.tgQabul) });
      }
      if (d.tgQabul2) {
        out.push({ logo: 'tg', name: 'Qabul', sub: d.tgQabulLabel2 || '', url: tgUrl(d.tgQabul2) });
      }
      if (d.youtube) {
        out.push({ logo: 'yt', name: 'YouTube', sub: '', url: ytUrl(d.youtube) });
      }
      return out;
    }
    var SOC_LOGO = {
      tg: { src: 'assets/logo-telegram.png', alt: 'Telegram' },
      ig: { src: 'assets/logo-instagram.png', alt: 'Instagram' }
    };
    function socBtn(l, big) {
      var lg = SOC_LOGO[l.logo];
      return h('a', {
        class: 'soc-btn soc-' + l.logo + (big ? ' big' : ''),
        href: l.url, target: '_blank', rel: 'noopener',
        title: l.name + (l.sub ? ' · ' + l.sub : '')
      }, [
        lg
          ? h('img', { class: 'soc-logo', src: lg.src, alt: '', width: '32', height: '32', loading: 'lazy' })
          : h('span', { class: 'soc-ico' }, UI.icon('play')),
        h('span', { class: 'soc-txt' }, [
          h('b', {}, l.name),
          l.sub ? h('span', {}, l.sub) : null
        ].filter(Boolean))
      ]);
    }
    function paintSocial(d) {
      var links = socialList(d);
      var box = document.getElementById('foot-soc');
      if (box) {
        UI.clear(box);
        if (!links.length) box.appendChild(h('span', { class: 'foot-line' }, 'Tez orada'));
        else links.forEach(function (l) { box.appendChild(socBtn(l)); });
      }
      /* Ariza blokidagi katta tugmalar */
      var big = document.getElementById('apply-soc');
      if (big) {
        UI.clear(big);
        links.slice(0, 3).forEach(function (l) { big.appendChild(socBtn(l, true)); });
        big.hidden = !links.length;
      }
    }
    function tgUrl(v) {
      var t = String(v || '').trim();
      if (/^https?:/i.test(t)) return t;
      return 'https://t.me/' + t.replace(/^@/, '');
    }
    function instaUrl(v) {
      var t = String(v || '').trim();
      if (/^https?:/i.test(t)) return t;
      return 'https://instagram.com/' + t.replace(/^@/, '');
    }
    function ytUrl(v) {
      var t = String(v || '').trim();
      if (/^https?:/i.test(t)) return t;
      return 'https://youtube.com/' + (t.charAt(0) === '@' ? t : '@' + t);
    }

    /* --- Izohlar --- */
    function stars(n) {
      var box = h('span', { class: 'rev-stars', 'aria-label': n + ' / 5' });
      for (var i = 1; i <= 5; i++) {
        box.appendChild(h('span', { class: 'rev-star' + (i <= n ? ' on' : '') }, '★'));
      }
      return box;
    }
    function revCard(r, small) {
      return h('figure', { class: 'rev-card' + (small ? ' sm' : '') }, [
        h('div', { class: 'rev-top' }, [
          h('span', { class: 'rev-ava' }, String(r.name || '?').trim().charAt(0).toUpperCase()),
          h('div', {}, [
            h('b', {}, r.name),
            r.about ? h('span', { class: 'rev-about' }, r.about) : null
          ].filter(Boolean)),
          stars(r.rating)
        ]),
        h('blockquote', {}, r.text)
      ]);
    }
    var REVIEWS = null;
    function paintReviews(list) {
      list = list || [];
      REVIEWS = list;
      /* Izohlar faqat tepadagi aylanib turadigan tasmada. Bitta
         tasdiqlangan izoh bo'lsa ham aylanadi; izoh bo'lmasa
         tasma o'rnida qisqa qator turadi.                          */
      var band = document.getElementById('rev-band');
      if (!band) return;
      var empty = !list.length;
      revEmpty.hidden = !empty;
      revMarquee.hidden = empty;
      if (empty) { UI.clear(revTrack); return; }
      buildMarquee(list.slice(0, 10));
      if (A._siteSeen) A._siteSeen(band);
    }

    /* Tasmani yig'ish: ro'yxat ikkita teng yarmga bo'linadi va
       -50% ga suriladi — shunda ulanish joyi ko'rinmaydi. Har bir
       yarim ekrandan kengroq bo'lishi kerak, aks holda oraliqda
       bo'sh joy qolardi; shuning uchun ro'yxat kerak bo'lsa bir
       necha marta takrorlanadi.                                     */
    function buildMarquee(list) {
      if (!list.length) return;
      var SPEED = 62;                       // piksel/soniya — bir tekis tezlik
      UI.clear(revTrack);
      function half(copies, hidden) {
        var box = h('div', { class: 'rev-half', 'aria-hidden': hidden ? 'true' : null });
        for (var c = 0; c < copies; c++) {
          list.forEach(function (r) { box.appendChild(revCard(r, true)); });
        }
        return box;
      }
      /* Avval bitta nusxa bilan o'lchaymiz */
      var probe = half(1, true);
      revTrack.appendChild(probe);
      var one = probe.getBoundingClientRect().width || 0;
      var need = 1;
      var vis = revMarquee.getBoundingClientRect().width || 0;
      if (one > 0 && vis > 0) need = Math.max(1, Math.ceil((vis + 80) / one));
      UI.clear(revTrack);
      revTrack.appendChild(half(need, false));
      revTrack.appendChild(half(need, true));
      /* Tezlik kartalar soniga bog'liq bo'lmasin */
      var total = one * need;
      revTrack.style.animationDuration = total > 0
        ? Math.max(12, Math.round(total / SPEED)) + 's' : '';
    }
    A._revRebuild = function () { if (REVIEWS) buildMarquee(REVIEWS.slice(0, 10)); };

    /* Izoh qoldirish oynasi */
    function openReview() {
      var rName = UI.field({ label: 'Ismingiz', id: 'rev-name', required: true, placeholder: 'Masalan: Zubayr' });
      var rAbout = UI.field({
        label: 'Qaysi guruhdasiz (ixtiyoriy)', id: 'rev-about',
        placeholder: 'Masalan: B1 guruhi'
      });
      var rText = UI.field({
        label: 'Izohingiz', id: 'rev-text', type: 'textarea', required: true,
        placeholder: 'Darslar qanday o’tyapti, nima yoqdi?'
      });
      var pick = 5;
      var starBox = h('div', { class: 'rev-pick' });
      function paintPick() {
        UI.clear(starBox);
        for (var i = 1; i <= 5; i++) {
          (function (n) {
            starBox.appendChild(h('button', {
              class: 'rev-pick-b' + (n <= pick ? ' on' : ''), type: 'button',
              'aria-label': n + ' yulduz',
              onclick: function () { pick = n; paintPick(); }
            }, '★'));
          })(i);
        }
      }
      paintPick();
      var rErr = h('div', { class: 'err-msg', hidden: true });
      UI.modal({
        title: 'Izoh qoldirish',
        body: [
          h('p', { class: 'form-note' },
            'Izohingiz markaz ko’rib chiqqandan keyin saytda chiqadi.'),
          rName.wrap, rAbout.wrap,
          h('div', { class: 'field' }, [h('label', {}, 'Bahoyingiz'), starBox]),
          rText.wrap, rErr
        ],
        actions: [
          { label: 'Bekor qilish' },
          {
            label: 'Yuborish', cls: 'primary gold', onClick: function (close, btn) {
              var nm = rName.input.value.trim(), tx = rText.input.value.trim();
              rErr.hidden = true;
              if (nm.length < 2) { rErr.hidden = false; rErr.textContent = 'Ismingizni yozing.'; return; }
              if (tx.length < 10) { rErr.hidden = false; rErr.textContent = 'Izohni biroz to’liqroq yozing.'; return; }
              UI.busy(btn, async function () {
                try {
                  await D.api('POST', 'api/review', {
                    name: nm, text: tx, rating: pick, about: rAbout.input.value.trim()
                  });
                  close();
                  UI.toast('Rahmat! Izohingiz markazga yuborildi.', 'ok');
                } catch (ex) {
                  rErr.hidden = false;
                  rErr.textContent = ex.message || 'Yuborilmadi. Birozdan keyin urinib ko’ring.';
                }
              });
            }
          }
        ]
      });
    }

    /* --- Ishonch qatori --- */
    function paintProof(txt) {
      var el = document.getElementById('hero-proof');
      if (!el) return;
      el.hidden = !txt;
      setText('hero-proof-text', txt || '');
    }

    /* --- Darajalar: A1…C2 --- */
    var LVL_ICO = { A1: 'layers', A2: 'chat', B1: 'users', B2: 'task', C1: 'award', C2: 'edit' };
    function paintLevels(list) {
      UI.clear(lvlGrid);
      if (!list.length) {
        lvlGrid.appendChild(h('p', { class: 'muted' }, 'Darajalar ro’yxati tez orada.'));
        return;
      }
      list.slice(0, 6).forEach(function (l) {
        lvlGrid.appendChild(h('button', {
          class: 'lvl', type: 'button',
          onclick: function () { pickLevel(l.code, l.name); }
        }, [
          h('span', { class: 'lvl-top' }, [
            h('span', { class: 'lvl-ico' }, UI.icon(LVL_ICO[l.code] || 'layers')),
            h('span', { class: 'lvl-code' }, l.code)
          ]),
          h('b', {}, l.name),
          h('p', {}, l.about),
          h('span', { class: 'lvl-go' }, [h('span', {}, 'Shu darajadan boshlash'), goIcon()])
        ]));
      });
    }

    /* Uzun izohni so'z o'rtasidan kesmaymiz */
    function shortNote(v, max) {
      var t = String(v || '').replace(/[;\n]+/g, ' · ').trim();
      if (t.length <= max) return t;
      var cut = t.slice(0, max);
      var sp = cut.lastIndexOf(' ');
      return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[·,\s]+$/, '') + '…';
    }

    /* --- Bitta narx --- */
    function paintPrice(list) {
      UI.clear(priceBox);
      if (!list.length) {
        priceBox.appendChild(h('p', { class: 'muted' },
          'Narx haqida ma’lumot tez orada. Ariza qoldiring — o’zimiz bog’lanamiz.'));
        return;
      }
      /* Markaz narxni bitta kursga yozadi. Bir nechta bo'lsa, birinchisi
         asosiy narx, qolganlari pastda alohida taklif bo'lib turadi.    */
      var main = list[0];
      var lines = String(main.note || '').split(/[;\n]/)
        .map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 6);
      priceBox.appendChild(h('div', { class: 'price-card' }, [
        h('div', { class: 'price-left' }, [
          h('div', { class: 'sec-eyebrow' }, 'Oylik to’lov'),
          h('h2', {}, main.name),
          main.fee
            ? h('div', { class: 'price-big' }, [
              h('b', {}, A.som(main.fee)), h('span', {}, 'so’m / oy')
            ])
            : h('p', { class: 'price-ask' }, 'Narxni telefon orqali aytamiz'),
          h('p', { class: 'price-note' },
            'Narx daraja bilan o’zgarmaydi — A1 ham, C2 ham bir xil.'),
          h('button', {
            class: 'btn gold lg', type: 'button',
            onclick: function () {
              leadCourse = main.id;
              scrollTo('ariza');
              if (fName.input) fName.input.focus();
            }
          }, ['Guruhga yozilish', goIcon()])
        ]),
        lines.length
          ? h('ul', { class: 'price-list' }, lines.map(function (x) {
            return h('li', {}, [UI.icon('check'), h('span', {}, x)]);
          }))
          : null
      ].filter(Boolean)));

      /* Qo'shimcha tarif yo'q: narx bitta. Markaz ERP'ga ikkinchi
         yo'nalish qo'shsa ham, sayt asosiy narxni ko'rsatadi — chalkash
         tariflar ro'yxati chiqmaydi.                                    */
    }

    function setLeadCourse(list) {
      /* Ariza qaysi kursga tegishli ekani baribir kerak (ERP shunga
         qarab guruh taklif qiladi), lekin buni odam emas — dastur
         tanlaydi.                                                       */
      leadCourse = list.length ? list[0].id : '';
    }

    function paintTimePick(start, end, minutes, brk, times) {
      if (!fTime.input) return;
      UI.clear(fTime.input);
      fTime.input.appendChild(h('option', { value: '' }, 'Farqi yo’q'));
      var own = times && times.length ? A.lessonTimesFrom(times, minutes) : null;
      (own || A.lessonSlots(start, end, minutes, brk)).forEach(function (sl) {
        var t = sl.part + ' (' + sl.from + '–' + sl.to + ')';
        fTime.input.appendChild(h('option', { value: t }, t));
      });
    }

    function paintFaq(list) {
      if (!list.length) { faq.hidden = true; return; }
      faq.hidden = false;
      UI.clear(faqBox);
      list.forEach(function (row, i) {
        var body = h('div', { class: 'faq-a' }, h('p', {}, row.a));
        var head = h('button', { class: 'faq-q', type: 'button', 'aria-expanded': 'false' }, [
          h('span', {}, row.q), h('span', { class: 'faq-ico', 'aria-hidden': 'true' })
        ]);
        var item = h('div', { class: 'faq-item' }, [head, body]);
        head.addEventListener('click', function () {
          var open = item.classList.toggle('open');
          head.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        if (i === 0) { item.classList.add('open'); head.setAttribute('aria-expanded', 'true'); }
        faqBox.appendChild(item);
      });
    }

    function paintTeachers(list) {
      UI.clear(teachBox);
      /* Hamma ustoz bitta qatorda tursin: ustunlar soni ro'yxatga qarab
         beriladi (ko'pi bilan 5 ta). Tor ekranda CSS o'zi buzib tashlaydi. */
      teachBox.style.setProperty('--cols', String(Math.min(5, Math.max(1, list.length))));
      if (!list.length) {
        teachBox.appendChild(h('p', { class: 'muted' }, 'Ustozlar ro’yxati tez orada.'));
        return;
      }
      list.forEach(function (t) {
        teachBox.appendChild(A.teacherCard(t, function (x) { openTeacher(x, list); }));
      });
    }

    function openTeacher(t, list) {
      location.hash = 'ustoz?id=' + encodeURIComponent(t.id);
      renderTeacher(t, list);
    }

    function paintSlots(start, end, minutes, brk, times) {
      UI.clear(slotBox);
      var lead = document.getElementById('slot-lead');
      var gap = brk == null ? 30 : Number(brk) || 0;
      var own = times && times.length ? A.lessonTimesFrom(times, minutes) : null;
      if (lead) {
        var uz = Math.floor(minutes / 60) + ' soat' +
          (minutes % 60 ? ' ' + (minutes % 60) + ' daqiqa' : '');
        lead.textContent = 'Har bir dars ' + uz +
          (gap && !own ? ', darslar orasida ' + gap + ' daqiqa tanaffus.' : '.');
      }
      (own || A.lessonSlots(start, end, minutes, brk)).forEach(function (sl) {
        slotBox.appendChild(h('div', { class: 'slot' }, [
          h('b', {}, sl.from + '–' + sl.to),
          h('span', { class: 'small muted' }, sl.part)
        ]));
      });
    }

    function sendLead() {
      err.hidden = true;
      var name2 = fName.input.value.trim();
      var phone = fPhone.input.value.trim();
      if (name2.length < 2) { err.hidden = false; err.textContent = 'Ismingizni yozing.'; return; }
      if (A.phoneDigits(phone).length < 9) { err.hidden = false; err.textContent = 'Telefon raqamni to’liq yozing.'; return; }
      UI.busy(btn, async function () {
        try {
          var r = await D.api('POST', 'api/lead', {
            name: name2, phone: phone,
            courseId: leadCourse,
            startLevel: lvlPick,
            wantTime: fTime.input ? fTime.input.value : '',
            region: fRegion.input ? fRegion.input.value : '',
            src: A.siteSrc(),
            note: ''
          });
          form.hidden = true;
          okBox.hidden = false;
          UI.clear(okBox);
          okBox.appendChild(h('div', { class: 'lead-ok-in' }, [
            h('div', { class: 'ok-ico' }, UI.icon('check')),
            h('b', {}, r && r.duplicate ? 'Arizangiz allaqachon qabul qilingan' : 'Arizangiz qabul qilindi!'),
            h('p', {}, 'Administratorimiz tez orada shu raqamga qo’ng’iroq qiladi.'),
            h('button', {
              class: 'btn sm', type: 'button', onclick: function () {
                form.hidden = false; okBox.hidden = true;
                fName.input.value = ''; fPhone.input.value = '';
                lvlPick = '';
                clearPill();
                Array.prototype.forEach.call(lvlBox.children, function (x) { x.classList.remove('on'); });
              }
            }, 'Yana ariza qoldirish')
          ]));
        } catch (ex) {
          err.hidden = false;
          err.textContent = ex.message || 'Yuborilmadi. Birozdan keyin urinib ko’ring.';
        }
      });
    }
  }
  A.renderLanding = renderLanding;

  /* Reklama belgisi: saytga ?src=reels1 yoki utm_campaign bilan kelinsa,
     shu belgi arizaga va bot havolasiga qo'shiladi — qaysi reklama
     ishlaganini Murojaatlar hisobotida ko'rasiz.                        */
  A.siteSrc = function () {
    var v = '';
    try {
      var q = new URLSearchParams(location.search);
      v = q.get('src') || q.get('utm_campaign') || q.get('utm_source') || '';
      v = String(v).replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 40);
      if (v) sessionStorage.setItem('site_src', v);
      else v = sessionStorage.getItem('site_src') || '';
    } catch (e) { }
    return v;
  };

  /* ---------- Ustozlar: umumiy yordamchilar ---------- */

  /** Rasm bo'lsa rasm, bo'lmasa ism harflaridan chiroyli avatar */
  A.teacherAvatar = function (t, size) {
    var box = h('span', { class: 'tch-ava', style: 'width:' + size + 'px;height:' + size + 'px' });
    var ini = String(t.name || '?').replace(/ustoz/i, '').trim()
      .split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    box.appendChild(h('span', { class: 'tch-ini' }, ini || '?'));
    var img = h('img', { alt: t.name || '', loading: 'lazy', src: '/api/photo?id=' + encodeURIComponent(t.id) });
    img.addEventListener('error', function () { img.remove(); });   // rasm yo'q — harflar qoladi
    box.appendChild(img);
    return box;
  };

  /** Ustoz kartasi — BITTA joyda tuziladi.
      Ilgari bosh sahifada va ustoz sahifasidagi "Boshqa ustozlar" da
      ikki xil tuzilma bor edi; CSS esa faqat bosh sahifanikiga
      moslangan, shuning uchun ikkinchisi buzilib ko'rinardi
      (rasm chetga chiqib, yozuv kartadan oshib ketardi).            */
  A.teacherCard = function (t, onOpen) {
    var facts = [];
    if (t.country) facts.push(t.country + 'dan');
    if (t.years) facts.push(t.years + ' yil tajriba');
    if (t.levels) facts.push(t.levels);
    /* Kartada erkak/ayol guruhi YOZILMAYDI — markaz rahbari shunday
       so'ragan. U faqat ustozning o'z sahifasida ko'rinadi.          */
    return h('button', { class: 'tch-card', type: 'button', onclick: function () { onOpen(t); } }, [
      h('span', { class: 'tch-photo' }, [
        A.teacherAvatar(t, 120),
        t.tag ? h('span', { class: 'tch-ribbon' }, t.tag) : null
      ].filter(Boolean)),
      h('b', {}, t.name),
      facts.length ? h('ul', { class: 'tch-facts-mini' }, facts.map(function (x) {
        return h('li', {}, x);
      })) : null,
      t.bio ? h('p', { class: 'tch-bio' }, String(t.bio).slice(0, 150)) : null,
      h('span', { class: 'tch-go' }, [h('span', {}, 'Batafsil'), goIcon()])
    ].filter(Boolean));
  };

  A.audienceLabel = function (a) {
    return {
      erkaklar: 'Erkaklar guruhlari',
      ayollar: 'Ayollar guruhlari',
      ikkalasi: 'Erkak va ayol guruhlari'
    }[a] || '';
  };

  /** Ish vaqtini dars oralig'lariga bo'lish: 08:00–22:00, 90 daqiqadan */
  /** Dars vaqtlari. `breakMin` — har darsdan keyingi tanaffus (daqiqa).
      Markaz Sozlamada yozadi; yozmagan bo'lsa 30 daqiqa.               */
  /** Markaz qo'lda yozgan vaqtlarni o'qiydi: "08:30–10:00" yoki "08:30".
      Tugash vaqti yozilmagan bo'lsa dars uzunligiga qarab hisoblanadi. */
  A.lessonTimesFrom = function (list, minutes) {
    function toMin(v) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '').trim());
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }
    function toStr(x) {
      var hh = Math.floor(x / 60) % 24, mm = x % 60;
      return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    }
    var len = Number(minutes) || 90;
    return (list || []).map(function (row) {
      var p = String(row).split('–');
      var a = toMin(p[0]);
      if (a == null) return null;
      var b = p.length > 1 ? toMin(p[1]) : null;
      if (b == null) b = a + len;
      return {
        from: toStr(a), to: toStr(b),
        part: a < 12 * 60 ? 'ertalabki' : (a < 17 * 60 ? 'kunduzgi' : 'kechki')
      };
    }).filter(Boolean).slice(0, 12);
  };

  A.lessonSlots = function (start, end, minutes, breakMin) {
    function toMin(v) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ''));
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }
    function toStr(x) {
      var hh = Math.floor(x / 60), mm = x % 60;
      return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    }
    var a = toMin(start), b = toMin(end), len = Number(minutes) || 90;
    var gap = breakMin == null ? 30 : Math.max(0, Number(breakMin) || 0);
    if (a == null || b == null || b <= a || len < 15) return [];
    var out = [];
    for (var t = a; t + len <= b && out.length < 12; t += len + gap) {
      out.push({
        from: toStr(t), to: toStr(t + len),
        part: t < 12 * 60 ? 'ertalabki' : (t < 17 * 60 ? 'kunduzgi' : 'kechki')
      });
    }
    return out;
  };

  /* ---------- Ustoz profili (ochiq sahifa) ---------- */
  function renderTeacher(t, list) {
    hidePreRender();
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = true;
    var wrap = document.getElementById('auth');
    wrap.hidden = false;
    wrap.className = 'site';
    UI.clear(wrap);
    wrap.appendChild(siteBackdrop());

    var box = h('div', { class: 'site-wrap' });
    wrap.appendChild(box);
    window.scrollTo(0, 0);

    box.appendChild(h('header', { class: 'site-top' }, [
      h('button', {
        class: 'btn sm ghost', type: 'button',
        onclick: function () { location.hash = ''; renderLanding(); }
      }, [UI.icon('back'), 'Orqaga']),
      h('div', { class: 'site-brand', style: 'margin-inline-start:auto' }, [
        h('img', { class: 'logo', src: LOGO, alt: '' }),
        h('div', {}, [h('b', {}, centerNameNow()), h('span', {}, 'Arab tili o’quv markazi')])
      ])
    ]));

    if (!t) {
      box.appendChild(UI.empty({
        title: 'Ustoz topilmadi',
        text: 'Bu profil o’chirilgan bo’lishi mumkin.',
        action: { label: 'Bosh sahifa', onClick: function () { location.hash = ''; renderLanding(); } }
      }));
      return;
    }

    var more = (list || []).filter(function (x) { return x && x.id !== t.id; });
    var pubT = (A._pub && A._pub.lessonTimes) || [];
    var slots = pubT.length
      ? A.lessonTimesFrom(pubT, (A._pub && A._pub.lessonMinutes) || 90)
      : A.lessonSlots(A._pub && A._pub.workStart || '08:00',
        A._pub && A._pub.workEnd || '22:00', (A._pub && A._pub.lessonMinutes) || 90,
        A._pub && A._pub.breakMinutes);

    box.appendChild(h('section', { class: 'tch-page' }, [
      h('div', { class: 'tch-hero' }, [
        A.teacherAvatar(t, 168),
        h('div', {}, [
          h('span', { class: 'hero-eyebrow' }, t.tag || 'Ustoz'),
          h('h1', {}, t.name),
          h('p', { class: 'hero-lead' }, t.bio ||
            'Markazimizda arab tilidan dars beradi.'),
          h('div', { class: 'tch-facts' }, [
            t.country ? fact('home', 'Davlat', t.country) : null,
            t.levels ? fact('chart', 'Darajalar', t.levels) : null,
            t.years ? fact('history', 'Tajriba', t.years + ' yil') : null,
            t.audience ? fact('users', 'Guruhlar', A.audienceLabel(t.audience)) : null
          ].filter(Boolean)),
          h('button', {
            class: 'btn primary lg', type: 'button',
            onclick: function () {
              location.hash = '';
              renderLanding();
              setTimeout(function () {
                var el = document.getElementById('ariza');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                var note = document.getElementById('lead-note');
                if (note && !note.value) note.value = t.name + ' guruhiga yozilmoqchiman.';
              }, 60);
            }
          }, 'Shu ustozga yozilish')
        ])
      ]),
      h('div', { class: 'tch-times' }, [
        h('h3', {}, 'Dars vaqtlari'),
        slots.length
          ? h('div', { class: 'slot-grid' }, slots.map(function (sl) {
            return h('div', { class: 'slot' }, [
              h('b', {}, sl.from + '–' + sl.to),
              h('span', { class: 'small muted' }, sl.part)
            ]);
          }))
          /* Bo'lim boshi ko'rinib, osti bo'm-bo'sh qolmasin */
          : h('p', { class: 'muted' }, 'Dars vaqtlari tez orada e’lon qilinadi. ' +
            'Qulay vaqtni arizada yozib qoldiring — biz aniqlashtiramiz.'),
        h('p', { class: 'small muted tch-note' },
          'Vaqtlar guruhga qarab belgilanadi. Aniq jadval yozilgandan keyin ' +
          'yangilanadi.')
      ]),
      more.length ? h('div', { class: 'tch-more' }, [
        h('h3', {}, 'Boshqa ustozlar'),
        h('div', { class: 'tch-grid', style: '--cols:' + Math.min(5, Math.max(1, more.length)) },
          more.map(function (x) {
            return A.teacherCard(x, function (y) {
              location.hash = 'ustoz?id=' + encodeURIComponent(y.id);
              renderTeacher(y, list);
            });
          }))
      ]) : null
    ].filter(Boolean)));

    function fact(icon, label, value) {
      return h('div', { class: 'tch-fact' }, [
        UI.icon(icon), h('div', {}, [h('span', {}, label), h('b', {}, value)])
      ]);
    }
  }

  /** Manzildagi #ustoz?id=... bo'yicha profilni ochish */
  async function renderTeacherFromHash() {
    var m = /[?&]id=([^&]+)/.exec(String(location.hash || ''));
    var id = m ? decodeURIComponent(m[1]) : '';
    var d = await publicInfo();
    var list = (d && d.teachers) || [];
    var t = list.filter(function (x) { return x.id === id; })[0] || null;
    renderTeacher(t, list);
  }
  A.renderTeacherFromHash = renderTeacherFromHash;


  /* ---------- Til tanlash ---------- */
  function renderLangPick() {
    var box = document.getElementById('lang-pick');
    if (!box) return;
    UI.clear(box);
    A.I18N.langs.forEach(function (l) {
      box.appendChild(h('button', {
        type: 'button', 'aria-pressed': A.I18N.lang === l.id ? 'true' : 'false',
        title: l.label, 'aria-label': l.label,
        onclick: function () {
          A.I18N.set(l.id);
          renderLangPick();
          if (App.user) App.render(); else renderLogin(null);
        }
      }, l.short));
    });
  }
  A.renderLangPick = renderLangPick;

  var restPromise = null;

  function busyIndicator(n) {
    var pill = document.getElementById('mode-pill');
    if (!pill) return;
    if (n > 0) { pill.hidden = false; pill.textContent = 'Saqlanmoqda…'; pill.className = 'pill warn'; }
    else if (D.mode === 'local') { pill.hidden = false; pill.textContent = 'Faqat shu brauzerda'; pill.className = 'pill mute'; }
    else { pill.hidden = true; }
  }

  async function startSession(user) {
    App.user = user;
    try { sessionStorage.setItem('albyana_session', user.id); } catch (e) { }
    if (restPromise) {
      document.getElementById('auth').hidden = true;
      try { await restPromise; } catch (e) { console.error(e); }
      restPromise = null;
    }
    hidePreRender();
    document.getElementById('auth').hidden = true;
    document.getElementById('boot').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('me-name').textContent = user.name;
    document.getElementById('me-role').textContent = A.ROLES[user.role] || user.role;
    document.getElementById('me-avatar').textContent =
      (user.name || '?').trim().split(/\s+/).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase();
    document.getElementById('center-name').textContent = (D.settings && D.settings.centerName) || 'Arab tili markazi';
    var mp = document.getElementById('mode-pill');
    if (D.mode === 'local') { mp.hidden = false; mp.textContent = 'Faqat shu brauzerda'; }
    // sahifa yangilanganda oxirgi ochilgan bo'limga qaytamiz
    var saved = hashToRoute();
    if (saved && App.can((NAV.filter(function (n) { return n.id === saved.name; })[0] || { perm: 'nav.dashboard' }).perm)) {
      App.route = saved;
      App.render();
    } else {
      var first = allowedNav()[0];
      App.go(first ? first.id : 'dashboard');
    }
  }

  function logout() {
    try { sessionStorage.removeItem('albyana_session'); } catch (e) { }
    if (D.mode === 'server') { D.serverLogout(); }
    App.user = null;
    document.getElementById('app').hidden = true;
    renderLogin(null);
  }

  /* ---------- Tezkor qidiruv ---------- */
  function searchAll(q) {
    if (!q) return [];
    var needle = q.toLowerCase();
    var digits = A.phoneDigits(q);
    var out = [];

    function hit(hay) {
      return String(hay || '').toLowerCase().indexOf(needle) >= 0;
    }
    function phoneHit(p) {
      return digits.length >= 3 && A.phoneDigits(p).indexOf(digits) >= 0;
    }

    if (App.can('student.view')) {
      var students = D.all('students');
      if (App.user.role === 'oqituvchi') {
        var mine = {};
        A.scopeGroups(App.user, D.all('groups')).forEach(function (g) {
          A.Q.membersOf(g.id).forEach(function (m) { mine[m.studentId] = 1; });
        });
        students = students.filter(function (s) { return mine[s.id]; });
      }
      students.forEach(function (s) {
        var full = s.lastName + ' ' + s.firstName;
        var codeHit = /^\d{4}$/.test(q.trim()) && String(s.code || '') === q.trim();
        if (codeHit || hit(full) || hit(s.firstName) || hit(s.lastName) || hit(s.parentName) ||
          phoneHit(s.phone) || phoneHit(s.parentPhone)) {
          var groups = A.Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; })
            .map(function (m) { return A.groupLabel(D.one('groups', m.groupId)); }).join(', ');
          out.push({
            group: 'O’quvchilar', title: full,
            sub: (s.phone || s.parentPhone || '') + (groups ? ' · ' + groups : ''),
            icon: UI.avatar(full),
            badge: s.status !== 'faol'
              ? UI.pill(s.status === 'arxiv' ? 'Arxiv' : 'To’xtatgan', 'mute')
              : (s.code ? h('span', { class: 'code-chip' }, String(s.code)) : null),
            onPick: function () { App.go('student', { id: s.id }); }
          });
        }
      });
    }

    if (App.can('group.view')) {
      A.scopeGroups(App.user, D.all('groups')).forEach(function (g) {
        if (hit(g.name) || hit(g.code) || hit(A.Q.courseName(g.courseId)) || hit(A.Q.staffName(g.teacherId))) {
          out.push({
            group: 'Guruhlar', title: A.groupLabel(g),
            sub: A.Q.courseName(g.courseId) + ' · ' + A.Q.staffName(g.teacherId) +
              ' · ' + A.Q.membersOf(g.id).length + ' o’quvchi',
            onPick: function () { App.go('group', { id: g.id }); }
          });
        }
      });
    }

    if (App.can('nav.leads')) {
      D.all('leads').forEach(function (l) {
        if (hit(l.name) || phoneHit(l.phone)) {
          out.push({
            group: 'Murojaatlar', title: l.name, sub: (l.phone || '') + ' · ' + A.stageLabel(l.stage),
            onPick: function () { App.go('leads', { q: l.name }); A.leadForm(l, App); }
          });
        }
      });
    }

    if (App.can('staff.view') || App.can('nav.staff')) {
      D.all('staff').forEach(function (s) {
        if (hit(s.name) || phoneHit(s.phone)) {
          out.push({
            group: 'Xodimlar', title: s.name, sub: (s.position || '') + ' · ' + (s.phone || ''),
            onPick: function () { App.go('staff'); }
          });
        }
      });
    }

    // eng mos keladiganlar yuqorida: nom boshidan mos kelganlar oldin
    out.sort(function (a, b) {
      var ai = a.title.toLowerCase().indexOf(needle), bi = b.title.toLowerCase().indexOf(needle);
      if (ai < 0) ai = 99; if (bi < 0) bi = 99;
      return ai - bi;
    });
    return out;
  }
  App.searchAll = searchAll;

  function wireSearch() {
    var input = document.getElementById('global-search');
    UI.suggest(input, searchAll, {
      limit: 20,
      emptyText: 'Hech narsa topilmadi'
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var q = input.value.trim();
        if (q && App.can('student.view')) App.go('students', { q: q });
      }
    });
  }

  /* ---------- Mavzu ---------- */
  /* Yorug'dan qorong'iga va aksincha. Telefondagi menyu ham shuni chaqiradi. */
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var isDark = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('albyana_theme', next); } catch (e) { }
  }
  A.toggleTheme = toggleTheme;

  function wireTheme() {
    var btn = document.getElementById('theme-toggle');
    var saved = null;
    try { saved = localStorage.getItem('albyana_theme'); } catch (e) { }
    /* Standart — oq (yorug') panel; "Tizim bo'yicha" faqat o'zi tanlansa */
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    else if (saved === null) document.documentElement.setAttribute('data-theme', 'light');
    if (btn) btn.addEventListener('click', toggleTheme);
  }

  var LOGO = '';

  /** #kabinet?kod=4077 ko'rinishidagi havoladan kodni olish */
  function kabinetCodeFromHash() {
    var m = String(location.hash || '').match(/[?&](kod|code)=(\d{4})/);
    return m ? m[2] : '';
  }

  /* ---------- Ishga tushirish ---------- */
  async function boot() {
    LOGO = document.querySelector('#boot img').getAttribute('src');
    A.LOGO = LOGO;
    wireTheme();
    A.I18N.init();
    A.I18N.observe();
    renderLangPick();
    A.I18N.apply(document.body);
    window.addEventListener('hashchange', onHashChange);
    if (A.PWA) { try { A.PWA.start(); } catch (e) { console.warn(e); } }
    window.addEventListener('beforeunload', function (e) {
      if (UI.hasUnsaved && UI.hasUnsaved()) { e.preventDefault(); e.returnValue = ''; }
    });
    try {
      await D.initAuth();

      if (D.mode === 'server') {
        wireSearch();
        document.getElementById('logout').addEventListener('click', logout);
        D.onBusy = busyIndicator;
        if (D.currentServerUser) {
          try {
            await D.loadBootstrap();
            await startSession(D.currentServerUser);
            return;
          } catch (e) { console.error(e); }
        }
        var where = String(location.hash || '').replace('#', '').split('?')[0];
        if (where === 'kabinet') { renderKabinet(kabinetCodeFromHash()); return; }
        if (where === 'kurs') { openCourse(); return; }
        if (where === 'test' || where === 'daraja') { renderTest(); return; }
        if (where === 'ustoz') { renderTeacherFromHash(); return; }
        if (where === 'kirish' || where === 'login') { renderLogin(null); return; }
        renderLanding();                 // saytning ochiq sahifasi
        return;
      }

      if (!D.settings || D.all('users').length === 0) {
        // birinchi ishga tushirish — hammasi kerak
        await D.initRest();
        await A.Fin.migrate();
        await A.Seed.bootstrap();
      } else {
        // kirish darhol ko'rsatiladi, qolgani fonda yuklanadi
        restPromise = (async function () {
          await D.initRest();
          await A.Fin.migrate();
        })();
      }
      wireSearch();
      document.getElementById('logout').addEventListener('click', logout);
      D.onBusy = busyIndicator;
      D.onChange(function () { /* mahalliy keshni yangilash — sahifa o'zi qayta chiziladi */ });

      var sid = null;
      try { sid = sessionStorage.getItem('albyana_session'); } catch (e) { }
      var u = sid ? D.one('users', sid) : null;
      var whereL = String(location.hash || '').replace('#', '').split('?')[0];
      if (whereL === 'kurs') { openCourse(); return; }
      if (whereL === 'kabinet') { renderKabinet(); return; }
      /* Namoyish (demo) nusxasi: manzil bo'sh bo'lsa — ochiq sayt, xodimlar kirishi emas */
      if (!whereL && global.MARKAZ_DEMO && !(u && u.active !== false)) { renderLanding(); return; }
      if (u && u.active !== false) startSession(u);
      else renderLogin(null);
    } catch (e) {
      console.error(e);
      hidePreRender();
      var boot = document.getElementById('boot');
      boot.hidden = false;
      UI.clear(boot);
      boot.appendChild(h('div', { class: 'login' }, [
        h('h1', {}, 'Tizimni ochib bo’lmadi'),
        h('p', { class: 'sub' }, e.message || String(e)),
        h('button', { class: 'btn primary', onclick: function () { location.reload(); } }, 'Qayta urinish')
      ]));
    }
  }

  global.A.App = App;
  global.A.NAV = NAV;
  global.A.hashPass = hashPass;
  global.A.logout = logout;
  global.A.getLogo = function () { return LOGO; };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
