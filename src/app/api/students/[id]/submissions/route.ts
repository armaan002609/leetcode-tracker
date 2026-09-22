import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;
    
    // Fetch the 50 most recent submissions for this student from the DB
    const submissions = await prisma.submission.findMany({
      where: { studentId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // We map them to the same shape as the old LeetCode API response
    // so the frontend doesn't break.
    const mapped = submissions.map(sub => ({
      id: sub.id,
      title: sub.title,
      titleSlug: sub.titleSlug,
      timestamp: (new Date(sub.timestamp).getTime() / 1000).toString(),
      difficulty: sub.difficulty || 'Unknown' 
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
