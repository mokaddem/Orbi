# Explorer Ranks & XP — reference

A quick, peekable map of the **Explorer rank ladder**: every rank, the XP needed to reach it, and
the badge that goes with it. Also a short review at the end on whether the ladder wants more tiers.

> Source of truth (don't edit numbers here — edit the code):
> - Thresholds & names: [`src/domain/xp.ts`](../src/domain/xp.ts) → `RANKS`
> - XP weights: [`src/domain/xp.ts`](../src/domain/xp.ts) → `XP_PER_*`, `STREAK_MILESTONE_XP`
> - Badge art: [`src/ui/components/rankMedal.ts`](../src/ui/components/rankMedal.ts) → `RANK_MEDALS`
>   rendered by [`RankMedal.svelte`](../src/ui/components/RankMedal.svelte)
> - Names (i18n): `rank.names.*` in `src/i18n/messages/{en,fr,de}.ts`
>
> _Snapshot generated 2026-07-21 (v2.6.0). It is a fixed **10-tier** ladder — there is no rank
> above the last one; "Top rank reached!" is shown once XP passes the final threshold._

---

## The rank ladder

| # | Rank (EN) | Reach at | XP band (this rank) | Badge |
|--:|-----------|---------:|---------------------|-------|
| 0 | **Novice** | 0 | 0 – 399 | 🥉 bronze coin · **flag** glyph · ★ (1) |
| 1 | **Scout** | 400 | 400 – 999 | 🥉 bronze coin · **compass** glyph · ★★ (2) |
| 2 | **Wanderer** | 1,000 | 1,000 – 2,199 | 🥉 bronze coin · **signpost** glyph · ★★★ (3) |
| 3 | **Pathfinder** | 2,200 | 2,200 – 4,199 | 🥈 silver coin · **route** glyph · ★ (1) |
| 4 | **Navigator** | 4,200 | 4,200 – 7,499 | 🥈 silver coin · **navigation** glyph · ★★ (2) |
| 5 | **Voyager** | 7,500 | 7,500 – 12,499 | 🥈 silver coin · **sailboat** glyph · ★★★ (3) |
| 6 | **Adventurer** | 12,500 | 12,500 – 19,999 | 🥇 gold coin · **mountain** glyph · ★ (1) |
| 7 | **Cartographer** | 20,000 | 20,000 – 29,999 | 🥇 gold coin · **map** glyph · ★★ (2) |
| 8 | **Globetrotter** | 30,000 | 30,000 – 44,999 | 🥇 gold coin · **globe** glyph · ★★★ (3) |
| 9 | **Legendary Explorer** | 45,000 | 45,000+ (cap) | 💎 crystal coin · **crown** glyph · facet ring |

The badge is an inline SVG **struck-metal coin**: a tier metal (bronze → silver → gold → crystal),
the rank's Lucide journey glyph embossed in the metal, and 1–3 stars struck on the rim to mark the
sub-level within the tier. The Legend coin swaps the stars for a round-brilliant facet ring.

**Tier bands:** ranks 0–2 bronze · 3–5 silver · 6–8 gold · rank 9 crystal apex.

### Localized names

| # | EN | FR | DE |
|--:|----|----|----|
| 0 | Novice | Novice | Neuling |
| 1 | Scout | Éclaireur | Kundschafter |
| 2 | Wanderer | Vagabond | Wanderer |
| 3 | Pathfinder | Pisteur | Pfadfinder |
| 4 | Navigator | Navigateur | Navigator |
| 5 | Voyager | Voyageur | Reisender |
| 6 | Adventurer | Aventurier | Abenteurer |
| 7 | Cartographer | Cartographe | Kartograf |
| 8 | Globetrotter | Globe-trotteur | Globetrotter |
| 9 | Legendary Explorer | Explorateur légendaire | Legendärer Entdecker |

---

## How XP is earned

XP is **derived, never stored** — it is recomputed from your history, so the bar only ever climbs
(a Settings history reset is the one thing that zeroes it). Six append-only sources feed it:

| Source | XP | Notes |
|--------|---:|-------|
| Correct answer | **+10** | on top of the per-question XP below |
| Question answered | **+3** | right or wrong → a correct answer is worth **13** total, a wrong one **3** |
| Session completed | **+25** | per finished run |
| Daily streak | **+20 / day** | of your **longest-ever** daily streak |
| Badge earned | **+150** | per unlocked achievement (sticky) |
| Streak milestones | see below | best unbroken run of correct answers **within** a run |

### In-run streak-milestone bonus (cumulative)

| Streak | Bonus | Running total by this streak |
|-------:|------:|-----------------------------:|
| 3  | +10 | 10 |
| 5  | +15 | 25 |
| 10 | +25 | 50 |
| 15 | +40 | 90 |
| 20 | +60 | 150 |
| 25 | +85 | 235 |
| 30 | +115 | 350 |
| 40 | +150 | 500 |
| 50 | +200 | 700 |

A clean 10-in-a-row run therefore adds **+50** (crossing the 3, 5 and 10 marks).

> The **"+N XP" shown on the Summary** (`sessionXp`) counts only `correct + questions + session +
> streak-milestones` — the daily-streak and badge chunks are excluded there to avoid
> double-counting them against the lifetime total.

---

## The curve at a glance

| Step | From → To | Gap | Threshold multiplier |
|------|-----------|----:|---------------------:|
| 0→1 | 0 → 400 | 400 | — |
| 1→2 | 400 → 1,000 | 600 | ×2.5 |
| 2→3 | 1,000 → 2,200 | 1,200 | ×2.2 |
| 3→4 | 2,200 → 4,200 | 2,000 | ×1.9 |
| 4→5 | 4,200 → 7,500 | 3,300 | ×1.8 |
| 5→6 | 7,500 → 12,500 | 5,000 | ×1.7 |
| 6→7 | 12,500 → 20,000 | 7,500 | ×1.6 |
| 7→8 | 20,000 → 30,000 | 10,000 | ×1.5 |
| 8→9 | 30,000 → 45,000 | 15,000 | ×1.5 |

The gaps grow but the **multiplier decelerates smoothly** (×2.5 → ×1.5) — a well-shaped curve: fast
early wins, a long, steady climb to the top.

### Rough progression (order-of-magnitude)

Assuming a solid ~10-question run at ~9/10 correct with a short streak ≈ **~170 XP/session**
(ignoring badges & daily-streak XP, which make it faster):

| Rank | ≈ sessions to reach |
|------|--------------------:|
| Scout (400) | ~3 |
| Wanderer (1,000) | ~6 |
| Pathfinder (2,200) | ~13 |
| Navigator (4,200) | ~25 |
| Voyager (7,500) | ~45 |
| Adventurer (12,500) | ~75 |
| Cartographer (20,000) | ~120 |
| Globetrotter (30,000) | ~175 |
| Legendary Explorer (45,000) | ~265 |

So Legend is a genuine end-game grind (a few hundred sessions); the first six ranks come quickly
enough to keep an early player rewarded.

---

## Review — do we need more ranks?

**Where the ladder is strong:** the naming/theme is coherent (an explorer's journey: flag → compass
→ signpost → … → crown), the badge system already encodes three tiers of granularity (metal × stars)
so ten named ranks read as **thirty visible steps**, and the XP curve is nicely tuned.

**The one real gap — the top is a wall, not a horizon.** Legend at 45,000 XP is terminal: a dedicated
player hits it and then _every future session shows the same maxed-out bar_ ("Top rank reached!").
For the exact profile of player who grinds to Legend, that's the moment the progression loop stops
rewarding them. Options, roughly in order of effort:

1. **Extend the ladder past Legend (recommended).** Add 2–4 prestige tiers above 45,000 keeping the
   same decelerating curve, e.g. **60,000 / 80,000 / 110,000 / 150,000**. New crystal/“mythic” metal
   or a coloured facet ring per prestige tier. Cheap: it's data in `RANKS` + `RANK_MEDALS` + names,
   and the medal component already supports a distinct top-tier look.
2. **Endless prestige levels.** After Legend, award "Legend II, III, …" every fixed chunk (say
   +15,000 XP) with a small numeral on the crown coin. Never-ending, minimal art, but less special.
3. **Leave it — treat Legend as a deliberate finish line.** Valid if we'd rather the endgame reward
   be the _Grandmaster Challenge_ track (a separate prestige system) than an ever-growing bar.

**Minor:** the early band 0→400→1,000 is quite dense (three ranks in the first ~6 sessions). That's
intentional onboarding dopamine and probably worth keeping, but if we add tiers at the top we could
optionally thin the bottom to keep the total count sane.

> ⚠️ **Proposal only.** Adding/renumbering ranks touches `RANKS`, `RANK_MEDALS`, the three locale
> files, and their pinned tests (`xp.test.ts`, `RankMedal.test.ts`, …). Not implemented — awaiting a
> go-ahead on which option (and which thresholds) you want.
