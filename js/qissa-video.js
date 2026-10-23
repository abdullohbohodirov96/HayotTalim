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
  /* Erkak qahramon (masalan Ota) — ro'molsiz, qisqa soch */
  function hero(id, shirt) {
    return '<g class="qv-char" data-char="' + id + '"><g class="qv-pos"><g class="qv-body">' +
      '<ellipse cx="0" cy="4" rx="64" ry="12" fill="rgba(15,74,64,.12)"/>' +
      '<rect x="-26" y="-96" width="22" height="96" rx="9" fill="' + INK + '"/><rect x="4" y="-96" width="22" height="96" rx="9" fill="' + INK + '"/>' +
      '<path d="M-40 -190q40-14 80 0l4 100h-88z" fill="' + shirt + '"/>' +
      '<path d="M-10 -190l10 22l10-22z" fill="#fff" opacity=".85"/>' +
      arm(id + 'L', -44, shirt, 'l') + arm(id + 'R', 44, shirt, 'r') +
      '<rect x="-10" y="-208" width="20" height="22" fill="' + SK + '"/>' +
      '<ellipse cx="0" cy="-236" rx="26" ry="30" fill="' + SK + '"/>' +
      '<path d="M-27 -244q2-32 27-34q25 2 27 34q-7-16-27-17q-20 1-27 17z" fill="' + INK + '"/>' +
      '<g class="qv-waves" transform="translate(52 -250)"><path d="M0 -10q8 10 0 20" stroke="' + G2 + '" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M10 -18q14 18 0 36" stroke="' + G3 + '" stroke-width="4" fill="none" stroke-linecap="round"/></g>' +
      '<g class="qv-q" transform="translate(-6 -330)"><circle r="26" fill="#fff" stroke="' + G2 + '" stroke-width="3"/>' +
      '<text y="11" text-anchor="middle" font-size="32" font-weight="800" fill="' + G1 + '">?</text></g>' +
      '</g></g></g>';
  }
  /* Suratdagi oila a'zolari (kichik siluetlar) */
  function member(key, x, kind, s) {
    var body;
    if (String(kind).indexOf('emoji:') === 0) {
      body = '<rect x="-34" y="-82" width="68" height="78" rx="14" fill="#fff" stroke="' + GS + '" stroke-width="3"/>' +
        '<text x="0" y="-26" text-anchor="middle" font-size="44">' + String(kind).slice(6) + '</text>';
    } else if (kind === 'man' || kind === 'oldman' || kind === 'boy') {
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
        ph.members.map(function (m) { return m.badge ? '<text class="qv-badge" x="' + (m.x + 26) + '" y="150" text-anchor="middle" font-size="30">' + m.badge + '</text>' : ''; }).join('') +
        '<text x="260" y="44" text-anchor="middle" class="qv-ar-t" font-size="24" fill="' + G1 + '">' + (ph.title || '') + '</text>' +
        '</g></g>';
    }
    return '<svg class="qv-svg" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Qissa sahnasi">' +
      room + photo +
      (script && script.cast && script.cast.A === 'man' ? hero('A', '#3b6f8f') : heroine('A', G2, G1)) +
      (script && script.cast && script.cast.B === 'man' ? hero('B', '#3b6f8f') : heroine('B', '#5aa58b', '#2b6f5d')) + '</svg>';
  }

  /* ---------- Ssenariylar ----------
     Har gap uchun: kim gapiradi (A/B), harakatlar, suratda kim belgilanadi.
     at: gapning qaysi qismida (0..1) qo'shimcha harakat boshlanadi.          */
  var SCRIPTS = {};
  SCRIPTS['a1-02'] = {
    title: 'هُوَ مُهَنْدِسٌ', titleUz: '2-dars · Kim nima ish qiladi?',
    start: { A: { x: -160 }, B: { x: 690 } },
    photo: {
      title: 'أُسْرَتِي',
      members: [
        { key: 'ab', x: 95, kind: 'man', ar: 'طَبِيبٌ', uz: 'shifokor', badge: '🩺' },
        { key: 'umm', x: 205, kind: 'woman', ar: 'مُعَلِّمَةٌ', uz: 'o’qituvchi', badge: '📚' },
        { key: 'akh', x: 315, kind: 'man', ar: 'مُهَنْدِسٌ', uz: 'muhandis', badge: '⛑️' },
        { key: 'bint', x: 425, kind: 'girl', s: 1.1, ar: 'طَالِبَةٌ', uz: 'talaba', badge: '🎓' }
      ]
    },
    lines: [
      { pre: 1.8, photo: true, A: { x: 112, gest: 'point' }, B: { x: 850 }, ask: 'ab' },
      { B: { gest: 'point' }, hl: ['ab'], tags: ['ab'] },
      { A: { gest: 'point' }, ask: 'umm' },
      { B: { gest: 'chest' }, hl: ['umm'], tags: ['umm'], then: { at: .3, B: { gest: 'point' } } },
      { A: { gest: 'up' }, ask: 'akh' },
      { B: { gest: 'point' }, hl: ['akh'], tags: ['akh'] },
      { A: { gest: 'point' }, ask: 'bint' },
      { B: { gest: 'point' }, hl: ['bint'], tags: ['bint'] }
    ],
    recap: {
      title: 'Yangi so’zlar',
      words: [['طَبِيبٌ', 'shifokor'], ['طَبِيبَةٌ', 'shifokor (ayol)'], ['مُعَلِّمَةٌ', 'o’qituvchi (ayol)'], ['مُهَنْدِسٌ', 'muhandis'], ['طَالِبَةٌ', 'talaba (qiz)'], ['ابْنَةٌ', 'qiz (farzand)']],
      rule: { title: 'Qoida', rows: [['هُوَ', 'u — erkak', 'هُوَ طَبِيبٌ'], ['هِيَ', 'u — ayol', 'هِيَ طَبِيبَةٌ']] }
    }
  };
  SCRIPTS['a1-03'] = {
    title: 'أَيْنَ؟', titleUz: '3-dars · Ertalab uyda',
    cast: { A: 'man', B: 'woman' },
    start: { A: { x: -160 }, B: { x: 690 } },
    photo: {
      title: 'بَيْتُنَا',
      members: [
        { key: 'gurfa', x: 95, kind: 'emoji:🛏️', ar: 'الْغُرْفَةُ', uz: 'xona', badge: '👓' },
        { key: 'huna', x: 205, kind: 'emoji:🧥', ar: 'هُنَا', uz: 'shu yerda' },
        { key: 'matjar', x: 315, kind: 'emoji:🏪', ar: 'الْمَتْجَرُ', uz: 'do’kon', badge: '👦' },
        { key: 'shurfa', x: 425, kind: 'emoji:🌿', ar: 'الشُّرْفَةُ', uz: 'ayvon', badge: '👧' }
      ]
    },
    lines: [
      { pre: 1.8, photo: true, A: { x: 112, gest: 'up' }, B: { x: 850 }, ask: '?' },
      { B: { gest: 'point' }, hl: ['gurfa'], tags: ['gurfa'] },
      { A: { gest: 'up' }, ask: '?' },
      { B: { gest: 'chest' }, hl: ['huna'], tags: ['huna'] },
      { A: { gest: 'wave' }, ask: '?' },
      { B: { gest: 'point' }, hl: ['matjar'], tags: ['matjar'] },
      { A: { gest: 'up' }, ask: '?' },
      { B: { gest: 'point' }, hl: ['shurfa'], tags: ['shurfa'] }
    ],
    recap: {
      title: 'Yangi so’zlar',
      words: [['غُرْفَةٌ', 'xona'], ['مَتْجَرٌ', 'do’kon'], ['شُرْفَةٌ', 'ayvon'], ['مِعْطَفٌ', 'palto'], ['نَظَّارَةٌ', 'ko’zoynak'], ['هُنَا', 'shu yerda']],
      rule: { title: 'Qoida', rows: [['أَيْنَ؟', 'qayerda?', 'أَيْنَ يُوسُفُ؟'], ['فِي', 'ichida (-da)', 'فِي الْغُرْفَةِ'], ['هُنَا', 'shu yerda', 'الْمِعْطَفُ هُنَا']] }
    }
  };

  /* ---------- Tushunarli qilish: o'qilishi, so'zma-so'z tarjima, izoh va savollar ----------
     g: har bir arabcha so'z ostida o'zbekcha ma'nosi (so'zlar soni bilan bir xil),
     tr: lotincha o'qilishi, note: shu gapdagi qoida, checks: video ichidagi savollar. */
  var EXTRA = {
    'a1-02': {
      tr: ['Man haazaa, yaa Zaynab?', 'Haazaa abii, huwa tabiib.', 'Wa haazihi ummuki? Hal hiya tabiibatun aydan?', 'Laa, hiya mu‘allima.',
        'Wa man haazaa?', 'Haazaa axii ‘Aliy, huwa muhandis.', 'Wa haazihil-bint?', 'Haazihi ibnatu axii, hiya taaliba.'],
      g: [['kim', 'bu', 'ey', 'Zaynab?'], ['bu', 'otam', 'u (erkak)', 'shifokor'], ['va bu (ayol)', 'onangmi?', '…mi? (savol)', 'u (ayol)', 'shifokor (ayol)', 'ham?'], ['yo’q', 'u (ayol)', 'o’qituvchi (ayol)'],
        ['va kim', 'bu?'], ['bu', 'akam', 'Ali', 'u (erkak)', 'muhandis'], ['va bu (ayol)', 'qiz?'], ['bu (ayol)', 'qizi', 'akamning', 'u (ayol)', 'talaba (qiz)']],
      note: { 1: 'هُوَ — «u» (erkak kishi haqida)', 2: 'هَلْ …؟ — gapni «-mi?» savoliga aylantiradi', 3: 'هِيَ — «u» (ayol). Ayol kasbi: طَبِيبٌ + ة → طَبِيبَةٌ', 7: 'ابْنَةُ أَخِي — «akamning qizi»' },
      checks: [
        { after: 1, type: 'choice', q: 'Zaynabning otasi kim bo’lib ishlaydi?', opts: ['Shifokor', 'Muhandis', 'O’qituvchi'], a: 0, why: 'هُوَ طَبِيبٌ — u shifokor.' },
        { after: 3, type: 'tf', q: 'Zaynabning onasi ham shifokor.', a: false, why: 'لَا، هِيَ مُعَلِّمَةٌ — yo’q, u o’qituvchi.' },
        { after: 5, type: 'choice', qa: 'مُهَنْدِسٌ', q: 'Bu so’z nima degani?', opts: ['muhandis', 'talaba', 'o’qituvchi'], a: 0 },
        { after: 7, type: 'listen', line: 3, q: 'Eshiting: Zaynab nima dedi?', opts: ['Yo’q, u o’qituvchi', 'Yo’q, u shifokor', 'Ha, u talaba'], a: 0 },
        { after: 7, type: 'tf', qa: 'هِيَ طَالِبَةٌ', q: '«U qiz talaba» degani', a: true }
      ]
    },
    'a1-03': {
      tr: ['Ayna nazzaaratii?', 'An-nazzaaratu fil-gurfa.', 'Wa aynal-mi‘taf?', 'Al-mi‘tafu hunaa.', 'Shukran. Wa ayna Yuusuf?', 'Yuusufu fil-matjar.', 'Wa ayna Faatima?', 'Faatimatu fish-shurfa.'],
      g: [['qayerda', 'ko’zoynagim?'], ['ko’zoynak', '-da (ichida)', 'xona'], ['va qayerda', 'palto?'], ['palto', 'shu yerda'],
        ['rahmat', 'va qayerda', 'Yusuf?'], ['Yusuf', '-da', 'do’kon'], ['va qayerda', 'Fotima?'], ['Fotima', '-da', 'ayvon']],
      note: { 0: 'أَيْنَ؟ — «qayerda?»', 1: 'فِي — «ichida», o’zbekchadagi «-da»', 3: 'هُنَا — «shu yerda»', 4: 'شُكْرًا — «rahmat»' },
      checks: [
        { after: 1, type: 'choice', q: 'Ko’zoynak qayerda?', opts: ['Xonada', 'Do’konda', 'Ayvonda'], a: 0, why: 'فِي الْغُرْفَةِ — xonada.' },
        { after: 3, type: 'tf', qa: 'هُنَا', q: '«shu yerda» degani', a: true },
        { after: 5, type: 'listen', line: 5, q: 'Eshiting: Yusuf qayerda?', opts: ['Do’konda', 'Ayvonda', 'Xonada'], a: 0 },
        { after: 7, type: 'tf', q: 'Fotima xonada.', a: false, why: 'فَاطِمَةُ فِي الشُّرْفَةِ — Fotima ayvonda.' }
      ]
    }
  };
  /* Tayyor studiya ovozlari (ElevenLabs, saytning o'zida): assets/qissa/<dars>/<gap>.mp3 */
  var STATIC_AUDIO = { 'a1-02': 8, 'a1-03': 8 };
  var EMO = { family: '👨‍👩‍👧', father: '👨', mother: '👩', brother: '👦', sister: '👧', grandpa: '👴', grandma: '👵', photo: '🖼️',
    doctor: '👨‍⚕️', doctorF: '👩‍⚕️', engineer: '👷', teacher: '👨‍🏫', teacherF: '👩‍🏫', student: '🧑‍🎓', studentF: '👩‍🎓', son: '👦', daughter: '👧',
    room: '🛏️', bathroom: '🛁', shop: '🏪', balcony: '🌿', coat: '🧥', glasses: '👓', tree: '🌳', here: '📍' };

  /* Boshqa darslar uchun umumiy ssenariy: ikki qahramon navbat bilan gapiradi */
  function genericScript(lesson) {
    var words = (lesson.words || []).slice(0, 6).map(function (w) { return [w.ar, w.uz]; });
    return {
      cast: lesson.cast,
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

  /* ---------- Web Audio: oldindan yuklash va boshidagi/oxiridagi jimlikni kesish ----------
     Gaplar orasida «to'xtab qolish» bo'lmasin: har bir gap faylidan jim joylar
     olib tashlanadi va keyingi gap darhol (tabiiy suhbat oralig'i bilan) boshlanadi. */
  var AC = null;
  function ac() {
    if (!AC) { var C = global.AudioContext || global.webkitAudioContext; if (C) { try { AC = new C(); } catch (e) { AC = null; } } }
    return AC;
  }
  var bufCache = {};
  function trimBuf(b) {
    if (!b) return null;
    var d = b.getChannelData(0), n = d.length, th = 0.015, a = 0, z = n - 1;
    while (a < n && Math.abs(d[a]) < th) a++;
    while (z > a && Math.abs(d[z]) < th) z--;
    var pad = Math.floor(b.sampleRate * 0.025);
    a = Math.max(0, a - pad); z = Math.min(n - 1, z + pad);
    if (z <= a) return { buf: b, off: 0, dur: b.duration };
    return { buf: b, off: a / b.sampleRate, dur: (z - a) / b.sampleRate };
  }
  function loadBuf(url) {
    if (!url || !ac() || !global.fetch) return Promise.resolve(null);
    if (!bufCache[url]) {
      bufCache[url] = fetch(url).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (ab) {
        if (!ab) return null;
        return new Promise(function (res) { ac().decodeAudioData(ab, res, function () { res(null); }); });
      }).then(trimBuf).catch(function () { return null; });
    }
    return bufCache[url];
  }

  /* =================== Pleyer =================== */
  function mount(container, lesson, opts) {
    opts = opts || {};
    var sc = scriptFor(lesson);
    var lines = lesson.dialog.lines;
    var names = { A: lines[0] ? lines[0].whoUz : 'A', B: lines[1] ? lines[1].whoUz : 'B' };
    var st = { playing: false, idx: -1, repeat: !!opts.repeat, slow: false, uz: true, token: 0, quiz: !opts.render, score: { ok: 0, n: 0 }, asked: {} };
    var ex = EXTRA[lesson.id] || {};
    var checks = (ex.checks || []).concat(opts.extraChecks || []).map(function (c, k) {
      var o = Object.assign({}, c); o._k = k;
      if (o.after == null || o.after === '' || Number(o.after) >= lines.length) o.after = lines.length - 1;
      o.after = Number(o.after); return o;
    });
    function audioFor(i) {
      if (STATIC_AUDIO[lesson.id] > i) return (opts.assetBase || '') + 'assets/qissa/' + lesson.id + '/' + i + '.mp3';
      return opts.audioUrl ? opts.audioUrl(i) : null;
    }
    /* Hamma gaplarni oldindan yuklab qo'yamiz — gaplar orasida kutish bo'lmaydi */
    lines.forEach(function (ln, i) { var u = audioFor(i); if (u) loadBuf(u); });

    var stage = el('div', { class: 'qv-stage', 'data-photo': '0' });
    stage.innerHTML = stageSvg(sc);
    var title = el('div', { class: 'qv-title' }, [el('span', { class: 'qv-title-ar', lang: 'ar', dir: 'rtl' }, sc.title), el('b', {}, sc.titleUz)]);
    var subAr = el('div', { class: 'qv-sub-ar', lang: 'ar', dir: 'rtl' });
    var subUz = el('div', { class: 'qv-sub-uz' });
    var subTr = el('div', { class: 'qv-sub-tr' });
    var subWho = el('span', { class: 'qv-sub-who' });
    var sub = el('div', { class: 'qv-sub' }, [subWho, subAr, subTr, subUz]);
    var noteBox = el('div', { class: 'qv-note' });
    var quiz = el('div', { class: 'qv-quiz' });
    var intro = el('div', { class: 'qv-intro' });
    var repeatBox = el('div', { class: 'qv-repeat' }, [el('b', {}, '🎤 Endi siz takrorlang'), el('span', {}, '')]);
    var recap = el('div', { class: 'qv-recap' });
    var big = el('button', { class: 'qv-bigplay', type: 'button', 'aria-label': 'Boshlash', onclick: function () { play(); } }, '▶');
    stage.appendChild(title); stage.appendChild(sub); stage.appendChild(noteBox); stage.appendChild(repeatBox); stage.appendChild(recap);
    if (!opts.render) { stage.appendChild(intro); stage.appendChild(quiz); }
    stage.appendChild(big);
    /* Kirish: bu darsda nima o'rganiladi + kalit so'zlar (bosilsa eshitiladi) */
    (function () {
      var kw = (lesson.words || []).slice(0, 6);
      intro.appendChild(el('div', { class: 'qv-intro-h' }, [el('span', {}, 'Bu darsda'), el('b', {}, lesson.title || '')]));
      if (lesson.dialog.scene) intro.appendChild(el('p', { class: 'qv-intro-p' }, '🎬 ' + lesson.dialog.scene));
      intro.appendChild(el('div', { class: 'qv-intro-w' }, kw.map(function (w) {
        return el('button', { type: 'button', class: 'qv-kw', onclick: function (e) { e.stopPropagation(); tapWord(w.ar); } }, [
          el('i', {}, EMO[w.anim] || '•'), el('b', { lang: 'ar', dir: 'rtl' }, w.ar), el('span', {}, w.uz)]);
      })));
      intro.appendChild(el('p', { class: 'qv-intro-tip' }, '💡 Videoda har bir arabcha so’z ostida ma’nosi chiqadi — so’zni bossangiz, eshitasiz. Orada savollar bo’ladi.'));
    })();

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
    var bQuiz = el('button', { class: 'qv-btn on', type: 'button', onclick: function () { st.quiz = !st.quiz; bQuiz.classList.toggle('on', st.quiz); } }, '❓ Savollar');
    var bLine = el('button', { class: 'qv-btn', type: 'button', title: 'Shu gapni qayta eshitish', onclick: function () { if (st.idx >= 0) jump(st.idx); } }, '↻ Shu gap');
    var controls = opts.render ? null : el('div', { class: 'qv-ctrl' }, [bPlay, bRe, bLine, bSlow, bUz, bQuiz, bRep, dots]);
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
      if (key && key !== '?') highlight([key], true);
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
      var gl = (ex.g && ex.g[i]) || null;
      String(ln.ar).split(/\s+/).forEach(function (w, k) {
        var clean = w.replace(/[.,!?؟،:;«»"]/g, '');
        var s = el('span', { class: 'qv-w' + (gl ? ' gl' : ''), onclick: function (e) { e.stopPropagation(); tapWord(clean); s.classList.add('tap'); setTimeout(function () { s.classList.remove('tap'); }, 900); } },
          [el('b', {}, w), gl && gl[k] ? el('small', { dir: 'ltr' }, gl[k]) : null]);
        wordSpans.push(s); wordW.push(Math.max(2, w.replace(/[ً-ْ]/g, '').length));
        subAr.appendChild(s);
      });
      subTr.textContent = (ex.tr && ex.tr[i]) || '';
      subUz.textContent = ln.uz;
      var nt = ex.note && ex.note[i];
      noteBox.textContent = nt ? '💡 ' + nt : '';
      noteBox.classList.toggle('on', !!nt);
      sub.classList.add('on');
      Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
      return who;
    }
    function progressWords(p) {
      var total = wordW.reduce(function (s, x) { return s + x; }, 0), acc = 0, cur = -1;
      for (var k = 0; k < wordW.length; k++) { acc += wordW[k]; if (p * total < acc) { cur = k; break; } }
      if (p >= 1) cur = wordW.length;
      wordSpans.forEach(function (s, k) { s.classList.toggle('said', k < cur); s.classList.toggle('now', k === cur); });
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
      noteBox.classList.remove('on');
      stage.classList.remove('quiz-on');
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
      var url = audioFor(i);
      var est = Math.max(1600, String(ln.ar).replace(/[ً-ْ\s]/g, '').length * 115 / rate);
      if (url && ac()) {
        return loadBuf(url).then(function (t) {
          if (tok !== st.token) throw 'stop';
          if (!t) return speakTts();
          return playTrim(t, st.slow ? 0.82 : 1, tok, onP);
        });
      }
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

    function playTrim(t, rate, tok, onP) {
      return new Promise(function (res, rej) {
        var c = ac();
        try { if (c.state === 'suspended') c.resume(); } catch (e) { }
        var src = c.createBufferSource();
        src.buffer = t.buf; src.playbackRate.value = rate; src.connect(c.destination);
        var t0 = c.currentTime + 0.02, total = t.dur / rate;
        src.start(t0, t.off, t.dur);
        (function f() {
          if (tok !== st.token) { try { src.stop(); } catch (e) { } rej('stop'); return; }
          var p = Math.max(0, Math.min(1, (c.currentTime - t0) / total));
          onP(p);
          if (p >= 1) { res(); return; }
          requestAnimationFrame(f);
        })();
      });
    }

    /* ---------- Savol (video ichida): to'g'ri/xato, tanlash, eshitib tanlash ---------- */
    function shuffle(a) { a = a.slice(); for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var x = a[k]; a[k] = a[j]; a[j] = x; } return a; }
    function askCheck(c, tok) {
      return new Promise(function (res, rej) {
        quiz.innerHTML = '';
        stage.classList.add('quiz-on'); talk(null); sub.classList.remove('on'); noteBox.classList.remove('on');
        var kind = c.type === 'tf' ? 'To’g’ri yoki xato?' : c.type === 'listen' ? '🎧 Eshiting va tanlang' : 'To’g’ri javobni tanlang';
        var tries = 0, done = false;
        var fb = el('div', { class: 'qv-fb' });
        var opts2 = c.type === 'tf' ? [{ t: '✓ To’g’ri', ok: c.a === true }, { t: '✗ Xato', ok: c.a === false }]
          : shuffle((c.opts || []).map(function (t, k) { return { t: t, ok: k === Number(c.a) }; }));
        var btns = opts2.map(function (o) {
          var b = el('button', { type: 'button', class: 'qv-opt', onclick: function (e) {
            e.stopPropagation();
            if (done) return;
            if (o.ok) {
              b.classList.add('ok'); done = true;
              if (!tries) st.score.ok++;
              fb.className = 'qv-fb ok'; fb.textContent = '✓ Barakalla!' + (c.why ? ' ' + c.why : '');
              setTimeout(finish, c.why ? 1900 : 1000);
            } else {
              tries++; b.classList.add('bad'); b.disabled = true;
              fb.className = 'qv-fb bad';
              if (tries >= 2 || c.type === 'tf') {
                done = true;
                btns.forEach(function (x, k) { if (opts2[k].ok) x.classList.add('ok'); });
                fb.textContent = '✗ To’g’ri javob belgilandi.' + (c.why ? ' ' + c.why : '');
                quiz.appendChild(el('button', { type: 'button', class: 'qv-next', onclick: function (e) { e.stopPropagation(); finish(); } }, 'Davom etish →'));
              } else fb.textContent = 'Yana bir bor urinib ko’ring.';
            }
          } }, o.t);
          return b;
        });
        st.score.n++;
        quiz.appendChild(el('div', { class: 'qv-qk' }, '❓ ' + kind));
        if (c.qa) quiz.appendChild(el('div', { class: 'qv-qa', lang: 'ar', dir: 'rtl' }, c.qa));
        if (c.type === 'listen') {
          var play = function () { var u = audioFor(Number(c.line)); if (u && ac()) loadBuf(u).then(function (t) { if (t) playTrim(t, 1, st.token, function () { }).catch(function () { }); }); else if (A.Speak) A.Speak.say(lines[Number(c.line)].ar, { rate: .85 }); };
          quiz.appendChild(el('button', { type: 'button', class: 'qv-listen', onclick: function (e) { e.stopPropagation(); play(); } }, '🔊 Eshitish'));
          setTimeout(play, 350);
        }
        quiz.appendChild(el('div', { class: 'qv-qq' }, c.q || ''));
        quiz.appendChild(el('div', { class: 'qv-opts' + (c.type === 'tf' ? ' tf' : '') }, btns));
        quiz.appendChild(fb);
        quiz.appendChild(el('button', { type: 'button', class: 'qv-skip', onclick: function (e) { e.stopPropagation(); finish(); } }, 'O’tkazib yuborish'));
        var iv = setInterval(function () { if (tok !== st.token) { clearInterval(iv); stage.classList.remove('quiz-on'); rej('stop'); } }, 200);
        function finish() { clearInterval(iv); stage.classList.remove('quiz-on'); if (tok === st.token) res(); else rej('stop'); }
      });
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
      /* Tabiiy suhbat: boshqa odam javob bersa — qisqa oraliq, o'sha odam davom etsa — yanada qisqa */
      var nextWho = (i + 1) % 2 ? 'B' : 'A';
      await wait(durMs ? 650 : (nextWho === who ? 160 : 300), tok);
      if (st.quiz && !opts.render) {
        for (var q = 0; q < checks.length; q++) {
          var c = checks[q];
          if (c.after === i && !st.asked[c._k]) { st.asked[c._k] = 1; await askCheck(c, tok); await wait(250, tok); }
        }
      }
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
      if (st.score.n) recap.appendChild(el('div', { class: 'qv-score' }, '❓ Savollar: ' + st.score.ok + ' / ' + st.score.n + ' birinchi urinishda to’g’ri'));
      recap.appendChild(el('div', { class: 'qv-end' }, 'Barakalla! Endi «Mashq» va «Uy vazifasi»ga o’ting.'));
    }
    function tapWord(text) {
      if (!A.Speak || !text) return;
      try { var p = A.Speak.say(text, { rate: 0.8 }); if (p && p.catch) p.catch(function () { }); } catch (e) { }
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
      if (st.idx < 0) { reset(); st.score = { ok: 0, n: 0 }; st.asked = {}; }
      try { var c0 = ac(); if (c0 && c0.state === 'suspended') c0.resume(); } catch (e) { }
      run(from, st.token);
    }
    function pause() {
      st.token++; st.playing = false;
      if (A.Speak) A.Speak.stop();
      talk(null); setBtn();
    }
    function restart() { pause(); reset(); st.idx = -1; play(); }
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
    return { play: play, pause: pause, restart: restart, jump: jump, next: function () { jump((st.idx || 0) + 1); }, prev: function () { jump(Math.max(0, (st.idx || 0) - 1)); }, isPlaying: function () { return !!st.playing; }, renderRun: renderRun, destroy: function () { pause(); root.remove(); } };
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

  A.QissaVideo = { mount: mount, scriptFor: scriptFor, timeline: timeline, SCRIPTS: SCRIPTS, EXTRA: EXTRA, STATIC_AUDIO: STATIC_AUDIO };
})(typeof window !== 'undefined' ? window : globalThis);
