# Ask now or undo later?

Prototype for IIS Assignment 2: an AI calendar assistant that reschedules a shared meeting under
two oversight rules, built so that the social cost of a post-action undo is observable rather
than asserted.

It continues Assignment 1's question — whether undo can carry the oversight that asking first
carries, when the change is visible to colleagues — by instantiating both rules on one task
instead of measuring the difference.

**README prose word count: 940 words** (code, commands and file names excluded).
**Submitted release:** `v1.0` — tagged on this commit (see Releases).

## Status

Working prototype. One chain, done end to end: request → proposal → five checks → action →
update ledger → confirmation or undo. The same task runs under both rules, switchable top right.

- **Confirm before acting.** Nothing changes until the person confirms; after that there is no undo.
- **Act, then 30 s to undo.** The change and six updates go out at once; thirty seconds to restore.

*Implemented:* parser and three repair turns, proposal with its assumption list, five pre-action
checks, execution on a simulated calendar, notification ledger, undo window, audit log, and
deterministic `?scene=` replay. *Simulated:* the calendar service, the six attendees, update
delivery and the model (a rule adapter behind the interface a real call would use). *Not built:*
calendar connectors, real model calls, and a session that survives a reload.

## Stack

Vanilla HTML, CSS and ES modules. No framework, no bundler, no dependencies, no build step — the
point is that a reviewer can read every line. `js/model.js` is the model boundary; `js/validate.js`
holds the five checks; `js/engine.js` is the only writer; `js/ui.js` renders from state, never
from the assistant's own claims. The module responsibilities, the dependency direction and where
to add a check or a turn are in [`docs/architecture.md`](docs/architecture.md).

## Run

    cd ask-now-or-undo-later
    python3 -m http.server 8123

Open <http://127.0.0.1:8123>, type a request or click a chip, and switch the rule at the top
right. The undo window runs in real time. <http://127.0.0.1:8123/scenes.html> lists every state
as one click, which is the fastest way to review the interaction.

Keyboard: Tab reaches the request box and the buttons, Enter asks, and Escape backs out of an open
proposal or an unsent correction draft without touching the calendar.

| URL | State |
| --- | --- |
| `?scene=confirm-proposal` | proposal waiting for confirmation |
| `?scene=confirm-done` | confirmed, updates sent, no undo |
| `?scene=undo-window` | moved, 6 s into the undo window |
| `?scene=undo-reverted` | undone at 12 s, three attendees already opened it |
| `?scene=undo-draft` | the adapter has drafted a correction; nothing is sent |
| `?scene=undo-corrected` | the correction is sent and the ledger records who was written to |
| `?scene=undo-expired` | window closed at 31 s |
| `?scene=blocked` | malformed call stopped by the shape check |
| `?scene=clarify` / `?scene=decline` | repair turns |

`window.__proto.state` exposes the live state in the console.

Fixed cases, no dependencies: `node tests/run.mjs` runs twelve checks over the engine, the five
checks and the three repair turns. The same inputs and expectations are re-run after every change.

## Development record

Fourteen commits, grouped by step; `git log --oneline` reads in the same order. The reasoning behind
each change is in [`docs/decisions.md`](docs/decisions.md).

- Scaffold and week data — a week view that reads like a calendar.
- Model boundary — the parser returns a proposal, never an action.
- Checks — shape, permission, precondition, confirmation, idempotency.
- Engine — execute, tick, undo; one writer, one log.
- Interface — proposal card, ledger, audit log.
- Tests — seventeen fixed cases; two of them failed first and were fixed.
- Correction flow — after an undo the adapter drafts the message and the person sends it, because
  repair is the work that undo shifts rather than removes.
- Review aids — a scenes index and a keyboard path (focus follows the next decision, Escape backs
  out), so the interaction can be inspected without a mouse and without waiting for timers.
- Scene checks — the first run failed on `undo-corrected`: after the correction was sent the panel
  lost the receipt, because the count of people who had read the update was taken from the current
  status rather than from whether they had opened it. Counting by `openedAt` fixed it, and the same
  check now guards every state.
- README — how to run it.

Four real fixes on the way, each found by a check, a screenshot or by using the thing:

- Every notification open was stamped at the moment of the replay jump, so undo looked
  simultaneous with reading. Opens now record their scheduled time (`00:04`, `00:09`).
- The result card hard-coded "read morning as 09:00", so a 2 pm request produced a sentence that
  described a different request. The action now carries its own assumptions.
- `isUndoOpen` returned true in confirm mode, and `undo()` did not care which rule was active.
- The `?scene=` pages are frozen so their clocks stay deterministic. If you then typed your own
  request on one of them, the countdown sat still. Starting a new request now takes over with a
  clean session and clears the `?scene=` parameter; clicking undo inside a replay still works.

## AI assistance

An AI assistant drafted the code, the CSS and this README. What I checked: loaded every `?scene=`
link and compared the screen against the audit log; read each commit diff before pushing. What I
changed: removed an invented confidence score from the proposal (it looked calibrated and was
not), rewrote the notification timestamps, added a compact rule for events too short to hold two
lines, and cut the README from a second report to this page.

## Files

[`docs/architecture.md`](docs/architecture.md) — modules, flows, the boundary, and how to extend it.
[`docs/decisions.md`](docs/decisions.md) — design notes, concept mapping, open questions.
[`docs/screenshots/`](docs/screenshots) — the ten states and three storyboards the report draws on.
[`docs/report/`](docs/report) — the submitted report (`A2-report.pdf`) and the HTML source it was printed from.

No API key is needed and none is committed. A real adapter would read its key from an environment
variable at build time.
