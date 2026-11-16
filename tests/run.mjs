// Headless checks for the engine, the checks and the repair turns.
// Run with: node tests/run.mjs
//
// These are the fixed cases the report mentions: the same inputs, the same
// expectations, run after every change. They cover logic only — the interface
// is checked by loading each ?scene= link.

import assert from 'node:assert/strict';
import { createState, draftCorrection, dropCorrection, execute, isUndoOpen, sendCorrection, submitRequest, tick, undo } from '../js/engine.js';
import { FIXTURES } from '../js/model.js';

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok    ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

const REQUEST = 'Move the project review to Friday morning';
const review = (s) => s.events.find((e) => e.id === 'ev-review');

test('a request becomes a proposal, not an action', () => {
  const s = createState('confirm');
  submitRequest(s, REQUEST);
  assert.equal(s.turn.kind, 'proposal');
  assert.equal(s.action, null, 'nothing may run before the person confirms');
  assert.equal(review(s).day, 4, 'the event has not moved yet');
});

test('the proposal carries its assumptions and its trace', () => {
  const s = createState('confirm');
  submitRequest(s, REQUEST);
  assert.equal(s.proposal.to.start, 540, '"morning" should read as 09:00');
  assert.equal(s.proposal.notify, true, 'shared events notify by default');
  assert.equal(s.proposal.assumptions.length, 4);
  assert.ok(s.proposal.trace.length >= 3, 'the trace should show how it was read');
});

test('executing moves the event and notifies six attendees', () => {
  const s = createState('confirm');
  submitRequest(s, REQUEST);
  execute(s);
  assert.equal(review(s).day, 5);
  assert.equal(review(s).start, 540);
  assert.equal(s.action.notifications.length, 6);
  assert.ok(s.action.notifications.every((n) => n.status === 'delivered'));
});

test('confirm mode leaves no undo window', () => {
  const s = createState('confirm');
  submitRequest(s, REQUEST);
  execute(s);
  assert.equal(isUndoOpen(s), false);
});

test('undo restores the slot but cannot recall the ledger', () => {
  const s = createState('undo');
  submitRequest(s, REQUEST);
  execute(s);
  tick(s, 12000);
  const openedBefore = s.action.notifications.filter((n) => n.status === 'opened').length;
  assert.equal(openedBefore, 3, 'two opens are scheduled before twelve seconds');
  undo(s);
  assert.equal(review(s).day, 4, 'the calendar entry is back');
  assert.equal(review(s).start, 600);
  const openedAfter = s.action.notifications.filter((n) => n.status === 'opened').length;
  assert.equal(openedAfter, 3, 'undo must not erase what was already read');
});

test('undo is refused once the window closes', () => {
  const s = createState('undo');
  submitRequest(s, REQUEST);
  execute(s);
  tick(s, 31000);
  undo(s);
  assert.equal(s.action.revertedAt, null);
  assert.equal(review(s).day, 5, 'the move stands');
});

test('a malformed call is stopped before it runs', () => {
  const s = createState('undo');
  s.proposal = { ...FIXTURES.malformed };
  execute(s);
  assert.equal(s.action, null);
  assert.equal(s.turn.kind, 'blocked');
});

test('a second identical move is blocked as a no-op', () => {
  const s = createState('confirm');
  submitRequest(s, REQUEST);
  execute(s);
  submitRequest(s, REQUEST);
  execute(s);
  assert.equal(s.turn.kind, 'blocked');
});

test('a request with no day asks instead of guessing', () => {
  const s = createState('confirm');
  submitRequest(s, 'Move the project review');
  assert.equal(s.turn.kind, 'clarify');
  assert.equal(s.proposal, null);
});

test('an unknown object is declined and control is returned', () => {
  const s = createState('confirm');
  submitRequest(s, 'Book me a flight to Berlin on Friday');
  assert.equal(s.turn.kind, 'decline');
  assert.equal(s.turn.options.length, s.events.length);
});

test('the action keeps the assumptions for the result card', () => {
  const s = createState('confirm');
  submitRequest(s, REQUEST);
  const proposed = JSON.parse(JSON.stringify(s.proposal.assumptions));
  execute(s);
  assert.deepEqual(s.action.assumptions, proposed, 'the result card must not hard-code them');
});

test('a different time changes the assumption text', () => {
  const s = createState('confirm');
  submitRequest(s, 'Push the project review to Friday at 2pm');
  assert.equal(s.proposal.to.start, 840);
  assert.ok(
    !s.proposal.assumptions.some((a) => a.claim.includes('morning')),
    'no assumption should mention a period word that was not used',
  );
});

test('a correction cannot be drafted before an undo', () => {
  const s = createState('undo');
  submitRequest(s, REQUEST);
  execute(s);
  tick(s, 12000);
  draftCorrection(s);
  assert.equal(s.action.correction, undefined);
});

test('a correction needs someone to have read the update', () => {
  const s = createState('undo');
  submitRequest(s, REQUEST);
  execute(s);
  tick(s, 1000);
  undo(s);
  draftCorrection(s);
  assert.equal(s.action.correction, undefined, 'nobody opened it, so there is nothing to repair');
});

test('the adapter drafts the correction and the person has not sent it', () => {
  const s = createState('undo');
  submitRequest(s, REQUEST);
  execute(s);
  tick(s, 12000);
  undo(s);
  draftCorrection(s);
  assert.equal(s.action.correction.recipients, 3);
  assert.equal(s.action.correction.sentAt, null);
  assert.ok(s.action.correction.body.includes('Thursday at 10:00'), 'the draft names the restored slot');
  const opened = s.action.notifications.filter((n) => n.status === 'opened').length;
  assert.equal(opened, 3, 'drafting changes nothing on the other side');
});

test('sending marks the recipients and cannot be repeated', () => {
  const s = createState('undo');
  submitRequest(s, REQUEST);
  execute(s);
  tick(s, 12000);
  undo(s);
  draftCorrection(s);
  sendCorrection(s);
  const corrected = s.action.notifications.filter((n) => n.status === 'corrected').length;
  assert.equal(corrected, 3);
  const sentAt = s.action.correction.sentAt;
  sendCorrection(s);
  assert.equal(s.action.correction.sentAt, sentAt, 'a second send is a no-op');
});

test('a draft can be discarded without sending', () => {
  const s = createState('undo');
  submitRequest(s, REQUEST);
  execute(s);
  tick(s, 12000);
  undo(s);
  draftCorrection(s);
  dropCorrection(s);
  assert.equal(s.action.correction, null);
  assert.equal(s.action.notifications.filter((n) => n.status === 'corrected').length, 0);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
