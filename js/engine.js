// The engine: a single writer over one state object.
//
// Deliberate boundary: this file never generates language and model.js never
// executes anything. `execute()` is the only function that changes the calendar
// or the notification ledger, and it runs the checks from validate.js first
// (L12: model proposes, system disposes; every action passes complete mediation).

import { ATTENDEES, EVENTS, NOTIFY_TIMELINE, UNDO_WINDOW_MS } from './data.js';
import { parseRequest } from './model.js';
import { validateProposal } from './validate.js';

export function createState(mode = 'confirm') {
  return {
    mode,
    t: 0,
    events: EVENTS.map((ev) => ({ ...ev })),
    turn: { kind: 'idle' },
    proposal: null,
    action: null,
    log: [],
    seq: 0,
  };
}

export function clock(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function stamp(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const DAY_LABEL = {
  1: 'Mon 16 Nov',
  2: 'Tue 17 Nov',
  3: 'Wed 18 Nov',
  4: 'Thu 19 Nov',
  5: 'Fri 20 Nov',
};

export const DAY_NAME = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

function log(state, text, kind = 'info', at = state.t) {
  state.seq += 1;
  state.log.push({ id: state.seq, t: at, text, kind });
}

// ---------------------------------------------------------------------------
// 1. A request arrives. The adapter turns it into a proposal, a clarification
//    or a decline. Nothing is executed here.
// ---------------------------------------------------------------------------
export function submitRequest(state, text) {
  state.proposal = null;
  state.action = null;
  state.request = text;

  log(state, `request: “${text}”`, 'input');
  const out = parseRequest(text, state);

  if (out.status === 'proposal') {
    state.proposal = { ...out.proposal, trace: out.trace };
    state.turn = { kind: 'proposal' };
    log(state, `adapter returned a ${out.proposal.action} proposal for ${out.proposal.title}`, 'model');
    log(state, `${out.proposal.assumptions.length} assumptions recorded (3 silent decisions made visible)`, 'model');
    return;
  }

  if (out.status === 'clarify') {
    state.turn = { kind: 'clarify', message: out.message, hints: out.hints, trace: out.trace };
    log(state, 'adapter returned a clarification turn (repair: clarify)', 'model');
    return;
  }

  state.turn = { kind: 'decline', message: out.message, options: out.options, trace: out.trace };
  log(state, 'adapter declined: no matching event (repair: decline)', 'warn');
}

export function toggleNotify(state) {
  if (!state.proposal) return;
  state.proposal.notify = !state.proposal.notify;
  log(state, `side effect ${state.proposal.notify ? 'enabled' : 'removed'}: notify ${state.proposal.attendees} attendees`, state.proposal.notify ? 'warn' : 'ok');
}

export function discard(state) {
  if (state.proposal) log(state, 'proposal discarded by the person', 'info');
  state.proposal = null;
  state.action = null;
  state.turn = { kind: 'idle' };
}

// ---------------------------------------------------------------------------
// 2. The person (or the oversight rule) decides to act.
// ---------------------------------------------------------------------------
export function execute(state) {
  const proposal = state.proposal;
  if (!proposal) return;

  // An explicitly injected fixture stands in for a malformed adapter reply.
  const verdict = validateProposal(proposal, state);
  for (const c of verdict.checks) {
    log(state, `check ${c.name}: ${c.ok ? 'pass' : 'FAIL'} — ${c.detail}`, c.ok ? 'ok' : 'danger');
  }

  if (!verdict.ok) {
    state.turn = { kind: 'blocked', message: 'The action was stopped before it ran. Nothing changed.', checks: verdict.checks };
    log(state, 'action blocked before execution', 'danger');
    return;
  }

  const event = state.events.find((ev) => ev.id === proposal.eventId);
  const prev = { day: event.day, start: event.start, end: event.end };

  event.day = proposal.to.day;
  event.start = proposal.to.start;
  event.end = proposal.to.end;

  const notified = Boolean(proposal.notify);
  const notifications = ATTENDEES.slice(0, proposal.attendees).map((a) => ({
    id: a.id,
    name: a.name,
    initials: a.initials,
    status: notified ? 'delivered' : 'none',
    openedAt: null,
  }));

  state.action = {
    id: ++state.seq,
    eventId: event.id,
    title: proposal.title,
    prev,
    to: { ...proposal.to },
    appliedAt: state.t,
    notified,
    notifications,
    fired: {},
    revertedAt: null,
  };

  const when = `${DAY_NAME[proposal.to.day]} ${clock(proposal.to.start)}`;
  log(state, `executed: ${proposal.title} → ${when}`, 'action');
  if (notified) {
    log(state, `service wrote to the calendar and sent ${proposal.attendees} updates`, 'warn');
  } else {
    log(state, 'calendar updated, no updates sent (you removed the side effect)', 'ok');
  }

  state.proposal = { ...proposal, executed: true };
  state.turn = { kind: 'done' };
}

// ---------------------------------------------------------------------------
// 3. Time passes. Attendees open the update; that is what undo cannot recall.
// ---------------------------------------------------------------------------
export function tick(state, t) {
  if (!Number.isFinite(t) || t <= state.t) return;
  state.t = t;

  const a = state.action;
  if (!a || a.revertedAt || !a.notified) return;

  for (const step of NOTIFY_TIMELINE) {
    if (step.at > t || a.fired[step.at]) continue;
    a.fired[step.at] = true;
    let left = step.opens;
    for (const note of a.notifications) {
      if (left <= 0) break;
      if (note.status === 'delivered') {
        note.status = 'opened';
        // Recorded at the scheduled moment, not at the moment we caught up:
        // a replay must not claim that three people read it at 00:31.
        note.openedAt = step.at;
        left -= 1;
        log(
          state,
          `${note.name} opened the update and saw ${DAY_NAME[a.to.day]} ${clock(a.to.start)}`,
          'warn',
          step.at,
        );
      }
    }
  }
}

export function undo(state) {
  const a = state.action;
  if (!a || a.revertedAt) return;

  if (state.t - a.appliedAt > UNDO_WINDOW_MS) {
    log(state, 'undo refused: the window has closed', 'danger');
    return;
  }

  const event = state.events.find((ev) => ev.id === a.eventId);
  event.day = a.prev.day;
  event.start = a.prev.start;
  event.end = a.prev.end;

  a.revertedAt = state.t;
  log(state, `undo: ${a.title} restored to ${DAY_NAME[a.prev.day]} ${clock(a.prev.start)}`, 'action');

  if (a.notified) {
    const seen = a.notifications.filter((n) => n.status === 'opened').length;
    const delivered = a.notifications.filter((n) => n.status !== 'none').length;
    log(state, `calendar restored; ${delivered} updates still in inboxes, ${seen} already opened`, seen > 0 ? 'danger' : 'warn');
    if (seen > 0) log(state, `${seen} attendees saw a time that no longer exists — repair is now manual`, 'danger');
  }

  state.proposal = null;
  state.turn = { kind: 'reverted' };
}

export function isUndoOpen(state) {
  const a = state.action;
  return Boolean(a && !a.revertedAt && state.t - a.appliedAt <= UNDO_WINDOW_MS);
}

export function undoRemaining(state) {
  const a = state.action;
  if (!a) return 0;
  return Math.max(0, UNDO_WINDOW_MS - (state.t - a.appliedAt));
}

export function setMode(state, mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  state.proposal = null;
  state.action = null;
  state.turn = { kind: 'idle' };
  log(state, `oversight rule changed to “${mode === 'confirm' ? 'confirm before acting' : 'act, then undo'}” — session reset`, 'info');
}
