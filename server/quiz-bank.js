/* Telegram kanal uchun viktorina savollari (Telegram "Quiz" so'rovnomasi).
   Har kuni 3 ta: 1) lug'at, 2) grammatika/harf, 3) qiziqarli viktorina.

   Cheklovlar (Telegram): savol ≤ 300 belgi, variant ≤ 100 belgi,
   izoh ≤ 200 belgi, 2–10 variant. `correct` — to'g'ri variant indeksi (0 dan).
   Qoidalar: diniy mavzu yo'q, narx yo'q, faktlar tekshirilgan.

   Yangi hafta qo'shish: shu ro'yxatga w2… id bilan qo'shiladi YOKI
   ERP → Telegram bot → Viktorina → «Savollarni qo'shish» orqali.      */
'use strict';

module.exports = [
  /* ---------- 1-hafta ---------- */
  { id: 'w1d1s1', kind: 'Lug‘at', question: '📚 «كِتَاب» (kitāb) so‘zi nimani bildiradi?',
    options: ['Daftar', 'Kitob', 'Qalam', 'Stol'], correct: 1,
    explain: 'كِتَاب — kitob. Ko‘pligi: كُتُب (kutub). O‘zbekchadagi «kitob» so‘zi ham shundan.' },
  { id: 'w1d1s2', kind: 'Alifbo', question: '🔤 Arab alifbosida nechta harf bor?',
    options: ['24', '26', '28', '32'], correct: 2,
    explain: 'Arab alifbosida 28 ta harf bor. Ko‘p harflar so‘z ichida shaklini o‘zgartiradi.' },
  { id: 'w1d1s3', kind: 'Viktorina', question: '🧭 Arab tilida yozuv qaysi yo‘nalishda yoziladi?',
    options: ['Chapdan o‘ngga', 'O‘ngdan chapga', 'Yuqoridan pastga', 'Ikkala tomonga'], correct: 1,
    explain: 'Arabcha o‘ngdan chapga yoziladi, lekin raqamlar chapdan o‘ngga o‘qiladi.' },

  { id: 'w1d2s1', kind: 'Lug‘at', question: '💬 «شُكْرًا» (shukran) nima degani?',
    options: ['Kechirasiz', 'Rahmat', 'Xayr', 'Marhamat'], correct: 1,
    explain: 'شُكْرًا — rahmat. Javobiga «عَفْوًا» (‘afwan) — arzimaydi, deyiladi.' },
  { id: 'w1d2s2', kind: 'Alifbo', question: '🔤 «ب» harfi qanday o‘qiladi?',
    options: ['T', 'B', 'N', 'Y'], correct: 1,
    explain: 'ب — «bā», B tovushi. Ostidagi bitta nuqtasi bilan ت (T) va ث (S) dan farq qiladi.' },
  { id: 'w1d2s3', kind: 'Viktorina', question: '🌍 Arab tili BMTning rasmiy tillaridan biri. BMTda jami nechta rasmiy til bor?',
    options: ['4 ta', '6 ta', '8 ta', '10 ta'], correct: 1,
    explain: 'BMTning 6 ta rasmiy tili: arab, ingliz, xitoy, fransuz, rus va ispan.' },

  { id: 'w1d3s1', kind: 'Lug‘at', question: '🏠 «بَيْت» (bayt) so‘zining ma’nosi?',
    options: ['Uy', 'Eshik', 'Ko‘cha', 'Bog‘'], correct: 0,
    explain: 'بَيْت — uy. «Eshik» arabchada بَاب (bāb).' },
  { id: 'w1d3s2', kind: 'Grammatika', question: '👤 «أَنَا» (ana) olmoshi qaysi so‘zga to‘g‘ri keladi?',
    options: ['Sen', 'U', 'Men', 'Biz'], correct: 2,
    explain: 'أَنَا — men. Biz — نَحْنُ (nahnu), u (erkak) — هُوَ (huwa).' },
  { id: 'w1d3s3', kind: 'Viktorina', question: '🇺🇿 Quyidagi o‘zbekcha so‘zlardan qaysi biri arab tilidan kirgan?',
    options: ['Non', 'Kitob', 'Tosh', 'Suv'], correct: 1,
    explain: '«Kitob» arabcha كِتَاب dan. «Tosh» va «suv» — turkiy, «non» — forscha so‘z.' },

  { id: 'w1d4s1', kind: 'Lug‘at', question: '💧 «مَاء» (mā’) nima degani?',
    options: ['Suv', 'Non', 'Choy', 'Sut'], correct: 0,
    explain: 'مَاء — suv. Sut — حَلِيب (halīb), non — خُبْز (xubz).' },
  { id: 'w1d4s2', kind: 'Lug‘at', question: '📏 Arabchada «katta» qaysi so‘z?',
    options: ['صَغِير', 'كَبِير', 'جَدِيد', 'قَدِيم'], correct: 1,
    explain: 'كَبِير (kabīr) — katta. صَغِير — kichik, جَدِيد — yangi, قَدِيم — eski.' },
  { id: 'w1d4s3', kind: 'Viktorina', question: '📅 Xalqaro Arab tili kuni qachon nishonlanadi?',
    options: ['21-fevral', '18-dekabr', '1-sentabr', '8-mart'], correct: 1,
    explain: '18-dekabr — 1973-yilda shu kuni arab tili BMTning rasmiy tillari qatoriga qo‘shilgan.' },

  { id: 'w1d5s1', kind: 'Lug‘at', question: '✏️ «قَلَم» (qalam) so‘zining ma’nosi?',
    options: ['Qalam', 'Kitob', 'Daftar', 'Sumka'], correct: 0,
    explain: 'قَلَم — qalam. Daftar — دَفْتَر (daftar), sumka — حَقِيبَة (haqība).' },
  { id: 'w1d5s2', kind: 'Grammatika', question: '👨 Erkakka «sen» deyish uchun qaysi olmosh ishlatiladi?',
    options: ['أَنْتَ', 'أَنْتِ', 'هُوَ', 'نَحْنُ'], correct: 0,
    explain: 'أَنْتَ (anta) — erkakka «sen», أَنْتِ (anti) — ayolga «sen». Farq oxiridagi harakatda.' },
  { id: 'w1d5s3', kind: 'Viktorina', question: '🔢 Qaysi raqamlar dunyoda «arab raqamlari» deb ataladi?',
    options: ['I, V, X', '1, 2, 3', 'α, β, γ', '一, 二, 三'], correct: 1,
    explain: '1, 2, 3… Yevropaga arablar orqali o‘tgani uchun shunday ataladi; ularning asli Hindistondan.' },

  { id: 'w1d6s1', kind: 'Ibora', question: '🌅 «صَبَاحُ الْخَيْر» (sabāhu-l-xayr) nima degani?',
    options: ['Xayrli tun', 'Xayrli tong', 'Xush kelibsiz', 'Ishlar qalay?'], correct: 1,
    explain: 'صَبَاحُ الْخَيْر — xayrli tong. Javobi: صَبَاحُ النُّور (sabāhu-n-nūr).' },
  { id: 'w1d6s2', kind: 'Raqamlar', question: '🔢 «وَاحِد، اِثْنَان، ثَلَاثَة» — bu so‘zlar nima?',
    options: ['Ranglar', '1, 2, 3 raqamlari', 'Hafta kunlari', 'Oila a’zolari'], correct: 1,
    explain: 'وَاحِد — bir, اِثْنَان — ikki, ثَلَاثَة — uch.' },
  { id: 'w1d6s3', kind: 'Viktorina', question: '🌐 Arab tili nechta davlatda rasmiy til hisoblanadi?',
    options: ['5 ta', '10 ta', '20 dan ortiq', '50 dan ortiq'], correct: 2,
    explain: 'Arab tili 20 dan ortiq davlatda rasmiy til — Marokashdan Iroqqacha.' },

  { id: 'w1d7s1', kind: 'Lug‘at', question: '🚗 «سَيَّارَة» (sayyāra) so‘zining ma’nosi?',
    options: ['Mashina', 'Samolyot', 'Poyezd', 'Velosiped'], correct: 0,
    explain: 'سَيَّارَة — mashina. Samolyot — طَائِرَة (tā’ira), poyezd — قِطَار (qitār).' },
  { id: 'w1d7s2', kind: 'Grammatika', question: '✍️ So‘z oxiridagi «ة» (ta marbuta) ko‘pincha nimani bildiradi?',
    options: ['Ko‘plikni', 'Muannas (ayol jinsi)ni', 'O‘tgan zamonni', 'Savolni'], correct: 1,
    explain: 'ة ko‘pincha muannas belgisi: مُعَلِّم — ustoz (erkak), مُعَلِّمَة — ustoz (ayol).' },
  { id: 'w1d7s3', kind: 'Viktorina', question: '🧮 «Algebra» so‘zi qaysi vatandoshimiz kitobi nomidan kelib chiqqan?',
    options: ['Ibn Sino', 'Al-Xorazmiy', 'Beruniy', 'Ulug‘bek'], correct: 1,
    explain: 'Al-Xorazmiyning «Al-jabr val-muqobala» asari nomidagi «al-jabr» — algebra.' }
];
