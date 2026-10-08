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
html = html.replace('<script src="js/core.js"></script>', '<script>window.MARKAZ_DEMO = true;</script>\n<script src="js/core.js"></script>');
/* Daraja testi serversiz ham ishlashi uchun (faqat namoyishda) */
if (!/src="js\/app\.js"/.test(html)) throw new Error('index.html da js/app.js topilmadi');
html = html.replace('<script src="js/app.js"></script>', '<script src="js/levels-local.js"></script>\n<script src="js/app.js"></script>');
require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-levels-local.js'), path.join(out, 'js/levels-local.js')], { stdio: 'inherit' });
fs.writeFileSync(path.join(out, 'index.html'), html);
/* sw.js: o'zini o'chiradigan bo'sh ishchi (keshda eski versiya qolmasin) */
fs.writeFileSync(path.join(out, 'sw.js'), "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));\n");
/* Qidiruv tizimlari: robots.txt, sitemap.xml va tasdiqlash fayllari.
   Serverli versiyada bular serverda tuziladi (server/seo.js) — bu yerda
   aynan o'sha funksiyalar statik saytga fayl qilib yoziladi.           */
if (!process.env.SITE_URL) process.env.SITE_URL = 'https://hayottalim.uz';
const seo = require(path.join(root, 'server/seo.js'));
const host = new URL(process.env.SITE_URL).host;
fs.writeFileSync(path.join(out, 'robots.txt'), seo.robots(host));
fs.writeFileSync(path.join(out, 'sitemap.xml'), seo.sitemap(host));
fs.readdirSync(root).filter(f => /^(google[0-9a-f]{8,32}|yandex_[0-9a-f]{8,32})\.html$/i.test(f))
  .forEach(f => fs.copyFileSync(path.join(root, f), path.join(out, f)));
console.log('vercel-dist tayyor:', fs.readdirSync(out).join(', '));
