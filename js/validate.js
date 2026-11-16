// Five checks before any action runs (L12). Each returns {name, ok, detail}.
// The proposal is treated as untrusted text: it may be well-formed and still
// describe something the system must not do.

export function validateProposal(proposal, state) {
  const checks = [];

  // 1. Shape: every field the executor needs is present and of the right type.
  const shape =
    proposal &&
    proposal.action === 'reschedule' &&
    typeof proposal.eventId === 'string' &&
    proposal.to &&
    Number.isFinite(proposal.to.day) &&
    Number.isFinite(proposal.to.start) &&
    Number.isFinite(proposal.to.end);
  checks.push({
    name: 'shape',
    ok: Boolean(shape),
    detail: shape
      ? 'action, target object and new time all present'
      : 'the call is missing a target object or a new time',
  });
  if (!shape) return { ok: false, checks };

  // 2. Permission: the person may act on this object.
  const event = state.events.find((ev) => ev.id === proposal.eventId);
  checks.push({
    name: 'permission',
    ok: Boolean(event && event.owner === 'you'),
    detail: event ? `${event.title} is owned by you` : 'no such event in this calendar',
  });

  // 3. Precondition: the action still makes sense against current state.
  const target = proposal.to;
  const clash = state.events.find(
    (ev) => ev.id !== proposal.eventId && ev.day === target.day && ev.start < target.end && target.start < ev.end,
  );
  const sameSlot =
    event && event.day === target.day && event.start === target.start && event.end === target.end;
  checks.push({
    name: 'precondition',
    ok: Boolean(event) && !sameSlot && !clash,
    detail: !event
      ? 'object no longer exists'
      : sameSlot
        ? 'already in that slot'
        : clash
          ? `clashes with ${clash.title}`
          : 'slot is free and the action is not a no-op',
  });

  // 4. Confirmation: an audit line rather than a gate, because the person has
  //    already acted by the time this runs. It records whether review happened
  //    before the outward effect, which is what the oversight rule decides.
  checks.push({
    name: 'confirmation',
    ok: true,
    detail:
      state.mode === 'confirm'
        ? 'person reviewed the proposal before it ran'
        : proposal.notify
          ? 'bypassed by the oversight rule — updates leave before anyone reviews'
          : 'no outward effect, so no confirmation was required',
  });

  // 5. Idempotency: a repeated identical call must be harmless.
  const repeated =
    state.action &&
    !state.action.revertedAt &&
    state.action.eventId === proposal.eventId &&
    state.action.to.day === target.day &&
    state.action.to.start === target.start;
  checks.push({
    name: 'idempotency',
    ok: !repeated,
    detail: repeated ? 'this exact move has already run' : 'first request for this slot',
  });

  return { ok: checks.every((c) => c.ok), checks };
}
