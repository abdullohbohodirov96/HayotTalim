/* Har bir js/*.js ilova fayli artifact.html da ulanganmi? (index.html deployda artifact.html dan yasaladi) */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const art = fs.readFileSync(path.join(root, 'artifact.html'), 'utf8');
const need = ['i18n.js', 'core.js', 'ui.js', 'app.js'];
let bad = need.filter(f => art.indexOf('src="js/' + f + '"') < 0);
if (bad.length) { console.log('✗ artifact.html da yo’q: ' + bad.join(', ')); process.exit(1); }
/* Qolgan har bir js fayl yo artifact.html da, yo core.js dagi kech yuklanadigan to'plamda bo'lsin */
const core = fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8');
const all = fs.readdirSync(path.join(root, 'js')).filter(f => /\.js$/.test(f));
const lost = all.filter(f => art.indexOf('src="js/' + f + '"') < 0 && core.indexOf("'" + f + "'") < 0);
if (lost.length) { console.log('✗ hech qayerda ulanmagan: ' + lost.join(', ')); process.exit(1); }
console.log('✓ HAMMASI O’TDI — ' + all.length + ' ta skript ulangan (asosiy + kech yuklanadigan)');
