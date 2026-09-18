import { StudentRow } from '../validation/rowSchema';

// Neutralizes spreadsheet formula injection (Security Spec §4.2)
function neutralizeCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Match prefix '=', '+', '-', '@', tab, carriage return
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function generateCsv(rows: StudentRow[]): string {
  const headers = [
    'Roll Number', 'Name', 'Branch', 'Semester', 'Section', 'Mentor Name', 'LeetCode URL', 
    'Status', 'Solved Today', 'Total Solved', 'Easy Solved', 'Medium Solved', 'Hard Solved', 'Global Rank', 'Badges'
  ];
  
  let csv = headers.map(escapeCsv).join(',') + '\n';
  
  for (const row of rows) {
    const r = [
      row.rollNumber,
      row.name,
      row.branch ?? '',
      row.semester ?? '',
      row.section ?? '',
      row.mentor,
      row.url,
      row.status,
      row.solved_today ?? '',
      row.total_solved ?? '',
      row.easy_solved ?? '',
      row.medium_solved ?? '',
      row.hard_solved ?? '',
      row.global_rank ?? '',
      row.badges ?? ''
    ].map(val => escapeCsv(neutralizeCell(val)));
    
    csv += r.join(',') + '\n';
  }
  
  return csv;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
