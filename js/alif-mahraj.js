/* Alifbo — harflarning chiqish joyi (maxraj) va og'iz-tomoq animatsiyasi.
   Har harf uchun: qayerdan chiqadi, til/lab qanday turadi, havo qayerdan
   o'tadi, ovoz paychalari titraydimi — bosqichma-bosqich tushuntirish va
   yon tomondan ko'rinish (kesim) animatsiyasi.                              */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};

  /* ---- Nuqtalar (yon kesim, yuz o'ngga qaragan; viewBox 0 0 320 290) ---- */
  var PT = {
    lips: [252, 146], teeth: [233, 143], ridge: [219, 122], palate: [180, 106],
    velum: [140, 112], uvula: [116, 134], pharynx: [106, 182], glottis: [112, 246],
    molars: [196, 118], nose: [205, 92]
  };
  var PT_UZ = {
    lips: 'ikki lab', teeth: 'old tishlar uchi', ridge: 'yuqori tishlar milki (tish orqasidagi do‘nglik)',
    palate: 'qattiq tanglay', velum: 'yumshoq tanglay', uvula: 'kichik til (tilcha)',
    pharynx: 'bo‘g‘izning o‘rtasi', glottis: 'bo‘g‘izning eng ichi (ovoz paychalari)',
    molars: 'yuqori jag‘ tishlari (yon tomon)', nose: 'burun bo‘shlig‘i'
  };

  /* ---- Til shakllari: ildiz → orqa → yuza → tig' → uch (5 nuqta) ---- */
  var TONGUE = {
    rest:    [[120, 226], [126, 168], [168, 142], [204, 146], [224, 153]],
    ridge:   [[120, 226], [128, 166], [170, 136], [204, 128], [219, 123]],
    teeth:   [[120, 226], [128, 168], [172, 142], [210, 140], [236, 142]],
    lower:   [[120, 226], [128, 164], [172, 132], [208, 132], [226, 152]],
    middle:  [[120, 226], [132, 150], [176, 110], [208, 132], [224, 154]],
    soft:    [[120, 226], [128, 128], [150, 118], [198, 144], [224, 154]],
    deep:    [[116, 226], [116, 140], [146, 128], [196, 148], [224, 155]],
    throat:  [[112, 226], [116, 186], [160, 158], [204, 154], [224, 156]],
    heavyS:  [[120, 226], [124, 128], [160, 136], [206, 136], [226, 152]],
    heavyT:  [[120, 226], [124, 128], [160, 138], [204, 130], [219, 123]],
    heavyTH: [[120, 226], [124, 128], [162, 140], [210, 140], [236, 142]],
    side:    [[120, 226], [128, 138], [172, 116], [204, 124], [219, 123]],
    low:     [[120, 226], [126, 176], [168, 152], [204, 152], [224, 156]]
  };

  /* ---- Har harf ----
     t: til shakli, lab: closed|open|round|bite|spread, p: chiqish nuqtasi,
     air: mouth|nose|side, kind: stop (to'xtab ochiladi) | fric (shivirlab
     oqadi) | flow (erkin) | tap (titraydi), v: ovoz paychalari titraydi,
     heavy: qalin (tilning orqasi ko'tariladi)                              */
  var L = {
    'ا': { t: 'throat', lab: 'open', p: 'glottis', air: 'mouth', kind: 'stop', v: true,
      sum: 'Harakat bilan kelganda (أَ إِ أُ) alif — hamza: tovush bo‘g‘izning eng ichida bir lahza to‘xtab, keskin ochiladi.',
      steps: ['Og‘izni bo‘sh, erkin oching.', 'Nafasni bo‘g‘izning eng ichida (ovoz paychalarida) bir lahza to‘xtating.', 'To‘xtatilgan havoni birdan qo‘yib yuboring — «ʼa».', 'Tilni qimirlatmang, u pastda yotadi.'],
      err: 'O‘zbekchadagi oddiy «a» kabi yumshoq boshlamang — boshida qisqa «tutilish» bo‘lsin.' },
    'ب': { t: 'rest', lab: 'closed', p: 'lips', air: 'mouth', kind: 'stop', v: true,
      sum: 'Ikki lab yopilib, keyin ochiladi. Ovoz paychalari titraydi.',
      steps: ['Ikki labni bir-biriga yoping.', 'Havoni og‘izda ozgina to‘plang.', 'Labni ochib, havoni chiqaring: «b».', 'Bo‘g‘izda titrash sezilsin (kaftni tomoqqa qo‘ying).'],
      err: 'So‘z oxirida «p» ga aylantirmang: بَاب — «bāb», «bāp» emas.' },
    'ت': { t: 'ridge', lab: 'open', p: 'ridge', air: 'mouth', kind: 'stop', v: false,
      sum: 'Til uchi yuqori tishlar milkiga tegib, keyin ajraladi. Ovozsiz.',
      steps: ['Til uchini yuqori old tishlar orqasidagi milkka qo‘ying.', 'Havoni til orqasida bir lahza to‘xtating.', 'Tilni tez tushiring: «t».', 'Ovoz paychalari titramaydi.'],
      err: 'Tilni tishlar orasiga chiqarmang — u «ث» bo‘lib qoladi.' },
    'ث': { t: 'teeth', lab: 'open', p: 'teeth', air: 'mouth', kind: 'fric', v: false,
      sum: 'Til uchi yuqori tishlar uchiga tegib, havo tish va til orasidan shivirlab chiqadi.',
      steps: ['Til uchini ozgina tashqariga — yuqori tishlar uchiga tegizing.', 'Havoni til va tish orasidan sekin puflang.', 'Ovozsiz, shivirlagan «s» chiqadi (ingliz «think» dagi «th»).', 'Tilni orqaga tortmang.'],
      err: 'Oddiy «s» deb aytmang: ثَلْج «salj» emas, «thalj».' },
    'ج': { t: 'middle', lab: 'open', p: 'palate', air: 'mouth', kind: 'stop', v: true,
      sum: 'Tilning o‘rtasi qattiq tanglayga tegib, ajraladi. Ovozli «j».',
      steps: ['Tilning o‘rta qismini qattiq tanglayga ko‘taring.', 'Havoni bir lahza to‘xtating.', 'Tilni ajratib, «dj» chiqaring.', 'Bo‘g‘iz titraydi.'],
      err: 'Fransuzcha yumshoq «j» (jurnal) emas — o‘zbekcha «jo‘ja» dagi «j».' },
    'ح': { t: 'throat', lab: 'open', p: 'pharynx', air: 'mouth', kind: 'fric', v: false,
      sum: 'Bo‘g‘izning o‘rtasi siqilib, havo xirillamay, issiq nafas bo‘lib chiqadi.',
      steps: ['Og‘izni oching, tilni pastda qoldiring.', 'Bo‘g‘izning o‘rta qismini siqing (oynani puflab terlatgandek, lekin kuchliroq).', 'Havoni siqilgan joydan chiqaring: «ḥ».', 'Ovoz paychalari titramaydi, xirillash bo‘lmasin.'],
      err: 'O‘zbekcha «h» yoki «x» deb aytmang: «ح» ikkalasidan ham farq qiladi.' },
    'خ': { t: 'soft', lab: 'open', p: 'uvula', air: 'mouth', kind: 'fric', v: false, heavy: true,
      sum: 'Tilning orqasi kichik tilga yaqinlashadi, havo xirillab chiqadi. O‘zbekcha «x».',
      steps: ['Tilning orqa qismini yumshoq tanglay va tilchaga ko‘taring.', 'Orada tor yo‘l qoldiring.', 'Havoni xirillatib chiqaring: «x».', 'Ovoz paychalari titramaydi.'],
      err: 'Yumshoq «h» qilmang — o‘zbekcha «xat» dagi «x» kabi.' },
    'د': { t: 'ridge', lab: 'open', p: 'ridge', air: 'mouth', kind: 'stop', v: true,
      sum: 'Til uchi yuqori tishlar milkiga tegib ajraladi. Ovozli.',
      steps: ['Til uchini yuqori old tishlar milkiga qo‘ying.', 'Havoni bir lahza to‘xtating.', 'Tilni tushirib «d» chiqaring.', 'Bo‘g‘iz titraydi.'],
      err: 'So‘z oxirida «t» qilmang: وَلَد — «walad».' },
    'ذ': { t: 'teeth', lab: 'open', p: 'teeth', air: 'mouth', kind: 'fric', v: true,
      sum: 'Til uchi yuqori tishlar uchiga tegadi, havo ovoz bilan chiqadi (ingliz «this»).',
      steps: ['Til uchini yuqori tishlar uchiga tegizing.', 'Havoni til va tish orasidan chiqaring.', 'Bo‘g‘izni titrating — ovozli «z» chiqadi.', 'Tilni orqaga olmang.'],
      err: 'Oddiy «z» deb aytmang: ذَهَب «zahab» emas, «dhahab».' },
    'ر': { t: 'ridge', lab: 'open', p: 'ridge', air: 'mouth', kind: 'tap', v: true,
      sum: 'Til uchi milkka bir-ikki marta tegib titraydi.',
      steps: ['Til uchini yuqori tishlar milkiga yaqinlashtiring.', 'Havo o‘tganda til uchi bir-ikki marta urilsin.', 'Ovozli «r».', 'Juda ko‘p titratmang — bir-ikki zarb kifoya.'],
      err: 'Ruscha uzun «rrr» qilmang.' },
    'ز': { t: 'lower', lab: 'spread', p: 'teeth', air: 'mouth', kind: 'fric', v: true,
      sum: 'Til uchi pastki tishlar orqasida, havo tishlar orasidan vizillab chiqadi. Ovozli.',
      steps: ['Til uchini pastki old tishlar orqasiga qo‘ying.', 'Tishlarni bir-biriga yaqinlashtiring.', 'Havoni tishlar orasidan chiqaring.', 'Bo‘g‘iz titraydi: «z».'],
      err: 'Tilni tishlar orasiga chiqarmang — u «ذ» bo‘lib qoladi.' },
    'س': { t: 'lower', lab: 'spread', p: 'teeth', air: 'mouth', kind: 'fric', v: false,
      sum: 'Til uchi pastki tishlar orqasida, havo tishlar orasidan hushtakdek chiqadi.',
      steps: ['Til uchini pastki old tishlar orqasiga qo‘ying.', 'Tishlarni yaqinlashtiring.', 'Havoni ingichka oqim qilib chiqaring: «s».', 'Ovoz paychalari titramaydi.'],
      err: 'Qalin «ص» qilmang: tilning orqasi pastda qolsin.' },
    'ش': { t: 'middle', lab: 'round', p: 'palate', air: 'mouth', kind: 'fric', v: false,
      sum: 'Tilning o‘rtasi tanglayga yaqinlashadi, havo keng yoyilib chiqadi: «sh».',
      steps: ['Tilning o‘rtasini qattiq tanglayga yaqinlashtiring (tegmasin).', 'Lablarni ozgina oldinga cho‘zing.', 'Havoni keng oqim bilan chiqaring: «sh».', 'Ovozsiz.'],
      err: 'Bu oson harf — o‘zbekcha «sh» bilan bir xil.' },
    'ص': { t: 'heavyS', lab: 'round', p: 'teeth', air: 'mouth', kind: 'fric', v: false, heavy: true,
      sum: '«س» kabi, lekin qalin: tilning orqasi ko‘tarilib, og‘iz «to‘la» bo‘ladi.',
      steps: ['Til uchini pastki tishlar orqasiga qo‘ying.', 'Tilning orqa qismini tanglay tomonga ko‘taring (og‘iz ichi «to‘ladi»).', 'Lablarni ozgina yumaloqlang.', 'Havoni chiqaring: qalin «ṣ». Keyingi «a» ham «o» ga yaqin eshitiladi.'],
      err: 'Ingichka «s» deb aytmang: صَبْر — «ṣabr», og‘iz to‘la.' },
    'ض': { t: 'side', lab: 'round', p: 'molars', air: 'mouth', kind: 'stop', v: true, heavy: true,
      sum: 'Tilning yon cheti yuqori jag‘ tishlariga tegadi, til qalin turadi. Ovozli, qalin «d».',
      steps: ['Tilning yon chetini (chap yoki o‘ng) yuqori jag‘ tishlariga bosing.', 'Til uchi milkka tegib tursin, tilning orqasi ko‘tarilsin.', 'Havoni to‘xtatib, ochib yuboring.', 'Bo‘g‘iz titraydi: qalin «ḍ».'],
      err: 'Oddiy «d» qilmang: ضَيْف — og‘iz to‘la, qalin.' },
    'ط': { t: 'heavyT', lab: 'round', p: 'ridge', air: 'mouth', kind: 'stop', v: false, heavy: true,
      sum: '«ت» joyidan, lekin qalin: tilning orqasi ko‘tariladi, nafas puflanmaydi.',
      steps: ['Til uchini yuqori tishlar milkiga qo‘ying.', 'Tilning orqasini tanglayga ko‘taring.', 'Havoni to‘xtatib, keskin oching.', 'Ovozsiz, qalin «ṭ».'],
      err: 'Ingichka «t» qilmang: طَبْل — «ṭabl», og‘iz to‘la.' },
    'ظ': { t: 'heavyTH', lab: 'round', p: 'teeth', air: 'mouth', kind: 'fric', v: true, heavy: true,
      sum: '«ذ» joyidan (til tishlar uchida), lekin qalin. Ovozli.',
      steps: ['Til uchini yuqori tishlar uchiga tegizing.', 'Tilning orqasini ko‘taring — og‘iz to‘lsin.', 'Havoni ovoz bilan chiqaring.', 'Qalin «ẓ».'],
      err: 'Oddiy «z» deb aytmang: ظُهْر — «ẓuhr».' },
    'ع': { t: 'throat', lab: 'open', p: 'pharynx', air: 'mouth', kind: 'fric', v: true,
      sum: 'Bo‘g‘izning o‘rtasi siqiladi va ovoz paychalari titraydi — «ح» ning ovozli juftligi.',
      steps: ['Og‘izni oching, tilni pastga qo‘ying.', 'Bo‘g‘izning o‘rta qismini siqing (yutinayotgandek).', 'Siqilgan bo‘g‘iz bilan ovoz chiqaring.', 'Ovoz «bo‘g‘iqroq» eshitiladi: «ʿa».'],
      err: 'Oddiy «a» deb aytib yubormang — bo‘g‘iz siqilishi sezilsin.' },
    'غ': { t: 'soft', lab: 'open', p: 'uvula', air: 'mouth', kind: 'fric', v: true, heavy: true,
      sum: '«خ» joyidan, lekin ovozli — o‘zbekcha «g‘».',
      steps: ['Tilning orqasini tilchaga yaqinlashtiring.', 'Tor yo‘l qoldiring.', 'Havoni ovoz bilan chiqaring.', 'O‘zbekcha «g‘alla» dagi «g‘».'],
      err: 'Oddiy «g» qilmang.' },
    'ف': { t: 'rest', lab: 'bite', p: 'teeth', air: 'mouth', kind: 'fric', v: false,
      sum: 'Pastki labning ichki tomoni yuqori tishlar uchiga tegib, havo orasidan chiqadi.',
      steps: ['Pastki labni yuqori old tishlar uchiga tegizing.', 'Havoni lab va tish orasidan puflang.', 'Ovozsiz «f».', 'Til erkin yotadi.'],
      err: 'Ikki lab bilan («p» kabi) aytmang.' },
    'ق': { t: 'deep', lab: 'open', p: 'uvula', air: 'mouth', kind: 'stop', v: false, heavy: true,
      sum: 'Tilning eng orqasi tilchaga tegib ajraladi. Qalin, chuqur «q».',
      steps: ['Tilning eng orqa qismini tilcha (kichik til) ga tegizing.', 'Havoni u yerda to‘xtating.', 'Keskin oching: chuqur «q».', 'Ovozsiz.'],
      err: '«ك» bilan adashtirmang: «ق» tomoqqa yaqinroq, o‘zbekcha «qalam» dagi «q».' },
    'ك': { t: 'soft', lab: 'open', p: 'velum', air: 'mouth', kind: 'stop', v: false,
      sum: 'Tilning orqasi yumshoq tanglayga tegib ajraladi. Ingichka «k».',
      steps: ['Tilning orqa qismini yumshoq tanglayga tegizing («ق» dan oldinroq).', 'Havoni to‘xtating.', 'Ochib yuboring: «k».', 'Ovozsiz.'],
      err: 'Qalin «q» qilmang: كَلْب — «kalb».' },
    'ل': { t: 'ridge', lab: 'open', p: 'ridge', air: 'side', kind: 'flow', v: true,
      sum: 'Til uchi milkka tegadi, havo tilning ikki yonidan oqadi.',
      steps: ['Til uchini yuqori tishlar milkiga qo‘ying.', 'Tilning yonlari pastda, havo yondan o‘tsin.', 'Ovoz bilan «l».', 'Ingichka aytiladi (o‘zbekcha «lola»).'],
      err: 'Ruscha qalin «ł» qilmang.' },
    'م': { t: 'rest', lab: 'closed', p: 'lips', air: 'nose', kind: 'flow', v: true,
      sum: 'Ikki lab yopiq, ovoz burundan chiqadi.',
      steps: ['Ikki labni yoping.', 'Yumshoq tanglay pastga tushadi — burun yo‘li ochiladi.', 'Ovozni burundan chiqaring: «mmm».', 'Labni ochib unlini qo‘shing: «ma».'],
      err: 'Bu oson harf — o‘zbekcha «m» bilan bir xil.' },
    'ن': { t: 'ridge', lab: 'open', p: 'ridge', air: 'nose', kind: 'flow', v: true,
      sum: 'Til uchi milkka tegadi, ovoz burundan chiqadi.',
      steps: ['Til uchini yuqori tishlar milkiga qo‘ying.', 'Burun yo‘li ochiq — ovoz burundan o‘tadi.', 'Ovozli «n».', 'Tilni tushirib unlini qo‘shing: «na».'],
      err: 'Oson harf — o‘zbekcha «n».' },
    'ه': { t: 'low', lab: 'open', p: 'glottis', air: 'mouth', kind: 'fric', v: false,
      sum: 'Bo‘g‘izning eng ichidan yengil nafas bilan chiqadi.',
      steps: ['Og‘izni oching.', 'Bo‘g‘izni siqmang — erkin qoldiring.', 'Ichkaridan yengil nafas chiqaring: «h».', 'Ovozsiz, yumshoq.'],
      err: '«ح» kabi siqmang va «x» kabi xirillatmang.' },
    'و': { t: 'soft', lab: 'round', p: 'lips', air: 'mouth', kind: 'flow', v: true,
      sum: 'Lablar yumaloqlanib oldinga chiqadi: «w». Tilning orqasi biroz ko‘tariladi.',
      steps: ['Lablarni yumaloqlab oldinga cho‘zing.', 'Tilning orqasi ozgina ko‘tarilsin.', 'Ovoz bilan «w» deng va labni oching.', 'O‘zbekcha «v» emas — ingliz «water» dagi «w».'],
      err: 'Tishni labga tekkizmang — «v» bo‘lib qoladi.' },
    'ي': { t: 'middle', lab: 'spread', p: 'palate', air: 'mouth', kind: 'flow', v: true,
      sum: 'Tilning o‘rtasi qattiq tanglayga yaqinlashadi: «y».',
      steps: ['Tilning o‘rtasini tanglayga yaqinlashtiring.', 'Lablar ozgina yoyiq.', 'Ovozni chiqaring: «y».', 'O‘zbekcha «yo‘l» dagi «y».'],
      err: 'Oson harf.' }
  };

  /* ---------- SVG animatsiya ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  /* Catmull-Rom → Bezier */
  function smooth(pts) {
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }
  function tonguePath(t, jy) {
    /* uch va tig' jag' bilan birga pastga tushadi (agar tanglayga tegmasa) */
    var top = t.map(function (p, i) { return [p[0], p[1] + jy * [0, 0.15, 0.4, 0.7, 0.85][i]]; });
    var tip = top[4];
    return smooth(top) + ' C' + (tip[0] + 5) + ' ' + (tip[1] + 6) + ' ' + (tip[0] - 2) + ' ' + (tip[1] + 14) + ' ' + (tip[0] - 14) + ' ' + (tip[1] + 14) +
      ' C200 ' + (176 + jy) + ' 160 ' + (196 + jy * 0.6) + ' 140 ' + (208 + jy * 0.3) + ' L120 226 Z';
  }
  function lerp(a, b, k) { return a.map(function (p, i) { return [p[0] + (b[i][0] - p[0]) * k, p[1] + (b[i][1] - p[1]) * k]; }); }
  var LIPS = {
    open: { up: 0, lo: 0, x: 0 }, closed: { up: 3, lo: -5, x: 1 }, round: { up: 1, lo: -2, x: 9 },
    bite: { up: 0, lo: -9, x: -12 }, spread: { up: -1, lo: 1, x: -3 }
  };
  var AIR = {
    mouth: 'M112 248 C106 220 104 196 110 170 C120 150 160 140 200 142 C228 144 248 146 290 146',
    side: 'M112 248 C106 220 104 196 110 170 C126 156 170 160 205 160 C232 158 252 150 290 148',
    nose: 'M112 248 C106 220 104 180 112 140 C118 110 150 92 190 90 C222 90 246 96 284 104'
  };

  /** Animatsiya. API: show(ch), play(onStep, vowel), step(i), vowel('a'|'i'|'u'), stop() */
  function Stage(box) {
    var svg = el('svg', { viewBox: '0 0 320 290', class: 'mx-svg', role: 'img', 'aria-label': 'Og‘iz va bo‘g‘iz yon kesimi' });
    var defs = el('defs', {});
    var g1 = el('radialGradient', { id: 'mxGlow' });
    g1.appendChild(el('stop', { offset: '0', 'stop-color': '#ffb703', 'stop-opacity': '.95' }));
    g1.appendChild(el('stop', { offset: '1', 'stop-color': '#ffb703', 'stop-opacity': '0' }));
    defs.appendChild(g1);
    var mk = el('marker', { id: 'mxArr', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' });
    mk.appendChild(el('path', { d: 'M0 0 L10 5 L0 10 Z', fill: '#2f80ed' }));
    defs.appendChild(mk);
    svg.appendChild(defs);
    /* yuz va bosh (yuqori qism) */
    svg.appendChild(el('path', { class: 'mx-head', d: 'M28 290 L30 120 C30 40 90 6 160 8 C210 10 236 34 240 66 C246 76 252 86 266 104 C270 112 262 116 250 116 C252 122 258 126 258 134 C258 140 254 144 248 145 L236 146 L180 290 Z' }));
    /* burun bo'shlig'i, og'iz, bo'g'iz */
    svg.appendChild(el('path', { class: 'mx-cavity', d: 'M118 104 C140 86 200 80 244 96 L248 108 C210 98 170 98 140 106 Z' }));
    svg.appendChild(el('path', { class: 'mx-throat', d: 'M100 112 C96 160 98 220 104 290 L128 290 C124 250 120 230 122 210 C120 180 118 150 122 128 Z' }));
    var mouthDark = el('path', { class: 'mx-mouth', d: '' });
    svg.appendChild(mouthDark);
    svg.appendChild(el('path', { class: 'mx-palate', d: 'M222 118 C214 106 196 100 176 101 C160 102 148 106 140 110' }));
    var velum = el('path', { class: 'mx-velum', d: '' });
    svg.appendChild(velum);
    /* yuqori tishlar */
    svg.appendChild(el('path', { class: 'mx-teeth', d: 'M224 118 C230 118 236 122 238 128 L238 143 C235 146 230 146 228 143 L222 124 Z' }));
    var tongue = el('path', { class: 'mx-tongue', d: '' });
    svg.appendChild(tongue);
    /* pastki jag': tishlar, lab, iyak */
    var jawG = el('g', {});
    jawG.appendChild(el('path', { class: 'mx-skin', d: 'M232 150 L248 150 C256 152 258 160 256 166 C252 172 244 174 240 176 C248 182 252 192 250 204 C248 216 236 224 222 226 L190 228 C170 232 150 244 142 300 L120 300 L120 232 C150 222 180 202 200 188 C214 178 226 168 232 150 Z' }));
    jawG.appendChild(el('path', { class: 'mx-edge', d: 'M248 150 C256 152 258 160 256 166 C252 172 244 174 240 176 C248 182 252 192 250 204 C248 216 236 224 222 226 L190 228 C170 232 150 244 142 300' }));
    jawG.appendChild(el('path', { class: 'mx-teeth', d: 'M226 168 L228 152 C230 148 236 148 237 152 L236 168 Z' }));
    var loLip = el('path', { class: 'mx-lip', d: '' });
    jawG.appendChild(loLip);
    svg.appendChild(jawG);
    var upLip = el('path', { class: 'mx-lip', d: '' });
    svg.appendChild(upLip);
    /* ovoz paychalari */
    var folds = el('g', { class: 'mx-folds' });
    folds.appendChild(el('path', { d: 'M102 244 L114 248', class: 'mx-fold' }));
    folds.appendChild(el('path', { d: 'M126 244 L116 248', class: 'mx-fold' }));
    svg.appendChild(folds);
    var air = el('path', { class: 'mx-air', d: AIR.mouth, 'marker-end': 'url(#mxArr)' });
    svg.appendChild(air);
    var glow = el('circle', { r: 18, fill: 'url(#mxGlow)', class: 'mx-glow' });
    var dot = el('circle', { r: 5.5, class: 'mx-dot' });
    svg.appendChild(glow); svg.appendChild(dot);
    /* belgilar */
    function tag(x, y, t) { var e = el('text', { x: x, y: y, class: 'mx-tag' }); e.textContent = t; svg.appendChild(e); }
    tag(168, 86, 'burun'); tag(40, 186, 'bo‘g‘iz'); tag(150, 130, 'til');
    var lbl = el('text', { class: 'mx-lbl', x: 12, y: 280 });
    svg.appendChild(lbl);
    box.appendChild(svg);

    var cur = { t: TONGUE.rest.map(function (p) { return p.slice(); }), jaw: 0.15, lab: LIPS.open, vel: 0 };
    var raf = null, timers = [], seq = [];
    function paintLips(lab, jy) {
      upLip.setAttribute('d', 'M238 124 C246 124 254 130 ' + (256 + lab.x) + ' ' + (140 + lab.up) + ' C' + (252 + lab.x) + ' ' + (146 + lab.up) + ' 244 ' + (146 + lab.up) + ' 236 ' + (145 + lab.up) + ' Z');
      var ly = 150 + lab.lo;
      loLip.setAttribute('d', 'M236 ' + ly + ' C244 ' + (ly - 1) + ' ' + (252 + lab.x) + ' ' + (ly) + ' ' + (256 + lab.x) + ' ' + (ly + 6) + ' C' + (254 + lab.x) + ' ' + (ly + 16) + ' 244 ' + (ly + 18) + ' 236 ' + (ly + 14) + ' Z');
      jawG.setAttribute('transform', 'translate(0 ' + jy.toFixed(1) + ')');
      mouthDark.setAttribute('d', 'M122 128 C150 112 200 104 222 120 L236 ' + (144 + lab.up) + ' L236 ' + (150 + lab.lo + jy) + ' C210 ' + (172 + jy) + ' 160 ' + (200 + jy * 0.6) + ' 122 ' + (214 + jy * 0.3) + ' Z');
    }
    function draw() {
      var jy = cur.jaw * 22;
      tongue.setAttribute('d', tonguePath(cur.t, jy));
      paintLips(cur.lab, jy);
      var v = cur.vel;
      velum.setAttribute('d', 'M140 110 C' + (130 - v * 2) + ' ' + (112 + v * 6) + ' ' + (122 - v * 2) + ' ' + (120 + v * 10) + ' ' + (116 + v * 4) + ' ' + (134 + v * 8));
    }
    function tween(to, ms, done) {
      var from = { t: cur.t, jaw: cur.jaw, lab: cur.lab, vel: cur.vel }, t0 = performance.now();
      cancelAnimationFrame(raf);
      (function f(now) {
        var k = Math.min(1, (now - t0) / ms); k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        cur.t = lerp(from.t, to.t || from.t, k);
        cur.jaw = from.jaw + ((to.jaw != null ? to.jaw : from.jaw) - from.jaw) * k;
        var lt = to.lab || from.lab;
        cur.lab = { up: from.lab.up + (lt.up - from.lab.up) * k, lo: from.lab.lo + (lt.lo - from.lab.lo) * k, x: from.lab.x + (lt.x - from.lab.x) * k };
        cur.vel = from.vel + ((to.vel != null ? to.vel : from.vel) - from.vel) * k;
        draw();
        if (k < 1) raf = requestAnimationFrame(f); else if (done) done();
      })(t0);
    }
    function clear() { timers.forEach(clearTimeout); timers = []; ['mx-flow', 'mx-voice', 'mx-burst', 'mx-tap', 'mx-pt'].forEach(function (c) { svg.classList.remove(c); }); }
    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    var info = null;
    function setPoint(id) {
      var p = PT[id] || PT.lips;
      glow.setAttribute('cx', p[0]); glow.setAttribute('cy', p[1]);
      dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]);
      lbl.textContent = '● ' + (PT_UZ[id] || '');
    }
    function pose(x) {
      var closed = x.lab === 'closed' || x.lab === 'bite';
      return {
        t: TONGUE[x.t] || TONGUE.rest,
        jaw: closed ? 0 : (x.t === 'throat' || x.t === 'low' ? 0.6 : (x.t === 'teeth' || x.t === 'heavyTH' ? 0.3 : 0.15)),
        lab: LIPS[x.lab] || LIPS.open,
        vel: x.air === 'nose' ? 1 : 0
      };
    }
    var VOW = { a: { jaw: 0.85, lab: LIPS.open }, i: { jaw: 0.35, lab: LIPS.spread }, u: { jaw: 0.35, lab: LIPS.round } };
    var api = {
      show: function (ch) {
        clear(); info = L[ch] || L['ب'];
        setPoint(info.p);
        air.setAttribute('d', AIR[info.air] || AIR.mouth);
        tween({ t: TONGUE.rest, jaw: 0.15, lab: LIPS.open, vel: 0 }, 300);
        svg.classList.add('mx-pt');
      },
      /* 0: joylash · 1: havo yo'li · 2: ovoz / ochilish · 3: unli bilan */
      step: function (i, vowel) {
        if (!info) return;
        clear(); svg.classList.add('mx-pt');
        var ps = pose(info);
        if (i === 0) { tween(ps, 650); return; }
        if (i === 1) {
          tween(ps, 200);
          air.setAttribute('d', AIR[info.air] || AIR.mouth);
          if (info.kind === 'stop') { at(10, function () { svg.classList.add('mx-flow'); }); }
          else svg.classList.add('mx-flow');
          if (info.kind === 'tap') svg.classList.add('mx-tap');
          if (info.v) svg.classList.add('mx-voice');
          return;
        }
        if (i === 2) {
          if (info.v) svg.classList.add('mx-voice');
          svg.classList.add('mx-burst', 'mx-flow');
          if (info.kind === 'tap') svg.classList.add('mx-tap');
          return;
        }
        var o = VOW[vowel || 'a'];
        svg.classList.add('mx-voice', 'mx-flow');
        air.setAttribute('d', AIR.mouth);
        tween({ t: TONGUE.rest, jaw: o.jaw, lab: o.lab, vel: 0 }, 380, function () {
          at(1000, function () { svg.classList.remove('mx-flow', 'mx-voice'); air.setAttribute('d', AIR[info.air] || AIR.mouth); tween(pose(info), 500); });
        });
      },
      /* Ketma-ketlik o'z taymerlarida: step() ichidagi clear() ularni o'chirib yubormasin */
      play: function (onStep, vowel) {
        var self = this; clear(); seq.forEach(clearTimeout); seq = [];
        svg.classList.add('mx-playing');
        [0, 1, 2, 3].forEach(function (s, k) {
          seq.push(setTimeout(function () { self.step(s, vowel); if (onStep) onStep(s); }, k * 1800));
        });
        seq.push(setTimeout(function () { svg.classList.remove('mx-playing'); if (onStep) onStep(-1); }, 4 * 1800 + 600));
      },
      /** ba / bi / bu: harf joyidan unliga o'tish */
      vowel: function (v) {
        if (!info) return; var self = this; clear(); svg.classList.add('mx-pt');
        tween(pose(info), 220, function () { self.step(3, v); });
      },
      stop: function () { clear(); seq.forEach(clearTimeout); seq = []; cancelAnimationFrame(raf); }
    };
    draw();
    return api;
  }

  A.Mahraj = { L: L, PT_UZ: PT_UZ, Stage: Stage, info: function (ch) { return L[ch] || null; } };
})(typeof window !== 'undefined' ? window : globalThis);
