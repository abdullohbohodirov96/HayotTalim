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
fs.writeFileSync(path.join(out, 'index.html'), html);
/* sw.js: o'zini o'chiradigan bo'sh ishchi (keshda eski versiya qolmasin) */
fs.writeFileSync(path.join(out, 'sw.js'), "self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));\n");
console.log('vercel-dist tayyor:', fs.readdirSync(out).join(', '));
