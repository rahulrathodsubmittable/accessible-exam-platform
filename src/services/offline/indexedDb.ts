import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AnswerInput } from '../../types';

// Every answer is written here first, so nothing is lost if the connection
// drops mid-exam. Unsynced answers are re-sent when the browser is back online.

export interface StoredAnswer extends AnswerInput {
  key: string;
  attemptId: string;
  updatedAt: number;
  synced: boolean;
}

interface OfflineSchema extends DBSchema {
  answers: {
    key: string;
    value: StoredAnswer;
    indexes: { byAttempt: string };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

function getDb() {
  dbPromise ??= openDB<OfflineSchema>('accessible-exam-offline', 1, {
    upgrade(db) {
      const store = db.createObjectStore('answers', { keyPath: 'key' });
      store.createIndex('byAttempt', 'attemptId');
    },
  });
  return dbPromise;
}

// IndexedDB can be unavailable (e.g. some private windows); never let that break an exam.
async function safely<T>(fallback: T, run: (db: IDBPDatabase<OfflineSchema>) => Promise<T>): Promise<T> {
  try {
    return await run(await getDb());
  } catch (err) {
    console.warn('[offline] IndexedDB unavailable:', err);
    return fallback;
  }
}

export const offlineDb = {
  saveAnswer: (attemptId: string, answer: AnswerInput, synced: boolean) => {
    const record: StoredAnswer = { ...answer, key: `${attemptId}:${answer.questionId}`, attemptId, updatedAt: Date.now(), synced };
    return safely(record, async (db) => {
      await db.put('answers', record);
      return record;
    });
  },

  /** Marks an answer synced, unless it was changed again after that save started. */
  markSynced: (record: StoredAnswer) =>
    safely(undefined, async (db) => {
      const current = await db.get('answers', record.key);
      if (current && current.updatedAt === record.updatedAt) await db.put('answers', { ...current, synced: true });
    }),

  getAnswers: (attemptId: string) => safely<StoredAnswer[]>([], (db) => db.getAllFromIndex('answers', 'byAttempt', attemptId)),

  clearAttempt: (attemptId: string) =>
    safely(undefined, async (db) => {
      const tx = db.transaction('answers', 'readwrite');
      for (const key of await tx.store.index('byAttempt').getAllKeys(attemptId)) await tx.store.delete(key);
      await tx.done;
    }),
};
