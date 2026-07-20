# Phase 46 — Async friend duels (seeded share-a-run challenge)

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done — shipped in v2.6.0 · **Progress:** 100%
· **Track:** v2.8 — Social · friend duels

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Let players **challenge each other without a backend**. A **Duel** turns a run you just played into a
**seeded, shareable challenge**: a friend opens your link, plays the *exact same* questions (same
order, same distractors), and the two scores are compared — with a return leg so you both see the
verdict, plus a rematch. It's **asynchronous score-attack** (turn-based in time, never needs both
players online at once), which is a natural fit for a study app and — crucially — for an offline,
no-backend, static-hosted PWA.

The whole thing rides on determinism the app **already has**: the Daily Challenge proves that one
`mulberry32` seed reproduces the same mode, region, questions, order and distractors for everyone
(`src/domain/daily.ts`). Duels generalise that from "today's date" to "a seed baked into a link."

A second, distinct variant covers the Grandmaster Challenge, which is pass/fail (not score-attack):
a certified Grandmaster can **invite a friend to also certify** the same region × family — a
"prove you can do it too" dare, not a score comparison.

## The trigger (owner request — 2026-07-17)
From a "what's missing?" discussion: *"the only thing missing is players challenging each other …
but given the offline nature of the app, I'm not sure that's even technically doable."* We confirmed
it **is** doable, backend-free, via seeded share links. Direction agreed in the discussion:
- **Async score-attack**, **100% client-side** (no server — ever, for v1).
- **Full loop**: challenge link → friend plays → return result → **rematch**.
- Name: **Duel** (the `/challenge` route is already the Grandmaster Challenge).
- Entry point: **Summary only** — and **only when enough questions were answered** (dueling a
  3-question run is silly). **No** duel entry on the Play setup screen.
- **Grandmaster** gets its own variant: not a score duel but a **"become a grandmaster too" invite**.
- **Player name** is captured (personalises the challenge, and seeds a future duel history).
- **Local duel history is deferred** (but the name is captured now so it can land later).
- Owner note: *"if this game gains momentum, having a server for this would be something we could
  do"* — so anything that genuinely needs a server (dynamic link previews, verified scores,
  leaderboards, real-time) is explicitly **server-era future work**, not v1.

## Current state (so scope is clear)
- **Seedable determinism exists and is proven.** `src/domain/rng.ts` has `mulberry32(seed)`
  (`Rng = () => number`). `src/domain/daily.ts` derives a stable 32-bit seed from a day-key
  (`dailySeed`, FNV-1a) and builds a fully reproducible round; it uses **fixed** length/choices (not
  the player's prefs) so the challenge is identical for everyone regardless of their settings.
- **The seed already threads through generation.** `src/domain/questions.ts` takes an `rng` for
  distractor selection; `QuizSession` (`src/domain/session.ts`) shuffles its draw bag with the same
  `rng`. So `(config, seed)` fully determines the question sequence + options.
- **`RunConfig`** (`src/ui/stores/game.ts`) already carries `rng?`, `now?`, `dailyDate?`,
  `fixedLength`, `lives`, `choices`, `filter`, and `answerPoolIso`. **But normal runs currently use
  `defaultRng` (Math.random)** — only the Daily Challenge is seeded — so a just-played normal run is
  **not** reproducible today. Making a run duel-able means **seeding every run** and remembering the
  seed (see Technical notes).
- **Fairness is safe by construction for region runs.** Only *training* runs use `answerPoolIso`
  (SR-derived); a region/sub-region run draws from the whole region, so it depends solely on
  `(config, seed)` — no per-player state leaks in.
- **Routing** is hash-based (`svelte-spa-router`, `src/ui/routes.ts`); **`#/challenge` is taken** by
  the Grandmaster Challenge, so duels need a new route (`#/duel`). The router can read the query
  string, so `#/duel?c=<code>` is a clean deep link into the static PWA.
- **Summary** (`src/ui/routes/Summary.svelte`) is the post-run screen and already reads a
  `SessionSummary` (mode/type/region/total/correct/results, incl. per-answer `answerMs`).
- **Grandmaster** state lives in its own IDB store (DB v6, `grandmaster`) keyed by `family|region`
  with monotonic certification (`recordChallengeResult` / `loadGrandmaster` in
  `src/ui/stores/persistence.ts`); the arena is `src/ui/routes/Challenge.svelte`.
- **Prefs** persist and merge (`clampPrefs`); the recent `lastSetup` field is the pattern for adding a
  small persisted value (a `playerName` fits the same way). PWA is static-hosted and auto-updates.
- **Gaps:** normal runs aren't seeded/reproducible; no share-code encode/decode; no `#/duel` route or
  received-challenge screen; no cross-format "comparable score"; no player name; no share affordances;
  no static Open Graph card.

## In scope
- **Seed every run + record the seed.** Play rolls a per-run seed, threads `mulberry32(seed)` through
  the session, and stamps it on the `SessionSummary` (and the `SessionRecord`), so any finished run is
  reproducible and thus duel-able. (No behaviour change for the player; RNG source just becomes a
  remembered seed instead of `Math.random`.)
- **Duel encode/decode (pure).** A compact, URL-safe code (base64url of a small JSON) carrying
  `{ protocolVersion, dataVersion, mode, type, region?, subregion?, length/lives, choices, seed,
  challengerName, challengerScore }`. Pure `encodeDuel` / `decodeDuel` with validation; unknown /
  corrupt / wrong-protocol codes fail gracefully.
- **"Duel a friend" on the Summary** — shown **only when `summary.total ≥ MIN_DUEL_QUESTIONS`** (value
  in OQ1) and the format is duel-able (fixed / survival / full / blitz — **not** training/daily). It
  produces a **share link** (`#/duel?c=…`) + a **copyable short code**, via the native share sheet
  where available.
- **`#/duel?c=…` received-challenge flow** — decodes the code, shows *"{name} challenges you · {scope}
  · beat {score}"*, and launches the **identical** seeded round (overriding the challengee's prefs
  with the encoded length/choices/lives, exactly as the Daily Challenge ignores personal prefs).
- **Verdict + return leg + rematch** — on finish, a head-to-head result (their score rode in the
  link), a **"send result back"** return code/link, and a **"rematch"** (fresh seed, roles swapped).
  Opening a return link shows the original challenger their verdict.
- **Comparable score** — a pure `duelScore(type, summary)` → `{ primary, tiebreak }` (blitz = points;
  fixed/full = correct, tiebreak faster total time; survival = distance reached) with a clear win/tie
  rule.
- **Player name** — a one-time "what should we call you?" prompt on the first duel, persisted in prefs
  and editable in Settings; embedded in the challenge for personalisation (and future duel history).
- **Grandmaster "become a grandmaster too" invite** — from a certified region × family, generate an
  invite link that opens the **Grandmaster arena** for that same region × family (pass/fail, no score
  comparison; no seed needed — it's a mastery test over the whole set). A light "I did it too!" return
  is optional. (Sequencing vs the score duel is OQ7.)
- **Share card** — a **static Open Graph** preview (title + image + description) on the app so a duel
  link at least unfurls as a branded Orbi card in chats, **plus** (appetite permitting, OQ4) an
  **in-app-generated PNG** duel card shared via `navigator.share({ files })` for a personalised
  picture. (Dynamic per-duel unfurling is server-era — see Out of scope.)
- **i18n EN/FR/DE** for all duel copy; `messages.test.ts` parity stays green.
- **Tests** — pure encode/decode round-trip + tamper / wrong-version handling; `duelScore` per format; a
  **determinism guard** (same `(config, seed)` ⇒ identical `itemKey` sequence regardless of injected
  SR/history/prefs); component (Summary gate, received-challenge launch, verdict); headless real-app
  drive of a full create → open → play → return loop.

## Out of scope (deliberately)
- **Any server / backend** — no leaderboards, no verified scores, no accounts, no matchmaking. v1 is
  self-reported and trust-based (stated plainly in the UI).
- **Real-time / live head-to-head** — needs signaling + STUN/TURN; deferred (server-era).
- **Dynamic link-preview cards** (per-duel og:image/title with the name & score) — impossible without
  a server that renders per-URL OG meta (chat crawlers can't run JS or read the `#…` fragment). This
  is the prime candidate for the owner's "if it gains momentum, add a server" future. v1 ships a
  **static** card only.
- **Local duel win/loss history** — deferred (the player name is captured now to enable it later).
- **QR codes** — not requested; link + short code only.
- No change to SR scheduling, mastery, XP, or existing formats' finish logic (beyond seeding the RNG).

## Depends on
Phase 2 (quiz engine — `rng` through the draw bag & distractors), Phase 15 (Daily Challenge — the
seeded-reproducibility precedent: `mulberry32`, `dailySeed`, prefs-independent params), Phase 42
(Blitz — the marquee score-attack format + `points`), Phases 44/45 (Grandmaster — the arena + store
the "become a grandmaster too" invite reuses), Phase 6 (persistence — seed on `SessionRecord`, player
name in prefs). Independent of any unbuilt phase.

## Deliverables checklist
- [x] Seed every run: Play generates a per-run seed, threads `mulberry32(seed)`, and records it on
      `SessionSummary` + `SessionRecord` (reproducible runs; no player-visible change). *(centralised in
      `play.start`; `SessionSummary` also now records `choices` + survival `lives` for reproduction.)*
- [x] Pure `encodeDuel` / `decodeDuel` (base64url compact JSON) with `protocolVersion` + `dataVersion`
      validation and graceful failure on corrupt/foreign codes. *(`src/domain/duel.ts`.)*
- [x] Pure `duelScore(type, summary)` → `{ primary, tiebreak }` + a win/tie rule (`duelVerdict`); unit-tested per format.
- [x] Determinism guard test: same `(config, seed)` ⇒ identical `itemKey` **and option** sequence
      regardless of injected SR / history / prefs / ambient `Math.random` / clock.
- [x] Summary "Duel a friend" affordance, gated by `total ≥ MIN_DUEL_QUESTIONS` (10) **and a filter-based
      run** (not daily, not pool-scoped); builds a `#/duel?c=…` link + copyable short code (native share
      sheet where available).
- [x] `#/duel` route + received-challenge screen; launches the identical seeded round (encoded params
      override the challengee's prefs); robust broken-link + cold-start handling.
- [x] Verdict screen + "send result back" return code (`#/duel?r=…`, carries both scores) + "rematch"
      (fresh seed, swapped roles); opening a return link shows the challenger the verdict.
- [x] `playerName` prefs field + first-duel prompt (`DuelNamePrompt`) + Settings editor; embedded in the challenge.
- [x] Grandmaster "become a grandmaster too" invite (link → arena for the same region × family;
      pass/fail; **silent** return per OQ7). **→ Phase 46b — built 2026-07-20.** A separate, smaller
      codec (`domain/grandmaster-invite.ts`, `{ family, region, challengerName }`, no seed/score) +
      a dedicated `#/challenge-invite` route with a **LOCKED** state (receiver hasn't mastered the
      capstone — the owner's requirement), plus COOLDOWN / already-certified / ACCEPT; challenger
      entry on the **victory bloom** *and* each **certified Progress capstone** (the gilded crown);
      full share treatment (arena/ember canvas image + embedded scan-to-play QR + smart share);
      EN/FR/DE; +29 tests.
- [x] Static Open Graph card (meta tags + `public/og-card.png`) so duel links unfurl as a branded Orbi
      card; **plus** the in-app PNG duel scorecard via `navigator.share({ files })` (OQ4 — both shipped).
- [x] EN/FR/DE strings for all duel copy; `messages.test.ts` parity green.
- [x] Tests (encode/decode, `duelScore`, determinism guard, UI helpers, components) — **+43 tests, 891 total**.
- [x] Verified in the real app (headless Chrome, mobile): `#/duel?c=…` challenge, `#/duel?r=…` verdict,
      broken-link state, and the Settings duel-name field all render correctly; production build ships the
      OG card (also PWA-precached). *(The full click-through — accept → play → verdict → return → rematch —
      is covered piecewise by the determinism guard + `Duel`/`Summary` component tests; interactive CDP
      isn't available in this background sandbox.)*

## Technical notes
- **Seed capture is the linchpin.** To "duel the run I just played," the run must have been seeded.
  Roll a random 32-bit seed at run start, pass `mulberry32(seed)` as the `RunConfig.rng`, and persist
  the seed on the summary/record. Then the challenge code carries that seed and the challengee's run
  reproduces it exactly. (Daily already does the seeded half; this extends it to all runs.)
- **Prefs-independence on the receiving side.** The challengee's run MUST use the *encoded*
  length/choices/lives + seed, never their own prefs (mirrors how the Daily Challenge uses fixed
  constants). Otherwise "same seed" still diverges. This is the crux of fairness — cover it with the
  determinism guard test.
- **Version/data coupling.** Identical questions require the same generator + bundled dataset. Encode a
  small `dataVersion` fingerprint (app version or a hash of the country data); on mismatch, **warn but
  allow** (OQ6) — rare, since the PWA auto-updates.
- **Payload size.** The config is tiny; base64url of a compact JSON is ~50–90 chars — fine for a URL
  and a (longish) typed code. Keep keys short; consider a positional/binary packing only if the typed
  code needs to be shorter. The **link** is the primary channel; the code is a fallback.
- **Score is self-reported.** `challengerScore` rides in the code and can be edited by hand. Acceptable
  for friendly play and stated in the UI; real verification is server-era. Light obfuscation is
  theatre, not security — don't oversell it.
- **Grandmaster invite needs no seed.** It's pass/fail over the *whole* region × family, so question
  order is irrelevant — the invite payload is just `{ family, region, challengerName }` and routes into
  the existing arena. Keep it a separate, smaller code/flow from the score duel.
- **Static OG only, honestly.** Add `og:*` / `twitter:*` meta + a card image to `index.html`; every
  duel link unfurls to the *same* branded card. The personalised picture, if wanted, is a
  canvas-rendered PNG the user shares as a file — not an auto-unfurl. No new dependency required for
  either.
- **Deep-link robustness.** `#/duel?c=…` must handle a cold PWA start (first paint may precede prefs
  load) and a garbage/absent code (friendly "this challenge link looks broken" state).

## Open Questions — to resolve with the owner
1. **Minimum questions to offer a duel** — what's the floor? (Rec: **≥ 10 answered** (`summary.total`);
   naturally excludes a 2-question Survival death and short Blitz runs.)
2. **Duel-able formats & the score metric** — confirm fixed / survival / full / blitz are all
   duel-able, and the metric/tiebreak per format (blitz = points; fixed/full = correct, tiebreak faster
   total time; survival = distance reached). Any format to exclude?
3. **Player-name capture** — a one-time prompt on first duel, stored in prefs, editable in Settings?
   Any length/profanity constraints or is it purely cosmetic/local?
4. **Share card for v1** — static OG card only, or **also** the in-app canvas PNG shared via
   `navigator.share({ files })`? (Rec: ship the static OG now; add the PNG if the extra effort is
   worth a nicer shared picture.)
5. **Short code** — keep it as a typed fallback beside the link (no QR), and is a ~50–90-char code
   acceptable, or do we want a shorter binary-packed one? (Rec: link primary, code as-is; skip QR.)
6. **Version/data mismatch** — **warn-and-allow**, or block the run? (Rec: warn, allow.)
7. **Grandmaster invite sequencing** — ship the "become a grandmaster too" invite **in v1**, or as a
   **fast-follow (46b)** after the score duel lands? (Rec: fast-follow, so the score duel — the bulk of
   the value — ships first.) And what should its return leg be (silent, or an "I did it too!" ping)?
8. **Where the return result surfaces** to the original challenger — a Home "duel result" card (like the
   Grandmaster invite card), a toast, or only on the `#/duel` screen when they open the return link?
9. **Rematch scope** — new seed + swapped roles only, or also let the rematcher change the scope
   (mode/region/format)? (Rec: same scope, new seed, swapped roles — keep it one tap.)

## Acceptance criteria
- From a qualifying Summary (`total ≥ MIN_DUEL_QUESTIONS`, duel-able format), "Duel a friend" produces a
  working `#/duel?c=…` link + short code; the affordance is **hidden** on a too-short run.
- Opening the link on another browser/profile launches the **identical** questions (same order + same
  options), independent of that player's prefs / SR / history, and shows the challenger's name + target.
- On finish the verdict is correct per `duelScore`; a **return link** lets the original challenger see
  the outcome; **rematch** starts a fresh seeded round with roles swapped.
- The Grandmaster "become a grandmaster too" invite opens the arena for the same region × family
  (pass/fail), per OQ7's sequencing.
- A duel link **unfurls as a (static) branded Orbi card** in a chat app; if the PNG option ships, the
  native share sheet offers a personalised duel image.
- **No network is required** for the feature itself (only the user's own sharing channel); nothing
  writes to any server. Scores are self-reported and the UI says so.
- EN/FR/DE parity holds; encode/decode, `duelScore`, and the **determinism guard** are unit-tested;
  fast loop green (`npm run test` / `check` / `lint`) + a headless full-loop drive.

## Progress log
- **2026-07-17 — PRD drafted** from the "players challenging each other" discussion. Confirmed the
  feature is backend-free by building on the Daily Challenge's proven seeded determinism (`mulberry32`
  + `dailySeed`, prefs-independent params). Direction **locked with the owner**: async score-attack,
  **100% client-side** (server explicitly deferred to a "if it gains momentum" future — which also
  owns dynamic link-preview cards, verified scores, leaderboards and any real-time mode); **full**
  challenge → return → rematch loop; name **Duel** (`#/challenge` is the Grandmaster route, so
  `#/duel`); **Summary-only** entry (no Play-setup entry) **gated by a minimum question count**;
  Grandmaster gets a separate **"become a grandmaster too" invite** rather than a score duel; **player
  name** captured for personalisation + a **deferred** duel history. Flagged the hard client-side limit
  on *dynamic* chat-unfurl cards (needs a server) → v1 ships a **static** OG card (+ optional in-app PNG
  via the share sheet). Open questions OQ1–OQ9 remain. **NOT built — awaiting the clarifying round and
  explicit build approval** (see the callout at the top of the main PRD).
- **2026-07-17 — Clarifying round done + build APPROVED by the owner.** Resolutions:
  - **OQ1** floor: `MIN_DUEL_QUESTIONS = 10` answered.
  - **OQ2** scoring: **per-format** `duelScore(type, summary) → { primary, tiebreak }` — blitz = points
    (no tiebreak); fixed/full = correct answers, tiebreak = faster total time; survival = distance
    reached (questions survived), tiebreak = faster total time. Win = higher `primary`, tie broken by
    `tiebreak`. **Fairness edge (locked):** the duel gate requires a **filter-based** run (no
    `answerPoolIso` / `answerSlots` and not the Daily), which excludes training *and* targeted-practice
    survival (player/SR-derived pools that don't reproduce cross-player), leaving clean region/world
    fixed / survival / full / blitz runs.
  - **OQ3** player name: one-time first-duel prompt → `playerName` in prefs → editable in Settings;
    cosmetic/local, length-clamped, no profanity filter.
  - **OQ4** share card: **both** — static OG card **and** the in-app canvas PNG shared via
    `navigator.share({ files })`.
  - **OQ5** code: link primary, base64url short code as typed fallback, **no QR**.
  - **OQ6** version mismatch: **warn-and-allow**.
  - **OQ7** Grandmaster invite: **fast-follow (Phase 46b)** — not in this phase; return leg silent by
    default when it lands.
  - **OQ8** return result surface: **`#/duel` screen only** (open the return link → verdict); no new
    storage, consistent with the deferred duel history.
  - **OQ9** rematch: same scope, fresh seed, swapped roles (one tap).
  Implementation started on worktree branch `worktree-phase-46-async-friend-duels`.
- **2026-07-18 — Built (v1 score duel), fast loop green.** Landed on `worktree-phase-46-async-friend-duels`:
  - **Seeding (linchpin):** every run now rolls a 32-bit seed centrally in `play.start` (honouring an
    explicit `seed`/`rng` for received duels, rematches, the Daily and tests) and stamps it on
    `SessionSummary` + `SessionRecord`; the summary also gained `choices` + survival `lives` so a run is
    reproducible from the summary alone. `dailyToConfig` now passes its date-seed through the same path.
  - **Pure domain (`src/domain/duel.ts`):** `encodeDuel`/`decodeDuel` (base64url, short-key JSON,
    `protocolVersion`+`dataVersion`, typed graceful failure incl. a return leg carrying both scores);
    `duelScore`/`duelVerdict` (per-format, per OQ2); `isDuelType`; `MIN_DUEL_QUESTIONS`.
  - **UI glue (`src/ui/duel.ts`):** dataset fingerprint, payload/return builders, `duelToRunConfig`,
    share-link minting, share-sheet/clipboard, and the canvas PNG scorecard.
  - **Flows:** Summary "Duel a friend" card (gated: seeded, ≥ 10, filter-based, not daily/pool-scoped) with
    link / copy-code / share-image + a one-time `DuelNamePrompt`; new `#/duel` route (`Duel.svelte`) for
    the received challenge + the return verdict + broken-link state; on finish the Summary shows the
    head-to-head verdict (matched by seed) with "send result back" + "rematch". `playerName` in prefs +
    Settings. Static OG card (`public/og-card.png` + meta) **and** the shareable PNG.
  - **Icons:** added `swords`/`copy`/`image` (Lucide) via the generator.
  - **Verification:** `npm run check`/`lint` clean; **891 tests** pass (+43: codec, determinism guard,
    `duelScore`, UI helpers, Summary gate ×4, Duel route ×4); production build ships + precaches the OG
    card; headless mobile screenshots of all four new screens look right.
  - **Deferred:** the Grandmaster "become a grandmaster too" invite → **Phase 46b** (OQ7).
- **2026-07-18 — Owner tried the flow: "works well."** Committed on the worktree branch. Owner flagged
  **follow-ups** (not blockers): polish the **share UX** (how the link/code/image are offered) and the
  **generated PNG scorecard** (nicer design). Tracked for a fast-follow / 46b pass.
- **2026-07-20 — Merged latest `main` (v2.5.0) into the worktree branch (signed merge).** Then built
  **Phase 46b — the "become a Grandmaster too" invite** (owner said "implement 46b"; design confirmed
  in a clarifying round). Decisions: **persistent** entry (victory bloom **+** each certified Progress
  capstone); **full share treatment** (image + QR); card direction **C — arena/ember** (the Challenger
  Orbi, per the existing invite-mascot convention) picked from a 3-way glance-prototype; **silent**
  return (OQ7); and — owner mid-build request — a **LOCKED** landing state when the receiver hasn't
  yet mastered the region × family. Landed:
  - **Domain:** shared `base64url.ts` (factored out of `duel.ts`), `grandmaster-invite.ts` — a
    separate, smaller codec (`{ family, region, challengerName }`, protocol-versioned, never-throws
    typed decode, `isMasteryFamily` guard). No seed, no score (pass/fail on the receiver's own board).
  - **UI glue (`challenge-invite.ts`):** link mint / query read, and a canvas **arena/ember invite
    card** (faithful port of `ChallengerOrbi` + an embedded scan-to-play QR) + smart share (reuses the
    duel's generic share plumbing).
  - **Route (`#/challenge-invite`, `ChallengeInvite.svelte`):** decode → gated landing — **LOCKED**
    (not yet mastered → "master {scope} first"), **COOLDOWN** (today's attempt spent),
    already-certified note, or **ACCEPT** (stakes → stage `pendingChallenge` → `#/challenge`); robust
    broken-link / cold-start.
  - **Challenger entries:** "Challenge a friend" on the victory bloom + the gilded crown on each
    certified Progress capstone (`FamilyRegionBreakdown` gained an `onInvite`), each with the one-time
    `DuelNamePrompt`.
  - **Share sheet (`ChallengeInviteSheet.svelte`) — owner follow-up (2026-07-20):** the original
    fire-and-forget `shareInviteSmart` "did nothing" visible on desktop (silent link copy, no image).
    Replaced both challenger entries with a **slide-from-bottom sheet** mirroring the duel Summary
    card: the **rendered arena/ember card inline** (visible on desktop) + Share / Copy image / Copy
    link / Show QR + a feedback line. Dark-arena themed; `DuelQrModal` z-index bumped (60 → 96) so its
    QR opens above the sheet. This also removed the duplicated card-text builder from
    `Challenge.svelte` / `Progress.svelte`.
  - **i18n:** `challenge.friendInvite.*` in EN/FR/DE (parity green; the sheet reuses generic
    `duel.copyLink/copyImage/showQr/*Copied` — no new keys). **Tests:** codec, UI glue + route states
    + sheet (+32 vs 46 v1) → **923 total**; `check` / `lint` clean; verified the route + the canvas
    card + the sheet layout (headless, mobile). Not yet merged to main.
- **2026-07-20 — ✅ Done: merged latest `main` into the branch and released as v2.6.0 "Challenge a
  friend."** Brought main's 9 post-2.5.0 commits into the worktree branch (signed merge `790bac8`);
  5 additive conflicts resolved by keeping both sides (the run-record `seed`/`choices`/`lives` duel
  fields alongside main's targeted-practice `answerPool`/`setId`, plus the `Summary.svelte` import
  list). Full suite green on the combined tree: `check` 0 errors, **938 tests** pass, `lint` clean,
  prod build ships `og-card.png`. Bumped `package.json` → 2.6.0, wrote the CHANGELOG entry, and
  archived this PRD. Handed the `main` fast-forward + tag + push to the owner.
