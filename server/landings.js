/* Qidiruv tizimlari uchun alohida, YENGIL sahifalar.

   Odamlar Google'da turlicha yozadi: «arab tili kursi», «arab tilini
   o'rganish», «arabcha gapirish», «arab tili onlayn», «курсы арабского
   языка», «араб тили курси»... Har biri uchun alohida sahifa bo'lsa,
   Google har bir so'rovga aniq mos sahifani ko'rsatadi.

   Sahifalar serverda tayyor HTML bo'lib chiqadi: katta skriptlar yo'q,
   tashqi shrift yo'q — telefonda ham bir zumda ochiladi. Har birida
   «Darsga yozilish» (Telegram bot) va telefon bor.

   Qoidalar (site-content.js dagidek): narx yozilmaydi, diniy ibora
   ishlatilmaydi, faqat markaz aytgan haqiqiy ma'lumot.                    */
'use strict';

const CONTENT = require('./site-content');

const BOT = 'Saboacademy_bot';

/* Hamma sahifada bir xil, haqiqiy faktlar */
const FACTS_UZ = [
  'Jonli darslar Zoom’da — misrlik ustoz bilan, ona tili arab tili bo‘lgan o‘qituvchidan',
  'Haftada 3 marta, har bir dars 90 daqiqa (1,5 soat)',
  'Har darsdan keyin shu mavzu bo‘yicha interaktiv videodars shaxsiy kabinetda',
  'Uy vazifa va so‘z yodlash ham interaktiv — ustoz natijani ko‘rib boradi',
  'Ayollar, erkaklar va bolalar uchun alohida guruhlar, guruhda 10 kishigacha',
  'Arab metodikasi: asosiy urg‘u — gapirishga, birinchi darsdan jonli muloqot'
];
const ROAD_UZ = [
  ['1-oy', 'harflar va o‘qish'],
  ['3-oy', 'ravon o‘qish va to‘g‘ri talaffuz'],
  ['6-oy', 'ma’noni tushunish, asosiy grammatika'],
  ['12-oy', 'arabcha gaplashish (A2–B1)']
];

const PAGES = [
  {
    slug: 'arab-tili-kursi', lang: 'uz', group: 'kurs',
    title: 'Arab tili kursi — noldan, misrlik ustoz bilan | Sabo Academy',
    desc: 'Arab tili kursi noldan: misrlik ustoz bilan jonli onlayn darslar, haftada 3 marta. Ayollar, erkaklar va bolalar uchun alohida guruhlar. Darsga yoziling.',
    h1: 'Arab tili kursi — noldan gapirishgacha',
    lead: 'Sabo Academy’da arab tilini alifbodan boshlab o‘rganasiz va taxminan 1 yilda arabcha matnni tushunib o‘qish hamda kundalik suhbat darajasiga yetasiz. Darslar jonli, ustoz — misrlik, asosiy urg‘u gapirishga.',
    extra: [['Kurs kimlar uchun?', 'Arab tilini umuman bilmaydiganlar, harflarni biladigan, lekin gapira olmaydiganlar, hamda bilimini mustahkamlamoqchi bo‘lganlar uchun. Darajangizni test bilan aniqlab, mos guruhga qo‘shilasiz.']]
  },
  {
    slug: 'arab-tilini-organish', lang: 'uz', group: 'kurs',
    title: 'Arab tilini o‘rganish noldan — 1 yilda gapiring | Sabo Academy',
    desc: 'Arab tilini noldan o‘rganmoqchimisiz? Harflardan boshlab tizimli darslar, misrlik ustoz, haftada 3 marta jonli dars. Onlayn daraja testi va jonli darslar.',
    h1: 'Arab tilini noldan o‘rganish',
    lead: 'Arab tilini o‘zingiz o‘rganishga urinib, bir joyda to‘xtab qolgan bo‘lsangiz — tizimli yo‘l kerak. Sabo Academy’da har bir bosqich aniq: avval harflar va o‘qish, keyin grammatika va eng muhimi — gapirish.',
    extra: [['Arab tilini o‘rganish qancha vaqt oladi?', 'Muntazam shug‘ullansangiz, noldan taxminan 1 yilda tushunish va gapirish darajasiga chiqasiz. Birinchi oyning o‘zida harflarni o‘qiy boshlaysiz.']]
  },
  {
    slug: 'arab-tili-onlayn', lang: 'uz', group: 'kurs',
    title: 'Arab tili onlayn kursi — Zoom’da jonli darslar | Sabo Academy',
    desc: 'Arab tilini onlayn o‘rganing: Zoom’da misrlik ustoz bilan jonli darslar, har darsdan keyin interaktiv videodars. O‘zbekistonning istalgan joyidan qatnashing.',
    h1: 'Arab tili onlayn — Zoom’da jonli darslar',
    lead: 'Uydan chiqmasdan arab tilini o‘rganing. Darslar yozib olingan video emas — Zoom’da ustoz bilan jonli muloqot. Toshkentdan ham, viloyatlardan ham, chet eldan ham qatnashish mumkin.',
    extra: [['Onlayn darsni qoldirib ketsam nima bo‘ladi?', 'Har bir dars yozib olinadi. Yozuv, uy vazifasi va ustoz izohlari shaxsiy kabinetingizda turadi — ortda qolmaysiz.']]
  },
  {
    slug: 'arabcha-gapirish', lang: 'uz', group: 'kurs',
    title: 'Arabcha gapirish kursi — so‘zlashuvga urg‘u | Sabo Academy',
    desc: 'Arabcha gapirishni o‘rganing: arab metodikasi, misrlik ustoz bilan jonli muloqot, birinchi darsdan suhbat. Kundalik hayotda kerakli iboralar va so‘zlar.',
    h1: 'Arabcha gapirish — birinchi darsdan suhbat',
    lead: 'Ko‘pchilik arab tilini yillab o‘qiydi, lekin gapira olmaydi. Bizda boshqacha: dars arab metodikasi asosida, ustoz ona tilida gapiradi va siz birinchi darsdan javob berasiz.',
    extra: [['Qaysi mavzularda gapirishni o‘rganaman?', 'Tanishuv, do‘kon va bozor, yo‘l so‘rash, oila, ish va o‘qish, kundalik ishlar — hayotda eng ko‘p kerak bo‘ladigan vaziyatlar.']]
  },
  {
    slug: 'arab-alifbosi', lang: 'uz', group: 'kurs',
    title: 'Arab alifbosini o‘rganish — harflar va to‘g‘ri talaffuz | Sabo Academy',
    desc: 'Arab alifbosi noldan: 28 harf, har bir harfning chiqish joyi (maxraj), unlilar va o‘qish. Misrlik ustoz bilan to‘g‘ri talaffuz. Darsga yoziling.',
    h1: 'Arab alifbosini o‘rganish',
    lead: 'Arab tili alifbodan boshlanadi. 28 harfni, har birining og‘izdagi chiqish joyini va unlilarni (a, i, u) ustoz bilan jonli o‘rganasiz — talaffuz boshidan to‘g‘ri qo‘yiladi.',
    body: [
      ['Arab alifbosi qanday tuzilgan?', [
        'Arab alifbosida 28 ta harf bor va yozuv o‘ngdan chapga yoziladi. Ko‘pchilik harflar so‘z ichida qayerda turganiga qarab (boshida, o‘rtasida, oxirida yoki alohida) shaklini biroz o‘zgartiradi — shuning uchun har bir harfni to‘rt ko‘rinishda tanib olish o‘rgatiladi.',
        'Arab yozuvida qisqa unlilar (a, i, u) harf sifatida yozilmaydi — ular harf ustiga yoki ostiga qo‘yiladigan belgilar (harakatlar) bilan ko‘rsatiladi. Boshlang‘ich bosqichda matnlar shu belgilar bilan o‘qiladi, keyinchalik belgisiz o‘qishga o‘tiladi.'
      ]],
      ['O‘zbek tilida yo‘q tovushlar', [
        'Arab tilida o‘zbek tilida uchramaydigan bir nechta tovush bor: chuqur bo‘g‘iz tovushlari (masalan ح, ع), qalin talaffuz qilinadigan harflar (ص, ض, ط, ظ) va tishlar orasidan chiqadigan tovushlar (ث, ذ). Aynan shu joyda ko‘pchilik xato qiladi.',
        'Shuning uchun talaffuzni ona tili arab tili bo‘lgan ustozdan o‘rganish muhim: ustoz har bir harfni qanday chiqarishni ko‘rsatadi, siz takrorlaysiz va xatongiz o‘sha zahoti tuzatiladi.'
      ]],
      ['Darslarda alifbo qanday o‘rganiladi?', [
        'Har darsda bir nechta harf: avval tovushi, keyin yozilishi, keyin shu harflar bilan bo‘g‘in va so‘z o‘qish. Darsdan keyin kabinetda shu harflar bo‘yicha interaktiv mashqlar va videodars turadi — uyda takrorlaysiz.',
        'Alifbo tugagach, darhol oddiy so‘zlar va qisqa gaplarni o‘qishga o‘tasiz. Maqsad — faqat harflarni bilish emas, balki ravon o‘qish va o‘qiganini tushunish.'
      ]]
    ],
    extra: [['Alifboni o‘rganish qancha vaqt oladi?', 'Odatda birinchi oyda harflarni tanib, so‘zlarni o‘qiy boshlaysiz. Kabinetdagi interaktiv mashqlar bilan har kuni takrorlab borasiz.']]
  },
  {
    slug: 'arab-tili-ayollar-uchun', lang: 'uz', group: 'kurs',
    title: 'Ayollar va qizlar uchun arab tili kursi — alohida guruh | Sabo Academy',
    desc: 'Ayollar va qizlar uchun alohida guruhlarda arab tili: onlayn jonli darslar, haftada 3 marta, guruhda 10 kishigacha. Qulay va samimiy muhit. Darsga yoziling.',
    h1: 'Ayollar va qizlar uchun arab tili kursi',
    lead: 'Ayollar va qizlar uchun guruhlar alohida tuziladi. Darslar onlayn — uydan, o‘zingizga qulay vaqtda qatnashasiz.',
    extra: [['Guruhda nechta odam bo‘ladi?', 'Guruhda 10 kishigacha — ustoz har bir o‘quvchiga vaqt ajratadi va har kim gapirib ko‘radi.']]
  },
  {
    slug: 'arab-tili-bolalar-uchun', lang: 'uz', group: 'kurs',
    title: 'Bolalar uchun arab tili — o‘yin va suhbat orqali | Sabo Academy',
    desc: 'Bolalar uchun arab tili kursi: alohida bolalar guruhi, harflar, o‘qish va oddiy suhbat. Onlayn jonli darslar va interaktiv mashqlar. Darsga yoziling.',
    h1: 'Bolalar uchun arab tili',
    lead: 'Bolalar uchun alohida guruhlar bor. Harflar, o‘qish va oddiy suhbatni jonli darsda o‘rganadi, uyda esa kabinetdagi interaktiv mashqlar bilan takrorlaydi — ota-ona natijani ko‘rib boradi.',
    extra: [['Ota-ona farzandining natijasini ko‘ra oladimi?', 'Ha. Davomat, uy vazifalari va baholar ota-ona kabinetida va Telegram bot orqali ko‘rinadi.']]
  },
  {
    slug: 'arab-tili-toshkent', lang: 'uz', group: 'kurs',
    title: 'Arab tili kursi Toshkent — onlayn jonli darslar | Sabo Academy',
    desc: 'Toshkentda arab tili kursi qidiryapsizmi? Sabo Academy: misrlik ustoz bilan jonli onlayn darslar, yo‘lga vaqt ketmaydi. Ayollar, erkaklar, bolalar uchun alohida guruhlar.',
    h1: 'Toshkentda arab tili kursi',
    lead: 'Toshkentning istalgan tumanidan — Chilonzor, Yunusobod, Sergeli yoki boshqa joydan — yo‘lga vaqt sarflamasdan arab tilini o‘rganing. Darslar Zoom’da jonli, misrlik ustoz bilan.',
    extra: [['Viloyatlardan qatnasha olamanmi?', 'Albatta. Darslar onlayn bo‘lgani uchun Samarqand, Buxoro, Farg‘ona, Andijon va boshqa shaharlardan ham bemalol qatnashiladi.']]
  },
  {
    slug: 'misrlik-ustoz', lang: 'uz', group: 'kurs',
    title: 'Misrlik ustoz bilan arab tili — ona tilida gapiradigan o‘qituvchi | Sabo Academy',
    desc: 'Arab tilini misrlik ustozdan o‘rganing: 10 yildan ortiq tajriba, o‘quvchilari C1–C2 darajaga chiqqan, o‘zbekcha ham tushuntiradi. Jonli onlayn darslar.',
    h1: 'Misrlik ustoz bilan arab tili',
    lead: 'Ustozimiz — Qohira universitetining Dor al-Ulum fakulteti bitiruvchisi, 10 yildan ortiq arab tilidan dars beradi, o‘quvchilari C1–C2 darajaga chiqqan. Ona tili arab tili, o‘zbekcha ham gapiradi — tushunmagan joyingizni o‘zbekcha tushuntiradi.',
    extra: [['Nega ona tili arab bo‘lgan ustoz muhim?', 'Talaffuz, intonatsiya va jonli so‘zlashuv ona tilida gapiradigan odamdan eng to‘g‘ri o‘rganiladi — siz kitobdagi emas, haqiqiy arab tilini eshitasiz.']]
  },
  {
    slug: 'arab-grammatikasi', lang: 'uz', group: 'kurs',
    title: 'Arab tili grammatikasi noldan — nahv va sarf oddiy tilda | Sabo Academy',
    desc: 'Arab grammatikasini noldan o‘rganing: so‘z turkumlari, fe’l zamonlari, gap tuzilishi (nahv va sarf). Misrlik ustoz bilan jonli onlayn darslar, kechki guruhlar ham bor.',
    h1: 'Arab tili grammatikasi — noldan, tushunarli tilda',
    lead: 'Arab grammatikasi qiyin tuyuladi, lekin to‘g‘ri tartibda o‘rganilsa — mantiqiy va tushunarli. Sabo Academy’da qoidalar yodlatilmaydi: har bir qoida jonli misollar va gapirish orqali mustahkamlanadi.',
    body: [
      ['Arab grammatikasi nimalardan iborat?', [
        'Arab tili grammatikasi ikki qismdan iborat: sarf (so‘zning shakli — fe’llarning zamon va shaxs bo‘yicha o‘zgarishi, so‘z yasalishi) va nahv (gap tuzilishi — so‘zlarning gapdagi o‘rni va oxirining o‘zgarishi).',
        'Arab tilida ko‘p so‘zlar uch harfli o‘zakdan yasaladi. Masalan, k-t-b o‘zagidan «yozdi», «kitob», «yozuvchi», «maktab» kabi so‘zlar chiqadi. Shu tizimni tushungan odam yangi so‘zlarni ancha tez o‘rganadi.'
      ]],
      ['Qaysi tartibda o‘rganiladi?', [
        'A0 — alifbo va o‘qish. A1 — ot va sifat, rod (muzakkar/muannas), birlik va ko‘plik, olmoshlar, oddiy gaplar. A2 — o‘tgan va hozirgi zamon fe’llari, sonlar, predloglar. B1 — buyruq fe’li, fe’l shakllari (bob), murakkab gaplar. B2 va undan yuqori — erkin nutq va matn tahlili uchun chuqur grammatika.',
        'Har bir mavzu jonli darsda tushuntiriladi, keyin kabinetdagi videodars, mashq va testlar bilan mustahkamlanadi. 60% dan yuqori natija qilsangiz, keyingi mavzu ochiladi — bilim bo‘shliq qolmaydi.'
      ]],
      ['Grammatikani yodlamasdan o‘rganish mumkinmi?', [
        'Bizning usulda grammatika gapirish uchun vosita. Qoida avval misolda ko‘rsatiladi, siz shu qolip bilan o‘zingiz gap tuzasiz va ustoz bilan suhbatda ishlatasiz. Shunda qoida yodlanmaydi — o‘zlashtiriladi.'
      ]]
    ],
    extra: [['Grammatikani boshlash uchun nima bilish kerak?', 'Arab harflarini o‘qiy olish kifoya. Harflarni bilmasangiz, A0 (alifbo) guruhidan boshlaysiz — bir oyda o‘qishga o‘tasiz.']]
  },
  {
    slug: 'arab-tili-darajalari', lang: 'uz', group: 'kurs',
    title: 'Arab tili darajalari A0, A1, A2, B1, B2, C1, C2 — qaysi biridasiz? | Sabo Academy',
    desc: 'Arab tili darajalari A0 dan C2 gacha: har bir darajada nimani bilasiz va qancha vaqt kerak. Onlayn daraja testini topshirib, o‘zingizga mos guruhni toping.',
    h1: 'Arab tili darajalari: A0 dan C2 gacha',
    lead: 'Arab tilini qaysi darajada bilishingizni aniqlash — to‘g‘ri guruhni tanlashning birinchi qadami. Quyida har bir daraja oddiy tilda tushuntirilgan; saytdagi onlayn test esa darajangizni bir necha daqiqada aniqlaydi.',
    body: [
      ['Har bir darajada nimani bilasiz?', [
        'A0 — Alifbo: 28 harf, harakatlar va bo‘g‘in o‘qish. Arab tilini noldan boshlaganlar uchun.',
        'A1 — Boshlang‘ich: salomlashish, tanishuv, oddiy so‘z va gaplar, o‘zingiz haqingizda gapirish.',
        'A2 — Asosiy: kundalik vaziyatlardagi gaplar, oddiy o‘tgan zamon, do‘kon, yo‘l, oila mavzulari.',
        'B1 — O‘rta: suhbatni davom ettirish, oddiy matnlarni o‘qib tushunish, fe’l shakllari.',
        'B2 — O‘rtadan yuqori: erkin suhbat, matn tahlili, o‘z fikrini asoslab aytish.',
        'C1 — Yuqori: ilmiy va publitsistik matnlar, nozik ma’no farqlari.',
        'C2 — Mukammal: adabiy matnlar, balog‘at va chuqur sarf-nahv.'
      ]],
      ['Bir darajadan ikkinchisiga qancha vaqtda o‘tiladi?', [
        'Haftada 3 marta jonli dars va uyda muntazam takrorlash bilan noldan A2–B1 darajaga taxminan 1 yilda chiqiladi. Har bir daraja oxirida test bo‘ladi — natija kabinetingizda saqlanadi.'
      ]],
      ['Darajamni qanday bilaman?', [
        'Bosh sahifadagi «Daraja testi»ni topshiring: savollar osondan qiyinga qarab boradi va oxirida darajangiz hamda tavsiya etilgan guruh ko‘rsatiladi. Natijani administratorga yuborib, mos guruhga yozilasiz.'
      ]]
    ],
    extra: [['Test pullikmi?', 'Yo‘q, onlayn daraja testi hamma uchun ochiq va ro‘yxatdan o‘tishni talab qilmaydi.']]
  },
  {
    slug: 'arab-tili-kechki-kurs', lang: 'uz', group: 'kurs',
    title: 'Arab tili kechki kursi — ishdan keyin, uydan turib | Sabo Academy',
    desc: 'Ishlaydiganlar uchun arab tili kechki guruhlari: ishdan keyin qulay vaqtda, Zoom’da jonli onlayn darslar. Noldan (A0) boshlab grammatika va gapirish. Darsga yoziling.',
    h1: 'Arab tili kechki kursi — ishdan keyin',
    lead: 'Kunduzi ishlaysiz yoki o‘qiysiz-u, arab tilini o‘rganishga vaqt topolmayapsizmi? Kechki guruhlar aynan siz uchun: ishdan keyin, uydan turib, ustoz bilan jonli darslar.',
    body: [
      ['Kechki guruh qanday ishlaydi?', [
        'Darslar kechki vaqtda, Zoom’da jonli o‘tadi — yo‘lga vaqt ketmaydi, uydan yoki istalgan joydan qatnashasiz. Aniq dars vaqtlari bosh sahifadagi «Dars vaqtlari» bo‘limida ko‘rsatilgan.',
        'Guruh noldan (A0) boshlanadi: avval alifbo va o‘qish, keyin grammatika va gapirish. Arab tilini umuman bilmasangiz ham bemalol qo‘shilasiz.'
      ]],
      ['Charchab qolsam yoki darsni qoldirsam-chi?', [
        'Har bir dars yozib olinadi va kabinetingizda turadi. Shu mavzu bo‘yicha qisqa videodars, so‘z yodlash va uy vazifasi ham bor — 20–30 daqiqada qo‘shimcha takrorlab olasiz.',
        'Guruhda 10 kishigacha, shuning uchun ustoz har kimga vaqt ajratadi va ortda qolganlarga yordam beradi.'
      ]]
    ],
    extra: [['Qaysi darajadan boshlanadi?', 'Kechki guruhlar A0 (noldan) darajadan boshlanadi. Arab tilini biroz bilsangiz, daraja testini topshirib mos guruhga qo‘shilasiz.']]
  },
  {
    slug: 'arab-tili-erkaklar-uchun', lang: 'uz', group: 'kurs',
    title: 'Erkaklar uchun arab tili kursi — alohida guruh | Sabo Academy',
    desc: 'Erkaklar uchun alohida guruhlarda arab tili: misrlik ustoz bilan jonli onlayn darslar, haftada 3 marta, guruhda 10 kishigacha. Noldan gapirishgacha.',
    h1: 'Erkaklar uchun arab tili kursi',
    lead: 'Erkaklar uchun guruhlar alohida tuziladi. Darslar onlayn, jonli — ishdan keyin yoki o‘zingizga qulay vaqtda qatnashasiz.',
    body: [
      ['Nega alohida guruh?', [
        'Alohida guruhda o‘quvchilar o‘zini erkin his qiladi, ko‘proq gapiradi va savol beradi. Arab tilini o‘rganishda eng muhimi — gapirish, shuning uchun qulay muhit natijaga to‘g‘ridan-to‘g‘ri ta’sir qiladi.'
      ]],
      ['Kimlar uchun mos?', [
        'Arab tilini noldan boshlayotganlar, ish yoki o‘qish uchun arab tili kerak bo‘lganlar, arab davlatlariga safar qiladiganlar va arabcha matnlarni tushunmoqchi bo‘lganlar uchun.'
      ]]
    ],
    extra: [['Guruhda nechta odam bo‘ladi?', 'Guruhda 10 kishigacha — ustoz har bir o‘quvchiga vaqt ajratadi va har kim gapirib ko‘radi.']]
  },
  {
    slug: 'ru/kursy-arabskogo-yazyka', lang: 'ru', group: 'kurs',
    title: 'Курсы арабского языка онлайн — с преподавателем из Египта | Sabo Academy',
    desc: 'Курсы арабского языка с нуля: живые онлайн-уроки в Zoom с носителем языка из Египта, 3 раза в неделю по 90 минут. Отдельные группы для женщин, мужчин и детей.',
    h1: 'Курсы арабского языка онлайн',
    lead: 'В Sabo Academy вы изучаете арабский язык с нуля — от алфавита до живого разговора. Преподаватель — носитель языка из Египта, основной упор — на разговорную речь. Примерно за 1 год вы начнёте понимать и говорить.',
    facts: [
      'Живые уроки в Zoom с преподавателем-носителем языка из Египта',
      '3 раза в неделю, каждый урок 90 минут (1,5 часа)',
      'После каждого урока — интерактивный видеоурок в личном кабинете',
      'Домашние задания и запоминание слов — интерактивно, с проверкой преподавателя',
      'Отдельные группы для женщин, мужчин и детей, в группе до 10 человек',
      'Арабская методика: упор на разговор с первого урока'
    ],
    road: [['1 месяц', 'буквы и чтение'], ['3 месяца', 'беглое чтение и правильное произношение'], ['6 месяцев', 'понимание смысла, основы грамматики'], ['12 месяцев', 'разговор на арабском (A2–B1)']],
    faq: [
      ['Можно ли выучить арабский с нуля?', 'Да. Уроки начинаются с алфавита: буквы, чтение, затем грамматика и разговор.'],
      ['Уроки онлайн или офлайн?', 'Уроки проходят онлайн в Zoom вживую — можно заниматься из любого города Узбекистана и из-за рубежа.'],
      ['Что если я пропущу урок?', 'Каждый урок записывается. Запись, домашнее задание и комментарии преподавателя остаются в личном кабинете.'],
      ['Как записаться на урок?', 'Напишите нашему Telegram-боту или позвоните — администратор свяжется с вами и отправит ссылку на пробный урок.']
    ],
    ui: { why: 'Как проходит обучение', road: 'Ваш результат', faq: 'Частые вопросы', cta: 'Записаться на урок', call: 'Позвонить', more: 'Другие страницы', home: 'Главная страница', crumb: 'Курсы арабского языка' }
  },
  {
    slug: 'kr/arab-tili-kursi', lang: 'uz-Cyrl', group: 'kurs',
    title: 'Араб тили курси — нолдан, мисрлик устоз билан | Sabo Academy',
    desc: 'Араб тилини нолдан ўрганинг: мисрлик устоз билан жонли онлайн дарслар, ҳафтада 3 марта. Аёллар, эркаклар ва болалар учун алоҳида гуруҳлар. Дарсга ёзилинг.',
    h1: 'Араб тили курси — нолдан гапиришгача',
    lead: 'Sabo Academy’да араб тилини алифбодан бошлаб ўрганасиз ва тахминан 1 йилда арабча матнни тушуниб ўқиш ҳамда кундалик суҳбат даражасига етасиз. Дарслар жонли, устоз — мисрлик, асосий урғу гапиришга.',
    facts: [
      'Жонли дарслар Zoom’да — мисрлик устоз билан',
      'Ҳафтада 3 марта, ҳар бир дарс 90 дақиқа (1,5 соат)',
      'Ҳар дарсдан кейин интерактив видеодарс шахсий кабинетда',
      'Уй вазифа ва сўз ёдлаш ҳам интерактив',
      'Аёллар, эркаклар ва болалар учун алоҳида гуруҳлар, гуруҳда 10 кишигача',
      'Араб методикаси: биринчи дарсдан жонли мулоқот'
    ],
    road: [['1-ой', 'ҳарфлар ва ўқиш'], ['3-ой', 'равон ўқиш ва тўғри талаффуз'], ['6-ой', 'маънони тушуниш, асосий грамматика'], ['12-ой', 'арабча гаплашиш (A2–B1)']],
    faq: [
      ['Араб тилини нолдан ўргансам бўладими?', 'Ҳа. Дарслар алифбодан бошланади: ҳарфлар, ўқиш, кейин грамматика ва суҳбат.'],
      ['Дарслар онлайнми?', 'Ҳа, Zoom орқали жонли ўтади — Ўзбекистоннинг исталган жойидан қатнашиш мумкин.'],
      ['Дарсни қолдириб кетсам нима бўлади?', 'Ҳар бир дарс ёзиб олинади ва шахсий кабинетингизда туради.'],
      ['Дарсга қандай ёзиламан?', 'Telegram ботимизга ёзинг ёки қўнғироқ қилинг — администратор боғланади.']
    ],
    ui: { why: 'Дарслар қандай ўтади', road: 'Натижангиз', faq: 'Кўп сўраладиган саволлар', cta: 'Дарсга ёзилиш', call: 'Қўнғироқ қилиш', more: 'Бошқа саҳифалар', home: 'Бош саҳифа', crumb: 'Араб тили курси' }
  }
];

const UI_UZ = { why: 'Darslar qanday o‘tadi', road: 'Natijangiz', faq: 'Ko‘p so‘raladigan savollar', cta: 'Darsga yozilish', call: 'Qo‘ng‘iroq qilish', more: 'Boshqa sahifalar', home: 'Bosh sahifa', crumb: 'Arab tili' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

const BY_SLUG = {};
PAGES.forEach(p => { BY_SLUG['/' + p.slug] = p; });

/** Manzil shu sahifalardan biriga tegishlimi? (oxiridagi / ham qabul qilinadi) */
function find(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '');
  return BY_SLUG[p] || null;
}

function gaTag(id) {
  if (!id || !/^G-[A-Z0-9]{4,20}$/.test(id)) return '';
  return '<script async src="https://www.googletagmanager.com/gtag/js?id=' + id + '"></script>' +
    '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}' +
    'gtag("js",new Date());gtag("config","' + id + '",{anonymize_ip:true});</script>';
}

function render(page, opts) {
  opts = opts || {};
  const base = String(opts.base || '').replace(/\/$/, '');
  const phone = String(opts.phone || CONTENT.PHONE).trim();
  const tel = phone.replace(/[^+0-9]/g, '');
  const ui = page.ui || UI_UZ;
  const facts = page.facts || FACTS_UZ;
  const road = page.road || ROAD_UZ;
  const src = 'seo_' + page.slug.replace(/[^a-z0-9]+/g, '_').slice(0, 30);
  const botUrl = 'https://t.me/' + BOT + '?start=dars_' + src;
  const url = base + '/' + page.slug;

  /* Savol-javob: sahifaga xos + umumiy (o'zbekcha sahifalarda) */
  let faq = page.faq;
  if (!faq) {
    faq = (page.extra || []).concat(CONTENT.FAQ.slice(0, 5).map(f => [f.q, f.a]));
  }

  /* Ko'p tilli moslik: asosiy kurs sahifasi uch tilda */
  const alt = [
    ['uz', base + '/arab-tili-kursi'],
    ['ru', base + '/ru/kursy-arabskogo-yazyka'],
    ['uz-Cyrl', base + '/kr/arab-tili-kursi']
  ];
  const isTrio = ['arab-tili-kursi', 'ru/kursy-arabskogo-yazyka', 'kr/arab-tili-kursi'].indexOf(page.slug) >= 0;
  const hreflang = isTrio
    ? alt.map(a => '<link rel="alternate" hreflang="' + a[0] + '" href="' + esc(a[1]) + '">').join('') +
      '<link rel="alternate" hreflang="x-default" href="' + esc(alt[0][1]) + '">'
    : '';

  const others = PAGES.filter(p => p.slug !== page.slug && (page.lang === 'uz' ? p.lang === 'uz' : true));

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course', name: page.h1, description: page.desc, inLanguage: page.lang === 'ru' ? 'ru' : 'uz',
        url: url,
        provider: { '@type': 'EducationalOrganization', name: CONTENT.NAME, url: base + '/', telephone: phone, email: CONTENT.EMAIL, sameAs: CONTENT.LINKS.map(l => l.url) },
        hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseSchedule: { '@type': 'Schedule', repeatFrequency: 'P1W', repeatCount: 3, duration: 'PT90M' } }
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }))
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: CONTENT.NAME, item: base + '/' },
          { '@type': 'ListItem', position: 2, name: page.h1, item: url }
        ]
      }
    ]
  };

  return '<!doctype html><html lang="' + esc(page.lang) + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(page.title) + '</title>' +
    '<meta name="description" content="' + esc(page.desc) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large">' +
    '<link rel="canonical" href="' + esc(url) + '">' + hreflang +
    '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(page.title) + '">' +
    '<meta property="og:description" content="' + esc(page.desc) + '"><meta property="og:url" content="' + esc(url) + '">' +
    '<meta property="og:image" content="' + esc(base + '/assets/icon-512.png') + '">' +
    '<meta name="theme-color" content="#0b3d2b">' +
    '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/assets/icon-180.png">' +
    '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>' +
    gaTag(opts.gaId) +
    '<style>' +
    ':root{--g:#0b3d2b;--g2:#13734b;--gold:#e7b54a;--ink:#10241b;--mute:#4a5a50;--cream:#fbf7ec}' +
    '*{box-sizing:border-box}body{margin:0;font:17px/1.6 -apple-system,"Segoe UI",Roboto,Inter,sans-serif;color:var(--ink);background:var(--cream)}' +
    'a{color:var(--g2)}.w{max-width:860px;margin:0 auto;padding:0 18px}' +
    'header{background:linear-gradient(160deg,#14704c,#0b3d2b);color:#fff;padding:22px 0 34px}' +
    '.top{display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:2px;color:#f6d58a;text-decoration:none}.top img{width:44px;height:44px;border-radius:12px;background:#fff}' +
    'nav.bc{font-size:13px;opacity:.8;margin:14px 0 6px}nav.bc a{color:#fff}' +
    'h1{font-size:clamp(28px,6vw,44px);line-height:1.12;margin:6px 0 12px}.lead{font-size:18px;opacity:.95;margin:0 0 20px}' +
    '.cta{display:flex;flex-wrap:wrap;gap:10px}.btn{display:inline-block;padding:14px 22px;border-radius:14px;font-weight:800;text-decoration:none}' +
    '.btn.g{background:var(--gold);color:#2a1d00}.btn.o{border:2px solid rgba(255,255,255,.6);color:#fff}' +
    'section{padding:26px 0 6px}h2{font-size:24px;color:var(--g);margin:0 0 12px}h3{font-size:18px;margin:16px 0 4px}' +
    'ul.f{list-style:none;padding:0;margin:0;display:grid;gap:10px}ul.f li{background:#fff;border:1px solid #eadfc4;border-radius:14px;padding:12px 14px 12px 42px;position:relative}' +
    'ul.f li:before{content:"✓";position:absolute;left:14px;top:11px;color:var(--g2);font-weight:900}' +
    '.road{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.road div{background:var(--g);color:#fff;border-radius:14px;padding:12px 14px}.road b{display:block;color:var(--gold)}' +
    '.faq p{margin:0 0 6px;color:var(--mute)}.box{background:#fff;border:2px solid var(--gold);border-radius:18px;padding:20px;margin:26px 0;text-align:center}' +
    '.box .btn.o{color:var(--g);border-color:var(--g)}.links{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}.links a{display:inline-block;background:#fff;border:1px solid #eadfc4;border-radius:20px;padding:6px 12px;text-decoration:none;font-size:15px}' +
    'footer{padding:20px 0 40px;color:var(--mute);font-size:14px}' +
    '</style></head><body>' +
    '<header><div class="w">' +
    '<a class="top" href="/"><img src="/assets/icon-192.png" alt="" width="44" height="44">SABO ACADEMY</a>' +
    '<nav class="bc" aria-label="breadcrumb"><a href="/">' + esc(ui.home) + '</a> › ' + esc(ui.crumb) + '</nav>' +
    '<h1>' + esc(page.h1) + '</h1><p class="lead">' + esc(page.lead) + '</p>' +
    '<div class="cta"><a class="btn g" href="' + esc(botUrl) + '">' + esc(ui.cta) + '</a>' +
    (tel ? '<a class="btn o" href="tel:' + esc(tel) + '">📞 ' + esc(phone) + '</a>' : '') + '</div>' +
    '</div></header><main class="w">' +
    (page.body || []).map(b => '<section><h2>' + esc(b[0]) + '</h2>' + b[1].map(t => '<p>' + esc(t) + '</p>').join('') + '</section>').join('') +
    '<section><h2>' + esc(ui.why) + '</h2><ul class="f">' + facts.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></section>' +
    '<section><h2>' + esc(ui.road) + '</h2><div class="road">' + road.map(r => '<div><b>' + esc(r[0]) + '</b>' + esc(r[1]) + '</div>').join('') + '</div></section>' +
    '<section class="faq"><h2>' + esc(ui.faq) + '</h2>' + faq.map(f => '<h3>' + esc(f[0]) + '</h3><p>' + esc(f[1]) + '</p>').join('') + '</section>' +
    '<div class="box"><div class="cta" style="justify-content:center"><a class="btn g" href="' + esc(botUrl) + '">' + esc(ui.cta) + '</a>' +
    (tel ? '<a class="btn o" href="tel:' + esc(tel) + '">' + esc(ui.call) + '</a>' : '') + '</div></div>' +
    '<section><h2>' + esc(ui.more) + '</h2><ul class="links">' +
    others.map(p => '<li><a href="/' + esc(p.slug) + '">' + esc(p.h1) + '</a></li>').join('') +
    '<li><a href="/">' + esc(CONTENT.NAME) + '</a></li></ul></section>' +
    '</main><footer class="w">© ' + esc(CONTENT.NAME) + ' · ' + (tel ? '<a href="tel:' + esc(tel) + '">' + esc(phone) + '</a> · ' : '') +
    '<a href="mailto:' + esc(CONTENT.EMAIL) + '">' + esc(CONTENT.EMAIL) + '</a> · ' +
    CONTENT.LINKS.map(l => '<a href="' + esc(l.url) + '" rel="noopener">' + esc(l.label.split(' — ')[0]) + '</a>').join(' · ') +
    '</footer></body></html>';
}

module.exports = { PAGES, find, render };
