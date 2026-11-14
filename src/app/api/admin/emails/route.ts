import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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
      const rawUpdates: Array<{ rollNumber: string; email: string }> = body.updates.filter(
        (u: any) => u.rollNumber && u.email && typeof u.email === 'string' && u.email.includes('@')
      );

      if (rawUpdates.length === 0) {
        return NextResponse.json({ error: 'No valid rollNumber + email pairs provided.' }, { status: 400 });
      }

      // Deduplicate updates by roll number (case-insensitive, trimmed)
      const emailByRoll = new Map<string, string>();
      for (const u of rawUpdates) {
        const roll = String(u.rollNumber).trim();
        const email = String(u.email).trim().toLowerCase();
        if (roll && email && email.includes('@')) {
          emailByRoll.set(roll.toLowerCase(), email);
        }
      }

      const rollList = Array.from(emailByRoll.keys());

      // 1. Fetch matching students in batches of 500 using indexed query
      const existingStudents: Array<{ id: string; rollNumber: string }> = [];
      const BATCH_SIZE = 500;
      for (let i = 0; i < rollList.length; i += BATCH_SIZE) {
        const batch = rollList.slice(i, i + BATCH_SIZE);
        const found = await prisma.student.findMany({
          where: {
            rollNumber: { in: batch, mode: 'insensitive' }
          },
          select: {
            id: true,
            rollNumber: true,
          }
        });
        existingStudents.push(...found);
      }

      // 2. Map existing students by lowercase roll number
      const studentMap = new Map<string, string>(); // lowerRoll -> studentId
      for (const s of existingStudents) {
        studentMap.set(s.rollNumber.trim().toLowerCase(), s.id);
      }

      const toUpdate: Array<{ id: string; email: string; rollNumber: string }> = [];
      const notFound: string[] = [];

      for (const u of rawUpdates) {
        const cleanRoll = String(u.rollNumber).trim();
        const cleanEmail = String(u.email).trim().toLowerCase();
        const studentId = studentMap.get(cleanRoll.toLowerCase());
        if (studentId) {
          toUpdate.push({
            id: studentId,
            email: cleanEmail,
            rollNumber: cleanRoll,
          });
        } else {
          if (!notFound.includes(cleanRoll)) {
            notFound.push(cleanRoll);
          }
        }
      }

      let updatedCount = 0;

      // 3. Ultra-fast bulk update using PostgreSQL VALUES in a single query
      if (toUpdate.length > 0) {
        try {
          const SQL_CHUNK = 250;
          for (let i = 0; i < toUpdate.length; i += SQL_CHUNK) {
            const chunk = toUpdate.slice(i, i + SQL_CHUNK);
            const valueRows = chunk.map(
              item => Prisma.sql`(${item.id}::text, ${item.email}::text)`
            );
            await prisma.$executeRaw`
              UPDATE "Student" AS s
              SET "email" = c.email,
                  "updatedAt" = NOW()
              FROM (VALUES ${Prisma.join(valueRows)}) AS c(id, email)
              WHERE s.id = c.id
            `;
            updatedCount += chunk.length;
          }
        } catch (rawError) {
          console.warn('Bulk raw SQL update failed, falling back to sequential Prisma updates:', rawError);
          // Safe fallback: sequential loop (one connection at a time, never exhausts pool)
          for (const item of toUpdate) {
            try {
              await prisma.student.update({
                where: { id: item.id },
                data: { email: item.email }
              });
              updatedCount++;
            } catch (err) {
              console.error(`Failed to update student ${item.rollNumber}:`, err);
            }
          }
        }
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

      let student = await prisma.student.findUnique({
        where: { rollNumber: cleanRoll },
      });

      if (!student) {
        student = await prisma.student.findFirst({
          where: { rollNumber: { equals: cleanRoll, mode: 'insensitive' } }
        });
      }

      if (!student) {
        return NextResponse.json({ error: `Student with roll number "${cleanRoll}" not found.` }, { status: 404 });
      }

      const updated = await prisma.student.update({
        where: { id: student.id },
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
