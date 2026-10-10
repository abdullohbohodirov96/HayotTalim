/* Vercel uchun namoyish (serversiz) nusxa: vercel-dist/ papkasiga.
   Ma'lumotlar brauzerda saqlanadi (local rejim) — haqiqiy server, bot va
   umumiy baza uchun server/index.js ni Render kabi joyda ishga tushiring. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'vercel-dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    const s = path.join(a, f), d = path.join(b, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
['css', 'js', 'assets'].forEach(d => copyDir(path.join(root, d), path.join(out, d)));
['favicon.ico', 'manifest.webmanifest', 'qissa.html'].forEach(f => { if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f)); });
/* Bulut xotirasi o'rniga faqat brauzer */
const corePath = path.join(out, 'js/core.js');
let core = fs.readFileSync(corePath, 'utf8');
core = core.replace("if (global.claude && typeof global.claude.use === 'function') {", "if (false && global.claude && typeof global.claude.use === 'function') {");
fs.writeFileSync(corePath, core);
/* Bosh sahifa: namoyish belgisi, eski service worker'ni o'chirish */
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!/src="js\/core\.js"/.test(html)) throw new Error('index.html da js/core.js topilmadi — avval node build.js');
/* Ochiq formalar (ariza, izoh, daraja testi) asosiy serverga — ERP ga — boradi.
   Daraja testining javoblar kaliti (levels-local.js) bu nusxaga QO'SHILMAYDI:
   baholash faqat serverda. Asosiy server manzili: SITE_URL (yoki API_BASE).   */
if (!process.env.SITE_URL) process.env.SITE_URL = 'https://hayottalim.uz';
const API_BASE = String(process.env.API_BASE || process.env.SITE_URL).replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(API_BASE)) throw new Error('API_BASE noto‘g‘ri: ' + API_BASE);
html = html.replace('<script src="js/core.js"></script>',
  '<script>window.MARKAZ_DEMO = true; window.MARKAZ_API_BASE = ' + JSON.stringify(API_BASE) + ';</script>\n<script src="js/core.js"></script>');
try { fs.rmSync(path.join(out, 'js/levels-local.js'), { force: true }); } catch (e) { }
fs.writeFileSync(path.join(out, 'index.html'), html);
/* sw.js: o'zini o'chiradigan bo'sh ishchi (keshda eski versiya qolmasin) */
fs.writeFileSync(path.join(out, 'sw.js'), "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));\n");
/* Qidiruv tizimlari: robots.txt, sitemap.xml va tasdiqlash fayllari.
   Serverli versiyada bular serverda tuziladi (server/seo.js) — bu yerda
   aynan o'sha funksiyalar statik saytga fayl qilib yoziladi.           */
const seo = require(path.join(root, 'server/seo.js'));
const host = new URL(process.env.SITE_URL).host;
fs.writeFileSync(path.join(out, 'robots.txt'), seo.robots(host));
fs.writeFileSync(path.join(out, 'sitemap.xml'), seo.sitemap(host));
fs.readdirSync(root).filter(f => /^(google[0-9a-f]{8,32}|yandex_[0-9a-f]{8,32})\.html$/i.test(f))
  .forEach(f => fs.copyFileSync(path.join(root, f), path.join(out, f)));
console.log('vercel-dist tayyor:', fs.readdirSync(out).join(', '));
