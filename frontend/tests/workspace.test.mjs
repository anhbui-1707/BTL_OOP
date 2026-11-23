import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transition, qualityScore, compatibility, acceptanceBlockers, risks } from '../src/features/workspace/model.ts';
import { createDemoWorkspace } from '../src/features/workspace/fixtures.ts';

function selected() { const s = transition(createDemoWorkspace(), { type: 'PUBLISH' }, 'Client'); return transition(s, { type: 'SELECT', id: 'candidate-1' }, 'Client'); }
function active() {
  let s = selected();
  s = transition(s, { type: 'APPROVE_SCOPE', version: 1 }, 'Client');
  return transition(s, { type: 'APPROVE_SCOPE', version: 1 }, 'Freelancer');
}
test('quality requires every mandatory field, invalid budget/deadline do not publish', () => {
  const s = createDemoWorkspace();
  assert.equal(qualityScore(s.job).score, 100);
  assert.equal(qualityScore({ ...s.job, skills: [] }).publishable, false);
  assert.equal(qualityScore({ ...s.job, budget: NaN }).publishable, false);
  assert.equal(qualityScore({ ...s.job, deadline: '2020-01-01' }).publishable, false);
});
test('compatibility is explained, bounded and no reviews earn no reputation score', () => {
  const s = createDemoWorkspace();
  for (const c of s.candidates) { const match = compatibility(s.job, c); assert.ok(match.score >= 0 && match.score <= 100); assert.equal(match.score, match.factors.reduce((n, f) => n + f.earned, 0)); }
  assert.equal(compatibility(s.job, s.candidates[2]).factors.at(-1).earned, 0);
});
test('single freelancer selection and role boundaries', () => {
  const s = selected();
  assert.equal(s.candidates.filter(c => c.status === 'ACCEPTED').length, 1);
  assert.throws(() => transition(s, { type: 'SELECT', id: 'candidate-2' }, 'Client'));
  assert.throws(() => transition(createDemoWorkspace(), { type: 'SELECT', id: 'candidate-1' }, 'Freelancer'));
  assert.throws(() => transition(createDemoWorkspace(), { type: 'SELECT', id: 'candidate-1' }, 'Admin'));
});
test('scope requires same version, both approvals and cannot be edited after lock', () => {
  let s = selected();
  assert.throws(() => transition(s, { type: 'APPROVE_SCOPE', version: 9 }, 'Client'));
  s = transition(s, { type: 'APPROVE_SCOPE', version: 1 }, 'Client');
  assert.equal(s.scope.locked, false);
  s = transition(s, { type: 'SAVE_SCOPE', scope: { ...s.scope, exclusions: 'New exclusions' } }, 'Freelancer');
  assert.equal(s.scope.approvals.length, 0);
  s = active();
  assert.throws(() => transition(s, { type: 'SAVE_SCOPE', scope: s.scope }, 'Client'));
});
test('milestone revision preserves submission history and blocks premature final acceptance', () => {
  let s = active();
  assert.throws(() => transition(s, { type: 'ACCEPT' }, 'Client'));
  assert.throws(() => transition(s, { type: 'REVIEW_MILESTONE', id: 'ms-1', approve: true, note: '' }, 'Client'));
  s = transition(s, { type: 'SUBMIT_MILESTONE', id: 'ms-1', note: 'Demo deliverable first submission' }, 'Freelancer');
  s = transition(s, { type: 'REVIEW_MILESTONE', id: 'ms-1', approve: false, note: 'Please correct the responsive navigation' }, 'Client');
  s = transition(s, { type: 'SUBMIT_MILESTONE', id: 'ms-1', note: 'Demo deliverable revision submission' }, 'Freelancer');
  assert.equal(s.milestones[0].submissions.length, 2);
  assert.equal(s.milestones[0].feedback.length, 1);
});
test('change rejection leaves scope intact, two-party approval versions scope and adds work', () => {
  const initial = active();
  const action = { type: 'CREATE_CHANGE', change: { title: 'Export', reason: 'Additional export requested', deliverable: 'CSV export with tests', budgetDelta: 1000000, daysDelta: 2 } };
  let s = transition(initial, action, 'Client');
  assert.throws(() => transition(s, { type: 'REVIEW_CHANGE', id: 'CR-1', approve: true }, 'Client'));
  const rejected = transition(s, { type: 'REVIEW_CHANGE', id: 'CR-1', approve: false }, 'Freelancer');
  assert.deepEqual(rejected.scope, initial.scope);
  s = transition(s, { type: 'REVIEW_CHANGE', id: 'CR-1', approve: true }, 'Freelancer');
  assert.equal(s.scope.version, 2); assert.equal(s.scope.locked, true);
  assert.equal(s.scopeHistory[0].version, 1); assert.equal(s.milestones.length, 4);
  assert.equal(s.scope.budget, initial.scope.budget + 1000000);
});
test('final acceptance gates exactly one complete 1–5 star review', () => {
  let s = active();
  const review = { overall: 5, quality: 5, timeliness: 4, communication: 5, professionalism: 5, comment: 'Great collaboration' };
  assert.throws(() => transition(s, { type: 'REVIEW', review }, 'Client'));
  for (const m of s.milestones) {
    s = transition(s, { type: 'SUBMIT_MILESTONE', id: m.id, note: 'All deliverables documented and attached' }, 'Freelancer');
    s = transition(s, { type: 'REVIEW_MILESTONE', id: m.id, approve: true, note: '' }, 'Client');
  }
  assert.deepEqual(acceptanceBlockers(s), []);
  s = transition(s, { type: 'ACCEPT' }, 'Client');
  assert.throws(() => transition(s, { type: 'REVIEW', review: { ...review, quality: 0 } }, 'Client'));
  s = transition(s, { type: 'REVIEW', review }, 'Client');
  assert.throws(() => transition(s, { type: 'REVIEW', review }, 'Client'));
});
test('risk rules detect overdue and repeated revisions', () => {
  const s = active(); s.milestones[0].due = '2020-01-01'; s.milestones[0].feedback = ['one', 'two'];
  assert.ok(risks(s).some(r => r.id === 'ms-1-late'));
  assert.ok(risks(s).some(r => r.id === 'ms-1-revision'));
});
