/* Daraja testining brauzer nusxasi — FAQAT serversiz namoyish uchun
   (Vercel/artefakt). Haqiqiy serverda to'g'ri javoblar brauzerga
   chiqmaydi; bu fayl serverli versiyaga qo'shilmaydi.
   Ishlatish: node scripts/build-levels-local.js <chiqish.js>          */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'vercel-dist/js/levels-local.js');
const data = fs.readFileSync(path.join(root, 'server/levels-data.js'), 'utf8');
const lv = fs.readFileSync(path.join(root, 'server/levels.js'), 'utf8');
const js = `/* avtomatik yaratilgan: scripts/build-levels-local.js */
(function (global) {
  'use strict';
  function hex(n) { var s = ''; for (var i = 0; i < n; i++) s += ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2); return s; }
  function hash(str) { var h1 = 0x811c9dc5, h2 = 0; str = String(str); for (var i = 0; i < str.length; i++) { h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619) >>> 0; h2 = (h2 * 31 + str.charCodeAt(i)) >>> 0; } return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8) + '0000000000000000000000000000000000000000000000'; }
  var cryptoShim = {
    randomBytes: function (n) { return { toString: function () { return hex(n); } }; },
    createHash: function () { var buf = ''; return { update: function (s) { buf += s; return this; }, digest: function () { return hash(buf); } }; }
  };
  var mods = {};
  function req(name) { if (name === 'crypto') return cryptoShim; if (name === './levels-data') return mods.data; throw new Error('modul yo‘q: ' + name); }
  var process = { env: {} };
  (function (module, exports, require) {
${data}
  })(mods.dm = { exports: {} }, mods.dm.exports, req); mods.data = mods.dm.exports;
  (function (module, exports, require) {
${lv}
  })(mods.lm = { exports: {} }, mods.lm.exports, req);
  var levels = mods.lm.exports;
  /* Xotiradagi ombor */
  var db = {};
  var store = {
    get: async function (p) { return db[p] ? JSON.parse(JSON.stringify(db[p])) : null; },
    set: async function (p, v) { db[p] = JSON.parse(JSON.stringify(v)); },
    del: async function (p) { delete db[p]; },
    list: async function (pre) { return Object.keys(db).filter(function (k) { return k.indexOf(pre) === 0; }).map(function (k) { return { path: k, data: JSON.parse(JSON.stringify(db[k])) }; }); }
  };
  var ready = null;
  function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
  async function api(method, route, body) {
    if (!ready) ready = levels.ensureBank(store, { stamp: stamp });
    await ready;
    body = body || {};
    if (/test\\/start$/.test(route)) {
      var lg = levels.lang(body.lang);
      var t = await levels.start(store, { stamp: stamp, ip: '', lang: lg });
      if (!t) throw new Error('Savollar hali tayyor emas.');
      return { id: t.id, total: t.total, questions: t.questions, limitSec: t.limitSec, lang: t.lang, rtl: t.rtl, levels: levels.levelList(lg) };
    }
    if (/test\\/submit$/.test(route)) {
      var r = await levels.submit(store, { stamp: stamp, sessionId: body.sessionId, answers: body.answers, name: body.name, phone: body.phone });
      if (!r.ok) throw new Error(r.reason === 'ishlatilgan' ? 'Bu test allaqachon topshirilgan.' : r.reason === 'muddati' ? 'Test muddati tugadi, qaytadan boshlang.' : 'Test topilmadi.');
      return { level: r.level, info: levels.levelInfo(r.level, r.lang), lang: r.lang, score: r.score, total: r.total, perLevel: r.perLevel, resultId: r.resultId, levels: levels.levelList(r.lang) };
    }
    throw new Error('Noma’lum so‘rov');
  }
  (global.A = global.A || {}).LevelsLocal = { api: api, levelList: function (lg) { return levels.levelList(lg || 'uz'); } };
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, js);
console.log('levels-local:', out, Math.round(js.length / 1024) + ' KB');
