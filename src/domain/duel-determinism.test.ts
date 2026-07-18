// Determinism guard (Phase 46) — the fairness invariant a duel rides on.
//
// A duel is only fair if the challengee, replaying `(config, seed)`, faces the *exact* same round —
// same question order AND same distractor options — no matter what their own spaced-repetition
// state, play history, or prefs are. The pure `QuizSession` takes none of those as input (only
// `config` + an injected `rng`), so this is true by construction; this test locks it in against a
// regression that might sneak ambient state (e.g. `Math.random`, `Date.now`) into generation.

import { describe, it, expect } from 'vitest';
import type { Country } from '../data/types';
import { mulberry32 } from './rng';
import { QuizSession } from './session';
import type { SessionConfig } from './session';

function mk(iso2: string, region: string, subregion: string): Country {
  return {
    iso2,
    iso3: (iso2 + 'Z').toUpperCase(),
    numericId: '000',
    name: { en: iso2, fr: iso2, de: iso2 },
    capital: { en: `${iso2}-cap`, fr: `${iso2}-cap`, de: `${iso2}-cap` },
    languages: [{ code: iso2.toLowerCase(), name: { en: iso2, fr: iso2, de: iso2 } }],
    industries: [{ key: `ind-${iso2.toLowerCase()}`, name: { en: iso2, fr: iso2, de: iso2 } }],
    region,
    subregion,
    flagAsset: `flags/${iso2.toLowerCase()}.svg`,
    hasGeometry: true,
  };
}

// A universe big enough that order + distractor choice are non-trivial.
const UNIVERSE: Country[] = Array.from({ length: 24 }, (_, i) =>
  mk(`C${String(i).padStart(2, '0')}`, 'R1', i < 12 ? 'S1' : 'S2'),
);

/** Play a full fixed run and capture the (itemKey, option-id list) sequence — the "round". */
function playRound(seed: number, extra: Partial<SessionConfig> = {}): string[] {
  const session = new QuizSession({
    mode: 'flag-to-country',
    type: 'fixed',
    countries: UNIVERSE,
    fixedLength: 15,
    choices: 4,
    rng: mulberry32(seed),
    ...extra,
  });
  const trace: string[] = [];
  let q = session.next();
  while (q) {
    const options = (q.options ?? []).map((o) => o.iso2).join(',');
    trace.push(`${q.itemKey}|${options}`);
    session.submit(null); // the pick doesn't affect the sequence for a fixed run
    q = session.next();
  }
  return trace;
}

describe('duel determinism guard', () => {
  it('same (config, seed) ⇒ identical question + distractor sequence', () => {
    const a = playRound(0x1234);
    const b = playRound(0x1234);
    expect(b).toEqual(a);
    expect(a).toHaveLength(15);
  });

  it('is independent of ambient Math.random / Date.now between runs', () => {
    const a = playRound(0x1234);
    // Churn ambient randomness + time — a leak into generation would show here.
    for (let i = 0; i < 5000; i += 1) Math.random();
    void Date.now();
    const b = playRound(0x1234);
    expect(b).toEqual(a);
  });

  it('is independent of a different injected clock (timing must not touch generation)', () => {
    const a = playRound(0x1234, { now: () => 1 });
    const b = playRound(0x1234, { now: () => 9_999_999 });
    expect(b).toEqual(a);
  });

  it('different seeds ⇒ different rounds (the seed actually drives it)', () => {
    expect(playRound(0x1234)).not.toEqual(playRound(0x9999));
  });
});
