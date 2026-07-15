// Persistence layer barrel (Phase 6).

export type {
  AchievementUnlock,
  CustomSet,
  DailyResult,
  MapProjection,
  Prefs,
  ProgressionState,
  QuizStore,
  SessionRecord,
  SRItem,
} from './types';
export { DEFAULT_PREFS, MAP_PROJECTIONS, PREFS_BOUNDS, clampPrefs, isMapProjection } from './types';
export { openStore } from './store';
export { IdbQuizStore } from './idb-store';
export { MemoryQuizStore } from './memory-store';
