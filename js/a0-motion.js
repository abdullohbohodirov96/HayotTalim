/* A0 video darsi — HARAKATLI sahnalar (motion).
   Diktor kirish so'zini o'qiyotganda har bir GAPGA mos sahna chiqadi:
   «28 ta harf» — alifbo to'ri, «o'ngdan chapga» — o'q va yozilayotgan so'z,
   «alif, ba, ta…» — harflar birma-bir, «fatha — qiya chiziq» — belgi harfga tushadi,
   «ba, ta, sa» — misollar navbat bilan, «tinglang, takrorlang» — quloq va to'lqinlar…
   Harf, shakl va so'z slaydlari ham harakatli: harf o'ngdan chapga «yoziladi»,
   maxraj rasmida qizil nuqta urib turadi, shakllar birin-ketin ulanadi.          */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'style') el.setAttribute('style', v); else el.setAttribute(k, v);
    });
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function (c) {
      if (c == null) return; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  /* Maxraj rasmlaridagi qizil joy (rasm bo'yicha %, rasmlardan hisoblangan) */
  var RED = [[25.3, 86.4], [81.8, 51], [72.4, 51.1], [72.6, 51], [55.5, 46.6], [24.4, 73.3], [24.7, 58.1], [72.4, 51.1], [72.6, 51], [70.3, 49.2], [72.3, 51], [72.6, 51], [55.4, 46.6], [72.6, 51], [64.2, 48.3], [72.3, 51], [72.6, 51], [24.4, 73.3], [24.7, 58.1], [79.9, 51.5], [33.3, 53.3], [43.7, 48.2], [67.8, 49], [81.8, 51.1], [70.3, 49.4], [25.3, 86.5], [81.8, 51], [55.4, 46.6]];
  function ping(img) {
    var m = /m(\d\d)\.webp/.exec(String(img || '')), p = m ? RED[Number(m[1])] : null;
    return h('i', { class: 'mo-ping', style: p ? 'left:' + p[0] + '%;top:' + p[1] + '%' : 'display:none' });
  }
  function arEl(text, cls) { return h('div', { class: cls || '', lang: 'ar', dir: 'rtl' }, text); }
  function low(s) { return String(s || '').toLowerCase().replace(/[‘’ʻʼ`']/g, "'"); }

  /** Kirish matnini gaplarga bo'lish */
  function sentences(text) {
    var m = String(text || '').match(/[^.!?]+[.!?]+[»"]?\s*/g);
    return (m || [String(text || '')]).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* Darslardagi lotincha misollar → arabcha (gapda tilga olinganda ko'rsatiladi) */
  var EX = {
    8: [['ba', 'بَ'], ['ta', 'تَ'], ['sa', 'ثَ']],
    9: [['da', 'دَ'], ['ra', 'رَ'], ['sa', 'سَ'], ['darasa', 'دَرَسَ']],
    10: [['bu', 'بُ'], ['tu', 'تُ'], ['su', 'ثُ']],
    11: [['bi', 'بِ'], ['ti', 'تِ'], ['si', 'ثِ']],
    12: [['«a»', 'بَ'], ['«u»', 'بُ'], ['«i»', 'بِ']],
    13: [['ba', 'بَ'], ['baa', 'بَا']],
    14: [['bi', 'بِ'], ['bii', 'بِي'], ['fil', 'فِلُ'], ['fiil', 'فِيلُ']],
    15: [['bu', 'بُ'], ['buu', 'بُو']],
    16: [['qal', 'قَلْ'], ['bat', 'بَتْ'], ['shad', 'شَدْ']],
    17: [['mak', 'مَكْ'], ['tuu', 'تُو'], ['bu', 'بُ'], ['maktuubu', 'مَكْتُوبُ']],
    18: [["al-lama", 'عَلْ + لَمَ'], ["'allama", 'عَلَّمَ']],
    19: [['tuf', 'تُفْ'], ['faa', 'فَا'], ['hu', 'حُ'], ['tuffaahu', 'تُفَّاحُ']],
    20: [['ban', 'بًا'], ['bun', 'بٌ'], ['bin', 'بٍ']],
    21: [['al-qolbu', 'الْقَلْبُ'], ['ash-shahdu', 'الشَّهْدُ']],
    22: [['madrosatun', 'مَدْرَسَةٌ'], ['madrosah', 'مَدْرَسَةْ'], ["mu'allim", 'مُعَلِّمٌ'], ["mu'allima", 'مُعَلِّمَةٌ']],
    23: [["ta'lim", 'ء'], ['ilaa', 'إِلَى'], ["'alaa", 'عَلَى']]
  };
  function findExamples(n, s) {
    var list = EX[n] || [], t = ' ' + low(s).replace(/[,.:;!?—–-]+/g, function (m) { return m === '-' ? '-' : ' '; }) + ' ';
    var hits = [];
    list.forEach(function (e) {
      var k = low(e[0]), i = t.indexOf(' ' + k + ' ');
      if (i < 0 && k.charAt(0) === '«') i = t.indexOf(k);
      if (i >= 0) hits.push({ i: i, lat: e[0].replace(/[«»]/g, ''), ar: e[1] });
    });
    return hits.sort(function (a, b) { return a.i - b.i; });
  }
  /** Gapda tilga olingan harflar (nomi bo'yicha) */
  function findLetters(F, s) {
    var t = ' ' + low(s).replace(/[,.:;!?—–«»]/g, ' ') + ' ', hits = [];
    F.LETTERS.forEach(function (x) {
      var names = [low(x.name)];
      if (x.name === 'Sa') names.push('sa'); if (x.name === 'Xo') names.push('xo');
      names.forEach(function (nm) { var i = t.indexOf(' ' + nm + ' '); if (i >= 0 && !hits.some(function (z) { return z.x === x; })) hits.push({ i: i, x: x }); });
    });
    return hits.sort(function (a, b) { return a.i - b.i; }).map(function (z) { return z.x; });
  }

  var MARKS = [
    [/fatha/, 'ـَ', 'Fatha · «a»', 'بَ'], [/damma/, 'ـُ', 'Damma · «u»', 'بُ'], [/kasra/, 'ـِ', 'Kasra · «i»', 'بِ'],
    [/sukun/, 'ـْ', 'Sukun', 'بْ'], [/shadda/, 'ـّ', 'Shadda', 'بّ'], [/tanvin/, 'ـٌ', 'Tanvin · «n»', 'بٌ'],
    [/toi marbuta/, 'ة', 'Toi marbuta', 'ة'], [/hamza/, 'ء', 'Hamza', 'ء'], [/alif maqsura/, 'ى', 'Alif maqsura', 'ى']
  ];

  /** Gap → sahna turi */
  function pickScene(F, l, s, k) {
    var t = low(s);
    if (k === 0 && /assalomu|xush kelibsiz|tabrik/.test(t)) return { kind: 'hello' };
    /* Bir gapda bir nechta belgi tilga olinsa — hammasi navbat bilan */
    var mk = MARKS.filter(function (m) { return m[0].test(t); });
    if (mk.length >= 3) return { kind: 'examples', items: mk.map(function (m) { return { ar: m[3], lat: m[2].split(' ·')[0] }; }) };
    var ex = findExamples(l.n, s);
    if (ex.length) return { kind: 'examples', items: ex };
    if (l.n === 23 && /ustida/.test(t)) return { kind: 'examples', items: [{ ar: 'أ', lat: 'alif' }, { ar: 'ؤ', lat: 'vov' }, { ar: 'ئ', lat: 'ya' }] };
    if (/dumaloq/.test(t)) return { kind: 'mark', mark: MARKS[6] };
    var lets = findLetters(F, s);
    /* Dars harflari bilan mos keladiganlarini olamiz («ha» — ح yoki ه) */
    if (l.letters && lets.length) {
      var own = lets.filter(function (x) { return l.letters.indexOf(x.ch) >= 0 || l.letters.indexOf(x.show) >= 0; });
      if (own.length >= Math.min(3, lets.length - 1)) lets = own;
    }
    if (/juft/.test(t) && l.letters) return { kind: 'pairs', items: l.letters };
    if (lets.length >= 3) return { kind: 'letters', items: lets };
    if (/yigirma sakkiz|alifbo/.test(t)) return { kind: 'alphabet', rtl: /o'ngdan chapga/.test(t) };
    if (/o'ngdan chapga/.test(t)) return { kind: 'rtl' };
    if (/qizil|chiqishi|maxraj/.test(t)) return { kind: 'mahraj', x: F.letter((l.letters && l.letters[0]) || 'ب') };
    if (/ikki marta/.test(t)) return { kind: 'examples', items: [{ ar: 'بْ', lat: '1) sukun' }, { ar: 'بَ', lat: '2) harakat' }, { ar: 'بَّ', lat: '= shadda' }] };
    if (/madd|cho'z/.test(t)) return { kind: 'examples', items: [{ ar: 'بَا', lat: 'baa' }, { ar: 'بِي', lat: 'bii' }, { ar: 'بُو', lat: 'buu' }] };
    for (var m = 0; m < MARKS.length; m++) if (MARKS[m][0].test(t)) return { kind: 'mark', mark: MARKS[m] };
    if (/yo'g'on/.test(t)) return { kind: 'heavy', items: lets.length ? lets : (l.letters || []).map(F.letter).filter(function (x) { return /[صضطظ]/.test(x.ch); }) };
    if (/nuqta/.test(t)) return { kind: 'dots', items: lets.length ? lets : (l.letters || []).slice(0, 4).map(F.letter) };
    if (/shakl|ulan/.test(t)) return { kind: 'forms', x: F.letter(lets[0] ? lets[0].ch : (l.letters && l.letters[1]) || 'ب') };
    if (/qamariy|shamsiy|«al»|guruh/.test(t)) return { kind: 'sunmoon' };
    if (/tinglang|takrorla|ovoz chiqarib|yoddan|ayting|o'qing/.test(t)) return { kind: 'listen' };
    if (/matn|kitob|so'zlarni|so'z /.test(t)) return { kind: 'book', l: l };
    if (lets.length) return { kind: 'letters', items: lets };
    return { kind: 'words' };
  }

  /* ---------- Sahnalarni chizish ---------- */
  function stagger(el, sel, totalMs, startMs) {
    var ns = el.querySelectorAll(sel), n = ns.length || 1;
    var step = Math.max(60, Math.min(900, (totalMs - (startMs || 0)) / (n + 0.5)));
    Array.prototype.forEach.call(ns, function (x, i) { x.style.animationDelay = Math.round((startMs || 0) + i * step) + 'ms'; });
    return step;
  }
  function render(stage, sc, F, l, s, durMs) {
    var box = h('div', { class: 'mo-scene mo-' + sc.kind });
    var d = durMs || 4000;
    switch (sc.kind) {
      case 'hello':
        box.appendChild(h('div', { class: 'mo-hello' }, [
          h('div', { class: 'mo-wave' }, '👋'),
          h('span', { class: 'mo-kicker' }, 'SABO ACADEMY · A0'),
          h('b', { class: 'mo-num' }, l.n + '-dars'),
          arEl(l.titleAr, 'mo-titlear'),
          h('em', {}, l.title)
        ]));
        break;
      case 'alphabet':
        box.appendChild(h('div', { class: 'mo-grid28', dir: 'rtl' }, F.LETTERS.map(function (x) { return h('span', { class: 'mo-pop', lang: 'ar' }, x.ch); })));
        box.appendChild(h('div', { class: 'mo-badge mo-pop', style: 'animation-delay:' + Math.round(d * 0.6) + 'ms' }, '28 ta harf'));
        if (sc.rtl) box.appendChild(h('div', { class: 'mo-arrow', style: 'animation-delay:' + Math.round(d * 0.7) + 'ms' }, [h('i'), h('span', {}, 'o‘ngdan → chapga')]));
        stagger(box, '.mo-grid28 span', d * 0.55);
        break;
      case 'rtl':
        box.appendChild(h('div', { class: 'mo-rtl' }, [
          arEl('مَرْحَبًا', 'mo-write'),
          h('div', { class: 'mo-arrow' }, [h('i'), h('span', {}, 'o‘ngdan → chapga')])
        ]));
        break;
      case 'letters':
        box.appendChild(h('div', { class: 'mo-row', dir: 'rtl' }, sc.items.map(function (x) {
          return h('div', { class: 'mo-lt mo-pop' }, [arEl(x.ch, 'mo-ltc'), h('small', {}, x.name)]);
        })));
        stagger(box, '.mo-lt', d * 0.9);
        break;
      case 'examples':
        box.appendChild(h('div', { class: 'mo-row', dir: 'rtl' }, sc.items.map(function (e) {
          return h('div', { class: 'mo-ex mo-pop' }, [arEl(e.ar, 'mo-exa'), h('small', {}, e.lat)]);
        })));
        stagger(box, '.mo-ex', d * 0.85);
        break;
      case 'mahraj':
        box.appendChild(h('div', { class: 'mo-mahraj' }, [
          h('div', { class: 'mo-imgw' }, [h('img', { src: sc.x.img, alt: '' }), ping(sc.x.img)]),
          h('div', { class: 'mo-side' }, [arEl(sc.x.show, 'mo-big'), h('b', {}, sc.x.name), h('span', { class: 'mo-red' }, '● qizil — tovush chiqadigan joy')])
        ]));
        break;
      case 'pairs':
        var pr = []; for (var i = 0; i + 1 < sc.items.length; i += 2) pr.push([sc.items[i], sc.items[i + 1]]);
        box.appendChild(h('div', { class: 'mo-row', dir: 'rtl' }, pr.map(function (p) {
          return h('div', { class: 'mo-pair mo-pop' }, [arEl(p[0], 'mo-ltc'), h('span', { class: 'mo-eq' }, '≈'), arEl(p[1], 'mo-ltc hl')]);
        })));
        stagger(box, '.mo-pair', d * 0.85);
        break;
      case 'mark':
        var mk = sc.mark, standalone = /[ةءى]/.test(mk[1]);
        box.appendChild(h('div', { class: 'mo-markw' }, standalone
          ? [arEl(mk[1], 'mo-big mo-writein'), h('b', { class: 'mo-cap2' }, mk[2])]
          : [h('div', { class: 'mo-markstage' }, [arEl('ب', 'mo-base'), arEl(mk[3], 'mo-drop ' + (/ِ|ٍ/.test(mk[3]) ? 'down' : 'up'))]), h('b', { class: 'mo-cap2' }, mk[2])]));
        break;
      case 'heavy':
        box.appendChild(h('div', { class: 'mo-row', dir: 'rtl' }, (sc.items.length ? sc.items : []).map(function (x) {
          return h('div', { class: 'mo-lt mo-heavy' }, [arEl(x.ch, 'mo-ltc'), h('small', {}, x.name)]);
        })));
        box.appendChild(h('div', { class: 'mo-badge' }, 'yo‘g‘on — og‘iz to‘lib'));
        break;
      case 'dots':
        box.appendChild(h('div', { class: 'mo-row', dir: 'rtl' }, sc.items.map(function (x) {
          return h('div', { class: 'mo-lt mo-pop' }, [arEl(x.ch, 'mo-ltc mo-dotpulse'), h('small', {}, x.name)]);
        })));
        stagger(box, '.mo-lt', d * 0.8);
        break;
      case 'forms':
        var f = F.forms(sc.x);
        box.appendChild(h('div', { class: 'mo-row mo-forms', dir: 'rtl' }, [['alohida', f.alone], ['boshida', f.start], ['o‘rtasida', f.middle], ['oxirida', f.end]]
          .filter(function (z) { return z[1]; }).map(function (z) { return h('div', { class: 'mo-ex mo-pop' }, [arEl(z[1], 'mo-exa'), h('small', {}, z[0])]); })));
        stagger(box, '.mo-ex', d * 0.85);
        break;
      case 'sunmoon':
        box.appendChild(h('div', { class: 'mo-sunmoon' }, [
          h('div', { class: 'mo-orb moon' }, [h('span', {}, '🌙'), h('b', {}, 'Qamariy'), arEl('الْقَمَرُ', 'mo-small')]),
          h('div', { class: 'mo-orb sun' }, [h('span', {}, '☀️'), h('b', {}, 'Shamsiy'), arEl('الشَّمْسُ', 'mo-small')])
        ]));
        break;
      case 'listen':
        box.appendChild(h('div', { class: 'mo-listen' }, [
          h('div', { class: 'mo-ico' }, ['🎧', h('i', { class: 'mo-w1' }), h('i', { class: 'mo-w2' })]),
          h('div', { class: 'mo-arrow2' }, '→'),
          h('div', { class: 'mo-ico' }, ['🗣️', h('i', { class: 'mo-w1' }), h('i', { class: 'mo-w2' })])
        ]));
        box.appendChild(h('div', { class: 'mo-badge' }, 'Tinglang · takrorlang'));
        break;
      case 'book':
        box.appendChild(h('div', { class: 'mo-book' }, [h('span', { class: 'mo-bico' }, '📖'), arEl(l.titleAr, 'mo-titlear')]));
        break;
      default: /* kinetik matn: gap so'zma-so'z chiqadi */
        box.appendChild(h('div', { class: 'mo-kin' }, String(s).split(/\s+/).map(function (w) { return h('span', { class: 'mo-pop' }, w); })));
        stagger(box, '.mo-kin span', d * 0.8);
    }
    stage.innerHTML = '';
    stage.appendChild(box);
  }

  /** Kirish sahnalari: { list:[{s, scene, w}], render(stage, k, durMs) } */
  function intro(F, l) {
    var ss = sentences(l.intro);
    var total = ss.reduce(function (a, s) { return a + s.length + 12; }, 0);
    return {
      list: ss.map(function (s, k) { return { s: s, scene: pickScene(F, l, s, k), w: (s.length + 12) / total }; }),
      render: function (stage, k, durMs) { var it = this.list[k]; render(stage, it.scene, F, l, it.s, durMs); }
    };
  }

  /* ---------- Harf / shakl / so'z slaydlari ---------- */
  function letter(stage, x) {
    stage.innerHTML = '';
    stage.appendChild(h('div', { class: 'mo-scene mo-letter' }, [
      h('div', { class: 'mo-imgw mo-slidein' }, [h('img', { src: x.img, alt: '' }), ping(x.img)]),
      h('div', { class: 'mo-side' }, [arEl(x.show, 'mo-big mo-writein'), h('b', { class: 'mo-type' }, x.name + ' · '), arEl(x.nameAr, 'mo-small mo-fade'), h('span', { class: 'mo-place mo-fade' }, x.place)])
    ]));
  }
  function forms(stage, x, f) {
    stage.innerHTML = '';
    var box = h('div', { class: 'mo-scene' }, [h('div', { class: 'mo-row mo-forms', dir: 'rtl' }, [['alohida', f.alone], ['boshida', f.start], ['o‘rtasida', f.middle], ['oxirida', f.end]]
      .filter(function (z) { return z[1]; }).map(function (z) { return h('div', { class: 'mo-ex mo-pop' }, [arEl(z[1], 'mo-exa'), h('small', {}, z[0])]); }))]);
    stage.appendChild(box);
    stagger(box, '.mo-ex', 2200);
  }
  function word(stage, text, tr, long) {
    stage.innerHTML = '';
    stage.appendChild(h('div', { class: 'mo-scene mo-word' }, [
      arEl(text, long ? 'mo-long mo-fade' : 'mo-big mo-writein'),
      tr ? h('div', { class: 'mo-tr mo-fade', style: 'animation-delay:.45s' }, tr) : null
    ]));
  }

  A.A0Motion = { sentences: sentences, intro: intro, letter: letter, forms: forms, word: word, pickScene: pickScene, findExamples: findExamples };
})(typeof window !== 'undefined' ? window : globalThis);
