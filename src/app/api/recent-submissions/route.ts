import { NextResponse } from 'next/server';
import { extractUsername } from '@/lib/scraping/urlAllowlist';

export const dynamic = 'force-dynamic';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

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

const QUESTION_DIFFICULTY_QUERY = `
  query questionTitle($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      difficulty
    }
  }
`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const username = extractUsername(urlParam);
  if (!username) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const res = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        query: RECENT_SUBMISSIONS_QUERY,
        variables: { username, limit: 10 }
      })
    });

    const data = await res.json();
    const submissions = data?.data?.recentAcSubmissionList || [];

    if (submissions.length === 0) {
      return NextResponse.json([]);
    }

    // Now fetch difficulty for each unique slug
    const enrichedSubmissions = await Promise.all(
      submissions.map(async (sub: any) => {
        try {
          const qRes = await fetch(LEETCODE_GRAPHQL_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
            body: JSON.stringify({
              query: QUESTION_DIFFICULTY_QUERY,
              variables: { titleSlug: sub.titleSlug }
            })
          });
          const qData = await qRes.json();
          const difficulty = qData?.data?.question?.difficulty || 'Unknown';
          return { ...sub, difficulty };
        } catch {
          return { ...sub, difficulty: 'Unknown' };
        }
      })
    );

    return NextResponse.json(enrichedSubmissions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
