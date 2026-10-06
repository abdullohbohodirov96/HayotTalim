/* Qissa videodarsini MP4 faylga yozish (Instagram, Telegram uchun).
   Kerak: Node, Playwright (chromium), ffmpeg va ishlab turgan sayt (server).

     node scripts/render-qissa.js --lesson a1-01 --audio-dir assets/audio \
          --base http://localhost:3000 --out qissa-a1-01.mp4 [--size 1280x720]

   Ovoz fayllari: <dars>-<gap>.mp3 (0,1,2…) va so'zlar uchun <dars>-w<k>.mp3.
   Ular ElevenLabs bilan (ERP → Onlayn kurs → «Qissa ovozlari») yoki boshqa
   dasturda tayyorlanadi. Video sahna aynan shu ovozlar davomiyligiga moslanadi. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
}
const LESSON = arg('lesson', 'a1-01');
const AUDIO = path.resolve(arg('audio-dir', 'assets/audio'));
const BASE = arg('base', 'http://localhost:3000').replace(/\/$/, '');
const OUT = path.resolve(arg('out', 'qissa-' + LESSON + '.mp4'));
const [W, H] = arg('size', '1280x720').split('x').map(Number);

function dur(f) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
}

(async () => {
  global.window = undefined;
  const { A } = require('../server/shared');
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'qissa-video.js'), 'utf8'));
  const lesson = A.Course.byId(LESSON);
  if (!lesson) throw new Error('Dars topilmadi: ' + LESSON);
  const sc = A.QissaVideo.scriptFor(lesson);
  const lineFiles = lesson.dialog.lines.map((l, i) => path.join(AUDIO, LESSON + '-' + i + '.mp3'));
  const wordFiles = (sc.recap ? sc.recap.words : []).map((w, k) => path.join(AUDIO, LESSON + '-w' + k + '.mp3'));
  [...lineFiles, ...wordFiles].forEach(f => { if (!fs.existsSync(f)) throw new Error('Ovoz fayli yo’q: ' + f); });
  const lineSecs = lineFiles.map(dur), wordSecs = wordFiles.map(dur);
  const tl = A.QissaVideo.timeline(lesson, lineSecs, wordSecs);

  /* 1) Sahnani yozib olish (ovozsiz) */
  const { chromium } = require('playwright');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qissa-'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(BASE + '/qissa.html?l=' + LESSON + '&render=1');
  await page.waitForFunction(() => typeof window.QV_RENDER === 'function');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(400);
  const lead = (Date.now() - t0) / 1000;           // video boshidagi bo'sh qism
  await page.evaluate(t => { window.__qvDone = false; window.QV_RENDER(t).then(() => { window.__qvDone = true; }); },
    { intro: 2600, lines: lineSecs.map(s => s * 1000), words: wordSecs.map(s => s * 1000) });
  await page.waitForFunction(() => window.__qvDone === true, null, { timeout: (tl.total + 30) * 1000 });
  await page.waitForTimeout(2500);
  const video = page.video();
  await ctx.close(); await browser.close();
  const webm = await video.path();

  /* 2) Ovoz yo'lagini vaqt jadvali bo'yicha yig'ish va birlashtirish */
  const inputs = [], filters = [];
  let n = 0;
  tl.events.forEach(ev => {
    let f = null;
    if (ev.kind === 'line') f = lineFiles[ev.i];
    if (ev.kind === 'word') f = wordFiles[ev.k];
    if (!f) return;
    inputs.push('-i', f);
    const ms = Math.round((ev.t + lead) * 1000);
    filters.push('[' + (n + 1) + ':a]adelay=' + ms + '|' + ms + '[a' + n + ']');
    n++;
  });
  const mix = filters.join(';') + ';' + Array.from({ length: n }, (_, k) => '[a' + k + ']').join('') +
    'amix=inputs=' + n + ':normalize=0[am];[am]apad[aout]';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', webm, ...inputs, '-filter_complex', mix,
    '-map', '0:v', '-map', '[aout]', '-ss', String(Math.max(0, lead - 0.2)),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', '-shortest', OUT], { stdio: 'inherit' });
  console.log('Tayyor: ' + OUT + '  (' + Math.round(tl.total) + ' soniya)');
})().catch(e => { console.error(e.message || e); process.exit(1); });
