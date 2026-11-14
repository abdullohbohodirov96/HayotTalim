'use strict';
/**
 * Murojaat izohlari tarixi: lead.notes = [{ at, by, text }] (eskisidan yangisiga).
 * lead.note — doim OXIRGI izoh (ro'yxat, Telegram xabarlari uchun).
 * Avval yagona «note» maydoni bo'lgan — birinchi yangi izohda u «avvalgi izoh» bo'lib saqlanadi.
 */
function addNote(lead, text, by, at) {
  const t = String(text || '').trim().slice(0, 2000);
  if (!lead || !t) return lead;
  const notes = Array.isArray(lead.notes) ? lead.notes.slice() : [];
  const old = String(lead.note || '').trim();
  if (!notes.length && old && old !== t) notes.push({ at: '', by: '', text: old.slice(0, 2000), legacy: true });
  notes.push({ at: String(at || ''), by: String(by || '').slice(0, 60), text: t });
  lead.notes = notes.slice(-100);
  lead.note = t;
  return lead;
}
module.exports = { addNote };
