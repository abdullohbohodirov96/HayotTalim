/* Onlayn kurs: so'zlar uchun harakatli chizmalar (SVG + CSS animatsiya).
   Har bir so'z kaliti (anim) uchun kichik sahna: odamcha o'tiradi, eshik
   ochiladi, bug' ko'tariladi va h.k. Odamlarning yuzi chizilmaydi —
   faqat siluet (ayollar ro'molda). Ranglar kurs mavzusidan (yashil).
   Animatsiya CSS da (.ca-*), "harakatni kamaytirish" yoqilsa to'xtaydi.   */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};

  var SK = '#f1d3b5';      // teri
  var G1 = '#0f4a40', G2 = '#1f9d74', G3 = '#8fd9bd', GS = '#e2f4ec', INK = '#173a33';
  var WOOD = '#b98b5e', WHITE = '#ffffff', GREY = '#c9d6d0';

  /* ---------- Odamlar (lokal koordinata: oyoq tagi 0, bo'yi ~78) ---------- */
  function arms(color, cls) {
    return '<g class="ca-arm-l ' + (cls || '') + '"><rect x="-15" y="-50" width="6" height="24" rx="3" fill="' + color + '"/></g>' +
      '<g class="ca-arm-r ' + (cls || '') + '"><rect x="9" y="-50" width="6" height="24" rx="3" fill="' + color + '"/></g>';
  }
  function legsStand(color) {
    return '<g class="ca-legs"><rect x="-8" y="-24" width="7" height="24" rx="3" fill="' + color + '"/>' +
      '<rect x="1" y="-24" width="7" height="24" rx="3" fill="' + color + '"/></g>';
  }
  /** Erkak: opt = {shirt, beard, cap, coat, hat} */
  function man(o) {
    o = o || {};
    var shirt = o.shirt || G2, legs = INK;
    var s = legsStand(legs) +
      '<rect x="-11" y="-54" width="22" height="32" rx="7" fill="' + shirt + '"/>' + arms(shirt) +
      '<circle cx="0" cy="-64" r="9" fill="' + SK + '"/>' +
      '<path d="M-9 -66a9 9 0 0 1 18 0z" fill="' + (o.hair || INK) + '"/>';
    if (o.beard) s += '<path d="M-7 -61q7 14 14 0q-3 6-7 6t-7-6z" fill="' + (o.beard === true ? '#e9eeec' : o.beard) + '"/>';
    if (o.hat) s += '<path d="M-11 -68q11-14 22 0z" fill="#f2c94c"/><rect x="-13" y="-69" width="26" height="3" rx="1.5" fill="#d9a92f"/>';
    if (o.cap) s += '<path d="M-9 -68a9 6 0 0 1 18 0z" fill="#ffffff"/>';
    return s;
  }
  /** Ayol: ro'mol va uzun ko'ylak */
  function woman(o) {
    o = o || {};
    var dress = o.dress || G2, scarf = o.scarf || G1;
    return '<path d="M-12 -52q12-6 24 0l6 52h-36z" fill="' + dress + '"/>' + arms(dress) +
      '<path d="M-12 -60a12 13 0 1 1 24 0q0 10-12 12q-12-2-12-12z" fill="' + scarf + '"/>' +
      '<ellipse cx="0" cy="-63" rx="6.5" ry="7.5" fill="' + SK + '"/>';
  }
  function cane() { return '<path d="M16 -30v30" stroke="' + WOOD + '" stroke-width="3" stroke-linecap="round"/><path d="M16 -30q0-6 6-6" stroke="' + WOOD + '" stroke-width="3" fill="none" stroke-linecap="round"/>'; }
  function at(x, s, inner, cls) {
    return '<g transform="translate(' + x + ' 108) scale(' + (s || 1) + ')"><g class="' + (cls || '') + '">' + inner + '</g></g>';
  }
  function glow(x, w) {
    return '<ellipse class="ca-glow" cx="' + x + '" cy="109" rx="' + (w || 22) + '" ry="5" fill="' + G3 + '"/>';
  }
  function ground() { return '<rect x="0" y="108" width="160" height="12" fill="' + GS + '"/>'; }
  function svg(inner, label) {
    return '<svg class="ca-svg" viewBox="0 0 160 120" role="img" aria-label="' + (label || '') + '">' + inner + '</svg>';
  }

  var P = {
    father: function () { return man({}); },
    mother: function () { return woman({}); },
    boy: function () { return man({ shirt: G3 }); },
    girl: function () { return woman({ dress: G3, scarf: G2 }); },
    grandpa: function () { return man({ shirt: '#5f8f84', beard: true, hair: '#dfe6e3', cap: true }) + cane(); },
    grandma: function () { return woman({ dress: '#5f8f84', scarf: '#9db7af' }) + cane(); }
  };
  /* Juftlik: asosiy odam (yorug'lik bilan) + kontekst odam */
  function pair(main, mainS, other, otherS) {
    return ground() + glow(62, 24) + at(62, mainS, main, 'ca-bob') + at(108, otherS, other, '');
  }

  /* ---------- Narsalar ---------- */
  function chair(x) {
    return '<g transform="translate(' + x + ' 0)"><rect x="-14" y="60" width="4" height="48" fill="' + WOOD + '"/>' +
      '<rect x="-14" y="80" width="30" height="5" rx="2" fill="' + WOOD + '"/><rect x="12" y="85" width="4" height="23" fill="' + WOOD + '"/>' +
      '<rect x="-14" y="85" width="4" height="23" fill="' + WOOD + '"/></g>';
  }
  function door(x, cls) {
    return '<rect x="' + (x - 18) + '" y="46" width="36" height="62" fill="' + INK + '"/>' +
      '<g class="' + (cls || '') + '" style="transform-origin:' + (x - 18) + 'px 77px"><rect x="' + (x - 18) + '" y="46" width="36" height="62" fill="' + WOOD + '"/>' +
      '<circle cx="' + (x + 11) + '" cy="80" r="2.5" fill="' + G1 + '"/></g>' +
      '<rect x="' + (x - 21) + '" y="43" width="42" height="4" fill="' + G1 + '"/>';
  }
  function house(x, s) {
    return '<g transform="translate(' + x + ' 108) scale(' + (s || 1) + ')">' +
      '<path d="M-34 -40L0 -68L34 -40z" fill="' + G1 + '"/><rect x="-28" y="-42" width="56" height="42" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<rect x="-6" y="-24" width="12" height="24" fill="' + WOOD + '"/>' +
      '<rect class="ca-light" x="-22" y="-34" width="11" height="10" fill="' + G3 + '"/><rect class="ca-light d2" x="11" y="-34" width="11" height="10" fill="' + G3 + '"/></g>';
  }
  function box(cls) { return '<g class="' + cls + '"><rect x="-7" y="-7" width="14" height="12" rx="2" fill="' + G2 + '"/><path d="M-7 -2h14" stroke="' + WHITE + '" stroke-width="1.5"/></g>'; }

  var L = {};   // kalit → sahna

  /* ===== Oila ===== */
  L.family = function () {
    return ground() + at(34, 1, P.father(), 'ca-pop') + at(64, 1, P.mother(), 'ca-pop d2') +
      at(94, 0.7, P.boy(), 'ca-pop d3') + at(122, 0.7, P.girl(), 'ca-pop d4');
  };
  L.father = function () { return pair(P.father(), 1, P.boy(), 0.68); };
  L.mother = function () { return pair(P.mother(), 1, P.girl(), 0.68); };
  L.brother = function () { return ground() + glow(62, 20) + at(62, 0.85, P.boy(), 'ca-bob') + at(104, 0.85, P.girl(), '') + '<path class="ca-point" d="M62 14v10m-5-5l5 5l5-5" stroke="' + G2 + '" stroke-width="3" fill="none" stroke-linecap="round"/>'; };
  L.sister = function () { return ground() + glow(62, 20) + at(62, 0.85, P.girl(), 'ca-bob') + at(104, 0.85, P.boy(), '') + '<path class="ca-point" d="M62 14v10m-5-5l5 5l5-5" stroke="' + G2 + '" stroke-width="3" fill="none" stroke-linecap="round"/>'; };
  L.grandpa = function () { return pair(P.grandpa(), 1, P.boy(), 0.62); };
  L.grandma = function () { return pair(P.grandma(), 1, P.girl(), 0.62); };
  L.son = function () { return ground() + glow(104, 16) + at(58, 1, P.father(), '') + at(104, 0.66, P.boy(), 'ca-bob'); };
  L.daughter = function () { return ground() + glow(104, 16) + at(58, 1, P.mother(), '') + at(104, 0.66, P.girl(), 'ca-bob'); };
  L.photo = function () {
    return '<rect x="34" y="18" width="92" height="76" rx="4" fill="' + WOOD + '"/><rect x="40" y="24" width="80" height="64" fill="' + GS + '"/>' +
      '<g transform="translate(0 -18)">' + at(62, 0.5, P.father(), '') + at(80, 0.5, P.mother(), '') + at(98, 0.36, P.girl(), '') + '</g>' +
      '<rect class="ca-flash" x="0" y="0" width="160" height="120" fill="#fff"/>';
  };

  /* ===== Kasblar ===== */
  function doctorScene(person) {
    return ground() + glow(70) + at(70, 1, person, 'ca-bob') +
      '<g class="ca-pulse"><rect x="112" y="30" width="26" height="26" rx="6" fill="' + G2 + '"/><path d="M125 36v14M118 43h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>' +
      '<path d="M64 -44" />';
  }
  L.doctor = function () { return doctorScene(man({ shirt: WHITE }) + '<path d="M-6 -50q6 14 12 0" stroke="' + G1 + '" stroke-width="2" fill="none"/>'); };
  L.doctorF = function () { return doctorScene(woman({ dress: WHITE, scarf: G1 }) + '<path d="M-6 -48q6 14 12 0" stroke="' + G1 + '" stroke-width="2" fill="none"/>'); };
  L.engineer = function () {
    return ground() + glow(56) + at(56, 1, man({ hat: true, shirt: G1 }), 'ca-bob') +
      '<rect x="92" y="40" width="54" height="40" rx="3" fill="#dff1f9" stroke="#8fb6c7"/>' +
      '<path class="ca-draw" d="M100 72h36M100 72v-22l18-10l18 10v22" stroke="#2f6f8a" stroke-width="2" fill="none"/>';
  };
  function teacherScene(person) {
    return ground() + '<rect x="78" y="22" width="70" height="48" rx="3" fill="' + G1 + '"/><rect x="74" y="70" width="78" height="4" fill="' + WOOD + '"/>' +
      '<text class="ca-write" x="113" y="58" text-anchor="middle" font-size="30" fill="#fff" font-family="Amiri,serif">أ ب</text>' +
      at(46, 1, person, 'ca-bob') + '<path class="ca-pointer" d="M58 60L84 44" stroke="' + WOOD + '" stroke-width="3" stroke-linecap="round"/>';
  }
  L.teacher = function () { return teacherScene(man({ shirt: G2 })); };
  L.teacherF = function () { return teacherScene(woman({})); };
  function studentScene(person) {
    return ground() + '<g class="ca-walk">' + at(60, 0.9, person + '<rect x="-17" y="-52" width="8" height="22" rx="3" fill="' + G1 + '"/>', '') + '</g>' +
      '<g transform="translate(118 84)" class="ca-bob"><rect x="-14" y="-10" width="28" height="20" rx="2" fill="' + G2 + '"/><path d="M0 -10v20" stroke="#fff" stroke-width="2"/></g>';
  }
  L.student = function () { return studentScene(man({ shirt: G3 })); };
  L.studentF = function () { return studentScene(woman({ dress: G3, scarf: G2 })); };

  /* ===== Joylar va narsalar ===== */
  L.room = function () {
    return '<rect x="14" y="14" width="132" height="94" fill="' + GS + '" stroke="' + GREY + '"/><rect x="0" y="108" width="160" height="12" fill="' + WOOD + '"/>' +
      '<rect x="28" y="30" width="34" height="30" fill="#dff1f9" stroke="' + G1 + '" stroke-width="2"/>' +
      '<path d="M45 30v30M28 45h34" stroke="' + G1 + '" stroke-width="2"/>' +
      '<path d="M110 22v18" stroke="' + INK + '" stroke-width="2"/><path d="M98 52l12-14l12 14z" fill="' + G1 + '"/>' +
      '<ellipse class="ca-lamp" cx="110" cy="70" rx="26" ry="18" fill="#fff7c2"/>';
  };
  L.bathroom = function () {
    return ground() + '<rect x="40" y="70" width="80" height="14" rx="7" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<path d="M78 34h18v8" stroke="' + INK + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<circle class="ca-drop" cx="96" cy="48" r="2.5" fill="#5ab4d6"/><circle class="ca-drop d2" cx="96" cy="48" r="2.5" fill="#5ab4d6"/><circle class="ca-drop d3" cx="96" cy="48" r="2.5" fill="#5ab4d6"/>' +
      '<rect x="56" y="84" width="48" height="24" fill="' + GS + '"/>';
  };
  /* Do'kon: soyabonli peshtaxta, vitrina */
  L.shop = function () {
    return ground() + '<rect x="34" y="50" width="92" height="58" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<path d="M30 50h100l-6-18h-88z" fill="' + G2 + '"/><path d="M42 50v-18M58 50v-18M74 50v-18M90 50v-18M106 50v-18M122 50v-18" stroke="' + G3 + '" stroke-width="3"/>' +
      '<rect x="44" y="62" width="34" height="26" fill="#dff1f9" stroke="' + G1 + '" stroke-width="2"/>' +
      '<rect x="88" y="66" width="24" height="42" fill="' + WOOD + '"/><circle cx="106" cy="88" r="2" fill="#f2c94c"/>' +
      '<g class="ca-pulse"><rect x="50" y="70" width="8" height="12" rx="2" fill="#f2c94c"/><rect x="62" y="74" width="10" height="8" rx="2" fill="' + G3 + '"/></g>';
  };
  /* Ayvon (balkon): panjara, gul */
  L.balcony = function () {
    return ground() + '<rect x="36" y="16" width="88" height="62" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<rect x="62" y="26" width="36" height="52" fill="#dff1f9" stroke="' + G1 + '" stroke-width="2"/>' +
      '<rect x="28" y="78" width="104" height="6" fill="' + G1 + '"/><path d="M34 84v22M48 84v22M62 84v22M76 84v22M90 84v22M104 84v22M118 84v22M128 84v22" stroke="' + G1 + '" stroke-width="3"/>' +
      '<g class="ca-sway" style="transform-origin:44px 78px"><circle cx="44" cy="66" r="8" fill="#e98fa6"/><path d="M44 74v4" stroke="' + G2 + '" stroke-width="3"/></g>';
  };
  L.coat = function () {
    return '<path d="M80 10v8" stroke="' + INK + '" stroke-width="2"/><g class="ca-swing" style="transform-origin:80px 18px">' +
      '<path d="M60 30l20-12l20 12" stroke="' + INK + '" stroke-width="3" fill="none"/>' +
      '<path d="M62 30h36l8 64h-52z" fill="' + G1 + '"/><path d="M80 30v64" stroke="' + G3 + '" stroke-width="2"/>' +
      '<circle cx="76" cy="50" r="2" fill="' + G3 + '"/><circle cx="76" cy="64" r="2" fill="' + G3 + '"/></g>';
  };
  L.glasses = function () {
    return '<g class="ca-bob"><circle cx="58" cy="60" r="18" fill="#e9f6fb" stroke="' + INK + '" stroke-width="4"/><circle cx="102" cy="60" r="18" fill="#e9f6fb" stroke="' + INK + '" stroke-width="4"/>' +
      '<path d="M76 58q4-6 8 0" stroke="' + INK + '" stroke-width="4" fill="none"/><path d="M40 56l-14-6M120 56l14-6" stroke="' + INK + '" stroke-width="4"/>' +
      '<path class="ca-glint" d="M48 52l10-8M92 52l10-8" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>';
  };
  L.tree = function () {
    return ground() + '<rect x="74" y="64" width="12" height="44" fill="' + WOOD + '"/><g class="ca-sway" style="transform-origin:80px 70px">' +
      '<circle cx="80" cy="44" r="28" fill="' + G2 + '"/><circle cx="60" cy="58" r="18" fill="' + G2 + '"/><circle cx="100" cy="58" r="18" fill="' + G2 + '"/></g>' +
      '<path class="ca-leaf" d="M104 70q6-4 10 0q-4 6-10 0z" fill="' + G3 + '"/>';
  };
  L.here = function () {
    return ground() + at(44, 1, man({}), '') + '<path d="M58 60L84 78" stroke="' + SK + '" stroke-width="6" stroke-linecap="round"/>' +
      '<g class="ca-bounce"><path d="M110 74a14 14 0 1 1 28 0q0 14-14 30q-14-16-14-30z" fill="' + G2 + '"/><circle cx="124" cy="74" r="5" fill="#fff"/></g>' +
      '<ellipse cx="124" cy="108" rx="14" ry="3" fill="' + G3 + '"/>';
  };

  /* ===== Fe'llar (2-bo'lim) ===== */
  L.sit = function () {
    return ground() + chair(104) +
      '<g class="ca-sit">' + at(70, 1, man({}), '') + '</g>';
  };
  L.read = function () {
    return ground() + chair(64) +
      '<g transform="translate(-12 -14)">' + at(70, 1, man({}), '') + '</g>' +
      '<g transform="translate(96 62)"><path d="M-22 0h22v24h-22z" fill="#fff" stroke="' + G1 + '"/>' +
      '<g class="ca-page" style="transform-origin:0 12px"><path d="M0 0h22v24h-22z" fill="' + GS + '" stroke="' + G1 + '"/></g>' +
      '<path class="ca-shimmer" d="M-18 6h14M-18 12h14M-18 18h10" stroke="' + G2 + '" stroke-width="2"/></g>';
  };
  /* Uyg'ondi: quyosh chiqdi, odam qo'lini cho'zadi */
  L.wakeUp = function () {
    return ground() + '<g class="ca-pulse"><circle cx="124" cy="34" r="14" fill="#f2c94c"/></g>' +
      '<path d="M124 12v-6M146 34h6M140 18l4-4M108 18l-4-4" stroke="#f2c94c" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="20" y="86" width="60" height="16" rx="4" fill="' + GS + '" stroke="' + G2 + '"/>' +
      '<g class="ca-bob">' + at(84, 1, man({}), '') + '</g>';
  };
  /* Yedi: stol, likopcha */
  L.eat = function () {
    return ground() + chair(56) + at(62, 1, man({}), '') +
      '<rect x="80" y="72" width="60" height="6" fill="' + WOOD + '"/><path d="M86 78v30M134 78v30" stroke="' + WOOD + '" stroke-width="4"/>' +
      '<ellipse cx="108" cy="70" rx="16" ry="4" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<g class="ca-bob"><circle cx="104" cy="66" r="4" fill="#e98f4a"/><circle cx="112" cy="66" r="4" fill="' + G3 + '"/></g>';
  };
  L.wear = function () {
    return ground() + '<path d="M28 20v6" stroke="' + INK + '" stroke-width="2"/>' + at(96, 1, man({ shirt: G3 }), '') +
      '<g class="ca-coat-on"><path d="M20 34h30l6 46h-42z" fill="' + G1 + '"/></g>';
  };
  L.takeOff = function () {
    return ground() + '<path d="M28 20v6" stroke="' + INK + '" stroke-width="2"/>' + at(96, 1, man({ shirt: G3 }), '') +
      '<g class="ca-coat-off"><path d="M20 34h30l6 46h-42z" fill="' + G1 + '"/></g>';
  };
  L.take = function () {
    return ground() + glow(46, 20) + at(46, 1, P.mother(), '') + at(118, 1, P.father(), '') +
      '<g transform="translate(0 66)"><g class="ca-box-take">' + box('') + '</g></g>';
  };
  L.give = function () {
    return ground() + glow(46, 20) + at(46, 1, P.father(), '') + at(118, 1, P.girl(), '') +
      '<g transform="translate(0 66)"><g class="ca-box-give">' + box('') + '</g></g>';
  };

  /* ===== Uy-joy ===== */
  L.house = function () { return ground() + '<g class="ca-pop">' + house(80, 1.2) + '</g><path class="ca-smoke" d="M100 30q4-6 0-12q-4-6 0-12" stroke="' + GREY + '" stroke-width="4" fill="none" stroke-linecap="round"/>'; };
  L.apartment = function () {
    var s = ground() + '<rect x="46" y="14" width="68" height="94" fill="' + WHITE + '" stroke="' + GREY + '"/>';
    for (var r = 0; r < 4; r++) for (var c = 0; c < 3; c++) {
      s += '<rect class="ca-light d' + ((r * 3 + c) % 4 + 1) + '" x="' + (54 + c * 20) + '" y="' + (22 + r * 20) + '" width="12" height="12" fill="' + G3 + '"/>';
    }
    return s + '<rect x="74" y="94" width="12" height="14" fill="' + WOOD + '"/>';
  };
  L.bedroom = function () { return L.bed(); };
  L.bed = function () {
    return ground() + '<rect x="24" y="74" width="112" height="22" rx="4" fill="' + WOOD + '"/><rect x="24" y="56" width="10" height="52" rx="3" fill="' + WOOD + '"/>' +
      '<rect x="36" y="64" width="26" height="12" rx="5" fill="#fff"/><path d="M58 74h76v-8q-30-8-76 0z" fill="' + G2 + '"/>' +
      '<circle cx="48" cy="64" r="8" fill="' + SK + '"/>' +
      '<text class="ca-z" x="70" y="46" font-size="14" fill="' + G1 + '" font-weight="700">z</text><text class="ca-z d2" x="80" y="38" font-size="18" fill="' + G1 + '" font-weight="700">z</text>';
  };
  L.sleep = L.bed;
  L.kitchen = function () { return L.cook(); };
  L.cook = function () {
    return ground() + '<rect x="40" y="72" width="80" height="36" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<rect x="56" y="80" width="48" height="20" rx="3" fill="' + INK + '"/>' +
      '<g class="ca-jiggle"><path d="M58 56h44v16h-44z" fill="' + G1 + '"/><path d="M54 54h52" stroke="' + G1 + '" stroke-width="4" stroke-linecap="round"/></g>' +
      '<path class="ca-steam" d="M70 48q-4-8 0-14q4-6 0-14" stroke="' + GREY + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<path class="ca-steam d2" d="M88 48q-4-8 0-14q4-6 0-14" stroke="' + GREY + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
  };
  L.livingRoom = function () { return L.sofa(); };
  L.sofa = function () {
    return ground() + '<rect x="26" y="66" width="108" height="30" rx="8" fill="' + G1 + '"/><rect x="18" y="58" width="16" height="44" rx="6" fill="' + G1 + '"/><rect x="126" y="58" width="16" height="44" rx="6" fill="' + G1 + '"/>' +
      '<g class="ca-bob"><rect x="38" y="54" width="38" height="20" rx="6" fill="' + G2 + '"/></g><g class="ca-bob d2"><rect x="84" y="54" width="38" height="20" rx="6" fill="' + G2 + '"/></g>';
  };
  L.door = function () { return ground() + door(80, 'ca-door-open'); };
  L.open = function () { return ground() + door(80, 'ca-door-open') + '<path class="ca-beam" d="M62 108l-30 0l30-62z" fill="#fff7c2"/>'; };
  L.close = function () { return ground() + door(80, 'ca-door-close'); };
  L.window = function () {
    return '<rect x="30" y="18" width="100" height="80" fill="#dff1f9" stroke="' + G1 + '" stroke-width="4"/>' +
      '<circle class="ca-pulse" cx="104" cy="40" r="10" fill="#f2c94c"/>' +
      '<g class="ca-curtain-l"><path d="M32 20h26q-6 40 0 76h-26z" fill="' + G2 + '"/></g><g class="ca-curtain-r"><path d="M128 20h-26q6 40 0 76h26z" fill="' + G2 + '"/></g>' +
      '<rect x="26" y="98" width="108" height="6" fill="' + WOOD + '"/>';
  };
  L.garden = function () {
    return ground() + L.tree().replace(ground(), '').replace(/translate\(0 0\)/, '') +
      '<g class="ca-grow"><path d="M30 108v-18" stroke="' + G1 + '" stroke-width="3"/><circle cx="30" cy="88" r="6" fill="#f28b8b"/></g>' +
      '<g class="ca-grow d2"><path d="M136 108v-16" stroke="' + G1 + '" stroke-width="3"/><circle cx="136" cy="90" r="6" fill="#f2c94c"/></g>';
  };
  L.chair = function () { return ground() + '<g class="ca-bob">' + chair(80) + '</g>'; };
  L.desk = function () {
    return ground() + '<rect x="30" y="70" width="100" height="8" fill="' + WOOD + '"/><rect x="36" y="78" width="6" height="30" fill="' + WOOD + '"/><rect x="118" y="78" width="6" height="30" fill="' + WOOD + '"/>' +
      '<rect x="56" y="60" width="30" height="10" fill="#fff" stroke="' + GREY + '"/><path d="M108 70v-26l-10-6" stroke="' + INK + '" stroke-width="3" fill="none"/>' +
      '<path d="M90 36h16l-4 8h-8z" fill="' + G1 + '"/><ellipse class="ca-lamp" cx="98" cy="62" rx="18" ry="10" fill="#fff7c2"/>';
  };
  L.wardrobe = function () {
    return ground() + '<rect x="46" y="20" width="68" height="88" fill="' + INK + '"/>' +
      '<g class="ca-wd-l" style="transform-origin:46px 64px"><rect x="46" y="20" width="34" height="88" fill="' + WOOD + '" stroke="#9c7349"/></g>' +
      '<g class="ca-wd-r" style="transform-origin:114px 64px"><rect x="80" y="20" width="34" height="88" fill="' + WOOD + '" stroke="#9c7349"/></g>';
  };
  L.fridge = function () {
    return ground() + '<rect x="56" y="14" width="48" height="94" rx="6" fill="#eef4f2" stroke="' + GREY + '"/><rect x="56" y="14" width="48" height="94" rx="6" fill="#fff7c2" class="ca-lamp"/>' +
      '<g class="ca-door-open" style="transform-origin:56px 60px"><rect x="56" y="14" width="48" height="94" rx="6" fill="' + WHITE + '" stroke="' + GREY + '"/><rect x="94" y="30" width="4" height="20" rx="2" fill="' + GREY + '"/></g>';
  };
  L.mirror = function () {
    return '<ellipse cx="80" cy="58" rx="34" ry="44" fill="' + WOOD + '"/><ellipse cx="80" cy="58" rx="28" ry="38" fill="#e3f3f8"/>' +
      '<path class="ca-glint" d="M64 40l14-14M66 56l26-26" stroke="#fff" stroke-width="5" stroke-linecap="round"/>';
  };
  L.carpet = function () {
    return '<rect x="20" y="30" width="120" height="70" rx="4" fill="' + G1 + '"/><rect x="28" y="38" width="104" height="54" rx="2" fill="' + G2 + '"/>' +
      '<path class="ca-shimmer" d="M80 44l14 21l-14 21l-14-21z" fill="' + G3 + '"/><path d="M20 30v70M140 30v70" stroke="' + GS + '" stroke-width="4" stroke-dasharray="2 4"/>';
  };
  L.floor = function () {
    var s = ground() + '<rect x="50" y="12" width="60" height="96" fill="' + WHITE + '" stroke="' + GREY + '"/>';
    for (var r = 0; r < 4; r++) {
      s += '<rect class="ca-floor d' + (4 - r) + '" x="50" y="' + (12 + r * 24) + '" width="60" height="24" fill="' + G3 + '"/>' +
        '<path d="M50 ' + (36 + r * 24) + 'h60" stroke="' + GREY + '"/>';
    }
    return s;
  };
  L.elevator = function () {
    return ground() + '<rect x="58" y="10" width="44" height="98" fill="' + GS + '" stroke="' + GREY + '"/><path d="M80 10v98" stroke="' + GREY + '" stroke-dasharray="3 3"/>' +
      '<g class="ca-lift"><rect x="62" y="74" width="36" height="30" rx="3" fill="' + G2 + '"/><path d="M80 74v30" stroke="' + WHITE + '"/></g>';
  };
  L.stairs = function () {
    return ground() + '<path d="M20 108h24v-18h24v-18h24v-18h24v-18h24v72z" fill="' + GS + '" stroke="' + G2 + '" stroke-width="2"/>' +
      '<g class="ca-climb"><circle cx="0" cy="0" r="7" fill="' + G1 + '"/></g>';
  };
  L.street = function () {
    return '<rect x="0" y="70" width="160" height="40" fill="#4b5d58"/><path d="M0 90h160" stroke="#fff" stroke-width="3" stroke-dasharray="12 10"/>' +
      '<rect x="0" y="62" width="160" height="8" fill="' + GREY + '"/><rect x="0" y="110" width="160" height="10" fill="' + GREY + '"/>' +
      '<g class="ca-car"><rect x="-40" y="76" width="34" height="12" rx="4" fill="' + G2 + '"/><path d="M-34 76l6-8h14l6 8z" fill="' + G1 + '"/><circle cx="-32" cy="88" r="4" fill="' + INK + '"/><circle cx="-14" cy="88" r="4" fill="' + INK + '"/></g>' +
      '<rect x="20" y="20" width="30" height="42" fill="' + WHITE + '" stroke="' + GREY + '"/><rect x="110" y="26" width="34" height="36" fill="' + WHITE + '" stroke="' + GREY + '"/>';
  };
  function neighbors(main) {
    return ground() + '<rect x="12" y="40" width="64" height="68" fill="' + WHITE + '" stroke="' + GREY + '"/><rect x="84" y="40" width="64" height="68" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<rect x="36" y="80" width="16" height="28" fill="' + WOOD + '"/><rect x="108" y="80" width="16" height="28" fill="' + WOOD + '"/>' +
      glow(116, 16) + at(60, 0.7, P.mother(), '') + '<g class="ca-wave-wrap">' + at(116, 0.7, main, 'ca-bob') + '</g>';
  }
  L.neighbor = function () { return neighbors(P.father()); };
  L.neighborF = function () { return neighbors(P.mother()); };
  L.near = function () {
    return ground() + house(48, 0.9) + '<g transform="translate(30 0)">' + L.shop().replace(ground(), '').replace(/<g class="ca-pulse">[\s\S]*?<\/g>/, '') + '</g>' +
      '<path class="ca-dash" d="M70 100h22" stroke="' + G2 + '" stroke-width="3" stroke-dasharray="4 3"/>';
  };
  L.far = function () {
    return ground() + house(30, 0.8) + '<g transform="translate(118 64) scale(.35)"><rect x="-30" y="0" width="60" height="40" fill="' + WHITE + '" stroke="' + GREY + '"/><path d="M-24 2q24-34 48 0z" fill="' + G2 + '"/></g>' +
      '<path class="ca-dash" d="M58 100h70" stroke="' + G2 + '" stroke-width="3" stroke-dasharray="6 5"/><path d="M126 94l6 6l-6 6" stroke="' + G2 + '" stroke-width="3" fill="none"/>';
  };
  L.live = function () {
    return ground() + house(96, 1.1) + '<g class="ca-walk-in">' + at(30, 0.8, P.mother(), '') + '</g>';
  };
  L.enter = function () { return ground() + door(110, '') + '<g class="ca-walk-in">' + at(40, 1, man({}), '') + '</g>'; };
  L.exit = function () { return ground() + door(50, '') + '<g class="ca-walk-out">' + at(50, 1, man({}), '') + '</g>'; };
  L.wash = function () {
    return ground() + '<rect x="40" y="70" width="80" height="14" rx="7" fill="' + WHITE + '" stroke="' + GREY + '"/>' +
      '<path d="M90 34h16v8" stroke="' + INK + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<circle class="ca-drop" cx="106" cy="46" r="2.5" fill="#5ab4d6"/><circle class="ca-drop d2" cx="106" cy="46" r="2.5" fill="#5ab4d6"/>' +
      '<g class="ca-rub"><ellipse cx="78" cy="64" rx="18" ry="6" fill="' + WHITE + '" stroke="' + G2 + '" stroke-width="2"/></g>' +
      '<circle class="ca-bubble" cx="66" cy="56" r="4" fill="none" stroke="#5ab4d6"/><circle class="ca-bubble d2" cx="86" cy="54" r="3" fill="none" stroke="#5ab4d6"/>';
  };

  function render(key, label) {
    var f = L[key];
    if (!f) return svg('<rect x="40" y="20" width="80" height="80" rx="16" fill="' + GS + '"/><text x="80" y="72" text-anchor="middle" font-size="30" fill="' + G1 + '">؟</text>', label);
    return svg(f(), label);
  }

  A.CourseAnim = { render: render, keys: Object.keys(L) };
})(typeof window !== 'undefined' ? window : globalThis);
