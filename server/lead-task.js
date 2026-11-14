'use strict';
/**
 * Murojaatga «Keyingi bog'lanish» qo'yilsa — o'sha xodimga VAZIFA bo'lib saqlanadi
 * (tasks/tsk_lead_<id>), «Vazifalarim» bo'limida chiqadi. Kun/vaqt o'zgarsa — vazifa yangilanadi;
 * murojaat yopilsa (o'quvchi bo'ldi / rad etdi) yoki sana olib tashlansa — vazifa «bajarildi» bo'ladi.
 */
function closedStage(A, funnels, lead) {
  const fn = (funnels || []).filter(f => f.id === (lead.funnelId || 'fnl_asosiy'))[0] || (A.DEFAULT_FUNNELS || [])[0];
  const st = fn && A.stageOf ? A.stageOf(fn, lead.stage) : null;
  return !!(st && (st.type === 'won' || st.type === 'lost'));
}

async function sync(store, A, lead, user, stamp) {
  if (!lead || !lead.id) return null;
  const id = 'tsk_lead_' + lead.id;
  const old = await store.get('tasks/' + id);
  const funnels = (await store.list('funnels/')).map(x => x.data).filter(Boolean);
  const closed = closedStage(A, funnels, lead);
  const now = stamp();
  if (!lead.nextContact || closed) {
    if (old && old.status !== 'bajarildi') {
      await store.set('tasks/' + id, Object.assign({}, old, { status: 'bajarildi', doneAt: now, updatedAt: now,
        doneNote: closed ? 'Murojaat yopildi' : 'Qayta aloqa sanasi olib tashlandi' }));
    }
    return null;
  }
  const users = (await store.list('users/')).map(x => x.data).filter(u => u && u.active !== false);
  const owner = lead.ownerStaffId ? users.filter(u => u.id === lead.ownerStaffId || (u.staffId && u.staffId === lead.ownerStaffId))[0] : null;
  const assigneeId = owner ? owner.id : (lead.remById || (old && old.assigneeId) || user.id);
  const due = String(lead.nextContact).slice(0, 10), dueTime = lead.nextContactTime || '';
  const changed = !old || old.due !== due || (old.dueTime || '') !== dueTime || old.assigneeId !== assigneeId;
  const lastNote = String(lead.note || '').split('\n').pop().slice(0, 300);
  const rec = Object.assign({}, old || {}, {
    id, title: '📞 Qayta aloqa: ' + (lead.name || 'murojaat'),
    description: [lead.phone ? 'Telefon: ' + lead.phone : '', lastNote ? 'Oxirgi izoh: ' + lastNote : ''].filter(Boolean).join('\n'),
    assigneeId, createdById: (old && old.createdById) || user.id,
    due, dueTime, leadId: lead.id, kind: 'lead', auto: true,
    status: changed ? 'yangi' : (old.status === 'bajarildi' ? 'yangi' : old.status),
    updatedAt: now
  });
  if (!old) rec.createdAt = now;
  if (rec.status !== 'bajarildi') { delete rec.doneAt; delete rec.doneNote; }
  const same = old && JSON.stringify(Object.assign({}, old, { updatedAt: '' })) === JSON.stringify(Object.assign({}, rec, { updatedAt: '' }));
  if (!same) await store.set('tasks/' + id, rec);
  return rec;
}
module.exports = { sync };
