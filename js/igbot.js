/* Sabo ERP — "Instagram bot" bo'limi.
   Panelning o'zi Mac'dagi sabo-bot/dashboard.py da ishlaydi; server uni
   /bot-panel/ manzilida proxy qiladi (server/index.js: botPanelProxy).
   Bu yerda faqat iframe + holat xabari. */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, h = UI.h;
  A.Pages = A.Pages || {};

  A.Pages.igbot = function (view, route, App) {
    App.guard('nav.bot');
    view.appendChild(UI.pageHead('Instagram bot',
      'Avtojavob, suhbatlar, zayavkalar va chatbot oqimlari — Mac’dagi serverdan jonli'));

    var wrap = h('div', { class: 'igbot-wrap' });
    var frame = h('iframe', {
      src: '/bot-panel/',
      title: 'Instagram bot paneli',
      class: 'igbot-frame',
      allow: 'clipboard-write'
    });
    var note = h('div', { class: 'banner warn', style: 'display:none;margin-bottom:10px' }, h('div', {}, [
      h('b', {}, 'Panel ulanmadi. '),
      'Mac yoniq va internetga ulanganini tekshiring. ',
      h('a', { href: '/bot-panel/', target: '_blank', rel: 'noopener' }, 'Alohida oynada ochish')
    ]));
    wrap.appendChild(note);
    wrap.appendChild(frame);
    view.appendChild(wrap);

    /* Ulanishni tekshirish: proxy 502 qaytarsa — ogohlantirish */
    try {
      fetch('/bot-panel/api/data', { cache: 'no-store', credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) note.style.display = ''; })
        .catch(function () { note.style.display = ''; });
    } catch (e) { }

    /* Balandlik: ekranning qolgan qismini to'ldirsin */
    function fit() {
      var top = frame.getBoundingClientRect().top;
      var hh = Math.max(420, window.innerHeight - top - 16);
      frame.style.height = hh + 'px';
    }
    fit();
    window.addEventListener('resize', fit);
    setTimeout(fit, 50);
  };
})(window);
