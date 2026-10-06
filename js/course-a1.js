/* Onlayn kurs: A1 daraja — darslar mazmuni va kurs mantiqi.
   Brauzerda ham, serverda ham bir xil ishlaydi (server/shared.js orqali
   yuklanadi): test savollari, baholash va darslar ochilishi qoidasi
   BITTA joyda — o'quvchi brauzerdagi natijani "chizib" bera olmaydi,
   server javoblarni o'zi qayta tekshiradi.

   Mazmun: darslikning 2-bo'limi (Oila) va 3-bo'limi (Uy-joy) mavzulari va
   so'z boyligi asosida yozilgan original darslar. Dialog va matnlar
   markaz uchun alohida tuzilgan.

   Har bir dars bosqichlari:
     1. so'zlar   — yangi so'zlar, animatsiya, talaffuz
     2. dialog    — matn, tarjima, ovoz
     3. qoida     — grammatika va misollar
     4. mashq     — savol-javob (darhol tekshiriladi)
     5. test      — so'zlar bo'yicha, 80% dan o'tish kerak
     6. vazifa    — uy vazifasi: avtomatik qism + ustoz tekshiradigan qism
   Keyingi dars: test o'tilgan VA vazifa topshirilgan bo'lsa ochiladi.
   Ustoz istalgan darsni qo'lda ham ochib bera oladi.                      */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};

  var PASS = 80;

  var UNITS = [
    { id: 'u2', n: 2, title: 'Oila', ar: 'الأُسْرَةُ' },
    { id: 'u3', n: 3, title: 'Uy-joy', ar: 'السَّكَنُ' }
  ];

  /* so'z: ar — harakatli yozuv, tr — o'qilishi, uz — tarjima, anim — animatsiya kaliti */
  function w(ar, tr, uz, anim, extra) {
    var o = { ar: ar, tr: tr, uz: uz, anim: anim };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  var LESSONS = [
    /* ===================== 2-BO'LIM: OILA ===================== */
    {
      id: 'a1-01', unit: 'u2', n: 1,
      title: 'Bu kim?', titleAr: 'مَنْ هَذَا؟',
      goal: 'Oila a’zolarini tanishtirish: «Bu — otam», «Bu — onam».',
      words: [
        w('أُسْرَةٌ', 'usratun', 'oila', 'family'),
        w('أَبٌ', 'abun', 'ota', 'father'),
        w('أُمٌّ', 'ummun', 'ona', 'mother'),
        w('أَخٌ', 'axun', 'aka, uka', 'brother'),
        w('أُخْتٌ', 'uxtun', 'opa, singil', 'sister'),
        w('جَدٌّ', 'jaddun', 'bobo', 'grandpa'),
        w('جَدَّةٌ', 'jaddatun', 'buvi', 'grandma'),
        w('صُورَةٌ', 'suuratun', 'surat', 'photo')
      ],
      dialog: {
        title: 'Oila surati',
        scene: 'Maryam dugonasi Zaynabning uyida. Zaynab oilaviy suratni ko’rsatyapti.',
        lines: [
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'السَّلَامُ عَلَيْكُمْ يَا زَيْنَبُ.', uz: 'Assalomu alaykum, Zaynab.' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'وَعَلَيْكُمُ السَّلَامُ. انْظُرِي، هَذِهِ صُورَةُ أُسْرَتِي.', uz: 'Va alaykum assalom. Qara, bu oilamning surati.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'مَا شَاءَ اللهُ! مَنْ هَذَا؟', uz: 'Mashaalloh! Bu kim?' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'هَذَا أَبِي، وَهَذَا جَدِّي.', uz: 'Bu otam, bu esa bobom.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'وَمَنْ هَذِهِ؟', uz: 'Bu (ayol) kim?' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'هَذِهِ أُمِّي، وَهَذِهِ جَدَّتِي.', uz: 'Bu onam, bu esa buvim.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'وَمَنْ هَذَا الْوَلَدُ؟', uz: 'Bu bola kim?' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'هَذَا أَخِي يُوسُفُ، وَهَذِهِ أُخْتِي.', uz: 'Bu ukam Yusuf, bu esa singlim.' }
        ]
      },
      grammar: {
        title: 'هَذَا va هَذِهِ — «bu»',
        points: [
          {
            rule: 'Erkak jinsidagi so’z uchun هَذَا, ayol jinsidagi so’z uchun هَذِهِ ishlatiladi.',
            ex: [{ ar: 'هَذَا أَبٌ', uz: 'Bu — ota' }, { ar: 'هَذِهِ أُمٌّ', uz: 'Bu — ona' }]
          },
          {
            rule: 'So’z oxiridagi ة (ta marbuta) ko’pincha ayol jinsini bildiradi.',
            ex: [{ ar: 'هَذِهِ صُورَةٌ', uz: 'Bu — surat' }, { ar: 'هَذِهِ جَدَّةٌ', uz: 'Bu — buvi' }]
          },
          {
            rule: 'So’z oxiriga ـِي qo’shilsa «mening» degan ma’no beradi.',
            ex: [{ ar: 'أَبِي', uz: 'otam' }, { ar: 'أُمِّي', uz: 'onam' }, { ar: 'أُخْتِي', uz: 'singlim' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: 'To’g’ri so’zni tanlang: ___ أُمِّي', options: ['هَذَا', 'هَذِهِ'], answer: 1 },
        { type: 'choice', q: 'To’g’ri so’zni tanlang: ___ جَدِّي', options: ['هَذَا', 'هَذِهِ'], answer: 0 },
        { type: 'choice', q: '«Bu kim?» arabchada qanday?', options: ['مَنْ هَذَا؟', 'أَيْنَ هَذَا؟', 'مَا هَذَا؟'], answer: 0 },
        { type: 'choice', q: 'أُخْتِي so’zining ma’nosi:', options: ['ukam', 'singlim', 'onam'], answer: 1 },
        { type: 'order', uz: 'Bu — mening oilamning surati.', words: ['هَذِهِ', 'صُورَةُ', 'أُسْرَتِي'] }
      ],
      homework: {
        auto: [
          { q: '___ صُورَةٌ', options: ['هَذَا', 'هَذِهِ'], answer: 1 },
          { q: '___ أَخٌ', options: ['هَذَا', 'هَذِهِ'], answer: 0 },
          { q: '___ جَدَّةٌ', options: ['هَذَا', 'هَذِهِ'], answer: 1 },
          { q: '«otam» — arabchada:', options: ['أَبِي', 'أَخِي', 'جَدِّي'], answer: 0 },
          { q: '«buvim» — arabchada:', options: ['أُمِّي', 'جَدَّتِي', 'أُخْتِي'], answer: 1 }
        ],
        write: [
          { prompt: 'Oilangizni 4 ta gap bilan tanishtiring.', hint: 'Masalan: هَذَا أَبِي. هَذِهِ أُمِّي.' }
        ]
      }
    },
    {
      id: 'a1-02', unit: 'u2', n: 2,
      title: 'Kasblar', titleAr: 'هُوَ مُهَنْدِسٌ',
      goal: 'Kim nima ish qilishini aytish: «U — shifokor», «U — o’qituvchi».',
      words: [
        w('طَبِيبٌ', 'tabiibun', 'shifokor (erkak)', 'doctor'),
        w('طَبِيبَةٌ', 'tabiibatun', 'shifokor (ayol)', 'doctorF'),
        w('مُهَنْدِسٌ', 'muhandisun', 'muhandis', 'engineer'),
        w('مُعَلِّمٌ', 'mu‘allimun', 'o’qituvchi (erkak)', 'teacher'),
        w('مُعَلِّمَةٌ', 'mu‘allimatun', 'o’qituvchi (ayol)', 'teacherF'),
        w('طَالِبٌ', 'toolibun', 'talaba (yigit)', 'student'),
        w('طَالِبَةٌ', 'toolibatun', 'talaba (qiz)', 'studentF'),
        w('ابْنٌ', 'ibnun', 'o’g’il', 'son'),
        w('ابْنَةٌ', 'ibnatun', 'qiz (farzand)', 'daughter')
      ],
      dialog: {
        title: 'Kim nima ish qiladi?',
        scene: 'Maryam Zaynabdan oilasi haqida so’rayapti.',
        lines: [
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'مَنْ هَذَا يَا زَيْنَبُ؟', uz: 'Bu kim, Zaynab?' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'هَذَا أَبِي، هُوَ طَبِيبٌ.', uz: 'Bu otam, u shifokor.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'وَهَذِهِ أُمُّكِ؟ هَلْ هِيَ طَبِيبَةٌ أَيْضًا؟', uz: 'Bu onangmi? U ham shifokormi?' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'لَا، هِيَ مُعَلِّمَةٌ.', uz: 'Yo’q, u o’qituvchi.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'وَمَنْ هَذَا؟', uz: 'Bu-chi, kim?' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'هَذَا أَخِي عَلِيٌّ، هُوَ مُهَنْدِسٌ.', uz: 'Bu akam Ali, u muhandis.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'وَهَذِهِ الْبِنْتُ؟', uz: 'Bu qiz-chi?' },
          { who: 'زَيْنَبُ', whoUz: 'Zaynab', ar: 'هَذِهِ ابْنَةُ أَخِي، هِيَ طَالِبَةٌ.', uz: 'Bu akamning qizi, u talaba.' }
        ]
      },
      grammar: {
        title: 'هُوَ va هِيَ — «u»',
        points: [
          {
            rule: 'Erkak haqida هُوَ, ayol haqida هِيَ deyiladi.',
            ex: [{ ar: 'هُوَ مُعَلِّمٌ', uz: 'U — o’qituvchi (erkak)' }, { ar: 'هِيَ مُعَلِّمَةٌ', uz: 'U — o’qituvchi (ayol)' }]
          },
          {
            rule: 'Ko’p kasb nomlarida ة qo’shilsa, ayol jinsi hosil bo’ladi.',
            ex: [{ ar: 'طَبِيبٌ ← طَبِيبَةٌ', uz: 'shifokor' }, { ar: 'طَالِبٌ ← طَالِبَةٌ', uz: 'talaba' }]
          },
          {
            rule: 'Savol هَلْ bilan boshlanadi, javob — نَعَمْ (ha) yoki لَا (yo’q).',
            ex: [{ ar: 'هَلْ هُوَ طَبِيبٌ؟ — نَعَمْ', uz: 'U shifokormi? — Ha' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: 'زَيْنَبُ ___ طَالِبَةٌ', options: ['هُوَ', 'هِيَ'], answer: 1 },
        { type: 'choice', q: 'عَلِيٌّ ___ مُهَنْدِسٌ', options: ['هُوَ', 'هِيَ'], answer: 0 },
        { type: 'choice', q: 'مُعَلِّمٌ so’zining ayol jinsi:', options: ['مُعَلِّمَةٌ', 'مُعَلِّمُونَ', 'مُعَلِّمِي'], answer: 0 },
        { type: 'choice', q: 'Dialogda Zaynabning onasi kim?', options: ['طَبِيبَةٌ', 'مُعَلِّمَةٌ', 'طَالِبَةٌ'], answer: 1 },
        { type: 'order', uz: 'U shifokormi?', words: ['هَلْ', 'هُوَ', 'طَبِيبٌ؟'] }
      ],
      homework: {
        auto: [
          { q: 'فَاطِمَةُ ___ طَبِيبَةٌ', options: ['هُوَ', 'هِيَ'], answer: 1 },
          { q: 'يُوسُفُ ___ طَالِبٌ', options: ['هُوَ', 'هِيَ'], answer: 0 },
          { q: '«o’qituvchi (ayol)»:', options: ['مُعَلِّمٌ', 'مُعَلِّمَةٌ', 'مُهَنْدِسٌ'], answer: 1 },
          { q: '«o’g’il»:', options: ['ابْنٌ', 'ابْنَةٌ', 'أَبٌ'], answer: 0 },
          { q: '«Ha» arabchada:', options: ['لَا', 'نَعَمْ', 'هَلْ'], answer: 1 }
        ],
        write: [
          { prompt: 'Oilangizdagi 3 kishining kasbini yozing.', hint: 'Masalan: أَبِي مُهَنْدِسٌ. أُمِّي مُعَلِّمَةٌ.' }
        ]
      }
    },
    {
      id: 'a1-03', unit: 'u2', n: 3,
      title: 'Qayerda?', titleAr: 'أَيْنَ؟',
      goal: 'Narsa va odam qayerda ekanini so’rash va aytish.',
      words: [
        w('غُرْفَةٌ', 'gurfatun', 'xona', 'room'),
        w('حَمَّامٌ', 'hammaamun', 'hammom, yuvinish xonasi', 'bathroom'),
        w('مَسْجِدٌ', 'masjidun', 'masjid', 'mosque'),
        w('مُصَلًّى', 'musallan', 'namozxona', 'prayerRoom'),
        w('مِعْطَفٌ', 'mi‘tafun', 'palto', 'coat'),
        w('نَظَّارَةٌ', 'nazzaaratun', 'ko’zoynak', 'glasses'),
        w('شَجَرَةٌ', 'shajaratun', 'daraxt', 'tree'),
        w('هُنَا', 'hunaa', 'shu yerda', 'here')
      ],
      dialog: {
        title: 'Ertalab uyda',
        scene: 'Ota ishga shoshyapti va narsalarini qidiryapti.',
        lines: [
          { who: 'الْأَبُ', whoUz: 'Ota', ar: 'أَيْنَ نَظَّارَتِي؟', uz: 'Ko’zoynagim qayerda?' },
          { who: 'الْأُمُّ', whoUz: 'Ona', ar: 'النَّظَّارَةُ فِي الْغُرْفَةِ.', uz: 'Ko’zoynak xonada.' },
          { who: 'الْأَبُ', whoUz: 'Ota', ar: 'وَأَيْنَ الْمِعْطَفُ؟', uz: 'Palto-chi, qayerda?' },
          { who: 'الْأُمُّ', whoUz: 'Ona', ar: 'الْمِعْطَفُ هُنَا.', uz: 'Palto shu yerda.' },
          { who: 'الْأَبُ', whoUz: 'Ota', ar: 'شُكْرًا. وَأَيْنَ يُوسُفُ؟', uz: 'Rahmat. Yusuf qayerda?' },
          { who: 'الْأُمُّ', whoUz: 'Ona', ar: 'يُوسُفُ فِي الْمَسْجِدِ.', uz: 'Yusuf masjidda.' },
          { who: 'الْأَبُ', whoUz: 'Ota', ar: 'وَأَيْنَ فَاطِمَةُ؟', uz: 'Fotima-chi?' },
          { who: 'الْأُمُّ', whoUz: 'Ona', ar: 'فَاطِمَةُ فِي الْمُصَلَّى.', uz: 'Fotima namozxonada.' }
        ]
      },
      grammar: {
        title: 'أَيْنَ؟ — فِي',
        points: [
          {
            rule: 'أَيْنَ — «qayerda?». Javobda فِي — «…da, ichida» ishlatiladi.',
            ex: [{ ar: 'أَيْنَ يُوسُفُ؟ — فِي الْغُرْفَةِ', uz: 'Yusuf qayerda? — Xonada' }]
          },
          {
            rule: 'ال — aniqlik artikli («o’sha, ma’lum»). ال qo’shilganda so’z oxiridagi tanvin (ـٌ) tushadi.',
            ex: [{ ar: 'غُرْفَةٌ ← الْغُرْفَةُ', uz: 'xona ← (o’sha) xona' }]
          },
          {
            rule: 'فِي dan keyingi so’z oxiri kasra (ـِ) bilan o’qiladi.',
            ex: [{ ar: 'فِي الْمَسْجِدِ', uz: 'masjidda' }, { ar: 'فِي الْحَمَّامِ', uz: 'yuvinish xonasida' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: 'Ko’zoynak qayerda edi?', options: ['فِي الْغُرْفَةِ', 'فِي الْمَسْجِدِ', 'هُنَا'], answer: 0 },
        { type: 'choice', q: '«Qayerda?» so’zi:', options: ['مَنْ؟', 'أَيْنَ؟', 'هَلْ؟'], answer: 1 },
        { type: 'choice', q: 'To’g’ri yozilishini tanlang: «masjidda»', options: ['فِي مَسْجِدٌ', 'فِي الْمَسْجِدِ', 'فِي الْمَسْجِدُ'], answer: 1 },
        { type: 'choice', q: 'هُنَا so’zining ma’nosi:', options: ['u yerda', 'shu yerda', 'qayerda'], answer: 1 },
        { type: 'order', uz: 'Palto qayerda?', words: ['أَيْنَ', 'الْمِعْطَفُ؟'] }
      ],
      homework: {
        auto: [
          { q: '«xona»:', options: ['غُرْفَةٌ', 'شَجَرَةٌ', 'صُورَةٌ'], answer: 0 },
          { q: '«xonada»:', options: ['فِي الْغُرْفَةِ', 'فِي غُرْفَةٌ', 'الْغُرْفَةُ'], answer: 0 },
          { q: 'Dialogda Yusuf qayerda?', options: ['فِي الْحَمَّامِ', 'فِي الْمَسْجِدِ', 'فِي الْغُرْفَةِ'], answer: 1 },
          { q: '«ko’zoynak»:', options: ['مِعْطَفٌ', 'نَظَّارَةٌ', 'مُصَلًّى'], answer: 1 },
          { q: 'أَيْنَ ___ ؟ — «Palto qayerda?»', options: ['الْمِعْطَفُ', 'الْمِعْطَفِ', 'مِعْطَفًا'], answer: 0 }
        ],
        write: [
          { prompt: 'Uyingizdagi 3 narsa qayerda ekanini yozing.', hint: 'Masalan: الْمِعْطَفُ فِي الْغُرْفَةِ.' }
        ]
      }
    },
    {
      id: 'a1-04', unit: 'u2', n: 4,
      title: 'Yusufning tongi', titleAr: 'صَبَاحُ يُوسُفَ',
      goal: 'O’tgan zamon fe’llari bilan kun tartibini aytib berish.',
      words: [
        w('تَوَضَّأَ', 'tavaddo’a', 'tahorat oldi', 'wudu'),
        w('صَلَّى', 'solla', 'namoz o’qidi', 'pray'),
        w('جَلَسَ', 'jalasa', 'o’tirdi', 'sit'),
        w('قَرَأَ', 'qoro’a', 'o’qidi', 'read'),
        w('لَبِسَ', 'labisa', 'kiydi', 'wear'),
        w('خَلَعَ', 'xola‘a', 'yechdi', 'takeOff'),
        w('أَخَذَ', 'axaza', 'oldi', 'take'),
        w('أَعْطَى', 'a‘to', 'berdi', 'give')
      ],
      dialog: {
        title: 'Yusufning tongi (matn)',
        scene: 'Matnni o’qing va har bir gapni tinglang.',
        lines: [
          { who: '١', whoUz: '1', ar: 'تَوَضَّأَ يُوسُفُ.', uz: 'Yusuf tahorat oldi.' },
          { who: '٢', whoUz: '2', ar: 'ثُمَّ صَلَّى الْفَجْرَ فِي الْمَسْجِدِ.', uz: 'Keyin bomdodni masjidda o’qidi.' },
          { who: '٣', whoUz: '3', ar: 'جَلَسَ فِي الْغُرْفَةِ وَقَرَأَ الْقُرْآنَ.', uz: 'Xonada o’tirdi va Qur’on o’qidi.' },
          { who: '٤', whoUz: '4', ar: 'لَبِسَ يُوسُفُ الْمِعْطَفَ.', uz: 'Yusuf paltoni kiydi.' },
          { who: '٥', whoUz: '5', ar: 'أَخَذَ الْكِتَابَ مِنَ الْمَكْتَبِ.', uz: 'Kitobni stoldan oldi.' },
          { who: '٦', whoUz: '6', ar: 'وَأَعْطَى أُخْتَهُ صُورَةً جَمِيلَةً.', uz: 'Va singlisiga chiroyli surat berdi.' }
        ]
      },
      grammar: {
        title: 'O’tgan zamon fe’li — الْمَاضِي',
        points: [
          {
            rule: 'Arab tilida fe’lning asosiy shakli — «u (erkak) qildi». Ko’pincha 3 harfdan iborat: جَلَسَ، قَرَأَ، أَخَذَ.',
            ex: [{ ar: 'جَلَسَ يُوسُفُ', uz: 'Yusuf o’tirdi' }]
          },
          {
            rule: 'Ish-harakatni ayol bajarsa, fe’l oxiriga ـَتْ qo’shiladi.',
            ex: [{ ar: 'جَلَسَتْ فَاطِمَةُ', uz: 'Fotima o’tirdi' }, { ar: 'قَرَأَتْ', uz: '(u ayol) o’qidi' }]
          },
          {
            rule: 'ثُمَّ — «keyin», وَ — «va». Ular gaplarni bog’laydi.',
            ex: [{ ar: 'تَوَضَّأَ ثُمَّ صَلَّى', uz: 'tahorat oldi, keyin namoz o’qidi' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: 'Yusuf masjidda nima qildi?', options: ['صَلَّى', 'لَبِسَ', 'خَلَعَ'], answer: 0 },
        { type: 'choice', q: 'فَاطِمَةُ ___ — «Fotima o’tirdi»', options: ['جَلَسَ', 'جَلَسَتْ'], answer: 1 },
        { type: 'choice', q: 'لَبِسَ ning teskarisi:', options: ['أَخَذَ', 'خَلَعَ', 'قَرَأَ'], answer: 1 },
        { type: 'choice', q: 'ثُمَّ so’zining ma’nosi:', options: ['va', 'keyin', 'lekin'], answer: 1 },
        { type: 'order', uz: 'Yusuf Qur’on o’qidi.', words: ['قَرَأَ', 'يُوسُفُ', 'الْقُرْآنَ'] }
      ],
      homework: {
        auto: [
          { q: '«tahorat oldi»:', options: ['تَوَضَّأَ', 'صَلَّى', 'جَلَسَ'], answer: 0 },
          { q: '«berdi»:', options: ['أَخَذَ', 'أَعْطَى', 'لَبِسَ'], answer: 1 },
          { q: 'مَرْيَمُ ___ الْكِتَابَ — «Maryam kitobni o’qidi»', options: ['قَرَأَ', 'قَرَأَتْ'], answer: 1 },
          { q: 'Matnda Yusuf nimani kiydi?', options: ['الْمِعْطَفَ', 'النَّظَّارَةَ', 'الْكِتَابَ'], answer: 0 },
          { q: '«oldi»:', options: ['خَلَعَ', 'أَخَذَ', 'أَعْطَى'], answer: 1 }
        ],
        write: [
          { prompt: 'Bugungi tongingizni 4 ta fe’l bilan yozing.', hint: 'Masalan: تَوَضَّأْتُ… yoki u haqida: تَوَضَّأَتْ أُمِّي ثُمَّ صَلَّتْ.' }
        ]
      }
    },

    /* ===================== 3-BO'LIM: UY-JOY ===================== */
    {
      id: 'a1-05', unit: 'u3', n: 5,
      title: 'Mening uyim', titleAr: 'بَيْتِي',
      goal: 'Uy va xonalarni tasvirlash: «Uyimizda oshxona va bog’ bor».',
      words: [
        w('بَيْتٌ', 'baytun', 'uy', 'house'),
        w('شَقَّةٌ', 'shaqqatun', 'kvartira', 'apartment'),
        w('غُرْفَةُ النَّوْمِ', 'gurfatun-nawm', 'yotoqxona', 'bedroom'),
        w('مَطْبَخٌ', 'matbaxun', 'oshxona', 'kitchen'),
        w('صَالَةٌ', 'soolatun', 'mehmonxona (zal)', 'livingRoom'),
        w('بَابٌ', 'baabun', 'eshik', 'door'),
        w('نَافِذَةٌ', 'naafizatun', 'deraza', 'window'),
        w('حَدِيقَةٌ', 'hadiiqatun', 'bog’', 'garden')
      ],
      dialog: {
        title: 'Qayerda yashaysiz?',
        scene: 'Ikki qo’shni ayol tanishyapti.',
        lines: [
          { who: 'سَارَةُ', whoUz: 'Sora', ar: 'أَيْنَ تَسْكُنِينَ يَا مَرْيَمُ؟', uz: 'Qayerda yashaysiz, Maryam?' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'أَسْكُنُ فِي شَقَّةٍ قَرِيبَةٍ.', uz: 'Yaqindagi kvartirada yashayman.' },
          { who: 'سَارَةُ', whoUz: 'Sora', ar: 'هَلِ الشَّقَّةُ كَبِيرَةٌ؟', uz: 'Kvartira kattami?' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'لَا، هِيَ صَغِيرَةٌ. فِيهَا صَالَةٌ وَمَطْبَخٌ وَغُرْفَةُ نَوْمٍ.', uz: 'Yo’q, u kichik. Unda zal, oshxona va yotoqxona bor.' },
          { who: 'سَارَةُ', whoUz: 'Sora', ar: 'أَنَا أَسْكُنُ فِي بَيْتٍ، وَفِي الْبَيْتِ حَدِيقَةٌ.', uz: 'Men uyda yashayman, uyda bog’ bor.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'مَا شَاءَ اللهُ! الْحَدِيقَةُ جَمِيلَةٌ.', uz: 'Mashaalloh! Bog’ chiroyli.' }
        ]
      },
      grammar: {
        title: 'Sifat va فِيهِ / فِيهَا',
        points: [
          {
            rule: 'Sifat otga jinsda moslashadi: ot ayol jinsida bo’lsa, sifatga ham ة qo’shiladi.',
            ex: [{ ar: 'بَيْتٌ كَبِيرٌ', uz: 'katta uy' }, { ar: 'شَقَّةٌ كَبِيرَةٌ', uz: 'katta kvartira' }]
          },
          {
            rule: 'فِيهِ — «unda (erkak so’zda) bor», فِيهَا — «unda (ayol so’zda) bor».',
            ex: [{ ar: 'الْبَيْتُ فِيهِ حَدِيقَةٌ', uz: 'Uyda bog’ bor' }, { ar: 'الشَّقَّةُ فِيهَا مَطْبَخٌ', uz: 'Kvartirada oshxona bor' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: 'شَقَّةٌ ___ — «katta kvartira»', options: ['كَبِيرٌ', 'كَبِيرَةٌ'], answer: 1 },
        { type: 'choice', q: 'Maryam qayerda yashaydi?', options: ['فِي بَيْتٍ', 'فِي شَقَّةٍ', 'فِي حَدِيقَةٍ'], answer: 1 },
        { type: 'choice', q: 'الْبَيْتُ ___ حَدِيقَةٌ', options: ['فِيهِ', 'فِيهَا'], answer: 0 },
        { type: 'choice', q: 'مَطْبَخٌ — bu:', options: ['yotoqxona', 'oshxona', 'bog’'], answer: 1 },
        { type: 'order', uz: 'Uy katta.', words: ['الْبَيْتُ', 'كَبِيرٌ'] }
      ],
      homework: {
        auto: [
          { q: '«deraza»:', options: ['بَابٌ', 'نَافِذَةٌ', 'صَالَةٌ'], answer: 1 },
          { q: 'حَدِيقَةٌ ___ — «chiroyli bog’»', options: ['جَمِيلٌ', 'جَمِيلَةٌ'], answer: 1 },
          { q: 'الشَّقَّةُ ___ صَالَةٌ', options: ['فِيهِ', 'فِيهَا'], answer: 1 },
          { q: '«yotoqxona»:', options: ['غُرْفَةُ النَّوْمِ', 'الْمَطْبَخُ', 'الْحَمَّامُ'], answer: 0 },
          { q: 'Soraning uyida nima bor?', options: ['حَدِيقَةٌ', 'مِصْعَدٌ', 'مَسْجِدٌ'], answer: 0 }
        ],
        write: [
          { prompt: 'Uyingizni 3–4 gap bilan tasvirlang.', hint: 'Masalan: أَسْكُنُ فِي بَيْتٍ. فِي الْبَيْتِ مَطْبَخٌ كَبِيرٌ.' }
        ]
      }
    },
    {
      id: 'a1-06', unit: 'u3', n: 6,
      title: 'Uy jihozlari', titleAr: 'أَثَاثُ الْبَيْتِ',
      goal: 'Jihozlarni nomlash va «menda … bor» deyish.',
      words: [
        w('سَرِيرٌ', 'sariirun', 'karavot', 'bed'),
        w('كُرْسِيٌّ', 'kursiyyun', 'stul', 'chair'),
        w('مَكْتَبٌ', 'maktabun', 'yozuv stoli', 'desk'),
        w('خِزَانَةٌ', 'xizaanatun', 'shkaf', 'wardrobe'),
        w('ثَلَّاجَةٌ', 'sallaajatun', 'muzlatgich', 'fridge'),
        w('مِرْآةٌ', 'mir’aatun', 'ko’zgu', 'mirror'),
        w('سَجَّادَةٌ', 'sajjaadatun', 'gilam, joynamoz', 'carpet'),
        w('أَرِيكَةٌ', 'ariikatun', 'divan', 'sofa')
      ],
      dialog: {
        title: 'Yangi uyga ko’chish',
        scene: 'Ona va qizi narsalarni joylashtiryapti.',
        lines: [
          { who: 'الْأُمُّ', whoUz: 'Ona', ar: 'أَيْنَ أَضَعُ الْكُرْسِيَّ؟', uz: 'Stulni qayerga qo’yay?' },
          { who: 'الْبِنْتُ', whoUz: 'Qiz', ar: 'فِي غُرْفَتِي يَا أُمِّي، أَمَامَ الْمَكْتَبِ.', uz: 'Xonamga, onajon, stol oldiga.' },
          { who: 'الْأُمُّ', whoUz: 'Ona', ar: 'وَالْمِرْآةُ؟', uz: 'Ko’zgu-chi?' },
          { who: 'الْبِنْتُ', whoUz: 'Qiz', ar: 'الْمِرْآةُ فِي الْحَمَّامِ.', uz: 'Ko’zgu yuvinish xonasida.' },
          { who: 'الْأُمُّ', whoUz: 'Ona', ar: 'عِنْدَكِ سَرِيرٌ جَدِيدٌ، مَا شَاءَ اللهُ!', uz: 'Senda yangi karavot bor, mashaalloh!' },
          { who: 'الْبِنْتُ', whoUz: 'Qiz', ar: 'نَعَمْ، وَعِنْدِي خِزَانَةٌ كَبِيرَةٌ أَيْضًا.', uz: 'Ha, menda katta shkaf ham bor.' }
        ]
      },
      grammar: {
        title: 'عِنْدِي — «menda bor»',
        points: [
          {
            rule: 'عِنْدَ + egalik qo’shimchasi «…da bor» ma’nosini beradi.',
            ex: [{ ar: 'عِنْدِي', uz: 'menda bor' }, { ar: 'عِنْدَكَ / عِنْدَكِ', uz: 'senda bor (erkak / ayol)' }, { ar: 'عِنْدَهُ / عِنْدَهَا', uz: 'unda bor (erkak / ayol)' }]
          },
          {
            rule: 'أَمَامَ — «oldida», خَلْفَ — «orqasida», جَنْبَ — «yonida».',
            ex: [{ ar: 'الْكُرْسِيُّ أَمَامَ الْمَكْتَبِ', uz: 'Stul yozuv stoli oldida' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: '«Menda karavot bor»', options: ['عِنْدِي سَرِيرٌ', 'عِنْدَكَ سَرِيرٌ', 'سَرِيرِي'], answer: 0 },
        { type: 'choice', q: 'Ko’zgu qayerda?', options: ['فِي الْحَمَّامِ', 'فِي الْمَطْبَخِ', 'أَمَامَ الْمَكْتَبِ'], answer: 0 },
        { type: 'choice', q: 'ثَلَّاجَةٌ odatda qayerda bo’ladi?', options: ['فِي غُرْفَةِ النَّوْمِ', 'فِي الْمَطْبَخِ', 'فِي الْحَدِيقَةِ'], answer: 1 },
        { type: 'choice', q: 'أَمَامَ so’zining ma’nosi:', options: ['orqasida', 'oldida', 'ustida'], answer: 1 },
        { type: 'order', uz: 'Menda katta shkaf bor.', words: ['عِنْدِي', 'خِزَانَةٌ', 'كَبِيرَةٌ'] }
      ],
      homework: {
        auto: [
          { q: '«stul»:', options: ['كُرْسِيٌّ', 'سَرِيرٌ', 'مَكْتَبٌ'], answer: 0 },
          { q: '«divan»:', options: ['سَجَّادَةٌ', 'أَرِيكَةٌ', 'خِزَانَةٌ'], answer: 1 },
          { q: '«Unda (ayol) bor»:', options: ['عِنْدَهُ', 'عِنْدَهَا', 'عِنْدِي'], answer: 1 },
          { q: 'Qizda nima yangi?', options: ['سَرِيرٌ', 'مِرْآةٌ', 'ثَلَّاجَةٌ'], answer: 0 },
          { q: '«ko’zgu»:', options: ['مِرْآةٌ', 'نَافِذَةٌ', 'بَابٌ'], answer: 0 }
        ],
        write: [
          { prompt: 'Xonangizda nimalar borligini 4 ta gap bilan yozing.', hint: 'Masalan: عِنْدِي سَرِيرٌ. الْكُرْسِيُّ أَمَامَ الْمَكْتَبِ.' }
        ]
      }
    },
    {
      id: 'a1-07', unit: 'u3', n: 7,
      title: 'Bino va qo’shnilar', titleAr: 'الْعِمَارَةُ وَالْجِيرَانُ',
      goal: 'Qavat, yo’l va masofa haqida gapirish.',
      words: [
        w('طَابِقٌ', 'toobiqun', 'qavat', 'floor'),
        w('مِصْعَدٌ', 'mis‘adun', 'lift', 'elevator'),
        w('دَرَجٌ', 'darajun', 'zinapoya', 'stairs'),
        w('شَارِعٌ', 'shaari‘un', 'ko’cha', 'street'),
        w('جَارٌ', 'jaarun', 'qo’shni (erkak)', 'neighbor'),
        w('جَارَةٌ', 'jaaratun', 'qo’shni (ayol)', 'neighborF'),
        w('قَرِيبٌ', 'qoriibun', 'yaqin', 'near'),
        w('بَعِيدٌ', 'ba‘iidun', 'uzoq', 'far')
      ],
      dialog: {
        title: 'Yangi qo’shni',
        scene: 'Sora binoga yangi ko’chib kelgan Maryam bilan gaplashyapti.',
        lines: [
          { who: 'سَارَةُ', whoUz: 'Sora', ar: 'فِي أَيِّ طَابِقٍ تَسْكُنِينَ؟', uz: 'Nechanchi qavatda yashaysiz?' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'أَسْكُنُ فِي الطَّابِقِ الثَّالِثِ.', uz: 'Uchinchi qavatda yashayman.' },
          { who: 'سَارَةُ', whoUz: 'Sora', ar: 'الْمِصْعَدُ هُنَا، جَنْبَ الدَّرَجِ.', uz: 'Lift shu yerda, zinapoya yonida.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'شُكْرًا. هَلِ الْمَسْجِدُ بَعِيدٌ؟', uz: 'Rahmat. Masjid uzoqmi?' },
          { who: 'سَارَةُ', whoUz: 'Sora', ar: 'لَا، هُوَ قَرِيبٌ، فِي هَذَا الشَّارِعِ.', uz: 'Yo’q, u yaqin, shu ko’chada.' },
          { who: 'مَرْيَمُ', whoUz: 'Maryam', ar: 'الْحَمْدُ لِلّهِ. أَنْتِ جَارَةٌ طَيِّبَةٌ!', uz: 'Alhamdulillah. Siz yaxshi qo’shnisiz!' }
        ]
      },
      grammar: {
        title: 'Tartib sonlar va masofa',
        points: [
          {
            rule: 'Tartib sonlar: الْأَوَّلُ (birinchi), الثَّانِي (ikkinchi), الثَّالِثُ (uchinchi), الرَّابِعُ (to’rtinchi).',
            ex: [{ ar: 'الطَّابِقُ الثَّانِي', uz: 'ikkinchi qavat' }]
          },
          {
            rule: 'قَرِيبٌ مِنْ — «…ga yaqin», بَعِيدٌ عَنْ — «…dan uzoq».',
            ex: [{ ar: 'الْبَيْتُ قَرِيبٌ مِنَ الْمَسْجِدِ', uz: 'Uy masjidga yaqin' }, { ar: 'الشَّارِعُ بَعِيدٌ عَنِ الْبَيْتِ', uz: 'Ko’cha uydan uzoq' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: 'Maryam nechanchi qavatda yashaydi?', options: ['الْأَوَّلِ', 'الثَّانِي', 'الثَّالِثِ'], answer: 2 },
        { type: 'choice', q: 'Masjid qanday?', options: ['بَعِيدٌ', 'قَرِيبٌ'], answer: 1 },
        { type: 'choice', q: '«uydan uzoq»', options: ['بَعِيدٌ عَنِ الْبَيْتِ', 'قَرِيبٌ مِنَ الْبَيْتِ'], answer: 0 },
        { type: 'choice', q: 'مِصْعَدٌ — bu:', options: ['zinapoya', 'lift', 'qavat'], answer: 1 },
        { type: 'order', uz: 'Masjid yaqin.', words: ['الْمَسْجِدُ', 'قَرِيبٌ'] }
      ],
      homework: {
        auto: [
          { q: '«ikkinchi qavat»:', options: ['الطَّابِقُ الثَّانِي', 'الطَّابِقُ الْأَوَّلُ', 'الطَّابِقُ الرَّابِعُ'], answer: 0 },
          { q: '«zinapoya»:', options: ['دَرَجٌ', 'مِصْعَدٌ', 'شَارِعٌ'], answer: 0 },
          { q: '«qo’shni (ayol)»:', options: ['جَارٌ', 'جَارَةٌ'], answer: 1 },
          { q: 'قَرِيبٌ ning teskarisi:', options: ['كَبِيرٌ', 'بَعِيدٌ', 'جَمِيلٌ'], answer: 1 },
          { q: 'Lift qayerda?', options: ['جَنْبَ الدَّرَجِ', 'فِي الشَّارِعِ', 'فِي الْمَسْجِدِ'], answer: 0 }
        ],
        write: [
          { prompt: 'Uyingiz qayerda: qavat, nima yaqin, nima uzoq — 3 gap.', hint: 'Masalan: أَسْكُنُ فِي الطَّابِقِ الْأَوَّلِ. الْمَسْجِدُ قَرِيبٌ.' }
        ]
      }
    },
    {
      id: 'a1-08', unit: 'u3', n: 8,
      title: 'Uydagi kun', titleAr: 'يَوْمٌ فِي الْبَيْتِ',
      goal: 'Uydagi ishlarni fe’llar bilan aytib berish (ayol jinsi bilan).',
      words: [
        w('سَكَنَ', 'sakana', 'yashadi', 'live'),
        w('دَخَلَ', 'daxala', 'kirdi', 'enter'),
        w('خَرَجَ', 'xoraja', 'chiqdi', 'exit'),
        w('فَتَحَ', 'fataha', 'ochdi', 'open'),
        w('أَغْلَقَ', 'ag‘laqa', 'yopdi', 'close'),
        w('طَبَخَ', 'tobaxa', 'pishirdi', 'cook'),
        w('غَسَلَ', 'g‘asala', 'yuvdi', 'wash'),
        w('نَامَ', 'naama', 'uxladi', 'sleep')
      ],
      dialog: {
        title: 'Maryamning kuni (matn)',
        scene: 'Matnni o’qing. Fe’llar oxiridagi ـَتْ ga e’tibor bering.',
        lines: [
          { who: '١', whoUz: '1', ar: 'دَخَلَتْ مَرْيَمُ الْبَيْتَ.', uz: 'Maryam uyga kirdi.' },
          { who: '٢', whoUz: '2', ar: 'فَتَحَتِ النَّافِذَةَ فِي الصَّالَةِ.', uz: 'Zaldagi derazani ochdi.' },
          { who: '٣', whoUz: '3', ar: 'طَبَخَتِ الطَّعَامَ فِي الْمَطْبَخِ.', uz: 'Oshxonada ovqat pishirdi.' },
          { who: '٤', whoUz: '4', ar: 'ثُمَّ غَسَلَتِ الصُّحُونَ.', uz: 'Keyin likopchalarni yuvdi.' },
          { who: '٥', whoUz: '5', ar: 'أَغْلَقَتِ الْبَابَ وَخَرَجَتْ إِلَى الْحَدِيقَةِ.', uz: 'Eshikni yopdi va bog’ga chiqdi.' },
          { who: '٦', whoUz: '6', ar: 'فِي اللَّيْلِ نَامَتْ فِي غُرْفَةِ النَّوْمِ.', uz: 'Kechasi yotoqxonada uxladi.' }
        ]
      },
      grammar: {
        title: 'Ayol jinsidagi fe’l: ـَتْ',
        points: [
          {
            rule: 'O’tgan zamon fe’liga ـَتْ qo’shilsa, ishni ayol bajargan bo’ladi.',
            ex: [{ ar: 'دَخَلَ ← دَخَلَتْ', uz: 'kirdi' }, { ar: 'طَبَخَ ← طَبَخَتْ', uz: 'pishirdi' }]
          },
          {
            rule: 'ـَتْ dan keyin ال bilan boshlanuvchi so’z kelsa, o’qishda ـَتِ bo’ladi.',
            ex: [{ ar: 'فَتَحَتِ النَّافِذَةَ', uz: 'derazani ochdi' }]
          }
        ]
      },
      practice: [
        { type: 'choice', q: 'مَرْيَمُ ___ الطَّعَامَ — «pishirdi»', options: ['طَبَخَ', 'طَبَخَتْ'], answer: 1 },
        { type: 'choice', q: 'فَتَحَ ning teskarisi:', options: ['أَغْلَقَ', 'دَخَلَ', 'نَامَ'], answer: 0 },
        { type: 'choice', q: 'Maryam qayerga chiqdi?', options: ['إِلَى الْحَدِيقَةِ', 'إِلَى الْمَسْجِدِ', 'إِلَى الشَّارِعِ'], answer: 0 },
        { type: 'choice', q: 'دَخَلَ ning teskarisi:', options: ['خَرَجَ', 'سَكَنَ', 'غَسَلَ'], answer: 0 },
        { type: 'order', uz: 'Maryam eshikni yopdi.', words: ['أَغْلَقَتْ', 'مَرْيَمُ', 'الْبَابَ'] }
      ],
      homework: {
        auto: [
          { q: '«uxladi»:', options: ['نَامَ', 'سَكَنَ', 'غَسَلَ'], answer: 0 },
          { q: 'فَاطِمَةُ ___ الْبَيْتَ — «kirdi»', options: ['دَخَلَ', 'دَخَلَتْ'], answer: 1 },
          { q: '«yuvdi»:', options: ['طَبَخَ', 'غَسَلَ', 'فَتَحَ'], answer: 1 },
          { q: 'Maryam qayerda ovqat pishirdi?', options: ['فِي الْمَطْبَخِ', 'فِي الصَّالَةِ', 'فِي الْحَدِيقَةِ'], answer: 0 },
          { q: '«ochdi»:', options: ['أَغْلَقَ', 'فَتَحَ', 'خَرَجَ'], answer: 1 }
        ],
        write: [
          { prompt: 'Onangiz yoki opangizning uydagi bir kunini 4 fe’l bilan yozing.', hint: 'Masalan: طَبَخَتْ أُمِّي الطَّعَامَ ثُمَّ غَسَلَتِ الصُّحُونَ.' }
        ]
      }
    }
  ];

  /* ---------------- Yordamchilar ---------------- */
  function byId(id) {
    for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i];
    return null;
  }
  function indexOf(id) {
    for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return i;
    return -1;
  }
  function unitOf(lesson) {
    for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === lesson.unit) return UNITS[i];
    return null;
  }

  /* Tasodifiy bo'lmagan aralashtirish: bir dars har doim bir xil test beradi,
     shuning uchun server ham aynan shu testni qayta tuzib, tekshira oladi. */
  function seeded(seedStr) {
    var h = 2166136261;
    for (var i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return function () {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      return (h % 100000) / 100000;
    };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** So'zlar testi: har so'zga bitta savol, savol turi navbat bilan almashadi.
      Turlari: ar→uz (arabcha so'z, ma'nosini tanlash), uz→ar, anim→ar (animatsiyaga
      qarab so'zni tanlash). Javob variantlari shu darsning boshqa so'zlaridan. */
  function buildTest(lesson) {
    var rnd = seeded('test:' + lesson.id);
    var words = lesson.words;
    var kinds = ['ar2uz', 'anim2ar', 'uz2ar'];
    return words.map(function (wd, i) {
      var kind = kinds[i % kinds.length];
      var others = shuffle(words.filter(function (x) { return x !== wd; }), rnd).slice(0, 3);
      var opts = shuffle([wd].concat(others), rnd);
      var q = { id: lesson.id + ':t' + i, kind: kind, word: wd.ar, anim: kind === 'anim2ar' ? wd.anim : null };
      if (kind === 'ar2uz') {
        q.prompt = 'Bu so’zning ma’nosi qanday?';
        q.show = wd.ar;
        q.options = opts.map(function (x) { return x.uz; });
      } else if (kind === 'uz2ar') {
        q.prompt = '«' + wd.uz + '» — arabchada qanday?';
        q.options = opts.map(function (x) { return x.ar; });
        q.optionsAr = true;
      } else {
        q.prompt = 'Animatsiyada nima ko’rsatilgan?';
        q.options = opts.map(function (x) { return x.ar; });
        q.optionsAr = true;
      }
      q.answer = opts.indexOf(wd);
      return q;
    });
  }

  /** Javoblar: savol tartibida tanlangan variant raqamlari */
  function gradeTest(lesson, answers) {
    var test = buildTest(lesson);
    var ok = 0;
    test.forEach(function (q, i) { if (answers && Number(answers[i]) === q.answer) ok++; });
    return { correct: ok, total: test.length, percent: test.length ? Math.round(ok * 100 / test.length) : 0 };
  }
  function gradeHomeworkAuto(lesson, answers) {
    var items = (lesson.homework && lesson.homework.auto) || [];
    var ok = 0;
    items.forEach(function (q, i) { if (answers && Number(answers[i]) === q.answer) ok++; });
    return { correct: ok, total: items.length, percent: items.length ? Math.round(ok * 100 / items.length) : 0 };
  }
  /** Mashq javobini tekshirish (darhol, brauzerda) */
  function checkPractice(item, value) {
    if (item.type === 'order') {
      return Array.isArray(value) && value.join(' ') === item.words.join(' ');
    }
    return Number(value) === item.answer;
  }

  /** Dars tugaganmi: test o'tilgan va vazifa topshirilgan */
  function lessonDone(p) {
    return !!(p && p.testBest != null && p.testBest >= PASS && p.hw && p.hw.submittedAt);
  }

  /** Har bir darsning holati: 'done' | 'open' | 'locked'
      progress = { lessons: { [id]: {...} }, unlocked: { [id]: true } } */
  function statuses(progress) {
    var pl = (progress && progress.lessons) || {};
    var manual = (progress && progress.unlocked) || {};
    var out = {};
    var prevDone = true;
    LESSONS.forEach(function (l, i) {
      var p = pl[l.id];
      var done = lessonDone(p);
      var open = i === 0 || prevDone || !!manual[l.id];
      out[l.id] = done ? 'done' : (open ? 'open' : 'locked');
      prevDone = done;
    });
    return out;
  }

  var STEPS = [
    { id: 'words', label: 'So’zlar' },
    { id: 'dialog', label: 'Matn' },
    { id: 'grammar', label: 'Qoida' },
    { id: 'practice', label: 'Mashq' },
    { id: 'test', label: 'Test' },
    { id: 'homework', label: 'Vazifa' }
  ];

  A.Course = {
    code: 'A1', title: 'Arab tili — A1 (Oila, Uy-joy)',
    PASS: PASS, UNITS: UNITS, LESSONS: LESSONS, STEPS: STEPS,
    byId: byId, indexOf: indexOf, unitOf: unitOf,
    buildTest: buildTest, gradeTest: gradeTest, gradeHomeworkAuto: gradeHomeworkAuto,
    checkPractice: checkPractice, lessonDone: lessonDone, statuses: statuses
  };
})(typeof window !== 'undefined' ? window : globalThis);
