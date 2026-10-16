/* Har bir js/*.js ilova fayli artifact.html da ulanganmi? (index.html deployda artifact.html dan yasaladi) */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const art = fs.readFileSync(path.join(root, 'artifact.html'), 'utf8');
const need = ['alifbo.js', 'pages-forms.js', 'kabinet-ui.js', 'pages-lms.js', 'pages-zoom.js'];
let bad = need.filter(f => art.indexOf('src="js/' + f + '"') < 0);
if (bad.length) { console.log('✗ artifact.html da yo’q: ' + bad.join(', ')); process.exit(1); }
console.log('✓ HAMMASI O’TDI — ' + need.length + ' ta skript artifact.html da bor');
