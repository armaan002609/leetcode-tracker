import { useState, useCallback, useRef } from 'react';
import { StudentRow } from '../validation/rowSchema';
import { ScrapeResult } from '../scraping/scrapeProfile';

const CHUNK_SIZE = 15;

export function useChunkedRun(initialRows: StudentRow[]) {
  const [rows, setRows] = useState<StudentRow[]>(initialRows);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const rowsRef = useRef<StudentRow[]>(initialRows);

  // Keep ref in sync
  const updateRows = useCallback((newRows: StudentRow[] | ((prev: StudentRow[]) => StudentRow[])) => {
    setRows(prev => {
      const next = typeof newRows === 'function' ? newRows(prev) : newRows;
      rowsRef.current = next;
      return next;
    });
  }, []);

  const startRun = useCallback(async (specificIds?: string[]) => {
    setIsRunning(true);
    setGlobalError(null);
    setIsCompleted(false);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Identify rows to run
    let targetIds = specificIds || rowsRef.current.map(r => r.id);
    let pendingRows = rowsRef.current.filter(r => 
      targetIds.includes(r.id) && 
      (r.status === 'pending' || r.status === 'timeout' || r.status === 'rate_limited_retrying' || r.status === 'unknown_error')
    );

    if (pendingRows.length === 0) {
      setIsRunning(false);
      setIsCompleted(true);
      return;
    }

    // Set UI to pending for target rows
    updateRows(prev => prev.map(r => pendingRows.find(p => p.id === r.id) ? { ...r, status: 'pending' } : r));

    let runError = null;

    for (let i = 0; i < pendingRows.length; i += CHUNK_SIZE) {
      if (signal.aborted) break;

      const chunk = pendingRows.slice(i, i + CHUNK_SIZE);
      const payload = { rows: chunk.map(r => ({ id: r.id, url: r.url })) };

      try {
        const res = await fetch('/api/scrape-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        });

        if (!res.ok) {
          if (res.status === 429) {
            runError = "Rate limited by LeetCode. Pausing briefly before you can retry.";
            break;
          }
          throw new Error('Chunk request failed');
        }

        const data = await res.json();
        const results: (ScrapeResult & { id: string })[] = data.results;

        // Apply results
        updateRows(prev => prev.map(row => {
          const result = results.find(r => r.id === row.id);
          if (result) {
            return {
              ...row,
              status: result.status,
              solved_today: result.solved_today,
              total_solved: result.total_solved,
              easy_solved: result.easy_solved,
              medium_solved: result.medium_solved,
              hard_solved: result.hard_solved,
              global_rank: result.global_rank,
              badges: result.badges
            };
          }
          return row;
        }));

      } catch (err: any) {
        if (err.name === 'AbortError') break;
        runError = err.message || 'An unexpected error occurred during batch processing.';
        
        // Mark chunk as error
        updateRows(prev => prev.map(row => {
          if (chunk.find(c => c.id === row.id)) {
            return { ...row, status: 'unknown_error' };
          }
          return row;
        }));
        break; // Stop on network level error
      }
    }

    setIsRunning(false);
    if (!signal.aborted && !runError) {
      setIsCompleted(true);
    } else if (runError) {
      setGlobalError(runError);
    }
  }, []);

  const stopRun = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  }, []);

  const retryFailed = useCallback(() => {
    const failedIds = rowsRef.current
      .filter(r => ['timeout', 'rate_limited_retrying', 'unknown_error'].includes(r.status))
      .map(r => r.id);
    startRun(failedIds);
  }, [startRun]);

  const retryRow = useCallback((id: string) => {
    startRun([id]);
  }, [startRun]);

  return { rows, setRows: updateRows, isRunning, isCompleted, globalError, startRun, stopRun, retryFailed, retryRow };
}
