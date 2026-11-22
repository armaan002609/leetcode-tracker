import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MOCK_DEMO_STUDENTS } from '@/lib/demoData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      orderBy: [
        { rollNumber: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        rollNumber: true,
        name: true,
        branch: true,
        semester: true,
        section: true,
        mentor: true,
        url: true,
        status: true,
        solvedToday: true,
        totalSolved: true,
        easySolved: true,
        mediumSolved: true,
        hardSolved: true,
        globalRank: true,
        badges: true,
        lastScrapedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedUser: {
          select: {
            id: true,
            username: true,
            role: true
          }
        }
      }
    });

    if (students && students.length > 0) {
      return NextResponse.json(students);
    }
  } catch (error) {
    console.warn("Notice: Prisma student fetch in demo mode fell back to demo fixtures:", error);
  }

  // Fallback to high-quality realistic mock dataset if DB is empty or during cold start
  return NextResponse.json(MOCK_DEMO_STUDENTS);
}

export async function POST() {
  return NextResponse.json({ error: "Demo mode is read-only. Data mutations are disabled." }, { status: 403 });
}

export async function PUT() {
  return NextResponse.json({ error: "Demo mode is read-only. Data mutations are disabled." }, { status: 403 });
}

export async function DELETE() {
  return NextResponse.json({ error: "Demo mode is read-only. Data mutations are disabled." }, { status: 403 });
}
