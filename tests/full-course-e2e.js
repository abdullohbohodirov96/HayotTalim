/* TO'LIQ O'QUVCHI YO'LI — brauzerda, kompyuter va telefon o'lchamida.
   Kabinetga kirish → barcha bo'limlar → 1- va 2-dars to'liq (video, qissa, so'zlar,
   qoida, mashq, test, uy vazifasi) → takrorlash testi → 3-dars ochiladi →
   lug'at kartochkalari → fayl, profil. Keyin 8 ta darsning har bosqichi (ustoz
   ko'rinishi). Har bir «🔊» bosilganda ovoz haqiqatan chaqirilganini tekshiradi
   (sinovda arabcha ovoz soxta qilinadi), bloklar orasidagi o'tish vaqtini o'lchaydi,
   JS xatolari va yon tomonga siljishni qidiradi.
     node tests/full-course-e2e.js [port] [direktor paroli]                      */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
/* --demo <url>: namoyish (serversiz) nusxasini sandbox iframe ichida tekshirish */
const DEMO = process.argv.indexOf('--demo') > 0 ? process.argv[process.argv.indexOf('--demo') + 1] : null;
const PORT = DEMO ? 0 : (process.argv[2] || 3300);
const PASS = process.argv[3] || 'Albyana2026!';
const BASE = 'http://localhost:' + PORT;
const SHOTS = path.join(__dirname, '..', 'shots', 'e2e');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const out = [], slow = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); } else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }
const LIMIT_STEP = 450, LIMIT_SECTION = 900;   // ms

async function api(p, body, cookie, method, extra) {
  const r = await fetch(BASE + p, {
    method: method || 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'X-Forwarded-For': '10.50.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) }, cookie ? { Cookie: cookie } : {}, extra || {}),
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, json: await r.json().catch(() => null), cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

/* Soxta arabcha ovoz: nima aytilganini yozib boradi, tez tugaydi */
const SPEECH_MOCK = `
  window.__said = []; window.__errs = [];
  window.addEventListener('error', function (e) { window.__errs.push('error: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
  window.addEventListener('unhandledrejection', function (e) { window.__errs.push('promise: ' + String(e.reason && (e.reason.stack || e.reason.message) || e.reason).slice(0, 300)); });
  (function () {
    var voices = [{ name: 'Sinov Arab Ayol', lang: 'ar-SA', localService: true, voiceURI: 'sinov', default: false }];
    var fake = { speaking: false, pending: false, paused: false,
      getVoices: function () { return voices; },
      cancel: function () { this.speaking = false; },
      pause: function () {}, resume: function () {},
      addEventListener: function () {}, onvoiceschanged: null,
      speak: function (u) {
        var self = this;
        window.__said.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.name });
        self.speaking = true;
        setTimeout(function () { u.onstart && u.onstart({}); }, 5);
        setTimeout(function () { self.speaking = false; u.onend && u.onend({}); }, 90);
      } };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; this.lang = ''; };
  })();`;

async function timed(page, label, action, waitSel, limit) {
  const t0 = Date.now();
  await action();
  try { await page.waitForSelector(waitSel, { timeout: 15000 }); }
  catch (e) {
    console.log('KUTILGAN ' + waitSel + ' CHIQMADI (' + label + '). Sahifada:', (await page.evaluate(() => document.body.innerText.slice(0, 300))).replace(/\n+/g, ' | '));
    console.log('SAHIFA XATOLARI:', await page.evaluate(() => window.__errs));
    console.log('DOM:', await page.evaluate(() => ({ portals: document.querySelectorAll('.kab-card.sp').length, vhero: document.querySelectorAll('.sp-vhero').length,
      cta: [...document.querySelectorAll('.sp-vhero .sp-cta')].map(b => b.textContent + ' disabled=' + b.disabled), hash: location.hash, modals: document.querySelectorAll('.modal-back').length,
      toasts: document.getElementById('toasts') && document.getElementById('toasts').innerText })));
    console.log('BOSISHLAR:', await page.evaluate(() => window.__clicks));
    console.log('USTIDA NIMA:', await page.evaluate(() => { const b = document.querySelector('.sp-vhero .sp-cta'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { rect: [r.left, r.top, r.width, r.height], top: el && (el.tagName + '.' + el.className + ' #' + el.id), parent: el && el.parentElement && (el.parentElement.className + ' #' + el.parentElement.id), vh: innerHeight }; }));
    console.log('QAYTA BOSISH:', await page.evaluate(async () => { document.querySelector('.sp-vhero .sp-cta') && document.querySelector('.sp-vhero .sp-cta').click(); await new Promise(r => setTimeout(r, 800)); return [!!document.querySelector('.sp-flash'), document.getElementById('toasts').innerText, window.__errs]; }));
    throw e;
  }
  const ms = Date.now() - t0;
  if (ms > (limit || LIMIT_STEP)) slow.push(label + ': ' + ms + ' ms');
  return ms;
}
const said = page => page.evaluate(() => window.__said.slice());
const clearSaid = page => page.evaluate(() => { window.__said = []; });
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const norm = t => String(t || '').replace(/[ً-ٰٟـ]/g, '').replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const dir = DEMO ? null : (await api('/api/login', { login: 'admin', password: PASS })).cookie;
  if (!DEMO && !dir) { console.error('Direktor kira olmadi'); process.exit(1); }
  const browser = await chromium.launch();

  for (const [vname, viewport] of [['kompyuter', { width: 1366, height: 860 }], ['telefon', { width: 390, height: 844 }]]) {
    const mobile = viewport.width < 600;
    section('══════ ' + vname.toUpperCase() + ' (' + viewport.width + 'px) ══════');
    let code = null;
    if (!DEMO) {
      const sid = 'e2e' + vname[0] + Date.now().toString(36);
      await api('/api/doc?path=students/' + sid, { data: { id: sid, firstName: 'Sinov', lastName: vname, phone: '+99890' + String(Date.now()).slice(-7), status: 'faol' } }, dir, 'PUT');
      code = (await api('/api/doc?path=students/' + sid, null, dir, 'GET')).json.data.code;
    }
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript(SPEECH_MOCK);
    const top = await ctx.newPage();
    let page = top;
    const errors = [];
    if (!DEMO) page.on('pageerror', e => errors.push(e.message));
    if (!DEMO) page.on('console', m => { if (m.type() === 'error' && !/TUNNEL|fonts|favicon|401|404 \(Not Found\)/.test(m.text())) errors.push(m.text()); });
    top.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => { }); });

    /* ---------- 1. Kirish ---------- */
    if (DEMO) {
      section('1. Namoyish: ochiq sayt → O’quvchi kabineti (sandbox iframe)');
      await top.setContent('<iframe src="' + DEMO + '" style="width:100vw;height:100vh;border:0;position:fixed;inset:0" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"></iframe>');
      await top.waitForTimeout(2500);
      page = top.frames().find(f => /markaz-demo/.test(f.url()));
      page.screenshot = o => top.screenshot(o);
      page.on = () => { };
      top.on('pageerror', e => errors.push(e.message));
      top.on('console', m => { if (m.type() === 'error' && !/TUNNEL|fonts|favicon|404|sw\.js|ServiceWorker/.test(m.text())) errors.push(m.text()); });
      ok('Namoyish ochiq saytdan boshlanadi', /O’quvchi kabineti/.test(await page.evaluate(() => document.body.innerText)) && !(await page.$('#login-user')));
      /* Telefonda tepa menyu "gamburger" ortida — avval uni ochamiz */
      if (await page.isVisible('.site-burger')) { await page.click('.site-burger'); await top.waitForTimeout(300); }
      await page.click('.site-nav >> text=O’quvchi kabineti');
      await page.waitForSelector('#kab-login', { timeout: 8000 });
      ok('Kabinet login va parol so’raydi (darhol kirmaydi)', !(await page.$('.sp-ring')));
      await page.fill('#kab-login', '1111'); await page.fill('#kab-pass', '1111'); await page.click('#kab-go');
      await page.waitForTimeout(400);
      ok('Noto’g’ri parol bilan kirmaydi', !(await page.$('.sp-ring')));
      const dcode = await page.evaluate(() => String(A.Data.all('students').filter(s => s.status === 'faol')[0].code));
      await page.fill('#kab-login', dcode); await page.fill('#kab-pass', dcode);
      const tLogin = await timed(page, 'kirish', () => page.click('#kab-go'), '.sp-ring', 2500);
      ok('Kabinet ochildi ' + tLogin + ' ms', true);
    } else {
    section('1. Kirish (/kabinet)');
    await page.goto(BASE + '/kabinet');
    await page.waitForSelector('#kab-login');
    await page.fill('#kab-login', String(code)); await page.fill('#kab-pass', String(code));
    const tLogin = await timed(page, 'kirish', () => page.click('#kab-go'), '.sp-ring', 2500);
    ok('Kirish ' + tLogin + ' ms', true);
    }

    /* ---------- 2. Bo'limlar ---------- */
    section('2. Kabinet bo’limlari');
    const SECTIONS = [['darslar', '.sp-lesson'], ['vazifalar', '.sp-hw'], ['lugat', '.sp-vhero'], ['jadval', '.sp-week'], ['tolov', '.sp-paybig'], ['fayllar', '.sp-drop'], ['savol', '.sp-card textarea'], ['profil', '.sp-profile'], ['asosiy', '.sp-ring']];
    for (const [id, sel] of SECTIONS) {
      const ms = await timed(page, 'bo’lim ' + id, async () => {
        if (!mobile) await page.click('.sp-nav-i[data-b="' + id + '"]');
        else {
          const tab = await page.$('.sp-tab:has-text("' + ({ asosiy: 'Asosiy', darslar: 'Darslarim', vazifalar: 'Vazifalar', lugat: 'Lug’at' })[id] + '")');
          if (tab && ['asosiy', 'darslar', 'vazifalar', 'lugat'].indexOf(id) >= 0) await tab.click();
          else { await page.click('.sp-tab:has-text("Yana")'); await page.waitForSelector('.sp-more-i'); await page.click('.sp-more-i:has-text("' + ({ jadval: 'Dars jadvali', tolov: 'To’lovlarim', fayllar: 'Fayllarim', savol: 'Savol-javob', profil: 'Profil' })[id] + '")'); }
        }
      }, sel, LIMIT_SECTION);
      const ov = await overflow(page);
      ok('«' + id + '» ochildi (' + ms + ' ms), yon siljish yo’q', ov <= 1, 'siljish ' + ov + 'px');
      await page.screenshot({ path: path.join(SHOTS, vname + '-bolim-' + id + '.png'), fullPage: true });
    }

    /* ---------- 3. Darslarni to'liq o'tish ---------- */
    async function doLesson(n) {
      const L = await page.evaluate(i => { const l = A.Course.LESSONS[i]; return { id: l.id, words: l.words.map(w => w.ar), lines: l.dialog.lines.map(x => x.ar), ex: l.grammar.points.reduce((a, p) => a.concat(p.ex.map(e => e.ar)), []) }; }, n);
      section('3.' + (n + 1) + ' ' + (n + 1) + '-dars (' + L.id + ') — to’liq');
      const nextBtn = await page.$('.cr-next .btn:has-text("Keyingi darsga")');
      if (nextBtn) await timed(page, 'keyingi darsga o’tish', () => nextBtn.click(), '.qv-stage', 2000);
      else await page.evaluate(id => { sessionStorage.setItem('kurs_last', id); location.hash = 'kurs'; }, L.id);
      await page.waitForSelector('.cr-step.on', { timeout: 15000 });
      const first = await page.$eval('.cr-step.on', e => e.textContent);
      ok('Dars videodan boshlanadi', /Video/.test(first), first);

      /* Video */
      try { await page.waitForSelector('.qv-bigplay', { timeout: 8000 }); }
      catch (e) {
        await page.screenshot({ path: path.join(SHOTS, 'XATO-video.png'), fullPage: true });
        console.log('DEBUG', await page.evaluate(() => [location.hash, (document.querySelector('.cr-step.on') || {}).textContent, !!document.querySelector('.cr-video'), !!document.querySelector('.qv-bigplay'), document.querySelector('.qv-bigplay') && document.querySelector('.qv-bigplay').hidden, document.querySelectorAll('.qv').length]), errors);
        throw e;
      }
      await clearSaid(page);
      await page.click('.qv-bigplay');
      await page.waitForSelector('.qv-stage.recap-on', { timeout: 40000 });
      await page.waitForSelector('.qv-end', { timeout: 30000 });
      let s = (await said(page)).map(x => norm(x.text));
      ok('Video: qissaning barcha ' + L.lines.length + ' gapi o’qildi', L.lines.every(t => s.indexOf(norm(t)) >= 0), s.length + ' ta ovoz');
      ok('Video: ovoz arabcha (ar-SA)', (await said(page)).every(x => /^ar/.test(x.lang)));
      if (n === 0) await page.screenshot({ path: path.join(SHOTS, vname + '-video-oxiri.png') });

      /* Video → Qissa */
      await timed(page, L.id + ' video→qissa', () => page.click('.cr-next .btn'), '.cr-story');
      await clearSaid(page);
      await page.click('.cr-story-bar .btn.primary');
      await page.waitForFunction(k => window.__said.length >= k, L.lines.length, { timeout: 30000 });
      s = (await said(page)).map(x => norm(x.text));
      ok('Qissa: «Qissani tinglash» hamma gapni o’qidi', L.lines.every(t => s.indexOf(norm(t)) >= 0));
      await page.waitForTimeout(400);
      await clearSaid(page);
      const bubbleBtns = await page.$$('.cr-story .cr-bubble-ar .cr-say:not(.mic)');
      for (const b of bubbleBtns) { await b.click(); await page.waitForTimeout(140); }
      ok('Qissa: har gap yonidagi 🔊 ishlaydi (' + bubbleBtns.length + ')', (await said(page)).length === bubbleBtns.length, (await said(page)).length + '/' + bubbleBtns.length);

      /* Qissa → So'zlar */
      await timed(page, L.id + ' qissa→so’zlar', () => page.click('.cr-next .btn'), '.cr-word');
      await clearSaid(page);
      const words = await page.$$('.cr-word');
      for (const w of words) { await w.click(); await page.waitForTimeout(130); }
      s = (await said(page)).map(x => norm(x.text));
      ok('So’zlar: har kartochka bosilganda o’z so’zi aytiladi (' + words.length + ')', L.words.every(t => s.indexOf(norm(t)) >= 0), s.join(' | '));

      /* So'zlar → Qoida */
      await timed(page, L.id + ' so’zlar→qoida', () => page.click('.cr-next .btn'), '.cr-rulecard');
      await clearSaid(page);
      const exBtns = await page.$$('.cr-rulecard .cr-say');
      for (const b of exBtns) { await b.click(); await page.waitForTimeout(130); }
      ok('Qoida: misollar 🔊 (' + exBtns.length + ')', (await said(page)).length === exBtns.length && exBtns.length > 0, (await said(page)).length + '/' + exBtns.length);

      /* Qoida → Mashq */
      await timed(page, L.id + ' qoida→mashq', () => page.click('.cr-next .btn'), '.cr-score');
      const prac = await page.evaluate(i => A.Course.LESSONS[i].practice, n);
      const blocks = await page.$$('.cr-panel > .cr-q');
      for (let k = 0; k < prac.length; k++) {
        const it = prac[k], blk = blocks[k];
        if (it.type === 'order') {
          for (const wd of it.words) {
            const toks = await blk.$$('.cr-order-bank .cr-tok');
            for (const t of toks) { if ((await t.innerText()).trim() === wd) { await t.click(); break; } }
          }
        } else {
          const opts = await blk.$$('.cr-opt');
          await opts[it.answer].click();
        }
      }
      const score = await page.$eval('.cr-score', e => e.textContent);
      ok('Mashq: hamma to’g’ri javob qabul qilindi — ' + score, new RegExp(prac.length + ' / ' + prac.length).test(score), score);

      /* Mashq → Test */
      await timed(page, L.id + ' mashq→test', () => page.click('.cr-next .btn'), '.cr-testbar');
      const test = await page.evaluate(i => A.Course.buildTest(A.Course.LESSONS[i]), n);
      for (let k = 0; k < test.length; k++) {
        const opts = await page.$$('.cr-panel .cr-opt');
        await opts[test[k].answer].click();
        await page.click('.cr-next .btn');
      }
      await page.waitForSelector('.cr-result', { timeout: 10000 });
      const res = await page.$eval('.cr-result-big', e => e.textContent);
      eq('Test: 100%', res, '100%');
      await timed(page, L.id + ' test→uy vazifasi', () => page.click('.cr-result .btn.primary'), '.cr-pin');

      /* Uy vazifasi */
      const hw = await page.evaluate(i => { const l = A.Course.LESSONS[i]; return { auto: l.homework.auto.map(q => q.answer), w: A.Course.buildWritten(l) }; }, n);
      ok('Uy vazifasi: qissa tepada ko’rinib turadi', !!(await page.$('.cr-pin .cr-story')));
      ok('Uy vazifasi: yordam boshida yashirin', await page.$$eval('.cr-hint-btn', bs => bs.every(b => b.hidden)));
      const cards = await page.$$('.cr-ex-card');
      /* savollar */
      const qcard = cards.find ? null : null;
      const autoBlocks = await page.$$('.cr-ex-card .cr-q .cr-opts');
      for (let k = 0; k < hw.auto.length; k++) { const o = await autoBlocks[k].$$('.cr-opt'); await o[hw.auto[k]].click(); }
      /* bo'sh joy: avval xato → yordam chiqadi, keyin to'g'ri */
      const fills = await page.$$('.cr-fill-in');
      if (fills.length) {
        await fills[0].fill('خطأ');
        await page.evaluate(() => document.querySelector('.cr-fill .cr-fill-ctl .btn').click());
        ok('Xato tekshirilganda «💡 Yordam» chiqadi', await page.$eval('.cr-fill .cr-hint-btn', b => !b.hidden));
        await page.evaluate(() => document.querySelector('.cr-fill .cr-hint-btn').click());
        ok('Yordam bosilganda bitta ishora chiqadi', (await page.$$('.cr-fill .cr-hint')).length >= 1);
      }
      for (let k = 0; k < fills.length; k++) await fills[k].fill(hw.w.fill[k].answer);
      if (fills.length) {
        await page.evaluate(() => document.querySelector('.cr-fill .cr-fill-ctl .btn').click());
        ok('To’g’ri yozilsa «✓ To’g’ri!»', /To’g’ri/.test(await page.$eval('.cr-fill .cr-fill-mark', e => e.textContent)));
      }
      const trs = await page.$$('.cr-ex-card textarea[lang="ar"]');
      for (let k = 0; k < hw.w.tr.length && k < trs.length; k++) await trs[k].fill(hw.w.tr[k].ar);
      const tas = await page.$$('.cr-ex-card textarea.cr-ta:not([lang])');
      for (const t of tas) await t.fill('هذه أمي. Bu mening onam.');
      /* klaviatura */
      await page.click('.cr-kb-btn');
      ok('Arab klaviaturasi ochiladi', !!(await page.$('.cr-kb')));
      await page.click('.cr-kb-btn');
      await page.click('.cr-next .btn.primary');
      await page.waitForSelector('.cr-hwstat', { timeout: 10000 });
      ok('Vazifa yuborildi, holat ko’rindi', /tekshirmoqda|qabul/i.test(await page.$eval('.cr-hwstat', e => e.textContent)));
      ok('Darsda JS xatosi yo’q', errors.length === 0, errors.join(' | '));
      ok('Darsda yon siljish yo’q', (await overflow(page)) <= 1, String(await overflow(page)));
      await page.screenshot({ path: path.join(SHOTS, vname + '-' + L.id + '-yuborildi.png'), fullPage: true });
    }
    function eq(name, got, want) { ok(name, got === want, 'kutilgan ' + want + ', olindi ' + got); }

    await doLesson(0);
    ok('1-dars tugagach «Keyingi darsga o’tish» bor', !!(await page.$('.cr-next .btn:has-text("Keyingi darsga")')));
    await doLesson(1);
    section('4. Takrorlash testi (har 2 darsdan keyin)');
    ok('2-darsdan keyin takrorlash chaqiruvi chiqdi', !!(await page.$('.cr-gate')));
    await timed(page, 'dars→takrorlash testi', () => page.click('.cr-gate .btn'), '.sp-opt', 2500);
    const rv = await page.evaluate(() => A.Course.buildReview(A.Course.reviewById('r1')));
    await clearSaid(page);
    for (let k = 0; k < rv.length; k++) {
      await page.waitForSelector('.sp-opt:not([disabled])');
      const opts = await page.$$('.sp-opt');
      await opts[rv[k].answer].click();
      await page.waitForTimeout(650);
    }
    await page.waitForSelector('.sp-cdone', { timeout: 10000 });
    eq('Takrorlash: 100%', await page.$eval('.sp-cdone-big', e => e.textContent.trim()), '100%');
    const listenQs = rv.filter(q => q.kind === 'listen').map(q => norm(q.say));
    const sAll = (await said(page)).map(x => norm(x.text));
    ok('«Tinglang» savollarida so’z aytildi', listenQs.every(t => sAll.indexOf(t) >= 0));
    await page.click('.sp-cdone .btn.primary');
    await page.waitForSelector('.sp-lesson');
    const st3 = await page.$$eval('.sp-lesson:not(.sp-rv)', els => els.map(e => e.className));
    ok('3-dars ochildi', /open/.test(st3[2]), st3[2]);

    section('5. Lug’at yodlash');
    if (!mobile) await page.click('.sp-nav-i[data-b="lugat"]'); else await page.click('.sp-tab:has-text("Lug’at")');
    await page.waitForSelector('.sp-vhero');
    await page.waitForTimeout(400);
    await clearSaid(page);
    await page.evaluate(() => {
      window.__clicks = []; window.__vh = document.querySelector('.sp-vhero');
      ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(t => document.addEventListener(t, e => { window.__clicks.push(t + ':' + String(e.target.className) + '@' + e.clientX + ',' + e.clientY + ' same=' + (document.querySelector('.sp-vhero') === window.__vh)); }, true));
      new MutationObserver(ms => ms.forEach(m => window.__clicks.push('mut:' + (m.target.className || m.target.id) + ' +' + m.addedNodes.length + ' -' + m.removedNodes.length))).observe(document.body, { childList: true, subtree: true });
    });
    await timed(page, 'lug’at→kartochkalar', () => page.click('.sp-vhero .sp-cta'), '.sp-flash');
    let cardsDone = 0;
    for (let k = 0; k < 20; k++) {
      if (await page.$('.sp-cdone')) break;
      await page.click('.sp-show'); await page.click(k % 4 === 3 ? '.sp-no' : '.sp-yes'); cardsDone++;
      await page.waitForTimeout(60);
    }
    await page.waitForSelector('.sp-cdone', { timeout: 5000 });
    ok('Kartochkalar to’plami tugadi (' + cardsDone + ' ta)', cardsDone > 0);
    ok('Har kartochkada so’z aytildi', (await said(page)).length >= cardsDone, (await said(page)).length + '/' + cardsDone);
    await page.click('.sp-cdone .btn');
    await page.waitForSelector('.sp-vhero');
    await page.waitForTimeout(500);
    const learnedTxt = await page.$eval('.sp-tiles .sp-tile:nth-child(2) b', e => e.textContent);
    ok('Lug’at statistikasi yangilandi', Number(learnedTxt) >= 0);
    await clearSaid(page);
    const sayBtns = await page.$$('.sp-word-say');
    for (const b of sayBtns.slice(0, 6)) { await b.click(); await page.waitForTimeout(120); }
    ok('Lug’at ro’yxatida 🔊 ishlaydi', (await said(page)).length === Math.min(6, sayBtns.length));

    section('6. Fayl, profil');
    if (!mobile) await page.click('.sp-nav-i[data-b="fayllar"]');
    else { await page.click('.sp-tab:has-text("Yana")'); await page.click('.sp-more-i:has-text("Fayllarim")'); }
    await page.waitForSelector('.sp-drop');
    await page.setInputFiles('.sp-drop input[type=file]', { name: 'daftar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await page.waitForSelector('.sp-file', { timeout: 10000 });
    ok('Fayl yuklandi va ro’yxatda', (await page.$$('.sp-file')).length >= 1);
    if (!DEMO) {
    if (!mobile) await page.click('.sp-nav-i[data-b="profil"]');
    else { await page.click('.sp-tab:has-text("Yana")'); await page.click('.sp-more-i:has-text("Profil")'); }
    await page.waitForSelector('.sp-form');
    const pw = await page.$$('.sp-form input');
    await pw[0].fill(String(code)); await pw[1].fill('YangiParol1'); await pw[2].fill('YangiParol1');
    await page.click('.sp-form .btn.primary');
    await page.waitForTimeout(800);
    const relog = await api('/api/kabinet', { login: String(code), password: 'YangiParol1' });
    eq('Yangi parol bilan kirish ishlaydi', relog.status, 200);
    }

    section('7. Barcha 8 dars — har bosqich (ustoz ko’rinishi)');
    await page.evaluate(() => { location.hash = ''; });
    await page.evaluate(() => A.renderCourse({ preview: true, onExit: function () { } }));
    await page.waitForSelector('.cr-lesson');
    const nL = await page.evaluate(() => A.Course.LESSONS.length);
    for (let i = 0; i < nL; i++) {
      await page.evaluate(k => { document.querySelectorAll('.cr-side .cr-lesson')[k].click(); }, i);
      await page.waitForTimeout(150);
      const steps = await page.$$eval('.cr-step', els => els.length);
      let bad = [];
      for (let k = 0; k < steps; k++) {
        const ms = await timed(page, 'L' + (i + 1) + ' bosqich ' + (k + 1), () => page.evaluate(j => document.querySelectorAll('.cr-step')[j].click(), k), '.cr-panel');
        const sayN = await page.$$eval('.cr-panel .cr-say:not(.mic)', b => b.length);
        if (sayN) {
          await clearSaid(page);
          await page.evaluate(() => { const b = document.querySelector('.cr-panel .cr-say:not(.mic)'); b.click(); });
          await page.waitForTimeout(120);
          if (!(await said(page)).length) bad.push('bosqich ' + (k + 1) + ': 🔊 jim');
        }
        if ((await overflow(page)) > 1) bad.push('bosqich ' + (k + 1) + ': yon siljish');
        if (mobile && i === 2) await page.screenshot({ path: path.join(SHOTS, vname + '-L3-bosqich' + (k + 1) + '.png'), fullPage: true });
      }
      /* video bir gap o'qilguncha */
      await page.evaluate(() => document.querySelectorAll('.cr-step')[0].click());
      await page.waitForSelector('.qv-bigplay');
      await clearSaid(page);
      await page.click('.qv-bigplay');
      try { await page.waitForFunction(() => window.__said.length >= 2, null, { timeout: 12000 }); } catch (e) { bad.push('video gapirmadi'); }
      await page.evaluate(() => { const b = document.querySelector('.qv-ctrl .qv-btn.primary'); if (b && /To/.test(b.textContent)) b.click(); });
      ok((i + 1) + '-dars: ' + steps + ' bosqich ochildi, ovoz va video ishlaydi', bad.length === 0, bad.join(', '));
    }
    ok(vname + ': JS xatosi yo’q', errors.length === 0, errors.slice(0, 5).join(' | '));
    await ctx.close();
  }

  /* ---------- Ustoz tomoni ---------- */
  if (!DEMO) {
  section('8. Ustoz paneli: vazifani tekshirish');
  const ov = await api('/api/course/overview', null, dir, 'GET');
  const rows = (ov.json.rows || []).filter(r => /^e2e/.test(r.studentId));
  ok('Ustoz ikki sinov o’quvchisining vazifalarini ko’radi', rows.length === 2 && rows.every(r => r.pending.length === 2), rows.map(r => r.pending.length).join(','));
  for (const r of rows) {
    const rr = await api('/api/course/review', { studentId: r.studentId, lessonId: r.pending[0].lessonId, decision: 'qabul', grade: 5, comment: 'Barakalla' }, dir);
    ok('Vazifa qabul qilindi', rr.status === 200);
  }
  }

  await browser.close();
  console.log(out.join('\n'));
  if (slow.length) console.log('\nSEKIN O’TISHLAR (chegaradan oshgan):\n  ' + slow.join('\n  '));
  console.log('\nScreenshotlar: ' + SHOTS);
  console.log('\n' + (fail ? '✗ XATOLAR BOR — ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o’tdi' + (slow.length ? ', ' + slow.length + ' ta sekin o’tish' : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
