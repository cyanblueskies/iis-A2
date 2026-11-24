# Ask now or undo later?

**README prose word count: 261** (code and setup commands excluded).
**Submitted code release:** [`v1.0`](https://github.com/cyanblueskies/iis-A2/releases/tag/v1.0), commit [`5d4cf6e`](https://github.com/cyanblueskies/iis-A2/commit/5d4cf6e37f829efed5f0600bd2557481294e8503).

An interactive prototype for rescheduling a shared meeting under two rules: confirm first, or act immediately with a 30-second undo. It makes the effects inspectable; it does not measure user performance.

## Status

- **Implemented:** rule-based request parsing, proposal with four visible assumptions, five checks, confirmation, undo, correction draft/send, audit log and replayable scenes.
- **Simulated:** model output, calendar, attendees and message delivery. No real invitations are sent.
- **Unfinished:** calendar integration, live model calls and persistence across reloads.

## Technology and setup

The app uses vanilla HTML, CSS and JavaScript; Python 3 serves it locally. Node.js runs the engine and scene checks; scene checks also require Chrome. There are no external packages or API keys. The prototype's parser is rule based. A live AI model and API are not connected; the model choice is undecided.

From the repository root, run:

```sh
python3 serve.py
```

Open `http://127.0.0.1:8123`. Use `scenes.html` to inspect fixed interaction states.

## Check

```sh
node tests/run.mjs
node tests/scenes.mjs
```

These cover 17 engine cases and 11 scenes.

## Development and AI

Key decisions are traceable in the commits: [parse requests into proposals](https://github.com/cyanblueskies/iis-A2/commit/4d2c46ab2e37f7d0263b1bfb61134237dbe3becc), [check before execution](https://github.com/cyanblueskies/iis-A2/commit/6359e75db633a6d06c3f33a13176f515f53ef020), and [add undo, notification ledger and audit log](https://github.com/cyanblueskies/iis-A2/commit/bfb3045132b269540f35aa2a0ca7db5696a1e649). I used DeepSeek to draft parser, interaction and CSS code. I removed its unsupported confidence score and kept four explicit assumptions instead. Replaying scenes revealed incorrect notification times and “morning” text for a 2 pm request; I corrected the schedule and tied result text to the request assumptions. I checked scenes against the audit log and ran both check commands above. No third-party code or images are reused.
