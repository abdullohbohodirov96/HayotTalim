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
  var STEP = [['h1', '1 soat oldin'], ['m15', '15 daq oldin'], ['start', 'Boshlanganda'], ['miss', 'Qo’shilmaganlarga']];

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
    load(App, function (d, err) {
      if (d === undefined) { view.appendChild(h('div', { class: 'card muted', style: 'padding:18px' }, 'Yuklanmoqda…')); return; }
      if (!d) { view.appendChild(h('div', { class: 'card', style: 'padding:18px' }, 'Yuklab bo’lmadi: ' + (err || ''))); return; }
      if (!d.configured) {
        view.appendChild(h('div', { class: 'card zm-setup' }, [
          h('b', {}, 'Zoom hali ulanmagan'),
          h('ol', {}, [
            h('li', {}, 'marketplace.zoom.us → Develop → Build App → «Server-to-Server OAuth» ilova yarating.'),
            h('li', {}, 'Scopes: meeting:write:admin, meeting:read:admin, recording:read:admin, report:read:admin, user:read:admin.'),
            h('li', {}, 'Render → Environment: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET (ilovadagi qiymatlar).'),
            h('li', {}, 'Feature → Event Subscriptions: manzil https://saboacademy.uz/api/zoom/webhook, voqealar: Participant joined, Meeting ended, Recording completed. «Secret Token» ni ZOOM_WEBHOOK_SECRET ga yozing.'),
            h('li', {}, 'Zoom sozlamasida Cloud recording yoqilgan bo’lsin.')
          ])
        ]));
      } else if (!d.webhook) {
        view.appendChild(h('div', { class: 'note warn', style: 'margin-bottom:12px' },
          'Webhook ulanmagan (ZOOM_WEBHOOK_SECRET): kim qo’shilgani dars tugagach aniqlanadi, jonli emas.'));
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
            h('span', { class: 'zm-step' + (l.recSent ? ' on' : '') }, [l.recSent ? '✓ ' : '○ ', 'Yozuv guruhga'])
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
          h('div', { class: 'zm-acts' }, [
            l.startUrl ? h('a', { class: 'btn primary sm', href: l.startUrl, target: '_blank', rel: 'noopener' }, 'Darsni boshlash (ustoz)') : null,
            l.joinUrl ? h('button', { class: 'btn sm', onclick: function () { try { navigator.clipboard.writeText(l.joinUrl); UI.toast('Havola nusxalandi.', 'ok'); } catch (e) { } } }, 'Havolani nusxalash') : null,
            l.missing.length && l.status !== 'tugadi' ? h('button', {
              class: 'btn sm', onclick: async function () {
                try { var r = await D.api('POST', 'api/zoom/remind', { id: l.id }); UI.toast(r.sent + ' ta o’quvchiga yuborildi.', 'ok'); }
                catch (e) { UI.toast(e.message || 'Yuborilmadi', 'bad'); }
              }
            }, 'Qo’shilmaganlarga yana yuborish') : null,
            l.recording && l.recording.shareUrl ? h('a', { class: 'btn sm', href: l.recording.shareUrl, target: '_blank', rel: 'noopener' }, '▶ Dars yozuvi') : null,
            l.recNote ? h('span', { class: 'muted small' }, l.recNote) : null
          ])
        ]));
      });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
