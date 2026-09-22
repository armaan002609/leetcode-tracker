import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all submissions with student details
    const submissions = await prisma.submission.findMany({
      include: {
        student: true
      },
      orderBy: [
        { student: { rollNumber: 'asc' } },
        { timestamp: 'desc' }
      ]
    });

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
      }).format(date);
    };

    const headers = [
      'Roll Number', 'Name', 'Branch', 'Semester', 'Section', 'Mentor', 
      'Question Title', 'Question Slug', 'Completed At'
    ];
    
    const rows = submissions.map(sub => {
      const s = sub.student;
      return [
        s.rollNumber,
        s.name,
        s.branch || '',
        s.semester || '',
        s.section || '',
        s.mentor || '',
        sub.title,
        sub.titleSlug,
        formatDate(new Date(sub.timestamp))
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="all_solved_questions_report.csv"`
      }
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
