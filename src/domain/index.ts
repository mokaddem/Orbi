// Domain layer: pure, framework-agnostic game logic.
//
// The question generator, distractor selection, answer checking, the play-session
// state machine, stats aggregation, the SM-2 spaced-repetition scheduler, and training
// selection live here. Everything is free of Svelte and DOM APIs and deterministic
// given an injected RNG / clock, so it is unit-testable.

export type {
  GameMode,
  AttributeOption,
  SessionType,
  RegionFilter,
  Question,
  QuestionResult,
  SessionStatus,
  SessionState,
  SessionSummary,
} from './types';

export {
  ALL_MODES,
  MASTERY_MODES,
  ATTRIBUTE_MODES,
  CAPITAL_MODES,
  isAttributeMode,
  isMasteryMode,
} from './modes';

export { type Rng, defaultRng, mulberry32, randomInt, shuffle, sample } from './rng';

export {
  DEFAULT_CHOICES,
  type GenerateOptions,
  itemKey,
  hasOptions,
  isMapMode,
  filterCountries,
  eligibleAnswers,
  selectDistractors,
  buildQuestion,
  drawAnswerSequence,
  generateQuestions,
  checkAnswer,
} from './questions';

export {
  DEFAULT_FIXED_LENGTH,
  DEFAULT_LIVES,
  type SessionConfig,
  QuizSession,
  createSession,
} from './session';

export {
  type MissedCountry,
  type DailyStat,
  type StatsOverview,
  type RegionAccuracy,
  type RegionResolver,
  dayKey,
  computeStats,
  computeRegionAccuracy,
} from './stats';

export {
  type SRQuality,
  DEFAULT_EASE,
  MIN_EASE,
  MS_PER_DAY,
  FAST_ANSWER_MS,
  SLOW_ANSWER_MS,
  PASS_GRADE,
  newSRItem,
  gradeAnswer,
  scheduleNext,
} from './sr';

export {
  type TrainingItem,
  type SelectTrainingOptions,
  parseItemKey,
  selectTrainingItems,
  dominantTrainingMode,
} from './training';

export {
  type RecommendationKind,
  type RecommendationRun,
  type Recommendation,
  type RecommendOptions,
  DEFAULT_DUE_LIMIT,
  DEFAULT_WEAK_SPOT_MIN_ATTEMPTS,
  DEFAULT_WEAK_SPOT_MAX_ACCURACY,
  recommend,
} from './recommend';

export { type StreakInfo, localDayKey, computeStreak } from './streak';

export {
  type DailyChallenge,
  DAILY_LENGTH,
  DAILY_CHOICES,
  dailySeed,
  buildDailyChallenge,
} from './daily';

export {
  type MasteryState,
  type MasteryRollup,
  type RegionMastery,
  type MasteryResult,
  type MasteryCountry,
  type MasteryOptions,
  MASTERY_MIN_REPETITIONS,
  isItemMastered,
  masteryFraction,
  computeMastery,
} from './mastery';

export {
  type AchievementContext,
  type AchievementDef,
  type AchievementStatus,
  CONTINENTS,
  SPEEDY_MIN_QUESTIONS,
  SPEEDY_MAX_AVG_MS,
  CENTURY_TARGET,
  CAPITALS_COLLECTOR_TARGET,
  CAPITALS_CENTURY_TARGET,
  STREAK_BADGE_DAYS,
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  evaluateAchievements,
} from './achievements';

export { type WeeklyRecap, type RecapOptions, localWeekStart, computeWeeklyRecap } from './recap';
