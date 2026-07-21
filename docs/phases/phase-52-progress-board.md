# Phase 52 — Progress board (sync own stats + board shell, self first)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟢 Built — local pipe + real
PocketBase round-trip verified, fast loop green (awaiting owner review/merge) · **Progress:** ~100%
(local-only scope, OQ9) · **Track:** v3.0 — Backend & multiplayer (slice 3 of 7)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

> ### 🧭 Track & numbering
> `v3.0 — Backend & multiplayer`, **slice 3 of 7**. Builds on **Phase 50** (the client seam +
> connectivity store + offline-optional contract) and **Phase 51** (the identity the stats hang off:
> `deviceId`, the `users` record, `displayName`). **Foundation for** Phase 53 (Friend invite, which
> populates the board with *other* people) and the duel slices. The v2.x line continues in parallel.

## Goal
Give the player a **board** — and get their own progress onto the server so the board has something to
show. Two halves:
1. **Sync (own stats).** Best-effort, background push of a **compact, client-reported snapshot** of the
   player's headline progress (XP, rank, a few tallies) to a server row they own. Client-reported is
   fine — **anti-cheat is an explicit non-goal** (cheating only cheats yourself; the same holds in a
   friend group). No server-side validation, no authoritative scoring.
2. **Board shell (self first).** A board surface that renders **one entry: you** — name, rank medal, XP,
   and a headline metric — sourced from **local** stats (so it works offline and instantly). The list
   grows to *friends* in Phase 53; this phase deliberately ships **only the self row + an empty-state**
   that names what's coming.

Like the earlier slices, this **preserves offline-first**: the board's self row is computed locally and
shown with or without a backend; the server sync is additive and never blocks or throws.

## Philosophy (inherited — load-bearing)
- **Friend-scoped only — never a world/global leaderboard.** This phase renders *your own* row; Phase 53
  adds the *friends* you explicitly connect with. There is no global ranking, ever.
- **Anti-cheat is a non-goal → thin store, not a referee.** The snapshot is whatever the client
  computes from its own history. No validation.
- **Minimal data.** The snapshot carries only what the board renders — a handful of integers + a
  denormalized display name. No raw history, no per-question data, no PII beyond the name.

## Current state (so scope is clear)
- **XP + rank are the app's progression spine, and are *derived*, never stored raw.**
  `computeStats(sessions)` → `computeXp({...})` → `rankForXp(xp.total)` produces the total XP and the
  `Rank` (`{ index, key, minXp }`). Progress/Home already render this. So the board's currency already
  exists — this phase **mirrors** it to the server, it doesn't invent a new metric.
- **`StatsOverview`** (`src/domain/stats.ts`) already exposes `sessionCount`, `totalQuestions`,
  `totalCorrect`, `accuracy`, `avgAnswerMs`, `totalPlayMs`, streak-bonus rollups, `mostMissed`, etc.
  Mastery rollups give fully-mastered counts. The snapshot is a **projection** of these.
- **Identity (Phase 51)** gives each player a `users` record (anonymous or upgraded) with `displayName`
  + `deviceId`, and the `identity` store + seam to reach it. The stats row is **owned by that record**.
- **Local persistence is the source of truth** (IndexedDB `QuizStore`, now at DB v7). History is
  append-only; XP/rank/stats are recomputed from it. The server snapshot is a downstream copy.
- **The connectivity + offline contract (Phase 50)** and its guard tests remain in force.

## What syncs — the snapshot (client-reported)
A single small row per player, e.g. a `stats` collection (see OQ1), one row per `users` record:

| Field | Source (local) | Why |
| --- | --- | --- |
| `user` (relation) | the Phase-51 `users` record id | ownership + the join Phase 53's board needs |
| `displayName` | `playerName` pref | denormalized so the friend board renders in one query |
| `deviceId` | identity record | disambiguation / dedup |
| `xp` | `computeXp(...).total` | the board's primary sort key |
| `rankIndex` | `rankForXp(xp).rank.index` | render the rank medal without re-deriving server-side |
| `sessionCount`, `totalCorrect`, `totalQuestions` | `computeStats` | headline tallies / accuracy |
| `longestStreak` | streak rollup | a secondary board metric (OQ5) |
| `fullyMastered` | mastery rollup | a secondary board metric (OQ5) |

All client-computed; the server stores them verbatim.

## In scope
- **Server: a `stats` collection (committed migration).** One row per `users` record (unique `user`
  relation), holding the snapshot fields above. **Owner-only** API rules for now (create/update/read
  your own row); Phase 53 widens *read* to the friend graph. Versioned in `pb_migrations/`.
- **Sync module (extends the seam).** A `src/backend/board.ts` (thin, never-throwing pb ops) +
  orchestration in the identity/board store: build the snapshot from local stats and **upsert** it,
  best-effort, on the right triggers (session end + startup — OQ3). Idempotent; the seam stays the only
  SDK importer.
- **Board UI shell.** A board surface (section in Progress **or** a new route — OQ4) that renders the
  **self row** from local stats (name, rank medal, XP, one secondary metric), plus an **empty-state**
  that says friends arrive next (Phase 53). Reuses the existing rank-medal component.
- **Offline-optional guard (inherited).** With `VITE_PB_URL` unset **or** backend down, the board still
  shows the self row from local data; sync silently no-ops; the app is otherwise unchanged. Guard test.
- **Reset coherence.** When the player clears history/progress locally, the server snapshot is
  best-effort updated/zeroed (or the row removed) so the board doesn't show stale glory (OQ8).
- **Security/privacy.** Owner-only writes; snapshot limited to board-render fields; anti-cheat non-goal
  restated; no secrets committed.
- **i18n EN/FR/DE** for board labels + empty-state; `messages.test.ts` parity green.
- **Tests.** Mocked seam (no live server in CI): snapshot projection, best-effort upsert, offline no-op,
  reset coherence, board renders self from local. A documented manual/local smoke against real
  PocketBase (+ the browser round-trip pattern established in Phase 51).

## Out of scope (deliberately)
- **The friend graph (invite/accept) and rendering *other* players** — Phase 53. This phase's board has
  exactly one row (you).
- **Widening the read rule to friends** — Phase 53 (owner-only until then).
- **Duels / rooms** — Phases 54–56.
- **Per-mode / per-region stat breakdowns on the server, history-level sync, real-time board updates** —
  later if wanted; the snapshot stays a headline projection.
- **A world/global leaderboard** — never.
- **Editing `main_PRD.md`** (the leaderboard Non-Goal reframe) — merge-time owner sign-off.

## Depends on
**Phase 51** (the `users` identity the stats row is owned by; the `identity` store + seam), **Phase 50**
(seam, connectivity, offline contract), **Phase 6** (persistence / history the stats derive from),
**Phase 43** (XP/rank spine — `computeXp`/`rankForXp`), **Phase 16/41** (mastery rollups), **Phase 8/17**
(i18n). **Foundation for** Phase 53 (Friend invite) and the duel slices.

## Deliverables checklist
- [x] Committed migration: a `stats` collection, one row per `users` record (unique `user` relation),
      snapshot fields; **owner-only** rules (read/create/update self). (Phase 53 widens read.)
      — `server/pb_migrations/1721570000_created_stats.js`.
- [x] `src/backend/board.ts` — thin, never-throwing pb ops (`upsertSnapshot`, `readOwnSnapshot`) over
      the Foundation `getClient()`; seam stays the only SDK importer. Owner id bound inside the seam
      from the cached auth record (never handed in by callers).
- [x] Board orchestration (`src/ui/stores/board.ts`): build the snapshot from local
      `computeStats`/`computeXp`/`rankForXp`/mastery and upsert best-effort on session-end + startup
      (+ rename + reset); idempotent; coalesced; non-blocking; never throws.
- [x] Board UI shell rendering the **self row** (name, rank medal, XP, **two** secondary metrics —
      fully-mastered + sessions per OQ5) from local stats, + an empty-state naming Phase 53; a section
      in Progress (OQ4).
- [x] **Offline-optional guard**: unset/down backend → board shows self from local, sync no-ops, app
      unchanged (guard test — `board.test.ts` "silent no-op with no backend"; build shows the SDK stays
      a lazy chunk).
- [x] Reset coherence: local history/progress reset best-effort pushes the recomputed (zeroed) snapshot
      (wired in History + Settings; guard test).
- [x] Security/privacy: owner-only writes; snapshot limited to render fields; anti-cheat non-goal; no
      secrets committed.
- [x] EN/FR/DE for board strings; `messages.test.ts` parity green.
- [x] Tests: snapshot projection, best-effort upsert (create/update), offline no-op, reset coherence,
      self-row render, coalescing — **mocked** seam (no live server in CI).
- [x] **Deployment**: local-only (OQ9), consistent with Phase 51; documented.
- [x] Verified: fast loop green (`npm run test` 1010 ✓ / `check` 0 errors / `lint` clean); real upsert +
      read round-trip + unique-index + owner-isolation verified against a local PocketBase 0.39.8 (curl);
      app confirmed unchanged with the backend absent (offline no-op test + SDK lazy chunk in the build).

## Technical notes
- **Reuse the seam + identity.** Board ops sit behind `src/backend/`; components read a board store,
  never the SDK. The snapshot's owner is the current `identity` (`users` record id from Phase 51).
- **Derive, then mirror.** Never store a second source of truth: recompute XP/rank/stats from local
  history (as the UI already does) and push the projection. On any divergence, **local wins** (the
  server copy is just what friends read).
- **Best-effort, debounced upsert.** Session-end fires a sync; coalesce rapid changes; a failed/absent
  backend leaves the last local values shown and simply skips the push (mirror the Phase-51 pattern).
- **Upsert shape.** One row per user: look up the player's own row (by `user` relation), create if
  missing else update. Keep it a single idempotent operation behind `board.ts`.
- **Anonymous players sync too** (OQ7): an anon identity owns a stats row and appears on *their own*
  board; upgrading (Phase 51) makes the spot durable/verified — it doesn't gate syncing.
- **Migrations committed, data gitignored** — unchanged.
- **Test seam.** Mock `src/backend/*`; validate the real pipe with a documented manual smoke + the
  browser round-trip used in Phase 51.

## Main-PRD impact (owner sign-off)
Rendering a board (even self-only) is the concrete step that turns the reframed **"No online
leaderboards or social features"** Non-Goal into the v3.0 track's **friend-scoped** board. Land this
copy change with the other merge-time follow-ups (Phase 50/51 Status-Table rows, Pillar 3 reframe), so
`main_PRD.md` is edited once.

## Open Questions — to resolve with the owner
1. **Storage shape.** A separate `stats` collection (one row per user, unique `user` relation) **vs**
   extra numeric fields on the `users` record. (Rec: **separate `stats` collection** — keeps the auth
   record lean, scales to richer stats, and gives Phase 53 a clean board query. Denormalize
   `displayName` onto it so the friend board is a single request.)
2. **Snapshot fields.** Confirm the set: `xp`, `rankIndex`, `sessionCount`, `totalCorrect`,
   `totalQuestions`, `longestStreak`, `fullyMastered` (+ denormalized `displayName`, `deviceId`). Add or
   drop any? (Rec: this set — enough for a rich row, still tiny.)
3. **Sync cadence.** On **session-end + startup**, best-effort + debounced? Also on rename (name change)
   and on local reset? (Rec: session-end + startup + rename + reset; all best-effort, coalesced.)
4. **Board placement.** A **section inside Progress**, or a **new nav route** ("Board"/"Friends")?
   (Rec: a **section in Progress** for now — a new nav item over-promises a social feature that's only
   self until Phase 53; promote to its own route when friends land. Confirm.)
5. **Headline + secondary metric.** Primary is **XP + rank** (the app's spine). Which secondary shows on
   the row — accuracy, `sessionCount`, `longestStreak`, or `fullyMastered`? (Rec: **XP + rank** primary,
   **accuracy** secondary — most legible; keep the rest in the snapshot for Phase 53's board detail.)
6. **Read-rule timing.** Keep the `stats` read rule **owner-only** this phase and widen to friend-scoped
   in Phase 53? (Rec: **yes** — don't expose others' rows before the friend graph exists.)
7. **Anonymous on the board.** Do anonymous identities sync + appear on their own board (so the board
   isn't empty pre-upgrade)? (Rec: **yes** — anon syncs; upgrading just makes it durable/verified.)
8. **Reset coherence.** On local history/progress reset, **zero/update** the server snapshot, **delete**
   the row, or leave it? (Rec: **update to the recomputed (zeroed) snapshot** — simplest, keeps the row
   stable for Phase 53; deletion complicates the friend board.)
9. **Go live now?** Follow Phase 51 (**local-only**), or stand up hosting for a real cross-device board?
   (Rec: **local-only**, consistent with Phase 51; the real deployed board can wait until Phase 53 makes
   it meaningful with actual friends. Confirm.)
10. **Board sort / self-highlight.** With one row it's trivial, but fix the contract now: sort by **XP
    desc**, always render **self** even at 0 XP, highlight the self row? (Rec: **yes** to all — so
    Phase 53 just adds rows.)

## Acceptance criteria
- With the backend reachable, the player's headline snapshot (XP, rank, tallies) is **mirrored** to a
  server row they own, best-effort and non-blocking; the board renders the **self row** from local
  stats. With the backend unset/down, the board still shows the self row from local data and sync
  silently no-ops — the app is otherwise **exactly** as today (guard test + a manual backend-off run).
- The `stats` row is restricted to its **owner** (read/write); the snapshot carries only board-render
  fields; anti-cheat remains a non-goal; no secrets committed.
- A local history/progress reset is reflected in the server snapshot (best-effort).
- Fast loop green (`npm run test` / `check` / `lint`); backend-touching code mocked in tests; EN/FR/DE
  parity holds; the static Pages deploy still ships a fully functional, backend-optional PWA.
- The real upsert + read round-trip is verified against a local PocketBase (and the app confirmed
  unchanged with the backend absent/down).

## Progress log
- **2026-07-21 — PRD drafted** right after Phase 51 landed. Scoped slice 3 as **sync-own-stats + a
  self-only board shell**: a compact, **client-reported** snapshot (XP/rank + a few tallies, projected
  from the existing local `computeStats`/`computeXp`/`rankForXp`/mastery) upserted best-effort to a
  server row owned by the Phase-51 `users` identity, and a board surface that renders **only the self
  row** (friends are Phase 53). Reaffirmed the track philosophy — **friend-scoped only (never global),
  anti-cheat a non-goal (thin store, no validation), minimal data** — and the **offline-first**
  guarantee (board self row is local; sync is additive/non-blocking). Grounded in the current app: XP +
  rank are already derived from append-only history and rendered on Progress/Home, so this **mirrors**
  them rather than inventing a metric. Recorded 10 open questions — the shape ones (OQ1 separate `stats`
  collection, OQ4 board placement, OQ5 metrics) and the recurring **OQ9 go-live-or-local-only** (rec:
  stay local-only, consistent with Phase 51). **NOT built — awaiting the clarifying round + explicit
  build approval.**
- **2026-07-21 — Open questions resolved (owner clarifying round).** Owner-decided: **OQ4 = section in
  Progress** (not a new nav route); **OQ5 = two secondaries, fully-mastered + sessions** (not accuracy);
  **OQ9 = local-only** (as Phase 51); **OQ1 = separate `stats` collection** (denormalized `displayName`).
  Recommendations taken for the rest: **OQ2** the proposed field set; **OQ3** cadence = session-end +
  startup + rename + reset (best-effort, coalesced); **OQ6** read rule stays owner-only until Phase 53;
  **OQ7** anonymous identities sync + appear on their own board; **OQ8** reset → push the recomputed
  (zeroed) snapshot (no row delete); **OQ10** sort XP-desc / always render self / highlight self.
- **2026-07-21 — BUILT (with explicit owner "go").** Implemented the slice end to end. **Server:**
  `pb_migrations/1721570000_created_stats.js` — a `stats` base collection, unique index on the `user`
  relation (→`users`, cascade-delete), owner-only `list/view/create/update` rules, delete locked;
  headline number fields (`min:0, onlyInt`) + denormalized `displayName`/`deviceId`. **Seam:**
  `src/backend/board.ts` — a pure `buildStatsSnapshot` projection (clamps to non-negative ints) plus
  never-throwing `upsertSnapshot` (find-own-row → create/else-update, `user` bound from the cached auth
  record) and `readOwnSnapshot`. **Orchestration:** `src/ui/stores/board.ts` — gathers the same numbers
  the UI derives (`computeStats`/`loadRank`/`loadMastery`/`computeStreak`), projects + upserts,
  best-effort, coalesced (in-flight + single follow-up), no-op offline, never throws. **Triggers:**
  session-end (`Play.svelte`, both finish paths), sign-in/startup + rename (`identity` store),
  history/training reset (`History` + `Settings`). **UI:** a highlighted self row (rank medal + name /
  `board.you` fallback + XP + fully-mastered + sessions) and a friends-coming note in a new Progress
  section, computed from local stats (instant + offline). **i18n:** `board.*` EN/FR/DE. **Tests:**
  `backend/board.test.ts` (projection/clamp, create/update upsert, not-authed + no-backend no-ops,
  read mapping) + `ui/stores/board.test.ts` (projection→upsert, offline no-op, reset-coherence zeroed,
  never-throws, coalescing) + a Progress render assertion. **Verified:** fast loop green (test 1010 ✓,
  check 0 errors, lint clean, build ok with the PocketBase SDK still a lazy 37.5 kB chunk); a real
  round-trip against local PocketBase 0.39.8 confirmed create+read, update, the unique-index rejection,
  and owner-only isolation (a second user sees none of the first's row and can't forge one). **Main PRD
  untouched** — the leaderboard-reframe + Status-Table rows stay the merge-time owner sign-off (below).
