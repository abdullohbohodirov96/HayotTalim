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

/** Meta maydonlari → { name, phone, answers[] } */
function parseFields(fd) {
  let name = '', phone = '', first = '', last = '';
  const answers = [];
  (fd || []).forEach(f => {
    const k = String(f.name || ''), v = (f.values || []).join(', ');
    if (/^full_name$|^name$/i.test(k)) name = v;
    else if (/first_name/i.test(k)) first = v;
    else if (/last_name/i.test(k)) last = v;
    else if (/phone/i.test(k)) phone = v;
    else if (/email/i.test(k)) { if (v) answers.push('Email: ' + v); }
    else answers.push(k.replace(/_/g, ' ').replace(/\?$/, '') + ': ' + v.replace(/_/g, ' '));
  });
  if (!name) name = (first + ' ' + last).trim();
  return { name, phone, answers };
}

async function fetchLead(id) {
  const tok = process.env.META_PAGE_TOKEN;
  if (!tok) throw new Error('META_PAGE_TOKEN yo‘q');
  const r = await fetch(GRAPH + encodeURIComponent(id) + '?fields=created_time,field_data,ad_name,adset_name,campaign_name,form_id,platform&access_token=' + encodeURIComponent(tok));
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
      note: note.slice(0, 1000), nextContact: A.today(), createdAt: stamp(), viaMeta: true, metaLeadId: leadgenId
    });
  }
  await store.set(key, { leadId: id, at: stamp() });
  const text = 'Yangi murojaat (target)\nIsm: ' + (p.name || '—') + '\nTelefon: ' + (phone || '—') +
    (note ? '\n' + p.answers.join('\n') : '') + (ad ? '\nReklama: ' + ad : '') + (dup ? '\n(bu raqam avval ham yozilgan)' : '');
  if (ctx.notify) ctx.notify(text);
}

module.exports = { handle, parseFields, saveLead };
