import * as XLSX from 'xlsx';
import { StudentInputSchema, StudentRow } from './rowSchema';

const getVal = (row: any, keys: string[]) => {
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k);
    if (match && row[match] != null) return String(row[match]).trim();
  }
  return '';
};

export async function parseXlsx(file: File): Promise<{ rows: Omit<StudentRow, 'id'>[], errors: string[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const results = XLSX.utils.sheet_to_json(firstSheet) as any[];

        const rows: Omit<StudentRow, 'id'>[] = [];
        const errors: string[] = [];

        results.forEach((row, index) => {
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
              badges: null 
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
      } catch (err: any) {
        resolve({ rows: [], errors: [err.message] });
      }
    };
    reader.onerror = () => {
      resolve({ rows: [], errors: ['Failed to read file'] });
    };
    reader.readAsArrayBuffer(file);
  });
}
