/* Bazani (Neon) behuda uyg'otmaslik.

   Neon bazasi oxirgi so'rovdan 5 daqiqa o'tgach uxlaydi va uxlab turgan vaqt
   uchun pul olinmaydi. Ilgari orqa fondagi tekshiruvlar (zoom, to'lov boti,
   navbat, guruh kodlari) bazaga har 1–10 daqiqada murojaat qilardi — baza
   kecha-yu kunduz uyg'oq turardi (oyiga ~186 soat).

   Endi har bir orqa fon ishi faqat ikki holatda bazaga tegadi:
     1) baza baribir uyg'oq — oxirgi daqiqalarda odam (sayt, kabinet, bot)
        murojaat qilgan bo'lsa: «awakeEvery» oralig'ida;
     2) aks holda soat bo'yicha TEKISLANGAN oraliqda (masalan, :00 va :30) —
        hamma ishlar bir vaqtda bir marta uyg'otadi, alohida-alohida emas.

   Sozlash: DB_QUIET=0 — o'chirish (eski xatti-harakat).                     */
'use strict';

const OFF = process.env.DB_QUIET === '0';
const AWAKE_MS = Number(process.env.DB_AWAKE_MS || 4 * 60 * 1000);   // Neon 5 daqiqada uxlaydi
let lastHuman = 0;
const lastRun = {};
const lastSlot = {};

/** Odam murojaat qildi (API so'rovi, bot xabari) — baza hozir uyg'oq */
function human() { lastHuman = Date.now(); }

function awake(now) { return (now || Date.now()) - lastHuman < AWAKE_MS; }

/**
 * Orqa fon ishi hozir bazaga tegsinmi?
 *   every       — baza uxlab turganda ham eng kamida shunchalik oraliqda (soatga tekislanadi)
 *   awakeEvery  — baza uyg'oq paytda shunchalik tez-tez
 */
function due(name, every, awakeEvery, nowMs) {
  const now = nowMs || Date.now();
  if (OFF) return true;
  const slot = Math.floor(now / every);
  if (lastSlot[name] !== slot) {
    lastSlot[name] = slot; lastRun[name] = now;
    return true;
  }
  if (awakeEvery && awake(now) && now - (lastRun[name] || 0) >= awakeEvery) {
    lastRun[name] = now;
    return true;
  }
  return false;
}

function _reset() { lastHuman = 0; for (const k in lastRun) delete lastRun[k]; for (const k in lastSlot) delete lastSlot[k]; }

module.exports = { human, awake, due, AWAKE_MS, OFF, _reset };
