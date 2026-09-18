import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeProfile } from '@/lib/scraping/scrapeProfile';

export async function GET(req: Request) {
  // A CRON endpoint is typically triggered by a Vercel cron scheduler with an authorization header
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const students = await prisma.student.findMany();
    let successCount = 0;
    
    // In a real production scenario, this should be done in batches or pushed to a queue
    // to avoid serverless timeouts for large databases.
    for (const student of students) {
      if (!student.url) continue;
      
      // Adding a small delay to prevent rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = await scrapeProfile(student.url);
      
      await prisma.student.update({
        where: { id: student.id },
        data: {
          status: result.status,
          solvedToday: result.solved_today,
          totalSolved: result.total_solved,
          easySolved: result.easy_solved,
          mediumSolved: result.medium_solved,
          hardSolved: result.hard_solved,
          globalRank: result.global_rank,
          badges: result.badges,
          lastScrapedAt: new Date(),
        }
      });
      successCount++;
    }

    return NextResponse.json({ message: `Cron job completed. Refreshed ${successCount} profiles.` });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
