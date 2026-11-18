# Architecture

Six modules, one direction. Nothing here is clever; the point is that each rule the report
claims is enforced by a file rather than by discipline.

## Modules and what each may not do

| Module | Responsibility | It may not |
| --- | --- | --- |
| `js/data.js` | The simulated week, six attendees, six events, the notification schedule, the 30 s window | Change at run time; it is read once into state |
| `js/model.js` | Turn a request into a proposal, a clarification or a decline; draft the correction text | Execute anything, read the calendar, or write state |
| `js/validate.js` | The five checks over a proposal | Execute anything or mutate the proposal |
| `js/engine.js` | The only writer: `submitRequest`, `execute`, `tick`, `undo`, `draftCorrection`, `sendCorrection` | Generate text or touch the DOM |
| `js/ui.js` | Render state into the page; derive what to show | Decide business truth, or call the model |
| `js/app.js` | Wire events, focus, timers and the `?scene=` replay | Hold state of its own |

Dependencies run one way: `data` ← `model`, `validate`, `engine` ← `ui` ← `app`. There is no
cycle, and `ui.js` imports the engine only for formatting helpers (`clock`, `stamp`, `DAY_NAME`,
`isUndoOpen`), never for behaviour.

## One request, end to end

1. `app.ask()` reads the input and calls `engine.submitRequest`.
2. `submitRequest` calls `model.parseRequest`, which returns `{status, proposal, trace}`. The
   engine stores the proposal and appends to the log. Nothing has changed outside memory.
3. In **confirm** mode the person presses confirm; in **undo** mode `app.ask()` calls
   `engine.execute` straight away. Either way, `execute` is the only path to a change.
4. `execute` calls `validate.validateProposal`. All five checks must pass; if one fails the turn
   becomes `blocked` and the calendar is untouched.
5. `execute` writes the event, creates one notification record per attendee, and logs the result.
6. `tick(t)` advances virtual time. It fires the scheduled opens (00:04, 00:09) and records each
   at its scheduled moment, not at the moment the clock jumped.
7. `undo()` restores the previous slot if the window is open and the rule allows it. It never
   touches the notification records.
8. After a revert, `draftCorrection` asks the adapter for text and stores it unsent;
   `sendCorrection` marks the recipients and is a no-op the second time.

## The boundary, in one sentence

The model returns data; the checks return a verdict; the engine is the only thing that writes;
the interface renders what the engine recorded.

That sentence is the whole design. It is also why the screen can say "three attendees already
opened it" without asking the assistant whether that is true — the fact comes from the ledger,
not from a sentence the model produced.

## Where the five checks sit

`validate.js` receives the proposal and the current state, and returns `{ok, checks[]}` with one
entry per check: shape, permission, precondition, confirmation, idempotency. The interface shows
only the failures; the log records all five, pass or fail, because a check that never appears in
the log is a check nobody can audit.

## Adding to it

- **Another check** — add it to `validateProposal`; it appears in the log and in `?scene=blocked`
  without touching the interface.
- **Another turn type** — return it from `parseRequest`, render it in `assistantBody`. The repair
  turns (clarify, decline, blocked) are three examples of the same pattern.
- **A real model** — implement `remoteAdapter.parseRequest` against the same signature. Nothing
  downstream changes, because nothing downstream knows what produced the proposal.
- **Another scene** — add an entry to `SCENES` in `app.js`, a card in `scenes.html`, and a line in
  `tests/scenes.mjs`. The three lists are checked against each other by the scene test.
