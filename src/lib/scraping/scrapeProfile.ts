import { extractUsername } from './urlAllowlist';

export type ScrapeStatus =
  | 'success'
  | 'partial_success'
  | 'private_profile'
  | 'invalid_url'
  | 'not_found'
  | 'rate_limited_retrying'
  | 'blocked_by_target'
  | 'timeout'
  | 'unknown_error'
  | 'pending';

export interface ScrapeResult {
  status: ScrapeStatus;
  solved_today: number | null;
  total_solved: number | null;
  easy_solved: number | null;
  medium_solved: number | null;
  hard_solved: number | null;
  global_rank: number | null;
  badges: number | null;
}

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const USER_PROFILE_QUERY = `
  query getUserProfile($username: String!) {
    matchedUser(username: $username) {
      username
      profile {
        ranking
      }
      badges {
        id
        name
      }
      submitStats {
        acSubmissionNum {
          difficulty
          count
        }
      }
      userCalendar {
        submissionCalendar
      }
    }
  }
`;

const RECENT_SUBMISSIONS_QUERY = `
  query recentAcSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

function getSolvesToday(submissionCalendarJson: string): number {
  try {
    const calendar: Record<string, number> = JSON.parse(submissionCalendarJson);
    // Find today's UNIX timestamp ranges (UTC day)
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime() / 1000;
    const endOfToday = startOfToday + 86400;

    let total = 0;
    for (const [timestampStr, count] of Object.entries(calendar)) {
      const ts = parseInt(timestampStr, 10);
      if (ts >= startOfToday && ts < endOfToday) {
        total += count;
      }
    }
    return total;
  } catch (e) {
    return 0;
  }
}

export async function scrapeProfile(url: string, controller?: AbortController): Promise<ScrapeResult> {
  const username = extractUsername(url);
  
  if (!username) {
    return { status: 'invalid_url', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
  }

  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Realistic user-agent (Security Spec §3.2)
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        query: USER_PROFILE_QUERY,
        variables: { username }
      }),
      signal: controller?.signal,
      cache: 'no-store'
    });

    if (response.status === 429 || response.status === 403) {
      // 403 can sometimes be a WAF/bot challenge blocking request
      return { status: 'rate_limited_retrying', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
    }

    if (!response.ok) {
      return { status: 'unknown_error', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
    }

    const data = await response.json();

    let responseData = data;
    
    // If there are permission errors, strip the offending fields and retry
    if (data.errors && data.errors.some((e: any) => e.message?.toLowerCase().includes('permission'))) {
      let retryQuery = USER_PROFILE_QUERY;
      
      for (const err of data.errors) {
        if (err.message?.toLowerCase().includes('permission')) {
          const field = err.path?.[err.path.length - 1];
          if (field === 'userCalendar') {
            retryQuery = retryQuery.replace(/userCalendar\s*\{\s*submissionCalendar\s*\}/g, '');
          } else if (field === 'submitStats') {
            retryQuery = retryQuery.replace(/submitStats\s*\{\s*acSubmissionNum\s*\{\s*difficulty\s*count\s*\}\s*\}/g, '');
          } else if (field === 'badges') {
            retryQuery = retryQuery.replace(/badges\s*\{\s*id\s*name\s*\}/g, '');
          } else if (field === 'profile') {
            retryQuery = retryQuery.replace(/profile\s*\{\s*ranking\s*\}/g, '');
          }
        }
      }

      const retryResponse = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          query: retryQuery,
          variables: { username }
        }),
        signal: controller?.signal,
        cache: 'no-store'
      });
      
      if (retryResponse.ok) {
        responseData = await retryResponse.json();
      }
    }

    if (responseData.errors && responseData.errors.length > 0) {
      // Check if user doesn't exist or is still failing
      const errorMsg = responseData.errors[0].message || '';
      if (errorMsg.includes('not found')) {
        return { status: 'not_found', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
      }
      return { status: 'unknown_error', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
    }

    if (!responseData.data || !responseData.data.matchedUser) {
      return { status: 'not_found', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
    }

    const matchedUser = responseData.data.matchedUser;
    const calendar = matchedUser.userCalendar;

    const global_rank = matchedUser.profile?.ranking ?? null;
    const badges = matchedUser.badges ? matchedUser.badges.length : 0;
    
    let total_solved = null;
    let easy_solved = null;
    let medium_solved = null;
    let hard_solved = null;
    if (matchedUser.submitStats?.acSubmissionNum) {
      const allStats = matchedUser.submitStats.acSubmissionNum.find((s: any) => s.difficulty === 'All');
      const easyStats = matchedUser.submitStats.acSubmissionNum.find((s: any) => s.difficulty === 'Easy');
      const mediumStats = matchedUser.submitStats.acSubmissionNum.find((s: any) => s.difficulty === 'Medium');
      const hardStats = matchedUser.submitStats.acSubmissionNum.find((s: any) => s.difficulty === 'Hard');
      
      if (allStats) total_solved = allStats.count;
      if (easyStats) easy_solved = easyStats.count;
      if (mediumStats) medium_solved = mediumStats.count;
      if (hardStats) hard_solved = hardStats.count;
    }
    
    let solved_today = null;
    if (calendar && calendar.submissionCalendar) {
      solved_today = getSolvesToday(calendar.submissionCalendar);
    }

    // If any field is missing but overall query succeeded, mark as partial
    let status: ScrapeStatus = 'success';
    if (global_rank === null && solved_today === null && total_solved === null) {
      // If we got matchedUser but no stats, might be a private profile
      status = 'private_profile';
    } else if (global_rank === null || solved_today === null || total_solved === null) {
      status = 'partial_success';
    }

    return { status, solved_today, total_solved, easy_solved, medium_solved, hard_solved, global_rank, badges };
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { status: 'timeout', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
    }
    return { status: 'unknown_error', solved_today: null, total_solved: null, easy_solved: null, medium_solved: null, hard_solved: null, global_rank: null, badges: null };
  }
}
const difficultyCache: Map<string, string> = new Map();

export async function resolveQuestionDifficulties(titleSlugs: string[]): Promise<Record<string, string>> {
  if (!titleSlugs || titleSlugs.length === 0) return {};

  const uniqueSlugs = Array.from(new Set(titleSlugs.filter(Boolean)));
  const result: Record<string, string> = {};
  const missingSlugs: string[] = [];

  // 1. Check in-memory cache
  for (const slug of uniqueSlugs) {
    if (difficultyCache.has(slug)) {
      result[slug] = difficultyCache.get(slug)!;
    } else {
      missingSlugs.push(slug);
    }
  }

  if (missingSlugs.length === 0) return result;

  // 2. Check Database for known difficulties for these slugs
  try {
    const { prisma } = await import('@/lib/prisma');
    const existing = await prisma.submission.findMany({
      where: {
        titleSlug: { in: missingSlugs },
        difficulty: { in: ['Easy', 'Medium', 'Hard'] }
      },
      select: { titleSlug: true, difficulty: true },
      distinct: ['titleSlug']
    });

    for (const item of existing) {
      if (item.difficulty) {
        difficultyCache.set(item.titleSlug, item.difficulty);
        result[item.titleSlug] = item.difficulty;
      }
    }
  } catch (e) {
    // Non-fatal if DB query fails, continue to GraphQL
  }

  // 3. For any slugs still missing, fetch from LeetCode GraphQL in batches
  const stillMissing = missingSlugs.filter(slug => !difficultyCache.has(slug));
  if (stillMissing.length > 0) {
    const BATCH_SIZE = 25;
    for (let i = 0; i < stillMissing.length; i += BATCH_SIZE) {
      const batch = stillMissing.slice(i, i + BATCH_SIZE);
      const fields = batch.map((slug, idx) => `q_${idx}: question(titleSlug: "${slug}") { difficulty }`).join('\n');
      const query = `query {\n${fields}\n}`;

      try {
        const response = await fetch(LEETCODE_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: JSON.stringify({ query }),
          cache: 'no-store'
        });

        if (response.ok) {
          const json = await response.json();
          if (json?.data) {
            batch.forEach((slug, idx) => {
              const diff = json.data[`q_${idx}`]?.difficulty;
              if (diff) {
                difficultyCache.set(slug, diff);
                result[slug] = diff;
              }
            });
          }
        }
      } catch (e) {
        console.error('Error fetching difficulties from LeetCode GraphQL:', e);
      }
    }
  }

  // Fill any unresolved as 'Unknown'
  for (const slug of uniqueSlugs) {
    if (!result[slug]) {
      result[slug] = difficultyCache.get(slug) || 'Unknown';
    }
  }

  return result;
}

export async function fetchRecentAcSubmissions(username: string, limit: number = 50) {
  try {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        query: RECENT_SUBMISSIONS_QUERY,
        variables: { username, limit }
      }),
      cache: 'no-store'
    });

    if (!response.ok) return [];

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      // Permission error or other error, safely fallback to no submissions
      return [];
    }
    
    const submissions = data?.data?.recentAcSubmissionList || [];
    
    // Attach difficulty
    if (submissions.length > 0) {
      const slugs = submissions.map((s: any) => s.titleSlug);
      const diffMap = await resolveQuestionDifficulties(slugs);
      return submissions.map((s: any) => ({
        ...s,
        difficulty: diffMap[s.titleSlug] || 'Unknown'
      }));
    }
    
    return submissions;
  } catch (error) {
    console.error('Error fetching recent submissions for', username, error);
    return [];
  }
}
