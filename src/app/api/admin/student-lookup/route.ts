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

    const { searchParams } = new URL(req.url);
    const rollNumber = searchParams.get('rollNumber');

    if (!rollNumber) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { rollNumber },
      include: {
        submissions: {
          orderBy: { timestamp: 'desc' },
          take: 50, // Get top 50 recent submissions
        },
      }
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error: any) {
    console.error('Error in student lookup:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
