import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveQuestionDifficulties } from '@/lib/scraping/scrapeProfile';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: studentId } = await params;
    
    // Fetch the 50 most recent submissions for this student from the DB
    const submissions = await prisma.submission.findMany({
      where: { studentId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // Check if any submissions have missing or Unknown difficulty
    const unknownSlugs = Array.from(new Set(
      submissions
        .filter(s => !s.difficulty || s.difficulty === 'Unknown')
        .map(s => s.titleSlug)
    ));

    let diffMap: Record<string, string> = {};
    if (unknownSlugs.length > 0) {
      diffMap = await resolveQuestionDifficulties(unknownSlugs);

      // Backfill resolved difficulties into DB in the background
      (async () => {
        try {
          for (const [slug, diff] of Object.entries(diffMap)) {
            if (diff && diff !== 'Unknown') {
              await prisma.submission.updateMany({
                where: {
                  titleSlug: slug,
                  OR: [{ difficulty: null }, { difficulty: 'Unknown' }]
                },
                data: { difficulty: diff }
              });
            }
          }
        } catch (e) {
          console.error('Failed to backfill difficulties in DB:', e);
        }
      })();
    }

    // Map to response format
    const mapped = submissions.map(sub => {
      const resolved = (sub.difficulty && sub.difficulty !== 'Unknown')
        ? sub.difficulty
        : (diffMap[sub.titleSlug] || sub.difficulty || 'Unknown');

      return {
        id: sub.id,
        title: sub.title,
        titleSlug: sub.titleSlug,
        timestamp: (new Date(sub.timestamp).getTime() / 1000).toString(),
        difficulty: resolved
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
