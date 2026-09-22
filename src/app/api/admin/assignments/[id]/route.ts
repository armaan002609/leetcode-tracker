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
            student: {
              select: {
                id: true,
                rollNumber: true,
                name: true,
                branch: true,
                section: true
              }
            }
          },
          orderBy: {
            student: {
              rollNumber: 'asc'
            }
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    await prisma.assignment.delete({ where: { id } });
    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const { title, targetBranch, targetSection } = body;

    const assignment = await prisma.assignment.update({
      where: { id },
      data: {
        title,
        targetBranch: targetBranch || null,
        targetSection: targetSection || null,
      }
    });

    const filter: any = {};
    if (targetBranch) filter.branch = targetBranch;
    if (targetSection) filter.section = targetSection;

    const students = await prisma.student.findMany({ where: filter });
    const studentIds = students.map(s => s.id);

    await prisma.studentAssignment.deleteMany({
      where: {
        assignmentId: id,
        studentId: { notIn: studentIds.length > 0 ? studentIds : ['dummy'] } // if no students, delete all
      }
    });

    if (students.length > 0) {
      const existingSubmissions = await prisma.submission.findMany({
        where: {
          titleSlug: assignment.titleSlug,
          studentId: { in: studentIds }
        }
      });
      
      const submissionMap = new Map();
      existingSubmissions.forEach(sub => {
        if (!submissionMap.has(sub.studentId)) {
          submissionMap.set(sub.studentId, sub.timestamp);
        }
      });

      const studentAssignmentsData = students.map(student => {
        const completedAt = submissionMap.get(student.id);
        return {
          studentId: student.id,
          assignmentId: assignment.id,
          status: completedAt ? 'completed' : 'pending',
          completedAt: completedAt || null
        };
      });

      await prisma.studentAssignment.createMany({
        data: studentAssignmentsData,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ message: 'Updated successfully', assignment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
