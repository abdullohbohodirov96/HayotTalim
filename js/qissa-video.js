/* Qissa videodarsi — harakatli sahna (SVG + CSS), ovoz va subtitr bilan.
   Ikki qahramon (Maryam va Zaynab) sahnaga kiradi, salomlashadi, gapiradi;
   har gapda qo'l harakati, ko'rsatish va "surat"dagi oila a'zolari belgilanadi.
   Oxirida yangi so'zlar takrori va qoida kartasi.

   Ovoz manbai (birinchi topilgani):
     1) tayyor audio fayllar (opts.audioUrl(i)) — masalan ElevenLabs bilan
        serverda yaratilgan studiya ovozi;
     2) brauzerning o'z arabcha ovozi (speechSynthesis) — bepul.
   Render rejimi (window.QV_RENDER) — MP4 yozish uchun: ovozsiz, aniq vaqt bo'yicha.
   Yuzlar chizilmaydi (siluet), ayollar ro'molda.                                */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};

  var SK = '#f1d3b5', G1 = '#0f4a40', G2 = '#1f9d74', G3 = '#8fd9bd', GS = '#e2f4ec', INK = '#173a33', WOOD = '#b98b5e';

  /* ---------- kichik DOM yordamchisi (UI ga bog'lanmaslik uchun) ---------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) { add(c); return; }
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    })(Array.isArray(kids) ? kids : kids == null ? [] : [kids]);
    return e;
  }

  /* ---------- Qahramonlar (oyoq tagi 0, bo'yi ~260) ---------- */
  function arm(id, x, color, side) {
    /* yelkadan pastga osilgan qo'l; CSS shu nuqta atrofida aylantiradi */
    return '<g transform="translate(' + x + ' -178)"><g class="qv-arm qv-arm-' + side + '" data-arm="' + id + '">' +
      '<rect x="-8" y="0" width="16" height="84" rx="8" fill="' + color + '"/>' +
      '<circle cx="0" cy="88" r="9" fill="' + SK + '"/></g></g>';
  }
  function heroine(id, dress, scarf) {
    return '<g class="qv-char" data-char="' + id + '"><g class="qv-pos"><g class="qv-body">' +
      '<ellipse cx="0" cy="4" rx="70" ry="12" fill="rgba(15,74,64,.12)"/>' +
      '<path d="M-36 -186q36-16 72 0l30 186h-132z" fill="' + dress + '"/>' +
      '<path d="M-36 -186q36-16 72 0l6 40q-42 12-84 0z" fill="rgba(255,255,255,.08)"/>' +
      arm(id + 'L', -40, dress, 'l') + arm(id + 'R', 40, dress, 'r') +
      '<path d="M-44 -222a44 46 0 1 1 88 0q0 34-44 44q-44-10-44-44z" fill="' + scarf + '"/>' +
      '<ellipse cx="0" cy="-232" rx="25" ry="30" fill="' + SK + '"/>' +
      '<path d="M-28 -246q28-34 56 0q-6-30-28-30t-28 30z" fill="' + scarf + '"/>' +
      '<g class="qv-waves" transform="translate(52 -250)"><path d="M0 -10q8 10 0 20" stroke="' + G2 + '" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M10 -18q14 18 0 36" stroke="' + G3 + '" stroke-width="4" fill="none" stroke-linecap="round"/></g>' +
      '<g class="qv-q" transform="translate(-6 -330)"><circle r="26" fill="#fff" stroke="' + G2 + '" stroke-width="3"/>' +
      '<text y="11" text-anchor="middle" font-size="32" font-weight="800" fill="' + G1 + '">?</text></g>' +
      '</g></g></g>';
  }
  /* Suratdagi oila a'zolari (kichik siluetlar) */
  function member(key, x, kind, s) {
    var body;
    if (kind === 'man' || kind === 'oldman' || kind === 'boy') {
      var shirt = kind === 'boy' ? G3 : (kind === 'oldman' ? '#5c7a70' : G2);
      body = '<rect x="-9" y="-26" width="7" height="26" rx="3" fill="' + INK + '"/><rect x="2" y="-26" width="7" height="26" rx="3" fill="' + INK + '"/>' +
        '<rect x="-13" y="-62" width="26" height="38" rx="8" fill="' + shirt + '"/>' +
        '<rect x="-19" y="-58" width="7" height="28" rx="3.5" fill="' + shirt + '"/><rect x="12" y="-58" width="7" height="28" rx="3.5" fill="' + shirt + '"/>' +
        '<circle cx="0" cy="-73" r="11" fill="' + SK + '"/>' +
        (kind === 'oldman' ? '<path d="M-9 -70q9 17 18 0q-4 8-9 8t-9-8z" fill="#e9eeec"/><path d="M-11 -78a11 7 0 0 1 22 0z" fill="#fff"/>' +
          '<path d="M24 -36v36" stroke="' + WOOD + '" stroke-width="3.5" stroke-linecap="round"/>'
          : '<path d="M-11 -76a11 11 0 0 1 22 0z" fill="' + INK + '"/>');
    } else {
      var dress = kind === 'girl' ? G3 : (kind === 'oldwoman' ? '#7b958c' : G2);
      var scarf = kind === 'girl' ? G2 : (kind === 'oldwoman' ? '#e6ece9' : G1);
      body = '<path d="M-14 -60q14-7 28 0l7 60h-42z" fill="' + dress + '"/>' +
        '<path d="M-14 -70a14 15 0 1 1 28 0q0 12-14 14q-14-2-14-14z" fill="' + scarf + '"/>' +
        '<ellipse cx="0" cy="-73" rx="7.5" ry="9" fill="' + SK + '"/>' +
        (kind === 'oldwoman' ? '<path d="M24 -34v34" stroke="' + WOOD + '" stroke-width="3.5" stroke-linecap="round"/>' : '');
    }
    return '<g class="qv-mem" data-mem="' + key + '" transform="translate(' + x + ' 222) scale(' + (s || 1.25) + ')">' +
      '<ellipse class="qv-mem-glow" cx="0" cy="2" rx="30" ry="8" fill="' + G3 + '"/>' + body + '</g>';
  }
  function tag(key, x, ar, uz) {
    return '<g class="qv-tag" data-tag="' + key + '" transform="translate(' + x + ' 250)">' +
      '<rect x="-46" y="-2" width="92" height="46" rx="12" fill="#fff" stroke="' + G2 + '" stroke-width="2"/>' +
      '<text x="0" y="20" text-anchor="middle" class="qv-ar-t" font-size="20" fill="' + G1 + '">' + ar + '</text>' +
      '<text x="0" y="38" text-anchor="middle" font-size="12" font-weight="700" fill="#5c7a70">' + uz + '</text></g>';
  }

  /* ---------- Sahna ---------- */
  function stageSvg(script) {
    var room =
      '<defs><linearGradient id="qvWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4faf7"/><stop offset="1" stop-color="#e3f1ea"/></linearGradient>' +
      '<linearGradient id="qvFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7e9df"/><stop offset="1" stop-color="#c4ddd0"/></linearGradient></defs>' +
      '<rect width="960" height="540" fill="url(#qvWall)"/>' +
      '<rect y="430" width="960" height="110" fill="url(#qvFloor)"/>' +
      /* ravoqli deraza (chapda) */
      '<g transform="translate(70 92)"><path d="M0 230V90a80 90 0 0 1 160 0v140z" fill="#cfeee2" stroke="#fff" stroke-width="10"/>' +
      '<path d="M80 0v230M0 120h160" stroke="#fff" stroke-width="6"/><circle cx="118" cy="60" r="16" fill="#fff3c4" opacity=".9"/></g>' +
      /* o'simlik */
      '<g transform="translate(64 430)"><path d="M-22 0h44l-6-46h-32z" fill="' + WOOD + '"/>' +
      '<path d="M0 -46q-30-50-6-96M0 -46q24-40 4-90M0 -46q-46-24-50-60M0 -46q40-20 50-56" stroke="' + G2 + '" stroke-width="7" fill="none" stroke-linecap="round"/></g>' +
      /* divan (o'ngda) */
      '<g transform="translate(760 330)"><rect x="0" y="40" width="190" height="62" rx="18" fill="#2a7a64"/>' +
      '<rect x="10" y="0" width="170" height="56" rx="18" fill="#3d9378"/><rect x="-6" y="30" width="30" height="74" rx="12" fill="#246b58"/>' +
      '<rect x="166" y="30" width="30" height="74" rx="12" fill="#246b58"/></g>' +
      /* gilam */
      '<ellipse cx="480" cy="470" rx="300" ry="34" fill="#bfe3d3" opacity=".7"/>' +
      /* devordagi kichik surat ramkasi */
      '<g class="qv-wallframe" transform="translate(420 70)"><rect width="120" height="84" rx="6" fill="' + WOOD + '"/>' +
      '<rect x="8" y="8" width="104" height="68" rx="3" fill="#eef7f2"/>' +
      '<g transform="translate(0 6) scale(.42)">' + member('wf1', 60, 'oldman', 1) + member('wf2', 115, 'man', 1) + member('wf3', 170, 'woman', 1) + member('wf4', 220, 'boy', .8) + '</g></g>';

    var photo = '';
    if (script && script.photo) {
      var ph = script.photo;
      photo = '<g class="qv-photo"><g class="qv-photo-in">' +
        '<rect x="0" y="0" width="520" height="310" rx="18" fill="' + WOOD + '"/>' +
        '<rect x="14" y="14" width="492" height="282" rx="10" fill="#f3fbf7"/>' +
        '<path d="M14 230h492v56a10 10 0 0 1-10 10h-472a10 10 0 0 1-10-10z" fill="' + GS + '"/>' +
        ph.members.map(function (m) { return member(m.key, m.x, m.kind, m.s); }).join('') +
        ph.members.map(function (m) { return tag(m.key, m.x, m.ar, m.uz); }).join('') +
        '<text x="260" y="44" text-anchor="middle" class="qv-ar-t" font-size="24" fill="' + G1 + '">' + (ph.title || '') + '</text>' +
        '</g></g>';
    }
    return '<svg class="qv-svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Qissa sahnasi">' +
      room + photo + heroine('A', G2, G1) + heroine('B', '#5aa58b', '#2b6f5d') + '</svg>';
  }

  /* ---------- Ssenariylar ----------
     Har gap uchun: kim gapiradi (A/B), harakatlar, suratda kim belgilanadi.
     at: gapning qaysi qismida (0..1) qo'shimcha harakat boshlanadi.          */
  var SCRIPTS = {
    'a1-01': {
      title: 'صُورَةُ الْأُسْرَةِ', titleUz: '1-dars · Oila surati',
      start: { A: { x: -160 }, B: { x: 690 } },
      photo: {
        title: 'أُسْرَتِي',
        members: [
          { key: 'jadd', x: 70, kind: 'oldman', ar: 'جَدِّي', uz: 'bobom' },
          { key: 'jadda', x: 145, kind: 'oldwoman', ar: 'جَدَّتِي', uz: 'buvim' },
          { key: 'ab', x: 225, kind: 'man', ar: 'أَبِي', uz: 'otam' },
          { key: 'umm', x: 305, kind: 'woman', ar: 'أُمِّي', uz: 'onam' },
          { key: 'akh', x: 385, kind: 'boy', s: 1, ar: 'أَخِي', uz: 'ukam' },
          { key: 'ukht', x: 455, kind: 'girl', s: 1, ar: 'أُخْتِي', uz: 'singlim' }
        ]
      },
      lines: [
        { pre: 1.8, A: { x: 290, gest: 'wave' }, B: { gest: 'wave', at: .45 } },
        { B: { gest: 'chest' }, then: { at: .45, B: { gest: 'point' }, photo: true, A: { x: 112 }, Bx: 850 } },
        { A: { gest: 'up' }, then: { at: .5, A: { gest: 'point' }, ask: 'ab' } },
        { B: { gest: 'point' }, hl: ['ab'], tags: ['ab'], then: { at: .55, hl: ['ab', 'jadd'], tags: ['jadd'] } },
        { A: { gest: 'point' }, ask: 'umm' },
        { B: { gest: 'point' }, hl: ['umm'], tags: ['umm'], then: { at: .55, hl: ['umm', 'jadda'], tags: ['jadda'] } },
        { A: { gest: 'point' }, ask: 'akh' },
        { B: { gest: 'point' }, hl: ['akh'], tags: ['akh'], then: { at: .55, hl: ['akh', 'ukht'], tags: ['ukht'] } }
      ],
      recap: {
        title: 'Yangi so’zlar',
        words: [['أَبِي', 'otam'], ['أُمِّي', 'onam'], ['جَدِّي', 'bobom'], ['جَدَّتِي', 'buvim'], ['أَخِي', 'ukam / akam'], ['أُخْتِي', 'singlim / opam']],
        rule: { title: 'Qoida', rows: [['هَذَا', 'bu — erkak uchun', 'هَذَا أَبِي'], ['هَذِهِ', 'bu — ayol uchun', 'هَذِهِ أُمِّي']] }
      }
    }
  };
  /* Boshqa darslar uchun umumiy ssenariy: ikki qahramon navbat bilan gapiradi */
  function genericScript(lesson) {
    var words = (lesson.words || []).slice(0, 6).map(function (w) { return [w.ar, w.uz]; });
    return {
      title: lesson.titleAr || '', titleUz: lesson.n + '-dars · ' + (lesson.dialog.title || lesson.title),
      start: { A: { x: -160 }, B: { x: 680 } },
      lines: lesson.dialog.lines.map(function (ln, i) {
        if (i === 0) return { pre: 1.8, A: { x: 280, gest: 'wave' }, B: { gest: 'wave', at: .45 } };
        var who = i % 2 ? 'B' : 'A', o = {};
        o[who] = { gest: ['point', 'chest', 'up', 'point'][i % 4] };
        return o;
      }),
      recap: { title: 'Yangi so’zlar', words: words }
    };
  }
  function scriptFor(lesson) { return SCRIPTS[lesson.id] || genericScript(lesson); }

  /* ---------- Ovoz ---------- */
  var voices = [];
  function loadVoices() {
    try { voices = (global.speechSynthesis ? speechSynthesis.getVoices() : []).filter(function (v) { return /^ar/i.test(v.lang); }); } catch (e) { voices = []; }
  }
  if (global.speechSynthesis) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { } }
  function ttsVoice(who) {
    if (!voices.length) return null;
    var fem = voices.filter(function (v) { return /female|zariyah|hoda|salma|laila|layla|amira|mariam|fatima|noura|google/i.test(v.name); });
    var list = fem.length ? fem : voices;
    return who === 'B' && list.length > 1 ? list[1] : list[0];
  }

  /* =================== Pleyer =================== */
  function mount(container, lesson, opts) {
    opts = opts || {};
    var sc = scriptFor(lesson);
    var lines = lesson.dialog.lines;
    var names = { A: lines[0] ? lines[0].whoUz : 'A', B: lines[1] ? lines[1].whoUz : 'B' };
    var st = { playing: false, idx: -1, repeat: !!opts.repeat, slow: false, uz: true, token: 0 };

    var stage = el('div', { class: 'qv-stage', 'data-photo': '0' });
    stage.innerHTML = stageSvg(sc);
    var title = el('div', { class: 'qv-title' }, [el('span', { class: 'qv-title-ar', lang: 'ar', dir: 'rtl' }, sc.title), el('b', {}, sc.titleUz)]);
    var subAr = el('div', { class: 'qv-sub-ar', lang: 'ar', dir: 'rtl' });
    var subUz = el('div', { class: 'qv-sub-uz' });
    var subWho = el('span', { class: 'qv-sub-who' });
    var sub = el('div', { class: 'qv-sub' }, [subWho, subAr, subUz]);
    var repeatBox = el('div', { class: 'qv-repeat' }, [el('b', {}, '🎤 Endi siz takrorlang'), el('span', {}, '')]);
    var recap = el('div', { class: 'qv-recap' });
    var big = el('button', { class: 'qv-bigplay', type: 'button', 'aria-label': 'Boshlash', onclick: function () { play(); } }, '▶');
    stage.appendChild(title); stage.appendChild(sub); stage.appendChild(repeatBox); stage.appendChild(recap); stage.appendChild(big);

    var bPlay = el('button', { class: 'qv-btn primary', type: 'button', onclick: function () { st.playing ? pause() : play(); } }, '▶ Boshlash');
    var bRe = el('button', { class: 'qv-btn', type: 'button', onclick: function () { restart(); } }, '↺ Qaytadan');
    var bRep = el('button', { class: 'qv-btn' + (st.repeat ? ' on' : ''), type: 'button', onclick: function () {
      st.repeat = !st.repeat; bRep.classList.toggle('on', st.repeat);
    } }, '🎤 Takrorlash rejimi');
    var bSlow = el('button', { class: 'qv-btn', type: 'button', onclick: function () { st.slow = !st.slow; bSlow.classList.toggle('on', st.slow); } }, '🐢 Sekin');
    var bUz = el('button', { class: 'qv-btn on', type: 'button', onclick: function () { st.uz = !st.uz; bUz.classList.toggle('on', st.uz); stage.classList.toggle('no-uz', !st.uz); } }, 'Tarjima');
    var dots = el('div', { class: 'qv-dots' }, lines.map(function (ln, i) {
      return el('button', { type: 'button', class: 'qv-dot', title: (i + 1) + '-gap', onclick: function () { jump(i); } });
    }));
    var controls = opts.render ? null : el('div', { class: 'qv-ctrl' }, [bPlay, bRe, bRep, bSlow, bUz, dots]);
    var root = el('div', { class: 'qv' + (opts.render ? ' render' : '') }, [stage, controls]);
    container.appendChild(root);

    var svg = stage.querySelector('svg');
    function ch(id) { return svg.querySelector('[data-char="' + id + '"]'); }
    function setPos(id, x, instant) {
      var g = ch(id).querySelector('.qv-pos');
      if (instant) g.style.transition = 'none';
      g.style.transform = 'translate(' + x + 'px, 438px) scale(.84)';
      if (instant) { void g.getBoundingClientRect(); g.style.transition = ''; }
    }
    function gest(id, g) {
      var c = ch(id);
      c.setAttribute('data-g', g || '');
    }
    function talk(id) {
      ['A', 'B'].forEach(function (k) { ch(k).classList.toggle('talk', k === id); });
    }
    function ask(key) {
      ['A', 'B'].forEach(function (k) { ch(k).classList.remove('asking'); });
      if (key) ch('A').classList.add('asking');
      svg.querySelectorAll('.qv-mem').forEach(function (m) { m.classList.toggle('q', m.getAttribute('data-mem') === key); });
      if (key) highlight([key], true);
    }
    function highlight(keys, soft) {
      var any = keys && keys.length;
      svg.querySelectorAll('.qv-photo .qv-mem').forEach(function (m) {
        var on = any && keys.indexOf(m.getAttribute('data-mem')) >= 0;
        m.classList.toggle('hl', !!on);
        m.classList.toggle('dim', !!any && !on && !soft);
      });
    }
    function tags(keys) {
      (keys || []).forEach(function (k) { var t = svg.querySelector('[data-tag="' + k + '"]'); if (t) t.classList.add('on'); });
    }
    function applyAct(a) {
      if (!a) return;
      ['A', 'B'].forEach(function (k) {
        if (!a[k]) return;
        if (a[k].x != null) setPos(k, a[k].x);
        if (a[k].gest && !a[k].at) gest(k, a[k].gest);
      });
      if (a.Bx != null) setPos('B', a.Bx);
      if (a.photo) stage.setAttribute('data-photo', '1');
      if (a.ask) ask(a.ask);
      if (a.hl) { ask(null); highlight(a.hl); }
      if (a.tags) tags(a.tags);
    }
    /** Gap ichida vaqtga bog'liq harakatlar (p: 0..1) */
    function applyTimed(a, p, fired) {
      ['A', 'B'].forEach(function (k) {
        if (a[k] && a[k].at && p >= a[k].at && !fired[k]) { fired[k] = 1; gest(k, a[k].gest); }
      });
      if (a.then && p >= a.then.at && !fired.then) { fired.then = 1; applyAct(a.then); ['A', 'B'].forEach(function (k) { if (a.then[k] && a.then[k].gest) gest(k, a.then[k].gest); }); }
    }

    /* Subtitr: so'zlar ajratiladi va gap davomida navbat bilan yonadi */
    var wordSpans = [], wordW = [];
    function setLine(i) {
      var ln = lines[i];
      var who = i % 2 ? 'B' : 'A';
      subWho.textContent = ln.whoUz;
      subWho.className = 'qv-sub-who ' + who;
      subAr.innerHTML = '';
      wordSpans = []; wordW = [];
      String(ln.ar).split(/\s+/).forEach(function (w) {
        var s = el('span', {}, w + ' ');
        wordSpans.push(s); wordW.push(Math.max(2, w.replace(/[ً-ْ]/g, '').length));
        subAr.appendChild(s);
      });
      subUz.textContent = ln.uz;
      sub.classList.add('on');
      Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
      return who;
    }
    function progressWords(p) {
      var total = wordW.reduce(function (s, x) { return s + x; }, 0), acc = 0, cur = -1;
      for (var k = 0; k < wordW.length; k++) { acc += wordW[k]; if (p * total < acc) { cur = k; break; } }
      if (p >= 1) cur = wordW.length;
      wordSpans.forEach(function (s, k) { s.className = k < cur ? 'said' : (k === cur ? 'now' : ''); });
    }

    function reset() {
      st.idx = -1;
      stage.setAttribute('data-photo', '0');
      stage.classList.remove('recap-on', 'started');
      recap.innerHTML = '';
      sub.classList.remove('on');
      ['A', 'B'].forEach(function (k) { gest(k, ''); ch(k).classList.remove('talk', 'asking', 'walk'); setPos(k, sc.start[k].x, true); });
      highlight([]);
      svg.querySelectorAll('.qv-tag').forEach(function (t) { t.classList.remove('on'); });
      svg.querySelectorAll('.qv-mem').forEach(function (m) { m.classList.remove('q'); });
      Array.prototype.forEach.call(dots.children, function (d) { d.classList.remove('on', 'done'); });
      repeatBox.classList.remove('on');
    }
    reset();

    /* ---- vaqt yordamchilari (to'xtatib bo'ladigan) ---- */
    function wait(ms, tok) {
      return new Promise(function (res, rej) { setTimeout(function () { tok === st.token ? res() : rej('stop'); }, ms); });
    }
    function animate(ms, tok, onP) {
      return new Promise(function (res, rej) {
        var t0 = performance.now();
        (function f(now) {
          if (tok !== st.token) { rej('stop'); return; }
          var p = Math.min(1, (now - t0) / ms);
          onP(p);
          if (p >= 1) res(); else requestAnimationFrame(f);
        })(t0);
      });
    }
    /** Bitta gapni aytish: audio fayl → brauzer ovozi → (ovoz yo'q) vaqt bo'yicha */
    function speak(i, tok, onP) {
      var ln = lines[i];
      var rate = st.slow ? 0.62 : 0.85;
      var url = opts.audioUrl ? opts.audioUrl(i) : null;
      var est = Math.max(1600, String(ln.ar).replace(/[ً-ْ\s]/g, '').length * 115 / rate);
      if (url) {
        return new Promise(function (res, rej) {
          var au = new Audio(url);
          au.playbackRate = st.slow ? 0.8 : 1;
          var raf;
          au.onended = function () { cancelAnimationFrame(raf); onP(1); res(); };
          au.onerror = function () { cancelAnimationFrame(raf); speakTts().then(res, rej); };
          au.play().then(function () {
            (function f() {
              if (tok !== st.token) { au.pause(); rej('stop'); return; }
              if (au.duration) onP(Math.min(1, au.currentTime / au.duration));
              raf = requestAnimationFrame(f);
            })();
          }).catch(function () { speakTts().then(res, rej); });
        });
      }
      return speakTts();
      function speakTts() {
        if (!A.Speak) return animate(est, tok, onP);
        var t0 = performance.now(), raf, done = false;
        (function f(now) {
          if (done) return;
          if (tok !== st.token) { done = true; A.Speak.stop(); return; }
          onP(Math.min(0.97, (now - t0) / est));
          raf = requestAnimationFrame(f);
        })(t0);
        return A.Speak.say(ln.ar, { rate: rate, who: i % 2 ? 'B' : 'A', onStart: function () { t0 = performance.now(); } }).then(function (ok) {
          done = true; cancelAnimationFrame(raf);
          if (tok !== st.token) throw 'stop';
          /* Ovoz chiqmagan bo'lsa — subtitr o'qish tezligida davom etadi */
          var left = est - (performance.now() - t0);
          if (!ok && left > 0) return animate(left, tok, function (p) { onP(Math.min(1, ((est - left) + p * left) / est)); });
          onP(1);
        });
      }
    }

    async function runLine(i, tok, durMs) {
      st.idx = i;
      var a = sc.lines[i] || {};
      var who = setLine(i);
      talk(null);
      if (a.pre) {
        ['A', 'B'].forEach(function (k) { if (a[k] && a[k].x != null) ch(k).classList.add('walk'); });
        applyAct({ A: a.A && { x: a.A.x }, B: a.B && { x: a.B.x } });
        await wait(a.pre * 1000, tok);
        ['A', 'B'].forEach(function (k) { ch(k).classList.remove('walk'); });
      }
      ['A', 'B'].forEach(function (k) { if (!(a[k] && a[k].gest && a[k].at)) gest(k, ''); });
      applyAct({ A: a.A && { gest: a.A.gest, at: a.A.at }, B: a.B && { gest: a.B.gest, at: a.B.at }, ask: a.ask, hl: a.hl, tags: a.tags, photo: a.photo });
      talk(who);
      var fired = {};
      var onP = function (p) { progressWords(p); applyTimed(a, p, fired); };
      if (durMs) await animate(durMs, tok, onP); else await speak(i, tok, onP);
      onP(1);
      talk(null);
      if (st.repeat && !opts.render) {
        repeatBox.classList.add('on');
        var secs = Math.max(3, Math.round(String(lines[i].ar).split(/\s+/).length * 1.1));
        for (var s = secs; s > 0; s--) { repeatBox.lastChild.textContent = s + ' soniya'; await wait(1000, tok); }
        repeatBox.classList.remove('on');
      }
      await wait(650, tok);
    }

    async function runRecap(tok, durs) {
      var r = sc.recap; if (!r) return;
      stage.classList.add('recap-on');
      sub.classList.remove('on'); talk(null);
      recap.innerHTML = '';
      recap.appendChild(el('h3', {}, r.title));
      var cells = r.words.map(function (w) {
        return el('div', { class: 'qv-rc' }, [el('b', { lang: 'ar', dir: 'rtl' }, w[0]), el('span', {}, w[1])]);
      });
      recap.appendChild(el('div', { class: 'qv-rgrid' }, cells));
      await wait(700, tok);
      for (var k = 0; k < r.words.length; k++) {
        cells[k].classList.add('on');
        if (durs) await wait((durs[k] || 1400) + 350, tok);
        else {
          await sayWord(r.words[k][0], tok);
          await wait(350, tok);
        }
        cells[k].classList.remove('on'); cells[k].classList.add('done');
      }
      if (r.rule) {
        await wait(500, tok);
        recap.innerHTML = '';
        recap.appendChild(el('h3', {}, r.rule.title));
        recap.appendChild(el('div', { class: 'qv-rule' }, r.rule.rows.map(function (row) {
          return el('div', { class: 'qv-rule-r' }, [el('b', { lang: 'ar', dir: 'rtl' }, row[0]), el('span', {}, row[1]), el('i', { lang: 'ar', dir: 'rtl' }, row[2])]);
        })));
        await wait(durs ? 5200 : 5000, tok);
      }
      recap.appendChild(el('div', { class: 'qv-end' }, 'Barakalla! Endi «Mashq» va «Uy vazifasi»ga o’ting.'));
    }
    function sayWord(text, tok) {
      var url = opts.wordUrl && opts.wordUrl(text);
      if (!A.Speak) return wait(1200, tok);
      var t0 = Date.now();
      return A.Speak.say(text, { rate: 0.75, url: url || undefined }).then(function (ok) {
        if (tok !== st.token) throw 'stop';
        if (!ok) return wait(Math.max(0, 1300 - (Date.now() - t0)), tok);
      });
    }

    async function run(from, tok, timing) {
      try {
        if (from <= 0) {
          stage.classList.add('started', 'intro');
          await wait(timing ? timing.intro : 2600, tok);
          stage.classList.remove('intro');
        } else stage.classList.add('started');
        for (var i = Math.max(0, from); i < lines.length; i++) {
          await runLine(i, tok, timing && timing.lines[i]);
        }
        await runRecap(tok, timing && timing.words);
        st.playing = false; setBtn();
        if (opts.onEnd) opts.onEnd();
      } catch (e) { /* to'xtatildi */ }
    }
    function setBtn() { if (bPlay) bPlay.textContent = st.playing ? '❚❚ To’xtatish' : (st.idx >= 0 ? '▶ Davom etish' : '▶ Boshlash'); big.hidden = st.playing || stage.classList.contains('started'); }
    function play() {
      st.token++; st.playing = true; setBtn();
      var from = st.idx < 0 ? 0 : st.idx;
      if (st.idx < 0) reset();
      run(from, st.token);
    }
    function pause() {
      st.token++; st.playing = false;
      if (A.Speak) A.Speak.stop();
      talk(null); setBtn();
    }
    function restart() { pause(); reset(); play(); }
    /** Ma'lum gapga sakrash: oldingi gaplarning holati darhol qo'llanadi */
    function jump(i) {
      pause(); reset();
      stage.classList.add('started');
      for (var k = 0; k < i; k++) {
        var a = sc.lines[k] || {};
        applyAct({ A: a.A && { x: a.A.x }, B: a.B && { x: a.B.x }, ask: a.ask, hl: a.hl, tags: a.tags, photo: a.photo });
        if (a.then) applyAct(a.then);
      }
      ['A', 'B'].forEach(function (k) { var g = ch(k).querySelector('.qv-pos'); g.style.transition = 'none'; void g.getBoundingClientRect(); g.style.transition = ''; });
      st.idx = i; st.token++; st.playing = true; setBtn();
      run(i, st.token);
    }
    setBtn();

    /* Render (MP4) rejimi: vaqtlar tashqaridan beriladi, ovoz alohida qo'shiladi */
    function renderRun(timing) {
      reset(); st.token++; st.playing = true; big.hidden = true;
      return run(0, st.token, timing);
    }
    return { play: play, pause: pause, restart: restart, jump: jump, renderRun: renderRun, destroy: function () { pause(); root.remove(); } };
  }

  /** MP4 uchun vaqt jadvali: ovoz fayllari davomiyligidan (soniya) */
  function timeline(lesson, lineSecs, wordSecs) {
    var sc = scriptFor(lesson);
    var out = [{ t: 0, kind: 'intro', dur: 2.6 }];
    var t = 2.6;
    lesson.dialog.lines.forEach(function (ln, i) {
      var a = sc.lines[i] || {};
      t += (a.pre || 0);
      out.push({ t: t, kind: 'line', i: i, dur: lineSecs[i] });
      t += lineSecs[i] + 0.65;
    });
    t += 0.7;
    (sc.recap ? sc.recap.words : []).forEach(function (w, k) {
      out.push({ t: t, kind: 'word', k: k, dur: wordSecs[k] });
      t += wordSecs[k] + 0.35;
    });
    out.push({ t: t, kind: 'end', dur: 6 });
    return { events: out, total: t + 6.2 };
  }

  A.QissaVideo = { mount: mount, scriptFor: scriptFor, timeline: timeline, SCRIPTS: SCRIPTS };
})(typeof window !== 'undefined' ? window : globalThis);
