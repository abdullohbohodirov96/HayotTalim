/* A0 — «Nabra» darsligi (1-kitob: o'qish va yozish) asosidagi boshlang'ich kurs.
   Brauzerda ham (A.Alifbo), serverda ham (server/shared.js) bir xil ishlaydi.

   Manba: «Nabra A0» darsligi (22 bo'lim) va «Vojibatiy» uy vazifa daftari.
   2 oylik reja — 8 hafta, haftada 3 dars, jami 24 dars (daftardagi rejadek).

   Har darsda bosqichlar:
     1. learn    — yodlash: kitobdagi harf / so'zlar, har birini bosib tinglash
     2. video    — diktor tushuntiradi va hamma harf/so'zni birma-bir o'qib beradi
     3. practice — tekshirish mashqlari (darhol to'g'ri/xato)
     4. test     — serverda baholanadi, kamida 60%
     5. hw       — uy vazifasi (daftardagi topshiriqlar + avtomatik savollar)
   KEYINGI DARS faqat oldingisi tugaganda ochiladi: test ≥ 60% va uy vazifasi
   topshirilgan (avtomatik qismi ≥ 60%). Ustoz darsni qo'lda ochib bera oladi.

   Test va uy vazifasi SERVERDA baholanadi: savollar brauzerga javobsiz beriladi,
   test savollari esa har urinishda serverdagi yashirin «seed» bilan aralashadi. */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};
  var PASS = 60;
  var TATWEEL = 'ـ';
  var F_ = 'َ', K_ = 'ِ', D_ = 'ُ', S_ = 'ْ', SH = 'ّ', FN = 'ً', KN = 'ٍ', DN = 'ٌ';

  /* ============ 1. HARFLAR (darslik, 1-bo'lim) ============
     name — o'zbekcha nomi (darslikdagidek), nameAr — arabcha nomi,
     place — chiqish joyi (maxraj), tip — talaffuz maslahati, nc — keyingi harfga ulanmaydi */
  var LETTERS = [
    { ch: 'ا', show: 'أ', name: 'Alif', nameAr: 'أَلِفٌ', say: 'أَلِف', place: 'Bo‘g‘izning pasti', tip: 'Nafasni bir lahza to‘xtatib, qo‘yib yuboring — «a». O‘zbekcha tutuq (’) kabi.', nc: true },
    { ch: 'ب', name: 'Ba', nameAr: 'بَاءٌ', say: 'بَاء', place: 'Lablar', tip: 'Lablar yumilib ochiladi — «b».' },
    { ch: 'ت', name: 'Ta', nameAr: 'تَاءٌ', say: 'تَاء', place: 'Til uchi · Old tishlar', tip: 'O‘zbekcha ingichka «t».' },
    { ch: 'ث', name: 'Sa', nameAr: 'ثَاءٌ', say: 'ثَاء', place: 'Til uchi · Old tishlar', tip: 'Til uchini tishlar orasidan chiqarib «s» deng. O‘zbekchada yo‘q!' },
    { ch: 'ج', name: 'Jim', nameAr: 'جِيمٌ', say: 'جِيم', place: 'Tilning o‘rtasi', tip: 'O‘zbekcha «jo‘ja»dagi «j».' },
    { ch: 'ح', name: 'Ha', nameAr: 'حَاءٌ', say: 'حَاء', place: 'Bo‘g‘izning o‘rtasi', tip: 'Bo‘g‘izni siqib, ovozsiz qattiq «h» — oynani nafas bilan terlatgandek. O‘zbekchada yo‘q!' },
    { ch: 'خ', name: 'Xo', nameAr: 'خَاءٌ', say: 'خَاء', place: 'Bo‘g‘izning yuqorisi', tip: 'O‘zbekcha «xona»dagi «x» bilan bir xil.' },
    { ch: 'د', name: 'Dal', nameAr: 'دَالٌ', say: 'دَال', place: 'Til uchi · Old tishlar', tip: 'O‘zbekcha ingichka «d».', nc: true },
    { ch: 'ذ', name: 'Zal', nameAr: 'ذَالٌ', say: 'ذَال', place: 'Til uchi · Old tishlar', tip: 'Til uchini tishlar orasidan chiqarib «z» deng. O‘zbekchada yo‘q!', nc: true },
    { ch: 'ر', name: 'Ro', nameAr: 'رَاءٌ', say: 'رَاء', place: 'Til uchi', tip: 'Til uchi bir marta titraydi. Fatha va damma bilan yo‘g‘on — «ro», «ru».', nc: true },
    { ch: 'ز', name: 'Zay', nameAr: 'زَايٌ', say: 'زَاي', place: 'Til uchi · Old tishlar', tip: 'O‘zbekcha «z».', nc: true },
    { ch: 'س', name: 'Sin', nameAr: 'سِينٌ', say: 'سِين', place: 'Til uchi · Old tishlar', tip: 'O‘zbekcha ingichka «s», hushtak kabi.' },
    { ch: 'ش', name: 'Shin', nameAr: 'شِينٌ', say: 'شِين', place: 'Tilning o‘rtasi', tip: 'O‘zbekcha «shahar»dagi «sh».' },
    { ch: 'ص', name: 'Sod', nameAr: 'صَادٌ', say: 'صَاد', place: 'Til uchi · Old tishlar', tip: 'Til orqasini ko‘tarib, og‘iz to‘lib «s» deng — yo‘g‘on «so».' },
    { ch: 'ض', name: 'Dod', nameAr: 'ضَادٌ', say: 'ضَاد', place: 'Tilning yon cheti', tip: 'Tilning yon chetini oziq tishlarga bosib, og‘iz to‘lib «d» deng. Yo‘g‘on harf.' },
    { ch: 'ط', name: 'To', nameAr: 'طَاءٌ', say: 'طَاء', place: 'Til uchi · Old tishlar', tip: 'Til orqasini ko‘tarib, og‘iz to‘lib «t» deng — yo‘g‘on «to».' },
    { ch: 'ظ', name: 'Zo', nameAr: 'ظَاءٌ', say: 'ظَاء', place: 'Til uchi · Old tishlar', tip: 'ذ kabi, lekin og‘iz to‘lib, yo‘g‘on — «zo».' },
    { ch: 'ع', name: 'Ayn', nameAr: 'عَيْنٌ', say: 'عَيْن', place: 'Bo‘g‘izning o‘rtasi', tip: 'Bo‘g‘iz o‘rtasini siqib, ovoz bilan «a» deng. O‘zbekchada yo‘q — tashlab ketmang!' },
    { ch: 'غ', name: 'G‘ayn', nameAr: 'غَيْنٌ', say: 'غَيْن', place: 'Bo‘g‘izning yuqorisi', tip: 'O‘zbekcha «g‘isht»dagi «g‘» bilan bir xil.' },
    { ch: 'ف', name: 'Fa', nameAr: 'فَاءٌ', say: 'فَاء', place: 'Lablar · Old tishlar', tip: 'Yuqori tishlar pastki labga tegadi — «f».' },
    { ch: 'ق', name: 'Qof', nameAr: 'قَافٌ', say: 'قَاف', place: 'Tilning eng orqasi', tip: 'O‘zbekcha «qalam»dagi «q». Chuqur, bo‘g‘izga yaqin.' },
    { ch: 'ك', name: 'Kaf', nameAr: 'كَافٌ', say: 'كَاف', place: 'Tilning orqasi', tip: 'O‘zbekcha «kitob»dagi ingichka «k». ق dan sal oldinda.' },
    { ch: 'ل', name: 'Lam', nameAr: 'لَامٌ', say: 'لَام', place: 'Tilning yon cheti · Til uchi', tip: 'O‘zbekcha «lola»dagi ingichka «l».' },
    { ch: 'م', name: 'Mim', nameAr: 'مِيمٌ', say: 'مِيم', place: 'Lablar', tip: 'Lablar yumiladi, ovoz burundan chiqadi — «m».' },
    { ch: 'ن', name: 'Nun', nameAr: 'نُونٌ', say: 'نُون', place: 'Til uchi', tip: 'O‘zbekcha «non»dagi «n».' },
    { ch: 'ه', name: 'Ha', nameAr: 'هَاءٌ', say: 'هَاء', place: 'Bo‘g‘izning pasti', tip: 'Ko‘krakdan yengil nafas chiqaring — «havo» so‘zidagi «h».' },
    { ch: 'و', name: 'Vov', nameAr: 'وَاوٌ', say: 'وَاو', place: 'Lablar', tip: 'Lablar dumaloqlanadi, tegmaydi — «v» (inglizcha w).', nc: true },
    { ch: 'ي', name: 'Ya', nameAr: 'يَاءٌ', say: 'يَاء', place: 'Tilning o‘rtasi', tip: 'O‘zbekcha «yo‘l»dagi «y».' }
  ];
  LETTERS.forEach(function (x, i) { x.i = i; x.n = i + 1; x.img = 'assets/a0/m' + (i < 10 ? '0' : '') + i + '.webp'; if (!x.show) x.show = x.ch; });
  function L(ch) { if (ch === 'أ' || ch === 'إ') ch = 'ا'; return LETTERS.filter(function (x) { return x.ch === ch; })[0]; }
  /** Bir xil nomli harflar (ح va ه — ikkalasi «Ha») farqlanib ko'rinsin */
  function nameOf(x) { return x.ch === 'ح' ? 'Ha (ح)' : x.ch === 'ه' ? 'Ha (ه)' : x.name; }

  /** Harfning to'rt shakli (darslik, 2-bo'lim). Alif boshida hamza bilan yoziladi. */
  function forms(x) {
    var c = x.ch === 'ا' ? 'أ' : x.ch;
    if (x.nc) return { alone: c, start: c, middle: null, end: TATWEEL + c };
    return { alone: c, start: c + TATWEEL, middle: TATWEEL + c + TATWEEL, end: TATWEEL + c };
  }
  /** Harf + harakat (darslik 3, 5, 6 va 15-bo'limlar). Alif o'rnida hamza. */
  function withMark(x, mark) {
    var c = x.ch;
    if (c === 'ا') c = mark === K_ || mark === KN ? 'إ' : 'أ';
    if (mark === FN) return c + FN + (c === 'أ' ? '' : 'ا');   /* fathatan: بًا */
    return c + mark;
  }
  var ALL = LETTERS.map(function (x) { return x.ch; });

  /* ============ 2. O'QILISHI (lotincha) ============
     Daftardagi yozuvga mos: yo'g'on harflar (ر خ ص ض ط ظ غ ق) fatha bilan «o»:
     رَسَمَ — rosama, طَالِبُ — toolibu; cho'ziq unli ikki harf: كَاتِبُ — kaatibu;
     ع va hamza — «'»: عِمَادُ — 'imaadu; shadda — ikki marta: صَبَّحَ — sobbaha.   */
  var LAT = { 'ب': 'b', 'ت': 't', 'ث': 's', 'ج': 'j', 'ح': 'h', 'خ': 'x', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
    'ط': 't', 'ظ': 'z', 'ع': '\'', 'غ': 'g‘', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'v', 'ي': 'y',
    'ء': '\'', 'أ': '\'', 'إ': '\'', 'ؤ': '\'', 'ئ': '\'', 'ة': 't', 'ا': '' };
  var HEAVY = 'رخصضطظغق';
  var SUN = 'تثدذرزسشصضطظلن';
  var MARKS = /[ً-ْٰ]/;
  function translit(word) {
    var w = String(word || '').replace(/ـ/g, '').trim();
    var out = '', i = 0, n = w.length, sunAl = false;
    /* «Al» */
    if (w.charAt(0) === 'ا' && w.charAt(1) === 'ل') {
      var nx = w.charAt(2) === S_ ? 3 : 2;
      var c3 = w.charAt(nx);
      if (SUN.indexOf(c3) >= 0 && w.indexOf(SH, nx) === nx + 1 || SUN.indexOf(c3) >= 0 && w.charAt(nx + 2) === SH) {
        out = 'a'; i = nx; sunAl = true;
      } else { out = 'al-'; i = nx; }
    }
    var prevVowel = '';
    while (i < n) {
      var c = w.charAt(i); i++;
      if (MARKS.test(c)) continue;
      if (c === ' ') { out += ' '; prevVowel = ''; continue; }
      /* keyingi belgilar (harakatlar) */
      var marks = '';
      while (i < n && MARKS.test(w.charAt(i))) { marks += w.charAt(i); i++; }
      var heavy = HEAVY.indexOf(c) >= 0;
      /* cho'ziq unli: harakatsiz ا / و / ي / ى */
      if (!marks || marks === '') {
        if ((c === 'ا' || c === 'ى') && prevVowel === 'a') { out += out.slice(-1) === 'o' ? 'o' : 'a'; prevVowel = 'aa'; continue; }
        if (c === 'و' && prevVowel === 'u') { out += 'u'; prevVowel = 'uu'; continue; }
        if (c === 'ي' && prevVowel === 'i') { out += 'i'; prevVowel = 'ii'; continue; }
        if (c === 'ا') { continue; }              /* tanvin alifi (بًا) */
      }
      if (c === 'ى') { out += 'aa'; prevVowel = 'aa'; continue; }
      var cons = LAT[c] != null ? LAT[c] : '';
      if (c === 'ة' && (marks.indexOf(S_) >= 0 || !marks)) cons = 'h';
      if (marks.indexOf(SH) >= 0) cons = sunAl ? cons + '-' + cons : cons + cons;
      sunAl = false;
      var v = '';
      if (marks.indexOf(F_) >= 0) v = heavy ? 'o' : 'a';
      else if (marks.indexOf(K_) >= 0) v = 'i';
      else if (marks.indexOf(D_) >= 0) v = 'u';
      else if (marks.indexOf(FN) >= 0) v = heavy ? 'on' : 'an';
      else if (marks.indexOf(KN) >= 0) v = 'in';
      else if (marks.indexOf(DN) >= 0) v = 'un';
      else if (marks.indexOf('ٰ') >= 0) v = 'aa';
      out += cons + v;
      prevVowel = v === 'o' ? 'a' : v.charAt(0) && v.length === 1 ? v : '';
    }
    return out.replace(/^'/, '\'');
  }

  /* ============ 3. KITOB MAZMUNI (bo'limlar) ============ */
  function W(s) { return String(s).trim().split(/\s+/); }
  var B = {
    /* 4-bo'lim: Mashqlar (fatha) — 84 so'z */
    s4: W('دَرَسَ دَرَجَ رَزَقَ رَزَمَ رَدَفَ رَدَمَ زَرَعَ زَرَدَ وَزَنَ وَدَعَ رَأَفَ وَرَدَ دَأَبَ أَكَلَ رَكَلَ وَكَلَ رَفَعَ ذَبَحَ دَبَغَ وَكَلَ ' +
      'بَرَدَ جَرَدَ بَرَزَ بَرَعَ نَدَبَ نَزَلَ نَذَرَ جَرَحَ خَرَجَ حَرَثَ حَذَفَ جَزَمَ خَدَمَ خَذَلَ خَزَنَ صَدَقَ سَرَقَ شَرَحَ طَرَحَ صَدَمَ ' +
      'فَرَشَ فَرَمَ طَرَقَ فَرَضَ رَجَعَ ذَهَبَ ذَهَلَ رَسَمَ وَسَمَ سَجَدَ طَحَنَ هَجَرَ فَجَرَ حَضَرَ هَجَمَ نَصَرَ حَضَرَ نَضَجَ نَطَحَ نَصَحَ ' +
      'نَطَقَ حَمَلَ جَمَعَ شَكَرَ خَلَطَ حَلَبَ جَلَسَ جَسَرَ شَغَلَ عَبَسَ بَصَقَ ظَهَرَ نَهَشَ نَهَبَ قَعَدَ بَعَثَ طَعَنَ عَبَدَ كَشَفَ بَسَرَ نَهَزَ قَفَلَ لَكَمَ لَفَتَ'),
    /* 5-bo'lim: damma bilan so'zlar */
    s5: W('كَبُرَ شَرُفَ عَظُمَ صَغُرَ حَلُمَ صَعُبَ سَهُلَ ثَقُلَ حَزُنَ ظَرُفَ حَسُنَ قَرُبَ يَسَعُ يَدَعُ يَقَعُ يَضَعُ'),
    /* 7-bo'lim: Mashq (fatha, kasra, damma aralash) */
    s7: W('عَلِمَ فَهِمَ جَهِلَ رَغِبَ فَزِعَ نَشِطَ ظَفِرَ عَجِبَ بَخِلَ صَحِبَ حَسِبَ حَمِدَ عَطِشَ شَرِبَ صَعِدَ رَحِمَ خُبِزَ سُرِقَ دُهِشَ جُرِحَ ' +
      'دُهِنَ سُمِعَ عُرِفَ ظُلِمَ فُسِخَ قُتِلَ ضُبِطَ كُتِبَ عُبِرَ عُقِرَ بُطِشَ قُبِضَ أُكِلَ شُرِبَ وُكِزَ كُسِرَ غُرِفَ حُمِلَ مُدِحَ شُفِعَ'),
    s8p: [['بَتَ', 'بَاتَ'], ['تَبَ', 'تَابَ'], ['سَدَ', 'سَادَ'], ['قَلَ', 'قَالَ'], ['صَدَ', 'صَادَ'], ['دَرَ', 'دَارَ']],
    s8: W('بَاتِرُ شَاكِرُ عَامِرُ بَاسِلُ صَاحِبُ طَالِبُ فَاشِلُ ثَابِتُ كَاتِبُ سَائِلُ ضَاغِطُ عَاشِقُ سَالِمُ شَافِعُ حَاقِدُ كَاشِحُ ' +
      'كِتَابُ عِقَالُ عِمَادُ عِبَادُ ثِقَالُ فِرَاشُ مَلَاذُ مَزَادُ فَرَاشَاتُ مِسَاحَاتُ عَلَامَاتُ مَطَارَاتُ سَلَامَاتُ مَزَادَاتُ عَقَارَاتُ كِتَابَاتُ'),
    s9p: [['فِلُ', 'فِيلُ'], ['عِدُ', 'عِيدُ'], ['مِلُ', 'مِيلُ'], ['كِلُ', 'كِيلُ']],
    s9: W('رَحِيمُ حَكِيمُ كَرِيمُ سَلِيمُ شَرِيفُ حَبِيبُ رَفِيعُ عَقِيمُ عَبِيرُ صَغِيرُ كَبِيرُ فَقِيدُ شَهِيدُ فَضِيلُ بَشِيرُ ثَقِيلُ'),
    s10: W('غَفُورُ شَكُورُ حَقُودُ ظَلُومُ رَءُوفُ فُحُولُ بُرُوجُ غُيُومُ'),
    s10m: W('عَقَاقِيرُ مَنَاشِيرُ مَصَابِيحُ فَارُوقُ شَرِيفَاتُ عَقِيمَاتُ تَعَالِيمُ مَلَاعِينُ عَوَاصِمُ عَرِيقَاتُ صَالِحِينَ فَاسِدُونَ ' +
      'عَالِمَاتُ صَابِرُونَ حَاشِرِينَ رَافِعُونَ مُنِيبِينَ صَابِرَاتُ حَامِدَاتُ رَاسِخُونَ شَامِتُونَ عَاكِفِينَ بَاهِرَاتُ سَابِحَاتُ'),
    s11p: [['بَتَ', 'بَتْ'], ['شَدَ', 'شَدْ']],
    s11a: W('تَبْ حَكْ كَلْ بَلْ شَقْ حَقْ'),
    s11: W('حَمْدُ عَقْلُ وَرْدُ شَكْلُ فَهْدُ قَلْبُ شَوْكُ وَحْشُ دَأْبُ قَبْرُ بَيْتُ حِجْرُ فَصْلُ فَضْلُ بَخْسُ جُزْءُ هَدْمُ بَتْرُ بَدْرُ عَزْمُ ' +
      'حَسْبُ حَشْرُ لَطْمُ عَظْمُ بَعْثُ رَغْمُ لَفْتُ ظُلْمُ'),
    s12: W('مَشْهُورُ فِرْعَوْنُ مِفْتَاحُ مُشْتَاقُ تِمْسَاحُ عُصْفُورُ مَعْشُوقُ سُبْحَانُ مَعْقُودُ مَنْشُورُ مِسْوَاكُ مَفْتُوحُ مَوْعِدُ مَخْبَأُ عِفْرِيتُ مَتْرُوكُ ' +
      'مَحْبُوسُ مَشْرُوبُ حُلْقُومُ مَحْفُورُ مَسْتُورُ كِبْرِيتُ مُشْرِقُ مَسْبَحُ مَشْعَلُ مَبْحُوحُ مَحْكُومُ مَسْكُونُ مَشْكُورُ مَكْتُوبُ خِنْزِيرُ مَحْلُوبُ ' +
      'حَمْدُونُ مَجْبُورُ مَهْزُومُ عَبْدُونُ'),
    s13a: W('عَلَّ كَرَّ حُبُّ شَبَّ طَلَّ'),
    s13: W('صَبَّحَ عَلَّمَ طَوَّرَ بَيَّتَ كَسَّرَ بَشَّرَ حَنَّطَ عَبَّرَ رَتَّبَ عَثَّرَ رَجَّلَ كَحَّلَ بَخَّرَ بَدَّرَ عَذَّبَ فَرَّقَ وَزَّعَ بَصَّرَ بَضَّعَ لَطَّفَ ' +
      'عَظَّمَ شَعَّبَ رَغَّبَ عَفَّرَ لَقَّبَ حَكَّمَ عَمَّرَ بَهَّرَ'),
    s14: W('مُسَلَّمَاتُ مُكْفَهِرُّونَ مُتَكَوِّرَاتُ عَرَّافَاتُ مُكَرِّمُونَ مُتَخَصِّصُونَ مُتَكَثِّرَاتُ مُتَسَلِّحَاتُ مُتَكَلِّمُونَ عَبْقَرِيٌّ بَرَّاقَاتُ مُسْتَقِلُّونَ ' +
      'مُتَقَدِّمُونَ مُتَكَبِّرِينَ شَوَّافِينَ تُفَّاحُ سَفَّاكُونَ حَلَّاقِينَ فَلَّاحِينَ عُمَّالُ سَجَّادُ غَوَّاصُ نَوَّارُ عَقَّارُ بَسَّامُ فَوَّازُ خَبَّازُ'),
    s15r: ['التَّنْوِينُ يَكُونُ فِي آخِرِ الْكَلِمَةِ فَقَطْ.', 'التَّنْوِينُ لِلْأَسْمَاءِ وَلَيْسَ لِلْأَفْعَالِ.', 'الْكَلِمَةُ الَّتِي فِيهَا تَنْوِينٌ لَا يَكُونُ فِيهَا (ال).'],
    s15rUz: ['Tanvin faqat so‘zning oxirida keladi.', 'Tanvin otlarda bo‘ladi, fe’llarda bo‘lmaydi.', 'Tanvinli so‘zda «ال» bo‘lmaydi.'],
    s16: W('مَخْبَأً مَلْعَبٌ بَيْتٍ غَيْثًا خُرُوجًا جُرْحٌ خُوجٍ مُبَرِّدًا جِرْذٌ مُدِيرٍ عَزِيزًا دَرْسٌ عَيْشٍ لِصًّا قُرْطًا غَيْظٌ شُعَاعٍ بُزُوغٌ عَفَافًا لَائِقٍ ' +
      'مُشَارِكٌ بَيْضٌ ذَيْلًا عَقِيمٍ حَنُونًا أَشْبَاهٌ قَبْوٍ مِصْرِيٌّ'),
    qamar: W('أ ب ح ج خ ع غ ف ق ك م ه و ي'),
    shams: W('ت ث د ذ ر ز س ش ص ض ط ظ ل ن'),
    s17q: W('الْأَرْنَبُ الْبَيْتُ الْحِصَانُ الْجَمَلُ الْخَرُوفُ الْعِلْمُ الْغُرَابُ الْفِيلُ الْقَلْبُ الْكِتَابُ الْمُدَرِّسُ الْهُدْهُدُ الْوَرْدُ الْيَاقُوتُ'),
    s17s: W('التَّمْرُ الثَّعْلَبُ الدَّرْسُ الذَّيْلُ الرَّجُلُ الزَّيْتُ السَّقْفُ الشَّهْدُ الصَّبْرُ الضَّرَّاءُ الطَّرِيقُ الظِّلُّ اللَّيْمُونُ النُّورُ'),
    s18: W('الْجُنْدِيُّ الْكُرْسِيُّ الْعُصْفُورُ الْقِنْدِيلُ الْمَكْتُوبُ الْجُمْهُورُ الْمِنْدِيلُ الْمَشْرُوبُ الْمِصْرِيُّ الْبَحْرِيُّ الْعَرَبِيُّ الْيَمَنِيُّ ' +
      'الْهِنْدِيُّ الْخَلِيجِيُّ الْمَغْرِبِيُّ الْمَنْشُورُ الصُّنْدُوقُ السِّكِّينُ الطُّنْبُورُ التِّنِّينُ الشُّرْطِيُّ الزُّنْبُورُ الطُّرْبُوشُ الدُّلْفِينُ ' +
      'التِّلْمِيذُ الزَّيْتُونُ الثَّرِيُّ الذَّكِيُّ النَّبِيُّ الصَّبِيُّ الشِّرِّيرُ الدِّينِيُّ السَّخِيُّ الصَّعِيدِيُّ'),
    s19p: [['مُعَلِّم', 'مُعَلِّمَة'], ['مُدَرِّس', 'مُدَرِّسَة'], ['طَبِيب', 'طَبِيبَة'], ['مُهَنْدِس', 'مُهَنْدِسَة'], ['طَالِب', 'طَالِبَة'], ['مُدِير', 'مُدِيرَة'],
      ['أُوزْبَكِيّ', 'أُوزْبَكِيَّة'], ['مِصْرِيّ', 'مِصْرِيَّة'], ['فَرَنْسِيّ', 'فَرَنْسِيَّة']],
    s19: W('كُرَةُ مَدْرَسَةَ مَكْتَبَةِ مَسْرَحِيَّةُ مِحْفَظَةُ صِنَاعِيَّةَ حَوْلِيَّةِ كَلَامِيَّةُ خَبِيرَةُ جَبِيرَةَ سَمِيرَةِ رَشِيدَةُ فَرِيدَةُ بَهِيجَةَ بَهِيرَةَ عَظِيمَةِ'),
    s19w: W('مِقْلَمَةْ مِكْنَسَةْ غَسَّالَةْ مِسْطَرَةْ صَابِرَةْ عَالِمَةْ عَابِدَةْ صَالِحَةْ مُنِيرَةْ كَرِيمَةْ كَبِيرَةْ صَغِيرَةْ طَوِيلَةْ نَحِيفَةْ سَمِينَةْ نَحِيلَةْ عَظِيمَةْ شَاكِرَةْ بَارِدَةْ سَاخِنَةْ'),
    s20a: W('يَأْكُلُ مَأْكُولٌ رَأْسٌ بِئْرٌ ذِئْبٌ مِئْزَرٌ مُؤْمِنٌ لُؤْلُؤٌ مُؤْلِمٌ'),
    s20b: W('مَسْؤُولٌ مَسْأَلَةٌ يَسْأَلُ سُئِلَ رُؤُوسٌ فُؤَادٌ سُؤَالٌ رَئِيسٌ لَئِيمٌ يَئِسَ تَفَاؤُلٌ مَسْؤُولِيَّةٌ فِئَةٌ مِئَةٌ رِئَةٌ'),
    s21: W('إِلَى عَلَى سَعَى هَدَى يَسْعَى يَرْضَى مَشْفَى مَرْسَى'),
    texts: [
      { t: 'الْفِقْرَةُ الْأُولَى', ar: 'ذَهَبَ فُؤَادٌ إِلَى الْمَدْرَسَةِ فِي الصَّبَاحِ. وَسَأَلَهُ الْمُعَلِّمُ عَنْ مَسْأَلَةٍ صَعْبَةٍ، فَأَجَابَ بِصَوْتٍ وَاضِحٍ. ثُمَّ جَاءَ مُدِيرُ الْمَدْرَسَةِ وَقَالَ: أَنْتَ تِلْمِيذٌ مُؤَدَّبٌ وَمَسْؤُولٌ.',
        uz: 'Fuod ertalab maktabga bordi. Muallim undan qiyin masala haqida so‘radi, u aniq ovoz bilan javob berdi. So‘ng maktab direktori kelib dedi: «Sen odobli va mas’uliyatli o‘quvchisan».' },
      { t: 'الْفِقْرَةُ الثَّانِيَةُ', ar: 'سَأَلَ شَادِي الْمُعَلِّمَ عَنْ مَسْأَلَةٍ صَعْبَةٍ، فَابْتَسَمَ الْمُعَلِّمُ وَشَرَحَ الْجَوَابَ بِهُدُوءٍ، ثُمَّ فَهِمَ الطَّالِبُ الْفِكْرَةَ وَشَكَرَ مُعَلِّمَهُ.',
        uz: 'Shodiy muallimdan qiyin masala haqida so‘radi. Muallim jilmayib, javobni xotirjam tushuntirdi. So‘ng talaba fikrni tushundi va muallimiga rahmat aytdi.' },
      { t: 'الْفِقْرَةُ الثَّالِثَةُ', ar: 'رَأَى الرَّاعِي ذِئْبًا قُرْبَ بِئْرٍ فِي الْقَرْيَةِ، فَصَاحَ بِصَوْتٍ عَالٍ وَجَمَعَ الْغَنَمَ، وَحَمَى الْأَطْفَالَ مِنَ الْخَطَرِ الْكَبِيرِ.',
        uz: 'Cho‘pon qishloqdagi quduq yonida bo‘rini ko‘rdi. U baland ovozda qichqirib, qo‘ylarni yig‘di va bolalarni katta xavfdan himoya qildi.' },
      { t: 'الْفِقْرَةُ الرَّابِعَةُ', ar: 'يَأْكُلُ الْوَلَدُ الْخُبْزَ مَعَ الزَّيْتِ وَالتِّينِ، ثُمَّ يَشْرَبُ كَأْسًا مِنَ اللَّبَنِ الْبَارِدِ، وَيَحْمَدُ اللّٰهَ عَلَى النِّعْمَةِ الْعَظِيمَةِ.',
        uz: 'Bola nonni zaytun yog‘i va anjir bilan yeydi, so‘ng bir stakan sovuq sut ichadi va buyuk ne’mat uchun Allohga hamd aytadi.' },
      { t: 'الْفِقْرَةُ الْخَامِسَةُ', ar: 'جَاءَتْ سَارَةُ إِلَى الْمَكْتَبَةِ الْقَدِيمَةِ، وَسَأَلَتِ الْمُوَظَّفَةَ عَنْ كِتَابٍ فِي التَّارِيخِ، فَأَعْطَتْهَا الْمَسْؤُولَةُ كِتَابًا جَمِيلًا.',
        uz: 'Sora eski kutubxonaga keldi va xodimadan tarix haqidagi kitobni so‘radi. Mas’ul xodima unga chiroyli kitob berdi.' },
      { t: 'الْفِقْرَةُ السَّادِسَةُ', ar: 'يَسْتَيْقِظُ الْفَلَّاحُ فِي الصَّبَاحِ الْبَاكِرِ، وَيَسْقِي الشَّجَرَةَ وَيَرْعَى الْأَغْنَامَ فِي الْحَقْلِ، وَيَتَفَاءَلُ بِيَوْمٍ مُبَارَكٍ جَمِيلٍ.',
        uz: 'Dehqon erta tongda uyg‘onadi, daraxtni sug‘oradi, dalada qo‘ylarni boqadi va muborak, go‘zal kunga umid bilan qaraydi.' },
      { t: 'الْفِقْرَةُ السَّابِعَةُ', ar: 'اشْتَرَى الرَّجُلُ لُؤْلُؤًا مِنَ السُّوقِ الْكَبِيرِ، وَقَالَ لِزَوْجَتِهِ: هٰذِهِ هَدِيَّةٌ غَالِيَةٌ، فَفَرِحَتِ الزَّوْجَةُ وَشَكَرَتْهُ كَثِيرًا.',
        uz: 'Erkak katta bozordan marvarid sotib oldi va xotiniga: «Bu qimmatbaho sovg‘a», dedi. Xotini xursand bo‘lib, unga ko‘p rahmat aytdi.' },
      { t: 'الْفِقْرَةُ الثَّامِنَةُ', ar: 'كَانَ الْجُنْدِيُّ يَحْرُسُ الْمَدِينَةَ لَيْلًا، وَلَمْ يَيْأَسْ مِنَ التَّعَبِ وَالسَّهَرِ الطَّوِيلِ، فَشَكَرَهُ النَّاسُ عَلَى الْخِدْمَةِ الْعَظِيمَةِ.',
        uz: 'Askar kechasi shaharni qo‘riqlardi. U charchoq va uzoq bedorlikdan tushkunlikka tushmadi. Odamlar unga buyuk xizmati uchun rahmat aytishdi.' }
    ]
  };
  function lettersMarked(mark) { return LETTERS.map(function (x) { return withMark(x, mark); }); }

  /* ============ 4. DARSLAR — 2 oylik reja (daftar, 3-bet) ============
     blocks — darsda ko'rsatiladigan qismlar (kitob tartibida):
       letters {list}        — harf kartochkasi: rasm (maxraj), nomi, maslahat
       forms   {list}        — so'z boshida / o'rtasida / oxirida
       grid    {items, big}  — o'qiladigan harf / so'zlar
       pairs   {items}       — qisqa → cho'ziq (madd, sukun, toi marbuta)
       sets                  — qamariy / shamsiy harflar
       rule    {ar?, uz}     — qoida (darslik va daftardagi «Eslatma»)
       text    {t, ar, uz}   — o'qish uchun matn
     intro — video boshidagi diktor so'zi (o'zbekcha, ElevenLabs).            */
  function letterRange(a, b) { return ALL.slice(a, b); }
  var LESSONS = [
    { n: 1, week: 1, book: 1, title: 'Alifbo: Alif — Xo', titleAr: 'أ ب ت ث ج ح خ', kind: 'letters', letters: letterRange(0, 7),
      intro: 'Assalomu alaykum! Bugundan boshlab sizlar bilan birga arab tilini o‘rganishni boshlaymiz. Birinchi darsimiz — arab alifbosi. Arab tilida yigirma sakkizta harf bor, ular o‘ngdan chapga yoziladi. Bugun dastlabki yettita harfni o‘rganamiz: alif, ba, ta, sa, jim, ha va xo. Har bir harfning rasmida tovush qayerdan chiqishi qizil rang bilan ko‘rsatilgan. Diqqat bilan tinglang va har bir harfni ovoz chiqarib takrorlang.',
      rule: 'Nuqtalar soni va joyi harflarni farqlaydi: ب — bitta nuqta pastda, ت — ikkita nuqta tepada, ث — uchta nuqta tepada. ج ح خ ham bir shakl: nuqta ichida, nuqtasiz, nuqta ustida.' },
    { n: 2, week: 1, book: 1, title: 'Alifbo: Dal — Dod', titleAr: 'د ذ ر ز س ش ص ض', kind: 'letters', letters: letterRange(7, 15),
      intro: 'Assalomu alaykum! Ikkinchi darsimizga xush kelibsiz. O‘tgan darsda yettita harfni o‘rgandik. Bugun yana sakkizta harf: dal, zal, ro, zay, sin, shin, sod va dod. Bu harflar juft-juft keladi: dal va zal, ro va zay, sin va shin, sod va dod. Ikkinchisining farqi faqat nuqtasida. Sod va dod — yo‘g‘on harflar, ularni og‘iz to‘lib aytamiz.',
      rule: 'Juft harflar: د — ذ, ر — ز, س — ش, ص — ض. Ikkinchisining farqi — faqat nuqtasida.' },
    { n: 3, week: 1, book: 1, title: 'Alifbo: To — Kaf', titleAr: 'ط ظ ع غ ف ق ك', kind: 'letters', letters: letterRange(15, 22),
      intro: 'Assalomu alaykum! Uchinchi darsimizni boshlaymiz. Bugun yettita harf: to, zo, ayn, g‘ayn, fa, qof va kaf. To va zo — yo‘g‘on harflar. Ayn harfi o‘zbek tilida yo‘q, uni bo‘g‘iz o‘rtasini siqib aytamiz — tashlab ketmang. Fa harfida bitta nuqta, qof harfida ikkita nuqta bor.',
      rule: 'ف — bitta nuqta, ق — ikkita nuqta. ع va غ ning boshi ochiq, dumi chiziqdan pastga tushadi.' },
    { n: 4, week: 2, book: 1, title: 'Alifbo: Lam — Ya va butun alifbo', titleAr: 'ل م ن ه و ي', kind: 'letters', letters: letterRange(22, 28), alphabet: true,
      intro: 'Assalomu alaykum! To‘rtinchi darsimizda alifboning oxirgi oltita harfini o‘rganamiz: lam, mim, nun, ha, vov va ya. Shu bilan yigirma sakkizta harfning hammasini bilib olasiz. Dars oxirida butun alifboni tartib bilan birga takrorlaymiz. Uni yoddan aytishga harakat qiling.',
      rule: '28 ta harfni tartib bilan yoddan aytishga harakat qiling.' },
    { n: 5, week: 2, book: 2, title: 'Harf shakllari: Ba — Xo', titleAr: 'أَشْكَالُ الْحُرُوفِ', kind: 'forms', letters: letterRange(0, 7),
      intro: 'Assalomu alaykum! Beshinchi darsga xush kelibsiz. Arab tilida harflar so‘z ichida bir-biriga ulanib yoziladi, shuning uchun har bir harfning bir nechta shakli bor: so‘z boshida, so‘z o‘rtasida va so‘z oxirida. Bugun alif, ba, ta, sa, jim, ha va xo harflarining shakllarini o‘rganamiz.',
      rule: 'Harf so‘z boshida — boshi, o‘rtasida — ikki tomondan ulanadi, oxirida — dumi bilan tugaydi.' },
    { n: 6, week: 2, book: 2, title: 'Harf shakllari: Sin — G‘ayn', titleAr: 'أَشْكَالُ الْحُرُوفِ', kind: 'forms', letters: letterRange(11, 19),
      intro: 'Assalomu alaykum! Oltinchi darsda sin, shin, sod, dod, to, zo, ayn va g‘ayn harflarining so‘z ichidagi shakllarini o‘rganamiz. E’tibor bering: ayn va g‘ayn so‘z o‘rtasida kichrayib, yopiq ko‘rinishga keladi.',
      rule: 'ع va غ ning o‘rtadagi shakli kichrayib, yopiq ko‘rinishga keladi: ـعـ.' },
    { n: 7, week: 3, book: 2, title: 'Harf shakllari: Fa — Ya va ulanmaydigan 6 harf', titleAr: 'أَشْكَالُ الْحُرُوفِ', kind: 'forms', letters: letterRange(19, 28), extraNc: true,
      intro: 'Assalomu alaykum! Yettinchi darsda fa harfidan ya harfigacha bo‘lgan harflarning shakllarini o‘rganamiz. Yana bir muhim qoida: alif, dal, zal, ro, zay va vov — bu olti harf o‘zidan keyingi harfga ulanmaydi. Shuning uchun ularning faqat ikkita shakli bor.',
      rule: 'Diqqat: bu 6 ta harf (أ و د ذ ر ز) o‘zidan keyingi harfga ulanmaydi. Shuning uchun ularning faqat ikki shakli bor: so‘z boshida yoki alohida — د, oldingi harfga ulanib kelganda — ـد. Keyingi harf esa yangidan boshlanadi: دَار، وَرْد.' },
    { n: 8, week: 3, book: 3, title: 'Fatha («a»)', titleAr: 'حُرُوفُ الْهِجَاءِ بِالْفَتْحَةِ', kind: 'harakat', mark: F_,
      intro: 'Assalomu alaykum! Sakkizinchi darsimizda birinchi harakat — fatha bilan tanishamiz. Fatha — harf ustidagi kichik qiya chiziq. U harfni «a» bilan o‘qitadi: ba, ta, sa. Endi barcha harflarni fatha bilan birga o‘qib chiqamiz. Har birini ovoz chiqarib takrorlang.',
      rule: 'Fatha — harf ustidagi kichik qiya chiziq. U harfni «a» bilan o‘qitadi: بَ — ba. Yo‘g‘on harflar (خ ص ض ط ظ غ ق ر) fatha bilan «o»ga yaqin o‘qiladi: صَ — so, طَ — to.' },
    { n: 9, week: 3, book: 4, title: 'Fatha bilan mashqlar', titleAr: 'تَدْرِيبَاتٌ', kind: 'words', words: B.s4,
      intro: 'Assalomu alaykum! To‘qqizinchi darsda fatha bilan so‘zlar o‘qiymiz. Uch harfli so‘z — uchta bo‘g‘in: da, ra, sa — darasa. Har bir so‘zni bo‘g‘inlab, keyin birga o‘qing. Kitobdagi sakson to‘rtta so‘zning hammasini birma-bir eshitasiz.',
      rule: 'Uch harfli so‘z — uchta bo‘g‘in: دَرَسَ = دَ + رَ + سَ.' },
    { n: 10, week: 4, book: 5, title: 'Damma («u»)', titleAr: 'حُرُوفُ الْهِجَاءِ بِالضَّمَّةِ', kind: 'harakat', mark: D_, words: B.s5,
      intro: 'Assalomu alaykum! O‘ninchi darsda ikkinchi harakat — damma bilan tanishamiz. Damma — harf ustidagi kichik vov shaklidagi belgi. U harfni «u» bilan o‘qitadi: bu, tu, su. Avval barcha harflarni damma bilan, keyin damma qatnashgan so‘zlarni o‘qiymiz.',
      rule: 'Damma — harf ustidagi kichik «و» shaklidagi belgi. U harfni «u» bilan o‘qitadi: بُ — bu.' },
    { n: 11, week: 4, book: 6, title: 'Kasra («i»)', titleAr: 'حُرُوفُ الْهِجَاءِ بِالْكَسْرَةِ', kind: 'harakat', mark: K_,
      intro: 'Assalomu alaykum! O‘n birinchi darsda uchinchi harakat — kasra bilan tanishamiz. Kasra — harf ostidagi kichik qiya chiziq. U harfni «i» bilan o‘qitadi: bi, ti, si. Barcha harflarni kasra bilan o‘qib chiqamiz.',
      rule: 'Kasra — harf ostidagi kichik qiya chiziq. U harfni «i» bilan o‘qitadi: بِ — bi.' },
    { n: 12, week: 4, book: 7, title: 'Fatha, damma, kasra — aralash', titleAr: 'تَدْرِيبٌ', kind: 'words', words: B.s7,
      intro: 'Assalomu alaykum! O‘n ikkinchi darsda uchala qisqa harakatni aralash o‘qiymiz: fatha — «a», damma — «u», kasra — «i». Har bir harfning harakatiga qarab o‘qing. Kitobdagi qirqta so‘zni birma-bir eshitasiz.',
      rule: 'Uchta qisqa harakat: ـَ a · ـُ u · ـِ i. Har bir harfning harakatiga qarab o‘qing.' },
    { n: 13, week: 5, book: 8, title: 'Alif maddi («aa»)', titleAr: 'مَدُّ الْأَلِفِ', kind: 'words', pairs: B.s8p, words: B.s8, madd: 'ا',
      intro: 'Assalomu alaykum! O‘n uchinchi darsda maddni — ya’ni cho‘zishni o‘rganamiz. Fathadan keyin alif kelsa, ovoz ikki barobar cho‘ziladi: ba — baa. Avval qisqa va cho‘ziq juftliklarni, keyin so‘zlarni o‘qiymiz.',
      rule: 'Fathadan keyin kelgan ا ovozni ikki barobar cho‘zadi: بَ — ba, بَا — baa.' },
    { n: 14, week: 5, book: 9, title: 'Yo maddi («ii»)', titleAr: 'مَدُّ الْيَاءِ', kind: 'words', pairs: B.s9p, words: B.s9, madd: 'ي',
      intro: 'Assalomu alaykum! O‘n to‘rtinchi darsda yo maddini o‘rganamiz. Kasradan keyin ya harfi kelsa, ovoz cho‘ziladi: bi — bii. Masalan, fil — fiil. Qisqa va cho‘ziq juftliklarni, so‘ng so‘zlarni tinglang.',
      rule: 'Kasradan keyin kelgan ي ovozni cho‘zadi: بِ — bi, بِي — bii.' },
    { n: 15, week: 5, book: 10, title: 'Vov maddi («uu»)', titleAr: 'مَدُّ الْوَاوِ', kind: 'words', words: B.s10, words2: B.s10m, madd: 'و',
      intro: 'Assalomu alaykum! O‘n beshinchi darsda vov maddini o‘rganamiz. Dammadan keyin vov kelsa, ovoz cho‘ziladi: bu — buu. Endi uchala madd ham bizda bor: alif, ya va vov. Dars oxirida uchala madd aralash keladigan so‘zlarni o‘qiymiz.',
      rule: 'Dammadan keyin kelgan و ovozni cho‘zadi: بُ — bu, بُو — buu. Endi uchala madd ham bor: ا · ي · و.' },
    { n: 16, week: 6, book: 11, title: 'Sukun (unlisiz harf)', titleAr: 'السُّكُونُ', kind: 'words', pairs: B.s11p, words0: B.s11a, words: B.s11,
      intro: 'Assalomu alaykum! O‘n oltinchi darsda sukunni o‘rganamiz. Sukun — harf ustidagi kichik doiracha. Bunday harf unlisiz o‘qiladi va oldingi bo‘g‘inga qo‘shiladi: qal, bat, shad. Avval qisqa misollarni, keyin so‘zlarni o‘qiymiz.',
      rule: 'Sukun — harf ustidagi kichik doiracha. Bunday harf unlisiz o‘qiladi va oldingi bo‘g‘inga qo‘shiladi: قَلْ — qal.' },
    { n: 17, week: 6, book: 12, title: 'Sukun bilan mashqlar', titleAr: 'تَدْرِيبَاتٌ', kind: 'words', words: B.s12,
      intro: 'Assalomu alaykum! O‘n yettinchi darsda sukun qatnashgan uzunroq so‘zlarni o‘qiymiz. Uzun so‘zni bo‘g‘inlarga bo‘lib o‘qing: mak — tuu — bu, maktuubu. Shoshilmang, har bir bo‘g‘inni aniq ayting.',
      rule: 'Uzun so‘zni bo‘g‘inlarga bo‘lib o‘qing: مَكْتُوبٌ = مَكْ + تُو + بٌ.' },
    { n: 18, week: 6, book: 13, title: 'Shadda (ikkilangan harf)', titleAr: 'الشَّدَّةُ', kind: 'words', words0: B.s13a, words: B.s13,
      intro: 'Assalomu alaykum! O‘n sakkizinchi darsda shaddani o‘rganamiz. Shadda — harf ustidagi kichik «w» shaklidagi belgi. Shaddali harf ikki marta o‘qiladi: birinchisi sukun bilan, ikkinchisi harakati bilan. Masalan: al-lama — ‘allama.',
      rule: 'Shadda — harf ustidagi kichik «w» belgisi. Harf ikki marta o‘qiladi: عَلَّمَ — ‘al-lama.' },
    { n: 19, week: 7, book: 14, title: 'Shadda bilan mashqlar', titleAr: 'تَدْرِيبَاتٌ', kind: 'words', words: B.s14,
      intro: 'Assalomu alaykum! O‘n to‘qqizinchi darsda shadda qatnashgan uzun so‘zlarni o‘qiymiz. Shadda bilan madd birga kelishi ham mumkin: tuf — faa — hu, tuffaahu. Har bir so‘zni bo‘g‘inlab, diqqat bilan o‘qing.',
      rule: 'Shadda bilan madd birga kelishi mumkin: تُفَّاحٌ — tuf-faahu.' },
    { n: 20, week: 7, book: 15, title: 'Tanvin (-an, -un, -in)', titleAr: 'التَّنْوِينُ', kind: 'tanvin', words: B.s16,
      intro: 'Assalomu alaykum! Yigirmanchi darsda tanvinni o‘rganamiz. Tanvin — ikkilangan harakat. U faqat so‘z oxirida keladi va «n» tovushini qo‘shadi: ban, bun, bin. Tanvin faqat otlarda bo‘ladi, va tanvinli so‘zda «al» bo‘lmaydi. Avval harflarni tanvin bilan, keyin so‘zlarni o‘qiymiz.',
      rule: 'Tanvin faqat so‘z oxirida bo‘ladi va «n» tovushini qo‘shadi: بٌ — bun, بًا — ban, بٍ — bin.' },
    { n: 21, week: 7, book: 17, title: '«Al» — qamariy va shamsiy harflar', titleAr: '(ال) الشَّمْسِيَّةُ وَالْقَمَرِيَّةُ', kind: 'al', words: B.s17q, words2: B.s17s, words3: B.s18,
      intro: 'Assalomu alaykum! Yigirma birinchi darsda «al» artiklini o‘rganamiz. Harflar ikki guruhga bo‘linadi. Qamariy harflardan oldin lam o‘qiladi: al-qolbu. Shamsiy harflardan oldin lam o‘qilmaydi, keyingi harf esa shadda bilan ikkilanadi: ash-shahdu. Har ikki guruhda o‘n to‘rttadan harf bor.',
      rule: 'Qamariy harfdan oldin ل o‘qiladi: الْقَلْبُ — al-qolbu. Shamsiy harfdan oldin ل o‘qilmaydi, harf ikkilanadi: الشَّهْدُ — ash-shahdu.' },
    { n: 22, week: 8, book: 19, title: 'Toi marbuta', titleAr: 'التَّاءُ الْمَرْبُوطَةُ', kind: 'words', pairs: B.s19p, words: B.s19, words2: B.s19w,
      intro: 'Assalomu alaykum! Yigirma ikkinchi darsda toi marbutani o‘rganamiz. Bu harf ikki nuqtali dumaloq «ha» ko‘rinishida bo‘lib, faqat so‘z oxirida keladi. Davom ettirib o‘qilsa «t» bo‘ladi, to‘xtab o‘qilsa «h» bo‘ladi: madrosatun — madrosah. Toi marbuta ko‘pincha ayol jinsini bildiradi: mu’allim — mu’allima.',
      rule: 'ة — so‘z oxirida keladi. Davom ettirib o‘qilsa «t», to‘xtab o‘qilsa «h» bo‘ladi: مَدْرَسَةْ — madrosah.' },
    { n: 23, week: 8, book: 20, title: 'Hamza va alif maqsura', titleAr: 'الْهَمْزَةُ الْمُتَوَسِّطَةُ · الْأَلِفُ الْمَقْصُورَةُ', kind: 'words', words: B.s20a, words2: B.s20b, words3: B.s21,
      intro: 'Assalomu alaykum! Yigirma uchinchi darsda hamza va alif maqsurani o‘rganamiz. Hamza — tutuq tovushi, xuddi o‘zbekcha «ta’lim» so‘zidagidek. U alif, vov yoki ya ustida kelishi mumkin. Alif maqsura esa nuqtasiz ya ko‘rinishida bo‘lib, «aa» deb o‘qiladi: ilaa, ‘alaa.',
      rule: 'Hamza ء — tutuq tovushi (’). U ا، و، ي ustida kelishi mumkin: رَأْسٌ، سُؤَالٌ، ذِئْبٌ. Alif maqsura ى — «aa» deb o‘qiladi: عَلَى — ‘alaa.' },
    { n: 24, week: 8, book: 22, title: 'O‘qish uchun matnlar', titleAr: 'فِقْرَاتٌ لِلْقِرَاءَةِ', kind: 'texts',
      intro: 'Assalomu alaykum! Tabriklayman — siz kursning oxirgi darsiga yetib keldingiz! Bugun sakkizta qisqa matnni o‘qiymiz. Ularda shu paytgacha o‘rgangan hamma narsa bor: harakatlar, madd, sukun, shadda, tanvin, «al», toi marbuta va hamza. Avval matnni tinglang, keyin o‘zingiz ovoz chiqarib o‘qing.',
      rule: 'Har bir matnni avval tinglang, keyin o‘zingiz ovoz chiqarib o‘qing. Kamida 3 marta o‘qing.' }
  ];
  LESSONS.forEach(function (l) { l.id = 'a0-' + (l.n < 10 ? '0' : '') + l.n; });

  /** Darsda ko'rsatiladigan bloklar (kitob tartibida) */
  function blocks(l) {
    var b = [];
    b.push({ t: 'rule', uz: l.rule });
    if (l.kind === 'letters') {
      b.push({ t: 'letters', list: l.letters });
      if (l.alphabet) b.push({ t: 'grid', title: 'Butun alifbo — tartib bilan', items: ALL.map(function (c) { return L(c).show; }), letters: true, big: true });
    } else if (l.kind === 'forms') {
      b.push({ t: 'forms', list: l.letters });
      if (l.extraNc) b.push({ t: 'forms', title: 'Ulanmaydigan 6 harf — faqat ikki shakl', list: ['ا', 'و', 'د', 'ذ', 'ر', 'ز'] });
    } else if (l.kind === 'harakat') {
      b.push({ t: 'grid', title: 'Harflar ' + (l.mark === F_ ? 'fatha' : l.mark === D_ ? 'damma' : 'kasra') + ' bilan', items: lettersMarked(l.mark), big: true });
      if (l.words) b.push({ t: 'grid', title: 'So‘zlar', items: l.words });
    } else if (l.kind === 'tanvin') {
      b.push({ t: 'tanvinRules', ar: B.s15r, uz: B.s15rUz });
      b.push({ t: 'tanvin' });
      b.push({ t: 'grid', title: 'Mashqlar (16-bo‘lim)', items: l.words });
    } else if (l.kind === 'al') {
      b.push({ t: 'sets' });
      b.push({ t: 'grid', title: 'Qamariy «Al» — ل o‘qiladi', items: l.words });
      b.push({ t: 'grid', title: 'Shamsiy «Al» — ل o‘qilmaydi, harf ikkilanadi', items: l.words2 });
      b.push({ t: 'grid', title: 'Mashqlar (18-bo‘lim)', items: l.words3 });
    } else if (l.kind === 'texts') {
      B.texts.forEach(function (x, i) { b.push({ t: 'text', n: i + 1, title: x.t, ar: x.ar, uz: x.uz }); });
    } else {
      if (l.pairs) b.push({ t: 'pairs', items: l.pairs, title: l.n === 16 ? 'Harakatli → sukunli' : l.n === 22 ? 'Erkak → ayol (ة qo‘shiladi)' : 'Qisqa → cho‘ziq' });
      if (l.words0) b.push({ t: 'grid', title: 'Qisqa misollar', items: l.words0, big: true });
      b.push({ t: 'grid', title: 'So‘zlar', items: l.words });
      if (l.words2) b.push({ t: 'grid', title: l.n === 15 ? 'Uchala madd aralash' : l.n === 22 ? 'To‘xtab o‘qish (oxiri «h»)' : 'Hamza so‘z o‘rtasida (davomi)', items: l.words2 });
      if (l.words3) b.push({ t: 'grid', title: 'Alif maqsura (21-bo‘lim)', items: l.words3, big: true });
    }
    return b;
  }
  /** Darsdagi barcha o'qiladigan matnlar — ovoz va «video» shu tartibda */
  function readItems(l) {
    var out = [];
    blocks(l).forEach(function (bl) {
      if (bl.t === 'letters') bl.list.forEach(function (c) { out.push({ ar: L(c).show, say: L(c).say, letter: c }); });
      else if (bl.t === 'forms') bl.list.forEach(function (c) { out.push({ ar: L(c).show, say: L(c).say, letter: c, forms: true }); });
      else if (bl.t === 'grid') bl.items.forEach(function (x) {
        var lt = bl.letters ? L(x) : null;
        out.push(lt ? { ar: x, say: lt.say, letter: lt.ch } : { ar: x });
      });
      else if (bl.t === 'pairs') bl.items.forEach(function (p) { out.push({ ar: p[0] }); out.push({ ar: p[1] }); });
      else if (bl.t === 'tanvin') LETTERS.forEach(function (x) { [FN, DN, KN].forEach(function (m) { out.push({ ar: withMark(x, m) }); }); });
      else if (bl.t === 'tanvinRules') bl.ar.forEach(function (s) { out.push({ ar: s }); });
      else if (bl.t === 'text') out.push({ ar: bl.ar, text: true });
    });
    return out;
  }

  /* ============ 5. OVOZ ============
     Arabcha: assets/a0/ar/<kalit>.mp3 — kalit matndan (harakatlari bilan) hisoblanadi.
     O'zbekcha diktor: assets/a0/uz/<dars id>.mp3 (kirish), assets/a0/uz/t<harf>.mp3 (maxraj).
     AUDIO — tayyor fayllar ro'yxati (scripts orqali yangilanadi). Fayl bo'lmasa —
     brauzerning arabcha ovozi ishlatiladi.                                      */
  function audioText(t) { return String(t || '').replace(/ـ/g, '').replace(/\s+/g, ' ').trim(); }
  function akey(t) {
    var s = audioText(t), h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  var AUDIO = {};      /* kalit → 1 (assets/a0/ar/<kalit>.mp3 bor) */
  var AUDIO_UZ = {};   /* nom → 1 (assets/a0/uz/<nom>.mp3 bor) */
  /** Matn → ovoz fayli (yoki null) */
  function audioUrl(t) { var k = akey(t); return AUDIO[k] ? 'assets/a0/ar/' + k + '.mp3' : null; }
  function uzUrl(name) { return AUDIO_UZ[name] ? 'assets/a0/uz/' + name + '.mp3' : null; }
  /** Eski kabinet kodi bilan moslik */
  function audioKey(t) { var u = audioUrl(t); return u; }

  /* ============ 6. MASHQ, TEST, UY VAZIFASI ============ */
  function seeded(seedStr) {
    var h = 2166136261;
    for (var i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return function () { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return (h % 100000) / 100000; };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }
  function q(kind, prompt, opts, right, extra) {
    var o = { kind: kind, prompt: prompt, options: opts, answer: opts.indexOf(right) };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  /** Noto'g'ri o'qilish variantlari: unlilarni almashtirish */
  function wrongReads(lat, rnd, n) {
    var swaps = [['a', 'u'], ['u', 'i'], ['i', 'a'], ['aa', 'a'], ['uu', 'u'], ['ii', 'i'], ['o', 'u'], ['un', 'an'], ['an', 'in']];
    var out = [];
    for (var t = 0; t < 40 && out.length < n; t++) {
      var s = swaps[Math.floor(rnd() * swaps.length)];
      var idx = []; var p = lat.indexOf(s[0]);
      while (p >= 0) { idx.push(p); p = lat.indexOf(s[0], p + 1); }
      if (!idx.length) continue;
      var at = idx[Math.floor(rnd() * idx.length)];
      var w = lat.slice(0, at) + s[1] + lat.slice(at + s[0].length);
      if (w !== lat && out.indexOf(w) < 0) out.push(w);
    }
    return out;
  }
  function wordPool(l) {
    var items = readItems(l).filter(function (x) { return !x.letter && !x.text && x.ar.indexOf(' ') < 0; }).map(function (x) { return x.ar; });
    return uniq(items);
  }
  /** Savollar to'plami. mode: 'practice' (ko'proq, darhol tekshiriladi) yoki 'test' */
  function buildQuiz(lesson, seed, mode) {
    var rnd = seeded(lesson.id + ':' + mode + ':' + (seed || ''));
    var qs = [], N = mode === 'test' ? 12 : 10;
    var idx = LESSONS.indexOf(lesson);
    if (lesson.kind === 'letters' || lesson.kind === 'forms') {
      var own = lesson.letters.map(L);
      var prev = LETTERS.slice(0, Math.max(0, ALL.indexOf(lesson.letters[0])));
      var pool = LETTERS.filter(function (x) { return lesson.letters.indexOf(x.ch) < 0; });
      var wrong = function (x, n) { return shuffle(own.filter(function (y) { return y !== x; }).concat(shuffle(pool, rnd).slice(0, 3)), rnd).slice(0, n || 3); };
      shuffle(own, rnd).forEach(function (x, i) {
        var o = shuffle([x].concat(wrong(x)), rnd);
        var kind = lesson.kind === 'forms' ? ['form', 'hear', 'name'][i % 3] : ['name', 'hear', 'pick'][i % 3];
        if (kind === 'name') qs.push(q('name', 'Bu qaysi harf?', o.map(nameOf), nameOf(x), { show: x.show }));
        else if (kind === 'hear') qs.push(q('hear', 'Eshiting va harfni toping', o.map(function (y) { return y.show; }), x.show, { audio: x.say, optionsAr: true }));
        else if (kind === 'pick') qs.push(q('pick', '«' + nameOf(x) + '» harfini toping', o.map(function (y) { return y.show; }), x.show, { optionsAr: true }));
        else {
          var f = forms(x), sh = x.nc ? f.end : (i % 2 ? f.middle : f.end);
          qs.push(q('form', 'So‘z ichida shunday yoziladi. Qaysi harf?', o.map(nameOf), nameOf(x), { show: sh }));
        }
      });
      /* shakl darslarida qo'shimcha: harf so'z boshida qanday yoziladi */
      if (lesson.kind === 'forms') shuffle(own.filter(function (x) { return !x.nc; }), rnd).slice(0, 3).forEach(function (x) {
        var f = forms(x), o = shuffle(own.filter(function (y) { return y !== x && !y.nc; }), rnd).slice(0, 2).map(function (y) { return forms(y).start; });
        qs.push(q('pick', '«' + nameOf(x) + '» so‘z boshida qanday yoziladi?', shuffle([f.start].concat(o, [f.end]), rnd), f.start, { optionsAr: true }));
      });
      if (lesson.kind === 'letters' && prev.length) shuffle(prev, rnd).slice(0, 2).forEach(function (x) {
        var o = shuffle([x].concat(shuffle(LETTERS.filter(function (y) { return y !== x; }), rnd).slice(0, 3)), rnd);
        qs.push(q('name', 'Takrorlash: bu qaysi harf?', o.map(nameOf), nameOf(x), { show: x.show }));
      });
      if (lesson.alphabet) {
        var k = 3 + Math.floor(rnd() * 20);
        var seq = ALL.slice(k, k + 3).map(function (c) { return L(c).show; });
        var nxt = L(ALL[k + 3]);
        var o2 = shuffle([nxt].concat(shuffle(LETTERS.filter(function (y) { return y !== nxt; }), rnd).slice(0, 3)), rnd);
        qs.push(q('pick', 'Alifbo tartibi: ' + seq.join(' ') + ' … keyingi harf qaysi?', o2.map(function (y) { return y.show; }), nxt.show, { optionsAr: true }));
      }
      return shuffle(qs, rnd).slice(0, N);
    }
    if (lesson.kind === 'harakat') {
      var vowel = lesson.mark === F_ ? 'a' : lesson.mark === D_ ? 'u' : 'i';
      var picks = shuffle(LETTERS.filter(function (x) { return x.ch !== 'ا'; }), rnd).slice(0, N);
      picks.forEach(function (x, i) {
        var syl = withMark(x, lesson.mark), lat = translit(syl);
        if (i % 3 === 2) {
          var others = shuffle(LETTERS.filter(function (y) { return y !== x && y.ch !== 'ا'; }), rnd).slice(0, 3).map(function (y) { return withMark(y, lesson.mark); });
          qs.push(q('hear', 'Eshiting va bo‘g‘inni toping', shuffle([syl].concat(others), rnd), syl, { audio: syl, optionsAr: true }));
        } else {
          var cons = lat.slice(0, -1);
          var opts = uniq([lat, cons + (vowel === 'a' ? 'u' : 'a'), cons + (vowel === 'i' ? 'u' : 'i')]);
          if (i % 3 === 1 && lesson.words) {
            var wd = lesson.words[Math.floor(rnd() * lesson.words.length)], wl = translit(wd);
            qs.push(q('read', 'Qanday o‘qiladi?', shuffle([wl].concat(wrongReads(wl, rnd, 2)), rnd), wl, { show: wd, audioAfter: wd }));
          } else qs.push(q('read', 'Qanday o‘qiladi?', shuffle(opts, rnd), lat, { show: syl, audioAfter: syl }));
        }
      });
      var mk = [['َ', 'Fatha'], ['ُ', 'Damma'], ['ِ', 'Kasra']];
      var cur = mk.filter(function (m) { return m[0] === lesson.mark; })[0];
      qs[N - 1] = q('mark', 'Bu belgi qanday ataladi?', shuffle(mk.map(function (m) { return m[1]; }), rnd), cur[1], { show: 'ب' + cur[0] });
      return shuffle(qs, rnd);
    }
    if (lesson.kind === 'texts') {
      var TQ = [
        ['1-matn: Fuod ertalab qayerga bordi?', 'Maktabga', ['Bozorga', 'Kutubxonaga', 'Dalaga']],
        ['2-matn: Shodiy kimdan savol so‘radi?', 'Muallimdan', ['Direktordan', 'Otasidan', 'Do‘stidan']],
        ['3-matn: Cho‘pon quduq yonida nimani ko‘rdi?', 'Bo‘rini', ['Tulkini', 'Otni', 'Tuyani']],
        ['4-matn: Bola non bilan nima yedi?', 'Zaytun yog‘i va anjir', ['Asal va sariyog‘', 'Go‘sht va guruch', 'Olma va uzum']],
        ['5-matn: Sora qayerga keldi?', 'Eski kutubxonaga', ['Yangi maktabga', 'Katta bozorga', 'Shifoxonaga']],
        ['6-matn: Dehqon ertalab nima qiladi?', 'Daraxtni sug‘oradi, qo‘ylarni boqadi', ['Bozorga boradi', 'Kitob o‘qiydi', 'Uxlaydi']],
        ['7-matn: Erkak bozordan nima sotib oldi?', 'Marvarid', ['Kitob', 'Non', 'Gul']],
        ['8-matn: Askar kechasi nima qilardi?', 'Shaharni qo‘riqlardi', ['Uxlardi', 'Ovqat pishirardi', 'Kitob yozardi']]
      ];
      TQ.forEach(function (t) { qs.push(q('text', t[0], shuffle([t[1]].concat(t[2]), rnd), t[1])); });
      if (mode === 'test') {
        /* Yakuniy nazorat (daftar, 28-bet) — A bo'limi */
        qs.push(q('read', 'بُ qanday o‘qiladi?', ['ba', 'bu', 'bi'], 'bu', { show: 'بُ' }));
        qs.push(q('pick', 'Qaysi harf ulanmaydi?', ['ل', 'د', 'ن'], 'د', { optionsAr: true }));
        qs.push(q('choice', 'كِتَابٌ ning ma’nosi?', ['qalam', 'kitob', 'eshik'], 'kitob'));
        qs.push(q('choice', 'Sukun nima qiladi?', ['unlisiz o‘qitadi', 'ikki marta o‘qitadi', 'cho‘zadi'], 'unlisiz o‘qitadi'));
        qs.push(q('read', 'الشَّمْسُ qanday o‘qiladi?', ['al-shamsu', 'ash-shamsu', 'ashamsu'], 'ash-shamsu', { show: 'الشَّمْسُ' }));
        qs.push(q('pick', 'Qaysi so‘zda toi marbuta bor?', ['قَلَمٌ', 'مَدْرَسَةٌ', 'بَيْتٌ'], 'مَدْرَسَةٌ', { optionsAr: true }));
        qs.push(q('choice', 'قَلَمًا dagi oxirgi alif…', ['o‘qiladi', 'o‘qilmaydi', 'cho‘ziladi'], 'o‘qilmaydi'));
        qs.push(q('pick', 'Qamariy harf qaysi?', ['ق', 'ش', 'ن'], 'ق', { optionsAr: true }));
        qs.push(q('read', 'عَلَى dagi ى qanday o‘qiladi?', ['y', 'ii', 'aa'], 'aa', { show: 'عَلَى' }));
        qs.push(q('choice', 'Hamza qaysi belgiga o‘xshaydi?', ['tutuq belgisi (’)', 'vergul', 'nuqta'], 'tutuq belgisi (’)'));
      }
      return mode === 'test' ? qs : shuffle(qs, rnd);
    }
    /* So'z darslari: o'qilishi, eshitib topish, qisqa/cho'ziq va boshqalar */
    var words = wordPool(lesson);
    var take = shuffle(words, rnd).slice(0, N);
    take.forEach(function (wd, i) {
      var lat = translit(wd);
      if (i % 2 === 0) {
        var wr = wrongReads(lat, rnd, 2);
        if (wr.length < 2) wr = wr.concat(wrongReads(lat + 'u', rnd, 2 - wr.length));
        qs.push(q('read', 'Qanday o‘qiladi?', shuffle([lat].concat(wr), rnd), lat, { show: wd, audioAfter: wd }));
      } else {
        var others = shuffle(words.filter(function (x) { return x !== wd; }), rnd).slice(0, 3);
        qs.push(q('hear', 'Eshiting va so‘zni toping', shuffle([wd].concat(others), rnd), wd, { audio: wd, optionsAr: true }));
      }
    });
    /* mavzuga oid qo'shimcha savol */
    var extra = topicQuestion(lesson, rnd);
    if (extra) qs[qs.length - 1] = extra;
    if (idx > 0 && mode === 'test') {
      var pl = LESSONS[idx - 1];
      if (pl.kind !== 'letters' && pl.kind !== 'forms' && pl.kind !== 'harakat') {
        var pw = wordPool(pl); var w2 = pw[Math.floor(rnd() * pw.length)]; if (w2) {
          var l2 = translit(w2);
          qs.push(q('read', 'Takrorlash: qanday o‘qiladi?', shuffle([l2].concat(wrongReads(l2, rnd, 2)), rnd), l2, { show: w2, audioAfter: w2 }));
        }
      }
    }
    return shuffle(qs, rnd);
  }
  function topicQuestion(l, rnd) {
    switch (l.n) {
      case 13: return q('choice', 'Fathadan keyingi ا nima qiladi?', shuffle(['ovozni cho‘zadi', 'o‘qilmaydi', '«i» qiladi'], rnd), 'ovozni cho‘zadi');
      case 14: return q('pick', 'Qaysi so‘z cho‘ziq o‘qiladi?', shuffle(['فِيلُ', 'فِلُ', 'مِلُ'], rnd), 'فِيلُ', { optionsAr: true });
      case 15: return q('pick', 'Qaysi so‘zda vov maddi bor?', shuffle(['غَفُورُ', 'كَبِيرُ', 'كَاتِبُ'], rnd), 'غَفُورُ', { optionsAr: true });
      case 16: return q('choice', 'Sukunli harf qanday o‘qiladi?', shuffle(['unlisiz', 'ikki marta', 'cho‘zib'], rnd), 'unlisiz');
      case 18: return q('choice', 'Shaddali harf necha marta o‘qiladi?', shuffle(['ikki marta', 'bir marta', 'o‘qilmaydi'], rnd), 'ikki marta');
      case 20: return q('choice', 'Tanvin qayerda keladi?', shuffle(['so‘z oxirida', 'so‘z boshida', 'so‘z o‘rtasida'], rnd), 'so‘z oxirida');
      case 21: return q('pick', 'Qaysi so‘zda «ال» ning ل harfi o‘qilmaydi?', shuffle(['الشَّمْسُ', 'الْقَمَرُ', 'الْكِتَابُ'], rnd), 'الشَّمْسُ', { optionsAr: true });
      case 22: return q('choice', 'مَدْرَسَةْ (to‘xtab o‘qisak) oxiri qanday?', shuffle(['-h', '-t', '-n'], rnd), '-h');
      case 23: return q('read', 'عَلَى qanday o‘qiladi?', shuffle(['‘alaa', '‘alay', '‘ali'], rnd), '‘alaa', { show: 'عَلَى' });
      default: return null;
    }
  }

  /* ---- Uy vazifasi (daftar): daftarga yoziladigan topshiriqlar + avtomatik savollar ---- */
  var HW = {
    1: { auto: [
      ['dots', 'Nuqtasini qo‘ying: «Jim» qaysi?', ['ج', 'ح', 'خ'], 'ج'], ['dots', '«Sa» qaysi?', ['ب', 'ت', 'ث'], 'ث'], ['dots', '«Xo» qaysi?', ['ج', 'ح', 'خ'], 'خ'],
      ['dots', '«Ta» qaysi?', ['ب', 'ت', 'ث'], 'ت'], ['name', 'Bu qaysi harf?  ب', ['Ba', 'Ta', 'Sa'], 'Ba'], ['name', 'Bu qaysi harf?  أ', ['Alif', 'Jim', 'Ha (ح)'], 'Alif']] },
    2: { auto: [
      ['dots', '«Zal» qaysi?', ['د', 'ذ', 'ر'], 'ذ'], ['dots', '«Zay» qaysi?', ['ر', 'ز', 'د'], 'ز'], ['dots', '«Shin» qaysi?', ['س', 'ش', 'ص'], 'ش'],
      ['dots', '«Dod» qaysi?', ['ص', 'ض', 'س'], 'ض'], ['name', 'Bu qaysi harf?  ص', ['Sod', 'Sin', 'Dod'], 'Sod'], ['name', 'Bu qaysi harf?  ر', ['Ro', 'Zay', 'Dal'], 'Ro']] },
    3: { auto: [
      ['dots', '«Zo» qaysi?', ['ط', 'ظ', 'ض'], 'ظ'], ['dots', '«G‘ayn» qaysi?', ['ع', 'غ', 'ف'], 'غ'], ['dots', '«Fa» qaysi?', ['ف', 'ق', 'غ'], 'ف'],
      ['dots', '«Qof» qaysi?', ['ف', 'ق', 'ك'], 'ق'], ['name', 'Bu qaysi harf?  ع', ['Ayn', 'G‘ayn', 'Ha (ح)'], 'Ayn'], ['name', 'Bu qaysi harf?  ك', ['Kaf', 'Qof', 'Lam'], 'Kaf']] },
    4: { auto: [
      ['name', '«Nun» qaysi?', ['ن', 'ب', 'ت'], 'ن'], ['name', '«Mim» qaysi?', ['م', 'ه', 'و'], 'م'], ['name', '«Vov» qaysi?', ['و', 'ر', 'د'], 'و'],
      ['order', 'Alifbo: ت ـ ? ـ ج — orasida qaysi harf?', ['ث', 'ب', 'ح'], 'ث'], ['order', 'Alifbo: س ـ ? ـ ص — orasida qaysi harf?', ['ش', 'ض', 'ز'], 'ش'], ['order', 'Alifbo: ق ـ ? ـ ل — orasida qaysi harf?', ['ك', 'ف', 'م'], 'ك']] },
    5: { auto: [
      ['split', 'ثبت so‘zi qaysi harflardan iborat?', ['ث + ب + ت', 'ت + ب + ث', 'ث + ن + ت'], 'ث + ب + ت'], ['split', 'بحث so‘zi qaysi harflardan?', ['ب + ح + ث', 'ب + ج + ث', 'ن + ح + ث'], 'ب + ح + ث'],
      ['split', 'تحت so‘zi qaysi harflardan?', ['ت + ح + ت', 'ت + خ + ت', 'ث + ح + ت'], 'ت + ح + ت'], ['split', 'حجب so‘zi qaysi harflardan?', ['ح + ج + ب', 'ج + ح + ب', 'خ + ج + ب'], 'ح + ج + ب'],
      ['form', 'ـجـ — qaysi harfning o‘rtadagi shakli?', ['Jim', 'Ha (ح)', 'Xo'], 'Jim']] },
    6: { auto: [
      ['join', 'س + ع + د = ?', ['سعد', 'سغد', 'شعد'], 'سعد'], ['join', 'ش + ط + ب = ?', ['شطب', 'سطب', 'شظب'], 'شطب'],
      ['join', 'ص + ب + غ = ?', ['صبغ', 'ضبغ', 'صبع'], 'صبغ'], ['join', 'ع + ب + ث = ?', ['عبث', 'غبث', 'عبت'], 'عبث'], ['form', 'ـعـ — qaysi harf?', ['Ayn', 'G‘ayn', 'Fa'], 'Ayn']] },
    7: { auto: [
      ['choice', 'Qaysi harf keyingi harfga ulanmaydi?', ['د', 'ب', 'ك'], 'د'], ['choice', 'Qaysi harf keyingi harfga ulanmaydi?', ['ز', 'ف', 'ه'], 'ز'],
      ['choice', 'Ulanmaydigan harflarning nechta shakli bor?', ['2 ta', '3 ta', '4 ta'], '2 ta'], ['form', 'ـهـ — qaysi harf?', ['Ha (ه)', 'Ha (ح)', 'Mim'], 'Ha (ه)'], ['form', 'يـ — qaysi harf?', ['Ya', 'Ba', 'Nun'], 'Ya']] },
    8: { auto: [
      ['read', 'ذَهَبَ — lotincha?', ['zahaba', 'zuhaba', 'zahiba'], 'zahaba'], ['read', 'شَكَرَ — lotincha?', ['shakaro', 'shukiro', 'shikaro'], 'shakaro'],
      ['read', 'جَلَسَ — lotincha?', ['jalasa', 'julisa', 'jilasa'], 'jalasa'], ['read', 'نَصَرَ — lotincha?', ['nasoro', 'nusiro', 'nisoro'], 'nasoro'],
      ['read', 'خَرَجَ — lotincha?', ['xoroja', 'xurija', 'xiroja'], 'xoroja'], ['read', 'كَشَفَ — lotincha?', ['kashafa', 'kushifa', 'kishafa'], 'kashafa']] },
    9: { auto: [
      ['join', 'جَ + لَ + سَ = ?', ['جَلَسَ', 'جَسَلَ', 'حَلَسَ'], 'جَلَسَ'], ['join', 'شَ + رَ + حَ = ?', ['شَرَحَ', 'سَرَحَ', 'شَرَجَ'], 'شَرَحَ'],
      ['join', 'قَ + عَ + دَ = ?', ['قَعَدَ', 'فَعَدَ', 'قَعَذَ'], 'قَعَدَ'], ['join', 'كَ + شَ + فَ = ?', ['كَشَفَ', 'كَسَفَ', 'كَشَقَ'], 'كَشَفَ'],
      ['split', 'حَمَلَ = ?', ['حَ + مَ + لَ', 'حَ + لَ + مَ', 'جَ + مَ + لَ'], 'حَ + مَ + لَ'], ['split', 'عَبَدَ = ?', ['عَ + بَ + دَ', 'غَ + بَ + دَ', 'عَ + دَ + بَ'], 'عَ + بَ + دَ']] },
    10: { auto: [
      ['read', 'بُ qanday o‘qiladi?', ['ba', 'bu', 'bi'], 'bu'], ['choice', 'Damma qayerga yoziladi?', ['harf ustiga', 'harf ostiga', 'harf yoniga'], 'harf ustiga'],
      ['read', 'كَبُرَ dagi بُ …', ['ba', 'bu', 'bi'], 'bu'], ['pick', 'Qaysida damma bor?', ['سَ', 'سُ', 'سِ'], 'سُ'],
      ['read', 'كَبُرَ — lotincha?', ['kaburo', 'kabaro', 'kabiro'], 'kaburo'], ['read', 'حَسُنَ — lotincha?', ['hasuna', 'hasana', 'hasina'], 'hasuna']] },
    11: { auto: [
      ['read', 'عَلِمَ — lotincha?', ['\'alima', '\'aluma', '\'alama'], '\'alima'], ['read', 'فَهِمَ — lotincha?', ['fahima', 'fahuma', 'fahama'], 'fahima'],
      ['read', 'شَرِبَ — lotincha?', ['shariba', 'sharuba', 'sharoba'], 'shariba'], ['read', 'رَحِمَ — lotincha?', ['rohima', 'rohama', 'rohuma'], 'rohima'],
      ['choice', 'Kasra qayerga yoziladi?', ['harf ostiga', 'harf ustiga', 'harf yoniga'], 'harf ostiga'], ['pick', 'Qaysida kasra bor?', ['بِ', 'بَ', 'بُ'], 'بِ']] },
    12: { auto: [
      ['mark', 'كُتِبَ — birinchi harf كُ qaysi harakat bilan?', ['fatha', 'damma', 'kasra'], 'damma'], ['mark', 'كُتِبَ — ikkinchi harf تِ?', ['fatha', 'damma', 'kasra'], 'kasra'],
      ['mark', 'عَلِمَ — birinchi harf عَ?', ['fatha', 'damma', 'kasra'], 'fatha'], ['mark', 'سُمِعَ — ikkinchi harf مِ?', ['fatha', 'damma', 'kasra'], 'kasra'],
      ['mark', 'فَهِمَ — oxirgi harf مَ?', ['fatha', 'damma', 'kasra'], 'fatha'], ['mark', 'ظُلِمَ — birinchi harf ظُ?', ['fatha', 'damma', 'kasra'], 'damma']] },
    13: { auto: [
      ['len', 'قَلَ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'qisqa'], ['len', 'قَالَ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'cho‘ziq'],
      ['len', 'سَادَ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'cho‘ziq'], ['len', 'دَرَ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'qisqa'],
      ['fill', 'kaatibu: كَ□تِبُ — bo‘sh joyga qaysi harf?', ['ا', 'و', 'ي'], 'ا'], ['fill', 'toolibu: طَ□لِبُ — qaysi harf?', ['ا', 'و', 'ي'], 'ا']] },
    14: { auto: [
      ['len', 'فِلُ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'qisqa'], ['len', 'فِيلُ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'cho‘ziq'],
      ['len', 'عِيدُ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'cho‘ziq'], ['len', 'مِلُ — qisqami yoki cho‘ziq?', ['qisqa', 'cho‘ziq'], 'qisqa'],
      ['fill', 'rohiimu: رَحِ□مُ — qaysi harf?', ['ي', 'ا', 'و'], 'ي'], ['fill', 'bashiiru: بَشِ□رُ — qaysi harf?', ['ي', 'ا', 'و'], 'ي']] },
    15: { auto: [
      ['fill', 'g‘ofuuru: غَفُ□رُ — qaysi harf?', ['و', 'ا', 'ي'], 'و'], ['fill', 'shakuuru: شَكُ□رُ — qaysi harf?', ['و', 'ا', 'ي'], 'و'],
      ['fill', 'saabihaatu: سَ□بِحَاتُ — qaysi harf?', ['ا', 'و', 'ي'], 'ا'], ['fill', 'muniibiina: مُنِ□بِينَ — qaysi harf?', ['ي', 'ا', 'و'], 'ي'],
      ['read', 'صَابِرُونَ — lotincha?', ['soobiruuna', 'sobiruna', 'sooburuuna'], 'soobiruuna'], ['read', 'رَافِعُونَ — lotincha?', ['roofi\'uuna', 'rofi\'una', 'roofa\'uuna'], 'roofi\'uuna']] },
    16: { auto: [
      ['read', 'عَقْلُ — lotincha?', ['\'aqlu', '\'aqolu', '\'aqulu'], '\'aqlu'], ['read', 'فَهْدُ — lotincha?', ['fahdu', 'fahadu', 'fahudu'], 'fahdu'],
      ['read', 'بَدْرُ — lotincha?', ['badru', 'badaru', 'baduru'], 'badru'], ['read', 'قَلْبُ — lotincha?', ['qolbu', 'qolabu', 'qolubu'], 'qolbu'],
      ['read', 'بَيْتُ — lotincha?', ['baytu', 'bayatu', 'biytu'], 'baytu'], ['choice', 'Sukun qanday belgi?', ['kichik doiracha', 'qiya chiziq', 'kichik «w»'], 'kichik doiracha']] },
    17: { auto: [
      ['split', 'مَكْتُوبُ = ?', ['مَكْ + تُو + بُ', 'مَ + كَ + تُو + بُ', 'مَكْ + تَ + وُبُ'], 'مَكْ + تُو + بُ'], ['split', 'مَفْتُوحُ = ?', ['مَفْ + تُو + حُ', 'مَ + فَ + تُو + حُ', 'مَفْ + تَ + حُ'], 'مَفْ + تُو + حُ'],
      ['read', 'مِفْتَاحُ — lotincha?', ['miftaahu', 'mifataahu', 'muftaahu'], 'miftaahu'], ['read', 'عُصْفُورُ — lotincha?', ['\'usfuuru', '\'usafuuru', '\'asfuuru'], '\'usfuuru'],
      ['read', 'مِسْوَاكُ — lotincha?', ['misvaaku', 'misuvaaku', 'masvaaku'], 'misvaaku'], ['read', 'مَوْعِدُ — lotincha?', ['mav\'idu', 'mava\'idu', 'muv\'idu'], 'mav\'idu']] },
    18: { auto: [
      ['read', 'عَلَّمَ — lotincha?', ['\'allama', '\'alama', '\'allima'], '\'allama'], ['read', 'كَسَّرَ — lotincha?', ['kassaro', 'kasaro', 'kassiro'], 'kassaro'],
      ['read', 'رَتَّبَ — lotincha?', ['rottaba', 'rotaba', 'rottiba'], 'rottaba'], ['read', 'فَرَّقَ — lotincha?', ['farroqo', 'faroqo', 'farruqo'], 'farroqo'],
      ['read', 'بَشَّرَ — lotincha?', ['bashsharo', 'basharo', 'bashshiro'], 'bashsharo'], ['choice', 'Shaddali harf necha marta o‘qiladi?', ['ikki marta', 'bir marta', 'uch marta'], 'ikki marta']] },
    19: { auto: [
      ['mean', 'تُفَّاحُ — ma’nosi?', ['olma', 'novvoy', 'gilam'], 'olma'], ['mean', 'خَبَّازُ — ma’nosi?', ['novvoy', 'g‘avvos', 'ishchilar'], 'novvoy'],
      ['mean', 'سَجَّادُ — ma’nosi?', ['gilam', 'olma', 'novvoy'], 'gilam'], ['mean', 'عُمَّالُ — ma’nosi?', ['ishchilar', 'g‘avvos', 'gilam'], 'ishchilar'],
      ['mean', 'غَوَّاصُ — ma’nosi?', ['g‘avvos', 'ishchilar', 'olma'], 'g‘avvos'], ['read', 'تُفَّاحُ — lotincha?', ['tuffaahu', 'tufaahu', 'tuffahu'], 'tuffaahu']] },
    20: { auto: [
      ['tanvin', 'دَرْسٌ ni «-an» bilan yozing', ['دَرْسًا', 'دَرْسٍ', 'دَرْسُ'], 'دَرْسًا'], ['tanvin', 'جُرْحٌ ni «-in» bilan yozing', ['جُرْحٍ', 'جُرْحًا', 'جُرْحِ'], 'جُرْحٍ'],
      ['read', 'عَزِيزًا — lotincha?', ['\'aziizan', '\'aziizun', '\'aziizin'], '\'aziizan'], ['read', 'مُدِيرٍ — lotincha?', ['mudiirin', 'mudiiran', 'mudiirun'], 'mudiirin'],
      ['read', 'مَلْعَبٌ — lotincha?', ['mal\'abun', 'mal\'aban', 'mal\'abin'], 'mal\'abun'], ['choice', 'Tanvin qayerda bo‘ladi?', ['so‘z oxirida', 'so‘z boshida', 'so‘z o‘rtasida'], 'so‘z oxirida']] },
    21: { auto: [
      ['al', 'الْبَيْتُ — qamariymi, shamsiymi?', ['qamariy', 'shamsiy'], 'qamariy'], ['al', 'الدَّرْسُ — qamariymi, shamsiymi?', ['qamariy', 'shamsiy'], 'shamsiy'],
      ['al', 'النُّورُ — qamariymi, shamsiymi?', ['qamariy', 'shamsiy'], 'shamsiy'], ['al', 'الْكِتَابُ — qamariymi, shamsiymi?', ['qamariy', 'shamsiy'], 'qamariy'],
      ['al', 'الطَّرِيقُ — qamariymi, shamsiymi?', ['qamariy', 'shamsiy'], 'shamsiy'], ['read', 'الشَّهْدُ — lotincha?', ['ash-shahdu', 'al-shahdu', 'ash-shahadu'], 'ash-shahdu']] },
    22: { auto: [
      ['fem', 'مُعَلِّمٌ → ayol jinsi?', ['مُعَلِّمَةٌ', 'مُعَلِّمُونَ', 'مُعَلِّمٍ'], 'مُعَلِّمَةٌ'], ['fem', 'طَبِيبٌ → ayol jinsi?', ['طَبِيبَةٌ', 'طَبِيبٍ', 'طَبِيبًا'], 'طَبِيبَةٌ'],
      ['choice', 'مَدْرَسَةٌ (davom ettirib o‘qisak) oxiri…', ['-tun', '-hun', '-nun'], '-tun'], ['choice', 'مَدْرَسَةْ (to‘xtab o‘qisak) oxiri…', ['-t', '-h', '-n'], '-h'],
      ['pick', 'Qaysi so‘zda toi marbuta bor?', ['بَيْتٌ', 'مَكْتَبَةٌ', 'قَلْبٌ'], 'مَكْتَبَةٌ'], ['choice', 'Toi marbutadan oldin doim qaysi harakat keladi?', ['fatha', 'damma', 'kasra'], 'fatha']] },
    23: { auto: [
      ['read', 'عَلَى dagi ى qanday o‘qiladi?', ['y', 'ii', 'aa'], 'aa'], ['choice', 'Hamza qaysi belgiga o‘xshaydi?', ['tutuq (’)', 'vergul', 'nuqta'], 'tutuq (’)'],
      ['pick', 'Qaysi so‘zda alif maqsura bor?', ['قَالَ', 'كَبِيرٌ', 'إِلَى'], 'إِلَى'], ['choice', 'ذِئْبٌ dagi hamza qaysi harf ustida?', ['ا', 'و', 'ى (nuqtasiz)'], 'ى (nuqtasiz)'],
      ['read', 'رَأْسٌ — lotincha?', ['ro\'sun', 'rosun', 'ro\'asun'], 'ro\'sun'], ['read', 'سُؤَالٌ — lotincha?', ['su\'aalun', 'suvaalun', 'su\'alun'], 'su\'aalun']] },
    24: { auto: [
      ['text', '1-matn: Fuod ertalab qayerga bordi?', ['Maktabga', 'Bozorga', 'Kutubxonaga'], 'Maktabga'], ['text', '3-matn: Cho‘pon quduq yonida nimani ko‘rdi?', ['Bo‘rini', 'Tulkini', 'Otni'], 'Bo‘rini'],
      ['text', '5-matn: Sora qayerga keldi?', ['Eski kutubxonaga', 'Maktabga', 'Bozorga'], 'Eski kutubxonaga'], ['text', '7-matn: Erkak bozordan nima sotib oldi?', ['Marvarid', 'Non', 'Kitob'], 'Marvarid'],
      ['text', '8-matn: Askar kechasi nima qilardi?', ['Shaharni qo‘riqlardi', 'Uxlardi', 'Kitob o‘qirdi'], 'Shaharni qo‘riqlardi'], ['text', '2-matn: Muallim javobni qanday tushuntirdi?', ['Xotirjam', 'Baqirib', 'Yozib'], 'Xotirjam']] }
  };
  /** Daftarga yoziladigan topshiriqlar (daftardagi 1, 2 va 5-topshiriqlar) */
  function hwTasks(l) {
    var t = [];
    var sample = l.kind === 'letters' ? l.letters.slice(0, 4).map(function (c) { return L(c).show; })
      : l.kind === 'forms' ? l.letters.slice(0, 3).map(function (c) { var f = forms(L(c)); return [f.alone, f.start, f.middle, f.end].filter(Boolean).join(' '); })
      : l.kind === 'harakat' ? ['ب' + l.mark, 'ت' + l.mark]
      : l.kind === 'texts' ? [B.texts[0].ar]
      : (l.words || []).slice(0, 2);
    t.push({ id: 'yoz', title: 'Namunaga qarab chiroyli yozing (o‘ngdan chapga; nuqta va harakat — eng oxirida)', sample: sample, lines: l.kind === 'texts' ? 1 : 5 });
    t.push({ id: 'oqi', title: 'Darsdagi harf va so‘zlarni ovoz chiqarib 3 marta o‘qing (ota-ona eshitsin)' });
    if (l.n !== 5 && l.n !== 6 && l.n !== 7 && l.n !== 9 && l.n !== 11 && l.n !== 13 && l.n !== 14 && l.n !== 15 && l.n !== 16 && l.n !== 18 && l.n !== 19 && l.n !== 20 && l.n !== 21)
      t.push({ id: 'dik', title: 'Diktant: ustoz aytgan so‘zlarni yozing va qo‘shimcha yozish' });
    if (l.n === 24) t.push({ id: 'tar', title: '1-matnni o‘zbekchaga tarjima qiling (daftarga)' });
    return t;
  }
  function buildHomework(lesson) {
    var rnd = seeded('hw:' + lesson.id);
    var src = (HW[lesson.n] || { auto: [] }).auto;
    return src.map(function (x, i) {
      var opts = shuffle(x[2], rnd);
      var arOpts = /[؀-ۿ]/.test(x[2].join(''));
      return { id: lesson.id + ':h' + i, kind: x[0], prompt: x[1], options: opts, optionsAr: arOpts, answer: opts.indexOf(x[3]) };
    });
  }

  function publicTest(test) { return test.map(function (qq) { var c = Object.assign({}, qq); delete c.answer; return c; }); }
  function grade(test, answers) {
    var ok = 0;
    test.forEach(function (qq, i) { if (answers && answers[i] != null && Number(answers[i]) === qq.answer) ok++; });
    return { correct: ok, total: test.length, percent: test.length ? Math.round(ok * 100 / test.length) : 0 };
  }
  function buildTest(lesson, seed) { return buildQuiz(lesson, seed, 'test'); }
  function buildPractice(lesson) { return buildQuiz(lesson, 'p', 'practice'); }

  /* ============ 7. HOLAT: ketma-ket ochilish ============
     progress = { lessons: { id: { best, last, tries, steps:{}, hw:{ at, auto:{percent}, tasks:{} } } }, unlocked: { id: true } } */
  var STEPS = [
    { id: 'learn', label: 'Yodlash' },
    { id: 'video', label: 'Video' },
    { id: 'practice', label: 'Mashq' },
    { id: 'test', label: 'Test' },
    { id: 'hw', label: 'Uy vazifasi', home: true }
  ];
  function hwOk(p) { return !!(p && p.hw && p.hw.at && (!p.hw.auto || !p.hw.auto.total || Number(p.hw.auto.percent) >= PASS)); }
  function testOk(p) { return !!(p && p.best != null && Number(p.best) >= PASS); }
  function isDone(p) { return testOk(p) && hwOk(p); }
  function statuses(progress) {
    var pl = (progress && progress.lessons) || {};
    var manual = (progress && progress.unlocked) || {};
    var out = {}, prevDone = true;
    LESSONS.forEach(function (l, i) {
      var p = pl[l.id];
      var done = isDone(p);
      out[l.id] = done ? 'done' : ((i === 0 || prevDone || manual[l.id]) ? 'open' : 'locked');
      prevDone = done;
    });
    return out;
  }
  function view(progress) {
    var st = statuses(progress);
    var pl = (progress && progress.lessons) || {};
    var done = 0;
    var lessons = LESSONS.map(function (l) {
      if (st[l.id] === 'done') done++;
      var p = pl[l.id] || {};
      return { id: l.id, n: l.n, week: l.week, title: l.title, status: st[l.id], best: p.best == null ? null : p.best, last: p.last == null ? null : p.last,
        tries: p.tries || 0, steps: p.steps || {}, testOk: testOk(p), hw: p.hw ? { at: p.hw.at, percent: p.hw.auto ? p.hw.auto.percent : null, ok: hwOk(p) } : null };
    });
    return { pass: PASS, done: done, total: LESSONS.length, lessons: lessons };
  }
  function byId(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i]; return null; }

  /* ---- Ovozlar ro'yxati (scripts/a0-audio.js yangilaydi) ---- */
  /*AUDIO-BEGIN*/
  (function(){var a="0078ed2e 0107fc47 0185b4aa 01cb3620 02a6d9e2 02b459b9 02c4a05e 02cb8585 030cdc52 032883c8 039f1c44 03a59d8d 04b69e97 04e8496a 04fa65b3 076eebf5 07849e1b 081d08e7 08221505 0887079a 09aeda50 09fa31dc 0a181eb8 0a3044ef 0a5e1873 0aadc4ec 0abe11b8 0ad760da 0b039a28 0b071b91 0ba1c3cf 0d6a0453 0d7c7996 0dd0f618 0f477fa0 0fc1e6c1 10389187 10b91b61 10cb8762 11857de3 11a8b2da 1209fdfe 1214515f 121b644e 126a1eb5 12d8be66 13165e1e 13e593e9 13f0995f 14e29924 1506feec 1634aa6a 165af39b 1962da11 19ae3e01 19c31403 19da6524 19e9ab80 1a5d80b1 1a655d1f 1ada66b7 1ae563d8 1ae9ad13 1b700bb2 1b8b6fcd 1ba26a84 1bcf8a5f 1bda684a 1be5656b 1be9aea6 1beaaf8c 1c0ad738 1c3f848a 1c895f28 1c92c195 1cda69dd 1ce566fe 1ce9b039 1ceab11f 1cf7b8e4 1d4bdf1a 1dd11acc 1dda6b70 1de56891 1deab2b2 1df7ba77 1e02b798 1e389046 1e5ef330 1e84208e 1ed11c5f 1eeab445 1eeefd80 1ef7bc0a 1f02b92b 1fd11df2 1ff7bd9d 2002babe 2043db11 20766728 20b25f7d 20d11f85 20d74895 2102bc51 213545db 21c6c05d 21d3c13a 22121705 22f7c256 230baca6 23d66779 24545340 24a41b28 24c056ec 2513cde7 2575ac91 264572d4 265e4487 26685f7c 267af845 26d31264 26f6055d 2732d0ab 27e5784f 28c29d7d 28fa0a5f 2911ba4b 2937075b 29591fe0 2a14acdd 2a761426 2ac5ebef 2adf8020 2b31c978 2b84ec11 2b9fc76c 2ba85031 2bb591b4 2cdbbfc5 2cf27631 2cf7131f 2d02cf35 2d31cc9e 2d69b2d3 2e3a711f 2eb3a28b 2ec6366a 2ec6905c 303018fb 304184c9 30ead09b 31165a29 311eaf2a 3174a704 31821190 338438ae 34543524 3477c777 34d13f01 354045aa 35e9d794 36281c97 36be193c 36fffca4 37037f45 376334db 37ff6537 3835ce18 38779ee1 38b1bf19 38bf7d79 392442c4 39729ad9 39d7231b 3ab5fe9c 3ae66b0a 3aef2994 3aff69f0 3b0002f0 3b3cbcf3 3bef2b27 3bfa2848 3bff6b83 3c000483 3cd68ed4 3cd727d4 3ce66e30 3cef2cba 3cfa29db 3cff6d16 3d000616 3dd69067 3dd72967 3dd84b53 3ddbda88 3de66fc3 3def2e4d 3dfa2b6e 3dff6ea9 3e0007a9 3e46dfe3 3e688591 3ed691fa 3ed72afa 3edbdc1b 3ee67156 3efa2d01 3f129b41 3f3a6314 3f5bbf97 3f9f8ad1 3fd6938d 3fdbddae 3fe672e9 406aa837 40c34785 40dbdf41 41225897 41cb3c56 421d402e 421e80c8 42636c5e 433aa711 436336f3 436c43dd 43746902 4393dce8 446d5502 44e67f6b 455d63c3 45c1d61c 461d467a 465c9833 46728655 46f89055 471f7c23 47397df7 478d977d 47fba9d2 49437c54 494b9b2d 4a3120f1 4acc9a94 4b205ce5 4d4d93f9 4d8caeec 4e233f9e 4e90c06c 4f881953 51021296 510ae0ee 51186651 51680aa1 516ba759 51cfe77a 5273f1a3 53173853 53e1dac2 540a2f01 544aed2c 54cf90f3 54deba05 551c4e18 553a61d4 57190143 57343e0a 5738ca53 57f650ba 58c5c0af 5914885b 5932e2ee 59569b16 5985a5d2 59d8fad4 5a6a11ee 5acaa4af 5b05a340 5b118a13 5b1915ce 5b42b36b 5b6a5c82 5bb9b53e 5bce9a17 5bd8fe38 5bfbc94e 5c142e60 5c73aa8c 5cd8ffcb 5cde49ec 5cfe7fc7 5d142ff3 5d29141e 5d872b41 5dd9015e 5dde4b7f 5deb5344 5dfc2ca0 5e143186 5e73adb2 5e91702e 5ece9ed0 5ed902f1 5ede4d12 5eeb54d7 5efc2e33 5f143319 5fc72923 5fde4ea5 5fe33600 5feb566a 5ffc2fc6 60798b42 60e29973 60eb57fd 60fc3159 612cc2dc 61e84e06 6250dd2e 6288fe35 629de7c7 6328edb6 641078b8 64eb5e49 6511c92b 658f3d29 65e25825 66953d8c 670737ec 688ee882 6897037c 68a2f555 68e3063f 69527c1d 69d8bed0 69d91442 6a1e97c1 6abdf5b2 6aeda652 6b094e9d 6be69711 6bed0ee5 6c347742 6c66dd0d 6d716edc 6df707b6 6ecf5bb8 6f4ccf74 6fd5104b 6ffd27ce 7044f414 7122f1c4 7155778e 71cbca8f 71e10f06 71e8e16d 71eec814 72de6c8e 72fc092e 72fcd06b 7380b926 745e0293 75459ac6 755ccba2 757822df 7632fe65 76709cf8 7676c2e3 770efac4 77598e5f 7786487f 77d6f19b 78026fd4 783f5eef 78521233 787b9d3f 78f39897 79145c07 79e58c27 7a3fe792 7aa2ae10 7acf6e9c 7ad5219c 7b075768 7b46ac84 7b523160 7b67206d 7ba7182d 7bce3faf 7bcf702f 7bd5232f 7be19cbb 7be2c3f4 7be876f4 7bf39d50 7c0758fb 7c2df792 7c795abf 7c9df598 7ccf71c2 7cd524c2 7cda0ac7 7ce2c587 7ce87887 7ced29a8 7cedc2a8 7cf39ee3 7cfc5d6d 7d075a8e 7dcf7355 7dd52655 7de2c71a 7de7b5ed 7de87a1a 7ded2b3b 7dedc43b 7df3a076 7e075c21 7e0e10b0 7ee2c8ad 7ee87bad 7eed2cce 7eedc5ce 7ef3a209 7fed2e61 7fedc761 802effa9 805c299d 807a3425 8108dee0 81aa382f 8240c725 82f916b7 8358dbed 83f647a1 845e821c 8527f150 85a539cb 867f4977 86841597 86ac29d4 87854596 87e94166 885afe68 88754783 888d98f8 8910e538 891e03d0 8968d9da 8977eb2e 897cc1cd 89f18048 8a1b2d51 8a758eb8 8a7b3411 8b223992 8b580840 8ba31ef8 8c137e58 8ca7d135 8ce3987c 8d0bf0ae 8d680099 8da3221e 8da99e61 8dc51c60 8de8b330 8e1a5bde 8e2efc6a 8e57b486 8e8afb72 8e8f0c1c 8f7ab605 8f8914fd 8f8ac8b3 8fe8d594 9064db76 906f7ece 90cf73b8 90d5d193 9135432c 91723961 9194c6e6 920a14c6 922ca192 922e09d3 92b1a5d4 92be9d3a 944c5ad6 944cd011 94bd1174 94c52019 94e64386 9548a359 95c49835 95e4bc1a 965d22e4 9694c4eb 97259b9f 9854c186 99362366 9961bf18 99a1a4fa 99edd112 99f8230a 9a09fdc6 9a20b45a 9a91abeb 9ac0c0be 9b13874b 9c01202b 9c68273c 9c99c408 9ce0dc63 9d4347a8 9d7abfb6 9d9739d3 9dba740e 9dbbb178 9dda6d93 9e0a3420 9e1072b3 9e1ce512 9e9c2f3d 9ed5fc5d 9f209d02 9f28b8a7 9f47831c 9f8a4a19 9f9ad573 9fed72c9 a0129169 a02c9089 a068455a a0d066cb a0d59f83 a0d5affe a11836b2 a123655d a16a350a a175d8ec a36a7f33 a39a69a2 a3ed0326 a47027c1 a4bfc922 a4ceffe2 a514a760 a59b4b90 a5a32a19 a62d9cb3 a6b5f3ba a6c3f2df a71a4d79 a728e747 a7b82b4e a84daaa4 a85ff1b0 a8e342b3 ab861ca1 abc16126 abc73bc6 aca6dfdc adad27d4 aebcf870 aeff7e0d af943d90 af99c5a1 b089fc27 b0b5b4c3 b0e98390 b1128a2c b12b434b b1c73bec b238450d b328bf99 b436a1a7 b4408773 b46c47b1 b49a7f8a b4a4307d b4cd4384 b50c76e6 b6280e56 b8129b96 b91fcc17 b9259045 b9545a04 b9f3a054 ba888708 ba97bc0d bb626838 bb842d84 bba60a53 bbc4c75c bc52fcf9 bcc9a3ff bd326bb2 bd36ccca bd4ee2c5 bd6aa0a6 be419df2 be86c158 bf007384 bf54904e bf9e26dd bff31c06 c01492bd c01553ef c0296d4f c08fd7db c0ebd7e8 c0f73913 c1d70447 c22cc782 c2b07b4c c2f5f329 c366bc33 c3a7b0eb c48c7704 c555cefe c64dfa51 c6c95263 c7198c86 c79eee93 c7bdff49 c82019d0 c858d729 c8ba6561 c8ff20cb cae70042 cb04e1aa cb0d3ec0 cb6740e6 cc4661fb cc79e870 cd744d48 cdc39849 ce17ae5a ce3690ca cec551b6 cf0b3a91 cf665638 cfc61266 d0813558 d0cf7fa2 d1722abd d1b4fd7a d226d753 d28d7297 d2940bd4 d29983d9 d2afebbb d3a6301b d411b368 d4b89f49 d4d599f8 d524f24d d53e2356 d5ce1d82 d5f61372 d655323c d65823b2 d68d78e3 d6bf67c6 d6cb8b5e d6f8ecf5 d7ac6e60 d7fa0a16 d80aab69 d9db8b84 da1ecbea da5eb8e9 da66e5d4 daa3f80a daf16817 db1a5b9b db312e25 db49fd17 dbbb56a1 dc03bee8 dc942ba7 dcb0eecd dd01f4fa dd87072d dd879fc7 de066e7c e029ec0d e04028f9 e2110c97 e275dc0f e28e4f82 e3308cfb e3ce720f e4870ea6 e4962b37 e5b3be61 e5c28ef8 e677d7c6 e6d3e6c4 e8f54853 e8f58830 e953c326 e99602e8 e9c88310 eb56d08e ebc49119 ebe33f1f ec651c33 eced48e4 ed3de383 ed42377a ed6191fd ee37ec0e ee380b3c ee63c6ec ee7175fb ee8d2bbd eeb3c803 eeb44e37 ef382347 ef44d624 ef85b96a ef8a5506 eff08b64 f1f70c0a f22a9b06 f263358e f2e3962a f47bcf6d f50f2330 f539ad7d f53dbbf5 f6136231 f6514553 f66824ba f6c5710a f7246bbf f74a6e6f f826ee1c f89afff6 f90a5928 fa2f450b fba2e07e fbfffe4f fc0b3e8b fd32e5f2 fdd94789 fdfd4d84 fe07b602 fe0cb28f fea748b1 fea95d5c fec6fa73 ff25c978".split(" "),u="a0-01 a0-02 a0-03 a0-04 a0-05 a0-06 a0-07 a0-08 a0-09 a0-10 a0-11 a0-12 a0-13 a0-14 a0-15 a0-16 a0-17 a0-18 a0-19 a0-20 a0-21 a0-22 a0-23 a0-24 t01 t02 t03 t04 t05 t06 t07 t08 t09 t10 t11 t12 t13 t14 t15 t16 t17 t18 t19 t20 t21 t22 t23 t24 t25 t26 t27 t28".split(" ");a.forEach(function(k){AUDIO[k]=1;});u.forEach(function(k){AUDIO_UZ[k]=1;});})();
  /*AUDIO-END*/

  A.Alifbo = {
    PASS: PASS, LETTERS: LETTERS, LESSONS: LESSONS, STEPS: STEPS, BOOK: B, HW: HW,
    letter: L, nameOf: nameOf, forms: forms, withMark: withMark, translit: translit, blocks: blocks, readItems: readItems,
    akey: akey, audioText: audioText, audioUrl: audioUrl, uzUrl: uzUrl, audioKey: audioKey, AUDIO: AUDIO, AUDIO_UZ: AUDIO_UZ,
    byId: byId, buildTest: buildTest, buildPractice: buildPractice, buildHomework: buildHomework, hwTasks: hwTasks,
    publicTest: publicTest, grade: grade, statuses: statuses, view: view, isDone: isDone, testOk: testOk, hwOk: hwOk
  };
})(typeof window !== 'undefined' ? window : globalThis);
