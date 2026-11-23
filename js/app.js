import { SAMPLE_REQUESTS } from './data.js';
import { createState, discard, draftCorrection, dropCorrection, execute, sendCorrection, setMode, submitRequest, tick, toggleNotify, undo } from './engine.js';
import { FIXTURES } from './model.js';
import { focusInput, getInput, mount, setInput, update } from './ui.js';

const root = document.getElementById('app');
mount(root);

const state = createState('confirm');
let frozen = false;
let ticking = false;

function draw() {
  update(state);
}

// A ?scene= page is a frozen snapshot: deterministic, no timers. The moment the
// person starts something new, the snapshot is over, so take over with a clean
// session — otherwise the clock keeps returning early and the countdown sits still.
function takeOver() {
  if (!frozen) return;
  frozen = false;
  Object.assign(state, createState(state.mode));
  if (location.search) history.replaceState(null, '', location.pathname);
  setInput('');
}

function submit(target, text) {
  target.request = text;
  submitRequest(target, text);
}

function ask(text) {
  const value = (text ?? getInput()).trim();
  if (!value) return;

  takeOver();
  setInput(value);
  submitRequest(state, value);

  // The oversight rule decides whether a proposal is ever shown before it runs.
  if (state.mode === 'undo' && state.turn.kind === 'proposal') {
    execute(state);
  }

  draw();
  ensureClock();

  // Keyboard path: the next decision is the action, so it takes focus.
  const primary = document.querySelector('[data-act="confirm"]');
  if (primary) primary.focus();
  else focusInput();
}

function ensureClock() {
  if (ticking) return;
  ticking = true;
  setInterval(() => {
    if (frozen) return;
    if (!state.action || state.action.revertedAt) return;
    if (state.t - state.action.appliedAt > 35000) return;
    tick(state, state.t + 100);
    draw();
  }, 100);
}

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'mode') {
    takeOver();
    setMode(state, el.dataset.mode);
    draw();
    return;
  }
  if (act === 'sample') {
    takeOver();
    setInput(el.dataset.text);
    ask(el.dataset.text);
    return;
  }
  if (act === 'ask') {
    ask();
    return;
  }
  if (act === 'confirm') {
    execute(state);
    draw();
    ensureClock();
    return;
  }
  if (act === 'discard') {
    discard(state);
    draw();
    return;
  }
  if (act === 'undo') {
    undo(state);
    draw();
    return;
  }
  if (act === 'draft-correction') {
    draftCorrection(state);
    draw();
    return;
  }
  if (act === 'send-correction') {
    sendCorrection(state);
    draw();
    return;
  }
  if (act === 'drop-correction') {
    dropCorrection(state);
    draw();
  }
});

document.addEventListener('change', (event) => {
  if (event.target.matches('[data-act="notify"]')) {
    toggleNotify(state);
    draw();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.id === 'ask-input') {
    event.preventDefault();
    ask();
    return;
  }
  if (event.key === 'Escape') {
    // Escape backs out of whatever the person has open, without touching the calendar.
    if (state.action && state.action.correction && !state.action.correction.sentAt) {
      dropCorrection(state);
      draw();
      return;
    }
    if (state.proposal && !state.action) {
      discard(state);
      draw();
      focusInput();
    }
  }
});

// ---------------------------------------------------------------- deep links
// Deterministic replay of a state, for screenshots, review and testing.
// `?scene=undo-reverted` reconstructs the moment without waiting 12 seconds.
const SCENES = {
  'confirm-proposal': {
    mode: 'confirm',
    run: (s) => submit(s, SAMPLE_REQUESTS[0]),
  },
  'confirm-done': {
    mode: 'confirm',
    run: (s) => {
      submit(s, SAMPLE_REQUESTS[0]);
      execute(s);
      tick(s, 6000);
    },
  },
  'undo-window': {
    mode: 'undo',
    run: (s) => {
      submit(s, SAMPLE_REQUESTS[0]);
      execute(s);
      tick(s, 6000);
    },
  },
  'undo-reverted': {
    mode: 'undo',
    run: (s) => {
      submit(s, SAMPLE_REQUESTS[0]);
      execute(s);
      tick(s, 12000);
      undo(s);
    },
  },
  'undo-corrected': {
    mode: 'undo',
    run: (s) => {
      submit(s, SAMPLE_REQUESTS[0]);
      execute(s);
      tick(s, 12000);
      undo(s);
      draftCorrection(s);
      sendCorrection(s);
    },
  },
  'undo-draft': {
    mode: 'undo',
    run: (s) => {
      submit(s, SAMPLE_REQUESTS[0]);
      execute(s);
      tick(s, 12000);
      undo(s);
      draftCorrection(s);
    },
  },
  'confirm-sprint': {
    mode: 'confirm',
    run: (s) => submit(s, 'Move the sprint planning to Wednesday afternoon'),
  },
  'undo-expired': {
    mode: 'undo',
    run: (s) => {
      submit(s, SAMPLE_REQUESTS[0]);
      execute(s);
      tick(s, 31000);
    },
  },
  clarify: {
    mode: 'confirm',
    run: (s) => submit(s, 'Move the project review'),
  },
  decline: {
    mode: 'confirm',
    run: (s) => submit(s, 'Book me a flight to Berlin on Friday'),
  },
  blocked: {
    mode: 'undo',
    run: (s) => {
      s.proposal = { ...FIXTURES.malformed, trace: ['replay fixture: adapter reply truncated after the object'] };
      s.turn = { kind: 'proposal' };
      execute(s);
    },
  },
};

const params = new URLSearchParams(location.search);
const scene = params.get('scene');

if (scene && SCENES[scene]) {
  frozen = true;
  const spec = SCENES[scene];
  state.mode = spec.mode;
  spec.run(state);
  if (state.request) setInput(state.request);
}

draw();

// Inspection hook: the console can read and re-render the state without a rebuild.
window.__proto = {
  state,
  render: draw,
  tick: (ms) => {
    tick(state, ms);
    draw();
  },
};
