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

    // Generate CSV
    const headers = ['Roll Number', 'Name', 'Branch', 'Section', 'Question Title', 'Question Slug', 'Status', 'Completed At'];
    
    const rows = assignment.studentAssignments.map(sa => [
      sa.student.rollNumber,
      sa.student.name,
      sa.student.branch || '',
      sa.student.section || '',
      assignment.title || assignment.titleSlug,
      assignment.titleSlug,
      sa.status,
      sa.completedAt ? new Date(sa.completedAt).toISOString() : ''
    ]);

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
