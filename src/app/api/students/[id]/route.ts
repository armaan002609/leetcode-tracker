import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const { name, rollNumber, branch, semester, section, mentor, url } = body;

    // Optional: check if new rollNumber already exists
    if (rollNumber) {
      const existing = await prisma.student.findUnique({ where: { rollNumber } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'Roll number already exists.' }, { status: 400 });
      }
    }

    const updated = await prisma.student.update({
      where: { id },
      data: {
        name,
        rollNumber,
        branch,
        semester,
        section,
        mentor,
        url
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
