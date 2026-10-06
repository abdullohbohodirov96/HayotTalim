/* Karta orqali to'lov: botdagi «To'lov qilish» → karta raqami → «To'ladim»,
   bank bildirishnomasi (Humo/Uzcard) kanalga tushganda AVTOMATIK tasdiq.

   Qanday taniladi:
     — o'quvchi «To'lov qilish» ni bosganda unga ANIQ summa beriladi:
       qarz + kichik «dum» (1…99 so'm), masalan 400 000 → 400 037 so'm.
       Dum hozir kutilayotgan boshqa da'volarda yo'q — shuning uchun summa
       bir xil oylik to'lovlar orasida ham noyob bo'ladi;
     — bildirishnoma kanalidagi xabardan kirim summasi o'qiladi
       (Пополнение / To'ldirish / Kirim / Zachislenie / ➕ …);
     — summa da'vo bilan aniq mos kelsa — to'lov yoziladi, o'quvchiga
       kvitansiya raqami va keyingi to'lov sanasi yuboriladi;
     — mos kelmasa — administratorga xabar va ERP dagi ro'yxatda qo'lda
       tasdiqlash qoladi (hech narsa yo'qolmaydi).

   Yozuvlar:
     payclaim/<id> { id, studentId, chatId, base, amount, tail, status:'kutilmoqda'|'tolandi'|'tasdiqlandi'|'rad'|'eskirdi',
                     paidPressedAt, createdAt, atMs, txId, paymentId, receiptNo }
     banktx/<id>   { id, amount, card4, text, chatId, at, atMs, status:'yangi'|'mos'|'mos-emas', claimId }   */
'use strict';

const CLAIM_TTL_MS = 3 * 24 * 3600 * 1000;      // da'vo 3 kun kutadi

/* ---------- Bildirishnoma matnini o'qish ---------- */
const IN_RE = /(попол|зачисл|поступ|приход|перевод\s+на\s+карт|perevod\s+na\s+kart|popoln|zachisl|postupl|to['’‘`ʻ]?ldir|kirim|tushum|o['’‘`ʻ]?tkazma\s+qabul|qabul\s+qilindi|credit|incoming|received|➕|\+\s*\d)/i;
const OUT_RE = /(списан|оплат|покупк|снят|spisan|oplata|pokupka|xarid|yechi|chiqim|to['’‘`ʻ]?lov\s+amalga|debit|purchase|withdraw|➖)/i;

function toNum(s) {
  /* "1 250 000.00", "400,000.00", "400 000,00", "400000" */
  let t = String(s).replace(/[\s  ']/g, '');
  if (/[.,]\d{2}$/.test(t)) t = t.slice(0, -3);
  t = t.replace(/[.,]/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Bildirishnoma matnidan kirim summasini oladi. Chiqim bo'lsa null. */
function parseBank(text) {
  const raw = String(text || '');
  if (!raw.trim()) return null;
  const incoming = IN_RE.test(raw);
  const outgoing = OUT_RE.test(raw);
  if (!incoming) return null;
  if (outgoing && !/(попол|зачисл|popoln|zachisl|to['’‘`ʻ]?ldir|kirim|➕)/i.test(raw)) return null;
  /* Birinchi «summa + valyuta» — odatda operatsiya summasi; balans keyinroq keladi */
  const amtRe = /([+]?\s*\d{1,3}(?:[\s  .,']\d{3})+(?:[.,]\d{2})?|[+]?\s*\d+(?:[.,]\d{2})?)\s*(uzs|so['’‘`ʻ]?m|сум|sum)\b/gi;
  let m, amount = NaN;
  while ((m = amtRe.exec(raw))) {
    const n = toNum(m[1].replace('+', ''));
    if (n > 0) { amount = n; break; }
  }
  if (!(amount > 0)) return null;
  const c = /(?:\*{1,4}|x{2,4}|•{2,4})\s*(\d{4})/i.exec(raw);
  return { amount: Math.round(amount), card4: c ? c[1] : '' };
}

/* ---------- Ombor yordamchilari ---------- */
async function listCol(store, col) {
  return (await store.list(col + '/')).filter(r => r.path.split('/').length === 2).map(r => r.data).filter(Boolean);
}

function payConf(settings) {
  const b = (settings && settings.bot) || {};
  return {
    card: String(b.payCard || '').replace(/[^\d ]/g, '').trim(),
    holder: String(b.payHolder || '').trim(),
    bank: String(b.payBankChat || '').trim(),            // kanal: -100… yoki @nom
    preDays: b.payPreDays == null ? 2 : Math.max(0, Number(b.payPreDays) || 0)
  };
}

function isBankChat(conf, chat) {
  if (!conf.bank || !chat) return false;
  const want = conf.bank.replace(/^@/, '').toLowerCase();
  return String(chat.id) === conf.bank || (chat.username && String(chat.username).toLowerCase() === want);
}

function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function cardFmt(c) { return String(c).replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 '); }

/** O'quvchining hozirgi to'lanadigan summasi (muddati kelgan + yaqin hisoblar) */
function dueFor(A, studentId, invoices, payments) {
  const paid = A.paidByInvoice(payments);
  /* Faqat muddati kelgan yoki 10 kun ichida keladigan hisoblar — kelajakdagi oylar emas */
  const t = new Date(A.today() + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 10);
  const horizon = t.toISOString().slice(0, 10), ym = A.today().slice(0, 7);
  const open = invoices.filter(i => i.studentId === studentId && A.invoiceRemaining(i, paid) > 0 &&
    (i.dueDate ? String(i.dueDate) <= horizon : String(i.month || '') <= ym))
    .sort((a, b) => String(a.dueDate || a.month).localeCompare(String(b.dueDate || b.month)));
  const total = open.reduce((s, i) => s + A.invoiceRemaining(i, paid), 0);
  return { total: Math.round(total), open, paid };
}

/** Kutilayotgan da'volarda yo'q dum (1…99) */
function pickTail(pending, base) {
  const used = {};
  pending.forEach(c => { if (c.base === base) used[c.tail] = true; });
  for (let i = 0; i < 200; i++) {
    const t = 1 + Math.floor(Math.random() * 99);
    if (!used[t]) return t;
  }
  return 0;
}

/** «To'lov qilish»: da'vo yaratadi (yoki eskisini qaytaradi) */
async function startClaim(ctx, student, chatId) {
  const { store, A, stamp } = ctx;
  const all = await store.all();
  const invoices = [], payments = [];
  all.forEach(({ path: p, data }) => {
    const parts = p.split('/');
    if (parts.length !== 2 || !data) return;
    if (parts[0] === 'invoices') invoices.push(data);
    else if (parts[0] === 'payments') payments.push(data);
  });
  const due = dueFor(A, student.id, invoices, payments);
  if (due.total <= 0) return { none: true };
  const now = Date.now();
  const claims = await listCol(store, 'payclaim');
  const pending = claims.filter(c => (c.status === 'kutilmoqda' || c.status === 'tolandi') && now - c.atMs < CLAIM_TTL_MS);
  const mine = pending.find(c => c.studentId === student.id && c.base === due.total);
  if (mine) return { claim: mine, due };
  const tail = pickTail(pending, due.total);
  const id = 'pc_' + now.toString(36) + Math.random().toString(36).slice(2, 6);
  const claim = {
    id, studentId: student.id, chatId: String(chatId), base: due.total, tail, amount: due.total + tail,
    status: 'kutilmoqda', createdAt: stamp(), atMs: now
  };
  await store.set('payclaim/' + id, claim);
  return { claim, due };
}

async function markPaid(ctx, student) {
  const claims = (await listCol(ctx.store, 'payclaim'))
    .filter(c => c.studentId === student.id && c.status === 'kutilmoqda')
    .sort((a, b) => b.atMs - a.atMs);
  const c = claims[0];
  if (!c) return null;
  c.status = 'tolandi';
  c.paidPressedAt = ctx.stamp();
  await ctx.store.set('payclaim/' + c.id, c);
  return c;
}

/** Bildirishnomani yozib qo'yadi (bir xabar ikki marta yozilmaydi) */
async function saveBankTx(ctx, text, chatId, msgId) {
  const p = parseBank(text);
  if (!p) return null;
  const id = 'bt_' + String(chatId).replace(/[^\w-]/g, '') + '_' + String(msgId || Date.now());
  const old = await ctx.store.get('banktx/' + id);
  if (old) return old;
  const tx = {
    id, amount: p.amount, card4: p.card4, text: String(text).slice(0, 600), chatId: String(chatId),
    at: ctx.stamp(), atMs: Date.now(), status: 'yangi', claimId: null
  };
  await ctx.store.set('banktx/' + id, tx);
  return tx;
}

/**
 * Yangi kirimlarni kutilayotgan da'volar bilan solishtiradi.
 * ctx.confirm(claim, tx) — to'lovni yozadi va o'quvchiga xabar beradi.
 */
async function reconcile(ctx) {
  const now = Date.now();
  const txs = (await listCol(ctx.store, 'banktx')).filter(t => t.status === 'yangi');
  if (!txs.length) return { matched: 0, unmatched: 0 };
  let claims = (await listCol(ctx.store, 'payclaim'))
    .filter(c => (c.status === 'kutilmoqda' || c.status === 'tolandi') && now - c.atMs < CLAIM_TTL_MS);
  let matched = 0, unmatched = 0;
  for (const tx of txs.sort((a, b) => a.atMs - b.atMs)) {
    /* 1) aniq summa (dum bilan) */
    let hit = claims.filter(c => c.amount === tx.amount);
    /* 2) dumsiz to'lagan bo'lsa — faqat bitta da'vo shu summaga mos kelsa */
    if (!hit.length) {
      const base = claims.filter(c => c.base === tx.amount);
      if (base.length === 1) hit = base;
    }
    if (hit.length === 1) {
      const c = hit[0];
      try {
        await ctx.confirm(c, tx);
        claims = claims.filter(x => x.id !== c.id);
        matched++;
      } catch (e) { console.error('paybot confirm:', e.message); }
    } else if (now - tx.atMs > 10 * 60 * 1000 || hit.length > 1) {
      /* 10 daqiqa ichida da'vo kelmasa — qo'lda tekshirishga */
      tx.status = 'mos-emas';
      await ctx.store.set('banktx/' + tx.id, tx);
      unmatched++;
      if (ctx.notifyStaff) {
        ctx.notifyStaff('Kartaga ' + fmt(tx.amount) + ' so’m tushdi, lekin o’quvchi aniqlanmadi.\n' +
          'ERP → Telegram bot → Karta to’lovlari bo’limida qo’lda biriktiring.');
      }
    }
  }
  /* Eskirgan da'volar */
  for (const c of (await listCol(ctx.store, 'payclaim'))) {
    if ((c.status === 'kutilmoqda') && now - c.atMs >= CLAIM_TTL_MS) {
      c.status = 'eskirdi';
      await ctx.store.set('payclaim/' + c.id, c);
    }
  }
  return { matched, unmatched };
}

module.exports = {
  parseBank, payConf, isBankChat, startClaim, markPaid, saveBankTx, reconcile, dueFor,
  fmt, cardFmt, CLAIM_TTL_MS, listCol
};
