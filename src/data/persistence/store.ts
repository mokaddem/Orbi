// Store factory (Phase 6): open the durable IndexedDB store, or fall back to memory.
//
// Any failure to reach IndexedDB — no `indexedDB` global, a private-mode browser that
// exposes but blocks it, a rejected open — degrades gracefully to an in-memory store.
// Callers read `store.persistent` to decide whether to warn that progress won't save.

import { IdbQuizStore } from './idb-store';
import { MemoryQuizStore } from './memory-store';
import type { QuizStore } from './types';

/** Whether an `indexedDB` global is even present (it isn't in some sandboxes/SSR). */
function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/**
 * Resolve a usable {@link QuizStore}. Tries IndexedDB first; on any error returns an
 * in-memory store (`persistent === false`) so the app keeps working without saving.
 */
export async function openStore(): Promise<QuizStore> {
  if (!hasIndexedDB()) return new MemoryQuizStore();
  try {
    return await IdbQuizStore.open();
  } catch {
    return new MemoryQuizStore();
  }
}
