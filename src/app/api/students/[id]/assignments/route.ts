import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reconcileStudentAssignments } from '@/lib/scraping/titleNormalizer';
import { MOCK_DEMO_ASSIGNMENTS } from '@/lib/demoData';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;

    if (studentId && studentId.startsWith('demo-')) {
      return NextResponse.json(MOCK_DEMO_ASSIGNMENTS);
    }

    // Automatically reconcile pending assignments against any matching stored submissions
    await reconcileStudentAssignments(studentId).catch(() => {});
    
    const assignments = await prisma.studentAssignment.findMany({
      where: { studentId },
      include: {
        assignment: true
      },
      orderBy: { assignment: { createdAt: 'desc' } }
    });

    if (!assignments || assignments.length === 0) {
      return NextResponse.json(MOCK_DEMO_ASSIGNMENTS);
    }

    return NextResponse.json(assignments);
  } catch (error: any) {
    return NextResponse.json(MOCK_DEMO_ASSIGNMENTS);
  }
}
