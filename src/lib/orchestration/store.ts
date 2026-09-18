import { StudentRow } from '../validation/rowSchema';

export function saveJobToSession(jobId: string, rows: StudentRow[]) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(`leetcode_job_${jobId}`, JSON.stringify(rows));
    // Also save the latest jobId for the dashboard
    sessionStorage.setItem('leetcode_last_job', jobId);
  }
}

export function loadJobFromSession(jobId: string): StudentRow[] | null {
  if (typeof window !== 'undefined') {
    const data = sessionStorage.getItem(`leetcode_job_${jobId}`);
    return data ? JSON.parse(data) : null;
  }
  return null;
}

export function getLastJobId(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('leetcode_last_job');
  }
  return null;
}
