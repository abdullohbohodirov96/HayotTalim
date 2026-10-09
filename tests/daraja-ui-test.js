/* Daraja testi — brauzerda to'liq yo'l (telefon va kompyuter).
   node tests/daraja-ui-test.js <URL> [qisqa-vaqtli-server-URL]
   1) til tanlash → boshlash → 20 savol (orqaga, "Bilmayman") → natija
   2) natijadan "Darsga yozilish" → ariza formasi, daraja tanlangan
   3) qayta topshirish, to'g'ridan-to'g'ri #test havolasi
   4) tez ikki marta bosish bitta savolga hisoblanadi
   5) (ixtiyoriy) vaqt tugasa natija o'zi chiqadi                     */
'use strict';
const { chromium } = require('playwright');
const URL1 = process.argv[2] || 'http://localhost:3300/';
const URL2 = process.argv[3] || '';
let pass = 0, fail = 0;
function ok(n, c, i) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (i !== undefined ? '  → ' + i : '')); } }
async function startTest(p, lang) {
  await p.waitForSelector('.test-lang', { timeout: 15000 });
  if (lang) { await p.click('.test-lang-row button[lang="' + lang + '"]'); await p.waitForTimeout(200); }
  await p.click('.test-lang .btn.primary.lg');
  await p.waitForSelector('.test-opt', { timeout: 15000 });
}
async function answer(p) {
  const before = await p.textContent('.test-count');
  await p.waitForTimeout(400);
  await p.locator('.test-opt').first().click();
  await p.waitForFunction(b => { const e = document.querySelector('.test-count'); return !e || e.textContent !== b; }, before, { timeout: 5000 });
}
(async () => {
  const b = await chromium.launch();
  for (const [vn, vp] of [['telefon', { width: 375, height: 740, isMobile: true, hasTouch: true }], ['kompyuter', { width: 1280, height: 860 }]]) {
    console.log('\n== ' + vn + ' — ' + URL1);
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('promo_done', '1'); } catch (e) { } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => { if (!/ServiceWorker/.test(e.message)) errs.push(e.message); });
    await p.goto(URL1, { waitUntil: 'load' });
    await p.waitForSelector('.site-top');
    /* Saytdagi tugma orqali */
    await p.evaluate(() => { location.hash = 'test'; });
    await startTest(p);
    const total = await p.evaluate(() => Number((document.querySelector('.test-count').textContent.split('/')[1] || '').trim()));
    ok(vn + ': savollar keldi', total >= 10, total);
    ok(vn + ': sanoq ko‘rinadi', await p.isVisible('.test-clock'));
    /* gorizontal siljish yo'q */
    ok(vn + ': test sahifasi ekranga sig‘adi', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    /* Tez ikki marta bosish */
    const c0 = await p.textContent('.test-count');
    await p.waitForTimeout(400);
    await p.locator('.test-opt').nth(1).dblclick();
    await p.waitForTimeout(900);
    const c1 = await p.textContent('.test-count');
    ok(vn + ': ikki marta bosish bitta savolga hisoblanadi', parseInt(c1) === parseInt(c0) + 1, c0 + ' → ' + c1);
    /* Orqaga — oldingi javob belgilangan */
    await p.click('.test-nav .btn:not(.ghost)');
    await p.waitForTimeout(300);
    ok(vn + ': orqaga qaytganda javob belgilangan', (await p.locator('.test-opt.on').count()) === 1);
    await answer(p);
    /* "Bilmayman" */
    const c2 = await p.textContent('.test-count');
    await p.click('.test-nav .btn.ghost'); await p.waitForTimeout(300);
    ok(vn + ': "Bilmayman" keyingi savolga o‘tkazadi', parseInt(await p.textContent('.test-count')) === parseInt(c2) + 1);
    let guard = 0;
    while ((await p.locator('.test-opt').count()) && guard++ < 40) await answer(p);
    await p.waitForSelector('.test-end', { timeout: 8000 });
    ok(vn + ': oxirida natija formasi', true);
    const server = await p.evaluate(() => A.Data.mode === 'server');
    if (server) {
      ok(vn + ': ism va telefon so‘raladi (server)', await p.isVisible('#test-phone'));
      await p.fill('#test-name', 'Sinov ' + vn); await p.fill('#test-phone', '+998 90 111 22 33');
    } else {
      ok(vn + ': serversiz nusxada telefon so‘ralmaydi', !(await p.$('#test-phone')));
    }
    await p.click('.test-end button[type=submit]');
    await p.waitForSelector('.test-res', { timeout: 15000 });
    const res = await p.evaluate(() => ({ lvl: document.querySelector('.test-level b').textContent, rows: document.querySelectorAll('.test-row').length, score: document.querySelector('.test-score').textContent }));
    ok(vn + ': natija: daraja va jadval', /^(A0|A1|A2|B1|B2|C1|C2)$/.test(res.lvl) && res.rows >= 6, JSON.stringify(res));
    ok(vn + ': sanoq to‘xtadi', !(await p.isVisible('.test-clock')));
    /* Qayta topshirish */
    await p.click('.test-res .test-nav .btn.sm'); await p.waitForTimeout(300);
    ok(vn + ': "Qayta topshirish" til tanlashga qaytaradi', await p.isVisible('.test-lang'));
    /* Natijadan ariza formasiga */
    await startTest(p);
    guard = 0; while ((await p.locator('.test-opt').count()) && guard++ < 40) { await p.click('.test-nav .btn.ghost'); await p.waitForTimeout(120); }
    if (server) {
      /* Telefonsiz natija ko'rsatilmaydi */
      await p.click('.test-end button[type=submit]'); await p.waitForTimeout(600);
      ok(vn + ': telefonsiz natija chiqmaydi', !(await p.$('.test-res')) && await p.isVisible('#test-phone'));
      await p.fill('#test-phone', '+998 90 222 33 44');
    }
    await p.click('.test-end button[type=submit]');
    await p.waitForSelector('.test-res', { timeout: 15000 });
    const lv = await p.textContent('.test-level b');
    await p.click('.test-res .test-nav .btn.primary');
    await p.waitForTimeout(1500);
    const f = await p.evaluate(() => { const a = document.getElementById('ariza'); const pill = document.getElementById('lead-level-text'); return { top: a ? Math.round(a.getBoundingClientRect().top) : null, pill: pill ? pill.textContent : '' }; });
    ok(vn + ': "Darsga yozilish" ariza formasiga olib boradi', f.top !== null && Math.abs(f.top) < 300, JSON.stringify(f));
    ok(vn + ': formada aniqlangan daraja tanlangan', f.pill.indexOf(lv) === 0, f.pill + ' / ' + lv);
    /* To'g'ridan-to'g'ri havola */
    await p.goto(URL1.replace(/\/?$/, '/') + '#daraja', { waitUntil: 'load' });
    await p.waitForSelector('.test-lang', { timeout: 15000 });
    ok(vn + ': #daraja havolasi testni ochadi', true);
    for (const lg of ['ru', 'ar']) {
      await p.click('.test-lang-row button[lang="' + lg + '"]'); await p.waitForTimeout(200);
      ok(vn + ': til almashadi (' + lg + ')', (await p.getAttribute('.test-box', 'dir')) === (lg === 'ar' ? 'rtl' : 'ltr'));
    }
    ok(vn + ': JS xatosi yo‘q', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  if (URL2) {
    console.log('\n== vaqt tugashi — ' + URL2);
    const p = await b.newPage({ viewport: { width: 390, height: 800 } });
    await p.addInitScript(() => { try { sessionStorage.setItem('promo_done', '1'); } catch (e) { } });
    await p.goto(URL2.replace(/\/?$/, '/') + '#test', { waitUntil: 'load' });
    await startTest(p);
    await answer(p); await answer(p);
    await p.waitForSelector('.test-res', { timeout: 20000 });
    ok('Vaqt tugaganda natija o‘zi chiqadi', true);
    ok('Javob berilganlar hisobga olindi', /\b\d+\s*\/\s*\d+/.test(await p.textContent('.test-score')));
  }
  await b.close();
  console.log('\n' + (fail ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI') + ' — ' + pass + " ta o'tdi, " + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
