import Papa from 'papaparse';
import { StudentInputSchema, StudentRow } from './rowSchema';

const getVal = (row: any, keys: string[]) => {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k);
    if (match && row[match] != null) return String(row[match]).trim();
  }
  return '';
};

export async function parseCsv(file: File): Promise<{ rows: Omit<StudentRow, 'id'>[], errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: Omit<StudentRow, 'id'>[] = [];
        const errors: string[] = [];
        
        results.data.forEach((row: any, index: number) => {
          const rawRow = {
            rollNumber: getVal(row, ['rollnumber', 'rollno', 'id', 'roll']),
            name: getVal(row, ['name', 'studentname', 'student']),
            branch: getVal(row, ['branch', 'department', 'dept']),
            semester: getVal(row, ['semester', 'sem']),
            section: getVal(row, ['section', 'sec']),
            mentor: getVal(row, ['mentorname', 'mentor']),
            url: getVal(row, ['leetcodeurl', 'url', 'leetcode', 'link', 'leetcodepublicprofilelink']),
          };

          const parsed = StudentInputSchema.safeParse(rawRow);
          if (parsed.success) {
            rows.push({
              ...parsed.data,
              status: 'pending',
              solved_today: null,
              total_solved: null,
              easy_solved: null,
              medium_solved: null,
              hard_solved: null,
              global_rank: null,
              badges: null,
            });
          } else {
            const errorMsg = parsed.error.issues.map((e: any) => e.message).join(', ');
            rows.push({
              ...rawRow,
              status: 'pending',
              solved_today: null,
              total_solved: null,
              easy_solved: null,
              medium_solved: null,
              hard_solved: null,
              global_rank: null,
              badges: null,
              validationError: `Row ${index + 2}: ${errorMsg}`
            });
            errors.push(`Row ${index + 2}: ${errorMsg}`);
          }
        });
        
        resolve({ rows, errors });
      },
      error: (error) => {
        resolve({ rows: [], errors: [error.message] });
      }
    });
  });
}
