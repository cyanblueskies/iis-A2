// The model boundary.
//
// Everything in this file stands in for a language model. It exposes one
// interface, `parseRequest(text, state)`, and returns a *proposal* — never an
// executed action. `engine.js` owns the decision to act (L12: the model
// proposes, the system disposes).
//
// Two adapters implement the interface:
//   - ruleParser    : deterministic rules, used by default, fully offline
//   - remoteAdapter : shape of a real API call, deliberately unimplemented
//
// The proposal is generated text-like output even when it is produced by rules,
// so the rest of the system cannot tell the difference. That is the point of a
// boundary: swap the adapter, keep the checks.

const DAY_WORDS = [
  { re: /\b(monday|mon)\b/, day: 1 },
  { re: /\b(tuesday|tue|tues)\b/, day: 2 },
  { re: /\b(wednesday|wed)\b/, day: 3 },
  { re: /\b(thursday|thu|thur|thurs)\b/, day: 4 },
  { re: /\b(friday|fri)\b/, day: 5 },
];

const PERIODS = [
  { re: /\b(morning|am)\b/, start: 540, label: 'morning' }, // 09:00
  { re: /\b(lunchtime|midday|noon)\b/, start: 720, label: 'midday' }, // 12:00
  { re: /\b(afternoon|pm)\b/, start: 840, label: 'afternoon' }, // 14:00
  { re: /\b(evening|end of day)\b/, start: 1020, label: 'evening' }, // 17:00
];

const STOP = new Set(['the', 'a', 'an', 'to', 'at', 'on', 'my', 'our', 'for', 'and', 'of', 'it', 'me']);

function normalise(text) {
  return text.toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(text) {
  return normalise(text).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
}

function scoreEvent(request, event) {
  const want = tokens(request);
  const title = tokens(event.title);
  let hits = 0;
  for (const w of want) if (title.some((t) => t === w || t.startsWith(w.slice(0, 4)))) hits += 1;
  return hits;
}

function findTime(text) {
  const explicit = normalise(text).match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/);
  if (explicit) {
    let h = Number(explicit[1]);
    const m = Number(explicit[2] || 0);
    const pm = explicit[3] === 'pm';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return { start: h * 60 + m, source: `explicit time "${explicit[0]}"`, label: explicit[0] };
  }
  for (const p of PERIODS) {
    if (p.re.test(normalise(text))) {
      return { start: p.start, source: `period word "${p.label}"`, label: p.label };
    }
  }
  return null;
}

function clock(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Turn a typed request into a proposal, a clarification turn, or a decline.
 * Returns one of:
 *   { status: 'proposal', proposal, trace }
 *   { status: 'clarify', message, hints, trace }
 *   { status: 'decline', message, options, trace }
 */
export function parseRequest(text, state) {
  const raw = String(text || '').trim();
  const trace = [];

  if (!raw) {
    return {
      status: 'decline',
      message: 'I did not catch a request.',
      options: [],
      trace: ['empty request'],
    };
  }

  // 1. Which event? Rule-based matching over titles.
  const ranked = state.events
    .map((ev) => ({ ev, score: scoreEvent(raw, ev) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];

  if (!best || best.score === 0) {
    // No event matched. Decline and hand control back, rather than inventing one.
    trace.push('no event title matched → decline');
    return {
      status: 'decline',
      message: 'I can only move meetings that are already in this calendar. I could not find one that matches that request.',
      options: state.events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        when: `${DAY_LABEL(ev.day)} ${clock(ev.start)}`,
      })),
      trace,
    };
  }

  const event = best.ev;
  trace.push(`event match: "${raw}" → ${event.title} (${DAY_LABEL(event.day)} ${clock(event.start)})`);

  // 2. Which day?
  let day = null;
  for (const d of DAY_WORDS) {
    if (d.re.test(normalise(raw))) {
      day = d.day;
      trace.push(`day match: → ${DAY_LABEL(day)}`);
      break;
    }
  }
  if (day === null) {
    return {
      status: 'clarify',
      message: `I found ${event.title} on ${DAY_LABEL(event.day)} at ${clock(event.start)}. Which day should it move to?`,
      hints: ['Friday morning', 'Tuesday at 2pm'],
      trace: [...trace, 'no day found → clarify'],
    };
  }

  // 3. Which time?
  const time = findTime(raw);
  if (!time) {
    return {
      status: 'clarify',
      message: `I found ${event.title} on ${DAY_LABEL(event.day)} at ${clock(event.start)}. What time on ${DAY_LABEL(day)} should it move to?`,
      hints: ['9am', '2pm', 'afternoon'],
      trace: [...trace, 'no time found → clarify'],
    };
  }
  trace.push(`time match: ${time.source} → ${clock(time.start)}`);

  const duration = event.end - event.start;
  const to = { day, start: time.start, end: time.start + duration };

  // 4. Assumptions: every one becomes a visible line on the card.
  const assumptions = [];
  if (time.source.startsWith('period word')) {
    assumptions.push({
      claim: `Read "${time.label}" as ${clock(time.start)}`,
      source: 'time-of-day default table',
      kind: 'inference',
    });
  }
  assumptions.push({
    claim: `Kept the meeting ${duration} minutes long`,
    source: 'inherited from the existing event',
    kind: 'default',
  });
  assumptions.push({
    claim: `Will update all ${event.people} attendees`,
    source: 'assistant policy: shared events always notify',
    kind: 'side-effect',
  });
  assumptions.push({
    claim: `Day is ${DAY_LABEL(day)} of the current week`,
    source: 'relative-day rule, no year given',
    kind: 'default',
  });

  const proposal = {
    action: 'reschedule',
    eventId: event.id,
    title: event.title,
    from: { day: event.day, start: event.start, end: event.end },
    to,
    attendees: event.people,
    notify: event.shared,
    assumptions,
  };

  return { status: 'proposal', proposal, trace };
}

function DAY_LABEL(day) {
  return { 1: 'Monday 16 Nov', 2: 'Tuesday 17 Nov', 3: 'Wednesday 18 Nov', 4: 'Thursday 19 Nov', 5: 'Friday 20 Nov' }[day] || 'unknown day';
}

// --- Fixed fixtures -------------------------------------------------------
// Replay of recorded adapter output, used by the `?scene=` deep links and by
// the "malformed call" demonstration. Keeping these as data, not logic, makes
// the failure modes reproducible in a way a live model is not (L08, L09).

export const FIXTURES = {
  malformed: {
    action: 'reschedule',
    eventId: 'ev-review',
    // no target: the shape check must catch this before anything runs
    notify: true,
  },
};

/**
 * Draft the message that follows an undo. This is generation, so it belongs to
 * the adapter, not to the engine: the assistant writes, the person sends.
 */
export function composeCorrection(action, seen) {
  const day = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' }[action.to.day];
  const day2 = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' }[action.prev.day];
  const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return {
    subject: `${action.title}: back to ${day2} ${hh(action.prev.start)}`,
    body:
      `${action.title} is back on ${day2} at ${hh(action.prev.start)}. ` +
      `The change to ${day} ${hh(action.to.start)} that I sent earlier is cancelled. ` +
      `Sorry for the noise — you may have already moved things for the new time.`,
    recipients: seen,
  };
}

// A real adapter would live here. Left unimplemented on purpose: the build has
// no network calls, no API key and nothing to leak. The signature is the point.
export const remoteAdapter = {
  available: false,
  async parseRequest() {
    throw new Error('Remote model adapter is not implemented in this build. Use the rule adapter or a fixture.');
  },
};
