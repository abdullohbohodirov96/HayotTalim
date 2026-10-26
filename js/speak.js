/* Arabcha ovoz — barcha bo'limlar uchun bitta joy.
   Tartib:
     1) Markaz serverda yaratgan studiya ovozi (ElevenLabs) — matn bo'yicha topiladi;
     2) qurilmaning o'z arabcha ovozi (speechSynthesis).
   Chrome xatolari hisobga olingan: cancel() dan keyin darhol speak() ba'zan
   jim qoladi (biroz kutamiz), utterance yo'qolib qolmasligi uchun havola saqlanadi,
   uzun gapda ovoz to'xtab qolmasligi uchun resume() bilan "uyg'otamiz".
   Qurilmada arabcha ovoz bo'lmasa — bir marta aniq yo'riqnoma ko'rsatiladi.     */
(function (global) {
  'use strict';
  var A = global.A = global.A || {};
  var synth = global.speechSynthesis || null;
  var voices = [];
  var map = {};                 // normallashgan matn → audio manzil
  var current = null;           // hozir chalinayotgan Audio
  var keep = null;              // utterance havolasi (GC dan saqlash)
  var warned = false, warnedClick = false;
  var logs = [];
  function log(what, text) {
    var line = '[Ovoz] ' + what + ' · ' + String(text || '').slice(0, 30) + (keep && keep.voice ? ' · ' + keep.voice.name + ' (' + keep.voice.lang + ')' : '');
    logs.push(line); if (logs.length > 50) logs.shift();
    try { console.info(line); } catch (e) { }
  }

  function norm(t) {
    return String(t || '').replace(/[ً-ٰٟـ]/g, '').replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* Saytga qo'shilgan studiya ovozlari (A1 so'zlari: arabcha + o'zbekcha tarjima).
     Bular server xaritasidan USTUN — darsdagi videodagi ovoz bilan bir xil. */
  function normUz(t) { return String(t || '').toLowerCase().replace(/[’'ʻʼ`‘]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  var W = 'assets/a1/w/';
  var STATIC_AR = {}, STATIC_UZ = {};
  [['اِسْمٌ', 'ar-w0', 'ism', 'uz-ism'], ['أَهْلًا وَسَهْلًا', 'ar-w1', 'xush kelibsiz', 'uz-ahlan'],
   ['مِنْ أَيْنَ أَنْتَ؟', 'ar-w2', 'qayerdansan?', 'uz-minayna'], ['قَطَرُ', 'ar-w3', 'Qatar', 'uz-qatar'],
   ['الدَّوْحَةُ', 'ar-doha', 'Doha', 'uz-doha'], ['مِصْرُ', 'ar-w4', 'Misr', 'uz-misr'],
   ['الْقَاهِرَةُ', 'ar-qohira', 'Qohira', 'uz-qohira'], ['كَمْ عُمْرُكَ؟', 'ar-w5', 'yoshing nechada?', 'uz-kamumr']
  ].forEach(function (r) { STATIC_AR[norm(r[0])] = W + r[1] + '.mp3'; STATIC_UZ[normUz(r[2])] = W + r[3] + '.mp3'; });
  function loadVoices() {
    try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; }
  }
  if (synth) {
    loadVoices();
    try { synth.addEventListener('voiceschanged', loadVoices); } catch (e) { try { synth.onvoiceschanged = loadVoices; } catch (e2) { } }
  }
  function arVoices() { return voices.filter(function (v) { return /^ar/i.test(v.lang); }); }
  /** Ayol ovozini afzal ko'ramiz; who = 'A' | 'B' (qissadagi ikki qahramon) */
  function pickVoice(who) {
    var ar = arVoices();
    if (!ar.length) return null;
    var good = ar.filter(function (v) { return /google|neural|natural|premium|enhanced|siri/i.test(v.name); });
    var fem = ar.filter(function (v) { return /female|zariyah|hoda|salma|laila|layla|amira|mariam|fatima|noura|mouna|sara|zeina/i.test(v.name); });
    var list = fem.length ? fem : (good.length ? good : ar);
    return who === 'B' && list.length > 1 ? list[1] : list[0];
  }

  function help() {
    if (warned) return; warned = true;
    var ua = navigator.userAgent || '';
    var how = /Mac/.test(ua) && !/iPhone|iPad/.test(ua)
      ? 'Mac: Tizim sozlamalari → Universal kirish (Accessibility) → Gapirilgan kontent → Tizim ovozi → «Ovozlarni boshqarish» → Arabic (Majed yoki boshqa) ni yuklab oling va sahifani yangilang.'
      : /iPhone|iPad/.test(ua) ? 'iPhone: Sozlamalar → Universal kirish → Gapirilgan kontent → Ovozlar → Arabcha ovozni yuklab oling.'
        : /Android/.test(ua) ? 'Android: Sozlamalar → Matnni nutqqa aylantirish → Google nutq xizmati → Arab tili ovozini o’rnating.'
          : 'Windows: Sozlamalar → Vaqt va til → Nutq → Ovoz qo’shish → Arabic.';
    var msg = 'Qurilmangizda arabcha ovoz topilmadi. ' + how + ' (Markaz studiya ovozini yoqsa, bu shart emas.)';
    if (A.UI && A.UI.toast) A.UI.toast(msg, 'warn'); else try { alert(msg); } catch (e) { }
  }

  function stop() {
    if (current) { try { current.pause(); } catch (e) { } current = null; }
    if (synth) { try { synth.cancel(); } catch (e) { } }
  }

  /**
   * Matnni o'qish. Promise o'qish tugaganda bajariladi (xatoda ham — dars to'xtab qolmasin).
   * opts: { rate, who: 'A'|'B', url (aniq fayl), onStart }
   */
  function say(text, opts) {
    opts = opts || {};
    var url = opts.url || STATIC_AR[norm(text)] || map[norm(text)] || null;
    var wasBusy = !!current || (synth && (synth.speaking || synth.pending));
    stop();
    if (url) {
      return new Promise(function (resolve) {
        var au = new Audio(url);
        current = au;
        if (opts.rate && opts.rate < 0.8) au.playbackRate = 0.85;
        au.onended = function () { if (current === au) current = null; resolve(true); };
        au.onerror = function () { if (current === au) current = null; viaSynth(text, opts, wasBusy).then(resolve); };
        au.play().then(function () { log('fayl chalindi', text); if (opts.onStart) opts.onStart(); })
          .catch(function () { viaSynth(text, opts, wasBusy).then(resolve); });
      });
    }
    return viaSynth(text, opts, wasBusy);
  }
  function viaSynth(text, opts, wasBusy) {
    return new Promise(function (resolve) {
      if (!synth || typeof global.SpeechSynthesisUtterance === 'undefined') { log('brauzerda ovoz yo’q', text); help(); resolve(false); return; }
      if (!voices.length) loadVoices();
      var v = pickVoice(opts.who);
      if (!v && voices.length) { log('arabcha ovoz yo’q (' + voices.length + ' ta boshqa ovoz)', text); help(); resolve(false); return; }
      var u = new SpeechSynthesisUtterance(text);
      keep = u;
      u.lang = v ? v.lang : 'ar-SA';
      if (v) u.voice = v;
      u.rate = opts.rate || 0.85;
      if (opts.who === 'A') u.pitch = 1.1; else if (opts.who === 'B') u.pitch = 0.95;
      var done = false, timer = null, guard = null;
      function fin(ok) {
        if (done) return; done = true;
        clearInterval(timer); clearTimeout(guard);
        resolve(ok !== false);
      }
      u.onstart = function () { log('boshlandi', text); if (opts.onStart) opts.onStart(); };
      u.onend = function () { log('tugadi', text); fin(true); };
      u.onerror = function (e) {
        var code = e && e.error;
        log('xato: ' + code, text);
        /* Brauzer ruxsat bermadi (sahifada hali bosish bo'lmagan) — keyingi bosishda ishlaydi */
        if (code === 'not-allowed' && A.UI && A.UI.toast && !warnedClick) { warnedClick = true; A.UI.toast('Ovoz uchun sahifani bir marta bosing va qayta urinib ko’ring.', 'warn'); }
        fin(code === 'interrupted' || code === 'canceled');
      };
      var start = function () {
        try { synth.resume(); } catch (e) { }
        try { synth.speak(u); } catch (e) { fin(false); return; }
        /* Chrome uzun matnda ~15 soniyada to'xtab qoladi — vaqti-vaqti bilan uyg'otamiz */
        timer = setInterval(function () { try { if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); } } catch (e) { } }, 10000);
        guard = setTimeout(function () { fin(true); }, 3000 + String(text).length * 260 / (u.rate || 0.85));
      };
      /* cancel() dan keyin darhol speak() — Chrome da jim qoladi; biroz kutamiz */
      if (wasBusy) setTimeout(start, 120); else start();
    });
  }

  /** Server yaratgan studiya ovozlari xaritasini yuklash */
  function loadMap(lessonId) {
    if (!A.Data || A.Data.mode !== 'server' || typeof fetch !== 'function') return Promise.resolve(map);
    return fetch('api/qissa-audio/map' + (lessonId ? '?l=' + encodeURIComponent(lessonId) : ''), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : { items: {} }; })
      .then(function (d) { Object.keys(d.items || {}).forEach(function (k) { map[k] = d.items[k]; }); return map; })
      .catch(function () { return map; });
  }

  /** O'zbekcha tarjimani o'qish (faqat studiya fayli bo'lsa; aks holda jim) */
  function sayUz(text) {
    var url = STATIC_UZ[normUz(text)];
    if (!url) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var au = new Audio(url); current = au;
      au.onended = function () { if (current === au) current = null; resolve(true); };
      au.onerror = function () { resolve(false); };
      au.play().catch(function () { resolve(false); });
    });
  }
  /** Avval arabcha, keyin o'zbekcha (lug'at yodlash) */
  var pairTok = 0;
  function sayPair(ar, uz, opts) {
    var tok = ++pairTok;
    return say(ar, opts).then(function () {
      if (tok !== pairTok || !uz || !STATIC_UZ[normUz(uz)]) return true;
      return new Promise(function (r) { setTimeout(r, 300); }).then(function () { return tok === pairTok ? sayUz(uz) : true; });
    });
  }

  A.Speak = {
    say: say, sayUz: sayUz, sayPair: sayPair, stop: function () { pairTok++; stop(); }, loadMap: loadMap, norm: norm,
    hasUz: function (t) { return !!STATIC_UZ[normUz(t)]; },
    hasStudio: function (t) { return !!(STATIC_AR[norm(t)] || map[norm(t)]); },
    hasArabicVoice: function () { if (!voices.length) loadVoices(); return arVoices().length > 0; },
    voices: function () { return arVoices().map(function (v) { return v.name + ' (' + v.lang + ')'; }); },
    logs: function () { return logs.slice(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
