/* Meta Conversions API (CRM) — murojaat holati o'zgarsa Meta'ga xabar.

   Nima uchun: menejer CRM'da «Bog'lanildi», «Sinov darsiga yozildi»,
   «O'quvchi bo'ldi» yoki «Rad etdi» qilganda Meta qaysi lead haqiqatan
   sifatli bo'lganini biladi va reklamani shunday odamlarga ko'rsatadi
   (ad set maqsadi: «Конверсионные лиды» / Conversion leads).

   Render muhit o'zgaruvchilari:
     META_DATASET_ID     — Events Manager'dagi CRM dataset (pixel) ID
     META_CAPI_TOKEN     — shu dataset uchun Conversions API access token
     META_CAPI_TEST_CODE — (ixtiyoriy) «Test events» kodi, sinash paytida

   Ishonchlilik: har bir hodisa avval bazaga navbatga yoziladi (capiq/),
   so'ng yuboriladi. Internet/Meta xato bersa — har daqiqada qayta urinadi
   (Meta talabi: kuniga kamida bir marta). Bir lead uchun bir bosqich faqat
   bir marta yuboriladi.                                                    */
'use strict';
const crypto = require('crypto');

const GRAPH = 'https://graph.facebook.com/v21.0/';
const MAX_AGE_MS = 6.5 * 24 * 3600e3;     // Meta 7 kundan eski hodisani qabul qilmaydi

/* Bosqich id → Meta'dagi hodisa nomi (lotin, bo'shliqsiz — Meta shuni yaxshi ko'radi) */
const EVENT_NAMES = {
  yangi: 'Lead',
  boglanildi: 'Boglanildi',
  qiziqdi: 'Qiziqdi',
  sinov: 'SinovgaYozildi',
  keldi: 'SinovgaKeldi',
  oquvchi: 'OquvchiBoldi',
  rad: 'RadEtdi',
  sifatsiz: 'Sifatsiz'
};

function configured() { return !!(process.env.META_DATASET_ID && process.env.META_CAPI_TOKEN); }

function eventName(stageId, stageLabel) {
  if (EVENT_NAMES[stageId]) return EVENT_NAMES[stageId];
  const s = String(stageLabel || stageId || '').normalize('NFKD').replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
  return s.slice(0, 40) || 'Stage';
}

function sha(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }
function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;               // 90 123 45 67 → 998901234567
  return d.length >= 11 ? d : '';
}
function metaIdsOf(lead) {
  const ids = [].concat(lead.metaLeadIds || [], lead.metaLeadId ? [lead.metaLeadId] : []);
  return ids.map(String).filter(x => /^\d{6,25}$/.test(x)).filter((x, i, a) => a.indexOf(x) === i);
}

/** Bitta hodisa (Meta formati). lead_id katta son — JSON'da raqam bo'lib,
    aniqligi yo'qolmasligi uchun matn sifatida qo'yib, keyin qo'shtirnoqni olamiz. */
function buildEvent(q) {
  const user = {};
  if (q.metaId) user.lead_id = '@@' + q.metaId + '@@';
  if (q.ph) user.ph = [q.ph];
  if (q.fn) user.fn = [q.fn];
  return {
    event_name: q.event,
    event_time: Math.floor(q.t / 1000),
    action_source: 'system_generated',
    user_data: user,
    custom_data: { event_source: 'crm', lead_event_source: 'Sabo ERP' }
  };
}
function payloadJson(events) {
  const body = { data: events };
  if (process.env.META_CAPI_TEST_CODE) body.test_event_code = process.env.META_CAPI_TEST_CODE;
  return JSON.stringify(body).replace(/"@@(\d+)@@"/g, '$1');
}

/* ---------- holat (admin uchun) ---------- */
const stat = { sent: 0, failed: 0, lastOkAt: '', lastError: '', lastErrorAt: '' };

let ctx = null, timer = null, flushing = false;
let postImpl = null;                       // testlar uchun almashtiriladi

async function post(json) {
  if (postImpl) return postImpl(json);
  const url = GRAPH + encodeURIComponent(process.env.META_DATASET_ID) + '/events?access_token=' +
    encodeURIComponent(process.env.META_CAPI_TOKEN);
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error((j.error && (j.error.error_user_msg || j.error.message)) || ('HTTP ' + r.status));
  return j;
}

/** Murojaat saqlanganda chaqiriladi: bosqich o'zgargan bo'lsa navbatga qo'yadi. */
async function onLeadSaved(oldLead, lead, opts) {
  try {
    if (!ctx || !lead || !lead.id) return 0;
    if (!configured() && !(opts && opts.force)) return 0;
    if (oldLead && String(oldLead.stage || '') === String(lead.stage || '') &&
      metaIdsOf(oldLead).join() === metaIdsOf(lead).join()) return 0;
    const ids = metaIdsOf(lead);
    const ph = normPhone(lead.phone);
    if (!ids.length && !ph) return 0;
    const { store } = ctx;
    let label = '';
    try {
      const f = lead.funnelId ? await store.get('funnels/' + lead.funnelId) : null;
      const st = ((f && f.stages) || []).filter(s => s.id === lead.stage)[0];
      label = st ? st.label : '';
    } catch (e) { }
    const ev = eventName(lead.stage || 'yangi', label);
    const fn = String(lead.name || '').trim().split(/\s+/)[0];
    const base = { event: ev, t: Date.now(), ph: ph ? sha(ph) : '', fn: fn && !/noma/i.test(fn) ? sha(fn.toLowerCase()) : '', leadId: lead.id, tries: 0 };
    const list = ids.length ? ids.map(metaId => Object.assign({ metaId }, base)) : [Object.assign({ metaId: '' }, base)];
    let n = 0;
    for (const q of list) {
      const key = sha(lead.id + '|' + (q.metaId || 'ph') + '|' + ev).slice(0, 32);
      if (await store.get('capisent/' + key) || await store.get('capiq/' + key)) continue;
      await store.set('capiq/' + key, Object.assign({ id: key }, q));
      n++;
    }
    if (n) setTimeout(() => flush().catch(() => { }), 300);
    return n;
  } catch (e) { console.error('capi:', e.message); return 0; }
}

/** Navbatdagilarni yuboradi (50 tadan). */
async function flush() {
  if (!ctx || flushing || !configured()) return { sent: 0 };
  flushing = true;
  const { store } = ctx;
  let sent = 0;
  try {
    const items = (await store.list('capiq/')).map(x => x.data).filter(Boolean);
    if (!items.length) return { sent: 0 };
    const now = Date.now();
    for (const old of items.filter(q => now - q.t > MAX_AGE_MS)) {      // juda eski — Meta olmaydi
      await store.del('capiq/' + old.id); stat.failed++;
    }
    const fresh = items.filter(q => now - q.t <= MAX_AGE_MS && (!q.next || q.next <= now));
    for (let i = 0; i < fresh.length; i += 50) {
      const part = fresh.slice(i, i + 50);
      try {
        await post(payloadJson(part.map(buildEvent)));
        for (const q of part) {
          await store.set('capisent/' + q.id, { leadId: q.leadId, event: q.event, at: new Date().toISOString() });
          await store.del('capiq/' + q.id);
        }
        sent += part.length; stat.sent += part.length; stat.lastOkAt = new Date().toISOString();
      } catch (e) {
        stat.lastError = String(e.message || e).slice(0, 300); stat.lastErrorAt = new Date().toISOString();
        for (const q of part) {
          q.tries = (q.tries || 0) + 1;
          q.next = now + Math.min(60, Math.pow(2, q.tries)) * 60e3;      // 2, 4, 8 … 60 daqiqa
          await store.set('capiq/' + q.id, q);
        }
        console.error('capi yuborilmadi:', stat.lastError);
      }
    }
  } finally { flushing = false; }
  return { sent };
}

async function status() {
  const queued = ctx ? (await ctx.store.list('capiq/')).length : 0;
  return Object.assign({ configured: configured(), dataset: process.env.META_DATASET_ID ? '…' + String(process.env.META_DATASET_ID).slice(-4) : '', test: !!process.env.META_CAPI_TEST_CODE, queued }, stat);
}

function start(c) {
  ctx = c;
  if (timer) clearInterval(timer);
  timer = setInterval(() => flush().catch(() => { }), 60e3);
  if (timer.unref) timer.unref();
}

module.exports = {
  start, onLeadSaved, flush, status, configured, eventName,
  _test: { setPost: f => { postImpl = f; }, buildEvent, payloadJson, normPhone, metaIdsOf, stat }
};
