/* Telegram bot — savollarga javob beradigan yordamchi.

   Qanday ishlaydi: odam yozgan matn kichik harfga keltiriladi, kirillcha
   bo'lsa lotinchaga o'giriladi, keyin har bir mavzuning kalit so'zlari
   bilan solishtiriladi. Eng ko'p mos kelgan mavzu javobi qaytadi.
   Hech biri mos kelmasa — null (bot savolni administratorga yuboradi).

   Qoidalar: narx yozilmaydi (administrator aytadi), diniy ibora yo'q,
   faqat markaz aytgan haqiqiy ma'lumot. Telefon, vaqt va havolalar
   Sozlamalardan olinadi.                                               */
'use strict';
const SITE = require('./site-content');

const CYR = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y',
  'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
  'х': 'x', 'ц': 's', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h'
};

function norm(t) {
  let s = String(t || '').toLowerCase();
  s = s.replace(/[Ѐ-ӿ]/g, ch => (CYR[ch] != null ? CYR[ch] : ch));
  s = s.replace(/[’'`ʻʼ‘]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return ' ' + s + ' ';
}

/* Har mavzu: kalit so'zlar (bo'lak sifatida qidiriladi) va javob funksiyasi */
const TOPICS = [
  {
    id: 'salom', weight: 0.5,
    keys: ['salom', 'assalom', 'privet', 'zdravstv', 'hello', 'hayrli kun', 'xayrli kun'],
    answer: c => 'Salom! ' + c.name + ' botiga xush kelibsiz 😊\n\n' +
      'Kurslar, darslar vaqti, tekin dars yoki daraja testi haqida savolingizni yozing — darhol javob beraman.'
  },
  {
    id: 'narx', weight: 2,
    keys: ['narx', 'necha pul', 'qancha pul', 'qancha turadi', 'tolov', 'oylik', 'summa', 'som', 'sena', 'stoim', 'skolko', 'price', 'pul'],
    answer: c => 'Kurs narxi va amaldagi chegirmalarni administratorimiz shaxsan aytadi — har kim uchun mos guruh va to‘lov variantini tanlab beradi.\n\n' +
      '👉 Eng yaxshi yo‘l: avval <b>tekin darsga</b> yoziling. Dars oxirida kursga qabul ochiladi va chegirma beriladi.\n' +
      '📞 ' + c.phone
  },
  {
    id: 'tekin', weight: 2,
    keys: ['tekin', 'bepul', 'besplat', 'sinov dars', 'probn', 'ochiq dars', 'free'],
    answer: c => '🎁 <b>Birinchi dars — tekin.</b>\n\nJonli ochiq darsda usulimizni ko‘rasiz, ustoz bilan tanishasiz va keyin qaror qilasiz. ' +
      'Dars oxirida kursga qabul va chegirma bo‘ladi.\n\nYozilish uchun pastdagi «Bepul darsga yozilish» tugmasini bosing — 3 ta qisqa savol, 1 daqiqa.'
  },
  {
    id: 'vaqt', weight: 1.5,
    keys: ['qachon', 'vaqt', 'soat', 'jadval', 'nechada', 'kunlari', 'haftada', 'raspis', 'vremya', 'kogda', 'ertalab', 'kechki', 'kechqurun'],
    answer: c => '🕒 Darslar <b>haftada 3 marta</b>, har biri <b>' + c.lessonMinutes + ' daqiqa</b>.\n' +
      (c.times.length ? 'Dars vaqtlari: ' + c.times.join(', ') + '.\n' : '') +
      'Ertalabki, kunduzgi va kechki guruhlar bor — qulay vaqtni tanlaysiz.' +
      (c.workStart && c.workEnd ? '\nMarkaz ish vaqti: ' + c.workStart + '–' + c.workEnd + '.' : '')
  },
  {
    id: 'format', weight: 1.5,
    keys: ['onlayn', 'online', 'offlayn', 'offline', 'zoom', 'qayerda', 'manzil', 'adres', 'joylash', 'uydan', 'kelish', 'gde', 'filial', 'lokatsiya', 'location'],
    answer: c => '💻 Darslar <b>onlayn</b> (Zoom orqali jonli) va <b>offlayn</b> bo‘ladi.\n' +
      'Onlayn darsga O‘zbekistonning istalgan joyidan va chet eldan qatnashish mumkin.' +
      (c.address ? '\n📍 Manzil: ' + c.address : '\nOfflayn manzil va yo‘nalishni administrator aytadi: ' + c.phone)
  },
  {
    id: 'noldan', weight: 1.5,
    keys: ['noldan', 'nol', 'umuman bilmayman', 'bilmayman', 'boshlangich', 'alifbo', 'harf', 'yangi boshlov', 's nulya', 'nachina'],
    answer: () => '✅ Ha, <b>noldan</b> boshlasangiz bo‘ladi. Darslar alifbodan boshlanadi: harflar, o‘qish, keyin grammatika va suhbat.\n\n' +
      'Natija yo‘li:\n1-oy — harflar va o‘qish\n3-oy — ravon o‘qish\n6-oy — ma’noni tushunish\n12-oy — arabcha gaplashish (A2–B1)'
  },
  {
    id: 'muddat', weight: 1.5,
    keys: ['necha oy', 'qancha vaqt', 'qancha muddat', 'muddat', 'necha yil', 'qachon gapiraman', 'natija', 'skolko mesyac', 'srok'],
    answer: () => '📈 Noldan boshlab <b>1 yilda</b> arabcha matnni tushunib o‘qish va kundalik suhbat darajasiga yetasiz.\n\n' +
      '1-oy — harflar va o‘qish\n3-oy — ravon o‘qish va to‘g‘ri talaffuz\n6-oy — ma’noni tushunish, asosiy grammatika\n12-oy — arabcha gaplashish (A2–B1)'
  },
  {
    id: 'guruh', weight: 1.5,
    keys: ['guruh', 'ayollar', 'ayol', 'erkak', 'bola', 'bolalar', 'yosh', 'necha kishi', 'gruppa', 'zhensk', 'muzhsk', 'deti', 'individual', 'yakka'],
    answer: () => '👥 Guruhlar <b>alohida</b>: ayollar, erkaklar va bolalar uchun.\n' +
      'Guruhda <b>10 kishigacha</b> — ustoz har bir o‘quvchiga vaqt ajratadi.\n' +
      'Yakka (individual) dars kerak bo‘lsa, administrator bilan kelishasiz.'
  },
  {
    id: 'ustoz', weight: 1,
    keys: ['ustoz', 'oqituvchi', 'muallim', 'domla', 'prepodav', 'uchitel', 'teacher'],
    answer: () => '👨‍🏫 Darslarni tajribali ustozlar olib boradi — noldan boshlovchilar bilan ishlashni biladi: har bir harf va qoidani sabr bilan, tushunarli qilib o‘rgatadi.\n\n' +
      'Ustoz bilan <b>tekin darsda</b> tanishasiz.'
  },
  {
    id: 'daraja', weight: 1.5,
    keys: ['daraja', 'test', 'uroven', 'level', 'qaysi guruhga', 'darajam'],
    answer: c => '📝 Darajangizni <b>bepul test</b> bilan aniqlang: 20 ta savol, 10 daqiqa.\n' + c.site + '/#test\n\n' +
      'Natijaga qarab sizga mos guruh tavsiya qilinadi.'
  },
  {
    id: 'yozuv', weight: 1.5,
    keys: ['qoldir', 'kelolmasam', 'kelmasam', 'yozuv', 'video', 'zapis', 'propust', 'kasal'],
    answer: () => '🎥 Har bir dars <b>yozib olinadi</b>. Darsni qoldirsangiz — yozuv, uy vazifasi va ustoz izohlari shaxsiy kabinetingizda turadi. Ortda qolmaysiz.'
  },
  {
    id: 'kabinet', weight: 1.5,
    keys: ['kabinet', 'login', 'parol', 'parolni', 'kirolmayapman', 'kira olmayapman', 'lichn', 'parol esdan'],
    answer: c => '🔐 Shaxsiy kabinet: ' + c.site + '/#kabinet\n' +
      'Login — shaxsiy kodingiz (5 ta raqam) yoki telefon raqamingiz, parolni administrator beradi.\n' +
      'Parolni unutgan bo‘lsangiz — administratorga yozing, yangisini beradi: ' + c.phone
  },
  {
    id: 'aloqa', weight: 1,
    keys: ['telefon', 'nomer', 'raqam', 'aloqa', 'boglan', 'admin', 'administrator', 'menejer', 'qongiroq', 'zvonit', 'kontakt', 'instagram', 'kanal'],
    answer: c => '📞 Telefon: ' + c.phone + '\n🌐 Sayt: ' + c.site +
      (c.instagram ? '\n📷 Instagram: ' + c.instagram : '') +
      (c.facebook ? '\n📘 Facebook: ' + c.facebook : '') +
      (c.channel ? '\n📢 Telegram kanal: ' + c.channel : '')
  },
  {
    id: 'sayt', weight: 2,
    keys: ['sayt', 'web', 'veb', 'website', 'ssilka', 'silka', 'internet manzil'],
    answer: c => '🌐 Saytimiz: ' + c.site + '\n\n' +
      'Saytda:\n• tekin darsga yozilish\n• bepul daraja testi — ' + c.site + '/#test\n' +
      '• ustozlar bilan tanishish\n• o‘quvchi kabineti — ' + c.site + '/#kabinet'
  },
  {
    id: 'chegirma', weight: 1.5,
    keys: ['chegirma', 'skidka', 'aksiya', 'arzon'],
    answer: () => '🎉 Chegirma <b>tekin dars oxirida</b> ochiladi — kursga birinchi yozilganlar uchun. Tekin darsga yoziling, shartlarni o‘sha yerda aytamiz.'
  },
  {
    id: 'tillar', weight: 1,
    keys: ['qaysi til', 'ingliz', 'rus tili', 'turk tili', 'koreys', 'nemis', 'english', 'boshqa til', 'arab tili'],
    answer: () => '🌍 Hozir asosiy yo‘nalishimiz — <b>arab tili</b> (A1 dan C2 gacha). Boshqa tillar bo‘yicha guruhlar ochilsa, kanalimizda e’lon qilamiz.'
  },
  {
    id: 'yosh', weight: 1,
    keys: ['necha yosh', 'yoshdan', 'katta yosh', 'qari', 'nafaqa', 'maktab'],
    answer: () => '🙂 Yosh chegarasi yo‘q: bolalar uchun alohida guruhlar bor, kattalar ham noldan boshlab o‘qiyapti.'
  },
  {
    id: 'sertifikat', weight: 1,
    keys: ['sertifikat', 'diplom', 'hujjat beriladimi', 'sertifik'],
    answer: c => 'Sertifikat va hujjatlar bo‘yicha aniq ma’lumotni administrator beradi: ' + c.phone
  }
];

/** Matnga eng mos mavzu va javob; topilmasa null */
function answer(text, ctx) {
  const t = norm(text);
  if (t.trim().length < 2) return null;
  let best = null, bestScore = 0;
  for (const tp of TOPICS) {
    let hits = 0;
    for (const k of tp.keys) {
      const nk = norm(k).trim();
      if (!nk) continue;
      /* Qisqa so'zlar (som, pul, narx) faqat so'z BOSHIDA mos kelsin: "narxi" — ha, "qasoming" — yo'q */
      if (nk.length <= 4 ? t.indexOf(' ' + nk) >= 0 : t.indexOf(nk) >= 0) hits++;
    }
    if (!hits) continue;
    const score = hits * tp.weight;
    if (score > bestScore) { bestScore = score; best = tp; }
  }
  if (!best) return null;
  return { id: best.id, text: best.answer(ctx) };
}

/** Sozlamalardan javoblar uchun kontekst */
function context(settings) {
  const s = settings || {};
  const site = String(process.env.PUBLIC_URL || process.env.SITE_URL || 'https://hayottalim.uz').replace(/\/$/, '');
  const times = (Array.isArray(s.lessonTimes) ? s.lessonTimes : [])
    .map(x => (typeof x === 'string' ? x : (x && x.from && x.to ? x.from + '–' + x.to : ''))).filter(Boolean).slice(0, 8);
  return {
    name: String(s.centerName || SITE.NAME),
    phone: String(s.phone || SITE.PHONE),
    address: String(s.address || ''),
    instagram: String(s.instagram == null ? SITE.LINKS[0].url : s.instagram),
    facebook: String(s.facebook == null ? SITE.FACEBOOK : s.facebook),
    channel: String(s.tgChannel == null ? SITE.LINKS[1].url : s.tgChannel),
    workStart: String(s.workStart || ''), workEnd: String(s.workEnd || ''),
    lessonMinutes: Number(s.lessonMinutes) || 80,
    times, site
  };
}

/** "Ko'p so'raladigan savollar" ro'yxati */
function faqListText() {
  return '❓ <b>Ko‘p so‘raladigan savollar</b>\n\n' +
    SITE.FAQ.map((f, i) => (i + 1) + '. ' + f.q).join('\n') +
    '\n\nSavol raqamini yoki o‘z savolingizni yozing — javob beraman.';
}
/** Raqam bilan savol tanlash: "3" → 3-savol javobi */
function faqByNumber(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})$/);
  if (!m) return null;
  const f = SITE.FAQ[Number(m[1]) - 1];
  return f ? '<b>' + f.q + '</b>\n\n' + f.a : null;
}

module.exports = { answer, context, faqListText, faqByNumber, norm, TOPICS };
