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

    const allAssignments = await prisma.assignment.findMany({ orderBy: { createdAt: 'asc' } });
    
    const allStudentAssignments = await prisma.studentAssignment.findMany({
      include: {
        student: true,
        assignment: true
      }
    });

    // Group by student
    const studentMap = new Map();
    for (const sa of allStudentAssignments) {
      if (!studentMap.has(sa.student.id)) {
        studentMap.set(sa.student.id, {
          student: sa.student,
          assignments: {}
        });
      }
      studentMap.get(sa.student.id).assignments[sa.assignmentId] = sa;
    }

    // Sort students by roll number
    const sortedStudents = Array.from(studentMap.values()).sort((a, b) => 
      a.student.rollNumber.localeCompare(b.student.rollNumber)
    );

    const headers = [
      'Roll Number', 'Name', 'Branch', 'Semester', 'Section', 'Mentor', 'URL',
      'Total Solved', 'Easy Solved', 'Medium Solved', 'Hard Solved', 'Global Rank',
      ...allAssignments.map(a => a.title || a.titleSlug)
    ];
    
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
      }).format(date);
    };

    const rows = sortedStudents.map(data => {
      const s = data.student;
      const assignmentsObj = data.assignments;

      const baseRow = [
        s.rollNumber,
        s.name,
        s.branch || '',
        s.semester || '',
        s.section || '',
        s.mentor || '',
        s.url,
        s.totalSolved?.toString() || '0',
        s.easySolved?.toString() || '0',
        s.mediumSolved?.toString() || '0',
        s.hardSolved?.toString() || '0',
        s.globalRank?.toString() || '0'
      ];

      const assignmentCells = allAssignments.map(a => {
        const sa = assignmentsObj[a.id];
        if (!sa) return 'Not Assigned';
        if (sa.status === 'completed') {
          return sa.completedAt ? `Completed (${formatDate(new Date(sa.completedAt))})` : 'Completed';
        }
        return 'Pending';
      });

      return [...baseRow, ...assignmentCells];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="all_assignments_pivot_report.csv"`
      }
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
