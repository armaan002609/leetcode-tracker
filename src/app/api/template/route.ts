import { NextResponse } from 'next/server';

export async function GET() {
  const csvContent = 'Roll Number,Name,Email,Branch,Semester,Section,Mentor Name,LeetCode URL\n101,John Doe,johndoe@example.com,CSE,5,A,Jane Smith,https://leetcode.com/johndoe\n';
  
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="leetcode_tracker_template.csv"'
    }
  });
}
