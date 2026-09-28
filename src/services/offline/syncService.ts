import { openDB, DBSchema } from 'idb';

interface ExamDBSchema extends DBSchema {
  offline_answers: {
    key: string;
    value: {
      attemptId: string;
      questionId: string;
      selectedOptionId?: string;
      timestamp: string;
    };
  };
  cached_exams: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'AccessibleExamOfflineDB';

export async function getOfflineDB() {
  return openDB<ExamDBSchema>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline_answers')) {
        db.createObjectStore('offline_answers', { keyPath: 'questionId' });
      }
      if (!db.objectStoreNames.contains('cached_exams')) {
        db.createObjectStore('cached_exams', { keyPath: 'id' });
      }
    },
  });
}

export async function saveAnswerOffline(attemptId: string, questionId: string, selectedOptionId?: string) {
  const db = await getOfflineDB();
  await db.put('offline_answers', {
    attemptId,
    questionId,
    selectedOptionId,
    timestamp: new Date().toISOString()
  });
  console.log('[Offline Engine]: Saved response locally to IndexedDB.');
}

export async function getCachedOfflineAnswers() {
  const db = await getOfflineDB();
  return db.getAll('offline_answers');
}