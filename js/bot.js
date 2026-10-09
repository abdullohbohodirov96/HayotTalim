/* Albyana ERP — Telegram bot bilan bog'liq qism (ilova tomoni).
   Bot serveri (server/bot.js) shu yozuvlarni o'qib, Telegramga yuboradi. */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;
  var Q;
  A.Pages = A.Pages || {};

  var KINDS = [
    { id: 'davomat', label: 'Davomat belgilanganda' },
    { id: 'tolov', label: 'To’lov qabul qilinganda' },
    { id: 'qarz', label: 'To’lov muddati o’tganda (eslatma)' },
    { id: 'elon', label: 'E’lon va umumiy xabarlar' },
    { id: 'ulash', label: 'Hisob ulanganda' }
  ];

  function settings() {
    var s = (D.settings && D.settings.bot) || {};
    var n = s.notify || {};
    function on(id, legacy) {
      if (n[id] != null) return n[id] !== false;
      if (legacy != null) return legacy !== false;
      return true;
    }
    return {
      username: s.username || '',
      welcome: s.welcome || 'Assalomu alaykum! Markazimiz botiga xush kelibsiz.',
      staffChats: s.staffChats || '',
      notify: {
        davomat: on('davomat', s.notifyAttendance),
        tolov: on('tolov', s.notifyPayment),
        qarz: on('qarz', s.notifyDebt),
        elon: on('elon'),
        ulash: on('ulash')
      },
      remindDays: Number(s.remindDays || 3),
      remindEvery: Number(s.remindEvery || 7),
      codeHours: Number(s.codeHours || 48),
      payCard: s.payCard || '',
      payHolder: s.payHolder || '',
      payBankChat: s.payBankChat || '',
      payPreDays: s.payPreDays == null ? 2 : Number(s.payPreDays)
    };
  }

  var Bot = {
    settings: settings,
    serverConnected: function () { return D.mode === 'server'; },

    /** Xabarni navbatga qo'yish — bot serveri uni yuboradi.
     *  Turi o'chirilgan bo'lsa yoki xuddi shu xabar yaqinda ketgan bo'lsa — qo'yilmaydi. */
    async enqueue(studentId, text, kind, opts) {
      var o = opts || {};
      var k = kind || 'elon';
      var conf = settings();
      if (conf.notify[k] === false) return false;
      var st = D.one('students', studentId);
      if (!st || !st.telegram || !st.telegram.id) return false;
      var key = o.dedupeKey || (k + ':' + st.telegram.id + ':' + A.textHash(text));
      var windowMs = o.windowMs == null ? 24 * 3600 * 1000 : o.windowMs;
      var limit = Date.now() - windowMs;
      var dup = D.all('botout').filter(function (m) {
        return m.dedupeKey === key && m.status !== 'failed' &&
          Date.parse(m.createdAt || 0) >= limit;
      })[0];
      if (dup) return false;
      await D.save('botout', {
        id: A.uid('out'),
        studentId: studentId,
        chatId: st.telegram.id,
        text: text,
        kind: k,
        dedupeKey: key,
        tries: 0,
        status: 'pending',
        createdAt: A.nowStamp()
      });
      return true;
    },

    /** Botda ro'yxatdan o'tgan murojaatga (lead) xabar — masalan bepul dars eslatmasi */
    async enqueueLead(lead, text) {
      if (!lead || !lead.chatId || String(lead.chatId).charAt(0) === '-') return false;
      var key = 'lead:' + lead.chatId + ':' + A.textHash(text);
      var limit = Date.now() - 24 * 3600 * 1000;
      var dup = D.all('botout').filter(function (m) {
        return m.dedupeKey === key && m.status !== 'failed' && Date.parse(m.createdAt || 0) >= limit;
      })[0];
      if (dup) return false;
      await D.save('botout', {
        id: A.uid('out'), leadId: lead.id, chatId: String(lead.chatId), text: text,
        kind: 'elon', dedupeKey: key, tries: 0, status: 'pending', createdAt: A.nowStamp()
      });
      return true;
    },

    /** Xato bilan tugagan xabarni qayta navbatga qo'yish */
    async retry(msg) {
      var rec = A.clone(msg);
      rec.status = 'pending';
      rec.tries = 0;
      rec.error = '';
      rec.nextTryAt = '';
      await D.save('botout', rec);
      return true;
    },

    /** O'quvchiga bir martalik ulash kodi berish */
    async makeCode(studentId) {
      var s = D.one('students', studentId);
      if (!s) throw new Error('O’quvchi topilmadi.');
      var conf = settings();
      var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      var code = '';
      for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      var rec = A.clone(s);
      rec.botLink = {
        code: code,
        createdAt: A.nowStamp(),
        expiresAt: new Date(Date.now() + conf.codeHours * 3600 * 1000).toISOString()
      };
      await D.save('students', rec);
      return code;
    },

    /** Davomat belgilanganda xabar */
    async notifyAttendance(groupId, date, records, actorName) {
      var conf = settings();
      if (!conf.notify.davomat) return;
      var g = D.one('groups', groupId);
      var labels = { keldi: 'darsda qatnashdi', kelmadi: 'darsga kelmadi', kechikdi: 'darsga kechikdi', sababli: 'sababli kelmadi' };
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (!r.status) continue;
        var st = D.one('students', r.studentId);
        if (!st || !st.telegram || !st.telegram.id) continue;
        await Bot.enqueue(r.studentId,
          'Davomat: ' + A.dateLabel(date) + '\n' +
          (g ? g.name + ' (' + (g.code || '') + ')' : '') + '\n' +
          st.firstName + ' ' + labels[r.status] + '.',
          'davomat');
      }
      void actorName;
    },

    /** To'lov qabul qilinganda xabar */
    async notifyPayment(payment) {
      var conf = settings();
      if (!conf.notify.tolov) return;
      var st = D.one('students', payment.studentId);
      if (!st || !st.telegram || !st.telegram.id) return;
      var bal = A.balanceOf(payment.studentId, A.Fin.allInvoices(), A.Fin.allPayments());
      await Bot.enqueue(payment.studentId,
        'To’lov qabul qilindi\n' +
        'Summa: ' + A.som(payment.amount) + ' so’m\n' +
        'Sana: ' + A.dateLabel(payment.date) + '\n' +
        'Chek: ' + payment.receiptNo + '\n' +
        (bal.debt > 0 ? 'Qolgan qarz: ' + A.som(bal.debt) + ' so’m' : 'Qarzingiz yo’q. Rahmat!'),
        'tolov');
    },

    /** Avansdan qoplanganda xabar */
    async notifyAdvance(rec) {
      var conf = settings();
      if (!conf.notify.tolov) return;
      var st = D.one('students', rec.studentId);
      if (!st || !st.telegram || !st.telegram.id) return;
      var bal = A.balanceOf(rec.studentId, A.Fin.allInvoices(), A.Fin.allPayments());
      var used = rec.applied || (rec.allocations || []).reduce(function (t, a) { return t + a.amount; }, 0);
      await Bot.enqueue(rec.studentId,
        'Avansingizdan ' + A.som(used) + ' so’m hisobga o’tkazildi.\n' +
        (bal.debt > 0 ? 'Qolgan qarz: ' + A.som(bal.debt) + ' so’m' : 'Qarzingiz yo’q.') +
        (bal.advance > 0 ? '\nQolgan avans: ' + A.som(bal.advance) + ' so’m' : ''),
        'tolov', { dedupeKey: 'avans:' + rec.id });
      return true;
    },

    pending: function () {
      return A.sortBy(D.all('botreq').filter(function (r) { return r.status === 'kutilmoqda'; }), 'createdAt', 'desc');
    },
    linkedStudents: function () {
      return D.all('students').filter(function (s) { return s.telegram && s.telegram.id; });
    },

    /* Tasdiqlash SERVERDA bajariladi: bog'lanishni mijoz o'zi yoza olmaydi
       (aks holda begona odam so'rovni o'ziga biriktirib olardi).            */
    async approve(req, studentId, App) {
      var st = D.one('students', studentId);
      if (!st) throw new Error('O’quvchi topilmadi.');
      await D.api('POST', 'api/student/link-approve', { reqId: req.id, studentId: studentId });
      var rec = A.clone(st);
      rec.telegram = { id: req.chatId, username: req.username || '', name: req.name || '', linkedAt: A.nowStamp() };
      D.putLocal('students', rec);
      var r = A.clone(req);
      r.status = 'tasdiqlangan';
      r.studentId = studentId;
      r.handledAt = A.nowStamp();
      D.putLocal('botreq', r);
      await Bot.enqueue(studentId,
        'Hisobingiz tasdiqlandi. Endi bu yerda davomat, to’lov va e’lonlarni olasiz.', 'ulash');
    },
    async reject(req, App) {
      var r = A.clone(req);
      r.status = 'rad';
      r.handledAt = A.nowStamp();
      await D.save('botreq', r);
      await A.Ops.audit(App.user, 'Bot: ulash so’rovi rad etildi', req.name || '', '');
    }
  };
  A.Bot = Bot;

  /* ================= BOT SAHIFASI ================= */
  A.Pages.bot = function (view, route, App) {
    App.guard('nav.bot');
    Q = A.Q;
    var tab = route.tab || 'holat';
    var conf = settings();
    var pending = Bot.pending();
    var linked = Bot.linkedStudents();
    var queue = D.all('botout').filter(function (m) { return m.status === 'pending'; });

    view.appendChild(UI.pageHead('Telegram bot',
      'O’quvchilar bot orqali davomat, to’lov va e’lonlarni oladi'));

    if (!Bot.serverConnected()) {
      view.appendChild(h('div', { class: 'banner warn' }, h('div', {}, [
        h('b', {}, 'Bot serveri ulanmagan. '),
        'Bu yerda tayyorlangan xabarlar navbatda saqlanadi va bot serveri ishga tushgach yuboriladi. ',
        'Serverni ishga tushirish yo’riqnomasi loyiha papkasidagi README faylida.'
      ])));
    }

    var tabs = [{ id: 'holat', label: 'Holat' }];
    if (App.can('bot.broadcast')) tabs.push({ id: 'xabar', label: 'Xabar yuborish' });
    tabs.push({ id: 'oquvchilar', label: 'Ulangan o’quvchilar' });
    if (App.can('payment.create') && D.mode === 'server') tabs.push({ id: 'karta', label: 'Karta to’lovlari' });
    if (App.can('bot.manage') && D.mode === 'server') tabs.push({ id: 'viktorina', label: 'Kanal viktorinasi' });
    if (App.can('bot.manage')) tabs.push({ id: 'sozlama', label: 'Sozlamalar' });
    view.appendChild(UI.tabs(tabs, tab, function (id) { App.go('bot', { tab: id }); }));

    if (tab === 'holat') {
      view.appendChild(h('div', { class: 'tiles' }, [
        UI.tile({ label: 'Ulangan o’quvchilar', value: linked.length, hint: D.all('students').length + ' tadan' }),
        UI.tile({ label: 'Ulash so’rovlari', value: pending.length, cls: pending.length ? 'alert' : '' }),
        UI.tile({ label: 'Navbatdagi xabarlar', value: queue.length }),
        UI.tile({ label: 'Bot manzili', value: conf.username ? '@' + conf.username.replace('@', '') : '—' })
      ]));

      view.appendChild(UI.card('Ulash so’rovlari',
        pending.length ? UI.table([
          { label: 'Vaqt', render: function (r) { return h('span', { class: 'mono small' }, r.createdAt); } },
          { label: 'Yozgan ism', render: function (r) { return h('b', {}, r.name || '—'); } },
          { label: 'Guruh kodi', render: function (r) { return UI.pill(r.groupCode || '—', 'info'); } },
          { label: 'Telegram', render: function (r) { return h('span', { class: 'mono small' }, r.username ? '@' + r.username : r.chatId); } },
          {
            label: 'Taklif', render: function (r) {
              var s = r.matchStudentId ? D.one('students', r.matchStudentId) : null;
              return s ? (s.lastName + ' ' + s.firstName) : h('span', { class: 'muted' }, 'Topilmadi');
            }
          },
          {
            label: '', right: true, render: function (r) {
              return h('div', { class: 'rowflex', style: 'justify-content:flex-end;gap:6px' }, [
                h('button', {
                  class: 'btn sm primary', onclick: function () { approveModal(r, App); }
                }, 'Ulash'),
                h('button', {
                  class: 'btn sm danger', onclick: function (e) {
                    UI.busy(e.currentTarget, async function () {
                      await Bot.reject(r, App);
                      UI.toast('Rad etildi.', 'ok'); App.render();
                    });
                  }
                }, 'Rad etish')
              ]);
            }
          }
        ], pending) : UI.empty({
          title: 'So’rov yo’q',
          text: 'O’quvchi botga /start bosib, ism-familiyasi va guruh kodini yozganda shu yerda paydo bo’ladi.'
        }), null, null, true));

      view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('O’quvchi botga qanday ulanadi', [
        h('ol', { style: 'margin:0;padding-left:18px;line-height:1.9' }, [
          h('li', {}, 'Siz "Sozlamalar" bo’limida o’quvchiga bir martalik kod berasiz (masalan 7KQ3M2).'),
          h('li', {}, 'O’quvchi botni ochadi va /start bosadi.'),
          h('li', {}, 'Bot kodni so’raydi. O’quvchi kodni yozadi — hisob darhol ulanadi.'),
          h('li', {}, 'Kodi bo’lmasa, "ismim" deb yozadi: ism va guruh kodini so’raydi, so’rov shu yerga tushadi.'),
          h('li', {}, 'Ism bo’yicha avtomatik ulash yo’q — har bir so’rovni siz tasdiqlaysiz.')
        ])
      ])));
    }

    if (tab === 'xabar') {
      App.guard('bot.broadcast');
      var groups = A.scopeGroups(App.user, D.all('groups').filter(function (g) { return g.status !== 'yakunlangan'; }));
      var target = UI.field({
        label: 'Kimga', type: 'select', options: [
          { value: 'all', label: 'Barcha ulangan o’quvchilar (' + linked.length + ')' },
          { value: 'debt', label: 'Faqat qarzdorlar' }
        ].concat(groups.map(function (g) {
          return { value: 'g:' + g.id, label: A.groupLabel(g) };
        }))
      });
      var text = UI.field({ label: 'Xabar matni', type: 'textarea', rows: 5, full: true, required: true });
      var countBox = h('div', { class: 'small muted' });

      function recipients() {
        var v = target.input.value;
        if (v === 'all') return linked;
        if (v === 'debt') {
          var debtors = {};
          A.Q.debtors().forEach(function (d) { debtors[d.studentId] = 1; });
          return linked.filter(function (s) { return debtors[s.id]; });
        }
        var gid = v.slice(2);
        var ids = {};
        A.Q.membersOf(gid).forEach(function (m) { ids[m.studentId] = 1; });
        return linked.filter(function (s) { return ids[s.id]; });
      }
      function refreshCount() {
        countBox.textContent = recipients().length + ' ta o’quvchiga yuboriladi.';
      }
      target.input.addEventListener('change', refreshCount);
      refreshCount();

      view.appendChild(UI.card('Xabar yuborish', [
        h('div', { class: 'form-grid' }, [target.wrap, text.wrap]),
        countBox,
        h('div', { style: 'margin-top:14px' }, h('button', {
          class: 'btn primary', onclick: function (e) {
            var msg = text.input.value.trim();
            if (!msg) { UI.toast('Xabar matnini yozing.', 'bad'); return; }
            var list = recipients();
            if (!list.length) { UI.toast('Qabul qiluvchi yo’q.', 'bad'); return; }
            UI.busy(e.currentTarget, async function () {
              for (var i = 0; i < list.length; i++) {
                await Bot.enqueue(list[i].id, msg, 'elon');
              }
              await A.Ops.audit(App.user, 'Botda xabar yuborildi', list.length + ' ta o’quvchi', msg.slice(0, 40));
              text.input.value = '';
              UI.toast(list.length + ' ta xabar navbatga qo’yildi.', 'ok');
              App.render();
            });
          }
        }, [UI.icon('chat'), 'Yuborish']))
      ]));

      var sent = A.sortBy(D.all('botout'), 'createdAt', 'desc').slice(0, 40);
      view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Oxirgi xabarlar',
        sent.length ? UI.table([
          { label: 'Vaqt', render: function (m) { return h('span', { class: 'mono small' }, m.createdAt); } },
          { label: 'O’quvchi', render: function (m) { return A.Q.studentName(m.studentId); } },
          { label: 'Turi', render: function (m) { return UI.pill(m.kind, 'mute'); } },
          { label: 'Matn', render: function (m) { return h('span', { class: 'small' }, String(m.text).slice(0, 60)); } },
          { label: 'Holat', render: function (m) { return statusPill(m); } },
          {
            label: '', right: true, render: function (m) {
              if (m.status !== 'failed' && m.status !== 'error') return '';
              return h('button', {
                class: 'btn sm', onclick: function (e) {
                  UI.busy(e.currentTarget, async function () {
                    await Bot.retry(m);
                    UI.toast('Qayta yuborishga qo’yildi.', 'ok');
                    App.render();
                  });
                }
              }, 'Qayta yuborish');
            }
          }
        ], sent) : h('p', { class: 'muted' }, 'Hali xabar yo’q.'), null, null, true)));
    }

    if (tab === 'karta') {
      var box = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
      view.appendChild(box);
      (async function () {
        var d;
        try { d = await D.api('GET', 'api/paybank'); }
        catch (e) { UI.clear(box); box.appendChild(h('p', { class: 'err-msg' }, e.message || 'Yuklanmadi.')); return; }
        UI.clear(box);
        var ST = { kutilmoqda: ['Summa berildi', ''], tolandi: ['«To’ladim» bosildi', 'warn'], tasdiqlandi: ['Tasdiqlandi', 'ok'], rad: ['Rad etildi', 'bad'], eskirdi: ['Eskirdi', ''] };
        var waiting = d.claims.filter(function (c) { return c.status === 'tolandi'; });
        var loose = d.txs.filter(function (t) { return t.status === 'mos-emas' || t.status === 'yangi'; });
        box.appendChild(h('div', { class: 'tiles' }, [
          UI.tile({ label: 'Avtomatik tasdiqlangan (30 kun)', value: d.claims.filter(function (c) { return c.status === 'tasdiqlandi' && !c.manual; }).length }),
          UI.tile({ label: '«To’ladim» — pul hali ko’rinmadi', value: waiting.length, cls: waiting.length ? 'alert' : '' }),
          UI.tile({ label: 'Egasi aniqlanmagan kirimlar', value: loose.length, cls: loose.length ? 'alert' : '' })
        ]));
        box.appendChild(h('div', { class: 'banner info', style: 'margin:12px 0' }, h('div', {}, [
          h('b', {}, 'Qanday ishlaydi: '),
          'o’quvchi botda «To’lov qilish 💳» ni bosadi → unga karta raqami va aniq summa (masalan 400 037) chiqadi → ',
          'pul kartaga tushganda bank bildirishnomasi kanalga keladi → bot summani tanib, to’lovni o’zi yozadi va o’quvchiga ',
          'kvitansiya hamda keyingi to’lov sanasini yuboradi. Faqat mos kelmagan holatlar shu yerda qo’lda hal qilinadi.'
        ])));
        function act(body, msg) {
          return async function (e) {
            var btn = e.currentTarget;
            UI.busy(btn, async function () {
              try { await D.api('POST', 'api/paybank/confirm', body); UI.toast(msg || 'Tasdiqlandi.', 'ok'); App.render(); }
              catch (ex) { UI.toast(ex.message || 'Xato.', 'bad'); }
            });
          };
        }
        box.appendChild(UI.card('O’quvchilar da’volari', d.claims.length ? UI.table([
          { label: 'O’quvchi', render: function (c) { return h('b', {}, c.name); } },
          { label: 'Summa', render: function (c) { return h('span', { class: 'mono' }, A.som(c.amount)); } },
          { label: 'Vaqt', render: function (c) { return h('span', { class: 'small muted' }, c.paidPressedAt || c.createdAt); } },
          { label: 'Holat', render: function (c) { var t = ST[c.status] || [c.status, '']; return UI.pill ? UI.pill(t[0] + (c.receiptNo ? ' · ' + c.receiptNo : ''), t[1]) : t[0]; } },
          {
            label: '', right: true, render: function (c) {
              if (c.status !== 'kutilmoqda' && c.status !== 'tolandi') return '';
              return h('div', { class: 'rowflex', style: 'gap:6px;justify-content:flex-end' }, [
                h('button', { class: 'btn sm', onclick: async function (e) {
                  e.stopPropagation();
                  try { await D.api('POST', 'api/paybank/reject', { claimId: c.id }); App.render(); } catch (ex) { UI.toast(ex.message, 'bad'); }
                } }, 'Rad'),
                h('button', { class: 'btn sm primary', onclick: function (e) { e.stopPropagation(); act({ claimId: c.id })(e); } }, 'Pul keldi — tasdiqlash')
              ]);
            }
          }
        ], d.claims) : UI.empty({ title: 'Hali da’vo yo’q', text: 'O’quvchilar botda «To’lov qilish» ni bosganda shu yerda ko’rinadi.' })));
        box.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Kartaga tushgan pullar (bildirishnoma kanalidan)', d.txs.length ? UI.table([
          { label: 'Summa', render: function (t) { return h('b', { class: 'mono' }, A.som(t.amount)); } },
          { label: 'Karta', render: function (t) { return t.card4 ? '*' + t.card4 : '—'; } },
          { label: 'Vaqt', render: function (t) { return h('span', { class: 'small muted' }, t.at); } },
          { label: 'Holat', render: function (t) { return t.status === 'mos' ? 'Biriktirildi' : 'Egasi aniqlanmadi'; } },
          {
            label: '', right: true, render: function (t) {
              if (t.status === 'mos') return '';
              var sel = h('select', { class: 'sm' }, [h('option', { value: '' }, 'O’quvchini tanlang…')].concat(
                D.all('students').filter(function (s) { return s.status === 'faol'; })
                  .sort(function (a, b) { return (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName); })
                  .map(function (s) { return h('option', { value: s.id }, s.lastName + ' ' + s.firstName); })));
              return h('div', { class: 'rowflex', style: 'gap:6px;justify-content:flex-end' }, [sel,
                h('button', { class: 'btn sm primary', onclick: function (e) {
                  e.stopPropagation();
                  if (!sel.value) { UI.toast('O’quvchini tanlang.', 'bad'); return; }
                  act({ txId: t.id, studentId: sel.value }, 'Biriktirildi.')(e);
                } }, 'Biriktirish')
              ]);
            }
          }
        ], d.txs) : UI.empty({ title: 'Bildirishnoma kelmagan', text: 'Sozlamalarda bildirishnoma kanalini kiriting va botni kanalga administrator qiling.' }))));
      })();
    }

    if (tab === 'oquvchilar') {
      view.appendChild(UI.card(null, linked.length ? UI.table([
        { label: 'O’quvchi', render: function (s) { return h('b', {}, s.lastName + ' ' + s.firstName); } },
        {
          label: 'Guruhlar', render: function (s) {
            return A.Q.membershipsOf(s.id).filter(function (m) { return m.status === 'faol'; })
              .map(function (m) { return A.groupLabel(D.one('groups', m.groupId)); }).join(', ') || '—';
          }
        },
        { label: 'Telegram', render: function (s) { return h('span', { class: 'mono small' }, s.telegram.username ? '@' + s.telegram.username : s.telegram.id); } },
        { label: 'Ulangan', render: function (s) { return h('span', { class: 'small muted' }, s.telegram.linkedAt || '—'); } },
        {
          label: '', right: true, render: function (s) {
            if (!App.can('bot.manage')) return '';
            return h('button', {
              class: 'btn sm danger', onclick: async function () {
                if (!await UI.confirm('Ulanishni uzish', 'O’quvchi endi botdan xabar olmaydi.', 'Uzish', true)) return;
                var rec = A.clone(s); delete rec.telegram;
                await D.save('students', rec);
                UI.toast('Uzildi.', 'ok'); App.render();
              }
            }, 'Uzish');
          }
        }
      ], linked, { onRow: function (s) { App.go('student', { id: s.id }); } })
        : UI.empty({ title: 'Ulangan o’quvchi yo’q', text: 'O’quvchilar botga /start bosishi kerak.' }), null, null, true));
    }

    if (tab === 'viktorina') {
      App.guard('bot.manage');
      var vbox = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
      view.appendChild(vbox);
      (async function () {
        var r;
        try { r = await D.api('GET', 'api/kanal-quiz'); }
        catch (e) { UI.clear(vbox); vbox.appendChild(h('div', { class: 'err-msg' }, e.message || 'Yuklanmadi.')); return; }
        UI.clear(vbox);
        var items = r.items || [], conf = r.conf || {};
        var waiting = items.filter(function (q) { return !q.sentAt; });
        var onF = UI.field({ label: 'Holat', type: 'select', value: conf.on ? '1' : '0',
          options: [{ value: '1', label: 'Yoqilgan — har kuni avtomatik' }, { value: '0', label: 'O’chirilgan' }] });
        var chF = UI.field({ label: 'Kanal (bot kanalda administrator bo’lishi kerak)', value: conf.channel || '@SaboAcademy', placeholder: '@SaboAcademy' });
        var stF = UI.field({ label: 'Boshlanish sanasi', type: 'date', value: conf.start || '' });
        vbox.appendChild(h('div', { class: 'tiles' }, [
          UI.tile({ label: 'Jami savollar', value: items.length }),
          UI.tile({ label: 'Navbatda', value: waiting.length, hint: Math.floor(waiting.length / Math.max(1, (conf.slots || []).length)) + ' kunlik' }),
          UI.tile({ label: 'Yuborish vaqtlari', value: (conf.slots || []).join(' · ') || '—', hint: 'Toshkent vaqti' }),
          UI.tile({ label: 'Kanal', value: conf.channel || '—', hint: conf.start ? conf.start + ' dan boshlab' : '' })
        ]));
        vbox.appendChild(UI.card('Sozlama', [
          h('p', { class: 'small muted' }, 'Bot har kuni belgilangan vaqtlarda kanalga bittadan Telegram «Quiz» (viktorina) so’rovnomasi yuboradi. ' +
            'Savollar tugasa — eng eski yuborilganlaridan qayta boshlaydi.'),
          onF.wrap, chF.wrap, stF.wrap,
          h('div', { class: 'rowflex', style: 'gap:8px;flex-wrap:wrap' }, [
            h('button', { class: 'btn primary', type: 'button', onclick: function (e) {
              UI.busy(e.currentTarget, async function () {
                try { await D.api('POST', 'api/kanal-quiz/config', { on: onF.input.value === '1', channel: chF.input.value, start: stF.input.value }); UI.toast('Saqlandi.', 'ok'); App.render(); }
                catch (ex) { UI.toast(ex.message || 'Saqlanmadi.', 'bad'); }
              });
            } }, 'Saqlash'),
            h('button', { class: 'btn', type: 'button', onclick: function (e) {
              UI.confirm('Hozir yuborish', 'Navbatdagi savol hozir kanalga yuboriladi. Davom etamizmi?', 'Ha, yuborilsin').then(function (yes) {
                if (!yes) return;
                UI.busy(e.currentTarget, async function () {
                  try { var x = await D.api('POST', 'api/kanal-quiz/send', {}); UI.toast('Yuborildi: ' + x.id, 'ok'); App.render(); }
                  catch (ex) { UI.toast(ex.message || 'Yuborilmadi.', 'bad'); }
                });
              });
            } }, 'Navbatdagisini hozir yuborish')
          ])
        ], null, null, true));
        var ta = h('textarea', { rows: 6, placeholder: '[{"id":"w2d1s1","kind":"Lug‘at","question":"…","options":["…","…"],"correct":0,"explain":"…"}]', style: 'width:100%;font-family:monospace;font-size:12px' });
        vbox.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Savollarni qo’shish (har hafta)', [
          h('p', { class: 'small muted' }, 'Yangi haftaning savollarini JSON ko’rinishida qo’ying: id, question, options (2–10), correct (0 dan), explain.'),
          ta,
          h('button', { class: 'btn primary', type: 'button', style: 'margin-top:8px', onclick: function (e) {
            var list;
            try { list = JSON.parse(ta.value); } catch (ex) { UI.toast('JSON xato: ' + ex.message, 'bad'); return; }
            UI.busy(e.currentTarget, async function () {
              try { var x = await D.api('POST', 'api/kanal-quiz/add', { items: list });
                UI.toast(x.added + ' ta qo’shildi' + (x.bad.length ? ', xato: ' + x.bad.join(', ') : ''), x.bad.length ? 'warn' : 'ok'); App.render(); }
              catch (ex) { UI.toast(ex.message || 'Qo’shilmadi.', 'bad'); }
            });
          } }, 'Qo’shish')
        ], null, null, true)));
        vbox.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Savollar', UI.table([
          { label: '#', render: function (q, i) { return h('span', { class: 'mono small' }, q.id); } },
          { label: 'Turi', render: function (q) { return UI.pill(q.kind || '—', 'info'); } },
          { label: 'Savol', render: function (q) {
            return h('div', {}, [h('b', { dir: 'auto' }, q.question),
              h('div', { class: 'small muted', dir: 'auto' }, q.options.map(function (o, i) { return (i === q.correct ? '✅ ' : '▫️ ') + o; }).join('   '))]);
          } },
          { label: 'Holat', render: function (q) { return q.sentAt ? UI.pill('Yuborilgan ' + q.sentAt, 'ok') : UI.pill('Navbatda', 'warn'); } }
        ], items), null, null, true)));
      })();
    }

    if (tab === 'sozlama') {
      App.guard('bot.manage');
      var fields = [
        {
          name: 'username', label: 'Bot manzili (@siz)', value: conf.username,
          placeholder: 'markaz_bot', help: 'BotFather bergan bot nomi'
        },
        { name: 'welcome', label: 'Salomlashuv matni', type: 'textarea', value: conf.welcome, full: true },
        {
          name: 'staffChats', label: 'Administrator Telegram chat raqami',
          value: conf.staffChats || '',
          help: 'Yangi arizalar shu suhbatga keladi. Shu chatda botga /start bosilsa — administrator menyusi chiqadi ' +
            '(savolni kanalga darhol yuborish, savol qo’shish, viktorina holati, arizalar). ' +
            'Raqamni bilish uchun botga /id deb yozing. Bir nechta bo’lsa vergul bilan.'
        },
        {
          name: 'remindDays', label: 'Muddatdan necha kun o’tsa eslatilsin', type: 'number',
          value: conf.remindDays, help: 'Masalan 3 — muddat o’tgandan 3 kun keyin'
        },
        {
          name: 'remindEvery', label: 'Eslatma necha kunda bir marta', type: 'number',
          value: conf.remindEvery, help: 'Bir o’quvchiga shu kunlar ichida bir martadan ko’p yozilmaydi'
        },
        {
          name: 'codeHours', label: 'Ulash kodi necha soat amal qiladi', type: 'number',
          value: conf.codeHours
        },
        {
          name: 'payCard', label: 'To’lov kartasi raqami (Humo/Uzcard)', value: conf.payCard,
          placeholder: '9860 0000 0000 0000', help: 'Botdagi «To’lov qilish» tugmasida o’quvchiga shu raqam chiqadi'
        },
        { name: 'payHolder', label: 'Karta egasi', value: conf.payHolder, placeholder: 'Ism Familiya' },
        {
          name: 'payBankChat', label: 'Bildirishnoma kanali (raqami yoki @nomi)', value: conf.payBankChat,
          placeholder: '-1001234567890',
          help: 'Karta SMS/bot bildirishnomalari tushadigan kanal. Botni shu kanalga administrator qilib qo’shing — raqamni bot o’zi yozib yuboradi.'
        },
        {
          name: 'payPreDays', label: 'To’lovdan necha kun oldin eslatilsin', type: 'number', value: conf.payPreDays,
          help: '0 — oldindan eslatma yuborilmaydi'
        }
      ];
      var f = UI.form(fields);

      var toggles = h('div', { class: 'list', style: 'border:1px solid var(--line);border-radius:10px' },
        KINDS.map(function (k) {
          var cb = h('input', { type: 'checkbox', id: 'kind-' + k.id });
          cb.checked = conf.notify[k.id] !== false;
          return h('label', { class: 'list-item', style: 'cursor:pointer' }, [
            cb,
            h('div', { class: 'main-col' }, [
              h('b', {}, k.label),
              h('span', {}, conf.notify[k.id] !== false ? 'Yuborilsin' : 'Yuborilmasin')
            ])
          ]);
        }));

      view.appendChild(UI.card('Bot sozlamalari', [
        h('div', { class: 'banner info' }, h('div', {}, [
          h('b', {}, 'Bot kaliti (token) bu yerda saqlanmaydi. '),
          'U faqat serverdagi .env faylida turadi — shunda hech kim uni ilova orqali ko’ra olmaydi.'
        ])),
        f.node,
        h('h3', { style: 'margin:18px 0 8px;font-size:14px' }, 'Qaysi xabarlar yuborilsin'),
        toggles,
        h('div', { style: 'margin-top:14px' }, h('button', {
          class: 'btn primary', onclick: function (e) {
            UI.busy(e.currentTarget, async function () {
              var v = f.values();
              var notify = {};
              KINDS.forEach(function (k) {
                var cb = document.getElementById('kind-' + k.id);
                notify[k.id] = !!(cb && cb.checked);
              });
              await D.saveSettings(Object.assign({}, D.settings, {
                bot: Object.assign({}, D.settings.bot || {}, {
                  payCard: String(v.payCard || '').replace(/[^\d ]/g, '').trim(),
                  payHolder: String(v.payHolder || '').trim(),
                  payBankChat: String(v.payBankChat || '').trim(),
                  payPreDays: Math.max(0, Number(v.payPreDays) || 0),
                  username: String(v.username || '').replace('@', ''),
                  welcome: v.welcome,
                  staffChats: String(v.staffChats || '').trim(),
                  notify: notify,
                  remindDays: Math.max(0, Number(v.remindDays) || 3),
                  remindEvery: Math.max(1, Number(v.remindEvery) || 7),
                  codeHours: Math.max(1, Number(v.codeHours) || 48)
                })
              }));
              await A.Ops.audit(App.user, 'Bot sozlamalari o’zgartirildi', v.username, '');
              UI.toast('Saqlandi.', 'ok'); App.render();
            });
          }
        }, 'Saqlash'))
      ]));

      view.appendChild(h('div', { style: 'margin-top:14px' }, UI.card('Ulash kodlari', [
        h('p', { style: 'margin:0 0 10px' },
          'O’quvchini botga ulash uchun unga bir martalik kod bering. Kod ishlatilgach yoki muddati ' +
          'o’tgach yaroqsiz bo’ladi. Ism bo’yicha avtomatik ulash yo’q — bir xil ismlar chalkashmasligi uchun.'),
        h('button', {
          class: 'btn primary', onclick: function () { codeModal(App); }
        }, 'O’quvchiga kod berish')
      ])));
    }
  };

  function statusPill(m) {
    if (m.status === 'sent') return UI.pill('Yuborildi', 'ok');
    if (m.status === 'failed') return UI.pill('Yuborilmadi', 'bad');
    if (m.status === 'error') return UI.pill('Qayta urinilmoqda', 'warn');
    if (m.status === 'skipped') return UI.pill('O’chirilgan turi', 'mute');
    return UI.pill('Navbatda', 'warn');
  }

  /** Bir martalik ulash kodi berish oynasi */
  function codeModal(App) {
    var students = A.sortBy(D.all('students').filter(function (s) {
      return s.status !== 'arxiv' && !(s.telegram && s.telegram.id);
    }), function (s) { return s.lastName + ' ' + s.firstName; });

    if (!students.length) {
      UI.toast('Ulanmagan o’quvchi yo’q.', 'info');
      return;
    }
    var pick = UI.field({
      label: 'O’quvchi', type: 'select', required: true,
      options: students.map(function (s) {
        return { value: s.id, label: s.lastName + ' ' + s.firstName + ' · ' + (s.phone || '') };
      })
    });
    var out = h('div', { style: 'margin-top:12px' });
    UI.modal({
      title: 'Ulash kodi',
      body: [
        h('p', { class: 'small muted', style: 'margin:0 0 10px' },
          'Kodni o’quvchiga bering. U botda /start bosib shu kodni yozadi.'),
        pick.wrap, out
      ],
      actions: [
        { label: 'Yopish' },
        {
          label: 'Kod yaratish', cls: 'primary', onClick: function (c, btn) {
            if (!pick.input.value) { UI.toast('O’quvchini tanlang.', 'bad'); return; }
            UI.busy(btn, async function () {
              var code = await Bot.makeCode(pick.input.value);
              var s = D.one('students', pick.input.value);
              UI.clear(out);
              out.appendChild(h('div', { class: 'banner ok' }, h('div', {}, [
                h('b', {}, s.lastName + ' ' + s.firstName + ' uchun kod: '),
                h('span', { class: 'mono', style: 'font-size:20px;letter-spacing:3px' }, code),
                h('div', { class: 'small' }, 'Kod ' + settings().codeHours + ' soat amal qiladi va bir marta ishlatiladi.')
              ])));
              await A.Ops.audit(App.user, 'Botga ulash kodi berildi', s.lastName + ' ' + s.firstName, '');
            });
          }
        }
      ]
    });
  }

  function approveModal(req, App) {
    var candidates = [];
    var g = req.groupCode ? A.Q.groupByCode(req.groupCode) : null;
    if (g) {
      A.Q.membersOf(g.id).forEach(function (m) {
        var s = D.one('students', m.studentId);
        if (s && !(s.telegram && s.telegram.id)) candidates.push(s);
      });
    }
    if (!candidates.length) {
      candidates = D.all('students').filter(function (s) {
        return s.status !== 'arxiv' && !(s.telegram && s.telegram.id);
      });
    }
    candidates = A.sortBy(candidates, function (s) { return s.lastName + ' ' + s.firstName; });

    var pick = UI.field({
      label: 'Qaysi o’quvchi', type: 'select', required: true,
      value: req.matchStudentId || '',
      options: candidates.map(function (s) {
        return { value: s.id, label: s.lastName + ' ' + s.firstName + ' · ' + (s.parentPhone || s.phone || '') };
      })
    });
    UI.modal({
      title: 'Botga ulash',
      body: [
        h('dl', { class: 'kv' }, [
          h('dt', {}, 'Yozgan ism'), h('dd', {}, req.name || '—'),
          h('dt', {}, 'Guruh kodi'), h('dd', {}, req.groupCode || '—'),
          h('dt', {}, 'Telegram'), h('dd', {}, req.username ? '@' + req.username : String(req.chatId))
        ]),
        pick.wrap
      ],
      actions: [
        { label: 'Bekor qilish' },
        {
          label: 'Ulash', cls: 'primary', onClick: function (c, btn) {
            if (!pick.input.value) { UI.toast('O’quvchini tanlang.', 'bad'); return; }
            UI.busy(btn, async function () {
              await Bot.approve(req, pick.input.value, App);
              c(); UI.toast('Ulandi.', 'ok'); App.render();
            });
          }
        }
      ]
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
