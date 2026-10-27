/* Albyana ERP — Bosh sahifa, Murojaatlar, O'quvchilar */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  A.Pages = A.Pages || {};

  /* ================= Umumiy so'rovlar ================= */
  var Q = {
    student: function (id) { return D.one('students', id); },
    studentName: function (id) {
      var s = D.one('students', id);
      return s ? (s.lastName + ' ' + s.firstName) : '—';
    },
    groupName: function (id) { var g = D.one('groups', id); return g ? g.name : '—'; },
    groupLabel: function (id) { return A.groupLabel(D.one('groups', id)); },
    groupByCode: function (code) {
      var c = String(code || '').trim().toUpperCase();
      return D.all('groups').filter(function (g) { return String(g.code || '').toUpperCase() === c; })[0] || null;
    },
    courseName: function (id) { var c = D.one('courses', id); return c ? c.name : '—'; },
    staffName: function (id) { var s = D.one('staff', id); return s ? s.name : '—'; },
    ownerName: function (id) { var u = id && D.one('users', id); if (u) return u.name; var s = id && D.one('staff', id); return s ? s.name : '—'; },
    roomName: function (id) { var r = D.one('rooms', id); return r ? r.name : '—'; },
    membershipsOf: function (studentId) {
      return D.all('memberships').filter(function (m) { return m.studentId === studentId; });
    },
    membersOf: function (groupId) {
      return Q._memIndex()[groupId] || [];
    },
    /* Balans va muddati o'tgan qarz — BITTA o'tishda hisoblanadi.

       Ilgari har bir qator uchun A.balanceOf chaqirilardi, u esa har
       safar BARCHA hisob va to'lovlarni boshidan oxirigacha o'qirdi.
       400 o'quvchili ro'yxatda bu 9000 ta yozuvni 400 marta o'qish
       degani edi — telefonda ro'yxat bir necha soniya "qotib" turardi.

       Endi natija bitta o'tishda tayyorlanadi va shu CHIZISH davomida
       saqlanadi. Har chizishdan oldin tozalanadi (App.render), shuning
       uchun to'lov yozilgach yoki bekor qilingach raqam darhol yangi
       bo'ladi — eski qiymat ekranda qolib ketmaydi.                  */
    _bal: null,
    _gdebt: null,
    _mem: null,
    resetCache: function () { Q._bal = null; Q._gdebt = null; Q._mem = null; },

    /* Guruhlar bo'yicha qarz — bitta o'tishda.
       Ilgari har bir guruh kartasi uchun BARCHA to'lovlardan xarita
       qurilib, BARCHA hisoblar filtrlanardi. 40 guruh × 9000 yozuv
       "Guruhlar" ro'yxatini sezilarli sekinlashtirardi.            */
    groupDebts: function () {
      if (Q._gdebt) return Q._gdebt;
      var paid = A.paidByInvoice(A.Fin.allPayments());
      var map = {};
      A.Fin.allInvoices().forEach(function (i) {
        var rem = A.invoiceRemaining(i, paid);
        if (!rem) return;
        map[i.groupId] = (map[i.groupId] || 0) + rem;
      });
      Q._gdebt = map;
      return map;
    },
    groupDebt: function (groupId) { return Q.groupDebts()[groupId] || 0; },

    /* A'zoliklar guruh bo'yicha guruhlab qo'yiladi — har safar
       butun ro'yxatni filtrlamaslik uchun.                        */
    _memIndex: function () {
      if (Q._mem) return Q._mem;
      var map = {};
      D.all('memberships').forEach(function (m) {
        if (m.status !== 'faol') return;
        (map[m.groupId] || (map[m.groupId] = [])).push(m);
      });
      Q._mem = map;
      return map;
    },
    _balMap: function () {
      if (Q._bal) return Q._bal;
      var invoices = A.Fin.allInvoices(), payments = A.Fin.allPayments();
      var today = A.today();
      var paid = A.paidByInvoice(payments);
      var map = {};
      function row(sid) {
        return map[sid] || (map[sid] = {
          charged: 0, received: 0, allocated: 0, debt: 0, advance: 0, overdue: 0
        });
      }
      invoices.forEach(function (i) {
        var r = row(i.studentId);
        r.charged += Math.round(i.final);
        r.overdue += A.invoiceOverdueAmount(i, paid, today);
      });
      A.activePayments(payments).forEach(function (p) {
        var r = row(p.studentId);
        var sign = p.type === 'refund' ? -1 : 1;
        r.received += sign * Math.round(p.amount);
        (p.allocations || []).forEach(function (a) { r.allocated += sign * Math.round(a.amount); });
      });
      Object.keys(map).forEach(function (k) {
        var r = map[k];
        r.debt = Math.max(0, r.charged - r.allocated);
        r.advance = Math.max(0, r.received - r.allocated);
      });
      Q._bal = map;
      return map;
    },
    balance: function (studentId) {
      var r = Q._balMap()[studentId];
      return r ? { charged: r.charged, received: r.received, allocated: r.allocated, debt: r.debt, advance: r.advance }
        : { charged: 0, received: 0, allocated: 0, debt: 0, advance: 0 };
    },
    overdue: function (studentId) {
      var r = Q._balMap()[studentId];
      return r ? r.overdue : 0;
    },
    openInvoices: function (studentId) {
      var paid = A.paidByInvoice(A.Fin.allPayments());
      return A.Fin.allInvoices()
        .filter(function (i) { return i.studentId === studentId; })
        .map(function (i) { return Object.assign({}, i, { remaining: A.invoiceRemaining(i, paid) }); })
        .filter(function (i) { return i.remaining > 0; })
        .sort(function (a, b) { return String(a.month).localeCompare(String(b.month)); });
    },
    activeGroups: function (user) {
      return A.scopeGroups(user, D.all('groups').filter(function (g) { return g.status !== 'yakunlangan'; }));
    },
    /** Berilgan kundagi barcha darslar */
    lessonsOn: function (dateIso, user) {
      var ym = A.ymOf(dateIso);
      var out = [];
      Q.activeGroups(user).forEach(function (g) {
        var doc = D.lessonsCached(g.id, ym);
        A.monthLessons(g, ym, doc).forEach(function (l) {
          if (l.date === dateIso) out.push(l);
        });
      });
      return A.sortBy(out, 'start');
    },
    async ensureLessonMonth(ym, user) {
      var gs = Q.activeGroups(user);
      for (var i = 0; i < gs.length; i++) { await D.loadLessons(gs[i].id, ym); }
    },
    /**
     * Hamma o'quvchining hisobini BITTA o'tishda hisoblash.
     * Har bir qator uchun alohida hisoblasak, 1000 o'quvchida sahifa sekinlashadi.
     */
    balanceMap: function () {
      var map = {};
      function rec(id) {
        return map[id] || (map[id] = { charged: 0, received: 0, allocated: 0, debt: 0, advance: 0, overdue: 0 });
      }
      var today = A.today();
      var paid = A.paidByInvoice(A.Fin.allPayments());
      A.Fin.allInvoices().forEach(function (i) {
        var r = rec(i.studentId);
        r.charged += Math.round(i.final);
        r.overdue += A.invoiceOverdueAmount(i, paid, today);
      });
      A.activePayments(A.Fin.allPayments()).forEach(function (p) {
        var r = rec(p.studentId);
        var sign = p.type === 'refund' ? -1 : 1;
        r.received += sign * Math.round(p.amount);
        (p.allocations || []).forEach(function (a) { r.allocated += sign * Math.round(a.amount); });
      });
      Object.keys(map).forEach(function (id) {
        var r = map[id];
        r.debt = Math.max(0, r.charged - r.allocated);
        r.advance = Math.max(0, r.received - r.allocated);
        r.overdue = Math.max(0, Math.min(r.overdue, r.debt));
      });
      return map;
    },

    debtors: function () {
      var invoices = A.Fin.allInvoices(), payments = A.Fin.allPayments();
      var paid = A.paidByInvoice(payments);
      var byStudent = {};
      invoices.forEach(function (inv) {
        var rem = A.invoiceRemaining(inv, paid);
        if (rem <= 0) return;
        var s = byStudent[inv.studentId] || (byStudent[inv.studentId] = { studentId: inv.studentId, debt: 0, overdue: 0, months: [] });
        s.debt += rem;
        s.overdue += A.invoiceOverdueAmount(inv, paid, A.today());
        s.months.push(inv.month);
      });
      /* Qarzdor — faqat TO'LOV KUNI O'TIB KETGAN, to'lanmagan summa bo'lsa.
         Yangi qo'shilgan yoki to'lov kuni hali kelmagan o'quvchi qarzdor
         emas — u "to'lov kutilmoqda" holatida turadi. */
      return Object.keys(byStudent).map(function (k) { return byStudent[k]; })
        .filter(function (x) {
          var st = D.one('students', x.studentId);
          return st && st.status !== 'arxiv' && x.overdue > 0;
        });
    },
    /** To'lov kuni hali kelmagan (yoki bugun) ochiq hisoblar — qarz emas */
    pendingPayers: function () {
      var paid = A.paidByInvoice(A.Fin.allPayments()), today = A.today(), by = {};
      A.Fin.allInvoices().forEach(function (inv) {
        var rem = A.invoiceRemaining(inv, paid);
        if (rem <= 0 || A.invoiceOverdueAmount(inv, paid, today) > 0) return;
        var st = D.one('students', inv.studentId);
        if (!st || st.status === 'arxiv') return;
        var r = by[inv.studentId] || (by[inv.studentId] = { studentId: inv.studentId, amount: 0, dueDate: inv.dueDate });
        r.amount += rem;
        if (inv.dueDate && (!r.dueDate || inv.dueDate < r.dueDate)) r.dueDate = inv.dueDate;
      });
      return Object.keys(by).map(function (k) { return by[k]; });
    }
  };
  A.Q = Q;

  function statusPill(status) {
    if (status === 'faol') return UI.pill('Faol', 'ok');
    if (status === 'toxtatgan') return UI.pill('To’xtatgan', 'warn');
    if (status === 'arxiv') return UI.pill('Arxiv', 'mute');
    return UI.pill(status || '—', 'mute');
  }
  A.statusPill = statusPill;

  function balancePill(b, overdue) {
    if (overdue > 0) return UI.pill('Qarz ' + A.som(overdue), 'bad');
    if (b.debt > 0) return UI.pill('To’lov kutilmoqda ' + A.som(b.debt), 'info');
    if (b.advance > 0) return UI.pill('Avans ' + A.som(b.advance), 'info');
    return UI.pill('Qarzsiz', 'ok');
  }
  A.balancePill = balancePill;


  /**
   * O'qituvchi uchun davomat kartasi — bosh sahifadagi eng birinchi blok.
   * Bugungi har bir dars katta qator: bosilsa shu guruhning davomati ochiladi.
   * Davomat olinmagan eski darslar ham shu yerda eslatib turiladi.
   */
  function teacherAttendanceCard(lessonsToday, ym, today, App) {
    var live = lessonsToday.filter(function (l) { return l.status !== 'bekor'; });

    function row(l, late) {
      var g = D.one('groups', l.groupId);
      var marked = l.attendance && Object.keys(l.attendance).length;
      var members = Q.membersOf(l.groupId).length;
      return h('button', {
        class: 'att-row' + (marked ? ' done' : ''), type: 'button',
        onclick: function () { App.go('attendance', { groupId: l.groupId, date: l.date }); }
      }, [
        h('span', { class: 'att-time mono' }, late ? A.dateLabel(l.date).slice(0, 6) : l.start),
        h('span', { class: 'att-main' }, [
          h('b', {}, g ? g.name : '—'),
          h('span', { class: 'small muted' },
            (late ? A.dateLabel(l.date) + ' · ' : l.start + '–' + l.end + ' · ') +
            members + ' ta o’quvchi' + (Q.roomName(l.roomId) ? ' · ' + Q.roomName(l.roomId) : ''))
        ]),
        marked ? UI.pill('Olingan', 'ok') : h('span', { class: 'btn sm primary' }, 'Davomat olish')
      ]);
    }

    // davomati olinmagan o'tgan darslar (oxirgi 7 kun)
    var late = [];
    Q.activeGroups(App.user).forEach(function (g) {
      var doc = D.lessonsCached(g.id, ym);
      A.monthLessons(g, ym, doc).forEach(function (l) {
        if (l.date >= today || l.status === 'bekor') return;
        if (l.attendance && Object.keys(l.attendance).length) return;
        if (A.addDays(l.date, 7) < today) return;
        late.push(l);
      });
    });
    late.sort(function (a, b) { return b.date.localeCompare(a.date); });

    var body = h('div', { class: 'att-list' });
    if (live.length) {
      live.forEach(function (l) { body.appendChild(row(l, false)); });
    } else {
      body.appendChild(UI.empty({
        title: 'Bugun darsingiz yo’q',
        text: 'Jadvalga qarang yoki davomat bo’limidan boshqa kunni tanlang.',
        action: { label: 'Davomat bo’limi', onClick: function () { App.go('attendance'); } }
      }));
    }
    if (late.length) {
      body.appendChild(h('div', { class: 'att-late' }, [
        h('b', {}, 'Davomati olinmagan darslar'),
        h('div', { class: 'small muted' }, 'Oxirgi 7 kun ichida ' + late.length + ' ta')
      ]));
      late.slice(0, 5).forEach(function (l) { body.appendChild(row(l, true)); });
    }

    return UI.card('Bugungi davomat', body, null, true);
  }

  /* ================= BOSH SAHIFA ================= */
  A.Pages.dashboard = function (view, route, App) {
    var user = App.user;
    var ym = A.thisMonth(), today = A.today();
    view.appendChild(UI.pageHead(
      'Salom, ' + user.name.split(' ')[0] + '!',
      A.dateLabel(today) + ' · ' + (A.ROLES[user.role] || '')
    ));

    // Demo eslatmasi
    if (D.all('students').some(function (s) { return s.demo; }) && App.can('settings.edit')) {
      view.appendChild(h('div', { class: 'banner info' }, [
        h('div', {}, [h('b', {}, 'Namuna ma’lumotlar. '),
        'Tizim ishlashini ko’rsatish uchun demo o’quvchi, guruh va to’lovlar kiritilgan. Haqiqiy ish boshlashdan oldin ularni o’chiring.']),
        h('button', {
          class: 'btn sm', onclick: function () { App.go('settings', { tab: 'data' }); }
        }, 'Sozlamalarga o’tish')
      ]));
    }
    var defUser = D.all('users').some(function (u) { return u.isDefault; });
    if (defUser && user.role === 'direktor') {
      view.appendChild(h('div', { class: 'banner warn' }, [
        h('div', {}, [h('b', {}, 'Xavfsizlik. '), 'Kuchsiz parol ishlatilyapti (qisqa, oddiy yoki hammaga ma’lum). Sozlamalar → Foydalanuvchilar bo’limida kamida 10 belgili, harf va raqamli yangi parol qo’ying.']),
        h('button', { class: 'btn sm', onclick: function () { App.go('settings', { tab: 'users' }); } }, 'Ochish')
      ]));
    }

    var invoices = A.Fin.allInvoices(), payments = A.Fin.allPayments();
    var monthPays = A.activePayments(A.Fin.monthItems('payments', ym));
    var monthIncome = monthPays.reduce(function (s, p) { return s + (p.type === 'refund' ? -1 : 1) * p.amount; }, 0);
    var todayIncome = monthPays.filter(function (p) { return p.date === today; })
      .reduce(function (s, p) { return s + (p.type === 'refund' ? -1 : 1) * p.amount; }, 0);
    var monthExp = A.Fin.monthItems('expenses', ym).filter(function (e) { return !e.voided; })
      .reduce(function (s, e) { return s + e.amount; }, 0);
    var debtors = Q.debtors();
    var overdueTotal = debtors.reduce(function (s, d) { return s + d.overdue; }, 0);
    var activeStudents = D.all('students').filter(function (s) { return s.status === 'faol'; }).length;
    var activeGroups = D.all('groups').filter(function (g) { return g.status === 'faol'; }).length;
    var lessonsToday = Q.lessonsOn(today, user);

    var tiles = h('div', { class: 'tiles' });
    if (user.role === 'direktor' || user.role === 'buxgalter') {
      if (user.role === 'direktor') {
        tiles.appendChild(UI.tile({
          label: 'Faol o’quvchilar', value: activeStudents, hint: D.all('students').length + ' ta jami',
          onClick: function () { App.go('students', { status: 'faol' }); }
        }));
        tiles.appendChild(UI.tile({
          label: 'Faol guruhlar', value: activeGroups, hint: 'Bugun ' + lessonsToday.length + ' dars',
          onClick: function () { App.go('groups', { status: 'faol' }); }
        }));
      }
      tiles.appendChild(UI.tile({
        label: 'Bugungi tushum', value: A.som(todayIncome), hint: 'so’m', cls: 'money',
        onClick: function () { App.go('finance', { tab: 'payments', date: today }); }
      }));
      tiles.appendChild(UI.tile({
        label: A.monthLabel(ym) + ' tushumi', value: A.som(monthIncome), hint: 'so’m', cls: 'money',
        onClick: function () { App.go('finance', { tab: 'payments' }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'Muddati o’tgan qarz', value: A.som(overdueTotal), hint: debtors.filter(function (d) { return d.overdue > 0; }).length + ' ta o’quvchi',
        cls: overdueTotal > 0 ? 'alert' : '',
        onClick: function () { App.go('finance', { tab: 'debts' }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'Shu oydagi xarajat', value: A.som(monthExp), hint: 'so’m',
        onClick: function () { App.go('finance', { tab: 'expenses' }); }
      }));
    } else if (user.role === 'admin') {
      tiles.appendChild(UI.tile({
        label: 'Bugungi darslar', value: lessonsToday.length, hint: 'Jadvalni ochish',
        onClick: function () { App.go('schedule'); }
      }));
      var needCall = D.all('leads').filter(function (l) {
        return l.stage !== 'oquvchi' && l.stage !== 'rad' && (!l.nextContact || l.nextContact <= today);
      });
      tiles.appendChild(UI.tile({
        label: 'Bog’lanish kerak', value: needCall.length, hint: 'murojaat',
        cls: needCall.length ? 'alert' : '',
        onClick: function () { App.go('leads', { due: true }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'To’lov kutilayotganlar', value: debtors.length + Q.pendingPayers().length,
        hint: A.som(debtors.reduce(function (s, d) { return s + d.debt; }, 0) + Q.pendingPayers().reduce(function (s, d) { return s + d.amount; }, 0)) + ' so’m',
        cls: debtors.some(function (d) { return d.overdue > 0; }) ? 'alert' : '',
        onClick: function () { App.go('finance', { tab: 'debts' }); }
      }));
      tiles.appendChild(UI.tile({
        label: 'Faol o’quvchilar', value: activeStudents,
        onClick: function () { App.go('students', { status: 'faol' }); }
      }));
    } else {
      var myGroups = A.scopeGroups(user, D.all('groups'));
      tiles.appendChild(UI.tile({ label: 'Guruhlarim', value: myGroups.length, onClick: function () { App.go('groups'); } }));
      tiles.appendChild(UI.tile({ label: 'Bugungi darslarim', value: lessonsToday.length, onClick: function () { App.go('schedule'); } }));
      var myStudents = {};
      myGroups.forEach(function (g) { Q.membersOf(g.id).forEach(function (m) { myStudents[m.studentId] = 1; }); });
      tiles.appendChild(UI.tile({ label: 'O’quvchilarim', value: Object.keys(myStudents).length, onClick: function () { App.go('students'); } }));
    }

    /* O'qituvchi uchun eng kerakli narsa — DAVOMAT. Shuning uchun u eng tepada:
       bugungi darslar katta tugma bo'lib turadi, bosilsa to'g'ri davomat sahifasi. */
    if (user.role === 'oqituvchi') {
      view.appendChild(teacherAttendanceCard(lessonsToday, ym, today, App));
      view.appendChild(tiles);
      view.appendChild(h('div', { class: 'rowflex', style: 'margin-bottom:16px' }, [
        h('button', {
          class: 'btn', onclick: function () { App.go('attendance'); }
        }, [UI.icon('check'), 'Davomat bo’limi']),
        h('button', { class: 'btn', onclick: function () { App.go('schedule'); } }, [UI.icon('calendar'), 'Jadvalim']),
        h('button', { class: 'btn', onclick: function () { App.go('groups'); } }, [UI.icon('layers'), 'Guruhlarim'])
      ]));
    } else {
      view.appendChild(tiles);
    }

    if (user.role !== 'oqituvchi' && (App.can('payment.create') || App.can('student.edit'))) {
      view.appendChild(h('div', { class: 'rowflex', style: 'margin-bottom:16px' }, [
        App.can('student.edit') ? h('button', {
          class: 'btn primary', onclick: function () { A.studentForm(null, App); }
        }, [UI.icon('plus'), 'O’quvchi qo’shish']) : null,
        App.can('payment.create') ? h('button', {
          class: 'btn', onclick: function () { A.paymentForm(null, App); }
        }, [UI.icon('money'), 'To’lov qabul qilish']) : null,
        App.can('attendance.mark') ? h('button', {
          class: 'btn', onclick: function () { App.go('attendance'); }
        }, [UI.icon('check'), 'Davomat olish']) : null
      ]));
    }

    var cols = h('div', { class: 'grid cols-2' });

    // Bugungi darslar
    var lessonRows = lessonsToday.map(function (l) {
      var g = D.one('groups', l.groupId);
      var marked = l.attendance && Object.keys(l.attendance).length;
      return h('div', {
        class: 'list-item', onclick: function () { App.go('attendance', { groupId: l.groupId, date: l.date }); }
      }, [
        h('div', { class: 'avatar mono', style: 'width:52px;font-size:12px' }, l.start),
        h('div', { class: 'main-col' }, [
          h('b', {}, g ? g.name : '—'),
          h('span', {}, Q.staffName(l.teacherId) + ' · ' + Q.roomName(l.roomId) + ' · ' + l.start + '–' + l.end)
        ]),
        l.status === 'bekor' ? UI.pill('Bekor', 'mute') : (marked ? UI.pill('Davomat olingan', 'ok') : UI.pill('Davomat kutilmoqda', 'warn'))
      ]);
    });
    cols.appendChild(UI.card('Bugungi darslar',
      lessonsToday.length ? h('div', { class: 'list' }, lessonRows)
        : UI.empty({ title: 'Bugun dars yo’q', text: 'Jadvalga qarang yoki yangi guruh oching.' }),
      [h('button', { class: 'btn sm ghost', onclick: function () { App.go('schedule'); } }, 'Jadval')], true));

    // E'tibor talab qiladigan ishlar
    var tasks = [];
    var unmarked = [];
    Q.activeGroups(user).forEach(function (g) {
      var doc = D.lessonsCached(g.id, ym);
      A.monthLessons(g, ym, doc).forEach(function (l) {
        if (l.date >= today) return;
        if (l.status === 'bekor') return;
        if (l.attendance && Object.keys(l.attendance).length) return;
        unmarked.push(l);
      });
    });
    if (unmarked.length) {
      tasks.push({
        label: unmarked.length + ' ta darsda davomat olinmagan',
        cls: 'warn',
        go: function () { App.go('attendance', { groupId: unmarked[0].groupId, date: unmarked[0].date }); }
      });
    }
    if (App.can('finance.debts') && overdueTotal > 0) {
      tasks.push({
        label: 'Muddati o’tgan qarz: ' + A.somFull(overdueTotal),
        cls: 'bad', go: function () { App.go('finance', { tab: 'debts' }); }
      });
    }
    if (App.can('invoice.create')) {
      var monthInv = A.Fin.monthItems('invoices', ym).length;
      var expected = D.all('memberships').filter(function (m) { return m.status === 'faol' && A.membershipActiveIn(m, ym); }).length;
      if (expected > monthInv) {
        tasks.push({
          label: A.monthLabel(ym) + ' uchun ' + (expected - monthInv) + ' ta hisob yaratilmagan',
          cls: 'warn', go: function () { App.go('finance', { tab: 'invoices' }); }
        });
      }
    }
    var noTeacher = D.all('groups').filter(function (g) { return g.status === 'faol' && !g.teacherId; });
    if (noTeacher.length && App.can('group.edit')) {
      tasks.push({ label: noTeacher.length + ' ta guruhga o’qituvchi biriktirilmagan', cls: 'warn', go: function () { App.go('groups'); } });
    }
    var leadsDue = D.all('leads').filter(function (l) {
      return l.stage !== 'oquvchi' && l.stage !== 'rad' && l.nextContact && l.nextContact <= today;
    });
    if (leadsDue.length && App.can('nav.leads')) {
      tasks.push({ label: leadsDue.length + ' ta murojaatga bugun bog’lanish kerak', cls: 'info', go: function () { App.go('leads', { due: true }); } });
    }

    cols.appendChild(UI.card('E’tibor talab qiladi',
      tasks.length ? h('div', { class: 'list' }, tasks.map(function (t) {
        return h('div', { class: 'list-item', onclick: t.go }, [
          UI.pill('!', t.cls),
          h('div', { class: 'main-col' }, h('b', {}, t.label))
        ]);
      })) : UI.empty({ title: 'Hammasi joyida', text: 'Hozircha kechiktirilgan ish yo’q.' }),
      null, true));

    view.appendChild(cols);
  };

  /* ================= MUROJAATLAR ================= */
  A.Pages.leads = function (view, route, App) {
    App.guard('nav.leads');
    var today = A.today();
    var funnels = A.sortBy(D.all('funnels'), 'order');
    if (!funnels.length) funnels = A.DEFAULT_FUNNELS;
    var funnelId = route.funnelId || (funnels[0] && funnels[0].id);
    var funnel = funnels.filter(function (f) { return f.id === funnelId; })[0] || funnels[0];
    var stages = A.funnelStages(funnel);
    var stageFilter = route.stage || 'all';

    var allLeads = D.all('leads');
    function inFunnel(l) {
      return (l.funnelId || 'fnl_asosiy') === funnel.id;
    }
    var leads = allLeads.filter(inFunnel);
    if (route.due) leads = leads.filter(function (l) {
      return !isClosed(funnel, l.stage) && l.nextContact && l.nextContact <= today;
    });
    if (stageFilter !== 'all') leads = leads.filter(function (l) { return l.stage === stageFilter; });
    leads = A.sortBy(leads, 'createdAt', 'desc');

    view.appendChild(UI.pageHead('Murojaatlar', 'Yangi mijozlarni bog’lanishdan o’quvchiga aylanguncha kuzating', [
      App.can('lead.edit') ? h('button', { class: 'btn primary', onclick: function () { leadForm(null, App, funnel.id); } },
        [UI.icon('plus'), 'Murojaat qo’shish']) : null,
      App.can('lead.import') ? h('button', { class: 'btn', onclick: function () { A.importModal('leads', App, funnel.id); } },
        [UI.icon('upload'), 'Excel’dan import']) : null,
      h('button', {
        class: 'btn', onclick: function () {
          UI.exportCsv('murojaatlar-' + funnel.name + '.csv',
            [['Ism', 'Telefon', 'Kurs', 'Manba', 'Reklama belgisi', 'Hudud', 'Tuman', 'Voronka', 'Holat', 'Keyingi aloqa', 'Izoh']].concat(
              leads.map(function (l) {
                return [l.name, l.phone, Q.courseName(l.courseId), l.source, l.src || '', l.region || '', l.district || '', funnel.name,
                A.stageOf(funnel, l.stage).label, l.nextContact || '', l.note || ''];
              })));
        }
      }, [UI.icon('down'), 'Excel'])
    ]));

    // Voronkalar
    view.appendChild(UI.tabs(funnels.map(function (f) {
      var n = allLeads.filter(function (l) { return (l.funnelId || 'fnl_asosiy') === f.id; }).length;
      return { id: f.id, label: f.name + ' (' + n + ')' };
    }), funnel.id, function (id) { App.go('leads', { funnelId: id }); }));

    var counts = {};
    stages.forEach(function (s) {
      counts[s.id] = allLeads.filter(function (l) { return inFunnel(l) && l.stage === s.id; }).length;
    });
    var segs = h('div', { class: 'filters' }, [
      h('div', { class: 'seg' }, [{ id: 'all', label: 'Barchasi (' + allLeads.filter(inFunnel).length + ')' }]
        .concat(stages.map(function (s) { return { id: s.id, label: s.label + ' (' + counts[s.id] + ')' }; }))
        .map(function (s) {
          return h('button', {
            type: 'button', 'aria-pressed': stageFilter === s.id ? 'true' : 'false',
            onclick: function () { App.go('leads', { funnelId: funnel.id, stage: s.id }); }
          }, s.label);
        })),
      route.due ? h('button', { class: 'btn sm', onclick: function () { App.go('leads', { funnelId: funnel.id }); } }, 'Filtrni olib tashlash') : null,
      App.can('bot.broadcast') && A.Bot ? h('button', {
        class: 'btn sm', onclick: function () { leadBroadcast(allLeads.filter(inFunnel), funnel, App); }
      }, [UI.icon('bot'), 'Botdagilarga xabar']) : null
    ]);
    view.appendChild(segs);
    view.appendChild(leadStatsCard(allLeads.filter(inFunnel), funnel));

    if (!leads.length) {
      view.appendChild(UI.card(null, UI.empty({
        title: 'Murojaat yo’q',
        text: 'Telefon qilgan yoki yozgan har bir mijozni shu yerga qo’shing — keyin uni bir bosishda o’quvchiga aylantirasiz.',
        action: App.can('lead.edit') ? { label: 'Murojaat qo’shish', onClick: function () { leadForm(null, App, funnel.id); } } : null
      })));
      return;
    }

    view.appendChild(UI.card(null, UI.table([
      { label: 'Ism', render: function (l) { return h('b', {}, l.name); } },
      /* Raqam bosilsa telefon o'zi teradi — qo'lda ko'chirish shart emas */
      { label: 'Telefon', render: function (l) { return UI.phoneLink(l.phone); } },
      leads.some(function (l) { return l.groupId; }) ? { label: 'Guruh', render: function (l) { var g = l.groupId && D.one('groups', l.groupId); return g ? g.name : h('span', { class: 'muted' }, '—'); } } : null,
      {
        label: 'Manba', render: function (l) {
          /* Forma orqali kelgan bo'lsa — javoblari shu yerda ochiladi */
          if (l.viaForm && A.formAnswersBlock) {
            return h('button', {
              class: 'btn sm', onclick: function (e) {
                if (e) e.stopPropagation();
                UI.modal({
                  title: l.name + ' — forma javoblari',
                  body: [A.formAnswersBlock(l), h('p', { class: 'small muted' }, 'Manba: ' + (l.source || ''))],
                  actions: [{ label: 'Yopish' }]
                });
              }
            }, [UI.icon('task'), l.formTitle || 'Forma']);
          }
          /* Uzun «kampaniya › ad set › reklama» o'rniga faqat reklama nomi; to'liqi — ustiga borganda */
          var ad = l.src ? String(l.src).split('›').pop().trim() : '';
          return h('div', { class: 'lead-src', title: l.src || '' }, [
            h('span', {}, l.source || '—'), ad ? h('span', { class: 'muted small' }, ad) : null]);
        }
      },
      leads.some(function (l) { return l.region; }) ? { label: 'Hudud', render: function (l) { return l.region ? (l.region + (l.district ? ', ' + l.district : '')) : h('span', { class: 'muted' }, '—'); } } : null,
      { label: 'Mas’ul', render: function (l) { return Q.ownerName(l.ownerStaffId); } },
      {
        label: 'Keyingi aloqa', render: function (l) {
          if (!l.nextContact) return h('span', { class: 'muted' }, '—');
          var late = l.nextContact <= today && !isClosed(funnel, l.stage);
          return h('span', { class: late ? 'pill bad' : 'mono' }, A.dateLabel(l.nextContact));
        }
      },
      { label: 'Holat', render: function (l) { return stagePill(l.stage, funnel); } },
      {
        label: '', right: true, render: function (l) {
          if (!App.can('lead.edit')) return UI.contactBtns(l.phone, { small: true });
          return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px;flex-wrap:nowrap' }, [
            UI.contactBtns(l.phone, { small: true }),
            /* Sinov darsiga yozilgan: dars o'tmaguncha o'quvchiga aylantirilmaydi —
               tugma sinov vaqtini ko'rsatadi; dars o'tgach «O'quvchiga» chiqadi. */
            (A.stageOf(funnel, l.stage).type !== 'won' && !l.studentId && isTrialStage(funnel, l.stage) && !trialDone(l)) ? h('button', {
              class: 'btn sm trial-btn', title: 'Sinov darsi o’tgach o’quvchiga o’tkaziladi',
              onclick: function (e) { e.stopPropagation(); leadForm(l, App); }
            }, l.trialDate ? '📅 Sinov: ' + trialLabel(l) : '📅 Guruhni tanlang')
            : (A.stageOf(funnel, l.stage).type !== 'won' && !l.studentId) ? h('button', {
              class: 'btn sm primary', onclick: function (e) { e.stopPropagation(); convertLead(l, App); }
            }, 'O’quvchiga') : null,
            h('button', { class: 'btn sm', onclick: function (e) { e.stopPropagation(); leadForm(l, App); } }, 'Ochish')
          ].filter(Boolean));
        }
      }
    ].filter(Boolean), leads, { onRow: function (l) { if (App.can('lead.edit')) leadForm(l, App); }, page: 100 }), null, null, true));
  };

  /* Manba va hudud bo'yicha qisqa hisobot: qaysi reklama ko'proq lid va
     o'quvchi olib kelyapti, lidlar qaysi hududdan. Oflayn filial joyini
     tanlash ham shu jadvalga qarab qilinadi.                              */
  function leadStatsCard(list, funnel) {
    if (!list.length) return h('div');
    function won(l) { return !!l.studentId || A.stageOf(funnel, l.stage).type === 'won'; }
    function group(keyFn) {
      var m = {};
      list.forEach(function (l) {
        var k = keyFn(l) || '—';
        if (!m[k]) m[k] = { key: k, n: 0, won: 0 };
        m[k].n++; if (won(l)) m[k].won++;
      });
      return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.n - a.n; });
    }
    function tbl(title, rows) {
      return h('div', { style: 'flex:1 1 280px;min-width:0' }, [
        h('b', {}, title),
        UI.table([
          { label: 'Nomi', key: 'key' },
          { label: 'Lid', right: true, render: function (r) { return String(r.n); } },
          { label: 'Sotuv', right: true, render: function (r) { return String(r.won); } },
          { label: '%', right: true, render: function (r) { return Math.round(r.won * 100 / r.n) + '%'; } }
        ], rows.slice(0, 12))
      ]);
    }
    var bySrc = group(function (l) { return (l.source || '') + (l.src ? ' · ' + l.src : ''); });
    var byReg = group(function (l) { return l.region; });
    var body = h('div', { class: 'rowflex', style: 'gap:18px;align-items:flex-start' }, [
      tbl('Manba / reklama bo’yicha', bySrc), tbl('Hudud bo’yicha', byReg)
    ]);
    var det = h('details', { class: 'card', style: 'padding:12px 16px;margin-bottom:12px' }, [
      h('summary', { style: 'cursor:pointer;font-weight:600' }, 'Manba va hudud hisoboti'), body
    ]);
    return det;
  }

  /* Botda bepul darsga yozilganlarga xabar: eslatma, dars havolasi, taklif.
     Faqat botni o'zi ishga tushirgan odamlarga boradi (chatId bor). */
  function leadBroadcast(list, funnel, App) {
    var targets = list.filter(function (l) { return l.chatId && !isClosed(funnel, l.stage); });
    var s = D.settings || {};
    var fl = s.freeLesson || {};
    var def = fl.title
      ? 'Eslatma: «' + fl.title + '» bepul darsi ' + (fl.date ? A.dateLabel(fl.date) : 'tez orada') +
        (fl.time ? ', soat ' + fl.time : '') + ' da boshlanadi.' + (fl.channel ? '\nKanal: ' + fl.channel : '')
      : '';
    var fText = UI.field({ label: 'Xabar matni', type: 'textarea', value: def, rows: 5, full: true });
    UI.modal({
      title: 'Botdagi ro’yxatga xabar',
      body: [
        h('p', { class: 'small muted', style: 'margin-top:0' },
          targets.length + ' ta odamga yuboriladi (botda ro’yxatdan o’tgan, hali o’quvchi bo’lmagan).'),
        fText.wrap
      ],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Yuborish', cls: 'primary', onClick: function (c, btn) {
            var text = String(fText.input.value || '').trim();
            if (text.length < 3) { UI.toast('Matn yozing.', 'warn'); return; }
            if (!targets.length) { UI.toast('Botda ro’yxatdan o’tgan odam yo’q.', 'warn'); return; }
            UI.busy(btn, async function () {
              var n = 0;
              for (var i = 0; i < targets.length; i++) { if (await A.Bot.enqueueLead(targets[i], text)) n++; }
              await A.Ops.audit(App.user, 'Botdagi ro’yxatga xabar', funnel.name, n + ' ta');
              c(); UI.toast(n + ' ta xabar navbatga qo’yildi.', 'ok');
            });
          }
        }
      ]
    });
  }

  /* Sinov darsi bosqichi: id «sinov» yoki nomida «sinov» */
  function isTrialStage(funnel, stageId) {
    var st = A.stageOf(funnel, stageId) || {};
    return stageId === 'sinov' || /sinov/i.test(st.label || '');
  }
  function trialAt(l) {
    if (!l || !l.trialDate) return 0;
    var t = Date.parse(String(l.trialDate).slice(0, 10) + 'T' + (/^\d{2}:\d{2}$/.test(l.trialTime || '') ? l.trialTime : '09:00') + ':00+05:00');
    return isNaN(t) ? 0 : t;
  }
  /** Sinov darsi o'tdimi (boshlanish + 90 daqiqa) */
  function trialDone(l) { var t = trialAt(l); return !!t && Date.now() >= t + 90 * 60000; }
  /** Guruh jadvalidan keyingi dars (Toshkent vaqti): {date, time, end} yoki null.
      g.days: 1 = dushanba … 7 = yakshanba. Bugungi dars hali boshlanmagan bo'lsa — bugun. */
  function groupNextLesson(g, fromMs) {
    if (!g || !(g.days || []).length || !g.startTime) return null;
    var now = fromMs || Date.now();
    /* Rejalashtirilgan guruh: darslar boshlanish sanasidan */
    if (g.startDate) { var sd = Date.parse(String(g.startDate).slice(0, 10) + 'T00:00:00+05:00'); if (!isNaN(sd) && sd > now) now = sd - 1; }
    for (var off = 0; off < 15; off++) {
      var d = new Date(now + 5 * 3600000 + off * 86400000);
      var iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
      if (g.days.indexOf(iso) < 0) continue;
      var date = d.toISOString().slice(0, 10);
      var t = Date.parse(date + 'T' + g.startTime + ':00+05:00');
      if (t > now) return { date: date, time: g.startTime, end: g.endTime || '' };
    }
    return null;
  }
  A.groupNextLesson = groupNextLesson;
  /** Guruhga sinov darsiga yozilgan murojaatlar (hali o'quvchi emas, rad etilmagan) */
  A.trialLeadsOf = function (groupId) {
    return D.all('leads').filter(function (l) {
      if (l.groupId !== groupId || l.studentId) return false;
      var fn = D.one('funnels', l.funnelId) || A.DEFAULT_FUNNELS.filter(function (x) { return x.id === l.funnelId; })[0] || A.DEFAULT_FUNNELS[0];
      return isTrialStage(fn, l.stage);
    });
  };
  function trialLabel(l) {
    return l.trialDate ? A.dateLabel(String(l.trialDate).slice(0, 10)) + (l.trialTime ? ', ' + l.trialTime : '') : '';
  }

  function isClosed(funnel, stageId) {
    var t = A.stageOf(funnel, stageId).type;
    return t === 'won' || t === 'lost';
  }

  function stageLabel(id, funnel) {
    if (funnel) return A.stageOf(funnel, id).label;
    var s = A.LEAD_STAGES.filter(function (x) { return x.id === id; })[0];
    return s ? s.label : id;
  }
  function stagePill(id, funnel) {
    var st = funnel ? A.stageOf(funnel, id) : { id: id };
    var cls = st.type === 'won' ? 'ok' : (st.type === 'lost' ? 'mute'
      : ({ yangi: 'info', boglanildi: 'warn', sinov: 'warn', qiziqdi: 'warn', oquvchi: 'ok', rad: 'mute' }[id] || 'info'));
    return UI.pill(stageLabel(id, funnel), cls);
  }

  /* Murojaat oynasi — telefonda, planshetda va noutbukda bir xil qulay.
     Tepada: ism, raqam (qo'ng'iroq / Telegram / SMS bir bosishda), manba.
     Holat — bitta bosishda o'zgaradigan tugmalar qatori.
     Asosiy maydonlar ochiq, kam o'zgaradiganlari «Qo'shimcha» ichida.
     Pastda: «O'quvchiga o'tkazish» — shu yerdan, boshqa sahifaga o'tmasdan. */
  function leadForm(lead, App, defFunnelId) {
    App.guard('lead.edit');
    var isNew = !lead;
    var funnels = A.sortBy(D.all('funnels'), 'order');
    if (!funnels.length) funnels = A.DEFAULT_FUNNELS;
    lead = lead || {
      stage: 'yangi', createdAt: A.nowStamp(), nextContact: A.today(),
      funnelId: defFunnelId || funnels[0].id
    };
    var curFunnel = funnels.filter(function (x) { return x.id === (lead.funnelId || funnels[0].id); })[0] || funnels[0];
    var owners = D.all('users').filter(function (u) { return u.active !== false && ['menejer', 'admin', 'direktor'].indexOf(u.role) >= 0; })
      .sort(function (a, b) { var o = { menejer: 0, admin: 1, direktor: 2 }; return (o[a.role] - o[b.role]) || String(a.name).localeCompare(String(b.name)); });

    /* --- Meta formasi javoblari: izohda emas, tepada ko'rinadi.
       Eski yozuvlarda javoblar izohga yozilgan — ularni ajratib olamiz. --- */
    var answers = Array.isArray(lead.metaAnswers) ? lead.metaAnswers.slice() : [];
    var noteVal = lead.note || '';
    var movedFromNote = false;
    if (!answers.length && lead.viaMeta && noteVal) {
      var keep = [];
      noteVal.split(/\n| · /).forEach(function (seg) {
        var t = seg.trim(); if (!t) return;
        var m = /^([^:]{3,80}):\s*(.+)$/.exec(t);
        if (m && !/^\d/.test(m[1]) && !keep.length) answers.push({ q: m[1].trim(), a: m[2].trim() });
        else keep.push(t);
      });
      if (answers.length) { noteVal = keep.join('\n'); movedFromNote = true; }
    }

    /* --- asosiy maydonlar --- */
    var f = UI.form([
      { name: 'name', label: 'Ism', required: true, value: lead.name },
      {
        name: 'phone', label: 'Telefon', required: true, value: lead.phone, placeholder: '+998 90 123 45 67',
        validate: function (v) { return A.phoneDigits(v).length < 7 ? 'Telefon raqamni to’liq kiriting.' : null; }
      },
      { name: 'nextContact', label: 'Keyingi bog’lanish', type: 'date', value: lead.nextContact },
      {
        /* Qaysi guruhga yozilmoqchi — o'quvchiga o'tkazganda shu guruh o'zi tanlanadi */
        name: 'groupId', label: 'Guruh (sinov darsi shu guruhda)', type: 'select', value: lead.groupId,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(D.all('groups').filter(function (g) {
          return g.id === lead.groupId || g.status === 'rejalashtirilgan' || g.status === 'faol';
        }).map(function (g) {
          var n = Q.membersOf(g.id).length + A.trialLeadsOf(g.id).filter(function (x) { return x.id !== lead.id; }).length,
            lim = Number(g.limit) || 0, full = lim && n >= lim && g.id !== lead.groupId;
          var days = (g.days || []).map(function (d) { return A.WEEKDAYS_SHORT[d - 1]; }).join('/');
          return {
            value: g.id, disabled: !!full,
            label: g.name + (days ? ' · ' + days + ' ' + (g.startTime || '') : '') +
              (g.status === 'rejalashtirilgan' && g.startDate ? ' · ' + A.dateLabel(String(g.startDate).slice(0, 10)) + 'dan' : '') +
              (lim ? ' · ' + (full ? 'to’la' : (lim - n) + ' joy') : '')
          };
        }))
      },
      {
        /* Mas'ul — ERP hisobi bor xodimlar: menejer, administrator, direktor. */
        name: 'ownerStaffId', label: 'Mas’ul xodim', type: 'select', value: lead.ownerStaffId,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(
          owners.map(function (u) { return { value: u.id, label: u.name + ' · ' + (A.ROLES[u.role] || u.role) }; }),
          (lead.ownerStaffId && !D.one('users', lead.ownerStaffId) && D.one('staff', lead.ownerStaffId))
            ? [{ value: lead.ownerStaffId, label: D.one('staff', lead.ownerStaffId).name }] : [])
      },
      {
        name: 'note', label: 'Izoh', type: 'textarea', value: noteVal, full: true, rows: 3,
        placeholder: 'Masalan: 27.10 — gaplashdik, kechki guruh kerak, ertaga sinovga keladi'
      }
    ]);

    /* --- kam o'zgaradiganlar --- */
    var fx = UI.form([
      {
        name: 'funnelId', label: 'Sotuv voronkasi', type: 'select', value: lead.funnelId || curFunnel.id,
        options: funnels.map(function (x) { return { value: x.id, label: x.name }; }),
        onchange: function (e) {
          curFunnel = funnels.filter(function (x) { return x.id === e.target.value; })[0] || curFunnel;
          var st = A.funnelStages(curFunnel);
          if (!st.some(function (x) { return x.id === stage; })) stage = st[0] ? st[0].id : stage;
          paintStages();
        }
      },
      {
        name: 'source', label: 'Qayerdan kelgan', type: 'select', value: lead.source,
        options: A.LEAD_SOURCES.concat(lead.source && A.LEAD_SOURCES.indexOf(lead.source) < 0 ? [lead.source] : [])
          .map(function (s) { return { value: s, label: s }; })
      },
      {
        name: 'src', label: 'Reklama belgisi', value: lead.src,
        placeholder: 'masalan: reels1, posev_kanal'
      },
      {
        name: 'region', label: 'Hudud (viloyat)', type: 'select', value: lead.region,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(A.REGIONS.map(function (r) { return { value: r, label: r }; }))
      },
      { name: 'district', label: 'Tuman / shahar', value: lead.district, placeholder: 'masalan: Yunusobod' }
    ]);

    /* --- holat: bir bosishda --- */
    var stage = lead.stage || (A.funnelStages(curFunnel)[0] || {}).id || 'yangi';
    var stageBox = h('div', { class: 'lead-stages', role: 'radiogroup', 'aria-label': 'Holat' });
    function paintStages() {
      UI.clear(stageBox);
      A.funnelStages(curFunnel).forEach(function (s) {
        var on = s.id === stage;
        stageBox.appendChild(h('button', {
          type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false',
          class: 'ls-btn' + (on ? ' on' : '') + (s.type === 'won' ? ' won' : (s.type === 'lost' ? ' lost' : '')),
          onclick: function () { stage = s.id; paintStages(); if (trialBox) paintTrial(); stageBox.dispatchEvent(new Event('change', { bubbles: true })); }
        }, s.label));
      });
    }
    paintStages();

    /* --- sinov darsi: kuni va soati (faqat «Sinov darsiga yozildi» holatida) ---
       Sinovga yozilgan odamga o'quvchi hisobi OCHILMAYDI: u birinchi
       darsga bepul kiradi; dars tugagach menejerga qayta aloqa eslatmasi
       keladi, to'lov qilsa — shundan keyin o'quvchiga o'tkaziladi. */
    /* Sinov darsi = tanlangan guruhning keyingi darsi (kun va soat guruh jadvalidan) */
    var trialMsg = h('div', { class: 'trial-msg' });
    var trialBox = h('div', { class: 'lead-trial' }, [
      h('div', { class: 'lead-lbl' }, 'Bepul sinov darsi'),
      trialMsg,
      h('p', { class: 'small muted', style: 'margin:0' },
        'O’quvchi hisobi ochilmaydi. Darsdan 1 soat oldin va dars tugagach menejerga Telegram’da eslatma keladi — darsdan keyin yana qo’ng’iroq qilasiz.')
    ]);
    /* Sinov vaqti: qo'lda kiritilgan bo'lsa — o'sha; bo'lmasa tanlangan guruhning keyingi darsi */
    function effTrial() {
      var gid = f.get('groupId') ? f.get('groupId').input.value : '';
      var g = gid ? D.one('groups', gid) : null;
      var nl = groupNextLesson(g);
      return nl ? { date: nl.date, time: nl.time, end: nl.end, auto: true, g: g } : { g: g };
    }
    var invCache = {};
    function paintTrial() {
      trialBox.hidden = !isTrialStage(curFunnel, stage);
      UI.clear(trialMsg);
      var et = effTrial(), g = et.g, d = et.date, tm = et.time;
      if (!d) {
        trialMsg.appendChild(h('div', { class: 'small muted' }, g
          ? 'Bu guruhning dars kunlari yoki vaqti belgilanmagan — Guruhlar bo’limida jadvalini kiriting.'
          : '👇 Pastda guruhni tanlang — sinov darsi shu guruhning keyingi darsiga qo’yiladi.'));
        return;
      }
      if (et.auto) {
        var wd = A.WEEKDAYS[(new Date(Date.parse(d + 'T12:00:00Z')).getUTCDay() + 6) % 7] || '';
        trialMsg.appendChild(h('div', { class: 'trial-auto' }, ['📅 Guruh jadvali bo’yicha keyingi dars: ',
          h('b', {}, wd + ', ' + A.dateLabel(d) + ', ' + tm + (et.end ? '–' + et.end : '')), ' — shu kuni eslatiladi.']));
      }
      var nm = (f.get('name').input.value || '').split(/\s+/)[0];
      /* Zoom havolasi yuborilmaydi; guruh Telegramga ulangan bo'lsa — guruh havolasi */
      var inv = g && (g.tgInvite || invCache[g.id]);
      if (g && g.tgChat && !inv && invCache[g.id] === undefined && D.mode === 'server') {
        invCache[g.id] = '';
        fetch('/api/group-invite?id=' + encodeURIComponent(g.id), { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && j.link) { invCache[g.id] = j.link; paintTrial(); } }).catch(function () { });
      }
      var txt = nm + ', sizni bepul sinov darsiga yozib qo’ydim ✅\n📅 ' + A.dateLabel(d) + (tm ? ', soat ' + tm : '') +
        (inv ? '\n👥 Telegram guruhimiz havolasi: ' + inv : '') + '\nDars oldidan yana eslatib qo’yaman. Savol bo’lsa, shu yerga yozing.';
      trialMsg.appendChild(h('div', { class: 'trial-copy' }, [
        h('pre', {}, txt),
        h('button', { class: 'btn sm', type: 'button', onclick: function () { UI.copy(txt); } }, [UI.icon('link'), 'Xabarni nusxalash'])
      ]));
    }
    if (f.get('groupId')) f.get('groupId').input.addEventListener('change', paintTrial);

    /* --- tepa qism: kim, raqam, qayerdan --- */
    var student = lead.studentId ? D.one('students', lead.studentId) : null;
    var hero = h('div', { class: 'lead-hero' });
    function paintHero() {
      UI.clear(hero);
      var nm = f.get('name').input.value || 'Yangi murojaat';
      var ph = f.get('phone').input.value;
      var digits = A.phoneDigits(ph);
      var chips = [];
      if (lead.source) chips.push(h('span', { class: 'lh-chip' }, lead.source));
      if (lead.src) {
        var ad = String(lead.src).split('›').pop().trim();
        chips.push(h('span', { class: 'lh-chip ad', title: lead.src }, ad));
      }
      if (lead.createdAt && !isNew) chips.push(h('span', { class: 'lh-chip muted' }, 'Keldi: ' + String(lead.createdAt).slice(0, 16)));
      if (lead.contactedBy) chips.push(h('span', { class: 'lh-chip ok' }, 'Bog’landi: ' + lead.contactedBy));
      if (lead.trialDate) chips.push(h('span', { class: 'lh-chip trial' }, (trialDone(lead) ? 'Sinov o’tdi: ' : 'Sinov: ') + trialLabel(lead)));
      if (student) chips.push(h('span', { class: 'lh-chip ok' }, 'O’quvchi: ' + student.lastName + ' ' + student.firstName));
      hero.appendChild(h('div', { class: 'lh-top' }, [
        h('div', { class: 'lh-ava', 'aria-hidden': 'true' }, String(nm).trim().charAt(0).toUpperCase() || '?'),
        h('div', { class: 'lh-id' }, [
          h('div', { class: 'lh-name' }, nm),
          ph ? h('a', { class: 'lh-phone', href: 'tel:+' + (digits.length === 9 ? '998' + digits : digits) }, ph) : h('span', { class: 'muted small' }, 'Raqam kiritilmagan')
        ])
      ]));
      if (digits.length >= 9) {
        var full = digits.length === 9 ? '998' + digits : digits;
        hero.appendChild(h('div', { class: 'lh-acts' }, [
          h('a', { class: 'btn primary lh-call', href: 'tel:+' + full }, [UI.icon('phone'), h('span', {}, 'Qo’ng’iroq')]),
          h('a', { class: 'btn', href: 'https://t.me/+' + full, target: '_blank', rel: 'noopener' }, [UI.icon('chat'), h('span', {}, 'Telegram')]),
          h('a', { class: 'btn', href: 'sms:+' + full }, [UI.icon('chat'), h('span', {}, 'SMS')])
        ]));
      }
      if (chips.length) hero.appendChild(h('div', { class: 'lh-chips' }, chips));
      if (answers.length) {
        hero.appendChild(h('dl', { class: 'lh-ans' }, answers.map(function (x) {
          return h('div', { class: 'lh-qa' }, [h('dt', {}, x.q || 'Javob'), h('dd', {}, x.a)]);
        })));
      }
    }
    f.get('name').input.addEventListener('input', paintHero);
    f.get('phone').input.addEventListener('input', paintHero);
    paintHero();
    paintTrial();

    var dupBox = h('div');
    function checkDup() {
      UI.clear(dupBox);
      var d = A.phoneDigits(f.get('phone').input.value);
      if (d.length < 7) return;
      var sameStudents = D.all('students').filter(function (s) {
        return s.id !== lead.studentId && (A.phoneDigits(s.phone) === d || A.phoneDigits(s.parentPhone) === d);
      });
      var sameLeads = D.all('leads').filter(function (l) { return l.id !== lead.id && A.phoneDigits(l.phone) === d; });
      if (sameStudents.length || sameLeads.length) {
        dupBox.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, [
          h('b', {}, 'Bu raqam allaqachon bor: '),
          sameStudents.map(function (s) { return s.lastName + ' ' + s.firstName; }).concat(
            sameLeads.map(function (l) { return l.name + ' (murojaat)'; })).join(', '),
          '. Bir oiladagi bolalar uchun bir xil raqam bo’lishi mumkin — davom etaverishingiz mumkin.'
        ])));
      }
    }
    f.get('phone').input.addEventListener('blur', checkDup);
    checkDup();

    var extra = h('details', { class: 'lead-more' + (isNew ? '' : '') }, [
      h('summary', {}, 'Qo’shimcha: voronka, manba, hudud'), fx.node
    ]);
    if (isNew) extra.open = true;

    function collect() {
      if (!f.validate() || !fx.validate()) { if (!fx.validate()) extra.open = true; return null; }
      var v = Object.assign({}, fx.values(), f.values(), { stage: stage });
      var g = v.groupId ? D.one('groups', v.groupId) : null;
      if (g && g.courseId) v.courseId = g.courseId;
      if (movedFromNote) v.metaAnswers = answers;
      if (isTrialStage(curFunnel, stage)) {
        var et = effTrial();
        v.trialDate = et.date || ''; v.trialTime = et.time || ''; v.trialEnd = et.end || ''; v.trialAuto = !!et.auto;
        /* Sana o'zgarsa eslatmalar qaytadan ishlaydi */
        if (v.trialDate !== String(lead.trialDate || '').slice(0, 10) || v.trialTime !== (lead.trialTime || '')) {
          v.trialPreAt = ''; v.trialPostAt = '';
          if (!v.nextContact || v.nextContact < v.trialDate) v.nextContact = v.trialDate;
        }
      }
      return Object.assign({}, lead, v, { phone: A.normPhone(v.phone) });
    }
    async function persist(rec) {
      if (isNew) { rec.id = A.uid('led'); rec.createdAt = A.nowStamp(); }
      await D.save('leads', rec);
      var fn = funnels.filter(function (x) { return x.id === rec.funnelId; })[0];
      await A.Ops.audit(App.user, isNew ? 'Murojaat qo’shildi' : 'Murojaat o’zgartirildi', rec.name, stageLabel(rec.stage, fn));
      return rec;
    }

    var won = A.stageOf(curFunnel, lead.stage).type === 'won';
    var canConvert = App.can('student.edit') && !student;

    UI.modal({
      title: isNew ? 'Yangi murojaat' : 'Murojaat',
      wide: true, autofocus: isNew,
      body: [
        hero,
        h('div', { class: 'lead-sec' }, [h('div', { class: 'lead-lbl' }, 'Holat'), stageBox]),
        trialBox,
        (lead.formAnswers && A.formAnswersBlock) ? h('details', { class: 'lead-ans', open: true }, [
          h('summary', {}, 'Forma javoblari' + (lead.formTitle ? ' — ' + lead.formTitle : '')),
          A.formAnswersBlock(lead)
        ]) : null,
        f.node, dupBox, extra
      ].filter(Boolean),
      actions: [
        !isNew ? {
          label: 'O’chirish', cls: 'danger lead-del', onClick: async function (c) {
            if (await UI.confirm('Murojaatni o’chirish', 'Bu yozuv butunlay o’chiriladi.', 'O’chirish', true)) {
              await D.remove('leads', lead.id);
              await A.Ops.audit(App.user, 'Murojaat o’chirildi', lead.name, '');
              c(); UI.toast('O’chirildi.', 'ok'); App.render();
            }
          }
        } : null,
        {
          label: 'Saqlash', cls: canConvert && !won ? '' : 'primary', onClick: function (c, btn) {
            var rec = collect(); if (!rec) return;
            UI.busy(btn, async function () {
              await persist(rec);
              c(); UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        },
        student ? {
          label: 'O’quvchi kartasi', cls: 'primary', onClick: function (c) { c(); App.go('student', { id: student.id }); }
        } : null,
        canConvert ? {
          label: '🎓 O’quvchiga o’tkazish', cls: 'primary', onClick: async function (c, btn) {
            if (isTrialStage(curFunnel, stage) && !trialDone(lead)) {
              var ok = await UI.confirm('Sinov darsi hali o’tmagan',
                'O’quvchiga sinov darsidan keyin, to’lov qilganda o’tkaziladi. Hozir o’tkazilsa, o’quvchi hisobi ochiladi. Baribir o’tkazilsinmi?',
                'Ha, o’tkazilsin', false);
              if (!ok) return;
            }
            var rec = collect(); if (!rec) return;
            UI.busy(btn, async function () {
              await persist(rec);
              c(true);
              convertLead(rec, App);
            });
          }
        } : null
      ]
    });
  }

  /* Murojaatni o'quvchiga aylantirish — shu sahifadan chiqmasdan:
     o'quvchi kartasi → (tanlansa) guruhga yozish → to'lov. Tugagach
     Murojaatlar ro'yxatiga qaytiladi.                                    */
  async function convertLead(lead, App) {
    App.guard('student.edit');
    var parts = String(lead.name || '').trim().split(/\s+/);
    A.studentForm({
      firstName: parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] || ''),
      lastName: parts.length > 1 ? parts[0] : '',
      phone: lead.phone,
      parentName: '', parentPhone: '',
      region: lead.region || '', district: lead.district || '',
      note: 'Murojaatdan: ' + (lead.source || '') +
        ((lead.metaAnswers || []).length ? ' · ' + lead.metaAnswers.map(function (x) { return (x.q ? x.q + ': ' : '') + x.a; }).join(' · ') : '') +
        (lead.note ? ' · ' + lead.note : ''),
      _fromLead: lead,
      _courseId: lead.courseId,
      _groupId: lead.groupId,
      _stay: true
    }, App);
  }

  /* O'quvchini o'chirish. To'lovi bor o'quvchi o'chirilmaydi (moliya
     hisobotlari buzilmasin) — uni arxivlash taklif qilinadi. To'lovsiz
     bo'lsa: a'zoliklari va to'lanmagan hisoblari bilan birga o'chadi;
     murojaatdan kelgan bo'lsa, murojaat avvalgi holatiga qaytadi.        */
  async function deleteStudent(s, App) {
    var name = s.lastName + ' ' + s.firstName;
    var pays = D.all('payments').filter(function (p) { return p.studentId === s.id && !p.voided; });
    if (pays.length) {
      var arch = await UI.confirm('O’chirib bo’lmaydi',
        name + ' bo’yicha ' + pays.length + ' ta to’lov bor. Moliya hisobotlari buzilmasligi uchun bunday o’quvchi o’chirilmaydi. Uning o’rniga arxivlaymizmi? (ro’yxatlarda ko’rinmaydi, tarix saqlanadi)',
        'Arxivlash', false);
      if (!arch) return;
      await D.save('students', Object.assign({}, s, { status: 'arxiv' }));
      Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; }).forEach(function (m) {
        D.save('memberships', Object.assign({}, m, { status: 'chiqgan', leftAt: A.today() }));
      });
      await A.Ops.audit(App.user, 'O’quvchi arxivlandi', name, '');
      UI.toast('Arxivlandi.', 'ok'); App.go('students');
      return;
    }
    var ok = await UI.confirm('O’quvchini o’chirish',
      name + ' butunlay o’chiriladi: guruhlardagi a’zoligi, to’lanmagan hisoblari va kabinetga kirish huquqi ham. Bu amalni qaytarib bo’lmaydi.',
      'O’chirish', true);
    if (!ok) return;
    var mems = D.all('memberships').filter(function (m) { return m.studentId === s.id; });
    var invs = D.all('invoices').filter(function (i) { return i.studentId === s.id; });
    for (var i = 0; i < invs.length; i++) { try { await D.remove('invoices', invs[i].id); } catch (e) { } }
    for (var j = 0; j < mems.length; j++) { try { await D.remove('memberships', mems[j].id); } catch (e) { } }
    D.all('leads').filter(function (l) { return l.studentId === s.id; }).forEach(function (l) {
      var back = Object.assign({}, l, { stage: l.prevStage || 'qiziqdi', studentId: '' });
      delete back.prevStage;
      D.save('leads', back);
    });
    await D.remove('students', s.id);
    await A.Ops.audit(App.user, 'O’quvchi o’chirildi', name, mems.length + ' a’zolik, ' + invs.length + ' hisob');
    UI.toast(name + ' o’chirildi.', 'ok');
    App.go('students');
  }

  /* ================= O'QUVCHILAR ================= */
  A.Pages.students = function (view, route, App) {
    App.guard('student.view');
    var user = App.user;
    var all = D.all('students');
    if (user.role === 'oqituvchi') {
      var mine = {};
      A.scopeGroups(user, D.all('groups')).forEach(function (g) {
        Q.membersOf(g.id).forEach(function (m) { mine[m.studentId] = 1; });
      });
      all = all.filter(function (s) { return mine[s.id]; });
    }
    var q = (route.q || '').trim().toLowerCase();
    var status = route.status || 'all';
    var groupId = route.groupId || '';
    var list = all.filter(function (s) {
      if (status !== 'all' && s.status !== status) return false;
      if (groupId && !Q.membershipsOf(s.id).some(function (m) { return m.groupId === groupId && m.status === 'faol'; })) return false;
      if (q) {
        var hay = (s.lastName + ' ' + s.firstName + ' ' + s.phone + ' ' + (s.parentName || '') + ' ' +
          (s.parentPhone || '') + ' ' + (s.code || '')).toLowerCase();
        if (hay.indexOf(q) < 0 && A.phoneDigits(s.phone).indexOf(A.phoneDigits(q)) < 0) return false;
      }
      return true;
    });
    list = A.sortBy(list, function (s) { return s.lastName + ' ' + s.firstName; });

    view.appendChild(UI.pageHead('O’quvchilar', list.length + ' ta ko’rsatilmoqda', [
      App.can('student.edit') ? h('button', { class: 'btn primary', onclick: function () { A.studentForm(null, App); } },
        [UI.icon('plus'), 'O’quvchi qo’shish']) : null,
      App.can('student.import') ? h('button', { class: 'btn', onclick: function () { A.importModal('students', App); } },
        [UI.icon('upload'), 'Excel’dan import']) : null,
      h('button', {
        class: 'btn', onclick: function () {
          var bmap = Q.balanceMap();
          UI.exportRows('oquvchilar', [['Kod', 'Familiya', 'Ism', 'Telefon', 'Ota-ona', 'Ota-ona telefoni', 'Hudud', 'Tuman', 'Guruhlar', 'Holat', 'Qarz', 'Avans']].concat(
            list.map(function (s) {
              var b = bmap[s.id] || { debt: 0, advance: 0 };
              return [s.code || '', s.lastName, s.firstName, s.phone, s.parentName || '', s.parentPhone || '',
              s.region || '', s.district || '',
              Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; }).map(function (m) { return Q.groupName(m.groupId); }).join(', '),
              s.status, b.debt, b.advance];
            })));
        }
      }, [UI.icon('down'), 'Excel'])
    ]));

    var fq = UI.field({ label: 'Qidiruv', value: route.q || '', placeholder: 'Ism, telefon yoki kod' });
    var fst = UI.field({
      label: 'Holat', type: 'select', value: status,
      options: [{ value: 'all', label: 'Barchasi' }, { value: 'faol', label: 'Faol' },
      { value: 'toxtatgan', label: 'Vaqtincha to’xtatgan' }, { value: 'arxiv', label: 'Arxivlangan' }]
    });
    var fg = UI.field({
      label: 'Guruh', type: 'select', value: groupId,
      options: [{ value: '', label: 'Barchasi' }].concat(A.scopeGroups(user, D.all('groups')).map(function (g) { return { value: g.id, label: g.name }; }))
    });
    function apply() {
      App.go('students', { q: fq.input.value, status: fst.input.value, groupId: fg.input.value, live: true });
    }
    var typeTimer = null;
    fq.input.addEventListener('input', function () {
      clearTimeout(typeTimer);
      typeTimer = setTimeout(apply, 220);      // har harfda ro'yxat filtrlanadi
    });
    fst.input.addEventListener('change', apply);
    fg.input.addEventListener('change', apply);
    view.appendChild(h('div', { class: 'filters' }, [fq.wrap, fst.wrap, fg.wrap,
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn sm', onclick: function () { App.go('students', {}); } }, 'Tozalash')]));

    // yozayotganda maydon fokusda qolsin
    if (route.live) {
      setTimeout(function () {
        try {
          fq.input.focus();
          var v = fq.input.value;
          fq.input.setSelectionRange(v.length, v.length);
        } catch (e) { }
      }, 0);
    }
    // takliflar ro'yxati
    UI.suggest(fq.input, function (q) {
      if (!q) return [];
      return (App.searchAll ? App.searchAll(q) : []).filter(function (r) {
        return r.group === 'O’quvchilar' || r.group === 'Guruhlar';
      });
    }, { limit: 12 });

    if (!list.length) {
      view.appendChild(UI.card(null, UI.empty({
        title: 'O’quvchi topilmadi',
        text: q || groupId || status !== 'all' ? 'Filtrni o’zgartirib ko’ring.' : 'Birinchi o’quvchini qo’shing — keyin uni guruhga yozasiz va to’lov qabul qilasiz.',
        action: App.can('student.edit') ? { label: 'O’quvchi qo’shish', onClick: function () { A.studentForm(null, App); } } : null
      })));
      return;
    }

    var showMoney = App.can('finance.debts') || App.can('payment.create');
    var balances = showMoney ? Q.balanceMap() : {};
    var empty0 = { charged: 0, received: 0, allocated: 0, debt: 0, advance: 0, overdue: 0 };
    var cols = [
      {
        label: 'O’quvchi', render: function (s) {
          return h('div', { class: 'rowflex', style: 'gap:9px;flex-wrap:nowrap' }, [
            UI.avatar(s.lastName + ' ' + s.firstName),
            h('div', {}, [h('b', {}, s.lastName + ' ' + s.firstName),
            h('div', { class: 'small muted' }, [
              s.code ? h('span', {}, 'Kod') : null,
              s.code ? h('span', { class: 'mono' }, ' ' + s.code + ' · ') : null,
              /* Raqam bosilsa telefon o'zi teradi */
              s.phone ? UI.phoneLink(s.phone) : h('span', { class: 'mono' }, '—')
            ])])
          ]);
        }
      },
      {
        label: 'Guruhlar', render: function (s) {
          var gs = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
          if (!gs.length) return h('span', { class: 'muted' }, 'Guruhsiz');
          return h('div', { class: 'rowflex', style: 'gap:4px' }, gs.map(function (m) { return UI.pill(Q.groupName(m.groupId), 'mute'); }));
        }
      },
      {
        label: 'Ota-ona', render: function (s) {
          return h('div', {}, [
            h('div', {}, s.parentName || '—'),
            s.parentPhone ? h('div', { class: 'small' }, UI.phoneLink(s.parentPhone))
              : h('div', { class: 'small muted mono' }, '')
          ]);
        }
      },
      { label: 'Hudud', render: function (s) { return s.region ? (s.region + (s.district ? ', ' + s.district : '')) : h('span', { class: 'muted' }, '—'); } },
      { label: 'Holat', render: function (s) { return statusPill(s.status); } }
    ];
    if (showMoney) {
      cols.push({
        label: 'Hisob', right: true, render: function (s) {
          var b = balances[s.id] || empty0;
          return balancePill(b, b.overdue);
        }
      });
    }
    /* Qo'ng'iroq tugmasi: avval ota-onaga, raqami bo'lmasa o'quvchiga */
    cols.push({
      label: '', right: true, render: function (s) {
        return UI.contactBtns(s.parentPhone || s.phone, { small: true }) ||
          h('span', { class: 'muted' }, '');
      }
    });
    view.appendChild(UI.card(null, UI.table(cols, list, {
      onRow: function (s) { App.go('student', { id: s.id }); },
      page: 100
    }), null, null, true));
  };

  /* ================= O'QUVCHI KARTASI ================= */
  /** O'quvchining keyingi darsi: bugundan boshlab 30 kun ichida */
  function nextLessonOf(studentId) {
    var mems = Q.membershipsOf(studentId).filter(function (m) { return m.status === 'faol'; });
    var today = A.today();
    var best = null;
    mems.forEach(function (m) {
      var g = D.one('groups', m.groupId);
      if (!g) return;
      var months = [A.thisMonth(), A.addMonths(A.thisMonth(), 1)];
      months.forEach(function (ym) {
        var doc = D.lessonsCached(g.id, ym);
        A.monthLessons(g, ym, doc).forEach(function (l) {
          if (l.canceled) return;
          if (l.date < today) return;
          if (!best || l.date < best.date || (l.date === best.date && l.start < best.start)) {
            best = { date: l.date, start: l.start, end: l.end, group: g };
          }
        });
      });
    });
    return best;
  }

  /** O'quvchi kartasining tepasidagi tezkor bo'lim */
  function quickCard(s, bal, over, App) {
    var mems = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
    var next = nextLessonOf(s.id);
    var phone = s.phone || s.parentPhone || '';

    var nextDue = (Q.openInvoices(s.id)[0] || {}).dueDate;
    var money = over > 0
      ? h('div', { class: 'q-money bad' }, [
          h('span', {}, 'Qarz (to’lov kuni o’tgan)'),
          h('b', {}, A.som(over) + ' so’m')
        ])
      : bal.debt > 0
      ? h('div', { class: 'q-money' }, [
          h('span', {}, 'To’lov kutilmoqda' + (nextDue ? ' · ' + A.dateLabel(nextDue) : '')),
          h('b', {}, A.som(bal.debt) + ' so’m')
        ])
      : (bal.advance > 0
        ? h('div', { class: 'q-money ok' }, [h('span', {}, 'Balansda'), h('b', {}, '+' + A.som(bal.advance) + ' so’m')])
        : h('div', { class: 'q-money ok' }, [h('span', {}, 'Balans'), h('b', {}, 'Qarz yo’q')]));

    var lines = h('div', { class: 'q-lines' }, [
      h('div', {}, [
        h('span', { class: 'muted small' }, 'Faol guruhlar: '),
        mems.length
          ? h('b', {}, mems.map(function (m) { return Q.groupLabel(m.groupId); }).join(', '))
          : h('span', { class: 'muted' }, 'yo’q')
      ]),
      h('div', {}, [
        h('span', { class: 'muted small' }, 'Keyingi dars: '),
        next
          ? h('b', {}, A.dateLabel(next.date) + ' · ' + next.start + '–' + next.end + ' · ' + A.groupLabel(next.group))
          : h('span', { class: 'muted' }, 'rejada yo’q')
      ]),
      h('div', {}, [
        h('span', { class: 'muted small' }, 'Telefon: '),
        phone ? h('a', { href: 'tel:' + phone.replace(/\s/g, ''), class: 'mono' }, phone)
          : h('span', { class: 'muted' }, 'kiritilmagan')
      ])
    ]);

    var canApply = bal.advance > 0 && Q.openInvoices(s.id).length > 0;
    var actions = h('div', { class: 'q-actions' }, [
      App.can('payment.create') ? h('button', {
        class: 'btn primary', onclick: function () { A.paymentForm(s.id, App); }
      }, [UI.icon('money'), 'To’lov']) : null,
      (canApply && App.can('payment.create')) ? h('button', {
        class: 'btn', onclick: function () { A.advanceModal(s.id, App); }
      }, 'Avansdan qoplash') : null,
      App.can('student.edit') ? h('button', {
        class: 'btn', onclick: function () { A.membershipForm(s, null, App); }
      }, [UI.icon('plus'), 'Guruhga yozish']) : null,
      phone ? h('a', {
        class: 'btn', href: 'tel:' + phone.replace(/\s/g, '')
      }, [UI.icon('phone'), 'Qo’ng’iroq qilish']) : null
    ]);

    return h('section', { class: 'card quick-card' }, [
      h('div', { class: 'q-top' }, [money, lines]),
      actions
    ]);
  }


  /** Veb-kabinet uchun login va parol: server yangi parol yaratadi va
      uni FAQAT shu oynada bir marta ko'rsatadi. Nusxalash va Telegram
      orqali o'quvchiga yuborish tugmalari bor.                        */
  A.kabCreds = function (s, opts) {
    var box = h('div', {}, h('p', { class: 'muted small' }, 'Login va parol tayyorlanmoqda…'));
    var m = UI.modal({
      title: (opts && opts.isNew ? 'O’quvchi qo’shildi — ' : '') + 'Kabinetga kirish',
      body: [box],
      actions: [{ label: 'Yopish', cls: 'primary' }]
    });
    (async function () {
      try {
        var r = await D.api('POST', 'api/student/kabpass', { studentId: s.id });
        var site = r.url || (location.origin + '/#kabinet');
        var text = ((D.settings && D.settings.centerName) || 'Sabo Academy') + ' — shaxsiy kabinet\n' + site +
          '\nLogin: ' + r.login + (r.phone ? ' (yoki telefon raqamingiz)' : '') +
          '\nParol: ' + r.password + '\n\nParolni hech kimga bermang. Kabinetda o’zingiz o’zgartira olasiz.';
        UI.clear(box);
        box.appendChild(h('div', { class: 'kab-creds' }, [
          h('div', { class: 'kab-cred' }, [h('span', { class: 'muted small' }, 'Login'), h('b', { class: 'mono' }, r.login)]),
          h('div', { class: 'kab-cred' }, [h('span', { class: 'muted small' }, 'Parol'), h('b', { class: 'mono' }, r.password)]),
          h('p', { class: 'small muted' }, 'Kirish manzili: ' + site + '. Login o’rniga telefon raqamini ham yozsa bo’ladi. ' +
            'Parol faqat hozir ko’rinadi — nusxalab o’quvchiga yuboring. Unutilsa, shu tugma bilan yangisini yaratasiz.'),
          h('div', { class: 'row-actions' }, [
            h('button', { class: 'btn', type: 'button', onclick: function () { UI.copy(text); } }, [UI.icon('link'), 'Nusxalash']),
            h('a', {
              class: 'btn primary', target: '_blank', rel: 'noopener',
              href: 'https://t.me/share/url?url=' + encodeURIComponent(site) + '&text=' + encodeURIComponent(text)
            }, 'Telegram orqali yuborish')
          ])
        ]));
      } catch (e) {
        UI.clear(box);
        box.appendChild(h('div', { class: 'err-msg' }, e.message || 'Parol yaratilmadi.'));
      }
    })();
    return m;
  };

  /** Shaxsiy kod oynasi: ko'rsatish, nusxalash, kabinet havolasi, yangilash */
  function codeCard(s, App) {
    var tg = s.telegram && s.telegram.id ? s.telegram : null;
    var linkBox = h('div', { class: 'kv-row small', hidden: true });

    var body = [
      h('p', { class: 'small muted', style: 'margin:0' },
        'Shaxsiy kod bilan o’quvchi veb-kabinetiga kiradi. ' +
        'Kodni faqat o’quvchining o’ziga ayting — kodni bilgan odam uning guruhi, ' +
        'qarzi va davomatini ko’radi. Telegram hisobini bog’lash uchun kod yetmaydi: ' +
        'buning uchun pastdagi bir martalik havoladan foydalaning.'),
      h('div', { style: 'text-align:center;padding:10px 0' },
        h('span', { class: 'code-chip', style: 'font-size:28px;letter-spacing:.18em;padding:10px 18px' },
          String(s.code || '—'))),
      h('div', { class: 'tg-link-box' }, [
        h('b', {}, 'Telegram va kabinet'),
        h('div', { class: 'small' }, tg
          ? ['Bog’langan', tg.username ? ' (@' + tg.username + ')' : '', tg.linkedAt ? ' · ' + tg.linkedAt : ''].join('')
          : 'Hali bog’lanmagan'),
        h('p', { class: 'small muted', style: 'margin:6px 0 0' },
          'Bir martalik havola yarating va o’quvchiga bering. Havola 24 soat amal qiladi, ' +
          'bir marta ishlaydi va kabinetni ham ochadi.')
      ]),
      linkBox
    ];

    function makeLink(btn) {
      UI.busy(btn, async function () {
        try {
          var r = await D.api('POST', 'api/student/link', { studentId: s.id });
          var url = r.url || (location.origin + location.pathname + '#kabinet?t=' + r.token);
          linkBox.hidden = false;
          UI.clear(linkBox);
          linkBox.appendChild(h('div', {}, [
            h('b', {}, 'Havola (bir marta ishlaydi): '),
            h('span', { class: 'muted', style: 'word-break:break-all' }, url),
            h('div', { style: 'margin-top:6px' },
              h('button', {
                class: 'btn sm', type: 'button', onclick: function () { UI.copy(url); }
              }, 'Nusxalash'))
          ]));
          UI.toast('Havola tayyor. Uni faqat o’quvchiga bering.', 'ok');
        } catch (e) { UI.toast(e.message || 'Havola yaratilmadi.', 'bad'); }
      });
    }

    function unlink(close, btn) {
      UI.confirm('Bog’lanishni bekor qilish',
        'O’quvchining Telegram hisobi uziladi va kabinet sessiyalari yopiladi. Davom etamizmi?',
        'Ha, bekor qilinsin', true).then(function (yes) {
          if (!yes) return;
          UI.busy(btn, async function () {
            try {
              await D.api('POST', 'api/student/unlink', { studentId: s.id });
              var cur = A.clone(D.one('students', s.id) || s);
              delete cur.telegram;
              D.putLocal('students', cur);
              close(true);
              UI.toast('Bog’lanish bekor qilindi.', 'ok');
              App.render();
            } catch (e) { UI.toast(e.message || 'Bekor qilinmadi.', 'bad'); }
          });
        });
    }

    var m = UI.modal({
      title: s.lastName + ' ' + s.firstName + ' — kod va ulanish',
      body: body,
      actions: [
        App.can('student.edit') ? {
          label: 'Bog’lash havolasi', cls: 'primary', onClick: function (close, btn) { makeLink(btn); }
        } : null,
        (App.can('student.edit') && tg) ? {
          label: 'Bog’lanishni bekor qilish', cls: 'danger', onClick: unlink
        } : null,
        App.can('student.edit') ? {
          label: 'Yangi kod berish', onClick: function (close, btn) {
            UI.confirm('Kodni yangilash',
              'Eski kod ishlamay qoladi. O’quvchiga yangi kodni aytishingiz kerak. Davom etamizmi?',
              'Ha, yangilansin', true).then(function (yes) {
                if (!yes) return;
                UI.busy(btn, async function () {
                  try {
                    var r = await D.api('POST', 'api/student/code', { studentId: s.id });
                    var cur = A.clone(D.one('students', s.id) || s);
                    cur.code = r.code;
                    D.putLocal('students', cur);
                    close(true);
                    UI.toast('Yangi kod: ' + r.code, 'ok');
                    App.render();
                  } catch (e) { UI.toast(e.message || 'Yangilanmadi.', 'bad'); }
                });
              });
          }
        } : null,
        { label: 'Yopish', cls: 'primary' }
      ].filter(Boolean)
    });
    return m;
  }

  A.Pages.student = function (view, route, App) {
    App.guard('student.view');
    var s = D.one('students', route.id);
    if (!s) { view.appendChild(UI.empty({ title: 'O’quvchi topilmadi' })); return; }
    var tab = route.tab || 'umumiy';
    var bal = Q.balance(s.id);
    var over = Q.overdue(s.id);

    view.appendChild(h('button', { class: 'btn ghost sm', style: 'margin-bottom:8px', onclick: function () { App.go('students'); } },
      [UI.icon('back'), 'O’quvchilar']));

    view.appendChild(UI.pageHead(s.lastName + ' ' + s.firstName,
      (s.phone || '') + (s.parentName ? ' · Ota-ona: ' + s.parentName + ' ' + (s.parentPhone || '') : ''),
      [
        s.code ? h('button', {
          class: 'btn', title: 'Shaxsiy kod — bot va kabinet uchun',
          onclick: function () { codeCard(s, App); }
        }, [UI.icon('key'), h('span', { class: 'code-chip' }, String(s.code))]) : null,
        (App.can('student.edit') && D.mode === 'server') ? h('button', {
          class: 'btn', title: 'Veb-kabinet uchun login va yangi parol',
          onclick: function () { A.kabCreds(s); }
        }, [UI.icon('person'), 'Login / parol']) : null,
        // Asosiy amallar pastdagi tezkor kartada — bu yerda faqat tahrirlash
        App.can('student.edit') ? h('button', { class: 'btn', onclick: function () { A.studentForm(s, App); } },
          [UI.icon('edit'), 'Tahrirlash']) : null,
        (App.can('student.edit') && ['direktor', 'admin'].indexOf(App.user.role) >= 0) ? h('button', {
          class: 'btn danger', onclick: function () { deleteStudent(s, App); }
        }, 'O’chirish') : null
      ]));

    /* --- Tezkor karta: eng kerakli ma'lumot va uchta amal --- */
    view.appendChild(quickCard(s, bal, over, App));

    var tiles = h('div', { class: 'tiles' });
    tiles.appendChild(UI.tile({ label: 'Holat', value: s.status === 'faol' ? 'Faol' : (s.status === 'toxtatgan' ? 'To’xtatgan' : 'Arxiv') }));
    tiles.appendChild(UI.tile({ label: 'Faol guruhlar', value: Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; }).length }));
    if (App.can('finance.debts') || App.can('payment.create')) {
      tiles.appendChild(UI.tile({ label: 'Hisoblangan', value: A.som(bal.charged), hint: 'so’m' }));
      tiles.appendChild(UI.tile({ label: 'To’langan', value: A.som(bal.received), hint: 'so’m', cls: 'money' }));
      tiles.appendChild(UI.tile({
        label: bal.advance > 0 ? 'Balansda' : (over > 0 ? 'Qarz' : (bal.debt > 0 ? 'To’lov kutilmoqda' : 'Qarz')),
        value: A.som(bal.advance > 0 ? bal.advance : (over > 0 ? over : bal.debt)),
        hint: over > 0 ? 'to’lov kuni o’tgan' : 'so’m', cls: over > 0 ? 'alert' : ''
      }));
    }
    view.appendChild(tiles);

    var tabItems = [
      { id: 'umumiy', label: 'Umumiy' },
      { id: 'guruhlar', label: 'Guruhlar' },
      { id: 'davomat', label: 'Davomat' }
    ];
    if (App.can('finance.debts') || App.can('payment.create')) {
      tabItems.push({ id: 'hisoblar', label: 'Hisoblangan to’lovlar' });
      tabItems.push({ id: 'tolovlar', label: 'To’lovlar tarixi' });
    }
    view.appendChild(UI.tabs(tabItems, tab, function (id) { App.go('student', { id: s.id, tab: id }); }));

    if (tab === 'umumiy') {
      var dl = h('dl', { class: 'kv' });
      [['Familiya, ism', s.lastName + ' ' + s.firstName],
      ['Shaxsiy kod', s.code || '—'],
      ['Telefon', s.phone ? UI.phoneLink(s.phone) : '—'],
      ['Ota-ona / vasiy', s.parentName || '—'],
      ['Ota-ona telefoni', s.parentPhone ? UI.phoneLink(s.parentPhone) : '—'],
      ['Qo’shilgan sana', (s.joinDate || s.createdAt) ? A.dateLabel(String(s.joinDate || s.createdAt).slice(0, 10)) +
        ' · har oy ' + Math.min(28, Number(String(s.joinDate || s.createdAt).slice(8, 10)) || 1) + '-sanada to’laydi' : '—'],
      ['Qo’shilgan', s.createdAt || '—'],
      ['Izoh', s.note || '—']].forEach(function (r) {
        dl.appendChild(h('dt', {}, r[0]));
        dl.appendChild(h('dd', {}, r[1]));
      });
      var actions = h('div', { class: 'rowflex', style: 'margin-top:14px' }, [
        App.can('student.edit') && s.status !== 'arxiv' ? h('button', {
          class: 'btn', onclick: async function () {
            var next = s.status === 'faol' ? 'toxtatgan' : 'faol';
            if (await UI.confirm(next === 'faol' ? 'Qayta faollashtirish' : 'Vaqtincha to’xtatish',
              next === 'faol' ? 'O’quvchi yana faol bo’ladi.' : 'O’quvchi vaqtincha to’xtatiladi. Hisoblari saqlanadi.')) {
              s.status = next; await D.save('students', s);
              await A.Ops.audit(App.user, 'O’quvchi holati o’zgardi', Q.studentName(s.id), next);
              UI.toast('Saqlandi.', 'ok'); App.render();
            }
          }
        }, s.status === 'faol' ? 'Vaqtincha to’xtatish' : 'Qayta faollashtirish') : null,
        App.can('student.edit') ? h('button', {
          class: 'btn danger', onclick: async function () {
            if (s.status === 'arxiv') {
              s.status = 'faol'; await D.save('students', s); UI.toast('Arxivdan qaytarildi.', 'ok'); App.render(); return;
            }
            if (await UI.confirm('Arxivlash', 'O’quvchi arxivga o’tadi. Davomat va hisob-kitoblar saqlanib qoladi.', 'Arxivlash', true)) {
              s.status = 'arxiv';
              await D.save('students', s);
              var mems = Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; });
              for (var i = 0; i < mems.length; i++) {
                mems[i].status = 'chiqgan'; mems[i].leftAt = A.today();
                await D.save('memberships', mems[i]);
              }
              await A.Ops.audit(App.user, 'O’quvchi arxivlandi', Q.studentName(s.id), '');
              UI.toast('Arxivlandi.', 'ok'); App.render();
            }
          }
        }, s.status === 'arxiv' ? 'Arxivdan qaytarish' : 'Arxivlash') : null
      ]);
      /* Bog'lanish tugmalari — kartaning eng tepasida, qidirmasdan bosiladi */
      var quick = UI.contactBtns(s.parentPhone || s.phone);
      var quickRow = quick
        ? h('div', { class: 'quick-contact with-label' }, [
          h('span', { class: 'qc-label' }, s.parentPhone ? 'Ota-onaga' : 'O’quvchiga'),
          quick
        ])
        : null;
      view.appendChild(UI.card('Umumiy ma’lumot', [quickRow, dl, actions].filter(Boolean)));
    }

    if (tab === 'guruhlar') {
      var mems = Q.membershipsOf(s.id);
      view.appendChild(UI.card('Guruhlar',
        mems.length ? UI.table([
          { label: 'Guruh', render: function (m) { return h('b', {}, Q.groupName(m.groupId)); } },
          { label: 'Kurs', render: function (m) { var g = D.one('groups', m.groupId); return g ? Q.courseName(g.courseId) : '—'; } },
          { label: 'Kirgan', render: function (m) { return A.dateLabel(m.joinedAt); } },
          { label: 'Chiqqan', render: function (m) { return m.leftAt ? A.dateLabel(m.leftAt) : '—'; } },
          {
            label: 'Chegirma', render: function (m) {
              if (!m.discount || !m.discount.value) return h('span', { class: 'muted' }, '—');
              return UI.pill(m.discount.type === 'percent' ? m.discount.value + '%' : A.som(m.discount.value) + ' so’m', 'info');
            }
          },
          { label: 'Holat', render: function (m) { return m.status === 'faol' ? UI.pill('Faol', 'ok') : UI.pill('Chiqqan', 'mute'); } },
          {
            label: '', right: true, render: function (m) {
              if (!App.can('student.edit')) return '';
              return h('button', { class: 'btn sm', onclick: function () { A.membershipForm(s, m, App); } }, 'Ochish');
            }
          }
        ], mems) : UI.empty({
          title: 'Guruhga yozilmagan',
          text: 'O’quvchini guruhga yozing — shundan keyin unga oylik hisob yaratiladi.',
          action: App.can('student.edit') ? { label: 'Guruhga yozish', onClick: function () { A.membershipForm(s, null, App); } } : null
        }), null, null, true));
    }

    if (tab === 'davomat') {
      var rows = [];
      Q.membershipsOf(s.id).forEach(function (m) {
        var g = D.one('groups', m.groupId);
        if (!g) return;
        var months = {};
        Object.keys(D.docs).forEach(function (p) {
          if (p.indexOf('lessons/' + g.id + '__') === 0) months[p.split('__')[1]] = 1;
        });
        months[A.thisMonth()] = 1;
        Object.keys(months).forEach(function (ym) {
          var doc = D.lessonsCached(g.id, ym);
          A.monthLessons(g, ym, doc).forEach(function (l) {
            if (!l.attendance || !l.attendance[m.id]) return;
            rows.push({ date: l.date, group: g.name, status: l.attendance[m.id].status });
          });
        });
      });
      rows = A.sortBy(rows, 'date', 'desc');
      var st = A.attendanceStats(rows);
      view.appendChild(UI.card('Davomat', [
        h('div', { class: 'rowflex', style: 'margin-bottom:12px' }, [
          UI.pill('Keldi: ' + st.keldi, 'ok'), UI.pill('Kelmadi: ' + st.kelmadi, 'bad'),
          UI.pill('Kechikdi: ' + st.kechikdi, 'warn'), UI.pill('Sababli: ' + st.sababli, 'info')
        ]),
        rows.length ? UI.table([
          { label: 'Sana', render: function (r) { return A.dateLabel(r.date); } },
          { label: 'Guruh', key: 'group' },
          { label: 'Belgi', render: function (r) { var a = A.ATT[r.status]; return UI.pill(a ? a.label : r.status, a ? a.cls : 'mute'); } }
        ], rows.slice(0, 60)) : h('p', { class: 'muted' }, 'Hali davomat yozuvi yo’q.')
      ]));
    }

    if (tab === 'hisoblar') {
      var paidMap = A.paidByInvoice(A.Fin.allPayments());
      var invs = A.sortBy(A.Fin.allInvoices().filter(function (i) { return i.studentId === s.id; }), 'month', 'desc');
      view.appendChild(UI.card('Hisoblangan o’quv to’lovlari',
        invs.length ? UI.table([
          { label: 'Oy', render: function (i) { return A.monthLabel(i.month); } },
          { label: 'Guruh', render: function (i) { return Q.groupName(i.groupId); } },
          { label: 'Asos', right: true, render: function (i) { return h('span', { class: 'mono' }, A.som(i.base)); } },
          { label: 'Chegirma', right: true, render: function (i) { return h('span', { class: 'mono' }, i.discount ? '−' + A.som(i.discount) : '—'); } },
          { label: 'Hisob', right: true, render: function (i) { return h('span', { class: 'mono strong' }, A.som(i.final)); } },
          { label: 'To’langan', right: true, render: function (i) { return h('span', { class: 'mono' }, A.som(paidMap[i.id] || 0)); } },
          {
            label: 'Qolgan', right: true, render: function (i) {
              var r = A.invoiceRemaining(i, paidMap);
              return r > 0 ? UI.pill(A.som(r), A.invoiceOverdueAmount(i, paidMap, A.today()) > 0 ? 'bad' : 'warn') : UI.pill('To’langan', 'ok');
            }
          },
          { label: 'Muddat', render: function (i) { return A.dateLabel(i.dueDate); } }
        ], invs) : h('p', { class: 'muted' }, 'Hisob yaratilmagan.'), null, null, true));
    }

    if (tab === 'tolovlar') {
      var pays = A.sortBy(A.Fin.allPayments().filter(function (p) { return p.studentId === s.id; }), 'date', 'desc');
      view.appendChild(UI.card('To’lovlar tarixi',
        pays.length ? UI.table([
          { label: 'Sana', render: function (p) { return A.dateLabel(p.date); } },
          { label: 'Chek', render: function (p) { return h('span', { class: 'mono small' }, p.receiptNo); } },
          {
            label: 'Turi', render: function (p) {
              if (p.type === 'refund') return UI.pill('Qaytarish', 'bad');
              if (p.type === 'advance') return UI.pill('Avansdan qoplash', 'info');
              return UI.pill('To’lov', 'ok');
            }
          },
          {
            label: 'Usul', render: function (p) {
              return ({ naqd: 'Naqd', karta: 'Karta', bank: 'Bank o’tkazmasi', avans: 'Avansdan' })[p.method] || p.method;
            }
          },
          {
            label: 'Summa', right: true, render: function (p) {
              if (p.type === 'advance') {
                var used = p.applied || (p.allocations || []).reduce(function (t, a) { return t + a.amount; }, 0);
                return h('span', { class: 'mono', title: 'Yangi pul emas — avansdan hisobga o’tkazildi' }, A.som(used) + '*');
              }
              return h('span', { class: 'mono strong', style: p.voided ? 'text-decoration:line-through;opacity:.6' : '' },
                (p.type === 'refund' ? '−' : '') + A.som(p.amount));
            }
          },
          { label: 'Holat', render: function (p) { return p.voided ? UI.pill('Bekor qilingan', 'mute') : UI.pill('Amalda', 'ok'); } },
          {
            label: '', right: true, render: function (p) {
              return h('button', { class: 'btn sm', onclick: function () { A.receiptModal(p, App); } }, 'Chek');
            }
          }
        ], pays) : h('p', { class: 'muted' }, 'To’lov yo’q.'), null, null, true));

      /* --- Avans tarixi: qancha kelgan, qancha ishlatilgan, qancha qolgan --- */
      var advUsed = pays.filter(function (p) { return p.type === 'advance' && !p.voided; });
      var usedSum = advUsed.reduce(function (t, p) {
        return t + (p.applied || (p.allocations || []).reduce(function (x, a) { return x + a.amount; }, 0));
      }, 0);
      if (bal.advance > 0 || usedSum > 0) {
        view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Avans', [
          h('div', { class: 'rowflex', style: 'margin-bottom:10px' }, [
            UI.pill('Hozirgi avans: ' + A.som(bal.advance) + ' so’m', bal.advance > 0 ? 'info' : 'mute'),
            UI.pill('Qoplashga ishlatilgan: ' + A.som(usedSum) + ' so’m', 'mute')
          ]),
          advUsed.length ? UI.table([
            { label: 'Sana', render: function (p) { return A.dateLabel(p.date); } },
            {
              label: 'Qaysi hisoblarga', render: function (p) {
                return (p.allocations || []).map(function (a) {
                  var inv = A.Fin.invoicesById()[a.invoiceId];
                  return (inv ? A.monthLabel(inv.month) : '') + ' — ' + A.som(a.amount);
                }).join('; ');
              }
            },
            {
              label: 'Summa', right: true, render: function (p) {
                return h('span', { class: 'mono' }, A.som(p.applied ||
                  (p.allocations || []).reduce(function (x, a) { return x + a.amount; }, 0)));
              }
            },
            { label: 'Kim', render: function (p) { return h('span', { class: 'small muted' }, p.createdBy || '—'); } }
          ], advUsed) : h('p', { class: 'small muted', style: 'margin:0' },
            'Avans hali qoplashga ishlatilmagan.'),
          (bal.advance > 0 && App.can('payment.create') && Q.openInvoices(s.id).length) ? h('div', { style: 'margin-top:12px' },
            h('button', {
              class: 'btn primary', onclick: function () { A.advanceModal(s.id, App); }
            }, 'Avansdan qoplash')) : null,
          h('p', { class: 'small muted', style: 'margin:10px 0 0' },
            'Avansdan qoplash yangi tushum emas — pul allaqachon qabul qilingan, ' +
            'shuning uchun hisobotlarda daromad sifatida ikki marta ko’rinmaydi.')
        ])));
      }
    }
  };

  /* ---------- O'quvchi shakli ---------- */
  A.studentForm = function (student, App) {
    App.guard('student.edit');
    var isNew = !student || !student.id;
    var fromLead = student && student._fromLead;
    var draft = student || {};
    var f = UI.form([
      { name: 'lastName', label: fromLead ? 'Familiya (ixtiyoriy)' : 'Familiya', required: !fromLead, value: draft.lastName },
      { name: 'firstName', label: 'Ism', required: true, value: draft.firstName },
      {
        name: 'phone', label: 'Telefon', required: true, value: draft.phone, placeholder: '+998 90 123 45 67',
        validate: function (v) { return A.phoneDigits(v).length < 7 ? 'Raqam to’liq emas.' : null; }
      },
      { name: 'parentName', label: 'Ota-ona / vasiy ismi (ixtiyoriy)', value: draft.parentName },
      {
        name: 'parentPhone', label: 'Ota-ona telefoni (ixtiyoriy)', value: draft.parentPhone, placeholder: '+998 90 123 45 67',
        validate: function (v) { return v && A.phoneDigits(v).length < 7 ? 'Raqam to’liq emas.' : null; }
      },
      {
        /* Qo'shilgan sana — to'lov kuni shundan olinadi: 20-sida qo'shilsa,
           har oy 20-sida to'laydi. Guruhga yozishda shu sana ishlatiladi. */
        name: 'joinDate', label: 'Qo’shilgan sana', type: 'date', required: true,
        value: draft.joinDate || (draft.createdAt ? String(draft.createdAt).slice(0, 10) : A.today()),
        help: 'Har oy shu kunda to’laydi (masalan 20-sida qo’shilsa — har oy 20-sida).'
      },
      {
        name: 'region', label: 'Hudud (viloyat)', type: 'select', value: draft.region,
        options: [{ value: '', label: '— tanlanmagan —' }].concat(A.REGIONS.map(function (r) { return { value: r, label: r }; }))
      },
      { name: 'district', label: 'Tuman / shahar (ixtiyoriy)', value: draft.district, placeholder: 'masalan: Yunusobod' },
      {
        /* Shaxsiy kod — markaz o'zi beradi. Bo'sh qoldirilsa server tanlaydi.
           Berilgan kod o'zgarmaydi: bot ham, kabinet ham shu kod bilan ishlaydi. */
        name: 'code', label: 'Shaxsiy kod (5 ta raqam)', value: draft.code,
        placeholder: isNew ? 'bo’sh qoldirsangiz o’zi beriladi' : '',
        inputmode: 'numeric', maxlength: 5,
        help: 'Bot va kabinetga shu kod bilan kiriladi. O’zgartirsangiz eski kod ishlamay qoladi.',
        validate: function (v) {
          var c = String(v || '').replace(/\D/g, '');
          if (!c) return null;                       // bo'sh — server beradi
          /* Yangi kodlar 5 xonali. Eski o'quvchilarda 4 xonalisi
             qolgan bo'lishi mumkin — u ham qabul qilinadi, aks holda
             ularning kartasini saqlab ham bo'lmay qolardi.          */
          if (c.length !== 5 && c.length !== 4) return 'Kod 5 ta raqamdan iborat bo’lsin.';
          var dup = D.all('students').filter(function (x) {
            return x.id !== (student && student.id) && String(x.code || '') === c;
          });
          return dup.length
            ? 'Bu kod band: ' + dup[0].lastName + ' ' + dup[0].firstName
            : null;
        }
      },
      {
        name: 'status', label: 'Holat', type: 'select', value: draft.status || 'faol',
        options: [{ value: 'faol', label: 'Faol' }, { value: 'toxtatgan', label: 'Vaqtincha to’xtatgan' }, { value: 'arxiv', label: 'Arxivlangan' }]
      },
      { name: 'note', label: 'Izoh', type: 'textarea', value: draft.note, full: true }
    ]);

    var groupPick = null;
    if (isNew) {
      var opts = [{ value: '', label: '— keyinroq yozaman —' }].concat(
        D.all('groups').filter(function (g) { return g.status !== 'yakunlangan'; }).map(function (g) {
          return { value: g.id, label: g.name + ' · ' + A.som(g.fee) + ' so’m/oy' };
        }));
      groupPick = UI.field({ label: 'Darhol guruhga yozish', type: 'select', options: opts, full: true });
      if (draft._groupId) groupPick.input.value = draft._groupId;
      if (draft._courseId && !draft._groupId) {
        var cand = D.all('groups').filter(function (g) { return g.courseId === draft._courseId && g.status !== 'yakunlangan'; })[0];
        if (cand) groupPick.input.value = cand.id;
      }
      f.node.appendChild(groupPick.wrap);
    }

    var dup = h('div');
    function checkDup() {
      UI.clear(dup);
      var d = A.phoneDigits(f.get('phone').input.value) || A.phoneDigits(f.get('parentPhone').input.value);
      if (d.length < 7) return;
      var same = D.all('students').filter(function (x) {
        return x.id !== (student && student.id) && (A.phoneDigits(x.parentPhone) === d || A.phoneDigits(x.phone) === d);
      });
      if (same.length) {
        dup.appendChild(h('div', { class: 'banner warn', style: 'margin:0' }, h('div', {}, [
          h('b', {}, 'Bu raqamli o’quvchi bor: '),
          same.map(function (x) { return x.lastName + ' ' + x.firstName; }).join(', '),
          '. Aka-uka/opa-singil bo’lsa, davom etavering.'
        ])));
      }
    }
    f.get('parentPhone').input.addEventListener('blur', checkDup);
    f.get('phone').input.addEventListener('blur', checkDup);

    UI.modal({
      title: isNew ? 'Yangi o’quvchi' : 'O’quvchini tahrirlash',
      body: [f.node, dup],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Saqlash', cls: 'primary', onClick: function (c, btn) {
            if (!f.validate()) return;
            UI.busy(btn, async function () {
              var v = f.values();
              var rec = Object.assign({}, isNew ? {} : student, v, {
                phone: A.normPhone(v.phone), parentPhone: A.normPhone(v.parentPhone),
                /* Kod faqat raqam; bo'sh bo'lsa serverga qoldiriladi */
                code: String(v.code || '').replace(/\D/g, '')
              });
              if (!rec.code) delete rec.code;
              delete rec._fromLead; delete rec._courseId; delete rec._groupId; delete rec._stay;
              if (isNew) { rec.id = A.uid('stu'); rec.createdAt = A.nowStamp(); }
              await D.save('students', rec);
              await A.Ops.audit(App.user, isNew ? 'O’quvchi qo’shildi' : 'O’quvchi tahrirlandi', rec.lastName + ' ' + rec.firstName, '');
              if (fromLead) {
                /* Voronkadagi «yutuq» bosqichi (odatda «O'quvchi bo'ldi») — Meta'ga ham shu ketadi */
                var lf = D.one('funnels', fromLead.funnelId) || A.DEFAULT_FUNNELS.filter(function (x) { return x.id === fromLead.funnelId; })[0];
                var wonSt = lf ? A.funnelStages(lf).filter(function (x) { return x.type === 'won'; })[0] : null;
                var fresh = D.one('leads', fromLead.id) || fromLead;
                fresh = Object.assign({}, fresh, { prevStage: fresh.stage, stage: wonSt ? wonSt.id : 'oquvchi', studentId: rec.id });
                await D.save('leads', fresh);
              }
              var gid = groupPick && groupPick.input.value;
              c();
              UI.toast('Saqlandi.', 'ok');
              /* Yangi o'quvchi: kabinet uchun login va parol darhol beriladi */
              if (isNew && D.mode === 'server') {
                try { A.kabCreds(D.one('students', rec.id) || rec, { isNew: true }); } catch (e) { }
              }
              var stay = !!(draft && draft._stay);
              if (gid) {
                A.membershipForm(rec, { groupId: gid, joinedAt: rec.joinDate }, App, stay ? { stay: true } : null);
              } else if (stay) {
                App.render();
                UI.toast((rec.firstName || '') + ' o’quvchilar ro’yxatiga qo’shildi.', 'ok');
              } else {
                App.go('student', { id: rec.id });
              }
            });
          }
        }
      ]
    });
  };

  global.A.stageLabel = stageLabel;
  global.A.leadForm = leadForm;
})(typeof window !== 'undefined' ? window : globalThis);
