/* Maxfiylik: ota-ona kabineti bolaning kirish kodini ko'rsatmaydi;
   o'qituvchiga faqat o'z guruhi ma'lumotlari ketadi (visibleData).
   Serversiz:  node tests/maxfiylik-test.js                              */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.DATA_DIR = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'maxf-')), 'data');
const { createStore } = require('../server/store');
const { visibleData, teacherCanSee } = require('../server/shared');
const parents = require('../server/parents');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } };
(async () => {
  const store = createStore();
  await store.set('students/s1', { id: 's1', firstName: 'Ali', lastName: 'A', code: '55101', status: 'faol' });
  const par = { id: 'p1', name: 'Ota', code: '777777', studentIds: ['s1'] };
  const sum = await parents.summary(store, par, null);
  ok('Ota-ona kabinetida bolaning kodi yo‘q', JSON.stringify(sum).indexOf('55101') < 0, JSON.stringify(sum.children[0].student));
  ok('Bolaning ismi bor', sum.children[0].student.firstName === 'Ali');

  const all = [
    { path: 'groups/g1', data: { id: 'g1', teacherId: 'stf1' } },
    { path: 'groups/g2', data: { id: 'g2', teacherId: 'stf2' } },
    { path: 'memberships/m1', data: { id: 'm1', studentId: 's1', groupId: 'g1' } },
    { path: 'memberships/m2', data: { id: 'm2', studentId: 's2', groupId: 'g2' } },
    { path: 'students/s1', data: { id: 's1', code: '55101', firstName: 'A' } },
    { path: 'students/s2', data: { id: 's2', code: '55102', firstName: 'B' } },
    { path: 'parents/p1', data: { id: 'p1', code: '777777', studentIds: ['s1'] } },
    { path: 'quizres/q1', data: { id: 'q1', studentId: 's1', groupId: 'g1' } },
    { path: 'quizres/q2', data: { id: 'q2', studentId: 's2', groupId: 'g2' } },
    { path: 'asks/a2', data: { id: 'a2', studentId: 's2' } },
    { path: 'pauses/pa2', data: { id: 'pa2', studentId: 's2' } },
    { path: 'makeups/mk2', data: { id: 'mk2', studentId: 's2', groupId: 'g2', teacherId: 'stf2' } },
    { path: 'feedback/f2', data: { id: 'f2', groupId: 'g2' } },
    { path: 'lessonlog/g2__2026-10-01', data: { groupId: 'g2', key: 'g2__2026-10-01' } },
    { path: 'lessonlog/g1__2026-10-01', data: { groupId: 'g1', key: 'g1__2026-10-01' } },
    { path: 'files/f_s2', data: { id: 'f_s2', refPath: 'students/s2', by: 's2' } },
    { path: 'files/f_s1', data: { id: 'f_s1', refPath: 'students/s1', by: 's1' } }
  ];
  const teacher = { id: 'u1', role: 'oqituvchi', staffId: 'stf1' };
  const v = visibleData(teacher, all);
  const txt = JSON.stringify(v);
  ok('O‘qituvchiga ota-ona yozuvi yo‘q', !v.col.parents);
  ok('O‘qituvchiga o‘quvchi kodlari yo‘q', txt.indexOf('55101') < 0 && txt.indexOf('55102') < 0);
  ok('Begona quizres yo‘q, o‘ziniki bor', v.col.quizres && v.col.quizres.q1 && !v.col.quizres.q2);
  ok('Begona asks/pauses/makeups/feedback yo‘q', !(v.col.asks || {}).a2 && !(v.col.pauses || {}).pa2 && !(v.col.makeups || {}).mk2 && !(v.col.feedback || {}).f2);
  ok('Begona dars jurnali yo‘q, o‘ziniki bor', !(v.col.lessonlog || {})['g2__2026-10-01'] && (v.col.lessonlog || {})['g1__2026-10-01']);
  ok('Begona o‘quvchi fayli yo‘q, o‘zinikisi bor', !(v.col.files || {}).f_s2 && (v.col.files || {}).f_s1);
  const admin = { id: 'u2', role: 'direktor' };
  const va = visibleData(admin, all);
  ok('Direktor hammasini ko‘radi (ota-ona kodi bilan)', va.col.parents && va.col.parents.p1 && va.col.quizres.q2);
  ok('teacherCanSee: parents doim yo‘q', teacherCanSee('parents', { id: 'x' }, { gid: {}, sid: {} }) === false);
  const vm = visibleData(admin, [
    { path: 'meta/settings', data: { centerName: 'X', bot: { token: '1:SECRET' } } },
    { path: 'meta/autoinvoice', data: { lastRun: '2026-10' } },
    { path: 'meta/backupstate', data: { last: 'x' } }]);
  ok('meta/autoinvoice va meta/backupstate mijozga ketmaydi', !Object.keys(vm.docs || {}).some(k => k.indexOf('meta/') === 0), JSON.stringify(vm.docs));
  ok('Sozlamalardagi bot tokeni olib tashlanadi', vm.settings && vm.settings.centerName === 'X' && !(vm.settings.bot || {}).token);
  console.log('\n' + (fail ? '✗ XATOLAR BOR' : '✓ HAMMASI O’TDI') + ' — ' + pass + " ta o'tdi, " + fail + ' ta xato');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
