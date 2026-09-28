import { useCallback, useEffect, useState } from 'react';
import { offlineDb } from '../services/offline/indexedDb';
import { serverApi } from '../services/serverApi';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return isOnline;
}

/** Re-sends answers saved locally while offline whenever the connection returns. */
export function useOfflineSync(attemptId: string) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);

  const flush = useCallback(async () => {
    const unsynced = (await offlineDb.getAnswers(attemptId)).filter((a) => !a.synced);
    let remaining = unsynced.length;
    setPendingCount(remaining);
    for (const record of unsynced) {
      try {
        const { questionId, selectedOptionIndex, isSkipped, isMarked } = record;
        await serverApi.saveAnswer(attemptId, { questionId, selectedOptionIndex, isSkipped, isMarked });
        await offlineDb.markSynced(record);
        remaining -= 1;
        setPendingCount(remaining);
      } catch {
        break; // Still offline or the server refused; try again later.
      }
    }
  }, [attemptId]);

  useEffect(() => {
    if (isOnline) void flush();
  }, [isOnline, flush]);

  return { isOnline, pendingCount, flush };
}
