/* Barcha rasm (decode) va ovoz (mp3 sarlavhasi) fayllari serverdan to‘g‘ri berilishi.
   Ishga tushirish: node tests/assets-test.js [port]  (server ishlab turgan bo‘lsin) */
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const B = 'http://localhost:' + process.argv[2];
const root = path.join(__dirname, '..');
const list = [];
(function walk(d) { for (const n of fs.readdirSync(path.join(root, d))) { const r = d + '/' + n; const s = fs.statSync(path.join(root, r)); if (s.isDirectory()) walk(r); else list.push(r); } })('assets');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); await p.goto(B + '/maxfiylik');
  const imgs = list.filter(x => /\.(png|jpe?g|webp|svg|gif)$/i.test(x)), aud = list.filter(x => /\.(mp3|m4a|ogg|wav)$/i.test(x)), vid = list.filter(x => /\.(mp4|webm)$/i.test(x));
  const badImg = await p.evaluate(async urls => { const bad = []; await Promise.all(urls.map(u => new Promise(res => { const i = new Image(); i.onload = () => { if (!i.naturalWidth) bad.push(u); res(); }; i.onerror = () => { bad.push(u); res(); }; i.src = '/' + u; }))); return bad; }, imgs);
  const badAud = await p.evaluate(async urls => { const bad = []; for (let k = 0; k < urls.length; k += 40) { await Promise.all(urls.slice(k, k + 40).map(u => fetch('/' + u).then(async r => { const buf = new Uint8Array(await r.arrayBuffer()); const id3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33, frame = buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0; if (r.status !== 200 || buf.length < 500 || !(id3 || frame)) bad.push(u + ' ' + r.status + ' ' + buf.length); }).catch(() => bad.push(u + ' ERR')))); } return bad; }, aud);
  console.log('rasm:', imgs.length, 'buzuq:', badImg.length, JSON.stringify(badImg.slice(0, 10)));
  console.log('ovoz:', aud.length, 'buzuq:', badAud.length, JSON.stringify(badAud.slice(0, 10)));
  console.log('video:', vid.length);
  console.log((badImg.length + badAud.length) ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI — ' + (imgs.length + aud.length) + ' ta fayl');
  process.exitCode = (badImg.length + badAud.length) ? 1 : 0;
  await b.close();
})();
