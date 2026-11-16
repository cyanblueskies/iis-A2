# Design notes

Working notes behind the prototype. The report compresses these; this file keeps the reasoning
that the word limit will not fit.

## 1. What changed since Assignment 1

A1 asked whether post-action undo can carry the oversight burden that pre-action approval
carries, when an assistant reschedules a shared meeting. It proposed a laboratory study
measuring oversight effort, felt control, and whether a mistake is caught before other people
act on the new time.

A2 asks for a developed system, in four days, with no participants. The study could not be run
honestly, so the scope moved from *measuring* the effect to *building the situation that makes
the effect visible*. The question survives; the method does not.

Two compromises follow, and both are labelled in the interface and here:

1. **The social consequence is simulated.** Six attendees live in a ledger with scripted open
   times, not in mailboxes. Undo restores the calendar entry and cannot touch the ledger — which
   is exactly the asymmetry A1 identified, made observable rather than argued.
2. **The assistant's understanding is rule-based.** A real model would parse more loosely. The
   parser sits behind the interface a model call would use, so the interaction, the checks and
   the failure modes are unchanged if the adapter is swapped.

## 2. The interaction

Both rules start from the same typed request: *"Move the project review to Friday morning."*

1. The adapter returns a proposal: object, current slot, new slot, attendees, and the
   assumptions it made (morning → 09:00, duration kept, attendees notified, Friday of this week).
2. The notification side effect is shown as a tick box that is **on by default and marked
   "not requested"** — it is the part of the action that leaves the person's control.
3. Under **confirm**, nothing happens until the person presses confirm. After that there is no
   undo: the oversight was the check.
4. Under **undo**, the action runs immediately, six updates go out, and the person has thirty
   seconds. The ledger opens updates at 00:04 and 00:09.
5. Undo at 00:12 restores *Thursday 10:00*. Three attendees have already read the update; the
   interface says so, and offers a correction that is not built.

## 3. Design decisions

| Decision | Why it suits the problem | Evidence | Status |
| --- | --- | --- | --- |
| Two oversight rules as a session switch | A1's comparison only means something if one person can feel both rules on the same task | Horvitz (1999): act, ask or wait depends on confidence and error cost | implemented |
| 30 s undo window | Long enough to notice, short enough that the recipient has probably not read it yet | Nielsen (1993) 10 s limit of attention; A1's argument that the invitation travels faster than the undo | implemented |
| Notify-on default, surfaced and marked unrequested | The cost that A1 says is missing from the literature is a default, not a decision the person made | Amershi et al. (2019) G11; Shneiderman (1983) reversibility only holds for what is still under control | implemented |
| Assumption list instead of a confidence score | A number would look calibrated and is not; the assumptions are what the person can actually check | L02 "every inference is a bet"; L09 omitted specification becomes a silent model decision | implemented |
| Five checks before execution | A well-formed call can still be wrong; the boundary must be in code, not in the prompt | L12: model proposes, system disposes; shape, permission, precondition, confirmation, idempotency | implemented |
| Render the result from the return value, not the assistant's sentence | "Done" is a claim until the tool says so | L12 process hallucination | implemented |
| Ledger as a first-class panel | Makes the irreversible part visible instead of implied | L01 visibility; A1 gap | implemented |
| Ghost of the previous slot | Change should be legible without reading the log | L01 visibility; L06 gulf of evaluation | implemented |
| Decline and clarify instead of a best guess | A model has no "I don't know" state unless one is built | L07 repair turns; L08 | implemented |
| Correction message after undo | Repair is the work that undo shifts rather than removes | A1 gap: restoring an entry does not restore an invitation | planned |

## 4. Where the Weeks 1–4 concepts land

| Concept | Where it is visible |
| --- | --- |
| Initiative, inference, visibility, reversibility (L01) | The rule switch moves all four: undo mode raises initiative and inference, lowers visibility; the ledger and the ghost put visibility back |
| Four properties of an intelligent interactive system (L02) | Senses the typed request, interprets under uncertainty (assumptions), acts through the calendar and the update channel, closes the loop with confirm or undo |
| Conceptual spine (L02) | Model → planning → tools → action → environment → feedback; the diagram in the report is this spine with status labels |
| Act, ask or wait (L03) | Clarify turn when the day or time is missing; confirm mode is "ask", undo mode is "act" with a cheap reversal |
| Guidelines G1–G2, G10–G11, G17 (L03) | Decline turn states the capability envelope; the assumption list and the ledger explain what was used |
| Feedback timing (L04) | Immediate acknowledgement at 00:00 and a counting window; no silence while the action is live |
| Signal detection criterion (L04) | The undo window is a criterion: a cautious window trades misses for false alarms |
| Recognition over recall (L05) | Example chips, visible assumptions, visible ledger; nothing requires remembering what the assistant inferred |
| Mental model (L05) | "What it decided for you" is the model of the system the interface is trying to install |
| Signifiers and the two gulfs (L06) | The confirm button and the undo bar are signifiers; the ghost narrows evaluation |
| Sense of agency (L06) | Undo restores the object but not the agency: three people hold a time that no longer exists |
| Repair turns (L07) | Clarify, confirm, decline are implemented as turns, not as error strings |
| Generation, not lookup (L08) | The decline turn exists because nothing in a model produces it by default |
| Specification and schema (L09) | The proposal is a schema-shaped object; the validator enforces its shape before anything runs |
| Model/system boundary (L12) | `execute()` is the only writer; the adapter never touches state |

## 5. Status

- **Implemented:** parser and turn types, proposal card, assumption list, five checks, execution,
  ledger with scripted opens, undo window, expiry, audit log, deterministic `?scene=` replay.
- **Simulated:** calendar service, attendees, delivery of updates, the model itself.
- **Planned:** correction message to attendees who already read the old time; multiple events;
  a session that survives a reload (local storage); keyboard-only path.

## 6. Development log

| Commit | What changed and why |
| --- | --- |
| `add week view and simulated calendar data` | A calendar that looks like a calendar, so the moved event can be read at a glance |
| `parse a request into a proposal instead of acting` | Separated understanding from acting; the proposal is data the rest of the system can check |
| `check shape, permission and precondition before executing` | Added the boundary; a malformed call is a caught error, not a crash |
| `add undo window, notification ledger and audit log` | The three things that make the social cost observable |
| `render proposal card, ledger and audit log` | Made the inference visible before the action, and the consequence visible after it |
| `add run steps to the README` | Someone else has to be able to start it |

## 7. Open questions

- The prototype shows the asymmetry; it does not show that undo *reduces* oversight effort.
  That was A1's measurement and it is still unmeasured.
- Which rule should be the default for shared events? The design implication is that the default
  should follow reversibility and visibility (L12), not convenience.
- Would a real model make the assumption list longer or shorter? Longer, probably — which is an
  argument for keeping it visible.
