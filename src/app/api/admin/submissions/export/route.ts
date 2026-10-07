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

    const students = await prisma.student.findMany({ orderBy: { rollNumber: 'asc' } });
    const submissions = await prisma.submission.findMany({ orderBy: { timestamp: 'desc' } });

    const uniqueQuestionsMap = new Map<string, string>();
    const studentSubmissions = new Map<string, Map<string, Date>>();

    for (const sub of submissions) {
      if (!uniqueQuestionsMap.has(sub.titleSlug)) {
        uniqueQuestionsMap.set(sub.titleSlug, sub.title);
      }
      
      let sMap = studentSubmissions.get(sub.studentId);
      if (!sMap) {
        sMap = new Map();
        studentSubmissions.set(sub.studentId, sMap);
      }
      if (!sMap.has(sub.titleSlug)) {
        sMap.set(sub.titleSlug, sub.timestamp);
      }
    }

    const uniqueQuestionSlugs = Array.from(uniqueQuestionsMap.keys()).sort();

    const headers = [
      'Roll Number', 'Name', 'Branch', 'Semester', 'Section', 'Mentor', 'URL',
      'Total Solved', 'Easy Solved', 'Medium Solved', 'Hard Solved', 'Global Rank',
      ...uniqueQuestionSlugs.map(slug => uniqueQuestionsMap.get(slug) || slug)
    ];

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
      }).format(date);
    };

    const rows = students.map(s => {
      const sMap = studentSubmissions.get(s.id) || new Map();

      const baseRow = [
        s.rollNumber,
        s.name,
        s.branch || '',
        s.semester || '',
        s.section || '',
        s.mentor || '',
        s.url || '',
        s.totalSolved?.toString() || '0',
        s.easySolved?.toString() || '0',
        s.mediumSolved?.toString() || '0',
        s.hardSolved?.toString() || '0',
        s.globalRank?.toString() || '0'
      ];

      const questionCells = uniqueQuestionSlugs.map(slug => {
        const timestamp = sMap.get(slug);
        return timestamp ? `Completed (${formatDate(new Date(timestamp))})` : 'Pending';
      });

      return [...baseRow, ...questionCells];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="all_solved_questions_pivot_report.csv"`
      }
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
