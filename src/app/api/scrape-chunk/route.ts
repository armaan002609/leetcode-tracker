import { NextResponse } from 'next/server';
import { scrapeProfile, ScrapeStatus } from '@/lib/scraping/scrapeProfile';
import { scrapeSemaphore, delayWithJitter } from '@/lib/scraping/rateLimiter';
import { z } from 'zod';

export const maxDuration = 300; // 5 minutes max per serverless invocation

const ChunkSchema = z.object({
  rows: z.array(z.object({
    id: z.string(),
    url: z.string().url()
  }))
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ChunkSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { rows } = parsed.data;
    
    // Process rows concurrently, bounded by the semaphore to respect LeetCode limits
    const results = await Promise.all(
      rows.map(async (row) => {
        await scrapeSemaphore.acquire();
        try {
          // Delay to prevent detection / smooth out requests
          await delayWithJitter();
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s per row timeout
          
          const result = await scrapeProfile(row.url, controller);
          clearTimeout(timeoutId);
          
          return { id: row.id, ...result };
        } catch (err) {
          return { 
            id: row.id, 
            status: 'unknown_error' as ScrapeStatus, 
            solved_today: null, 
            global_rank: null, 
            badges: null 
          };
        } finally {
          scrapeSemaphore.release();
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
