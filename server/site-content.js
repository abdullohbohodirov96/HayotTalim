/* Ochiq sayt uchun YAGONA matn manbai: sarlavha, tavsif, nom variantlari,
   savol-javoblar va qidiruv tizimlari uchun statik matn.

   Shu fayldan foydalanadi:
     — build.js        → index.html (statik sayt va server uchun asos);
     — server/seo.js   → serverda sozlamalar bilan to'ldirilgan HTML;
     — js/app.js       → savol-javob sozlamada bo'sh bo'lsa (window.SITE_FAQ).
   Bitta joyda o'zgartirilsa — hamma joyda bir xil bo'ladi.

   Qoidalar: narx yozilmaydi, diniy ibora ishlatilmaydi, faqat haqiqiy
   ma'lumot (markaz o'zi aytgan: haftada 3 marta, 80 daqiqa, 10 kishigacha,
   ayollar/erkaklar/bolalar alohida, online va offline).                */
'use strict';

const NAME = process.env.APP_NAME || 'Sabo Academy';

/* Standart aloqa (statik sayt uchun; serverda Sozlamadagisi ishlatiladi) */
const PHONE = process.env.SITE_PHONE || '+998 50 999 97 33';
const LINKS = [
  { label: 'Instagram — sabo.academy', url: 'https://www.instagram.com/sabo.academy/' },
  { label: 'Telegram kanal — SaboAcademy', url: 'https://t.me/SaboAcademy' },
  { label: 'Facebook — Sabo Academy', url: 'https://www.facebook.com/profile.php?id=61595261428849' }
];
const FACEBOOK = 'https://www.facebook.com/profile.php?id=61595261428849';

/* Saytda harf-harf yoziladigan shiorlar (Sozlamada o'zgartiriladi) */
const TAGLINES = 'Tilni yodlatmaymiz — gapirtiramiz!\nOnline va offline darslar\nBirinchi darsdan jonli muloqot\nHar bir til — yangi eshik';

/* Odamlar nomni turlicha yozadi — hammasi shu saytga olib kelsin */
const ALT_NAMES = (process.env.APP_ALT_NAMES
  ? String(process.env.APP_ALT_NAMES).split(',')
  : ['Sabo Academy', 'Sabo Akademiya', 'SaboAcademy', 'Sabo til markazi', 'Сабо Академия', 'Hayot Ta’lim', 'Hayot Talim', 'Hayottalim'])
  .map(s => s.trim()).filter(Boolean);

/* ~60 belgi: brend oldinda (nom bo'yicha qidiruv), keyin asosiy so'z */
const TITLE = NAME + ' — arab tili kurslari, onlayn va offline';

/* ~155 belgi: kim, nima, qanday, chaqiruv */
const DESC = NAME + ' xorijiy tillar markazi: arab tilini noldan 1 yilda o‘rganing. ' +
  'Jonli darslar, ayollar, erkaklar va bolalar uchun alohida guruhlar. Tekin darsga yoziling!';

const FAQ = [
  { q: 'Arab tilini noldan o‘rgansam bo‘ladimi?',
    a: 'Ha. Darslar alifbodan boshlanadi: harflar, o‘qish, keyin grammatika va suhbat. Noldan boshlab 1 yilda arabcha matnni tushunib o‘qish va kundalik suhbat darajasiga yetasiz.' },
  { q: 'Darslar onlaynmi yoki offlaynmi?',
    a: 'Ikkalasi ham bor. Onlayn darslar Zoom orqali jonli o‘tadi — O‘zbekistonning istalgan joyidan va chet eldan qatnashish mumkin.' },
  { q: 'Darslar qanchalik tez-tez bo‘ladi?',
    a: 'Haftada 3 marta, har bir dars 80 daqiqa. Ertalabki, kunduzgi va kechki vaqtlardan qulayini tanlaysiz.' },
  { q: 'Guruhlar qanday tuzilgan?',
    a: 'Ayollar, erkaklar va bolalar uchun alohida guruhlar. Guruhda 10 kishigacha — ustoz har bir o‘quvchiga vaqt ajratadi.' },
  { q: 'Darsni qoldirib ketsam nima bo‘ladi?',
    a: 'Har bir dars yozib olinadi. Yozuv, uy vazifasi va ustoz izohlari shaxsiy kabinetingizda turadi — ortda qolmaysiz.' },
  { q: 'Darajamni qanday bilaman?',
    a: 'Saytdagi bepul daraja testini topshiring: 20 ta savol, 10 daqiqa. Natijaga qarab sizga mos guruh tavsiya qilinadi.' },
  { q: 'Tekin dars qanday o‘tadi?',
    a: '“Tekin darsga yozilish” tugmasini bosing va raqamingizni qoldiring. Administratorimiz bog‘lanadi va jonli ochiq dars havolasini yuboradi.' }
];

/* JavaScript ishlatmaydigan robotlar va qidiruv tizimlari uchun matn.
   <noscript> ichida — brauzerda ko'rinmaydi, lekin HTML da o'qiladi. */
function seoText(o) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const name = esc(o.name || NAME);
  const phone = String(o.phone || '').trim();
  const tel = phone.replace(/[^+0-9]/g, '');
  const parts = [
    '<noscript><main id="seo-prerender" style="max-width:860px;margin:24px auto;padding:28px;font:16px/1.6 system-ui,sans-serif;color:#0f4a40;background:#fff;border-radius:18px">',
    '<h1>' + name + ' — arab tili kurslari</h1>',
    '<p><strong>' + name + '</strong> — xorijiy tillar markazi. Arab tilini noldan boshlab 1 yilda o‘rganing: ' +
      'tajribali ustozlar bilan jonli darslar (onlayn Zoom va offline), haftada 3 marta, har biri 80 daqiqa. ' +
      'Ayollar, erkaklar va bolalar uchun alohida kichik guruhlar (10 kishigacha). Har bir dars yozib olinadi.</p>',
    '<h2>Arab tili kursi: A1 dan C2 gacha</h2>',
    '<ul><li>1-oy: harflar va o‘qish</li><li>3-oy: ravon o‘qish va to‘g‘ri talaffuz</li>' +
      '<li>6-oy: ma’noni tushunish, asosiy grammatika</li><li>12-oy: arabcha gaplashish (A2–B1)</li></ul>',
    '<h2>Tekin dars va bepul daraja testi</h2>',
    '<p>Birinchi dars — tekin. Raqamingizni qoldiring yoki qo‘ng‘iroq qiling. Darajangizni saytdagi bepul test bilan 10 daqiqada aniqlang.</p>',
    '<h2>Ko‘p so‘raladigan savollar</h2>'
  ];
  FAQ.forEach(f => parts.push('<h3>' + esc(f.q) + '</h3><p>' + esc(f.a) + '</p>'));
  parts.push('<h2>Bog‘lanish</h2>');
  if (phone) parts.push('<p>Telefon: <a href="tel:' + esc(tel) + '">' + esc(phone) + '</a></p>');
  if (o.address) parts.push('<p>Manzil: ' + esc(o.address) + '</p>');
  (o.links || []).forEach(l => parts.push('<p><a href="' + esc(l.url) + '">' + esc(l.label) + '</a></p>'));
  parts.push('</main></noscript>');
  return parts.join('');
}

/* schema.org FAQPage — Google savol-javobni tushunadi */
function faqLd() {
  return {
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };
}

module.exports = { NAME, PHONE, LINKS, FACEBOOK, TAGLINES, ALT_NAMES, TITLE, DESC, FAQ, seoText, faqLd };
