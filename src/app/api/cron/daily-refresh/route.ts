import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeProfile, fetchRecentAcSubmissions } from '@/lib/scraping/scrapeProfile';
import { extractUsername } from '@/lib/scraping/urlAllowlist';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // To handle 20,000+ students, we scrape a chunk of 500 students at a time.
    // Ordered by `lastScrapedAt` ascending (nulls first) so everyone is updated eventually.
    const students = await prisma.student.findMany({
      take: 500,
      orderBy: [
        { lastScrapedAt: 'asc' }
      ]
    });
    
    let successCount = 0;
    
    for (const student of students) {
      if (!student.url) continue;
      
      const username = extractUsername(student.url);
      if (!username) continue;

      // Small delay to prevent rate limits within the chunk
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Scrape Profile Stats
      const result = await scrapeProfile(student.url);
      
      // Update basic student stats
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

      const pendingAssignments = await prisma.studentAssignment.findMany({
        where: {
          studentId: student.id,
          status: 'pending'
        },
        include: {
          assignment: true
        }
      });

      if (username) {
        // Always fetch and save recent submissions for the dashboard UI
        const recentSubmissions = await fetchRecentAcSubmissions(username, 50);
        
        if (recentSubmissions && recentSubmissions.length > 0) {
          // Save to DB (ignoring duplicates)
          await prisma.submission.createMany({
            data: recentSubmissions.map((sub: any) => ({
              studentId: student.id,
              title: sub.title,
              titleSlug: sub.titleSlug,
              timestamp: new Date(parseInt(sub.timestamp) * 1000)
            })),
            skipDuplicates: true
          });

          // Evaluate assignments
          if (pendingAssignments.length > 0) {
            for (const pa of pendingAssignments) {
              const match = recentSubmissions.find((sub: any) => sub.titleSlug === pa.assignment.titleSlug);
              if (match) {
                await prisma.studentAssignment.update({
                  where: { id: pa.id },
                  data: {
                    status: 'completed',
                    completedAt: new Date(parseInt(match.timestamp) * 1000)
                  }
                });
              }
            }
          }
        }
      }

      successCount++;
    }

    return NextResponse.json({ message: `Cron job completed. Refreshed ${successCount} profiles.` });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
