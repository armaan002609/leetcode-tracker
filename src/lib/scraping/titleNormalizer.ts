import { prisma } from '@/lib/prisma';

const ROMAN_TO_ARABIC: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
  xi: '11',
  xii: '12',
  xiii: '13',
  xiv: '14',
  xv: '15',
  xvi: '16',
};

const ARABIC_TO_ROMAN: Record<string, string> = {
  '1': 'ii', // Note: in practice '1' is rarely 'i' in LeetCode problem titles, but we handle it
  '2': 'ii',
  '3': 'iii',
  '4': 'iv',
  '5': 'v',
  '6': 'vi',
  '7': 'vii',
  '8': 'viii',
  '9': 'ix',
  '10': 'x',
};

/**
 * Normalizes a question title or slug into a canonical alphanumeric string.
 * Examples:
 * - "Coin Change II" -> "coinchange2"
 * - "coin-change-2" -> "coinchange2"
 * - "coin-change-ii" -> "coinchange2"
 * - "Two Sum II - Input Array Is Sorted" -> "twosum2inputarrayissorted"
 * - "3Sum" -> "3sum"
 * - "3-sum" -> "3sum"
 */
export function normalizeQuestionKey(input?: string | null): string {
  if (!input) return '';

  let str = input.toLowerCase().trim();

  // Separate letters and digits: e.g. "change2" -> "change 2", "3sum" -> "3 sum"
  str = str.replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');

  // Replace all non-alphanumeric chars with spaces
  str = str.replace(/[^a-z0-9]/g, ' ');

  // Split into tokens
  const tokens = str.split(/\s+/).filter(Boolean);

  // Convert roman numerals to arabic numerals, skipping filler words like "part"
  const mapped: string[] = [];
  for (const t of tokens) {
    if (t === 'part') continue;
    if (ROMAN_TO_ARABIC[t]) {
      mapped.push(ROMAN_TO_ARABIC[t]);
    } else {
      mapped.push(t);
    }
  }

  return mapped.join('');
}

/**
 * Robustly checks if an assignment matches a submission.
 * Handles differences like:
 * - "coin-change-2" vs "coin-change-ii" / "Coin Change II"
 * - "two-sum-ii" vs "two-sum-2"
 * - Title vs TitleSlug variations
 */
export function isAssignmentMatch(
  assignment: { title?: string | null; titleSlug: string },
  submission: { title?: string | null; titleSlug: string }
): boolean {
  if (!assignment || !submission) return false;

  // 1. Exact case-insensitive titleSlug match
  if (assignment.titleSlug && submission.titleSlug) {
    if (assignment.titleSlug.toLowerCase() === submission.titleSlug.toLowerCase()) {
      return true;
    }
  }

  const asgnSlugNorm = normalizeQuestionKey(assignment.titleSlug);
  const subSlugNorm = normalizeQuestionKey(submission.titleSlug);

  // 2. Normalized titleSlug match
  if (asgnSlugNorm && subSlugNorm && asgnSlugNorm === subSlugNorm) {
    return true;
  }

  const asgnTitleNorm = normalizeQuestionKey(assignment.title);
  const subTitleNorm = normalizeQuestionKey(submission.title);

  // 3. Normalized title match
  if (asgnTitleNorm && subTitleNorm && asgnTitleNorm === subTitleNorm) {
    return true;
  }

  // 4. Cross titleSlug vs title match
  if (asgnSlugNorm && subTitleNorm && asgnSlugNorm === subTitleNorm) {
    return true;
  }
  if (asgnTitleNorm && subSlugNorm && asgnTitleNorm === subSlugNorm) {
    return true;
  }

  return false;
}

/**
 * Generates variants of a slug and title (swapping roman numerals with numbers and vice versa)
 * for SQL/Prisma querying.
 */
export function getQuestionVariants(slug?: string | null, title?: string | null): { slugs: string[]; titles: string[] } {
  const slugs = new Set<string>();
  const titles = new Set<string>();

  if (slug) {
    const s = slug.toLowerCase().trim();
    slugs.add(s);

    const parts = s.split('-');
    const arabicParts = parts.map(p => ROMAN_TO_ARABIC[p] || p);
    const romanParts = parts.map(p => ARABIC_TO_ROMAN[p] || p);

    slugs.add(arabicParts.join('-'));
    slugs.add(romanParts.join('-'));

    titles.add(parts.join(' '));
    titles.add(arabicParts.join(' '));
    titles.add(romanParts.join(' '));
  }

  if (title) {
    const t = title.trim();
    titles.add(t);
    const words = t.split(/\s+/);
    const arabicWords = words.map(w => ROMAN_TO_ARABIC[w.toLowerCase()] || w);
    const romanWords = words.map(w => {
      const lower = w.toLowerCase();
      if (ARABIC_TO_ROMAN[lower]) {
        return ARABIC_TO_ROMAN[lower].toUpperCase();
      }
      return w;
    });

    titles.add(arabicWords.join(' '));
    titles.add(romanWords.join(' '));
    slugs.add(words.map(w => w.toLowerCase()).join('-'));
    slugs.add(arabicWords.map(w => w.toLowerCase()).join('-'));
    slugs.add(romanWords.map(w => w.toLowerCase()).join('-'));
  }

  return {
    slugs: Array.from(slugs).filter(Boolean),
    titles: Array.from(titles).filter(Boolean),
  };
}

/**
 * Reconciles pending assignments for a specific student against their stored submissions.
 * Updates matching pending assignments to 'completed' with submission timestamp.
 * Returns the list of reconciled assignment IDs.
 */
export async function reconcileStudentAssignments(studentId: string): Promise<string[]> {
  try {
    const pendingAssignments = await prisma.studentAssignment.findMany({
      where: {
        studentId,
        status: 'pending',
      },
      include: {
        assignment: true,
      },
    });

    if (pendingAssignments.length === 0) {
      return [];
    }

    const submissions = await prisma.submission.findMany({
      where: { studentId },
      orderBy: { timestamp: 'desc' },
    });

    if (submissions.length === 0) {
      return [];
    }

    const reconciledIds: string[] = [];
    const updates: { id: string; completedAt: Date }[] = [];

    for (const pa of pendingAssignments) {
      const match = submissions.find(sub => isAssignmentMatch(pa.assignment, sub));
      if (match) {
        updates.push({
          id: pa.id,
          completedAt: match.timestamp,
        });
        reconciledIds.push(pa.id);
      }
    }

    if (updates.length > 0) {
      await Promise.all(
        updates.map(u =>
          prisma.studentAssignment.update({
            where: { id: u.id },
            data: {
              status: 'completed',
              completedAt: u.completedAt,
            },
          })
        )
      );
    }

    return reconciledIds;
  } catch (error) {
    console.error(`Error reconciling student assignments for student ${studentId}:`, error);
    return [];
  }
}

/**
 * Reconciles all pending assignments across the entire database against existing submissions.
 * Can be called during background maintenance or on-demand from admin dashboard.
 */
export async function reconcileAllAssignments(): Promise<{ checked: number; reconciled: number }> {
  try {
    const pendingAssignments = await prisma.studentAssignment.findMany({
      where: { status: 'pending' },
      include: { assignment: true },
    });

    if (pendingAssignments.length === 0) {
      return { checked: 0, reconciled: 0 };
    }

    const studentIdsWithPending = Array.from(new Set(pendingAssignments.map(pa => pa.studentId)));

    const submissions = await prisma.submission.findMany({
      where: {
        studentId: { in: studentIdsWithPending },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Group submissions by studentId
    const submissionsByStudent = new Map<string, typeof submissions>();
    for (const sub of submissions) {
      const list = submissionsByStudent.get(sub.studentId) || [];
      list.push(sub);
      submissionsByStudent.set(sub.studentId, list);
    }

    const updates: { id: string; completedAt: Date }[] = [];

    for (const pa of pendingAssignments) {
      const studentSubs = submissionsByStudent.get(pa.studentId);
      if (!studentSubs || studentSubs.length === 0) continue;

      const match = studentSubs.find(sub => isAssignmentMatch(pa.assignment, sub));
      if (match) {
        updates.push({
          id: pa.id,
          completedAt: match.timestamp,
        });
      }
    }

    if (updates.length > 0) {
      // Chunk updates into groups of 50 to avoid connection overload
      const CHUNK_SIZE = 50;
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(u =>
            prisma.studentAssignment.update({
              where: { id: u.id },
              data: {
                status: 'completed',
                completedAt: u.completedAt,
              },
            })
          )
        );
      }
    }

    return { checked: pendingAssignments.length, reconciled: updates.length };
  } catch (error) {
    console.error('Error during reconcileAllAssignments:', error);
    return { checked: 0, reconciled: 0 };
  }
}
