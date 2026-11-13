import { NextResponse } from 'next/server';

export async function GET() {
  const csv = 'Roll Number,Email\n2420816,student@example.com\n2420817,another.student@example.com\n';
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="student_emails_template.csv"',
    },
  });
}
