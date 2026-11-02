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
    { id: 'nabra-a0', title: 'Nabra — A0', sub: '1-kitob · O‘qish va yozish', ar: 'نَبْرَة', pages: 48, ratio: 1600 / 2264 }
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
    var top = h('div', { class: 'bk-top' }, [
      tbtn('←', 'Yopish', close, 'bk-x'),
      h('b', { class: 'bk-title' }, book.title),
      h('div', { class: 'bk-nav' }, [tbtn('‹', 'Oldingi sahifa', function () { go(st.page - 1); }), pgIn, h('span', { class: 'bk-of' }, '/ ' + book.pages), tbtn('›', 'Keyingi sahifa', function () { go(st.page + 1); })]),
      h('div', { class: 'bk-zoom' }, [tbtn('−', 'Kichiklashtirish', function () { setZoom(st.zoom / 1.25); }), zoomLbl, tbtn('+', 'Yaqinlashtirish', function () { setZoom(st.zoom * 1.25); }),
        tbtn('⤢', 'Sahifaga sig‘dirish', function () { setZoom(1); }), tbtn('⇔', 'Eniga sig‘dirish', function () { setZoom(fitWidthZoom()); })]),
      tbtn('▦', 'Sahifalar', showThumbs), tbtn('⛶', 'To‘liq ekran', fullscreen), saveLbl
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
    root.appendChild(top); root.appendChild(stage); root.appendChild(bottom);
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
      if (best !== st.page) { st.page = best; pgIn.value = best; lsSet('bk-last-' + book.id, String(best)); }
    }
    var ticking = false;
    stage.addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; watch(); }); });

    function go(n) {
      n = Math.max(1, Math.min(book.pages, Number(n) || 1));
      stage.scrollTop = P[n].el.offsetTop - 8;
      st.page = n; pgIn.value = n; lsSet('bk-last-' + book.id, String(n));
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
    var ro = window.ResizeObserver ? new ResizeObserver(function () { if (stage.clientWidth !== lastW) { lastW = stage.clientWidth; layout(true); } }) : null;
    if (ro) ro.observe(stage); else window.addEventListener('resize', onResize);
    function onResize() { layout(true); }

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
    function fullscreen() {
      try { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen(); } catch (e) { }
    }
    function close() {
      flush();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
      root.remove(); document.body.classList.remove('bk-open');
    }
    paintTools();
    /* Boshida: noutbukda sahifa eniga (900px gacha) — o'qishga qulay; telefonda — eniga to'liq */
    requestAnimationFrame(function () {
      lastW = stage.clientWidth;
      st.zoom = Math.max(1, Math.min(fitWidthZoom(), 900 / baseWidth()));
      layout(false); go(st.page);
    });
  }

  /* =================== DAFTAR =================== */
  var HARAKAT = [['َ', 'fatha'], ['ِ', 'kasra'], ['ُ', 'damma'], ['ْ', 'sukun'], ['ّ', 'shadda'], ['ً', 'tanvin -an'], ['ٍ', 'tanvin -in'], ['ٌ', 'tanvin -un'], ['ٰ', 'kichik alif'], ['ـ', 'cho‘zish']];
  var AR_KEYS = ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د', 'ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط', 'ئ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ', 'أ', 'إ', 'آ', 'لا', '،', '؟', '؛'];

  A.Pages.notebook = function (view, route, App) {
    if (!App.can('curriculum.view') && !App.can('lesson.log')) return App.guard('curriculum.view');
    if (route && route.id) { editor(view, route.id, App); return; }
    view.appendChild(UI.pageHead('Kitoblar va daftar', 'Darsda tushuntirish uchun yozuvlar — arabcha va o‘zbekcha', [
      h('button', { class: 'btn primary', onclick: function () {
        D.api('POST', 'api/notebook', { title: 'Yangi daftar', html: '' }).then(function (r) { App.go('notebook', { id: r.notebook.id }); })
          .catch(function (e) { UI.toast(e.message || 'Bo‘lmadi', 'bad'); });
      } }, [UI.icon('plus'), 'Yangi daftar'])
    ]));
    view.appendChild(tabsBar(App, 'daftar'));
    var box = h('div', {}, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    view.appendChild(box);
    D.api('GET', 'api/notebooks').then(function (r) {
      UI.clear(box);
      if (!r.notebooks.length) { box.appendChild(UI.empty({ title: 'Hali daftar yo‘q', text: '«Yangi daftar» ni bosing — darsda yozib tushuntirasiz, keyin yana ochasiz.' })); return; }
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
      view.insertBefore(h('div', { class: 'nb-head' }, [
        h('button', { class: 'btn', onclick: function () { clearTimeout(t); save(); App.go('notebook'); } }, [UI.icon('back'), 'Daftarlar']),
        title, state,
        h('button', { class: 'btn primary', onclick: function () { present(ed.innerHTML, title.value); } }, [UI.icon('play'), 'Darsda ko‘rsatish'])
      ]), box);
      box.appendChild(bar); box.appendChild(kb); box.appendChild(ed);
      ed.focus();
    }).catch(function (e) { UI.clear(box); box.appendChild(h('div', { class: 'note bad' }, e.message || 'Daftar topilmadi')); });
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
        h('button', { type: 'button', class: 'bk-b', onclick: function () { try { if (document.fullscreenElement) document.exitFullscreen(); else ov.requestFullscreen(); } catch (e) { } } }, '⛶'),
        h('button', { type: 'button', class: 'bk-b', onclick: close }, '✕')]),
      body
    ]);
    function close() { try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { } ov.remove(); document.removeEventListener('keydown', k); }
    function k(e) { if (e.key === 'Escape' && !document.fullscreenElement) close(); }
    document.addEventListener('keydown', k);
    apply(); document.body.appendChild(ov); ov.focus();
  }
})(typeof window !== 'undefined' ? window : globalThis);
