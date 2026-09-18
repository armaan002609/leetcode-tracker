import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StudentInputSchema } from '@/lib/validation/rowSchema';
import { z } from 'zod';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Input array schema
const UploadSchema = z.array(StudentInputSchema);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = (session.user as any).role === 'admin';
    const userId = (session.user as any).id;

    const students = await prisma.student.findMany({
      where: isAdmin ? undefined : { assignedUserId: userId || "missing-id" },
      orderBy: [
        { section: 'asc' },
        { rollNumber: 'asc' },
        { name: 'asc' }
      ]
    });
    return NextResponse.json(students);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const parsed = UploadSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data format', details: parsed.error }, { status: 400 });
    }

    const studentsToUpsert = parsed.data;

    // We use a transaction to upsert all students
    // SQLite does not support createMany with skipDuplicates very well in some versions,
    // so we can loop and upsert
    const results = await prisma.$transaction(
      studentsToUpsert.map(student => 
        prisma.student.upsert({
          where: { rollNumber: student.rollNumber },
          update: {
            name: student.name,
            branch: student.branch,
            semester: student.semester,
            section: student.section,
            mentor: student.mentor,
            url: student.url,
            // DO NOT OVERWRITE scrape stats on re-upload
          },
          create: {
            rollNumber: student.rollNumber,
            name: student.name,
            branch: student.branch,
            semester: student.semester,
            section: student.section,
            mentor: student.mentor,
            url: student.url,
            status: 'pending'
          }
        })
      )
    );

    return NextResponse.json({ message: 'Successfully uploaded', count: results.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.student.deleteMany();
    return NextResponse.json({ message: 'All student data cleared successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

