import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reconcileStudentAssignments } from '@/lib/scraping/titleNormalizer';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;

    // Automatically reconcile pending assignments against any matching stored submissions
    await reconcileStudentAssignments(studentId);
    
    const assignments = await prisma.studentAssignment.findMany({
      where: { studentId },
      include: {
        assignment: true
      },
      orderBy: { assignment: { createdAt: 'desc' } }
    });

    return NextResponse.json(assignments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
