import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const branches = await prisma.student.findMany({
      select: { branch: true },
      distinct: ['branch'],
      where: {
        branch: { not: null, not: '' }
      }
    });

    const branchList = branches.map(b => b.branch).sort();

    return NextResponse.json(branchList);
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
