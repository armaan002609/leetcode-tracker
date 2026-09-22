import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        studentAssignments: {
          include: {
            student: true
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Sort by Roll Number to match portal arrangement
    const sortedAssignments = [...assignment.studentAssignments].sort((a, b) => 
      a.student.rollNumber.localeCompare(b.student.rollNumber)
    );

    // Generate CSV matching portal arrangement
    const headers = [
      'Roll Number', 'Name', 'Branch', 'Semester', 'Section', 'Mentor', 'URL',
      'Assignment Question', 'Assignment Status', 'Completed At',
      'Total Solved', 'Easy Solved', 'Medium Solved', 'Hard Solved', 
      'Solved Today', 'Global Rank', 'Badges', 'Last Scraped'
    ];
    
    const rows = sortedAssignments.map(sa => {
      const s = sa.student;
      const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(date);
      };

      return [
        s.rollNumber,
        s.name,
        s.branch || '',
        s.semester || '',
        s.section || '',
        s.mentor || '',
        s.url,
        assignment.title || assignment.titleSlug,
        sa.status,
        sa.completedAt ? formatDate(new Date(sa.completedAt)) : '',
        s.totalSolved?.toString() || '0',
        s.easySolved?.toString() || '0',
        s.mediumSolved?.toString() || '0',
        s.hardSolved?.toString() || '0',
        s.solvedToday?.toString() || '0',
        s.globalRank?.toString() || '0',
        s.badges?.toString() || '0',
        s.lastScrapedAt ? formatDate(new Date(s.lastScrapedAt)) : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="assignment_${assignment.titleSlug}_report.csv"`
      }
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
