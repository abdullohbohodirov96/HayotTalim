/* Botda karta orqali to'lov: summa + karta → «To'ladim» → bank bildirishnomasi
   → avtomatik tasdiq va keyingi to'lov sanasi. Haqiqiy Telegramga ulanmaydi.
     node tests/paybot-test.js                                                  */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'markaz-pay-'));
process.env.DATA_DIR = path.join(tmp, 'data');
delete process.env.TELEGRAM_BOT_TOKEN;

const { createStore } = require('../server/store');
const { A } = require('../server/shared');
const bot = require('../server/bot');
const paybot = require('../server/paybot');

let pass = 0, fail = 0;
const out = [];
function ok(name, cond, extra) {
  if (cond) { pass++; out.push('  ✓ ' + name); }
  else { fail++; out.push('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function section(t) { out.push('\n' + t); }
function stamp() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
const sent = [];
async function fakeSend(chatId, text, kb) { sent.push({ chatId: String(chatId), text: String(text), kb }); return {}; }
const lastTo = id => (sent.filter(m => m.chatId === String(id)).slice(-1)[0] || {});

(async () => {
  const store = createStore();
  /* Soddalashtirilgan to'lov yozuvchisi (serverdagi autoCardPayment o'rnida) */
  let n = 0;
  async function recordPayment(o) {
    const invs = (await store.list('invoices/')).map(x => x.data).filter(i => i.studentId === o.studentId);
    const pays = (await store.list('payments/')).map(x => x.data);
    const paid = A.paidByInvoice(pays);
    let left = o.amount; const allocations = [];
    invs.forEach(i => { const r = A.invoiceRemaining(i, paid); if (left > 0 && r > 0) { const a = Math.min(r, left); allocations.push({ invoiceId: i.id, amount: a }); left -= a; } });
    const id = 'pay_' + o.extId;
    const old = await store.get('payments/' + id); if (old) return old;
    const rec = { id, studentId: o.studentId, amount: o.amount, date: A.today(), month: A.today().slice(0, 7), allocations, receiptNo: 'ALB-T-' + (++n), method: 'karta' };
    await store.set('payments/' + id, rec);
    return rec;
  }
  const B = bot._test({ store, stamp, A, send: fakeSend, recordPayment });

  const today = A.today();
  const plus = d => { const x = new Date(today + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  await store.set('meta/settings', { centerName: 'Sinov', bot: { notify: {}, payCard: '9860 1234 5678 9012', payHolder: 'Markaz Egasi', payBankChat: '-100777', payPreDays: 2 } });
  for (const [sid, chat] of [['s1', 501], ['s2', 502], ['s3', 503]]) {
    await store.set('students/' + sid, { id: sid, firstName: 'O’quvchi', lastName: sid, status: 'faol', telegram: { id: chat } });
    await B.setState(chat, { chatId: String(chat), step: 'linked', studentId: sid });
  }
  /* Ikki o'quvchining oylik to'lovi BIR XIL — 400 000 */
  await store.set('invoices/i1', { id: 'i1', studentId: 's1', month: today.slice(0, 7), final: 400000, dueDate: plus(1) });
  await store.set('invoices/i2', { id: 'i2', studentId: 's2', month: today.slice(0, 7), final: 400000, dueDate: plus(1) });
  await store.set('invoices/i1n', { id: 'i1n', studentId: 's1', month: '2099-01', final: 400000, dueDate: '2099-01-05' });
  const msg = (chat, text) => B.onMessage({ chat: { id: chat, type: 'private' }, from: {}, text });

  section('1. Bildirishnoma matnini o’qish');
  ok('Humo: Пополнение ➕ 400 037.00 UZS', (paybot.parseBank('🟢 Пополнение\n➕ 400 037.00 UZS\n💳 HUMOCARD *9012\n💰 1 250 000.00 UZS') || {}).amount === 400037);
  ok('Uzcard: Perevod na kartu … 400 000,00 UZS', (paybot.parseBank('Perevod na kartu 8600****9012 summa 400 000,00 UZS') || {}).amount === 400000);
  ok('Chiqim (Оплата) e’tiborga olinmaydi', paybot.parseBank('🔴 Оплата\n➖ 35 000.00 UZS\n💳 HUMOCARD *9012') === null);

  section('2. «To’lov qilish» — karta va noyob summa');
  await msg(501, B.PAY_BTN);
  const t1 = lastTo(501).text;
  ok('Karta raqami chiqdi', /9860 1234 5678 9012/.test(t1), t1);
  ok('«To’ladim» tugmasi bor', JSON.stringify(lastTo(501).kb).indexOf(B.PAID_BTN) >= 0);
  await msg(502, B.PAY_BTN);
  const claims = (await paybot.listCol(store, 'payclaim'));
  const c1 = claims.find(c => c.studentId === 's1'), c2 = claims.find(c => c.studentId === 's2');
  ok('Summalar bir xil qarzda ham farq qiladi', c1.amount !== c2.amount && c1.base === 400000, c1.amount + ' / ' + c2.amount);
  ok('Summa qarz + dum (1…99)', c1.amount - 400000 >= 1 && c1.amount - 400000 <= 99);
  await msg(501, B.PAY_BTN);
  ok('Qayta bosilsa o’sha summa', (await paybot.listCol(store, 'payclaim')).filter(c => c.studentId === 's1').length === 1);

  section('3. «To’ladim» → bank xabari → avtomatik tasdiq');
  await msg(501, B.PAID_BTN);
  ok('Tekshirilmoqda deb javob berdi', /tekshirilmoqda/.test(lastTo(501).text));
  const bankText = '🟢 Пополнение\n➕ ' + paybot.fmt(c1.amount) + '.00 UZS\n💳 HUMOCARD *9012';
  ok('Begona kanal e’tiborsiz', (await B.onBankPost({ id: -100999, type: 'channel' }, { text: bankText, message_id: 1 })) === false);
  await B.onBankPost({ id: -100777, type: 'channel' }, { text: bankText, message_id: 10 });
  const done = await store.get('payclaim/' + c1.id);
  ok('Da’vo tasdiqlandi', done.status === 'tasdiqlandi', done.status);
  const pay = await store.get('payments/' + done.paymentId);
  ok('To’lov yozildi va hisobga taqsimlandi', pay && pay.amount === c1.amount && pay.allocations[0].invoiceId === 'i1');
  const conf = lastTo(501).text;
  ok('O’quvchiga «qabul qilindi» xabari', /qabul qilindi/.test(conf), conf);
  ok('Kvitansiya raqami bor', /ALB-T-/.test(conf));
  ok('Keyingi to’lov sanasi aytildi', /Keyingi to’lov|Qolgan qarz/.test(conf), conf);
  await B.onBankPost({ id: -100777, type: 'channel' }, { text: bankText, message_id: 10 });
  ok('Bir xabar ikki marta yozilmaydi', (await store.list('payments/')).length === 1);
  ok('s2 ning da’vosi tegilmadi', (await store.get('payclaim/' + c2.id)).status === 'kutilmoqda');

  section('4. Dumsiz to’lov ham taniladi (faqat bitta mos da’vo bo’lsa)');
  await B.onBankPost({ id: -100777, type: 'channel' }, { text: 'Пополнение ➕ 400 000.00 UZS *9012', message_id: 11 });
  ok('s2 400 000 to’lagan — tasdiqlandi', (await store.get('payclaim/' + c2.id)).status === 'tasdiqlandi');

  section('5. Muddatdan oldin eslatma');
  await store.set('invoices/i3', { id: 'i3', studentId: 's3', month: today.slice(0, 7), final: 350000, dueDate: plus(2) });
  await B.remindDebtors(today);
  const q = (await store.list('botout/')).map(x => x.data).filter(m => m.studentId === 's3');
  ok('s3 ga oldindan eslatma navbatda', q.length === 1 && /To’lov qilish/.test(q[0].text), JSON.stringify(q.map(m => m.text)));
  await B.remindDebtors(today);
  ok('Eslatma takrorlanmaydi', (await store.list('botout/')).map(x => x.data).filter(m => m.studentId === 's3').length === 1);

  console.log(out.join('\n'));
  console.log('\n' + (fail ? '✗ ' + fail + ' ta xato, ' : '✓ HAMMASI O’TDI — ') + pass + ' ta o’tdi');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
