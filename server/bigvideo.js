/* Katta dars videosini Telegram guruhiga VIDEO bo'lib yuborish.
   Telegram bot bitta faylda 50 MB gacha qabul qiladi. Zoom yozuvi odatda
   kattaroq — shuning uchun video sifatini buzmasdan (qayta kodlamasdan,
   -c copy) teng bo'laklarga bo'linadi va har biri alohida video bo'lib
   ketadi: «1/5», «2/5»… Bo'lak 50 MB dan oshsa — ko'proq bo'lakka qayta bo'linadi.
   ffmpeg: ffmpeg-static (npm) yoki tizimdagi ffmpeg.                       */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const PART_TARGET = 40 * 1024 * 1024;   // bo'lak maqsadi (kalit kadrlar sabab biroz oshishi mumkin)
const PART_MAX = 49 * 1024 * 1024;      // Telegram chegarasi
const MAX_PARTS = 30;

function ffmpegPath() {
  try { const p = require('ffmpeg-static'); if (p && fs.existsSync(p)) return p; } catch (e) { }
  return 'ffmpeg';
}
function run(bin, args, ms) {
  return new Promise((resolve, reject) => {
    const ch = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ch.stderr.on('data', d => { err += d; if (err.length > 200000) err = err.slice(-100000); });
    const t = setTimeout(() => { try { ch.kill('SIGKILL'); } catch (e) { } }, ms || 20 * 60 * 1000);
    ch.on('error', e => { clearTimeout(t); reject(e); });
    ch.on('close', code => { clearTimeout(t); resolve({ code, err }); });
  });
}
async function available() {
  try { const r = await run(ffmpegPath(), ['-version'], 15000); return r.code === 0; } catch (e) { return false; }
}
function durationOf(stderr) {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr || '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/**
 * url → yuklab olish → bo'lish → har bo'lakni send(buf, i, n) bilan yuborish.
 * @returns {Promise<{parts:number}>}
 */
async function download(url, file, opts) {
  const res = await ((opts && opts.fetch) || fetch)(url);
  if (!res.ok || !res.body) throw new Error('Zoom’dan yuklab bo‘lmadi (HTTP ' + res.status + ')');
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
}
async function splitAndSend(url, send, opts) {
  opts = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoomrec-'));
  const src = path.join(dir, 'in.mp4');
  try {
    await download(url, src, opts);
    return await splitFile(src, dir, send);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }
}
async function splitFile(src, dir, send) {
  {
    const size = fs.statSync(src).size;
    if (size < 1000) throw new Error('Video bo‘sh keldi');
    const ff = ffmpegPath();
    const probe = await run(ff, ['-hide_banner', '-i', src], 60000);
    const dur = durationOf(probe.err);
    if (!dur) throw new Error('Video davomiyligi aniqlanmadi');
    let parts = Math.max(1, Math.ceil(size / PART_TARGET)), files = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      if (parts > MAX_PARTS) throw new Error('Video juda katta (' + Math.round(size / 1048576) + ' MB)');
      fs.readdirSync(dir).filter(f => /^p\d+\.mp4$/.test(f)).forEach(f => fs.unlinkSync(path.join(dir, f)));
      const seg = Math.max(30, Math.ceil(dur / parts));
      /* faststart — Telegram videoni yuklab bo'lmasdan ochib ko'rsata olsin (oqim) */
      const r = await run(ff, ['-hide_banner', '-loglevel', 'error', '-i', src, '-map', '0', '-c', 'copy', '-f', 'segment',
        '-segment_time', String(seg), '-reset_timestamps', '1', '-segment_format_options', 'movflags=+faststart', path.join(dir, 'p%03d.mp4')]);
      if (r.code !== 0) throw new Error('ffmpeg bo‘la olmadi: ' + String(r.err).slice(-300));
      files = fs.readdirSync(dir).filter(f => /^p\d+\.mp4$/.test(f)).sort().map(f => path.join(dir, f));
      if (files.length && files.every(f => fs.statSync(f).size <= PART_MAX)) break;
      parts = Math.ceil(parts * 1.5) + 1; files = [];
    }
    if (!files.length) throw new Error('Bo‘laklar 50 MB dan kichik bo‘lmadi');
    for (let i = 0; i < files.length; i++) {
      const meta = await metaOf(ff, files[i], dir, i);
      await send(fs.readFileSync(files[i]), i + 1, files.length, meta);
    }
    return { parts: files.length };
  }
}

/* ---------- Ustoz yuzi: ekran ustiga, pastki o'ng burchakda, Sabo ramkasida ----------
   Zoom «alohida yozish» sozlamasi yoqilganda: shared_screen (ekran) va active_speaker (ustoz) fayllari.
   Natija: 1280×720, ekran to'liq; o'ng pastda yumaloq burchakli ramka (oltin chegara, yashil fon,
   «SABO ACADEMY» yozuvi) ichida ustozning yuzi. Ovoz — ekran faylidan. */
const FRAME = path.join(__dirname, 'assets', 'face-frame.png');
const MASK = path.join(__dirname, 'assets', 'face-mask.png');
async function composeAndSend(screenUrl, faceUrl, faceOffsetSec, send, opts) {
  opts = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoomcmp-'));
  try {
    const scr = path.join(dir, 'screen.mp4'), face = path.join(dir, 'face.mp4'), out = path.join(dir, 'out.mp4');
    await download(screenUrl, scr, opts);
    await download(faceUrl, face, opts);
    const off = Number(faceOffsetSec) || 0;
    const faceIn = off >= 0 ? ['-itsoffset', String(off), '-i', face] : ['-ss', String(-off), '-i', face];
    /* ramka 336×290, yuz oynasi 312×234 (ramka ichida 12px dan); ekran chetidan 24px */
    const X = 1280 - 336 - 24, Y = 720 - 290 - 24;
    const fc = [
      '[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1a17,setsar=1,fps=20[base]',
      '[1:v]scale=312:234:force_original_aspect_ratio=increase,crop=312:234,format=rgba[f0]',
      '[3:v]format=gray,scale=312:234[m]',
      '[f0][m]alphamerge[fm]',
      '[base][2:v]overlay=' + X + ':' + Y + '[b1]',
      '[b1][fm]overlay=' + (X + 12) + ':' + (Y + 12) + ':eof_action=pass:shortest=0,format=yuv420p[v]'
    ].join(';');
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', scr].concat(faceIn, ['-loop', '1', '-i', FRAME, '-loop', '1', '-i', MASK,
      '-filter_complex', fc, '-map', '[v]', '-map', '0:a?', '-shortest',
      '-c:v', 'libx264', '-preset', opts.preset || 'veryfast', '-crf', '26', '-threads', '2',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
    const r = await run(ffmpegPath(), args, 3 * 60 * 60 * 1000);
    if (r.code !== 0 || !fs.existsSync(out)) throw new Error('Ustoz yuzini qo‘shib bo‘lmadi: ' + String(r.err).slice(-300));
    try { fs.unlinkSync(scr); fs.unlinkSync(face); } catch (e) { }
    return await splitFile(out, dir, send);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
  }
}

/** Telegram uchun: eni, bo'yi, davomiyligi va muqova rasmi — shunda video to'g'ri (yotiq, 16:9) ko'rinadi va darhol ochiladi */
async function metaOf(ff, file, dir, i) {
  const pr = await run(ff, ['-hide_banner', '-i', file], 30000);
  const dur = Math.round(durationOf(pr.err));
  const m = /Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/.exec(pr.err || '');
  const meta = { duration: dur || 0, width: m ? Number(m[1]) : 0, height: m ? Number(m[2]) : 0, thumb: null };
  /* Muqova: boshidagi qora «ism» kadri emas — videoning 1/3 qismidan bitta kadr */
  const at = Math.max(1, Math.min(60, Math.floor((dur || 30) / 3)));
  const jpg = path.join(dir, 't' + i + '.jpg');
  const t = await run(ff, ['-hide_banner', '-loglevel', 'error', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '5', '-y', jpg], 60000).catch(() => null);
  if (t && t.code === 0 && fs.existsSync(jpg) && fs.statSync(jpg).size < 200000) meta.thumb = fs.readFileSync(jpg);
  return meta;
}

module.exports = { composeAndSend, splitFile, metaOf, splitAndSend, available, ffmpegPath, durationOf };
