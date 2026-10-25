/* Dars videolari (MP4) — BO'LAKLAB saqlash.

   Muammo (eski usul): video diskka yozilardi, bazaga esa faqat 12 MB gacha
   fayl tushardi. Render'ning bepul tarifida disk har qayta ishga tushganda
   tozalanadi — kattaroq video yo'qolib, o'quvchida «Video yo'q» (404) chiqardi,
   ro'yxatda esa «✓ yuklangan» deb turaverardi.

   Yangi usul: brauzer videoni 2 MB lik bo'laklarga bo'lib ketma-ket yuboradi,
   har bo'lak bazada alohida yozuv (`vchunk/<dars>/<yuklash>/<n>`). Ko'rsatishda
   faqat so'ralgan qism bo'laklari o'qiladi (Range) — server xotirasiga butun
   video yuklanmaydi. Disk faqat tezlik uchun kesh.                          */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHUNK = 2 * 1024 * 1024;                       // bitta bo'lak (bayt)
const MAX = Number(process.env.VIDEO_MAX_MB || 60) * 1024 * 1024;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CACHE = path.join(DATA_DIR, 'vcache');

const key = (lid, up, n) => 'vchunk/' + lid + '/' + up + '/' + n;
const okId = s => /^[a-z0-9-]{2,20}$/.test(String(s || ''));
const okUp = s => /^u[a-f0-9]{12}$/.test(String(s || ''));

async function dropUpload(store, lid, up, n) {
  if (!store.del || !okUp(up)) return;
  for (let i = 0; i < n; i++) { try { await store.del(key(lid, up, i)); } catch (e) { } }
  try { fs.unlinkSync(path.join(CACHE, lid + '-' + up + '.mp4')); } catch (e) { }
}

/** Yuklash bosqichlari. body.part: 'begin' | 'chunk' | 'end' | 'cancel'
    Qaytaradi: { status, json } */
async function upload(store, lesson, body, user, stamp) {
  const lid = lesson.id;
  const part = String(body.part || '');
  if (part === 'begin') {
    const size = Number(body.size) || 0;
    if (!size) return { status: 400, json: { error: 'Video bo’sh.' } };
    if (size > MAX) return { status: 400, json: { error: 'Video juda katta (' + Math.round(MAX / 1048576) + ' MB gacha). Siqib qayta yuklang.' } };
    if (String(body.type || '') !== 'video/mp4') return { status: 400, json: { error: 'Faqat MP4 video yuklang.' } };
    const up = 'u' + crypto.randomBytes(6).toString('hex');
    const total = Math.ceil(size / CHUNK);
    await store.set('vupload/' + lid, { up, size, total, name: String(body.name || lid + '.mp4').slice(0, 120), at: stamp(), by: user && user.name });
    return { status: 200, json: { ok: true, uploadId: up, chunk: CHUNK, total } };
  }
  const pend = await store.get('vupload/' + lid);
  if (!pend || pend.up !== body.uploadId) return { status: 409, json: { error: 'Yuklash eskirgan — qaytadan boshlang.' } };
  if (part === 'chunk') {
    const i = Number(body.idx);
    if (!(i >= 0 && i < pend.total)) return { status: 400, json: { error: 'Bo’lak raqami noto’g’ri.' } };
    const buf = Buffer.from(String(body.data || ''), 'base64');
    const want = i === pend.total - 1 ? pend.size - CHUNK * i : CHUNK;
    if (buf.length !== want) return { status: 400, json: { error: 'Bo’lak to’liq kelmadi (' + buf.length + '/' + want + ').' } };
    await store.set(key(lid, pend.up, i), { b64: buf.toString('base64') });
    return { status: 200, json: { ok: true, idx: i } };
  }
  if (part === 'cancel') {
    await dropUpload(store, lid, pend.up, pend.total);
    if (store.del) await store.del('vupload/' + lid);
    return { status: 200, json: { ok: true } };
  }
  if (part === 'end') {
    for (let i = 0; i < pend.total; i++) {
      if (!(await store.get(key(lid, pend.up, i)))) return { status: 400, json: { error: (i + 1) + '-bo’lak yetib kelmagan — qayta yuklang.' } };
    }
    const old = await store.get('lessonvideo/' + lid);
    await store.set('lessonvideo/' + lid, { lessonId: lid, up: pend.up, chunks: pend.total, chunk: CHUNK, size: pend.size, type: 'video/mp4', name: pend.name, at: stamp(), by: user && user.name });
    if (store.del) await store.del('vupload/' + lid);
    if (old && old.up && old.up !== pend.up) await dropUpload(store, lid, old.up, old.chunks);
    return { status: 200, json: { ok: true, old } };
  }
  return { status: 400, json: { error: 'Noma’lum so’rov.' } };
}

async function remove(store, lid) {
  const old = await store.get('lessonvideo/' + lid);
  if (old && old.up) await dropUpload(store, lid, old.up, old.chunks);
  if (store.del) await store.del('lessonvideo/' + lid);
  return old;
}

/** Bo'lakli videoni o'qish: [a, b] oralig'i (ikkalasi ham ichida) */
async function readRange(store, doc, a, b) {
  const cf = path.join(CACHE, doc.lessonId + '-' + doc.up + '.mp4');
  try {
    if (fs.existsSync(cf) && fs.statSync(cf).size === doc.size) {
      const fd = fs.openSync(cf, 'r'); const out = Buffer.alloc(b - a + 1);
      fs.readSync(fd, out, 0, out.length, a); fs.closeSync(fd); return out;
    }
  } catch (e) { }
  const parts = [];
  for (let i = Math.floor(a / doc.chunk); i <= Math.floor(b / doc.chunk); i++) {
    const c = await store.get(key(doc.lessonId, doc.up, i));
    if (!c || !c.b64) return null;
    parts.push(Buffer.from(c.b64, 'base64'));
  }
  const all = Buffer.concat(parts);
  const off = a - Math.floor(a / doc.chunk) * doc.chunk;
  return all.subarray(off, off + (b - a + 1));
}

/* Butun videoni diskka keshlash (orqa fonda, bir marta) */
const warming = {};
async function warm(store, doc) {
  const cf = path.join(CACHE, doc.lessonId + '-' + doc.up + '.mp4');
  if (warming[cf]) return;
  try { if (fs.existsSync(cf) && fs.statSync(cf).size === doc.size) return; } catch (e) { }
  warming[cf] = true;
  try {
    fs.mkdirSync(CACHE, { recursive: true });
    const tmp = cf + '.tmp'; const fd = fs.openSync(tmp, 'w');
    for (let i = 0; i < doc.chunks; i++) {
      const c = await store.get(key(doc.lessonId, doc.up, i));
      if (!c || !c.b64) { fs.closeSync(fd); fs.unlinkSync(tmp); return; }
      fs.writeSync(fd, Buffer.from(c.b64, 'base64'));
    }
    fs.closeSync(fd); fs.renameSync(tmp, cf);
  } catch (e) { } finally { delete warming[cf]; }
}

/** GET /api/lesson-video — Range bilan. Bitta javob ko'pi bilan 2 bo'lak. */
async function serve(store, files, req, res, lid, info, send) {
  const doc = okId(lid) ? await store.get('lessonvideo/' + lid) : null;
  /* Eski usulda yuklangan (bitta fayl) video haqiqatan o'qiladimi */
  let legacy = null;
  if (doc && doc.fileId && !doc.up) {
    const rec = await files.meta(store, doc.fileId);
    const buf = rec ? await files.readBody(store, rec) : null;
    legacy = buf ? { rec, buf } : null;
  }
  const has = !!(doc && (doc.up || legacy));
  if (info) return send(res, 200, { has, broken: !!(doc && !has), name: doc ? doc.name : '', at: doc ? doc.at : null, size: doc ? (doc.size || (legacy && legacy.buf.length) || 0) : 0 });
  if (!has) return send(res, 404, { error: 'Video yo’q.' });
  const size = doc.up ? doc.size : legacy.buf.length;
  const type = doc.up ? doc.type : legacy.rec.type;
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  let a = 0, b = size - 1, partial = false;
  if (range) {
    partial = true;
    a = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
    b = range[1] !== '' && range[2] !== '' ? Number(range[2]) : size - 1;
    a = Math.max(0, a); b = Math.min(size - 1, b);
    if (a > b) { res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
  }
  if (doc.up) {
    warm(store, doc);
    if (!partial) {
      /* Range'siz so'rov (masalan, yuklab olish): bo'laklarni ketma-ket oqim qilib beramiz */
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
      for (let i = 0; i < doc.chunks; i++) {
        const c = await store.get(key(doc.lessonId, doc.up, i));
        if (!c || !c.b64) return res.destroy();
        if (!res.write(Buffer.from(c.b64, 'base64'))) await new Promise(r => res.once('drain', r));
      }
      return res.end();
    }
    b = Math.min(b, a + 2 * CHUNK - 1);              // bitta javob ≤ 4 MB — brauzer qolganini o'zi so'raydi
    const out = await readRange(store, doc, a, b);
    if (!out) return send(res, 404, { error: 'Video bo’laklari topilmadi — qayta yuklang.' });
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': out.length, 'Content-Range': 'bytes ' + a + '-' + b + '/' + size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
    return res.end(out);
  }
  const buf = legacy.buf;
  if (partial) {
    res.writeHead(206, { 'Content-Type': type, 'Content-Length': b - a + 1, 'Content-Range': 'bytes ' + a + '-' + b + '/' + size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
    return res.end(buf.subarray(a, b + 1));
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
  return res.end(buf);
}

module.exports = { upload, remove, serve, CHUNK, MAX };
