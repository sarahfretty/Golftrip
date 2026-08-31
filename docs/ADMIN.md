# Organiser guide

Two organisers (Jane & Sarah) run the event from the **Console** (`/admin`). In the local
adapter, access is the shared PIN (`VITE_ORGANISER_PIN`, default `belek2026`). In production
with Supabase, organisers sign in with their Supabase Auth account.

The organisers are also competitors, so **every correction is recorded with a name and time**
and shown on the card. Transparency is what makes the leaderboard arguable-with rather than
argued-about.

## The round day, step by step

1. **Before play** — nothing to do. Each round starts `upcoming`.
2. **Players tap their name** on their own phones ("Tap your name"). No passwords.
3. **The nominated scorer** for each group opens **Start scoring** from Home and enters the
   group's card hole by hole — gross strokes only, autosaving every tap, resumable on any
   device. They **Check and sign** at the end, stamping their name and the time on the card.
4. **You watch cards come in** on the Console (Rounds section shows `n/groups cards in`).
   No positions are shown to anyone yet.
5. **Declare** the round when every card is in and checked → standings appear on the **Cup**
   tab (individual Order of Merit + Team Cup). For the final round, **Seal** instead — it
   stays hidden until the ceremony.
6. **Lock** the round once results are confirmed. Locking closes the round to further public
   score writes.

## What each control does (Console)

| Section | Action |
|---|---|
| **Rounds** | Set a round to Scoring / Declare / Seal / Lock / Reopen. Declare publishes standings; Seal withholds them; Lock freezes the round. |
| **Teams** | Assign six scorers a side, then put everyone who isn't scoring — Catherine, and the attendees — on a team underneath, so all fifteen belong somewhere. Live warnings flag an uneven split and the ladies' locked scorers not split across both. Teams stay hidden from everyone until you tap **Reveal the teams**; **Hide the teams again** puts them back. |
| **Side prizes** | Record the Nearest-the-Pin and Longest-Drive winner for each round. |
| **Correct a card** | Change any hole's score. The change is written to the card's audit trail (from → to, by whom, when) and shown to everyone. |
| **Announcement** | Post a message to everyone; it appears on the Trip tab. |
| **Reset all** | Wipes cards, standings, teams (local adapter). Use with care. |

## Trust rules baked in

- **Cards in, standings out.** Submission progress is visible; positions are not, until you
  declare. The final round is sealed for a live reveal.
- **Your own numbers, always; everyone else's, never early.** A player sees their own card the
  moment it's signed; comparisons wait for the declaration.
- **No arithmetic by anyone.** Scorers tap the gross strokes they'd write on paper. Shots
  received (gold dots), points, gross totals and net are all computed.

## Open decisions for the organisers

- **Catherine's handicap is confirmed at 45.0** (31 Aug 2026) and her card now counts, so she
  is one of the thirteen scoring golfers.
- **Teams** are seeded in the data (Gold, 7 people / 6 scoring; Aqua, 8 people / 7 scoring)
  and editable in the Console. The sides are uneven — see LIMITATIONS.md.
  They stay hidden from everyone until you reveal them.
- **Couples are deliberately not split** across the teams — the rule was tried and dropped
  (30 Aug 2026), so `COUPLES` in `src/data/belek-cup-2026.ts` stays empty and that warning
  stays dormant. Populate it only if the rule is ever reinstated.
