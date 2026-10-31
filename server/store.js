/* Albyana server — hujjatlar ombori.
   DATABASE_URL berilgan bo'lsa PostgreSQL, aks holda SQLite fayli ishlatiladi.
   Ma'lumotlar ilovadagi bilan bir xil ko'rinishda saqlanadi: yo'l + JSON. */
'use strict';
const path = require('path');
const fs = require('fs');

/* Dars videosi bo'laklari (har biri 2 MB) — all() ga kirmaydi: bootstrap, zaxira va
   botlar butun bazani o'qiganda videolar xotiraga yuklanmasin. */
const BLOB = 'vchunk/';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

/* Zaxira ombor: oddiy JSON fayl. Hech qanday qo'shimcha kutubxona talab qilmaydi.
   Kichik markaz uchun yetarli; yozish atomik (avval .tmp, keyin rename). */
function makeJsonFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, 'albyana.json');
  let docs = {};
  try { docs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { docs = {}; }
  let writing = null, dirty = false;
  function flush() {
    if (writing) { dirty = true; return writing; }
    writing = new Promise(resolve => {
      const tmp = file + '.tmp';
      fs.writeFile(tmp, JSON.stringify(docs), err => {
        if (!err) { try { fs.renameSync(tmp, file); } catch (e) { } }
        writing = null;
        if (dirty) { dirty = false; flush(); }
        resolve();
      });
    });
    return writing;
  }
  return {
    kind: 'json',
    file,
    async get(p) { return docs[p] ? JSON.parse(JSON.stringify(docs[p])) : null; },
    async set(p, data) { docs[p] = data; await flush(); },
    async del(p) { delete docs[p]; await flush(); },
    async list(prefix) {
      return Object.keys(docs).filter(k => k.indexOf(prefix) === 0)
        .map(k => ({ path: k, data: docs[k] }));
    },
    async all() { return Object.keys(docs).filter(k => k.indexOf(BLOB) !== 0).map(k => ({ path: k, data: docs[k] })); },
    async close() { await flush(); }
  };
}

/* Xotira nusxasiga kirmaydigan to'plamlar (bazadagi sonni solishtirish uchun) */
const MIRROR_SKIP_SQL = ['vchunk', 'vupload', 'filebody', 'qissaaudio', 'photos', 'formbg'].map(c => "path NOT LIKE '" + c + "/%'").join(' AND ');

function makeSqlite() {
  let Database;
  try { Database = require('better-sqlite3'); }
  catch (e) {
    return null;   // o'rnatilmagan — JSON omboriga o'tamiz
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, 'albyana.db');
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');
  return {
    kind: 'sqlite',
    file,
    async get(p) {
      const row = db.prepare('SELECT data FROM docs WHERE path = ?').get(p);
      return row ? JSON.parse(row.data) : null;
    },
    async set(p, data) {
      db.prepare('INSERT INTO docs (path, data, updated_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(path) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
        .run(p, JSON.stringify(data), new Date().toISOString());
    },
    async del(p) {
      db.prepare('DELETE FROM docs WHERE path = ?').run(p);
    },
    /** prefix "students/" ko'rinishida */
    async list(prefix) {
      const rows = db.prepare('SELECT path, data FROM docs WHERE path LIKE ?').all(prefix + '%');
      return rows.map(r => ({ path: r.path, data: JSON.parse(r.data) }));
    },
    async all() {
      const rows = db.prepare("SELECT path, data FROM docs WHERE path NOT LIKE 'vchunk/%'").all();
      return rows.map(r => ({ path: r.path, data: JSON.parse(r.data) }));
    },
    /** Xotira nusxasi uchun: kichik hujjatlar matni, kattalari — faqat yo'li */
    async mirrorRows(max) {
      return db.prepare("SELECT path, CASE WHEN length(data) <= ? THEN data END AS json FROM docs WHERE path NOT LIKE 'vchunk/%'").all(max)
        .map(r => ({ path: r.path, json: r.json == null ? null : String(r.json) }));
    },
    /* Boshqa jarayon yozgan o'zgarishlarni topish uchun: oxirgi o'zgarish belgisi va undan keyingilar */
    async mirrorCursor() { const r = db.prepare('SELECT max(updated_at) AS m FROM docs').get(); return (r && r.m) || ''; },
    async mirrorDelta(cur, max) {
      const rows = db.prepare("SELECT path, CASE WHEN length(data) <= ? THEN data END AS json, updated_at AS u FROM docs WHERE updated_at >= ? AND path NOT LIKE 'vchunk/%'").all(max, cur || '');
      let c = cur || ''; rows.forEach(r => { if (r.u > c) c = r.u; });
      const total = db.prepare("SELECT count(*) AS n FROM docs WHERE " + MIRROR_SKIP_SQL).get().n;
      return { rows: rows.map(r => ({ path: r.path, json: r.json == null ? null : String(r.json) })), cursor: c, total };
    },
    async close() { db.close(); }
  };
}

/* PostgreSQL (Neon, Supabase, Render Postgres yoki o'z serveringiz).
   Neon uchun muhim: ulanish bo'sh turganda yopiladi — shunda Neon "compute"ni
   uxlatadi va bepul tarifdagi soatlar behuda sarflanmaydi.                   */
/**
 * Ulanish manzilini tahlil qilish: SSL kerakmi va qaysi serverga ulanyapmiz.
 * — Render'ning ICHKI manzili (dpg-xxxx-a kabi, nuqtasiz) va localhost: SSL kerak emas
 * — Neon, Supabase, Render'ning TASHQI manzili: SSL shart
 * — PGSSLMODE=disable / require bilan majburan belgilash mumkin
 */
function pgConf(url) {
  let host = '', db = '';
  try {
    const u = new URL(url);
    host = u.hostname;
    db = (u.pathname || '').replace(/^\//, '');
  } catch (e) { /* manzil g'alati bo'lsa quyidagi qoidalar ishlaydi */ }

  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  const local = /^(localhost|127\.0\.0\.1|::1)$/.test(host) || /localhost|127\.0\.0\.1/.test(url);
  const internal = host && host.indexOf('.') < 0 && !local;   // Render ichki tarmog'i
  const asked = /sslmode=require|sslmode=verify/.test(url);

  let ssl;
  if (mode === 'disable') ssl = false;
  else if (mode === 'require') ssl = true;
  else if (asked) ssl = true;
  else ssl = !(local || internal);

  return { host, db, ssl, local, internal };
}

/**
 * TLS sozlamasi: sertifikat STANDART holatda TEKSHIRILADI (Neon, Render tashqi
 * manzili ochiq ishonchli sertifikat ishlatadi). O'z CA si bo'lsa —
 * PG_CA_CERT (PEM matni) yoki PGSSLROOTCERT (fayl yo'li). Faqat zarur bo'lsa,
 * PG_SSL_NO_VERIFY=1 bilan tekshiruv o'chiriladi (ogohlantirish chiqadi).
 */
function pgSslOptions(conf) {
  if (!conf || !conf.ssl) return false;
  const off = /^(1|true|ha|yes)$/i.test(String(process.env.PG_SSL_NO_VERIFY || ''));
  if (off) {
    console.warn('  OGOHLANTIRISH: PG_SSL_NO_VERIFY — baza sertifikati tekshirilmayapti.');
    return { rejectUnauthorized: false };
  }
  const o = { rejectUnauthorized: true };
  if (process.env.PG_CA_CERT) o.ca = String(process.env.PG_CA_CERT).replace(/\\n/g, '\n');
  else if (process.env.PGSSLROOTCERT) {
    try { o.ca = require('fs').readFileSync(process.env.PGSSLROOTCERT, 'utf8'); }
    catch (e) { console.warn('  PGSSLROOTCERT o’qilmadi: ' + e.message); }
  }
  return o;
}
/** Manzildagi ssl* parametrlari olib tashlanadi — aks holda pg ular bilan
    yuqoridagi sozlamani almashtirib yuboradi. */
function stripSslParams(url) {
  try {
    const u = new URL(url);
    ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'].forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch (e) { return url; }
}

function makePostgres(url) {
  let Pool;
  try { Pool = require('pg').Pool; }
  catch (e) { throw new Error('pg o’rnatilmagan. "npm install" ni ishga tushiring.'); }

  const conf = pgConf(url);
  const pool = new Pool({
    connectionString: stripSslParams(url),
    ssl: pgSslOptions(conf),
    max: Number(process.env.PG_POOL_MAX || 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_MS || 15000),   // bo'sh ulanish yopilsin
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_MS || 15000),
    allowExitOnIdle: true
  });
  pool.on('error', e => console.error('  Baza ulanishi uzildi: ' + e.message));
  console.log('  Baza: ' + (conf.host || '?') + (conf.db ? '/' + conf.db : '') +
    ' · SSL: ' + (conf.ssl ? 'ha' : 'yo’q') +
    (conf.internal ? ' · ichki tarmoq' : (conf.local ? ' · shu kompyuter' : '')));

  let ready = init();
  async function init() {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, data JSONB NOT NULL, ' +
      'updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    // "students/" kabi boshlanishi bo'yicha qidirish tez bo'lsin
    await pool.query(
      'CREATE INDEX IF NOT EXISTS docs_path_prefix ON docs (path text_pattern_ops)');
  }

  /** Neon uyqudan uyg'onayotganda ulanish uzilishi mumkin — bir marta qayta urinamiz */
  async function q(text, params) {
    await ready;
    try {
      return await pool.query(text, params);
    } catch (e) {
      const msg = String(e.message || '');
      const retryable = /terminat|ECONNRESET|Connection terminated|timeout|ENOTFOUND|EAI_AGAIN|not ready/i.test(msg);
      if (!retryable) throw e;
      await new Promise(r => setTimeout(r, 1200));
      return await pool.query(text, params);
    }
  }

  return {
    kind: 'postgres',
    async get(p) {
      const r = await q('SELECT data FROM docs WHERE path = $1', [p]);
      return r.rows[0] ? r.rows[0].data : null;
    },
    async set(p, data) {
      await q(
        'INSERT INTO docs (path, data, updated_at) VALUES ($1, $2, now()) ' +
        'ON CONFLICT (path) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
        [p, JSON.stringify(data)]);
    },
    async del(p) {
      await q('DELETE FROM docs WHERE path = $1', [p]);
    },
    async list(prefix) {
      const r = await q('SELECT path, data FROM docs WHERE path LIKE $1', [prefix + '%']);
      return r.rows.map(x => ({ path: x.path, data: x.data }));
    },
    async all() {
      const r = await q("SELECT path, data FROM docs WHERE path NOT LIKE 'vchunk/%'");
      return r.rows.map(x => ({ path: x.path, data: x.data }));
    },
    /** Xotira nusxasi uchun: kichik hujjatlar matni, kattalari — faqat yo'li */
    async mirrorRows(max) {
      const r = await q("SELECT path, CASE WHEN octet_length(data::text) <= $1 THEN data::text END AS json FROM docs WHERE path NOT LIKE 'vchunk/%' AND path NOT LIKE 'filebody/%'", [max]);
      const out = r.rows.map(x => ({ path: x.path, json: x.json }));
      const b = await q("SELECT path FROM docs WHERE path LIKE 'filebody/%'");
      b.rows.forEach(x => out.push({ path: x.path, json: null }));
      return out;
    },
    async mirrorCursor() { const r = await q("SELECT coalesce((extract(epoch from max(updated_at)) * 1000000)::bigint, 0)::text AS m FROM docs"); return r.rows[0].m; },
    async mirrorDelta(cur, max) {
      const r = await q("SELECT path, CASE WHEN octet_length(data::text) <= $2 THEN data::text END AS json, (extract(epoch from updated_at) * 1000000)::bigint::text AS u FROM docs " +
        "WHERE updated_at >= to_timestamp($1::bigint / 1000000.0) AND path NOT LIKE 'vchunk/%' AND path NOT LIKE 'filebody/%'", [cur || '0', max]);
      let c = cur || '0'; r.rows.forEach(x => { if (BigInt(x.u) > BigInt(c)) c = x.u; });
      const t = await q("SELECT count(*)::int AS n FROM docs WHERE " + MIRROR_SKIP_SQL);
      return { rows: r.rows.map(x => ({ path: x.path, json: x.json })), cursor: c, total: t.rows[0].n };
    },
    /** Bazaning hajmi va yozuvlar soni — sozlamalarda ko'rsatiladi */
    async stats() {
      const r = await q(
        "SELECT count(*)::int AS rows, " +
        "pg_size_pretty(pg_total_relation_size('docs')) AS size, " +
        "pg_total_relation_size('docs')::bigint AS bytes FROM docs");
      return r.rows[0] || null;
    },
    async close() { await pool.end(); }
  };
}

/* ---------------- Xotiradagi nusxa (tezlik uchun) ----------------
   Har sahifa ochilishida server bazaga o'nlab «ro'yxat» so'rovi yuborardi
   (guruhlar, a'zoliklar, davomat…). Neon uzoqda — har so'rov 20–100 ms, jami
   bir necha soniya. Endi kichik hujjatlarning nusxasi server xotirasida turadi:
   o'qish — xotiradan, yozish — avval bazaga, keyin xotiraga.
   Server bitta nusxada ishlaydi (Render), barcha yozuvlar shu jarayondan
   o'tadi — shuning uchun nusxa doim aniq. Ehtiyot uchun har MIRROR_REFRESH_MIN
   daqiqada bazadan qayta o'qiladi. Katta yozuvlar (video bo'laklari, fayl
   mazmuni) xotiraga olinmaydi — ular har safar bazadan o'qiladi.
   O'chirish: STORE_MIRROR=0.                                                  */
const MIRROR_SKIP = /^(vchunk|vupload|filebody|qissaaudio|photos|formbg)\//;
const MIRROR_MAX_DOC = 256 * 1024;                 // shundan katta hujjat — bazadan
const MIRROR_MAX_TOTAL = Number(process.env.MIRROR_MAX_MB || 60) * 1024 * 1024;
function withMirror(base) {
  const cols = new Map();            // to'plam → Map(path → JSON matn)
  const big = new Set();             // xotirada yo'q, lekin bazada bor (katta) hujjatlar
  let state = 'off';                 // off | loading | on | failed
  let loading = null, pending = null, bytes = 0, loadedAt = 0, loads = 0;
  /* Boshqa jarayon (deploy paytidagi eski nusxa, skript, test) yozgan o'zgarishlar:
     faol paytda har DELTA_MS da bazadan «oxirgi o'zgarganlar» so'raladi (arzon so'rov).
     Server bo'sh turganda so'rov yo'q — Neon uxlayveradi. */
  /* Lokal sqlite — so'rov arzon (1 ms), har safar tekshiriladi; uzoqdagi Postgres — 2 soniyada bir */
  const DELTA_MS = process.env.MIRROR_DELTA_MS != null ? Number(process.env.MIRROR_DELTA_MS) : (base.kind === 'sqlite' ? 0 : 2000);
  let cursor = null, deltaAt = 0, deltaP = null, countReloadAt = 0;
  const recentWrites = new Map();      // yo'l → oxirgi o'z yozuvimiz vaqti (eski delta ustidan yozmasin)
  const colOf = p => { const i = p.indexOf('/'); return i < 0 ? p : p.slice(0, i); };
  const skip = p => MIRROR_SKIP.test(p);
  function put(p, json) {
    const c = colOf(p);
    if (json == null) { const m = cols.get(c); if (m) { const o = m.get(p); if (o) bytes -= o.length; m.delete(p); } big.delete(p); return; }
    if (json.length > MIRROR_MAX_DOC) { const m = cols.get(c); if (m && m.has(p)) { bytes -= m.get(p).length; m.delete(p); } big.add(p); return; }
    let m = cols.get(c); if (!m) { m = new Map(); cols.set(c, m); }
    const o = m.get(p); if (o) bytes -= o.length;
    m.set(p, json); bytes += json.length; big.delete(p);
  }
  async function load() {
    if (loading) return loading;
    pending = new Map();
    loading = (async () => {
      try {
        const cur0 = base.mirrorCursor ? await base.mirrorCursor() : null;
        const rows = await base.mirrorRows(MIRROR_MAX_DOC);
        cols.clear(); big.clear(); bytes = 0;
        for (const r of rows) {
          if (skip(r.path)) continue;
          if (r.json == null) big.add(r.path); else put(r.path, r.json);
          if (bytes > MIRROR_MAX_TOTAL) throw new Error('nusxa juda katta');
        }
        for (const [p, j] of pending) put(p, j);      // yuklash paytidagi yozuvlar
        state = 'on'; loadedAt = Date.now(); loads++; cursor = cur0; deltaAt = Date.now();
      } catch (e) {
        if (loads > 0 && !/katta/.test(e.message)) { loadedAt = Date.now(); return; }   // vaqtincha xato — eski nusxa qoladi
        state = 'failed'; cols.clear(); big.clear(); bytes = 0;
        console.warn('  Xotira nusxasi o\'chirildi (' + e.message + ') — to\'g\'ridan-to\'g\'ri baza ishlatiladi.');
      } finally { pending = null; loading = null; }
    })();
    return loading;
  }
  async function delta() {
    if (deltaP) return deltaP;
    const started = Date.now();
    deltaP = (async () => {
      try {
        const d = await base.mirrorDelta(cursor, MIRROR_MAX_DOC);
        for (const r of d.rows) {
          if (skip(r.path)) continue;
          if ((recentWrites.get(r.path) || 0) >= started) continue;   // delta boshlangandan keyin o'zimiz yozganmiz — bizniki yangiroq
          if (r.json == null) put(r.path, null), big.add(r.path); else put(r.path, r.json);
        }
        cursor = d.cursor;
        if (recentWrites.size > 5000) recentWrites.clear();
        /* Boshqa jarayon o'chirgan yozuvlar: soni mos kelmasa — to'liq qayta o'qiymiz */
        if (d.total != null) {
          let local = big.size; for (const m of cols.values()) local += m.size;
          if (local !== d.total && !loading && Date.now() - countReloadAt > 30000) { countReloadAt = Date.now(); await load(); }
        }
      } catch (e) { /* keyingi safar yana urinadi */ }
      finally { deltaAt = Date.now(); deltaP = null; }
    })();
    return deltaP;
  }
  async function ready() {
    if (state === 'on') {
      if (base.mirrorDelta && cursor != null && Date.now() - deltaAt >= DELTA_MS && !loading) await delta();
      /* Ishga tushgandan keyingi dastlabki daqiqalarda (deploy paytida eski nusxa
         hali yozayotgan bo'lishi mumkin) tezroq, keyin har 10 daqiqada yangilanadi */
      const every = loads < 3 ? 90000 : Number(process.env.MIRROR_REFRESH_MIN || 10) * 60000;
      if (Date.now() - loadedAt > every && !loading) load();     // fonda yangilanadi, hozircha eskisi xizmat qiladi
      return true;
    }
    if (state === 'failed') return false;
    await load();
    return state === 'on';
  }
  const parse = j => JSON.parse(j);
  const w = Object.assign({}, base, {
    mirror: true,
    async get(p) {
      if (skip(p) || !(await ready())) return base.get(p);
      const m = cols.get(colOf(p));
      if (m && m.has(p)) return parse(m.get(p));
      if (big.has(p)) return base.get(p);
      /* Xotirada yo'q — yo'q deb javob beramiz (boshqa jarayon yozganlari delta orqali
         keladi: sqlite — har so'rovda, Postgres — 2 soniyada). Bazaga bormaymiz:
         «hali yo'q» yozuvlar (kunlik mashq, sessiya…) juda ko'p so'raladi. */
      return null;
    },
    async list(prefix) {
      if (skip(prefix) || !prefix || !(await ready())) return base.list(prefix);
      const c = colOf(prefix), m = cols.get(c), out = [];
      if (m) for (const [p, j] of m) if (p.startsWith(prefix)) out.push({ path: p, data: parse(j) });
      for (const p of big) if (p.startsWith(prefix)) { const d = await base.get(p); if (d != null) out.push({ path: p, data: d }); }
      return out;
    },
    async set(p, data) {
      await base.set(p, data);
      if (skip(p)) return;
      recentWrites.set(p, Date.now());
      const j = JSON.stringify(data);
      if (state === 'on') put(p, j);
      if (pending) pending.set(p, j);
    },
    async del(p) {
      if (base.del) await base.del(p);
      if (skip(p)) return;
      recentWrites.set(p, Date.now());
      if (state === 'on') put(p, null);
      if (pending) pending.set(p, null);
    },
    /* Butun baza. { light: true } — katta fayl to'plamlarisiz (video, fayl
       mazmuni, rasmlar): ro'yxat sahifalari uchun, xotiradan tez. */
    async all(opts) {
      /* To'liq ro'yxat (zaxira, eksport) — har doim bazaning o'zidan, aniq bo'lishi uchun */
      if (!(opts && opts.light)) return base.all();
      if (!(await ready())) return base.all();
      const out = [];
      for (const m of cols.values()) for (const [p, j] of m) out.push({ path: p, data: parse(j) });
      for (const p of big) { const d = await base.get(p); if (d != null) out.push({ path: p, data: d }); }
      if (!(opts && opts.light)) {
        for (const pre of ['vupload/', 'filebody/', 'qissaaudio/', 'photos/', 'formbg/']) out.push(...await base.list(pre));
      }
      return out;
    },
    mirrorInfo() { return { state, bytes, docs: Array.from(cols.values()).reduce((s, m) => s + m.size, 0), big: big.size, loadedAt }; },
    mirrorReload() { return load(); }
  });
  return w;
}

function createStore() {
  const url = process.env.DATABASE_URL;
  const s = url ? makePostgres(url) : (makeSqlite() || makeJsonFile());
  if (String(process.env.STORE_MIRROR || '1') === '0' || !s.mirrorRows) return s;
  return withMirror(s);
}

module.exports = { createStore, DATA_DIR, pgConf, pgSslOptions, stripSslParams };
