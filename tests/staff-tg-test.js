/* Xodimlarning shaxsiy Telegrami: ulash, yangi lead xabari (rollar bo'yicha),
   «✅ Bog'landim», 15 daqiqalik eslatma, vazifa, kunlik hisobot.
   Haqiqiy Telegramga ulanmaydi. node tests/staff-tg-test.js            */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
process.env.DATA_DIR = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stg-')), 'data');
delete process.env.TELEGRAM_BOT_TOKEN;
const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');
const report = require('../server/lead-report');
let pass = 0, fail = 0;
function ok(n, c, x) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + x : '')); } }
function stamp() { return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '); }
const sent = [], calls = [];
(async () => {
  const store = createStore();
  const B = bot._test({
    store, stamp, A,
    send: async (chatId, text, kb, inline) => { sent.push({ chatId: String(chatId), text, kb, inline }); return {}; },
    tg: async (method, params) => { calls.push({ method, params }); return true; }
  });
  await store.set('meta/settings', { bot: { username: 'sabo_bot', staffChats: '' } });
  await store.set('funnels/f1', { id: 'f1', name: 'Asosiy', stages: [{ id: 'yangi', label: 'Yangi' }, { id: 'boglanildi', label: 'Bog‘lanildi' }, { id: 'oquvchi', label: 'O‘quvchi', type: 'won' }] });
  const users = [
    { id: 'u_dir', name: 'Direktor', role: 'direktor', login: 'd' },
    { id: 'u_adm', name: 'Admin Ali', role: 'admin', login: 'a' },
    { id: 'u_man', name: 'Menejer Vali', role: 'menejer', login: 'm', staffId: 'st_m' },
    { id: 'u_teach', name: 'Ustoz', role: 'oqituvchi', login: 't' }
  ];
  for (const u of users) await store.set('users/' + u.id, u);
  const say = async (chatId, text) => {
    sent.length = 0;
    await B.onMessage({ chat: { id: chatId, type: 'private' }, from: { id: chatId, first_name: 'T', username: 'u' + chatId }, text });
    return sent[sent.length - 1] || { text: '' };
  };
  const linkTok = async (uid, exp) => {
    const token = crypto.randomBytes(18).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await store.set('stafflink/' + crypto.createHash('sha256').update(token).digest('hex').slice(0, 40), { userId: uid, exp: exp || Date.now() + 3600e3 });
    return token;
  };

  console.log('\n1. Ulash');
  let r = await say(1001, '/start st_' + await linkTok('u_dir'));
  ok('Direktor ulandi', /ulandi/.test(r.text) && (await store.get('users/u_dir')).telegram.id === '1001', r.text.slice(0, 80));
  await say(1002, '/start st_' + await linkTok('u_adm'));
  await say(1003, '/start st_' + await linkTok('u_man'));
  r = await say(1004, '/start st_' + await linkTok('u_teach'));
  ok('O‘qituvchi ham ulana oladi (lead xabari yo‘q)', /ulandi/.test(r.text) && !/murojaat/.test(r.text.split('\n')[2] || ''), r.text);
  const used = await linkTok('u_adm');
  await say(1009, '/start st_' + used);
  r = await say(1010, '/start st_' + used);
  ok('Havola faqat bir marta ishlaydi', /eskirgan/.test(r.text));
  r = await say(1011, '/start st_' + await linkTok('u_adm', Date.now() - 1000));
  ok('Muddati o‘tgan havola ishlamaydi', /eskirgan/.test(r.text));
  ok('Bitta chat — bitta hisob (1009 → u_adm, 1002 olib tashlanmadi emas)', (await store.get('users/u_adm')).telegram.id === '1009');
  await say(1002, '/start st_' + await linkTok('u_adm'));

  console.log('\n2. Yangi murojaat → rollarga');
  B.dropStaffCache();
  await store.set('leads/L1', { id: 'L1', funnelId: 'f1', name: 'Malika', phone: '+998901112233', stage: 'yangi', source: 'Target (Instagram)', createdAt: stamp() });
  await B.notifyStaff('Yangi murojaat (target)\nIsm: Malika\nTelefon: +998901112233', { leadId: 'L1' });
  let out = (await store.list('botout/')).map(x => x.data);
  const to = out.map(m => m.chatId).sort();
  ok('Direktor, admin, menejerga ketdi; o‘qituvchiga emas', JSON.stringify(to) === JSON.stringify(['1001', '1002', '1003']), JSON.stringify(to));
  ok('«15 daqiqa» (yoki ish vaqtidan tashqari) va «Bog‘landim» tugmasi', /15 daqiqa|Ish vaqtidan tashqari/.test(out[0].text) && out[0].buttons[0][0].callback_data === 'lc:L1');
  ok('Eslatma ro‘yxatiga tushdi', B.pendingLeads.has('L1'));

  console.log('\n3. 15 daqiqalik eslatma');
  for (const m of out) await store.del('botout/' + m.id);
  const p = B.pendingLeads.get('L1');
  const noon = Date.parse('2026-10-26T07:00:00Z');                // 12:00 Toshkent
  p.at = noon - 16 * 60e3; p.last = noon - 16 * 60e3;
  let t = await B.remindTick(noon);
  out = (await store.list('botout/')).map(x => x.data);
  ok('16 daqiqadan keyin eslatma — faqat admin va menejerga (direktorga emas)', t.sent === 2 && out.every(m => m.chatId !== '1001') && /hali bog‘lanilmadi/.test(out[0].text) && /Malika/.test(out[0].text), JSON.stringify(t));
  t = await B.remindTick(noon + 5 * 60e3);
  ok('5 daqiqadan keyin takrorlanmaydi', t.sent === 0);
  t = await B.remindTick(noon + 15 * 60e3);
  ok('Yana 15 daqiqadan keyin — yana eslatma', t.sent === 2, JSON.stringify(t));
  const night = Date.parse('2026-10-26T19:00:00Z');                // 00:00 Toshkent
  p.last = night - 20 * 60e3; p.at = night - 60 * 60e3;
  t = await B.remindTick(night);
  ok('Tunda bezovta qilinmaydi', t.sent === 0 && B.pendingLeads.has('L1'));

  await store.set('leads/L1', Object.assign(await store.get('leads/L1'), { ownerStaffId: 'u_man' }));
  for (const m of (await store.list('botout/')).map(x => x.data)) await store.del('botout/' + m.id);
  p.at = noon - 60 * 60e3; p.last = noon - 20 * 60e3;
  t = await B.remindTick(noon);
  out = (await store.list('botout/')).map(x => x.data);
  ok('Mas’ul tayinlansa — eslatma faqat unga', t.sent === 1 && out[0].chatId === '1003', JSON.stringify(out.map(m => m.chatId)));
  console.log('\n3b. Ish vaqti 9:00–19:00 va ertalabki ro‘yxat');
  for (const m of (await store.list('botout/')).map(x => x.data)) await store.del('botout/' + m.id);
  const eve = Date.parse('2026-10-26T15:30:00Z');                  // 20:30 Toshkent
  p.at = eve - 60 * 60e3; p.last = eve - 20 * 60e3;
  t = await B.remindTick(eve);
  ok('19:00 dan keyin eslatma yo‘q', t.sent === 0);
  await store.set('leads/L9', { id: 'L9', funnelId: 'f1', name: 'Kechki', phone: '+998901234500', stage: 'yangi', source: 'Target (Instagram)', createdAt: stamp() });
  B.trackLead('L9'); B.pendingLeads.get('L9').at = eve; B.pendingLeads.get('L9').last = eve;
  const morning = Date.parse('2026-10-27T04:05:00Z');             // 09:05 Toshkent
  t = await B.remindTick(morning);
  out = (await store.list('botout/')).map(x => x.data);
  const dig = out.filter(m => /Xayrli tong/.test(m.text));
  ok('09:05 — har xodimga bitta umumiy ro‘yxat (admin + menejer), lead-lead emas', dig.length === 2 && out.length === 2 && new Set(dig.map(m => m.chatId)).size === 2 && dig.every(m => m.chatId !== '1001') && /2 ta murojaat/.test(dig[0].text) && /Kechki/.test(dig[0].text), JSON.stringify(out.map(m => m.text.slice(0, 60))));
  ok('Ro‘yxatda «Bog‘landim» tugmalari', dig[0] && dig[0].buttons.length === 2);
  t = await B.remindTick(morning + 5 * 60e3);
  ok('Ro‘yxat qayta ketmaydi, 15 daqiqa ham o‘tmagan', t.sent === 0);
  t = await B.remindTick(morning + 16 * 60e3);
  ok('09:21 — oddiy eslatmalar davom etadi', t.sent >= 1, JSON.stringify(t));
  B.pendingLeads.delete('L9'); await store.del('leads/L9');

  console.log('\n3c. Sinov darsi: 1 soat oldin va darsdan keyin');
  for (const m of (await store.list('botout/')).map(x => x.data)) await store.del('botout/' + m.id);
  await store.set('groups/g1', { id: 'g1', name: 'A0 ayollar', zoomLink: 'https://zoom.us/j/1' });
  const TL = { id: 'T1', funnelId: 'f1', name: 'Sinovchi', phone: '+998901111111', stage: 'sinov', groupId: 'g1', trialDate: '2026-10-28', trialTime: '18:00', createdAt: stamp() };
  await store.set('leads/T1', TL); B.trackTrial(TL);
  const t18 = Date.parse('2026-10-28T13:00:00Z');                  // 18:00 Toshkent
  t = await B.trialTick(t18 - 2 * 3600e3);
  ok('2 soat oldin — hali hech narsa', t.sent === 0);
  t = await B.trialTick(t18 - 50 * 60e3);
  out = (await store.list('botout/')).map(x => x.data);
  ok('1 soat ichida — «mijozga eslatma yuboring» (Zoom havolasi bilan)', t.sent >= 1 && /1 soatdan keyin sinov/.test(out[0].text) && /zoom\.us/.test(out[0].text), JSON.stringify(t));
  t = await B.trialTick(t18 - 40 * 60e3);
  ok('Takrorlanmaydi', t.sent === 0);
  for (const m of out) await store.del('botout/' + m.id);
  t = await B.trialTick(t18 + 60 * 60e3);
  ok('Dars davom etayotganda — xabar yo‘q', t.sent === 0);
  t = await B.trialTick(t18 + 95 * 60e3);
  out = (await store.list('botout/')).map(x => x.data);
  const T1 = await store.get('leads/T1');
  ok('Dars tugagach — «hoziroq qo‘ng‘iroq qiling», keyingi aloqa bugun', t.sent >= 1 && /Sinov darsi tugadi/.test(out[0].text) && T1.nextContact === '2026-10-28' && T1.trialPostAt && !T1.studentId, JSON.stringify(T1));
  t = await B.trialTick(t18 + 120 * 60e3);
  ok('Darsdan keyingi xabar bir marta', t.sent === 0);
  for (const m of out) await store.del('botout/' + m.id);
  await store.del('leads/T1');

  console.log('\n4. «✅ Bog‘landim»');
  await B.onCallback({ id: 'cq1', data: 'lc:L1', from: { id: 1003, first_name: 'V' }, message: { message_id: 5, chat: { id: 1003 } } });
  const L1 = await store.get('leads/L1');
  ok('Lead belgilandi: kim bog‘landi', L1.contactedAt && L1.contactedBy === 'Menejer Vali', JSON.stringify(L1.contactedBy));
  ok('Eslatma to‘xtadi', !B.pendingLeads.has('L1'));
  ok('Tugma yangilandi', calls.some(c => c.method === 'editMessageReplyMarkup'));
  await B.onCallback({ id: 'cq2', data: 'lc:L1', from: { id: 9999 }, message: { message_id: 6, chat: { id: 9999 } } });
  ok('Begona chat bosa olmaydi', calls.some(c => c.method === 'answerCallbackQuery' && /Ruxsat/.test(c.params.text)));

  console.log('\n5. Holat o‘zgarsa ham eslatma to‘xtaydi');
  await store.set('leads/L2', { id: 'L2', funnelId: 'f1', name: 'Ali', phone: '+998935556677', stage: 'yangi', createdAt: stamp() });
  B.trackLead('L2');
  const p2 = B.pendingLeads.get('L2'); p2.last = noon - 20 * 60e3; p2.at = noon - 20 * 60e3;
  await store.set('leads/L2', Object.assign(await store.get('leads/L2'), { stage: 'boglanildi' }));
  t = await B.remindTick(noon);
  ok('Holat «Bog‘lanildi» → eslatma yo‘q', t.sent === 0 && !B.pendingLeads.has('L2'));

  console.log('\n6. Shaxsiy xabar (vazifa)');
  sent.length = 0;
  const nu = await B.notifyUser('u_teach', 'Sizga yangi vazifa: test');
  ok('O‘qituvchiga shaxsiy vazifa xabari', nu.queued === 1);
  const nu2 = await B.notifyUser('u_nobody', 'x');
  ok('Ulanmagan xodim — xabar yo‘q', nu2.notLinked);

  console.log('\n7. Kunlik hisobot');
  await store.set('leads/L3', { id: 'L3', funnelId: 'f1', name: 'Zuhra', phone: '+998977778899', stage: 'oquvchi', note: 'Kechqurungi guruhga yozildi', createdAt: stamp() });
  const txt = await report.buildReport(store);
  ok('Jami 3 ta', /Bugun tushgan murojaatlar: 3 ta/.test(txt), txt.slice(0, 200));
  ok('Bog‘lanildi 3 ta (tugma, holat, o‘quvchi)', /Bog‘lanildi: 3 ta/.test(txt));
  ok('O‘quvchi bo‘ldi 1', /O‘quvchi bo‘ldi: 1 ta/.test(txt));
  ok('Holat bo‘yicha va izoh bor', /Holat bo‘yicha/.test(txt) && /Kechqurungi guruhga/.test(txt));
  ok('Kim bog‘landi', /Menejer Vali: 1/.test(txt));
  ok('Uzun hisobot bo‘linadi', report.splitText('a\n'.repeat(5000), 3500).length > 1);
  r = await say(1003, '/hisobot');
  ok('/hisobot — menejerga darhol', /KUNLIK HISOBOT/.test(sent.map(s => s.text).join('\n')));
  r = await say(4242, '/hisobot');
  ok('Begonaga /hisobot ishlamaydi', !/KUNLIK HISOBOT/.test(sent.map(s => s.text).join('\n')));

  console.log('\n' + pass + ' o‘tdi, ' + fail + ' xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
