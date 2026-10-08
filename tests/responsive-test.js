/* Sayt: moslashuvchan ko'rinish (320–1440px), mobil menyu va "Maxsus chegirma".
   Ishlatish: node tests/responsive-test.js [PORT]                         */
'use strict';
const { chromium } = require('playwright');
const PORT = process.argv[2] || 3300;
const BASE = 'http://localhost:' + PORT + '/';
let pass = 0, fail = 0;
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (info !== undefined ? '  → ' + info : '')); }
}
(async () => {
  const b = await chromium.launch();
  for (const w of [320, 360, 375, 390, 414, 768, 1024, 1440]) {
    const mob = w < 768;
    const ctx = await b.newContext({ viewport: { width: w, height: mob ? 740 : 900 }, isMobile: mob, hasTouch: mob });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('promo_done', '1'); } catch (e) { } });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => { if (!/ServiceWorker/.test(e.message)) errs.push(e.message); });
    await p.goto(BASE, { waitUntil: 'load' });
    await p.waitForSelector('.site-top'); await p.waitForTimeout(800);
    const H = await p.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 700) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(40); }
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [];
      document.querySelectorAll('#auth *').forEach(e => {
        const cs = getComputedStyle(e); if (cs.display === 'none') return;
        const rc = e.getBoundingClientRect(); if (!rc.width) return;
        if (rc.right > vw + 1 || rc.left < -1) {
          let a = e.parentElement, clip = false;
          while (a && a.id !== 'auth') {
            if (/hidden|clip|auto|scroll/.test(getComputedStyle(a).overflowX)) { const ar = a.getBoundingClientRect(); if (ar.right <= vw + 1 && ar.left >= -1) { clip = true; break; } }
            a = a.parentElement;
          }
          if (!clip) bad.push(e.tagName + '.' + e.className);
        }
      });
      return { sw: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 5),
        hdr: Math.round(document.querySelector('.site-top').getBoundingClientRect().height) };
    });
    ok(w + 'px: gorizontal siljish yo‘q', r.sw <= r.vw, r.sw + '>' + r.vw);
    ok(w + 'px: ekrandan chiqqan element yo‘q', !r.bad.length, r.bad.join(', '));
    ok(w + 'px: tepa panel bir qator (≤ 80px)', r.hdr <= 80, r.hdr);
    if (w <= 900) {
      await p.evaluate(() => scrollTo(0, 0));
      const burger = p.locator('.site-burger');
      ok(w + 'px: menyu tugmasi ko‘rinadi', await burger.isVisible());
      await (mob ? burger.tap() : burger.click()); await p.waitForTimeout(300);
      const m = await p.evaluate(() => {
        const n = document.querySelector('.site-nav'); const rc = n.getBoundingClientRect();
        return { d: getComputedStyle(n).display, right: rc.right, vw: innerWidth,
          minH: Math.min.apply(null, Array.from(n.children).filter(c => c.offsetParent).map(c => c.getBoundingClientRect().height)) };
      });
      ok(w + 'px: menyu ochildi va ekranga sig‘di', m.d === 'flex' && m.right <= m.vw + 1, JSON.stringify(m));
      ok(w + 'px: menyu bandlari ≥ 44px', m.minH >= 44, m.minH);
      await p.locator('.site-nav').getByText('Ustozlar').click(); await p.waitForTimeout(500);
      ok(w + 'px: bandni bosgach menyu yopildi', await p.evaluate(() => getComputedStyle(document.querySelector('.site-nav')).display === 'none'));
    } else {
      ok(w + 'px: desktopda menyu tugmasi yashirin', !(await p.locator('.site-burger').isVisible()));
    }
    ok(w + 'px: JS xatosi yo‘q', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  /* Maxsus chegirma xabari */
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  ok('Chegirma 5 soniyagacha chiqmaydi', !(await p.$('.promo.on')));
  await p.waitForSelector('.promo.on', { timeout: 6000 });
  const pr = await p.evaluate(() => {
    const e = document.querySelector('.promo'); const rc = e.getBoundingClientRect();
    const go = e.querySelector('.promo-go');
    return { t: e.innerText, l: rc.left, r: rc.right, vw: innerWidth, anim: getComputedStyle(go).animationName };
  });
  ok('Chegirma: sarlavha "Maxsus chegirma"', /Maxsus chegirma/.test(pr.t));
  ok('Chegirma: 3 daqiqalik sanoq', /0[23]\s*daqiqa/.test(pr.t), pr.t);
  ok('Chegirma: "Ro‘yxatdan o‘tish" tugmasi', /Ro‘yxatdan o‘tish/.test(pr.t));
  ok('Chegirma: tugma silkinadi', pr.anim === 'promoShake', pr.anim);
  ok('Chegirma: narx ko‘rsatilmaydi', !/so['‘’]?m|\d{3}\s?\d{3}/i.test(pr.t), pr.t);
  ok('Chegirma ekranga sig‘adi', pr.l >= 0 && pr.r <= pr.vw, JSON.stringify(pr));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
  const t2 = await p.evaluate(() => { const e = document.querySelector('.promo.on'); return e ? e.innerText : ''; });
  ok('Yangilansa sanoq 3:00 dan qayta boshlanmaydi', /02\s*daqiqa/.test(t2), t2);
  await p.locator('.promo-go').tap(); await p.waitForTimeout(1200);
  const after = await p.evaluate(() => { const a = document.getElementById('ariza'); const r = a.getBoundingClientRect(); return { top: Math.round(r.top), promo: !!document.querySelector('.promo.on') }; });
  ok('Tugma ro‘yxat formasiga olib boradi', Math.abs(after.top) < 200 && !after.promo, JSON.stringify(after));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(6000);
  ok('Yopilgandan keyin shu seansda qayta chiqmaydi', !(await p.$('.promo.on')));
  await b.close();
  console.log('\n' + (fail ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI') + ' — ' + pass + " ta o'tdi, " + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
