# Ask now or undo later?

Prototype for IIS Assignment 2: an AI calendar assistant that reschedules a shared meeting
under two oversight rules — confirm before acting, or act and undo within 30 seconds.

## Status

Early build. The week view, the request parser, the pre-action checks, the undo window and the
notification ledger work locally. Documentation, captures and the report follow.

## Run

    cd ask-now-or-undo-later
    python3 -m http.server 8123

Open <http://127.0.0.1:8123>. No dependencies, no build step, no API key.

Deterministic states: `?scene=confirm-proposal`, `?scene=undo-window`, `?scene=undo-reverted`,
`?scene=undo-expired`.
