/* Sinovlar uchun: menyu orqali sahifaga o'tish (yon menyu bo'limlarga yig'ilgan).
   Avval yon menyudagi bo'lim (yoki telefonda «Menyu» → bo'lim), keyin sahifa
   tepasidagi bo'lim tugmalari qatoridan kerakli sahifa bosiladi — xuddi odamdek. */
'use strict';
async function openPage(page, label, opts) {
  opts = opts || {};
  const info = await page.evaluate(l => {
    const A = window.A, n = (A.NAV || []).filter(x => x.label === l || (A.I18N && A.I18N.t && A.I18N.t(x.label) === l))[0];
    if (!n) return null;
    return { id: n.id, label: n.label, sec: A.navSectionLabel ? A.navSectionLabel(n.id) : n.label };
  }, label);
  if (!info) throw new Error('Menyuda yo‘q: ' + label);
  const mobile = opts.mobile || await page.evaluate(() => { const n = document.getElementById('nav'); return !n || !n.offsetParent; });
  if (mobile) {
    await page.click('#tabbar button:has-text("Menyu")');
    await page.waitForTimeout(300);
    await page.click('.modal .menu-item:has-text("' + info.sec + '")');
  } else {
    await page.click('#nav button:has-text("' + info.sec + '")');
  }
  await page.waitForTimeout(400);
  const here = await page.evaluate(id => window.A.App.route.name === id, info.id);
  if (!here) {
    await page.click('.secbar button:has-text("' + info.label + '")');
    await page.waitForTimeout(300);
  }
}
module.exports = { openPage };
