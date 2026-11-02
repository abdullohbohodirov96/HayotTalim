/* Ustoz kitoblari va daftari.
   — Kitoblar: muqovalar ro'yxati → kitob ochiladi (noutbuk va telefonga mos):
     sahifalash, yaqinlashtirish (tugma, Ctrl+g'ildirak, ikki barmoq), qalam,
     marker, matn, o'chirg'ich, rang/qalinlik, bekor qilish. Yozuvlar har ustozning
     o'ziga saqlanadi (server/books.js).
   — Daftar: Word'ga o'xshash yozuv joyi (arabcha ham): qalin/qiya, o'lcham, rang,
     tekislash, o'ngdan-chapga, ro'yxat, harakatlar va arabcha klaviatura, darsda
     katta qilib ko'rsatish rejimi.                                                */
(function (global) {
  'use strict';
  var A = global.A, UI = A.UI, D = A.Data, h = UI.h;

  /* Kitoblar katalogi: sahifalar assets/books/<id>/pNN.webp */
  var BOOKS = [
    { id: 'nabra-a0', title: 'Nabra — A0', sub: '1-kitob · O‘qish va yozish', ar: 'نَبْرَة', pages: 48, ratio: 1600 / 2264 },
    { id: 'a0-uy-vazifa', title: 'Uy vazifa daftari — A0', sub: 'وَاجِبَاتِي · Har dars uchun uy vazifasi', ar: 'وَاجِبَاتِي', pages: 27, ratio: 1600 / 2265 }
  ];
  function pageUrl(b, n) { return 'assets/books/' + b.id + '/p' + (n < 10 ? '0' : '') + n + '.webp'; }
  function coverUrl(b) { return 'assets/books/' + b.id + '/cover.webp'; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  var AR_RE = /[؀-ۿ]/;

  /* =================== KITOBLAR VA DAFTAR — bitta bo'lim =================== */
  function tabsBar(App, active) {
    return UI.tabs([{ id: 'kitob', label: '📚 Kitoblar' }, { id: 'daftar', label: '📝 Daftar' }], active, function (id) {
      if (id === 'daftar') App.go('notebook'); else App.go('books');
    });
  }

  /* =================== DARS REJIMI va KITOB ⇄ DAFTAR =================== */
  function lessonOn() { try { return sessionStorage.getItem('lesson-mode') === '1'; } catch (e) { return false; } }
  function fsOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function enterFs() {
    var el = document.documentElement;
    try { if (!fsOn()) (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { }
  }
  function exitFs() { try { if (fsOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { } }
  function setLesson(on) {
    try { sessionStorage.setItem('lesson-mode', on ? '1' : '0'); } catch (e) { }
    if (on) enterFs(); else exitFs();
  }
  function lastBook() {
    var id = lsGet('bk-last-book');
    return BOOKS.filter(function (b) { return b.id === id; })[0] || BOOKS[0];
  }
  /* O'ng pastki burchakdagi kichik tugma: daftarda — kitob, kitobda — daftar */
  function switcher(kind, onClick, sub) {
    var b = lastBook();
    return h('button', { type: 'button', class: 'ls-switch ls-' + kind, title: kind === 'book' ? 'Kitobga o‘tish' : 'Daftarga o‘tish', onclick: onClick }, [
      kind === 'book' ? h('img', { src: coverUrl(b), alt: '' }) : h('span', { class: 'ls-nb' }, '📝'),
      h('span', { class: 'ls-t' }, [h('b', {}, kind === 'book' ? '📖 Kitob' : 'Daftar'), h('small', {}, sub || '')])
    ]);
  }
  A.openBookLast = function () {
    var b = lastBook(), v = document.querySelector('.bk-view');
    if (v && v.__show && v.__book === b.id) { v.__show(); return; }
    openBook(b, Number(lsGet('bk-last-' + b.id)) || 1);
  };

  A.Pages.books = function (view, route, App) {
    if (!App.can('curriculum.view') && !App.can('lesson.log')) return App.guard('curriculum.view');
    view.appendChild(UI.pageHead('Kitoblar va daftar', 'Darsda kitobni oching, ustiga yozing va chizing; daftarda arabcha tushuntiring', []));
    view.appendChild(tabsBar(App, 'kitob'));
    view.appendChild(h('div', { class: 'bk-grid' }, BOOKS.map(function (b) {
      var last = Number(lsGet('bk-last-' + b.id)) || 0;
      return h('button', { type: 'button', class: 'bk-card', onclick: function () { openBook(b, last || 1); } }, [
        h('div', { class: 'bk-cover' }, h('img', { src: coverUrl(b), alt: b.title, loading: 'lazy' })),
        h('b', {}, b.title),
        h('span', {}, b.sub),
        h('small', {}, b.pages + ' sahifa' + (last > 1 ? ' · davom etish: ' + last + '-sahifa' : ''))
      ]);
    })));
    if (route && route.id) { var b0 = BOOKS.filter(function (x) { return x.id === route.id; })[0]; if (b0) openBook(b0, Number(lsGet('bk-last-' + b0.id)) || 1); }
  };

  /* =================== KITOB O'QUVCHISI (pastga aylantirib o'qiladi) =================== */
  var COLORS = ['#111111', '#d32f2f', '#1565c0', '#2e7d32', '#ef6c00', '#ffffff'];
  var SIZES = { s: [0.0022, 0.012, 0.022], m: [0.0038, 0.02, 0.032], l: [0.0065, 0.032, 0.048] };   // qalam, marker, matn
  var GAP = 14;

  function openBook(book, startPage) {
    lsSet('bk-last-book', book.id);
    var old = document.querySelector('.bk-view'); if (old && old.__close) old.__close();
    var st = { page: Math.max(1, Math.min(book.pages, startPage || 1)), zoom: 1, tool: 'hand', color: COLORS[1], size: 'm',
      pages: {}, undo: {}, hide: false, dirty: {}, edit: 0, w: 0, h: 0 };
    var root = h('div', { class: 'bk-view', tabindex: '-1' });
    var stage = h('div', { class: 'bk-stage' });
    var col = h('div', { class: 'bk-colm' });
    stage.appendChild(col);
    /* Har sahifa: rasm + chizma qatlami. Rasm va qatlam faqat ko'rinish yaqinida yuklanadi (xotira tejaladi) */
    var P = [];
    for (var n = 1; n <= book.pages; n++) (function (n) {
      var el = h('div', { class: 'bk-page', 'data-n': n });
      var img = h('img', { class: 'bk-img', alt: n + '-sahifa', draggable: 'false' });
      var cv = h('canvas', { class: 'bk-cv' });
      el.appendChild(img); el.appendChild(cv);
      var pg = { n: n, el: el, img: img, cv: cv, ctx: cv.getContext('2d'), live: false };
      P[n] = pg; col.appendChild(el);
      bindDraw(pg);
    })(n);
    var pgIn = h('input', { class: 'bk-pgin', type: 'number', min: 1, max: book.pages, value: st.page, 'aria-label': 'Sahifa' });
    var zoomLbl = h('span', { class: 'bk-zl' }, '100%');
    var saveLbl = h('span', { class: 'bk-save' }, '');
    function tbtn(label, title, fn, cls) { return h('button', { type: 'button', class: 'bk-b ' + (cls || ''), title: title, 'aria-label': title, onclick: fn }, label); }
    /* Dars rejimi: tepadagi panel yashiriladi, sahifa eniga to'ladi, ekran to'liq — Zoom'da faqat kitob ko'rinadi */
    var lessonBtn = h('button', { type: 'button', class: 'bk-b bk-lb', title: 'Dars rejimi (Zoom uchun)', onclick: function () { toggleLesson(); } }, '🎓 Dars rejimi');
    var miniPg = h('span', { class: 'bk-mini-pg' }, '');
    var mini = h('div', { class: 'bk-mini' }, [
      h('button', { type: 'button', class: 'bk-b', title: 'Oldingi sahifa', onclick: function () { go(st.page - 1); } }, '‹'), miniPg,
      h('button', { type: 'button', class: 'bk-b', title: 'Keyingi sahifa', onclick: function () { go(st.page + 1); } }, '›'),
      h('button', { type: 'button', class: 'bk-b', title: 'Kichiklashtirish', onclick: function () { setZoom(st.zoom / 1.15); } }, '−'),
      h('button', { type: 'button', class: 'bk-b', title: 'Yaqinlashtirish', onclick: function () { setZoom(st.zoom * 1.15); } }, '+'),
      h('button', { type: 'button', class: 'bk-b bk-mini-x', title: 'Dars rejimidan chiqish', onclick: function () { toggleLesson(); } }, '✕ Dars rejimi')
    ]);
    function syncNotebookMode() {
      var App = A.App, on = lessonOn();
      document.body.classList.toggle('lesson-mode', on && !!(App && App.route.name === 'notebook' && App.route.id));
      var nb = document.querySelector('.btn.ls-mode');
      if (nb) { nb.classList.toggle('on', on); nb.textContent = on ? '✕ Oddiy rejim' : '⛶ Dars rejimi'; }
    }
    function applyLesson() {
      var on = lessonOn();
      root.classList.toggle('bk-lesson', on);
      lessonBtn.classList.toggle('on', on);
      miniPg.textContent = st.page + ' / ' + book.pages;
    }
    function toggleLesson() {
      setLesson(!lessonOn()); applyLesson(); syncNotebookMode();
      requestAnimationFrame(function () { setTimeout(function () { if (lessonOn()) setZoom(fitWidthZoom()); else layout(true); }, 120); });
    }
    var top = h('div', { class: 'bk-top' }, [
      tbtn('←', 'Yopish', close, 'bk-x'),
      h('b', { class: 'bk-title' }, book.title),
      h('div', { class: 'bk-nav' }, [tbtn('‹', 'Oldingi sahifa', function () { go(st.page - 1); }), pgIn, h('span', { class: 'bk-of' }, '/ ' + book.pages), tbtn('›', 'Keyingi sahifa', function () { go(st.page + 1); })]),
      h('div', { class: 'bk-zoom' }, [tbtn('−', 'Kichiklashtirish', function () { setZoom(st.zoom / 1.25); }), zoomLbl, tbtn('+', 'Yaqinlashtirish', function () { setZoom(st.zoom * 1.25); }),
        tbtn('⤢', 'Sahifaga sig‘dirish', function () { setZoom(1); }), tbtn('⇔', 'Eniga sig‘dirish', function () { setZoom(fitWidthZoom()); })]),
      tbtn('▦', 'Sahifalar', showThumbs), tbtn('⛶', 'To‘liq ekran', fullscreen), lessonBtn, saveLbl
    ]);
    var toolBtns = {};
    function toolBtn(id, icon, label) {
      var b = h('button', { type: 'button', class: 'bk-tool', title: label, onclick: function () { setTool(id); } }, [h('span', { class: 'bk-ti' }, icon), h('small', {}, label)]);
      toolBtns[id] = b; return b;
    }
    var colorBtns = COLORS.map(function (c) {
      return h('button', { type: 'button', class: 'bk-col', style: 'background:' + c, title: 'Rang', onclick: function () { st.color = c; paintTools(); } });
    });
    var sizeBtns = ['s', 'm', 'l'].map(function (k) {
      return h('button', { type: 'button', class: 'bk-sz', title: 'Qalinlik', onclick: function () { st.size = k; paintTools(); } }, h('i', { class: 'bk-dot ' + k }));
    });
    var hideBtn = tbtn('👁', 'Yozuvlarni yashirish/ko‘rsatish', function () { st.hide = !st.hide; paintTools(); redrawAll(); });
    var bottom = h('div', { class: 'bk-bottom' }, [
      h('div', { class: 'bk-tools' }, [toolBtn('hand', '✋', 'Surish'), toolBtn('pen', '✏️', 'Qalam'), toolBtn('mark', '🖍', 'Marker'), toolBtn('text', '🔤', 'Matn'), toolBtn('erase', '🧽', 'O‘chirish')]),
      h('div', { class: 'bk-cols' }, colorBtns),
      h('div', { class: 'bk-szs' }, sizeBtns),
      h('div', { class: 'bk-acts' }, [tbtn('↶', 'Bekor qilish', undo), tbtn('🗑', 'Sahifadagi yozuvlarni tozalash', clearPage), hideBtn])
    ]);
    root.appendChild(top); root.appendChild(stage); root.appendChild(bottom); root.appendChild(mini);
    var nbLast = lsGet('nb-last-title');
    /* Daftarga o'tganda kitob yopilmaydi — yashiriladi: qaytganda o'sha bet, o'sha joy, o'sha kattalik */
    function hide() {
      flush();
      root.style.display = 'none'; root.__hidden = true;
      document.body.classList.remove('bk-open');
      window.scrollTo(0, pageY);
    }
    function show() {
      var was = root.classList.contains('bk-lesson');
      pageY = window.scrollY;
      applyLesson();
      if (was !== lessonOn()) setTimeout(function () { if (lessonOn()) setZoom(fitWidthZoom()); else layout(true); }, 60);
      root.style.display = ''; root.__hidden = false;
      document.body.classList.add('bk-open');
      root.focus({ preventScroll: true });
    }
    root.appendChild(switcher('nb', function () {
      var App = A.App, onNb = App && App.route.name === 'notebook' && App.route.id;
      hide();
      if (onNb) return;
      var id = lsGet('nb-last');
      if (id) App.go('notebook', { id: id }); else App.go('notebook');
    }, nbLast || 'Daftarlar'));
    root.__close = close; root.__show = show; root.__book = book.id;
    var pageY = window.scrollY;   /* orqadagi sahifa (daftar) qayerda turgani */
    document.body.appendChild(root);
    document.body.classList.add('bk-open');
    root.focus();

    D.api('GET', 'api/books/annot?book=' + encodeURIComponent(book.id)).then(function (r) { st.pages = (r && r.pages) || {}; redrawAll(); })
      .catch(function () { saveLbl.textContent = 'Yozuvlar yuklanmadi'; });

    /* ---- o'lchamlar ---- */
    function baseWidth() {
      var W = stage.clientWidth - 24, H = stage.clientHeight - 24;
      return Math.max(200, Math.min(W, H * book.ratio));
    }
    function fitWidthZoom() { return Math.max(1, (stage.clientWidth - 24) / baseWidth()); }
    function dpr() { return Math.min(window.devicePixelRatio || 1, 2); }
    function sizeCanvas(pg) {
      if (!pg.live) { if (pg.cv.width) { pg.cv.width = 0; pg.cv.height = 0; } return; }
      var d = dpr();
      pg.cv.width = Math.round(st.w * d); pg.cv.height = Math.round(st.h * d);
      redraw(pg);
    }
    function layout(keepAnchor) {
      /* joyni saqlash: qaysi sahifaning qayeri ekran o'rtasida edi */
      var anc = null;
      if (keepAnchor && st.h) {
        var cy = stage.scrollTop + stage.clientHeight / 2;
        var k = Math.max(1, Math.min(book.pages, Math.floor((cy - 12) / (st.h + GAP)) + 1));
        anc = { n: k, fy: (cy - P[k].el.offsetTop) / st.h, fx: (stage.scrollLeft + stage.clientWidth / 2 - P[k].el.offsetLeft) / st.w };
      }
      st.w = Math.round(baseWidth() * st.zoom); st.h = Math.round(st.w / book.ratio);
      col.style.width = st.w + 'px';
      for (var i = 1; i <= book.pages; i++) {
        var el = P[i].el; el.style.width = st.w + 'px'; el.style.height = st.h + 'px';
        P[i].cv.style.width = st.w + 'px'; P[i].cv.style.height = st.h + 'px';
        sizeCanvas(P[i]);
      }
      zoomLbl.textContent = Math.round(st.zoom * 100) + '%';
      if (anc) {
        stage.scrollTop = P[anc.n].el.offsetTop + anc.fy * st.h - stage.clientHeight / 2;
        stage.scrollLeft = P[anc.n].el.offsetLeft + anc.fx * st.w - stage.clientWidth / 2;
      }
      watch();
    }
    function setZoom(z) { st.zoom = Math.max(0.5, Math.min(5, z)); layout(true); }

    /* ---- ko'rinishga yaqin sahifalar yuklanadi ---- */
    function watch() {
      var top0 = stage.scrollTop - stage.clientHeight * 1.2, bot0 = stage.scrollTop + stage.clientHeight * 2.2;
      var best = st.page, bestD = Infinity, mid = stage.scrollTop + stage.clientHeight / 2;
      for (var i = 1; i <= book.pages; i++) {
        var pg = P[i], y = pg.el.offsetTop, near = y + st.h > top0 && y < bot0;
        if (near && !pg.img.getAttribute('src')) pg.img.src = pageUrl(book, i);
        if (near !== pg.live) { pg.live = near; sizeCanvas(pg); }
        var d = Math.abs(y + st.h / 2 - mid); if (d < bestD) { bestD = d; best = i; }
      }
      if (best !== st.page) { st.page = best; pgIn.value = best; miniPg.textContent = best + ' / ' + book.pages; lsSet('bk-last-' + book.id, String(best)); }
    }
    var ticking = false;
    stage.addEventListener('scroll', function () { if (ticking || root.__hidden) return; ticking = true; requestAnimationFrame(function () { ticking = false; watch(); }); });

    function go(n) {
      n = Math.max(1, Math.min(book.pages, Number(n) || 1));
      stage.scrollTop = P[n].el.offsetTop - 8;
      st.page = n; pgIn.value = n; miniPg.textContent = n + ' / ' + book.pages; lsSet('bk-last-' + book.id, String(n));
      watch();
    }
    pgIn.addEventListener('change', function () { go(pgIn.value); });

    /* ---- chizish ---- */
    function itemsOf(n) { return st.pages[n] || (st.pages[n] = []); }
    function drawItem(ctx, it, W, H) {
      if (it.t === 'p' || it.t === 'm') {
        var p = it.p; if (p.length < 2) return;
        ctx.save();
        ctx.strokeStyle = it.c; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, it.w * W);
        if (it.t === 'm') { ctx.globalAlpha = 0.33; ctx.globalCompositeOperation = 'multiply'; ctx.lineCap = 'butt'; }
        ctx.beginPath(); ctx.moveTo(p[0] * W, p[1] * H);
        if (p.length === 2) ctx.lineTo(p[0] * W + 0.1, p[1] * H + 0.1);
        for (var i = 2; i < p.length - 2; i += 2) {
          var mx = (p[i] + p[i + 2]) / 2 * W, my = (p[i + 1] + p[i + 3]) / 2 * H;
          ctx.quadraticCurveTo(p[i] * W, p[i + 1] * H, mx, my);
        }
        if (p.length > 2) ctx.lineTo(p[p.length - 2] * W, p[p.length - 1] * H);
        ctx.stroke(); ctx.restore();
      } else if (it.t === 'x') {
        var fs = it.s * W;
        ctx.save(); ctx.fillStyle = it.c; ctx.textBaseline = 'top';
        ctx.font = '600 ' + fs + 'px ' + (AR_RE.test(it.v) ? 'Amiri, serif' : 'Manrope, Arial, sans-serif');
        String(it.v).split('\n').forEach(function (line, k) {
          var rtl = AR_RE.test(line);
          ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left';
          var x = it.x * W + (rtl ? ctx.measureText(line).width : 0);
          ctx.fillText(line, x, it.y * H + k * fs * 1.35);
        });
        ctx.restore();
      }
    }
    function redraw(pg) {
      if (!pg.live || !pg.cv.width) return;
      var W = pg.cv.width, H = pg.cv.height, ctx = pg.ctx;
      ctx.clearRect(0, 0, W, H);
      if (st.hide) return;
      (st.pages[pg.n] || []).forEach(function (it) { drawItem(ctx, it, W, H); });
      if (pg.cur) drawItem(ctx, pg.cur, W, H);
    }
    function redrawAll() { for (var i = 1; i <= book.pages; i++) redraw(P[i]); }
    function pushUndo(n) { st.edit = n; var u = st.undo[n] || (st.undo[n] = []); u.push(JSON.stringify(itemsOf(n))); if (u.length > 60) u.shift(); }
    function changed(n) { st.dirty[n] = 1; saveLbl.textContent = '…'; clearTimeout(st.t); st.t = setTimeout(flush, 900); }
    function flush() {
      Object.keys(st.dirty).forEach(function (pg) {
        delete st.dirty[pg];
        D.api('POST', 'api/books/annot', { book: book.id, page: Number(pg), items: st.pages[pg] || [] })
          .then(function () { saveLbl.textContent = '✓ Saqlandi'; })
          .catch(function (e) { saveLbl.textContent = '⚠ Saqlanmadi'; st.dirty[pg] = 1; UI.toast(e.message || 'Saqlanmadi', 'bad'); });
      });
    }
    function eraseAt(pg, p) {
      var r = 0.018, list = itemsOf(pg.n), before = list.length;
      var keep = list.filter(function (it) {
        if (it.t === 'x') {
          var lines = String(it.v).split('\n'), wq = 0; lines.forEach(function (l) { wq = Math.max(wq, l.length); });
          var w = wq * it.s * 0.55, hq = lines.length * it.s * 1.35 * book.ratio;
          var x0 = AR_RE.test(it.v) ? it.x - w : it.x;
          return !(p[0] >= x0 - r && p[0] <= x0 + w + r && p[1] >= it.y - r && p[1] <= it.y + hq + r);
        }
        for (var i = 0; i < it.p.length; i += 2) {
          var dx = it.p[i] - p[0], dy = (it.p[i + 1] - p[1]) / book.ratio;
          if (dx * dx + dy * dy < r * r) return false;
        }
        return true;
      });
      if (keep.length !== before) { st.pages[pg.n] = keep; redraw(pg); changed(pg.n); }
    }
    function bindDraw(pg) {
      var cv = pg.cv, drawId = null;
      function pt(e) { var r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; }
      cv.addEventListener('pointerdown', function (e) {
        if (st.tool === 'hand') return;
        e.preventDefault();
        if (st.tool === 'text') { textAt(pg, e, pt(e)); return; }
        cv.setPointerCapture(e.pointerId); drawId = e.pointerId;
        pushUndo(pg.n);
        if (st.tool === 'erase') { pg.cur = null; eraseAt(pg, pt(e)); return; }
        var p = pt(e), sz = SIZES[st.size];
        pg.cur = { t: st.tool === 'mark' ? 'm' : 'p', c: st.color, w: st.tool === 'mark' ? sz[1] : sz[0], p: [p[0], p[1]] };
        redraw(pg);
      });
      cv.addEventListener('pointermove', function (e) {
        if (drawId !== e.pointerId) return;
        if (st.tool === 'erase') { eraseAt(pg, pt(e)); return; }
        if (!pg.cur) return;
        var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        evs.forEach(function (ev) { var p = pt(ev), c = pg.cur.p, k = c.length; if (Math.abs(p[0] - c[k - 2]) + Math.abs(p[1] - c[k - 1]) > 0.0015) c.push(p[0], p[1]); });
        redraw(pg);
      });
      function endDraw(e) {
        if (drawId !== e.pointerId) return;
        drawId = null;
        if (pg.cur) { itemsOf(pg.n).push(pg.cur); pg.cur = null; redraw(pg); changed(pg.n); }
      }
      cv.addEventListener('pointerup', endDraw);
      cv.addEventListener('pointercancel', endDraw);
    }
    function textAt(pg, e, p) {
      var r = pg.el.getBoundingClientRect();
      var fs = SIZES[st.size][2] * r.width;
      var ta = h('textarea', { class: 'bk-ta', dir: 'auto', rows: 1, placeholder: 'Yozing… (Enter — tayyor)',
        style: 'left:' + (e.clientX - r.left) + 'px;top:' + (e.clientY - r.top) + 'px;font-size:' + fs + 'px;color:' + st.color });
      pg.el.appendChild(ta);
      setTimeout(function () { ta.focus(); }, 30);
      var done = false;
      function commit() {
        if (done) return; done = true;
        var v = ta.value.replace(/\s+$/, '');
        ta.remove();
        if (!v) return;
        pushUndo(pg.n);
        itemsOf(pg.n).push({ t: 'x', c: st.color, s: SIZES[st.size][2], x: p[0], y: p[1], v: v });
        redraw(pg); changed(pg.n);
      }
      ta.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(); }
        if (ev.key === 'Escape') { done = true; ta.remove(); }
      });
      ta.addEventListener('input', function () { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
      ta.addEventListener('blur', commit);
    }
    function undo() {
      var n = st.edit || st.page, u = st.undo[n];
      if (!u || !u.length) { UI.toast('Bekor qiladigan narsa yo‘q.', 'info'); return; }
      st.pages[n] = JSON.parse(u.pop()); redraw(P[n]); changed(n);
    }
    function clearPage() {
      var n = st.page;
      if (!itemsOf(n).length) { UI.toast(n + '-sahifada yozuv yo‘q.', 'info'); return; }
      if (!window.confirm(n + '-sahifadagi hamma yozuv va chizmalar o‘chirilsinmi?')) return;
      pushUndo(n); st.pages[n] = []; redraw(P[n]); changed(n);
    }
    function setTool(t) { st.tool = t; paintTools(); }
    function paintTools() {
      Object.keys(toolBtns).forEach(function (k) { toolBtns[k].classList.toggle('on', st.tool === k); });
      colorBtns.forEach(function (b, i) { b.classList.toggle('on', COLORS[i] === st.color); });
      sizeBtns.forEach(function (b, i) { b.classList.toggle('on', ['s', 'm', 'l'][i] === st.size); });
      hideBtn.classList.toggle('on', st.hide);
      root.classList.toggle('bk-drawing', st.tool !== 'hand');
    }

    /* ---- ikki barmoq bilan yaqinlashtirish, Ctrl+g'ildirak ---- */
    var pinch = null;
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        var a = e.touches[0], b = e.touches[1];
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: st.zoom };
        e.preventDefault();
      }
    }, { passive: false });
    stage.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      var a = e.touches[0], b = e.touches[1];
      var z = Math.max(0.5, Math.min(5, pinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d));
      if (Math.abs(z - st.zoom) > 0.03) { st.zoom = z; layout(true); }
    }, { passive: false });
    stage.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
    stage.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault(); setZoom(st.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    /* sichqoncha bilan surish (qo'l rejimida) */
    var drag = null;
    stage.addEventListener('mousedown', function (e) {
      if (st.tool !== 'hand' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop }; stage.classList.add('grab');
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    function onMove(e) { if (!drag) return; stage.scrollLeft = drag.l - (e.clientX - drag.x); stage.scrollTop = drag.t - (e.clientY - drag.y); }
    function onUp() { drag = null; stage.classList.remove('grab'); }

    function onKey(e) {
      if (root.__hidden) return;
      if (/^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(st.page + 1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(st.page - 1); e.preventDefault(); }
      else if (e.key === 'Home') { go(1); e.preventDefault(); }
      else if (e.key === 'End') { go(book.pages); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') setZoom(st.zoom * 1.25);
      else if (e.key === '-') setZoom(st.zoom / 1.25);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); }
      else if (e.key === 'Escape' && !document.fullscreenElement) close();
    }
    document.addEventListener('keydown', onKey);
    var lastW = 0;
    var ro = window.ResizeObserver ? new ResizeObserver(function () { if (root.__hidden || !stage.clientWidth) return; if (stage.clientWidth !== lastW) { lastW = stage.clientWidth; layout(true); } }) : null;
    if (ro) ro.observe(stage); else window.addEventListener('resize', onResize);
    function onResize() { if (!root.__hidden) layout(true); }

    function showThumbs() {
      var ov = h('div', { class: 'bk-thumbs' });
      var grid = h('div', { class: 'bk-tgrid' });
      for (var i = 1; i <= book.pages; i++) (function (n) {
        grid.appendChild(h('button', { type: 'button', class: 'bk-th' + (n === st.page ? ' on' : ''), onclick: function () { ov.remove(); go(n); } }, [
          h('img', { src: pageUrl(book, n), loading: 'lazy', alt: '' }), h('span', {}, String(n)), st.pages[n] && st.pages[n].length ? h('i', { title: 'Yozuv bor' }, '✏️') : null
        ]));
      })(i);
      ov.appendChild(h('div', { class: 'bk-thead' }, [h('b', {}, 'Sahifalar'), h('button', { type: 'button', class: 'bk-b', onclick: function () { ov.remove(); } }, '✕')]));
      ov.appendChild(grid);
      root.appendChild(ov);
    }
    function fullscreen() { if (fsOn()) exitFs(); else enterFs(); }
    var keepFs = false;
    function close() {
      flush();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
      if (!keepFs && !lessonOn()) exitFs();
      keepFs = false;
      root.remove(); document.body.classList.remove('bk-open');
      window.scrollTo(0, pageY);
    }
    paintTools();
    /* Boshida: noutbukda sahifa eniga (900px gacha) — o'qishga qulay; telefonda — eniga to'liq */
    requestAnimationFrame(function () {
      lastW = stage.clientWidth;
      applyLesson();
      st.zoom = lessonOn() ? fitWidthZoom() : Math.max(1, Math.min(fitWidthZoom(), 900 / baseWidth()));
      layout(false); go(st.page);
    });
  }

  /* =================== DAFTAR =================== */
  var HARAKAT = [['َ', 'fatha'], ['ِ', 'kasra'], ['ُ', 'damma'], ['ْ', 'sukun'], ['ّ', 'shadda'], ['ً', 'tanvin -an'], ['ٍ', 'tanvin -in'], ['ٌ', 'tanvin -un'], ['ٰ', 'kichik alif'], ['ـ', 'cho‘zish']];
  var AR_KEYS = ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د', 'ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط', 'ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ', 'أ', 'إ', 'آ', 'لا', '،', '؟', '؛'];


  /* =================== DAFTAR SHABLONLARI =================== */
  /* Fe'l shakllari: bitta ma'no + 6 shakl (masdar orada) */
  var FORMS6 = [
    ['الْمَاضِي', 'Moziy · o‘tgan zamon', 'nb-c1'], ['الْمُضَارِع', 'Muzori’ · hozirgi zamon', 'nb-c2'], ['الْمَصْدَر', 'Masdar', 'nb-c4'],
    ['الْأَمْر', 'Amr · buyruq', 'nb-c3'], ['اسْمُ الْفَاعِل', 'Ismi fo‘il', 'nb-c5'], ['اسْمُ الْمَفْعُول', 'Ismi maf’ul', 'nb-c6']
  ];
  /* [ma'nosi, moziy, muzori', masdar, amr, ismi fo'il, ismi maf'ul] */
  var VERBS6 = [
    ['yozmoq', 'كَتَبَ', 'يَكْتُبُ', 'كِتَابَةٌ', 'اُكْتُبْ', 'كَاتِبٌ', 'مَكْتُوبٌ'],
    ['ochmoq', 'فَتَحَ', 'يَفْتَحُ', 'فَتْحٌ', 'اِفْتَحْ', 'فَاتِحٌ', 'مَفْتُوحٌ'],
    ['bilmoq', 'عَلِمَ', 'يَعْلَمُ', 'عِلْمٌ', 'اِعْلَمْ', 'عَالِمٌ', 'مَعْلُومٌ']
  ];
  var PRON = [
    ['هُوَ', 'u (erkak)'], ['هُمَا', 'u ikkovi (erkak)'], ['هُمْ', 'ular (erkak)'],
    ['هِيَ', 'u (ayol)'], ['هُمَا', 'u ikkovi (ayol)'], ['هُنَّ', 'ular (ayol)'],
    ['أَنْتَ', 'sen (erkak)'], ['أَنْتُمَا', 'sizlar ikkovingiz (erkak)'], ['أَنْتُمْ', 'sizlar (erkak)'],
    ['أَنْتِ', 'sen (ayol)'], ['أَنْتُمَا', 'sizlar ikkovingiz (ayol)'], ['أَنْتُنَّ', 'sizlar (ayol)'],
    ['أَنَا', 'men'], ['نَحْنُ', 'biz']
  ];
  /* كَتَبَ — moziy, muzori', amr (faqat 2-shaxs) */
  var KATABA = [
    ['كَتَبَ', 'u yozdi', 'يَكْتُبُ', 'u yozadi', '', ''],
    ['كَتَبَا', 'ikkovi yozdi', 'يَكْتُبَانِ', 'ikkovi yozadi', '', ''],
    ['كَتَبُوا', 'ular yozdi', 'يَكْتُبُونَ', 'ular yozadi', '', ''],
    ['كَتَبَتْ', 'u yozdi', 'تَكْتُبُ', 'u yozadi', '', ''],
    ['كَتَبَتَا', 'ikkovi yozdi', 'تَكْتُبَانِ', 'ikkovi yozadi', '', ''],
    ['كَتَبْنَ', 'ular yozdi', 'يَكْتُبْنَ', 'ular yozadi', '', ''],
    ['كَتَبْتَ', 'sen yozding', 'تَكْتُبُ', 'sen yozasan', 'اُكْتُبْ', 'yoz!'],
    ['كَتَبْتُمَا', 'ikkovingiz yozdingiz', 'تَكْتُبَانِ', 'ikkovingiz yozasiz', 'اُكْتُبَا', 'ikkovingiz yozing!'],
    ['كَتَبْتُمْ', 'sizlar yozdingiz', 'تَكْتُبُونَ', 'sizlar yozasiz', 'اُكْتُبُوا', 'yozinglar!'],
    ['كَتَبْتِ', 'sen yozding', 'تَكْتُبِينَ', 'sen yozasan', 'اُكْتُبِي', 'yoz!'],
    ['كَتَبْتُمَا', 'ikkovingiz yozdingiz', 'تَكْتُبَانِ', 'ikkovingiz yozasiz', 'اُكْتُبَا', 'ikkovingiz yozing!'],
    ['كَتَبْتُنَّ', 'sizlar yozdingiz', 'تَكْتُبْنَ', 'sizlar yozasiz', 'اُكْتُبْنَ', 'yozinglar!'],
    ['كَتَبْتُ', 'men yozdim', 'أَكْتُبُ', 'men yozaman', '', ''],
    ['كَتَبْنَا', 'biz yozdik', 'نَكْتُبُ', 'biz yozamiz', '', '']
  ];
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cellAr(v) { return '<td class="nb-ar" dir="rtl">' + (v ? esc(v) : '<br>') + '</td>'; }
  function cellM(v) { return '<td class="nb-m" dir="ltr">' + (v ? esc(v) : '<br>') + '</td>'; }
  function formsTable(rows, empty) {
    var hd = '<tr><th class="nb-num">№</th><th class="nb-mh">Ma’nosi</th>' + FORMS6.map(function (f) {
      return '<th class="nb-h ' + f[2] + '">' + f[0] + '<small>' + f[1] + '</small></th>';
    }).join('') + '</tr>';
    var body = '', n = 0;
    rows.forEach(function (r) { n++; body += '<tr><td class="nb-num">' + n + '</td><td class="nb-mean" dir="ltr">' + esc(r[0]) + '</td>' + r.slice(1).map(cellAr).join('') + '</tr>'; });
    for (var i = 0; i < empty; i++) { n++; body += '<tr><td class="nb-num">' + n + '</td><td class="nb-mean" dir="ltr"><br></td>' + FORMS6.map(function () { return cellAr(''); }).join('') + '</tr>'; }
    return '<table class="nb-tbl" dir="rtl"><thead>' + hd + '</thead><tbody>' + body + '</tbody></table>';
  }
  function conjTable(verb, filled) {
    var hd = '<tr><th class="nb-h nb-c1">الضَّمِير<small>Olmosh</small></th><th class="nb-m">Ma’nosi</th>' +
      '<th class="nb-h nb-c2">الْمَاضِي<small>Moziy</small></th><th class="nb-m">Ma’nosi</th>' +
      '<th class="nb-h nb-c3">الْمُضَارِع<small>Muzori’</small></th><th class="nb-m">Ma’nosi</th>' +
      '<th class="nb-h nb-c4">الْأَمْر<small>Amr</small></th><th class="nb-m">Ma’nosi</th></tr>';
    var body = PRON.map(function (p, i) {
      var r = filled ? KATABA[i] : ['', '', '', '', '', ''];
      var second = i >= 6 && i <= 11;
      return '<tr><td class="nb-pr" dir="rtl">' + p[0] + '</td>' + cellM(p[1]) + cellAr(r[0]) + cellM(r[1]) + cellAr(r[2]) + cellM(r[3]) +
        (second ? cellAr(r[4]) + cellM(r[5]) : '<td class="nb-na">—</td><td class="nb-na">—</td>') + '</tr>';
    }).join('');
    return '<h2 dir="ltr">Fe’l: <span class="nb-verb" dir="rtl">' + (verb ? esc(verb[0]) : '……') + '</span> — ' + (verb ? esc(verb[1]) : '……') + '</h2>' +
      '<table class="nb-tbl" dir="rtl"><thead>' + hd + '</thead><tbody>' + body + '</tbody></table>';
  }
  var NB_TEMPLATES = [
    { id: 'blank', icon: '📄', title: 'Bo‘sh daftar', sub: 'Toza sahifa — xohlagan narsangizni yozasiz', name: 'Yangi daftar', html: function () { return '<p><br></p>'; } },
    { id: 'forms', icon: '📊', title: 'Fe’l shakllari', sub: 'Ma’nosi · Moziy · Muzori’ · Masdar · Amr · Ismi fo‘il · Ismi maf’ul', name: 'Fe’l shakllari',
      html: function () { return '<h2>Fe’llarning 6 shakli</h2>' + formsTable([], 10) + '<p><br></p>'; } },
    { id: 'conj0', icon: '🔤', title: 'Fe’l tuslash', sub: '14 olmosh tayyor — moziy, muzori’, amr va ma’nosini o‘zingiz yozasiz', name: 'Fe’l tuslash',
      html: function () { return conjTable(null, false) + '<p><br></p>'; } }
  ];
  function tplCard(t, onPick) {
    return h('button', { type: 'button', class: 'nb-tpl nb-tpl-' + t.id, onclick: function () { onPick(t); } }, [
      h('div', { class: 'nb-tpl-pv', 'aria-hidden': 'true' }, tplPreview(t.id)),
      h('b', {}, [t.icon + ' ', t.title]), h('small', {}, t.sub)
    ]);
  }
  function tplPreview(id) {
    if (id === 'blank') return h('div', { class: 'pv-blank' }, [h('i'), h('i'), h('i')]);
    var cols = id === 'forms' ? 8 : 8, rows = 7, out = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cls;
      if (id === 'forms') cls = r === 0 ? (c < 2 ? 'hm' : 'h' + (c - 1)) : (c === 1 ? 'mn' : (c === 0 ? 'm' : ''));
      else cls = r === 0 ? (c % 2 ? 'hm' : 'h' + ((c >> 1) % 6 + 1)) : (c % 2 ? 'm' : '');
      out.push(h('span', { class: cls }));
    }
    return h('div', { class: 'pv-grid', style: 'grid-template-columns:repeat(' + cols + ',1fr)' }, out);
  }
  function createFromTemplate(t, App) {
    D.api('POST', 'api/notebook', { title: t.name, html: t.html() }).then(function (r) { App.go('notebook', { id: r.notebook.id }); })
      .catch(function (e) { UI.toast(e.message || 'Bo‘lmadi', 'bad'); });
  }

  A.Pages.notebook = function (view, route, App) {
    if (!App.can('curriculum.view') && !App.can('lesson.log')) return App.guard('curriculum.view');
    if (route && route.id) { editor(view, route.id, App); return; }
    view.appendChild(UI.pageHead('Kitoblar va daftar', 'Darsda tushuntirish uchun yozuvlar — arabcha va o‘zbekcha', []));
    view.appendChild(tabsBar(App, 'daftar'));
    view.appendChild(h('div', { class: 'nb-tpls-wrap' }, [
      h('h3', { class: 'nb-tpls-h' }, 'Yangi daftar ochish — shablonni tanlang'),
      h('div', { class: 'nb-tpls' }, NB_TEMPLATES.map(function (t) { return tplCard(t, function (x) { createFromTemplate(x, App); }); }))
    ]));
    view.appendChild(h('h3', { class: 'nb-tpls-h' }, 'Mening daftarlarim'));
    var box = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    view.appendChild(box);
    D.api('GET', 'api/notebooks').then(function (r) {
      UI.clear(box);
      if (!r.notebooks.length) { box.appendChild(UI.empty({ title: 'Hali daftar yo‘q', text: 'Yuqoridan shablon tanlang — darsda yozib tushuntirasiz, keyin guruhga yuborasiz.' })); return; }
      box.appendChild(h('div', { class: 'nb-grid' }, r.notebooks.map(function (n) {
        return h('div', { class: 'nb-card' }, [
          h('button', { type: 'button', class: 'nb-open', onclick: function () { App.go('notebook', { id: n.id }); } }, [
            h('b', {}, n.title), h('p', { dir: 'auto' }, n.preview || 'Bo‘sh'), h('small', {}, n.updatedAt ? 'O‘zgartirildi: ' + n.updatedAt : '')
          ]),
          h('button', { type: 'button', class: 'btn sm', title: 'O‘chirish', onclick: function () {
            if (!window.confirm('«' + n.title + '» o‘chirilsinmi?')) return;
            D.api('POST', 'api/notebook/delete', { id: n.id }).then(function () { UI.toast('O‘chirildi.', 'ok'); App.render(); }).catch(function (e) { UI.toast(e.message, 'bad'); });
          } }, UI.icon('trash'))
        ]);
      })));
    }).catch(function (e) { UI.clear(box); box.appendChild(h('div', { class: 'note bad' }, e.message || 'Yuklab bo‘lmadi')); });
  };

  function editor(view, id, App) {
    var box = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    view.appendChild(box);
    D.api('GET', 'api/notebook?id=' + encodeURIComponent(id)).then(function (r) {
      UI.clear(box);
      var nb = r.notebook;
      lsSet('nb-last', nb.id); lsSet('nb-last-title', nb.title || 'Daftar');
      var title = h('input', { class: 'nb-title', value: nb.title || '', placeholder: 'Daftar nomi', maxlength: 120 });
      var state = h('span', { class: 'nb-state' }, '✓ Saqlangan');
      var ed = h('div', { class: 'nb-ed', contenteditable: 'true', dir: 'auto', spellcheck: 'false' });
      ed.innerHTML = nb.html || '<p><br></p>';
      var t = null;
      function save() {
        state.textContent = 'Saqlanmoqda…';
        D.api('POST', 'api/notebook', { id: nb.id, title: title.value, html: ed.innerHTML })
          .then(function () { state.textContent = '✓ Saqlangan'; })
          .catch(function (e) { state.textContent = '⚠ Saqlanmadi'; UI.toast(e.message || 'Saqlanmadi', 'bad'); });
      }
      function later() { state.textContent = '…'; clearTimeout(t); t = setTimeout(save, 1000); }
      ed.addEventListener('input', later); title.addEventListener('input', later);
      function cmd(c, v) { ed.focus(); try { document.execCommand('styleWithCSS', false, true); } catch (e) { } document.execCommand(c, false, v == null ? null : v); later(); }
      function ins(txt) { ed.focus(); document.execCommand('insertText', false, txt); later(); }
      function setDir(d) {
        ed.focus();
        var sel = window.getSelection(); if (!sel.rangeCount) return;
        var n = sel.getRangeAt(0).startContainer;
        while (n && n !== ed && !(n.nodeType === 1 && /^(P|DIV|LI|H1|H2|H3|BLOCKQUOTE)$/.test(n.tagName))) n = n.parentNode;
        if (!n || n === ed) { document.execCommand('formatBlock', false, 'p'); n = sel.getRangeAt(0).startContainer; while (n && n !== ed && !(n.nodeType === 1 && n.tagName === 'P')) n = n.parentNode; }
        if (n && n !== ed) { n.setAttribute('dir', d); n.style.textAlign = d === 'rtl' ? 'right' : 'left'; later(); }
      }
      function b(label, title, fn, cls) { return h('button', { type: 'button', class: 'nb-b ' + (cls || ''), title: title, onmousedown: function (e) { e.preventDefault(); }, onclick: fn }, label); }
      /* ---- jadval bilan ishlash ---- */
      function curCell() {
        var sel = window.getSelection(); if (!sel.rangeCount) return null;
        var n = sel.getRangeAt(0).startContainer;
        while (n && n !== ed && !(n.nodeType === 1 && /^(TD|TH)$/.test(n.tagName))) n = n.parentNode;
        return n && n !== ed ? n : null;
      }
      function needCell() { var c = curCell(); if (!c) UI.toast('Avval jadval ichidagi katakni bosing.', 'info'); return c; }
      function renumber(tbl) {
        Array.prototype.forEach.call(tbl.querySelectorAll('tbody tr'), function (tr, i) {
          var f = tr.firstElementChild; if (f && f.classList.contains('nb-num')) f.textContent = String(i + 1);
        });
      }
      function emptyLike(td) {
        var c = document.createElement(td.tagName === 'TH' ? 'td' : td.tagName.toLowerCase());
        c.className = td.className; if (td.getAttribute('dir')) c.setAttribute('dir', td.getAttribute('dir'));
        c.innerHTML = c.classList.contains('nb-num') ? '' : '<br>';
        return c;
      }
      function addRow(after) {
        var td = needCell(); if (!td) return;
        var tr = td.parentNode, tbl = tr.closest('table');
        var src = tr.parentNode.tagName === 'THEAD' ? (tbl.querySelector('tbody tr') || tr) : tr;
        var nr = document.createElement('tr');
        Array.prototype.forEach.call(src.children, function (c) { nr.appendChild(emptyLike(c)); });
        if (tr.parentNode.tagName === 'THEAD') { var tb = tbl.querySelector('tbody') || tbl.appendChild(document.createElement('tbody')); tb.insertBefore(nr, tb.firstChild); }
        else tr.parentNode.insertBefore(nr, after ? tr.nextSibling : tr);
        renumber(tbl); later();
      }
      function delRow() {
        var td = needCell(); if (!td) return;
        var tr = td.parentNode, tbl = tr.closest('table');
        if (tr.parentNode.tagName === 'THEAD') { UI.toast('Sarlavha qatorini o‘chirib bo‘lmaydi.', 'info'); return; }
        if (tbl.querySelectorAll('tbody tr').length <= 1) { UI.toast('Oxirgi qator qoldi.', 'info'); return; }
        tr.remove(); renumber(tbl); later();
      }
      function addCol() {
        var td = needCell(); if (!td) return;
        var idx = Array.prototype.indexOf.call(td.parentNode.children, td), tbl = td.closest('table');
        Array.prototype.forEach.call(tbl.rows, function (tr) {
          var ref = tr.children[idx]; if (!ref) return;
          var c = document.createElement(ref.tagName.toLowerCase());
          c.innerHTML = '<br>'; if (ref.tagName === 'TH') { c.className = 'nb-m'; c.textContent = 'Yangi'; }
          tr.insertBefore(c, ref.nextSibling);
        });
        later();
      }
      function delCol() {
        var td = needCell(); if (!td) return;
        var idx = Array.prototype.indexOf.call(td.parentNode.children, td), tbl = td.closest('table');
        if (td.parentNode.children.length <= 1) return;
        Array.prototype.forEach.call(tbl.rows, function (tr) { if (tr.children[idx]) tr.children[idx].remove(); });
        later();
      }
      function delTable() {
        var td = needCell(); if (!td) return;
        if (!window.confirm('Butun jadval o‘chirilsinmi?')) return;
        td.closest('table').remove(); later();
      }
      function insertHtmlAtCursor(html) {
        ed.focus();
        var c = curCell();
        if (c) { /* jadval ichida bo'lsa — jadvaldan keyin qo'yamiz */
          var tb = c.closest('table'), r = document.createRange(); r.setStartAfter(tb); r.collapse(true);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        }
        document.execCommand('insertHTML', false, html); later();
      }
      function newTable() {
        var rows = '', i, j;
        for (i = 0; i < 4; i++) { rows += '<tr>'; for (j = 0; j < 4; j++) rows += '<td><br></td>'; rows += '</tr>'; }
        insertHtmlAtCursor('<table class="nb-tbl" dir="auto"><thead><tr><th>Sarlavha</th><th>Sarlavha</th><th>Sarlavha</th><th>Sarlavha</th></tr></thead><tbody>' + rows + '</tbody></table><p><br></p>');
      }
      function tplMenu() {
        var m = UI.modal({ title: 'Shablon qo‘shish', wide: true, body: [
          h('p', { class: 'muted' }, 'Tanlangan shablon daftarning kursor turgan joyiga qo‘shiladi.'),
          h('div', { class: 'nb-tpls' }, NB_TEMPLATES.filter(function (t) { return t.id !== 'blank'; }).map(function (t) {
            return tplCard(t, function (x) { m.close(); insertHtmlAtCursor(x.html()); });
          }))
        ], actions: [{ label: 'Yopish' }] });
      }
      ed.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var c = curCell(); if (!c) return;
        e.preventDefault();
        var cells = Array.prototype.slice.call(c.closest('table').querySelectorAll('td,th'));
        var i = cells.indexOf(c) + (e.shiftKey ? -1 : 1);
        if (i >= cells.length && !e.shiftKey) { addRow(true); cells = Array.prototype.slice.call(c.closest('table').querySelectorAll('td,th')); }
        var nx = cells[Math.max(0, i)]; if (!nx) return;
        var r = document.createRange(); r.selectNodeContents(nx); r.collapse(false);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      });
      var tblBar = h('div', { class: 'nb-bar nb-bar2' }, [
        b('📋 Shablon', 'Fe’l jadvali va boshqa shablonlarni qo‘shish', tplMenu, 'wide'),
        b('▦ Jadval', 'Yangi bo‘sh jadval', newTable, 'wide'),
        h('span', { class: 'nb-sep' }),
        b('+ qator', 'Pastiga qator qo‘shish', function () { addRow(true); }, 'wide'),
        b('− qator', 'Qatorni o‘chirish', delRow, 'wide'),
        b('+ ustun', 'Yoniga ustun qo‘shish', addCol, 'wide'),
        b('− ustun', 'Ustunni o‘chirish', delCol, 'wide'),
        b('🗑 jadval', 'Jadvalni o‘chirish', delTable, 'wide')
      ]);
      var COLS = ['#111111', '#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a'];
      var kb = h('div', { class: 'nb-kb', style: 'display:none' }, [
        h('div', { class: 'nb-kb-row' }, AR_KEYS.map(function (k) { return b(k, k, function () { ins(k); }, 'ar'); })),
        h('div', { class: 'nb-kb-row' }, HARAKAT.map(function (x) { return b('◌' + x[0], x[1], function () { ins(x[0]); }, 'ar'); }).concat([
          b('␣', 'Bo‘shliq', function () { ins(' '); }), b('⌫', 'O‘chirish', function () { ed.focus(); document.execCommand('delete'); later(); }), b('↵', 'Yangi qator', function () { ed.focus(); document.execCommand('insertParagraph'); later(); })]))
      ]);
      var bar = h('div', { class: 'nb-bar' }, [
        b(h('b', {}, 'B'), 'Qalin', function () { cmd('bold'); }), b(h('i', {}, 'I'), 'Qiya', function () { cmd('italic'); }), b(h('u', {}, 'U'), 'Tagiga chizish', function () { cmd('underline'); }),
        h('span', { class: 'nb-sep' }),
        b('H1', 'Katta sarlavha', function () { cmd('formatBlock', 'h1'); }), b('H2', 'Sarlavha', function () { cmd('formatBlock', 'h2'); }), b('¶', 'Oddiy matn', function () { cmd('formatBlock', 'p'); }),
        b('A−', 'Kichikroq', function () { cmd('fontSize', '2'); }), b('A', 'O‘rtacha', function () { cmd('fontSize', '4'); }), b('A+', 'Kattaroq', function () { cmd('fontSize', '6'); }), b('A++', 'Juda katta', function () { cmd('fontSize', '7'); }),
        h('span', { class: 'nb-sep' })
      ].concat(COLS.map(function (c) { return h('button', { type: 'button', class: 'nb-col', style: 'background:' + c, title: 'Rang', onmousedown: function (e) { e.preventDefault(); }, onclick: function () { cmd('foreColor', c); } }); })).concat([
        b('🖍', 'Sariq bilan belgilash', function () { cmd('hiliteColor', '#fff59d'); }),
        h('span', { class: 'nb-sep' }),
        b('⇤', 'Chapga', function () { cmd('justifyLeft'); }), b('↔', 'O‘rtaga', function () { cmd('justifyCenter'); }), b('⇥', 'O‘ngga', function () { cmd('justifyRight'); }),
        b('ع←', 'Arabcha: o‘ngdan chapga', function () { setDir('rtl'); }), b('→A', 'Chapdan o‘ngga', function () { setDir('ltr'); }),
        b('•', 'Ro‘yxat', function () { cmd('insertUnorderedList'); }), b('1.', 'Raqamli ro‘yxat', function () { cmd('insertOrderedList'); }),
        h('span', { class: 'nb-sep' }),
        b('⌨ عربي', 'Arabcha klaviatura va harakatlar', function () { kb.style.display = kb.style.display === 'none' ? 'block' : 'none'; }, 'wide'),
        b('↶', 'Bekor qilish', function () { cmd('undo'); }), b('↷', 'Qaytarish', function () { cmd('redo'); }), b('⌀', 'Formatni tozalash', function () { cmd('removeFormat'); })
      ]));
      function saveNow() { clearTimeout(t); state.textContent = 'Saqlanmoqda…'; return D.api('POST', 'api/notebook', { id: nb.id, title: title.value, html: ed.innerHTML }).then(function () { state.textContent = '✓ Saqlangan'; }); }
      view.insertBefore(h('div', { class: 'nb-head' }, [
        h('button', { class: 'btn', onclick: function () { clearTimeout(t); save(); App.go('notebook'); } }, [UI.icon('back'), 'Daftarlar']),
        title, state,
        h('button', { class: 'btn', onclick: function () { saveNow().then(function () { exportMenu(nb, title.value); }).catch(function (e) { UI.toast(e.message, 'bad'); }); } }, ['⬇️ ', 'Yuklab olish']),
        h('button', { class: 'btn', onclick: function () { saveNow().then(function () { sendDialog(nb, title.value); }).catch(function (e) { UI.toast(e.message, 'bad'); }); } }, ['📤 ', 'Guruhga yuborish']),
        h('button', { class: 'btn primary', onclick: function () { present(ed.innerHTML, title.value); } }, [UI.icon('play'), 'Darsda ko‘rsatish']),
        h('button', { class: 'btn ls-mode' + (lessonOn() ? ' on' : ''), title: 'Menyu va panellar yashiriladi, ekran to‘liq ochiladi', onclick: function () {
          setLesson(!lessonOn()); App.render();
        } }, lessonOn() ? '✕ Oddiy rejim' : '⛶ Dars rejimi')
      ]), box);
      title.addEventListener('input', function () { lsSet('nb-last-title', title.value || 'Daftar'); });
      var b0 = lastBook(), pg0 = Number(lsGet('bk-last-' + b0.id)) || 1;
      view.appendChild(switcher('book', function () { clearTimeout(t); save(); A.openBookLast(); }, b0.title + ' · ' + pg0 + '-bet'));
      box.appendChild(bar); box.appendChild(tblBar); box.appendChild(kb); box.appendChild(ed);
      /* Daftarning qayerida turgan bo'lsangiz — qaytganda o'sha joy */
      var skey = 'nb-scroll-' + nb.id, sv = 0;
      try { sv = Number(sessionStorage.getItem(skey)) || 0; } catch (e) { }
      if (sv) requestAnimationFrame(function () { window.scrollTo(0, sv); });
      var stt = null;
      function onWinScroll() {
        if (!document.body.contains(ed)) { window.removeEventListener('scroll', onWinScroll); return; }
        clearTimeout(stt); stt = setTimeout(function () { try { sessionStorage.setItem(skey, String(Math.round(window.scrollY))); } catch (e) { } }, 150);
      }
      window.addEventListener('scroll', onWinScroll, { passive: true });
      try { ed.focus({ preventScroll: true }); } catch (e) { }
    }).catch(function (e) { UI.clear(box); box.appendChild(h('div', { class: 'note bad' }, e.message || 'Daftar topilmadi')); });
  }


  /* =================== Yuklab olish va guruhga yuborish =================== */
  function exportUrl(nb, fmt, inline) { return 'api/notebook/export?id=' + encodeURIComponent(nb.id) + '&fmt=' + fmt + (inline ? '&inline=1' : ''); }
  function download(url) { var a = document.createElement('a'); a.href = url; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  function exportMenu(nb, title) {
    function opt(icon, name, sub, fn) {
      return h('button', { type: 'button', class: 'nb-exp', onclick: function () { m.close(); fn(); } }, [h('span', { class: 'nb-exp-i' }, icon), h('div', {}, [h('b', {}, name), h('small', {}, sub)])]);
    }
    var m = UI.modal({ title: 'Daftarni yuklab olish', body: [
      h('p', { class: 'muted' }, '«' + (title || 'Daftar') + '» — jadvallar va arabcha yozuvlar bilan.'),
      h('div', { class: 'nb-exps' }, [
        opt('📄', 'PDF / chop etish', 'Ochilgan oynada «PDF sifatida saqlash» ni tanlang', function () { printNb(nb); }),
        opt('📝', 'Word (.doc)', 'Word, Google Docs yoki telefonda ochiladi va tahrirlanadi', function () { download(exportUrl(nb, 'doc')); }),
        opt('🌐', 'Veb-sahifa (.html)', 'Har qanday telefon va kompyuterda ochiladi', function () { download(exportUrl(nb, 'html')); })
      ])
    ], actions: [{ label: 'Yopish' }] });
  }
  function printNb(nb) {
    var w = window.open('', '_blank');
    if (!w) { UI.toast('Brauzer yangi oynani to‘sdi — ruxsat bering.', 'bad'); return; }
    w.document.write('<p style="font-family:sans-serif;padding:20px">Tayyorlanmoqda…</p>');
    fetch(exportUrl(nb, 'html', true), { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(function () { try { w.focus(); w.print(); } catch (e) { } }, 900);
    }).catch(function () { w.close(); UI.toast('Tayyorlab bo‘lmadi.', 'bad'); });
  }
  var SEND_TEXT = '📒 Mana sizlarga yangi o‘tilgan mavzular bo‘yicha daftar. Shuni ko‘chirib olinglar!';
  function sendDialog(nb, title) {
    var sel = h('select', { class: 'input' }, h('option', { value: '' }, 'Yuklanmoqda…'));
    var info = h('p', { class: 'muted nb-send-info' }, '');
    var txt = h('textarea', { class: 'input', rows: 3, maxlength: 900 });
    txt.value = lsGet('nb-send-text') || SEND_TEXT;
    var groups = [];
    function showInfo() {
      var g = groups.filter(function (x) { return x.id === sel.value; })[0];
      info.textContent = !g ? '' : g.tg ? '✅ Guruhning Telegram chatiga fayl bo‘lib boradi.' : 'ℹ️ Guruh chatga ulanmagan — botga ulangan har bir o‘quvchiga shaxsan boradi.';
    }
    sel.addEventListener('change', function () { lsSet('nb-send-group', sel.value); showInfo(); });
    D.api('GET', 'api/notebook/groups').then(function (r) {
      groups = r.groups || [];
      UI.clear(sel);
      if (!groups.length) { sel.appendChild(h('option', { value: '' }, 'Guruh yo‘q')); return; }
      var last = lsGet('nb-send-group');
      groups.forEach(function (g) { sel.appendChild(h('option', { value: g.id }, g.name + (g.tg ? '' : ' (chatsiz)'))); });
      if (groups.some(function (g) { return g.id === last; })) sel.value = last;
      showInfo();
    }).catch(function (e) { UI.clear(sel); sel.appendChild(h('option', { value: '' }, e.message || 'Xato')); });
    UI.modal({ title: 'Daftarni guruhga yuborish', body: [
      h('p', {}, ['📒 ', h('b', {}, title || 'Daftar'), ' — o‘quvchilarga fayl bo‘lib boradi, telefonda ochib, saqlab olishadi.']),
      h('label', { class: 'field' }, [h('span', {}, 'Guruh'), sel]), info,
      h('label', { class: 'field' }, [h('span', {}, 'Xabar matni'), txt])
    ], actions: [
      { label: 'Bekor qilish' },
      { label: '📤 Yuborish', cls: 'primary', onClick: function (close, btn) {
        if (!sel.value) { UI.toast('Guruhni tanlang.', 'info'); return; }
        btn.disabled = true; btn.textContent = 'Yuborilmoqda…';
        lsSet('nb-send-text', txt.value);
        D.api('POST', 'api/notebook/send', { id: nb.id, groupId: sel.value, text: txt.value }).then(function (r) {
          close();
          UI.toast(r.where === 'group' ? 'Guruh chatiga yuborildi ✅' : r.sent + ' ta o‘quvchiga yuborildi ✅' + (r.failed ? ' (' + r.failed + ' tasiga bormadi)' : ''), 'ok');
        }).catch(function (e) { btn.disabled = false; btn.textContent = '📤 Yuborish'; UI.toast(e.message || 'Yuborilmadi', 'bad'); });
      } }
    ] });
  }

  /* Darsda katta qilib ko'rsatish (Zoom'da ekran ulashish uchun qulay) */
  function present(html, title) {
    var scale = Number(lsGet('nb-scale')) || 1.6;
    var body = h('div', { class: 'nb-pres-body', dir: 'auto' }); body.innerHTML = html;
    function apply() { body.style.fontSize = (22 * scale) + 'px'; lsSet('nb-scale', String(scale)); }
    var ov = h('div', { class: 'nb-pres', tabindex: '-1' }, [
      h('div', { class: 'nb-pres-top' }, [h('b', {}, title || ''),
        h('button', { type: 'button', class: 'bk-b', onclick: function () { scale = Math.max(0.8, scale / 1.15); apply(); } }, 'A−'),
        h('button', { type: 'button', class: 'bk-b', onclick: function () { scale = Math.min(4, scale * 1.15); apply(); } }, 'A+'),
        h('button', { type: 'button', class: 'bk-b', onclick: function () { if (fsOn()) exitFs(); else enterFs(); } }, '⛶'),
        h('button', { type: 'button', class: 'bk-b', onclick: close }, '✕')]),
      body
    ]);
    function close() { if (!lessonOn()) exitFs(); ov.remove(); document.removeEventListener('keydown', k); }
    function k(e) { if (e.key === 'Escape' && !document.fullscreenElement) close(); }
    document.addEventListener('keydown', k);
    apply(); document.body.appendChild(ov); ov.focus();
  }
})(typeof window !== 'undefined' ? window : globalThis);
