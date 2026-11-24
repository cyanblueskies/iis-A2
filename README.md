# Ask now or undo later?

**README prose word count: 360** (code and setup commands excluded).
**Submitted code release:** [`v1.0`](https://github.com/cyanblueskies/iis-A2/releases/tag/v1.0), commit [`5d4cf6e`](https://github.com/cyanblueskies/iis-A2/commit/5d4cf6e37f829efed5f0600bd2557481294e8503).

An interactive prototype for rescheduling a shared meeting under two rules: confirm first, or act immediately with a 30-second undo. It makes the effects inspectable; it does not measure user performance.

## Project status

- **Implemented:** rule-based request parsing, proposal with four visible assumptions, five checks, confirmation, undo, correction draft/send, audit log and replayable scenes.
- **Simulated:** model output, calendar, attendees and message delivery. No real invitations are sent.
- **Unfinished:** calendar integration, live model calls and persistence across reloads.

## Technology stack

The app uses vanilla HTML, CSS and JavaScript. Python 3 serves it locally; Node.js runs the engine and scene checks; Chrome is needed for scene checks. There are no external packages or API keys. The parser is rule based. No live model or API is connected; the model choice remains undecided.

## Running or inspecting the work

From the repository root, run:

```sh
python3 serve.py
```

Open `http://127.0.0.1:8123`; use `scenes.html` to inspect fixed interaction states.

```sh
node tests/run.mjs
node tests/scenes.mjs
```

These checks cover 17 engine cases and 11 scenes.

## Development record

Key decisions are traceable in the commits: [parse requests into proposals](https://github.com/cyanblueskies/iis-A2/commit/4d2c46ab2e37f7d0263b1bfb61134237dbe3becc), [check before execution](https://github.com/cyanblueskies/iis-A2/commit/6359e75db633a6d06c3f33a13176f515f53ef020), and [add undo, notification ledger and audit log](https://github.com/cyanblueskies/iis-A2/commit/bfb3045132b269540f35aa2a0ca7db5696a1e649). Scene replay revealed incorrect notification times and “morning” text for a 2 pm request; I corrected the schedule and tied result text to the request assumptions. I checked scenes against the audit log and ran both check commands above.

## AI assistance

I used DeepSeek to draft parser, interaction and CSS code. For the parser, I kept the output as a proposal with four visible assumptions; the engine runs its checks and waits for confirmation before changing the calendar. I removed the generated confidence score because the prototype had no evidence to support it. I checked that confirmation is required and that the assumptions remain visible after execution.

For the undo interaction, I kept calendar restoration separate from notifications: undo does not erase updates that attendees have already opened, and the correction stays a draft until the person chooses to send it. I checked the notification and draft/send cases in the engine checks and replayed the undo scenes. No third-party code or images are reused.
