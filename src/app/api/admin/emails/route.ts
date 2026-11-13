import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin privileges required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // 'all', 'missing', 'has_email'

    const where: any = {};
    if (search) {
      where.OR = [
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filter === 'missing') {
      where.OR = [
        { email: null },
        { email: '' },
      ];
    } else if (filter === 'has_email') {
      where.AND = [
        { email: { not: null } },
        { email: { not: '' } },
      ];
    }

    const [totalStudents, studentsWithEmail, students] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({
        where: {
          email: { not: null },
          NOT: { email: '' },
        }
      }),
      prisma.student.findMany({
        where,
        take: 100,
        orderBy: { rollNumber: 'asc' },
        select: {
          id: true,
          rollNumber: true,
          name: true,
          email: true,
          branch: true,
          section: true,
        }
      })
    ]);

    return NextResponse.json({
      totalStudents,
      studentsWithEmail,
      studentsWithoutEmail: totalStudents - studentsWithEmail,
      students,
    });
  } catch (error: any) {
    console.error('Error in /api/admin/emails GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin privileges required.' }, { status: 401 });
    }

    const body = await req.json();

    // Case 1: Bulk array of updates [{ rollNumber, email }]
    if (Array.isArray(body.updates)) {
      const updates: Array<{ rollNumber: string; email: string }> = body.updates.filter(
        (u: any) => u.rollNumber && u.email && typeof u.email === 'string' && u.email.includes('@')
      );

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No valid rollNumber + email pairs provided.' }, { status: 400 });
      }

      let updatedCount = 0;
      const notFound: string[] = [];

      // Process in chunks of 50
      const CHUNK_SIZE = 50;
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async ({ rollNumber, email }) => {
            const cleanRoll = String(rollNumber).trim();
            const cleanEmail = String(email).trim().toLowerCase();
            const res = await prisma.student.updateMany({
              where: { rollNumber: cleanRoll },
              data: { email: cleanEmail },
            });
            if (res.count > 0) {
              updatedCount += res.count;
            } else {
              notFound.push(cleanRoll);
            }
          })
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${updatedCount} student emails.`,
        updatedCount,
        notFoundCount: notFound.length,
        notFound: notFound.slice(0, 50),
      });
    }

    // Case 2: Single student manual update { rollNumber, email }
    if (body.rollNumber) {
      const cleanRoll = String(body.rollNumber).trim();
      const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : null;

      const student = await prisma.student.findUnique({
        where: { rollNumber: cleanRoll },
      });

      if (!student) {
        return NextResponse.json({ error: `Student with roll number "${cleanRoll}" not found.` }, { status: 404 });
      }

      const updated = await prisma.student.update({
        where: { rollNumber: cleanRoll },
        data: { email: cleanEmail },
        select: {
          id: true,
          rollNumber: true,
          name: true,
          email: true,
        }
      });

      return NextResponse.json({
        success: true,
        message: `Updated email for ${updated.name} (${updated.rollNumber}).`,
        student: updated,
      });
    }

    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in /api/admin/emails POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
