import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;
    
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
