import { NextResponse } from 'next/server';

export async function GET() {
  const csvContent = [
    'Sr,Roll No,Enrollment No,Stream,Semester,Class,Lab Batch,Student Name',
    '1,2401003013,2420673,BTAIDS,5,A,A2,Armaan',
    '2,2401003067,2420636,BTAIDS,5,A,A1,Abhishek Kumar',
  ].join('\n') + '\n';

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="student-portal-credentials-template.csv"',
    },
  });
}
