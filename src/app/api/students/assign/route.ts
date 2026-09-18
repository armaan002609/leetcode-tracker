import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

export const dynamic = 'force-dynamic';
import { authOptions } from '@/lib/auth';

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rollNumbers, userId } = await req.json();

    if (!Array.isArray(rollNumbers)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Assign multiple students to the specified user
    await prisma.student.updateMany({
      where: { rollNumber: { in: rollNumbers } },
      data: { assignedUserId: userId === "unassign" ? null : userId }
    });

    return NextResponse.json({ message: 'Students assigned successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
