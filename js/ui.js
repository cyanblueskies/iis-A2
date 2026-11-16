import { ATTENDEES, DAYS, SAMPLE_REQUESTS, UNDO_WINDOW_MS } from './data.js';
import { DAY_NAME, clock, isUndoOpen, stamp, undoRemaining } from './engine.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const H0 = 480; // 08:00
const H1 = 1080; // 18:00
const PX = 42; // px per hour
const px = (mins) => ((mins - H0) / 60) * PX;

let refs = {};

export function mount(root) {
  root.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <h1>Ask now or undo later?</h1>
      <p>Oversight prototype · simulated calendar, no real invitations</p>
    </div>
    <div class="spacer"></div>
    <div class="rule">
      <span>Oversight rule</span>
      <div class="segmented" id="modes">
        <button data-act="mode" data-mode="confirm">Confirm before acting</button>
        <button data-act="mode" data-mode="undo">Act, then 30 s to undo</button>
      </div>
    </div>
    <div class="session"><span class="dot"></span>session <b id="clock">00:00</b></div>
  </header>

  <div class="layout">
    <section class="card">
      <header>
        <h2>Week of 16 November 2026</h2>
        <span class="hint" id="cal-hint"></span>
      </header>
      <div id="cal"></div>
      <div class="legend">
        <span><i class="sw shared"></i>shared meeting · attendees notified</span>
        <span><i class="sw private"></i>private event</span>
        <span><i class="sw was"></i>where it was before</span>
      </div>
    </section>

    <aside class="card">
      <header>
        <h2>Assistant</h2>
        <span class="hint" id="mode-hint"></span>
      </header>
      <div class="ask">
        <input id="ask-input" placeholder="Ask the assistant to move a meeting…" autocomplete="off" spellcheck="false" />
        <button class="btn primary" data-act="ask">Ask</button>
      </div>
      <div class="chips" id="chips">
        ${SAMPLE_REQUESTS.map(
          (t) => `<button data-act="sample" data-text="${esc(t)}">${esc(t)}</button>`,
        ).join('')}
      </div>
      <div id="assistant-body" class="panel"></div>
      <div class="rulebox" id="rulebox"></div>
    </aside>
  </div>

  <div class="lower">
    <section class="card">
      <header><h2>Notification ledger</h2><span class="hint">what undo cannot recall</span></header>
      <div id="ledger" class="ledger"></div>
    </section>
    <section class="card">
      <header><h2>Audit log</h2><span class="hint">what the system did, in order</span></header>
      <div id="log" class="log"></div>
    </section>
  </div>

  <p class="footnote">
    Prototype for IIS Assignment 2. The calendar, the attendees and the update service are simulated;
    the parser, the five checks and the undo window are real code. Deep links: <code>?scene=undo-reverted</code>.
  </p>`;

  refs = {
    clock: root.querySelector('#clock'),
    modes: root.querySelector('#modes'),
    modeHint: root.querySelector('#mode-hint'),
    cal: root.querySelector('#cal'),
    calHint: root.querySelector('#cal-hint'),
    body: root.querySelector('#assistant-body'),
    rulebox: root.querySelector('#rulebox'),
    ledger: root.querySelector('#ledger'),
    log: root.querySelector('#log'),
    input: root.querySelector('#ask-input'),
  };
  return refs;
}

export function getInput() {
  return refs.input ? refs.input.value : '';
}

export function setInput(text) {
  if (refs.input) refs.input.value = text;
}

export function focusInput() {
  if (refs.input) refs.input.focus();
}

export function update(state) {
  refs.clock.textContent = stamp(state.t);
  for (const b of refs.modes.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.mode === state.mode);
  }
  refs.calHint.textContent = `${state.events.length} events · ${state.events.filter((e) => e.shared).length} shared`;
  refs.modeHint.textContent =
    state.mode === 'confirm' ? 'you review before it runs' : 'it runs, you have 30 s to undo';
  refs.cal.innerHTML = calendar(state);
  refs.body.innerHTML = assistantBody(state);
  refs.rulebox.innerHTML = ruleBox(state);
  refs.ledger.innerHTML = ledger(state);
  refs.log.innerHTML = auditLog(state);
  const scroller = refs.log;
  scroller.scrollTop = scroller.scrollHeight;
}


function ruleBox(state) {
  if (state.mode === 'confirm') {
    return `<b>Rule in force</b>
      The assistant stops after proposing. Nothing changes and no update is sent until you press confirm.
      After that there is no undo in this build, so the check is the only oversight.`;
  }
  return `<b>Rule in force</b>
    The assistant changes the calendar before you see anything, and updates leave at 00:00.
    You have 30 seconds to restore the entry. Updates already opened stay opened.`;
}

// ---------------------------------------------------------------- calendar --
function calendar(state) {
  const a = state.action;
  const moved = a && !a.revertedAt;
  const reverted = a && a.revertedAt;

  const head = `
    <div class="cal-head">
      <div></div>
      ${DAYS.map((d) => `<div class="day"><b>${d.short}</b>${d.label.split(' ').slice(1).join(' ')}</div>`).join('')}
    </div>`;

  const hours = [];
  for (let m = H0; m <= H1; m += 60) {
    hours.push(`<span style="top:${px(m)}px">${clock(m)}</span>`);
  }

  const cols = DAYS.map((d) => {
    const lines = [];
    for (let m = H0; m <= H1; m += 60) lines.push(`<div class="hour" style="top:${px(m)}px"></div>`);

    const blocks = state.events
      .filter((ev) => ev.day === d.key)
      .map((ev) => {
        const top = px(ev.start);
        const height = ((ev.end - ev.start) / 60) * PX - 3;
        const isTarget = a && a.eventId === ev.id;
        const short = height < 34 ? 'short' : '';
        const cls = ['ev', ev.shared ? '' : 'private', isTarget && moved ? 'moved' : '', short].join(' ').trim();
        const tag = isTarget && moved ? `<span class="tag">moved</span>` : '';
        return `<div class="${cls}" style="top:${top}px;height:${height}px">
          <b>${esc(ev.title)}</b>
          <i>${clock(ev.start)}–${clock(ev.end)}${ev.people ? ` · ${ev.people} people` : ''}</i>${tag}
        </div>`;
      })
      .join('');

    let ghost = '';
    if (moved && a.prev.day === d.key) {
      ghost = `<div class="ghost" style="top:${px(a.prev.start)}px;height:${((a.prev.end - a.prev.start) / 60) * PX - 3}px">
        was ${clock(a.prev.start)} · moved out</div>`;
    }
    if (reverted && a.to.day === d.key) {
      ghost = `<div class="ghost" style="top:${px(a.to.start)}px;height:${((a.to.end - a.to.start) / 60) * PX - 3}px">
        undone · was moved here</div>`;
    }

    return `<div class="col">${lines.join('')}${blocks}${ghost}</div>`;
  }).join('');

  return `${head}<div class="cal-body"><div class="gutter">${hours.join('')}</div>${cols}</div>`;
}

// --------------------------------------------------------------- assistant --
function assistantBody(state) {
  const t = state.turn;
  if (t.kind === 'proposal') return proposalCard(state);
  if (t.kind === 'clarify') return clarifyCard(t);
  if (t.kind === 'decline') return declineCard(t);
  if (t.kind === 'blocked') return blockedCard(t);
  if (t.kind === 'done') return doneCard(state);
  if (t.kind === 'reverted') return revertedCard(state);
  return `<div class="turn"><h3>Waiting</h3>Type a request, or pick one of the examples above.
    <ul><li>In “confirm” mode you see the proposal before anything runs.</li>
    <li>In “undo” mode it runs immediately and you get 30 seconds.</li></ul></div>`;
}

function proposalCard(state) {
  const p = state.proposal;
  if (!p) return '';
  const from = `${DAY_LABEL[p.from.day]} · ${clock(p.from.start)}–${clock(p.from.end)}`;
  const to = `${DAY_LABEL[p.to.day]} · ${clock(p.to.start)}–${clock(p.to.end)}`;
  const n = p.assumptions.length;
  const confirmLabel = state.mode === 'confirm' ? 'Confirm and move' : 'Move it now';

  return `
  <div class="prop">
    <div class="prop-hd"><span>Proposed action</span><b>Reschedule</b></div>
    <div class="prop-body">
      <div class="route">
        <span class="slot">${esc(p.title)}</span>
        <span class="arrow">·</span>
        <span class="slot">${from}</span>
      </div>
      <div class="route" style="margin-top:6px">
        <span class="arrow">→</span><span class="to">${to}</span>
      </div>

      <dl class="meta">
        <dt>Object</dt><dd>${esc(p.title)} · ${p.attendees} attendees · shared</dd>
        <dt>Read as</dt><dd>“${esc(state.request || '')}”</dd>
      </dl>

      <label class="side">
        <input type="checkbox" data-act="notify" ${p.notify ? 'checked' : ''} />
        <span>
          <span class="lbl">Send update to ${p.attendees} attendees</span>
          <small>Not requested. The assistant adds it by default for shared events. This is the part that leaves your control.</small>
        </span>
      </label>

      <details class="assump" open>
        <summary>${n} silent decisions, made visible</summary>
        <ol>
          ${p.assumptions
            .map((a) => `<li>${esc(a.claim)} <em>· ${esc(a.source)}</em></li>`)
            .join('')}
        </ol>
      </details>

      <details class="assump">
        <summary>How the request was read</summary>
        <ol>${(p.trace || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </details>

      <div class="actions">
        <button class="btn primary" data-act="confirm">${confirmLabel}</button>
        <button class="btn" data-act="discard">Discard</button>
      </div>
    </div>
  </div>`;
}

const DAY_LABEL = {
  1: 'Mon 16 Nov',
  2: 'Tue 17 Nov',
  3: 'Wed 18 Nov',
  4: 'Thu 19 Nov',
  5: 'Fri 20 Nov',
};

function clarifyCard(t) {
  return `<div class="turn clarify">
    <h3>Needs one thing from you</h3>
    ${esc(t.message)}
    <ul>${(t.hints || []).map((h) => `<li>“${esc(h)}”</li>`).join('')}</ul>
  </div>`;
}

function declineCard(t) {
  return `<div class="turn decline">
    <h3>Declined, control returned</h3>
    ${esc(t.message)}
    <ul>
      ${(t.options || [])
        .map((o) => `<li>${esc(o.title)} — ${esc(o.when)}</li>`)
        .join('')}
    </ul>
  </div>`;
}

function blockedCard(t) {
  return `<div class="turn blocked">
    <h3>Stopped before execution</h3>
    ${esc(t.message)}
    <ul>
      ${(t.checks || [])
        .filter((c) => !c.ok)
        .map((c) => `<li><b>${esc(c.name)}</b>: ${esc(c.detail)}</li>`)
        .join('')}
    </ul>
  </div>`;
}

function doneCard(state) {
  const a = state.action;
  if (!a) return '';
  const when = `${DAY_NAME[a.to.day]} ${clock(a.to.start)}`;
  const rem = undoRemaining(state);
  const pct = Math.max(0, Math.min(100, (rem / UNDO_WINDOW_MS) * 100));
  const open = isUndoOpen(state);

  const bar = state.mode === 'undo'
    ? `<div class="undo ${open ? '' : 'closed'}">
        <div class="row">
          <b>${open ? `${(rem / 1000).toFixed(1)} s` : 'window closed'}</b>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <button class="btn" data-act="undo" ${open ? '' : 'disabled'}>Undo</button>
        </div>
        <small>${
          open
            ? 'Undo restores the calendar entry. It cannot recall updates already opened.'
            : 'After 30 s nothing can be undone in this build.'
        }</small>
      </div>`
    : '';

  return `
  <div class="result">
    <h3>Moved to ${when}</h3>
    <p>${a.notified ? `${a.notifications.length} updates sent at ${stamp(a.appliedAt)}.` : 'No updates were sent.'}</p>
  </div>
  ${bar}
  <details class="assump">
    <summary>What it decided for you</summary>
    <ol>
      ${(a.assumptions || [])
        .map((x) => `<li>${esc(x.claim)} <em>· ${esc(x.source)}</em></li>`)
        .join('')}
    </ol>
  </details>`;
}

function revertedCard(state) {
  const a = state.action;
  const seen = a ? a.notifications.filter((n) => n.status === 'opened').length : 0;
  return `<div class="result bad">
    <h3>Calendar restored at ${stamp(state.t)}</h3>
    <p>${esc(a.title)} is back on ${DAY_NAME[a.prev.day]} at ${clock(a.prev.start)}.</p>
    ${seen > 0 ? `<p>${seen} of ${a.notifications.length} attendees already opened the update and are holding a time that no longer exists.</p>` : ''}
    <div class="line">
      <button class="btn" disabled>Send correction to ${seen}</button>
      <span class="hint">planned, not built</span>
    </div>
  </div>`;
}

// ------------------------------------------------------------------ ledger --
function ledger(state) {
  const notes = state.action ? state.action.notifications : [];
  const reverted = Boolean(state.action && state.action.revertedAt);

  return ATTENDEES.map((p) => {
    const note = notes.find((n) => n.id === p.id);
    if (!note) {
      return `<div class="person">
        <span class="av">${p.initials}</span>
        <span class="who"><b>${esc(p.name)}</b><em>not notified</em></span>
      </div>`;
    }
    if (note.status === 'none') {
      return `<div class="person">
        <span class="av">${p.initials}</span>
        <span class="who"><b>${esc(p.name)}</b><em>no update sent</em></span>
      </div>`;
    }
    if (note.status === 'delivered') {
      return `<div class="person opened">
        <span class="av">${p.initials}</span>
        <span class="who"><b>${esc(p.name)}</b><em>delivered · not opened</em></span>
      </div>`;
    }
    const cls = reverted ? 'seen' : 'opened';
    const label = reverted
      ? `saw ${DAY_NAME[state.action.to.day]} ${clock(state.action.to.start)} · not recalled`
      : `opened at ${stamp(note.openedAt)}`;
    return `<div class="person ${cls}">
      <span class="av">${p.initials}</span>
      <span class="who"><b>${esc(p.name)}</b><em>${label}</em></span>
    </div>`;
  }).join('');
}

// --------------------------------------------------------------------- log --
function auditLog(state) {
  if (!state.log.length) return `<p class="empty">Nothing yet. The log records every check, action and update.</p>`;
  return `<table>${state.log
    .map(
      (l) => `<tr class="${l.kind}">
        <td class="t">${stamp(l.t)}</td>
        <td class="m">${esc(l.text)}</td>
      </tr>`,
    )
    .join('')}</table>`;
}
