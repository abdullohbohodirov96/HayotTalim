/* Target reklama (Meta Lead Ads) arizalari → ERP «Murojaatlar»ga avtomatik.

   Ishlash tartibi:
     1) Meta ilovasida Webhooks → Page → «leadgen» ga obuna; Callback URL:
          https://saboacademy.uz/api/meta-leads
        Verify token: META_VERIFY_TOKEN (Render'dagi qiymat bilan bir xil).
     2) Odam formani to'ldiradi → Meta shu manzilga leadgen_id yuboradi.
     3) Server Graph API dan ariza maydonlarini oladi (META_PAGE_TOKEN) va
        murojaat yaratadi: ism, telefon, savollarga javoblar, qaysi reklama.
   Render muhit o'zgaruvchilari:
     META_VERIFY_TOKEN  — o'zingiz o'ylab topgan maxfiy so'z (webhook tasdiqlash)
     META_APP_SECRET    — Meta ilovasining App Secret (imzo tekshiruvi)
     META_PAGE_TOKEN    — sahifaning doimiy Page access token (leads_retrieval)
     META_FUNNEL_ID     — (ixtiyoriy) murojaatlar tushadigan voronka            */
'use strict';
const crypto = require('crypto');

const GRAPH = 'https://graph.facebook.com/v21.0/';

function rawBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > (max || 1e6)) { req.destroy(); reject(new Error('katta')); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sigOk(req, buf) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;                       // sozlanmagan bo'lsa — tekshirmaymiz (token baribir kerak)
  const got = String(req.headers['x-hub-signature-256'] || '');
  const want = 'sha256=' + crypto.createHmac('sha256', secret).update(buf).digest('hex');
  try { return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want)); } catch (e) { return false; }
}

/** Meta maydonlari → ERP murojaati maydonlari.
    Forma qanday tuzilganidan qat'i nazar: savol nomi (yoki matni) bo'yicha
    mos joyga tushadi; tanilmagan savollar ham yo'qolmaydi — izohga yoziladi. */
const MAP = [
  ['name', /^(full_?name|name|ism|ismingiz|f\.?i\.?o|ism_?familiya)/i],
  ['first', /first_?name|^ism$/i],
  ['last', /last_?name|familiya/i],
  ['phone', /phone|telefon|raqam|nomer|tel$/i],
  ['email', /e-?mail|pochta/i],
  ['region', /region|viloyat|shahar|city|manzil|hudud|province|state/i],
  ['wantTime', /vaqt|qachon|soat|time|qulay/i],
  ['startLevel', /daraja|level|bilasiz|bilim/i],
  ['audience', /kim_?uchun|kim uchun|guruh|who|kimga|jins|gender/i],
  ['age', /yosh|age|tug/i]
];
function keyOf(k) { for (const [f, re] of MAP) if (re.test(k)) return f; return ''; }
function nice(v) { return String(v || '').replace(/_/g, ' ').trim(); }
function parseFields(fd) {
  const r = { name: '', phone: '', answers: [], fields: {} };
  let first = '', last = '';
  (fd || []).forEach(f => {
    const k = String(f.name || ''), v = nice((f.values || []).join(', '));
    if (!v) return;
    const which = keyOf(k);
    if (which === 'name') r.name = v;
    else if (which === 'first') first = v;
    else if (which === 'last') last = v;
    else if (which === 'phone') r.phone = v;
    else {
      if (which && !r.fields[which]) r.fields[which] = v;
      r.answers.push(nice(k).replace(/\?$/, '') + ': ' + v);
    }
  });
  if (!r.name) r.name = (first + ' ' + last).trim();
  return r;
}

async function fetchLead(id) {
  const tok = process.env.META_PAGE_TOKEN;
  if (!tok) throw new Error('META_PAGE_TOKEN yo‘q');
  const r = await fetch(GRAPH + encodeURIComponent(id) + '?fields=created_time,field_data,ad_name,adset_name,campaign_name,form_id,form_name,platform&access_token=' + encodeURIComponent(tok));
  const j = await r.json();
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return j;
}

/**
 * ctx: { store, A, stamp, notify(text) }
 * Qaytaradi: true — so'rov shu modulga tegishli edi (javob berildi)
 */
async function handle(req, res, url, ctx, send) {
  /* 1) Meta webhook'ni tasdiqlash (GET) */
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode'), tok = url.searchParams.get('hub.verify_token');
    if (mode === 'subscribe' && process.env.META_VERIFY_TOKEN && tok === process.env.META_VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(String(url.searchParams.get('hub.challenge') || ''));
    }
    return send(res, 403, { error: 'Tasdiqlanmadi.' });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Faqat POST.' });
  const buf = await rawBody(req);
  if (!sigOk(req, buf)) return send(res, 403, { error: 'Imzo noto‘g‘ri.' });
  let body = {}; try { body = JSON.parse(buf.toString('utf8') || '{}'); } catch (e) { return send(res, 400, { error: 'JSON' }); }
  /* Meta tez javob kutadi — avval 200, keyin ishlaymiz */
  send(res, 200, { ok: true });
  const ids = [];
  (body.entry || []).forEach(en => (en.changes || []).forEach(ch => {
    if (ch.field === 'leadgen' && ch.value && ch.value.leadgen_id) ids.push(String(ch.value.leadgen_id));
  }));
  for (const id of ids) {
    try { await saveLead(ctx, id); } catch (e) { console.error('meta lead ' + id + ':', e.message); }
  }
  return true;
}

async function saveLead(ctx, leadgenId) {
  const { store, A, stamp } = ctx;
  const key = 'metalead/' + leadgenId;
  if (await store.get(key)) return;                       // takror kelgan webhook
  const L = await fetchLead(leadgenId);
  const p = parseFields(L.field_data);
  const phone = A.normPhone(p.phone) || p.phone;
  const funnels = (await store.list('funnels/')).map(x => x.data).filter(Boolean);
  const funnel = funnels.filter(f => f.id === process.env.META_FUNNEL_ID)[0] || funnels[0] || null;
  const stages = funnel ? A.funnelStages(funnel) : [];
  /* Shu raqam bilan murojaat bo'lsa — yangisini ochmaymiz, izoh qo'shamiz */
  const digits = A.phoneDigits(phone);
  const leads = (await store.list('leads/')).map(x => x.data).filter(Boolean);
  const dup = digits ? leads.filter(l => A.phoneDigits(l.phone) === digits)[0] : null;
  const ad = [L.campaign_name, L.adset_name, L.ad_name].filter(Boolean).join(' › ');
  const note = p.answers.join(' · ');
  let id;
  if (dup) {
    id = dup.id;
    dup.note = [dup.note, 'Target formasi qayta: ' + note].filter(Boolean).join(' · ').slice(0, 1500);
    await store.set('leads/' + id, dup);
  } else {
    id = 'led_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    await store.set('leads/' + id, {
      id, funnelId: funnel ? funnel.id : '', name: p.name || 'Noma’lum', phone,
      courseId: '', source: 'Target (' + (L.platform === 'ig' ? 'Instagram' : L.platform === 'fb' ? 'Facebook' : 'Meta') + ')',
      src: ad, ownerStaffId: '', stage: stages[0] ? stages[0].id : 'yangi',
      region: p.fields.region || '', wantTime: p.fields.wantTime || '', startLevel: p.fields.startLevel || '',
      audience: p.fields.audience || '', email: p.fields.email || '', age: p.fields.age || '',
      note: note.slice(0, 1000), nextContact: A.today(), createdAt: stamp(), viaMeta: true, metaLeadId: leadgenId
    });
  }
  await store.set(key, { leadId: id, at: stamp() });
  const text = 'Yangi murojaat (target)\nIsm: ' + (p.name || '—') + '\nTelefon: ' + (phone || '—') +
    (note ? '\n' + p.answers.join('\n') : '') + (ad ? '\nReklama: ' + ad : '') + (dup ? '\n(bu raqam avval ham yozilgan)' : '');
  if (ctx.notify) ctx.notify(text);
}

/* ---------- Zaxira yo'l: arizalarni o'zimiz tortib olamiz (polling) ----------
   Ilova «Live» bo'lmaguncha Meta webhook'ni yubormaydi. Lekin sahifa admini
   tokeni bilan formalardagi arizalarni API orqali o'qish mumkin. Shuning uchun
   har POLL daqiqada yangi arizalarni tekshiramiz. Bazaga faqat yangi ariza
   bo'lsa tegamiz — bo'sh paytda baza uxlayveradi.                          */
const POLL_MS = Number(process.env.META_POLL_MIN || 3) * 60 * 1000;
let pollTimer = null, pageId = '', forms = [], formsAt = 0, since = 0;
const seen = new Set();
async function graph(pathQ) {
  const tok = process.env.META_PAGE_TOKEN;
  const r = await fetch(GRAPH + pathQ + (pathQ.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + encodeURIComponent(tok));
  const j = await r.json();
  if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return j;
}
async function pollOnce(ctx) {
  if (!process.env.META_PAGE_TOKEN) return { off: true };
  if (!pageId) pageId = (await graph('me?fields=id')).id;
  if (!forms.length || Date.now() - formsAt > 60 * 60 * 1000) {
    forms = ((await graph(pageId + '/leadgen_forms?fields=id,name,status&limit=100')).data || []).map(f => f.id);
    formsAt = Date.now();
  }
  const from = Math.floor((since || Date.now() - 3 * 24 * 3600 * 1000) / 1000) - 120;
  const startedAt = Date.now();
  let added = 0;
  for (const fid of forms) {
    const filt = encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: from }]));
    const j = await graph(fid + '/leads?fields=id&limit=100&filtering=' + filt);
    for (const L of (j.data || [])) {
      if (seen.has(L.id)) continue;
      try { await saveLead(ctx, L.id); seen.add(L.id); added++; } catch (e) { console.error('meta poll ' + L.id + ':', e.message); }
    }
  }
  since = startedAt;
  return { forms: forms.length, added };
}
function startPoll(ctx) {
  if (pollTimer || !process.env.META_PAGE_TOKEN || process.env.META_POLL === '0') return;
  const tick = () => pollOnce(ctx).then(r => { if (r && r.added) console.log('  Target arizalari: ' + r.added + ' ta yangi'); })
    .catch(e => console.error('meta poll:', e.message));
  setTimeout(tick, 15 * 1000);
  pollTimer = setInterval(tick, POLL_MS);
  if (pollTimer.unref) pollTimer.unref();
  console.log('  Target arizalari: har ' + Math.round(POLL_MS / 60000) + ' daqiqada tekshiriladi');
}

module.exports = { handle, parseFields, saveLead, pollOnce, startPoll };
