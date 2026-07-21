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
  FAMILIES,
  REVIEW_MODES,
  ATTRIBUTE_MODES,
  MULTI_SELECT_MODES,
  CAPITAL_MODES,
  LANGUAGE_MODES,
  INDUSTRY_MODES,
  EXTRA_TOPICS,
  type MasteryFamily,
  isAttributeMode,
  isMultiSelectMode,
  isIndustryMode,
  isMasteryMode,
  masteryFamilyOf,
} from './modes';

export { type Rng, defaultRng, mulberry32, randomInt, shuffle, sample } from './rng';

export {
  DEFAULT_CHOICES,
  MAX_QUIZ_LANGUAGES,
  type GenerateOptions,
  itemKey,
  hasOptions,
  isMapMode,
  isLanguageQuizEligible,
  isIndustryQuizEligible,
  languageOptionCount,
  filterCountries,
  eligibleAnswers,
  selectDistractors,
  selectLanguageDistractors,
  selectIndustryDistractors,
  pickCorrectIndustry,
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
  recommend,
} from './recommend';

export { type RegionReview, type ReviewByRegionOptions, reviewByRegion } from './review';

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
  type FamilyTally,
  type FamilyMasteryRollup,
  type RegionFamilyMastery,
  type FamilyMasteryResult,
  type RegionFamilyPractice,
  type PracticeSlot,
  MASTERY_MIN_REPETITIONS,
  PRACTICE_COMBINE_THRESHOLD,
  isItemMastered,
  masteryFraction,
  computeMastery,
  computeFamilyMastery,
  regionFamilyPracticePool,
} from './mastery';

export {
  type AchievementContext,
  type AchievementDef,
  type AchievementStatus,
  type ExtraTopic,
  CONTINENTS,
  SPEEDY_MIN_QUESTIONS,
  SPEEDY_MAX_AVG_MS,
  CENTURY_TARGET,
  EXTRA_COLLECTOR_TARGET,
  EXTRA_CENTURY_TARGET,
  CAPITALS_COLLECTOR_TARGET,
  CAPITALS_CENTURY_TARGET,
  STREAK_BADGE_DAYS,
  GRANDMASTER_TOTAL,
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  evaluateAchievements,
} from './achievements';

export { type WeeklyRecap, type RecapOptions, localWeekStart, computeWeeklyRecap } from './recap';

export {
  type PracticeEligibility,
  togglePractice,
  addToPractice,
  removeFromPractice,
  practiceEligibility,
} from './practice';

export {
  type MascotPose,
  type MascotMotion,
  type MascotReaction,
  type SummaryReactionInput,
  pickSummaryReaction,
  isStreakMilestone,
  pickStreakReaction,
} from './mascot';

export {
  type XpSourceKey,
  type XpSource,
  type XpResult,
  type XpInput,
  type Rank,
  type RankProgress,
  XP_PER_CORRECT,
  XP_PER_QUESTION,
  XP_PER_SESSION,
  XP_PER_STREAK_DAY,
  XP_PER_BADGE,
  STREAK_MILESTONE_XP,
  EST_XP_PER_GAME,
  EST_MINUTES_PER_GAME,
  RANKS,
  computeXp,
  sessionXp,
  sessionXpBreakdown,
  rankForXp,
  estimateReach,
} from './xp';

export {
  type BlitzBestQuery,
  type BlitzBestEntry,
  type BlitzSetBestQuery,
  BLITZ_MODES,
  blitzAllows,
  computeBlitzSetBest,
  BLITZ_START_SECONDS,
  BLITZ_CAP_SECONDS,
  BLITZ_BONUS_SECONDS,
  BLITZ_BASE_POINTS,
  BLITZ_MAX_COMBO,
  BLITZ_TIER_WINDOWS_MS,
  type BlitzComboState,
  blitzCombo,
  blitzComboWindowMs,
  blitzPointsForCorrect,
  computeBlitzPoints,
  blitzComboStreak,
  blitzTiersLost,
  blitzComboState,
  blitzDecayedCombo,
  blitzRunSeconds,
  blitzEarnedSeconds,
  blitzRemainingMs,
  computeBlitzBest,
  computeBlitzBests,
  blitzSlotMatches,
} from './blitz';

export {
  type ChallengeSlot,
  type ChallengeState,
  type ChallengeConfig,
  type ChallengeSummary,
  type AvailableChallenge,
  familyModes,
  isChallengeUnlocked,
  availableChallenges,
  buildChallengeQueue,
  challengeSlotCount,
  estimateChallengeMinutes,
  CHALLENGE_SECONDS_PER_SLOT,
  buildChallengeQuestion,
  ChallengeSession,
  createChallenge,
} from './challenge';

export {
  DUEL_PROTOCOL_VERSION,
  MIN_DUEL_QUESTIONS,
  type DuelType,
  type DuelScore,
  type DuelVerdict,
  type DuelPayload,
  type DuelDecodeError,
  type DuelDecodeResult,
  isDuelType,
  duelScore,
  duelVerdict,
  encodeDuel,
  decodeDuel,
} from './duel';

export {
  GM_INVITE_PROTOCOL_VERSION,
  type GrandmasterInvitePayload,
  type GmInviteDecodeError,
  type GmInviteDecodeResult,
  isMasteryFamily,
  encodeGmInvite,
  decodeGmInvite,
} from './grandmaster-invite';
