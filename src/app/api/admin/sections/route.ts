import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');

    const sections = await prisma.student.findMany({
      select: { section: true },
      distinct: ['section'],
      where: {
        section: { not: null },
        ...(branch && branch.trim() !== '' && branch.toLowerCase() !== 'all'
          ? { branch: { equals: branch.trim(), mode: 'insensitive' } }
          : {}),
      },
    });

    const sectionList = sections
      .map(s => s.section)
      .filter((s): s is string => Boolean(s && s.trim() !== ''))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return NextResponse.json(sectionList);
  } catch (error: any) {
    console.error('Error fetching sections:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
