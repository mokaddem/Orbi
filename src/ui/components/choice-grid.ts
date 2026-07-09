// Shared option shape for ChoiceGrid.
//
// Country-identification modes and attribute modes (Phase 24 capitals; later languages /
// industries) both normalize their options to this so the grid stays a single, reusable
// multiple-choice surface. The caller does the localization and supplies the `country`
// only when a flag needs rendering.

import type { Country } from '../../data';

export interface ChoiceOption {
  /** Stable id, unique within a question: ISO2 for country options, the attribute id otherwise. */
  id: string;
  /** The text shown on the option, already localized by the caller. */
  label: string;
  /** The country, present only when the option renders a flag ('flag' / 'name-flag'). */
  country?: Country;
}
