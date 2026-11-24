# Ask now or undo later?

**README prose word count: 163** (code and setup commands excluded).<br>
**Submitted code release:** [`v1.0`](https://github.com/cyanblueskies/iis-A2/releases/tag/v1.0), commit [`5d4cf6e`](https://github.com/cyanblueskies/iis-A2/commit/5d4cf6e37f829efed5f0600bd2557481294e8503).

An interactive prototype for rescheduling a shared meeting under two rules: confirm first, or act immediately with a 30-second undo. It makes the effects inspectable; it does not measure user performance.

## Status

- **Implemented:** rule-based request parsing, proposal and assumptions, five checks, confirmation, undo, correction draft/send, audit log and replayable scenes.
- **Simulated:** model, calendar, attendees and message delivery. No real invitations are sent.
- **Not built:** calendar integration, live model calls or persistence across reloads.

## Run

Vanilla HTML/CSS/JavaScript; Python serves the app. No dependencies or API key.

```sh
python3 serve.py
```

Open `http://127.0.0.1:8123`; use `scenes.html` to inspect fixed states.

## Check and inspect

```sh
node tests/run.mjs
node tests/scenes.mjs
```

The checks cover 17 engine cases and 11 scenes. Scene checks need Python and Chrome.

## Development and AI

Commit history records the build stages. DeepSeek assisted with code, styling and report prose. The author checked scene states, logs and diffs; removed an unsupported confidence score; and corrected timing and wording. No third-party code or images are reused.
