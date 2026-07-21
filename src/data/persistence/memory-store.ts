// In-memory fallback store (Phase 6).
//
// Used when IndexedDB is unavailable (private-mode browsers, disabled storage, or a
// failed open) so the app still runs — data simply lives for the page's lifetime and
// is lost on reload. `persistent` is `false` so the UI can warn the user. It doubles
// as the unit-test double for anything that depends on a `QuizStore`.

import type {
  AchievementUnlock,
  CustomSet,
  DailyResult,
  GrandmasterRecord,
  IdentityRecord,
  Prefs,
  ProgressionState,
  QuizStore,
  SessionRecord,
  SRItem,
} from './types';

export class MemoryQuizStore implements QuizStore {
  readonly persistent = false;

  private sessions: SessionRecord[] = [];
  private srItems = new Map<string, SRItem>();
  private prefs: Prefs | undefined;
  private daily: DailyResult | undefined;
  private achievements = new Map<string, AchievementUnlock>();
  private customSets = new Map<string, CustomSet>();
  private progression: ProgressionState | undefined;
  private grandmaster = new Map<string, GrandmasterRecord>();
  private identity: IdentityRecord | undefined;

  async addSession(record: SessionRecord): Promise<void> {
    this.sessions.push(record);
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    // Return a sorted copy so callers can't mutate our backing array.
    return [...this.sessions].sort((a, b) => a.startedAt - b.startedAt);
  }

  async clearSessions(): Promise<void> {
    this.sessions = [];
  }

  async getPrefs(): Promise<Prefs | undefined> {
    return this.prefs ? { ...this.prefs } : undefined;
  }

  async savePrefs(prefs: Prefs): Promise<void> {
    this.prefs = { ...prefs };
  }

  async getSRItem(itemKey: string): Promise<SRItem | undefined> {
    const item = this.srItems.get(itemKey);
    return item ? { ...item } : undefined;
  }

  async putSRItem(item: SRItem): Promise<void> {
    this.srItems.set(item.itemKey, { ...item });
  }

  async getAllSRItems(): Promise<SRItem[]> {
    return [...this.srItems.values()].map((i) => ({ ...i }));
  }

  async clearSRItems(): Promise<void> {
    this.srItems.clear();
  }

  async getDailyResult(): Promise<DailyResult | undefined> {
    return this.daily ? { ...this.daily } : undefined;
  }

  async saveDailyResult(result: DailyResult): Promise<void> {
    this.daily = { ...result };
  }

  async clearDailyResult(): Promise<void> {
    this.daily = undefined;
  }

  async getAchievements(): Promise<AchievementUnlock[]> {
    return [...this.achievements.values()].map((a) => ({ ...a }));
  }

  async putAchievement(unlock: AchievementUnlock): Promise<void> {
    this.achievements.set(unlock.id, { ...unlock });
  }

  async clearAchievements(): Promise<void> {
    this.achievements.clear();
  }

  async getCustomSets(): Promise<CustomSet[]> {
    // Deep-copy so callers can't mutate our backing rows (iso2 is a nested array).
    return [...this.customSets.values()].map((s) => ({ ...s, iso2: [...s.iso2] }));
  }

  async putCustomSet(set: CustomSet): Promise<void> {
    this.customSets.set(set.id, { ...set, iso2: [...set.iso2] });
  }

  async deleteCustomSet(id: string): Promise<void> {
    this.customSets.delete(id);
  }

  async clearCustomSets(): Promise<void> {
    this.customSets.clear();
  }

  async getProgression(): Promise<ProgressionState | undefined> {
    return this.progression ? { ...this.progression } : undefined;
  }

  async saveProgression(state: ProgressionState): Promise<void> {
    this.progression = { ...state };
  }

  async clearProgression(): Promise<void> {
    this.progression = undefined;
  }

  async getGrandmasterRecords(): Promise<GrandmasterRecord[]> {
    return [...this.grandmaster.values()].map((r) => ({ ...r }));
  }

  async putGrandmasterRecord(record: GrandmasterRecord): Promise<void> {
    this.grandmaster.set(record.key, { ...record });
  }

  async clearGrandmaster(): Promise<void> {
    this.grandmaster.clear();
  }

  async getIdentity(): Promise<IdentityRecord | undefined> {
    return this.identity ? { ...this.identity } : undefined;
  }

  async saveIdentity(identity: IdentityRecord): Promise<void> {
    this.identity = { ...identity };
  }

  async clearIdentity(): Promise<void> {
    this.identity = undefined;
  }
}
