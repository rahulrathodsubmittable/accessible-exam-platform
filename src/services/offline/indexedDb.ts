import { openDB } from 'idb';

const DB_NAME = 'AccessibleExamOffline';

export const initOfflineDb = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('answers')) {
        db.createObjectStore('answers', { keyPath: 'questionId' });
      }
      if (!db.objectStoreNames.contains('attempts')) {
        db.createObjectStore('attempts', { keyPath: 'attemptId' });
      }
    },
  });
};

export const offlineDb = {
  answers: {
    put: async (data: any) => {
      const db = await initOfflineDb();
      return db.put('answers', data);
    },
    getAll: async () => {
      const db = await initOfflineDb();
      return db.getAll('answers');
    },
    clear: async () => {
      const db = await initOfflineDb();
      return db.clear('answers');
    }
  }
};