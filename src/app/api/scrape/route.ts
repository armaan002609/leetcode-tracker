import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeProfile } from '@/lib/scraping/scrapeProfile';

export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = (session.user as any).role === 'admin';
    const userId = (session.user as any).id;

    const { rollNumbers } = await req.json();

    if (!Array.isArray(rollNumbers) || rollNumbers.length === 0) {
      return NextResponse.json({ error: 'Provide an array of rollNumbers to scrape' }, { status: 400 });
    }

    // Fetch the students from DB, scoped to permissions
    const students = await prisma.student.findMany({
      where: { 
        rollNumber: { in: rollNumbers },
        ...(isAdmin ? {} : { assignedUserId: userId || "missing-id" })
      }
    });

    if (students.length === 0) {
      return NextResponse.json({ error: 'No matching students found' }, { status: 404 });
    }

    // Scrape them (we do this sequentially here for simplicity, but could be chunked for very large arrays)
    let successCount = 0;
    
    for (const student of students) {
      if (!student.url) continue;
      
      const result = await scrapeProfile(student.url);
      
      // Update DB
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

      // Check Assignments
      const pendingAssignments = await prisma.studentAssignment.findMany({
        where: {
          studentId: student.id,
          status: 'pending'
        },
        include: {
          assignment: true
        }
      });

      const { extractUsername } = await import('@/lib/scraping/urlAllowlist');
      const { fetchRecentAcSubmissions } = await import('@/lib/scraping/scrapeProfile');
      const username = extractUsername(student.url);
      
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

    return NextResponse.json({ message: `Successfully scraped ${successCount} profiles` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
