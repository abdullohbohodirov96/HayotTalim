/* Zoom darslar: avtomatik konferensiya, eslatmalar, kim qo'shildi / qo'shilmadi,
   dars yozuvi. Server: server/zoom.js                                         */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;

  function load(App, cb) {
    App._zoom = App._zoom || {};
    if (App._zoom.ok) { cb(App._zoom.data, App._zoom.error); return; }
    D.api('GET', 'api/zoom/overview').then(function (d) {
      App._zoom = { ok: true, data: d }; App.render();
    }).catch(function (e) { App._zoom = { ok: true, data: null, error: e.message }; App.render(); });
    cb(undefined);
  }
  function reload(App) { App._zoom = {}; App.render(); }

  var ST = { yaratildi: ['Tayyor', 'info'], jonli: ['Jonli', 'ok'], tugadi: ['Tugadi', 'mute'], xato: ['Xato', 'bad'] };
  var STEP = [['h1', '30 daq oldin'], ['m15', '15 daq oldin'], ['start', 'Boshlanganda'], ['miss', 'Qo’shilmaganlarga']];

  /* Mehmon (sinov darsi) uchun shaxsiy havola: ism yoziladi → tayyor havola nusxalanadi */
  function guestDialog(l) {
    var name = h('input', { class: 'input', placeholder: 'Masalan: Dinara', maxlength: 60 });
    var out = h('div', {});
    var m = UI.modal({ title: 'Mehmon havolasi', body: [
      h('p', { class: 'muted' }, 'Sinov darsiga keladigan yoki botga ulanmagan odam uchun. Havolani bossa — ro‘yxatdan o‘tish, email va Zoom akkaunt so‘ralmaydi, to‘g‘ri darsga kiradi. Har bir odamga alohida havola oling.'),
      h('label', { class: 'field' }, [h('span', {}, 'Ismi'), name]), out
    ], actions: [
      { label: 'Yopish' },
      { label: 'Havola olish', cls: 'primary', onClick: async function (close, btn) {
        if (!name.value.trim()) { UI.toast('Ismini yozing.', 'info'); return; }
        btn.disabled = true;
        try {
          var r = await D.api('POST', 'api/zoom/guest', { id: l.id, name: name.value });
          UI.clear(out);
          var txt = '👋 Assalomu alaykum, ' + r.name + '!\n' + (l.groupName || '') + ' — sinov darsi ' + (l.date || '') + ', ' + (l.start || '') + ' da.\n\n👉 Darsga kirish: ' + r.joinUrl;
          out.appendChild(h('div', { class: 'note ok', style: 'word-break:break-all' }, [h('b', {}, r.name + ' uchun havola: '), r.joinUrl]));
          out.appendChild(h('div', { class: 'rowflex', style: 'gap:8px;margin-top:8px;flex-wrap:wrap' }, [
            h('button', { class: 'btn sm primary', onclick: function () { UI.copy(r.joinUrl); } }, '📋 Havolani nusxalash'),
            h('button', { class: 'btn sm', onclick: function () { UI.copy(txt); } }, '💬 Xabar bilan nusxalash')
          ]));
          name.value = '';
        } catch (e) { UI.toast(e.message || 'Bo‘lmadi', 'bad'); }
        btn.disabled = false;
      } }
    ] });
  }

  A.Pages.zoom = function (view, route, App) {
    App.guard('nav.groups');
    view.appendChild(UI.pageHead('Zoom darslar', 'Konferensiya o’zi ochiladi, o’quvchilarga havola va eslatma boradi, davomat va dars yozuvi avtomatik', [
      App.can('group.edit') ? h('button', {
        class: 'btn', onclick: async function () {
          try { await D.api('POST', 'api/zoom/run', {}); UI.toast('Tekshirildi.', 'ok'); reload(App); }
          catch (e) { UI.toast(e.message || 'Bo’lmadi', 'bad'); }
        }
      }, [UI.icon('clock'), 'Hozir tekshirish']) : null,
      h('button', { class: 'btn', onclick: function () { reload(App); } }, [UI.icon('history'), 'Yangilash'])
    ]));
    var tab = App._zoomTab || 'darslar';
    view.appendChild(UI.tabs([{ id: 'darslar', label: 'Darslar' }, { id: 'guruhlar', label: 'Guruhlar' }, { id: 'matn', label: 'Xabar matnlari' }], tab,
      function (id) { App._zoomTab = id; App.render(); }));
    if (tab === 'guruhlar') { groupsTab(view, App); return; }
    if (tab === 'matn') { textsTab(view, App); return; }
    load(App, function (d, err) {
      if (d === undefined) { view.appendChild(h('div', { class: 'card muted', style: 'padding:18px' }, 'Yuklanmoqda…')); return; }
      if (!d) { view.appendChild(h('div', { class: 'card', style: 'padding:18px' }, 'Yuklab bo’lmadi: ' + (err || ''))); return; }
      if (!d.configured && !App.can('settings.edit')) {
        view.appendChild(h('div', { class: 'note', style: 'margin-bottom:12px' }, 'Zoom hali ulanmagan — markaz rahbariyati ulaydi.'));
      } else if (!d.configured) {
        view.appendChild(h('div', { class: 'card zm-setup' }, [
          h('b', {}, 'Zoom hali ulanmagan'),
          h('ol', {}, [
            h('li', {}, 'marketplace.zoom.us → Develop → Build App → «Server-to-Server OAuth» ilova yarating.'),
            h('li', {}, 'Scopes: meeting:write:meeting:admin, meeting:read:meeting:admin, meeting:write:registrant:admin, meeting:read:list_past_participants:admin, cloud_recording:read:list_recording_files:admin.'),
            h('li', {}, 'Render → Environment: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET (ilovadagi qiymatlar).'),
            h('li', {}, 'Feature → Event Subscriptions: manzil https://saboacademy.uz/api/zoom/webhook, voqealar: Participant joined, Meeting ended, Recording completed. «Secret Token» ni ZOOM_WEBHOOK_SECRET ga yozing.'),
            h('li', {}, 'Zoom sozlamasida Cloud recording yoqilgan bo’lsin.')
          ])
        ]));
      } else if (d.auth && !d.auth.ok) {
        view.appendChild(h('div', { class: 'note bad', style: 'margin-bottom:12px' },
          App.can('settings.edit') ? 'Zoom kalitlari ishlamadi: ' + d.auth.error + '. Render’dagi ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET ni tekshiring va Zoom ilovasi «Activated» ekanini ko’ring.'
            : 'Zoom bilan bog‘lanishda muammo — markaz rahbariyatiga xabar bering.'));
      } else if (!d.webhook) {
        view.appendChild(h('div', { class: 'note ok', style: 'margin-bottom:12px' }, '✓ Zoom ulandi.'));
        view.appendChild(h('div', { class: 'note warn', style: 'margin-bottom:12px' },
          'Webhook ulanmagan (ZOOM_WEBHOOK_SECRET): kim qo’shilgani dars tugagach aniqlanadi, jonli emas.'));
      } else {
        var lh = d.lastHook;
        view.appendChild(h('div', { class: 'note ' + (lh ? 'ok' : 'warn'), style: 'margin-bottom:12px' },
          lh ? '✓ Zoom ulandi. Oxirgi Zoom xabari: ' + lh.at + ' (' + lh.event + ')'
            : '✓ Zoom ulandi, lekin Zoom’dan hali birorta xabar (webhook) kelmagan. Kim qo’shilgani va yozuv dars tugagach Zoom’dan o‘zi so‘rab olinadi. Zoom ilovasida Event Subscriptions yoqilganini tekshiring.'));
      }
      var ls = d.lessons || [];
      if (!ls.length) {
        view.appendChild(UI.empty({ title: 'Hali Zoom dars yo’q', text: 'Onlayn guruhlarning darsi boshlanishidan 2 soat oldin konferensiya o’zi ochiladi.' }));
        return;
      }
      ls.forEach(function (l) {
        var st = ST[l.status] || [l.status || '—', 'mute'];
        var total = l.joined.length + l.missing.length;
        view.appendChild(h('div', { class: 'card zm-card' }, [
          h('div', { class: 'zm-head' }, [
            h('div', {}, [h('b', {}, l.groupName), h('div', { class: 'muted small' }, A.dateLabel ? A.dateLabel(l.date) + ' · ' + l.start + '–' + l.end : l.date + ' · ' + l.start)]),
            UI.pill(st[0], st[1]),
            h('span', { class: 'zm-count' }, [h('b', {}, l.joined.length + '/' + total), ' qo’shildi'])
          ]),
          l.error ? h('div', { class: 'note bad' }, 'Xato: ' + l.error) : null,
          l.regError ? h('div', { class: 'note warn small' }, 'Shaxsiy havola berilmadi (umumiy havola ishlatildi): ' + l.regError) : null,
          h('div', { class: 'zm-steps' }, STEP.map(function (s) {
            return h('span', { class: 'zm-step' + (l.sent[s[0]] ? ' on' : '') }, [l.sent[s[0]] ? '✓ ' : '○ ', s[1]]);
          }).concat([
            h('span', { class: 'zm-step' + (l.attMarked ? ' on' : '') }, [l.attMarked ? '✓ ' : '○ ', 'Davomat']),
            h('span', { class: 'zm-step' + (l.recSent ? ' on' : '') }, [l.recSent ? '✓ ' : l.recPending ? '⏳ ' : l.recRejected ? '✕ ' : '○ ', l.recPending ? 'Yozuv tayyor — tasdiq kutilmoqda' : l.recRejected ? 'Yozuv yuborilmadi' : 'Yozuv guruhga'])
          ])),
          h('div', { class: 'zm-cols' }, [
            h('div', {}, [h('div', { class: 'zm-t ok' }, 'Qo’shildi (' + l.joined.length + ')'),
              l.joined.length ? h('ul', { class: 'zm-list' }, l.joined.map(function (x) { return h('li', {}, x.name); })) : h('p', { class: 'muted small' }, '—')]),
            h('div', {}, [h('div', { class: 'zm-t bad' }, 'Qo’shilmadi (' + l.missing.length + ')'),
              l.missing.length ? h('ul', { class: 'zm-list' }, l.missing.map(function (x) {
                return h('li', {}, [x.name, x.tg ? null : h('span', { class: 'muted small' }, ' · botga ulanmagan')]);
              })) : h('p', { class: 'muted small' }, '—')])
          ]),
          l.guests && l.guests.length ? h('p', { class: 'muted small' }, 'Ro’yxatda yo’q ismlar: ' + l.guests.join(', ')) : null,
          (!l.open && l.openError && App.can('settings.edit')) ? h('div', { class: 'note warn', style: 'margin:8px 0' }, 'Bu konferensiyada ro‘yxatdan o‘tish o‘chirilmadi (' + l.openError + '). Zoom ilovasiga «meeting:update:meeting:admin» ruxsatini qo‘shing yoki zoom.us → Meetings → shu dars → Edit → «Registration» belgisini olib tashlang.') : null,
          h('div', { class: 'zm-acts' }, [
            l.startUrl ? h('a', { class: 'btn primary sm', href: l.startUrl, target: '_blank', rel: 'noopener' }, 'Darsni boshlash (ustoz)') : null,
            l.joinUrl ? h('button', { class: 'btn sm', onclick: function () { try { navigator.clipboard.writeText(l.joinUrl); UI.toast(l.open ? 'Havola nusxalandi — bosgan odam mehmon bo‘lib kiradi.' : 'Umumiy havola nusxalandi (ochganda ism va email so‘raydi).', 'ok'); } catch (e) { } },
              title: l.open ? 'Umumiy havola — ro‘yxatdan o‘tishsiz, mehmon bo‘lib kiradi' : 'Umumiy havola — ochganda ism va email so‘raydi. Sinov darsiga keluvchiga «Mehmon havolasi» ni bering.' }, l.open ? 'Havolani nusxalash' : 'Umumiy havola') : null,
            l.status !== 'tugadi' ? h('button', { class: 'btn sm', title: 'Sinov darsiga keladigan yoki botga ulanmagan odam uchun — forma va Zoom akkauntsiz kiradi', onclick: function () { guestDialog(l); } }, '👤 Mehmon havolasi') : null,
            l.missing.length && l.status !== 'tugadi' ? h('button', {
              class: 'btn sm', onclick: async function () {
                try { var r = await D.api('POST', 'api/zoom/remind', { id: l.id }); UI.toast(r.sent + ' ta o’quvchiga yuborildi.', 'ok'); }
                catch (e) { UI.toast(e.message || 'Yuborilmadi', 'bad'); }
              }
            }, 'Qo’shilmaganlarga yana yuborish') : null,
            l.recording && l.recording.shareUrl ? h('a', { class: 'btn sm', href: l.recording.shareUrl, target: '_blank', rel: 'noopener' }, '▶ Dars yozuvi' + (l.recording.dur ? ' (' + l.recording.dur + ')' : '')) : null,
            l.recording && App.can('group.edit') ? h('button', { class: 'btn sm', title: 'Noto‘g‘ri video kelgan bo‘lsa — Zoom’dan oxirgi seans yozuvini qaytadan olish va yana tasdiqqa yuborish', onclick: async function () {
              try { var r = await D.api('POST', 'api/zoom/recording', { id: l.id, action: 'refetch' }); UI.toast('Yozuv qaytadan olindi' + (r.dur ? ' (' + r.dur + ')' : '') + (r.same ? ' — Zoom’da boshqa yozuv yo‘q' : '') + '. Tasdiqlang.', r.same ? 'info' : 'ok'); reload(App); }
              catch (e) { UI.toast(e.message || 'Bo‘lmadi', 'bad'); }
            } }, '🔄 Yozuvni qaytadan olish') : null,
            /* Yozuv tayyor — rahbariyat ko'rib tasdiqlagach guruhga boradi */
            l.recPending && App.can('group.edit') ? h('button', { class: 'btn sm primary', onclick: async function () {
              if (!window.confirm('Dars yozuvi guruh chatiga yuborilsinmi?')) return;
              try { await D.api('POST', 'api/zoom/recording', { id: l.id }); UI.toast('Guruhga yuborildi ✅', 'ok'); reload(App); }
              catch (e) { UI.toast(e.message || 'Yuborilmadi', 'bad'); }
            } }, '✅ Yozuvni guruhga yuborish') : null,
            l.recPending && App.can('group.edit') ? h('button', { class: 'btn sm', onclick: async function () {
              try { await D.api('POST', 'api/zoom/recording', { id: l.id, action: 'reject' }); UI.toast('Guruhga yuborilmaydi.', 'ok'); reload(App); }
              catch (e) { UI.toast(e.message || 'Bo‘lmadi', 'bad'); }
            } }, '❌ Yubormaslik') : null,
            l.recNote ? h('span', { class: 'muted small' }, l.recNote) : null
          ])
        ]));
      });
    });
  };

  /* ---------- Guruhlar: Zoom'ga qo'shish, darslik sur'ati ---------- */
  var WD = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'];
  var OY = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  function dLabel(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Number(m[3]) + '-' + OY[Number(m[2]) - 1] : ''; }
  function groupsTab(view, App) {
    var box = h('div', {}, h('div', { class: 'card muted', style: 'padding:18px' }, 'Yuklanmoqda…'));
    view.appendChild(h('p', { class: 'muted', style: 'margin:4px 0 12px' },
      'Zoom yoqilgan onlayn guruhlarga dars boshlanishidan 2 soat oldin konferensiya o’zi ochiladi, eslatmalar boradi. Darslik — o’quvchi kabinetidagi darslar: guruhda dars o’tgani sari o’zi ochiladi; kerak bo’lsa qo’lda ochib/yopib qo’yasiz.'));
    view.appendChild(box);
    var canEdit = App.can('group.edit');
    function act(body, msg) {
      D.api('POST', 'api/zoom/group', body).then(function () { UI.toast(msg, 'ok'); draw(); })
        .catch(function (e) { UI.toast(e.message || 'Bo’lmadi', 'bad'); });
    }
    function draw() {
      D.api('GET', 'api/zoom/groups').then(function (r) {
        UI.clear(box);
        if (!r.groups.length) { box.appendChild(UI.empty({ title: 'Guruh yo’q', text: 'Avval guruh yarating.' })); return; }
        r.groups.forEach(function (g) {
          var on = g.online && g.zoomAuto;
          var when = (g.days || []).map(function (d) { return WD[d - 1]; }).join(', ') + (g.startTime ? ' · ' + g.startTime + '–' + g.endTime : '');
          var pc = g.pace;
          box.appendChild(h('div', { class: 'card zm-card' }, [
            h('div', { class: 'zm-head' }, [
              h('div', {}, [h('b', {}, (g.code ? g.code + ' · ' : '') + g.name),
                h('div', { class: 'muted small' }, [when || 'Jadval yo’q', g.level ? ' · ' + g.level : '', ' · ' + g.students + ' o’quvchi',
                  g.startDate ? ' · boshlanish ' + dLabel(g.startDate) : ''].join(''))]),
              UI.pill(g.status === 'faol' ? 'Faol' : g.status === 'rejalashtirilgan' ? 'Rejalashtirilgan' : (g.status || '—'), g.status === 'faol' ? 'ok' : 'info'),
              UI.pill(on ? 'Zoom: yoqilgan' : !g.online ? 'Oflayn guruh' : 'Zoom: o’chirilgan', on ? 'ok' : 'mute')
            ]),
            h('div', { class: 'zm-steps' }, [
              h('span', { class: 'zm-step' + (g.tg ? ' on' : '') }, g.tg ? '✓ Telegram guruhiga ulangan — e’lon guruhga ham boradi' : '○ Telegram guruhiga ulanmagan — xabar faqat o’quvchilarga'),
              h('span', { class: 'zm-step' + (pc ? ' on' : '') }, pc
                ? '📖 Darslikda ' + pc.n + ' ta dars ochiq' + (pc.offset ? ' (qo’lda ' + (pc.offset > 0 ? '+' : '') + pc.offset + ')' : '') + (pc.next ? ' · keyingisi ' + dLabel(pc.next.date) + ', ' + pc.next.end + ' dan keyin' : '')
                : '📖 Darslik: guruh jadvali to’liq emas (kun, vaqt, boshlanish sanasi)')
            ]),
            canEdit ? h('div', { class: 'zm-acts' }, [
              !g.online ? h('button', { class: 'btn sm', onclick: function () { act({ id: g.id, online: true, zoomAuto: true }, 'Guruh onlayn qilindi va Zoom’ga qo’shildi.'); } }, '＋ Onlayn qilib Zoom’ga qo’shish')
                : h('button', { class: 'btn sm ' + (g.zoomAuto ? '' : 'primary'), onclick: function () { act({ id: g.id, zoomAuto: !g.zoomAuto }, g.zoomAuto ? 'Zoom o’chirildi.' : 'Zoom’ga qo’shildi.'); } },
                  g.zoomAuto ? 'Zoom’dan olib tashlash' : '＋ Zoom’ga qo’shish'),
              pc ? h('button', { class: 'btn sm', onclick: function () { act({ id: g.id, paceDelta: 1 }, 'Darslikda keyingi dars ochildi.'); } }, '📖 Keyingi darsni ochish') : null,
              pc && pc.n > 0 ? h('button', { class: 'btn sm', onclick: function () { act({ id: g.id, paceDelta: -1 }, 'Oxirgi ochilgan dars yopildi.'); } }, 'Oxirgisini yopish') : null
            ]) : null
          ]));
        });
      }).catch(function (e) { UI.clear(box); box.appendChild(h('div', { class: 'card note bad' }, e.message || 'Yuklab bo’lmadi')); });
    }
    draw();
  }

  /* ---------- Xabar matnlari ---------- */
  var TPL = [
    ['group', 'Guruh chatiga e’lon (30 daqiqa oldin)'],
    ['h1', 'O’quvchiga: 30 daqiqa oldin'],
    ['m15', 'O’quvchiga: 15 daqiqa oldin'],
    ['start', 'O’quvchiga: dars boshlanganda'],
    ['miss', 'Qo’shilmaganlarga (10 daqiqadan keyin)'],
    ['teacher', 'Ustozga: darsni boshlash havolasi']
  ];
  var SAMPLE = { guruh: 'A0 · Ayollar kechki', sana: '2026-11-02', vaqt: '20:00–21:20', havola: 'https://us06web.zoom.us/j/81234567890', parol: '', darslik: 'https://saboacademy.uz/kabinet', ustoz_havola: 'https://us06web.zoom.us/s/81234567890?zak=…' };
  function preview(t) {
    var esc = function (x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var html = esc(t).replace(/&lt;(\/?)(b|i|code)&gt;/g, '<$1$2>')
      .replace(/\{(guruh|sana|vaqt|havola|parol|darslik|ustoz_havola)\}/g, function (m, k) { return esc(SAMPLE[k] || ''); })
      .replace(/\n/g, '<br>');
    var d = h('div', { class: 'zm-prev' }); d.innerHTML = html; return d;
  }
  function textsTab(view, App) {
    var box = h('div', {}, h('div', { class: 'card muted', style: 'padding:18px' }, 'Yuklanmoqda…'));
    view.appendChild(box);
    var canEdit = App.can('group.edit');
    D.api('GET', 'api/zoom/templates').then(function (r) {
      UI.clear(box);
      var t = r.templates, defs = r.defaults, areas = {}, prevs = {};
      box.appendChild(h('div', { class: 'note', style: 'margin-bottom:12px' },
        'O’rniga avtomatik qo’yiladi: {guruh} {sana} {vaqt} {havola} {parol} {darslik} {ustoz_havola}. Qalin yozuv: <b>matn</b>. O’ng tomonda — o’quvchi Telegramda ko’radigan ko’rinish.'));
      var gOn = h('input', { type: 'checkbox', checked: t.groupOn !== false, disabled: !canEdit });
      box.appendChild(h('label', { class: 'zm-step on', style: 'display:inline-flex;gap:8px;margin-bottom:12px' }, [gOn, ' Guruh Telegram chatiga ham e’lon yuborilsin']));
      TPL.forEach(function (x) {
        var upd = function () { UI.clear(prevs[x[0]]); prevs[x[0]].appendChild(preview(ta.value)); };
        var ta = h('textarea', { rows: 7, class: 'zm-ta', disabled: !canEdit, oninput: upd });
        ta.value = t[x[0]];
        areas[x[0]] = ta; prevs[x[0]] = h('div', {}, preview(t[x[0]]));
        box.appendChild(h('div', { class: 'card zm-card' }, [
          h('div', { class: 'zm-head' }, [h('b', {}, x[1]), canEdit ? h('button', { class: 'btn sm', type: 'button', onclick: function () { ta.value = defs[x[0]]; upd(); } }, 'Standart') : null]),
          h('div', { class: 'zm-tpl' }, [ta, prevs[x[0]]])
        ]));
      });
      if (canEdit) box.appendChild(h('div', { class: 'zm-acts' }, [h('button', { class: 'btn primary', type: 'button', onclick: function () {
        var body = { groupOn: gOn.checked }; Object.keys(areas).forEach(function (k) { body[k] = areas[k].value; });
        D.api('POST', 'api/zoom/templates', body).then(function () { UI.toast('Saqlandi.', 'ok'); }).catch(function (e) { UI.toast(e.message || 'Saqlanmadi', 'bad'); });
      } }, 'Saqlash')]));
    }).catch(function (e) { UI.clear(box); box.appendChild(h('div', { class: 'card note bad' }, e.message || 'Yuklab bo’lmadi')); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
