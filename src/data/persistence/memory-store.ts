// In-memory fallback store (Phase 6).
//
// Used when IndexedDB is unavailable (private-mode browsers, disabled storage, or a
// failed open) so the app still runs — data simply lives for the page's lifetime and
// is lost on reload. `persistent` is `false` so the UI can warn the user. It doubles
// as the unit-test double for anything that depends on a `QuizStore`.

import type {
  AchievementUnlock,
  DailyResult,
  Prefs,
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
}
