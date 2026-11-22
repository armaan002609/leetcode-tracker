import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { reconcileStudentAssignments } from '@/lib/scraping/titleNormalizer';
import {
  ensureStudentCredentialTable,
  findMatchingStudentId,
} from '@/lib/studentCredentials';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized. Student login required.' }, { status: 401 });
    }

    await ensureStudentCredentialTable();

    const credentialId = (session.user as any).id as string;
    const credential = await prisma.studentCredential.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        portalUsername: true,
        enrollmentNo: true,
        isLocked: true,
        studentName: true,
        stream: true,
        semester: true,
        section: true,
        labBatch: true,
        studentId: true,
      },
    });

    if (!credential) {
      return NextResponse.json({ error: 'Student account no longer exists.' }, { status: 404 });
    }

    if (credential.isLocked) {
      return NextResponse.json(
        {
          error: 'Your student ID is currently locked by the admin. Please contact your mentor or admin.',
          locked: true,
        },
        { status: 403 }
      );
    }

    // Keep lastLoginAt updated when student interacts with their portal
    prisma.studentCredential.update({
      where: { id: credential.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 }
      }
    }).catch(() => {});

    let resolvedStudentId = credential.studentId;

    // If not linked yet, try matching against Student roster on the fly
    if (!resolvedStudentId) {
      const matchedId = await findMatchingStudentId(
        credential.portalUsername,
        credential.enrollmentNo
      );
      if (matchedId) {
        try {
          await prisma.studentCredential.update({
            where: { id: credential.id },
            data: { studentId: matchedId },
          });
          resolvedStudentId = matchedId;
        } catch {
          // If already linked to another credential, still load student read-only
          resolvedStudentId = matchedId;
        }
      }
    }

    if (!resolvedStudentId) {
      return NextResponse.json({
        linked: false,
        profile: {
          name: credential.studentName || credential.portalUsername,
          portalUsername: credential.portalUsername,
          enrollmentNo: credential.enrollmentNo,
          branch: credential.stream || null,
          semester: credential.semester || null,
          section: credential.section || null,
          labBatch: credential.labBatch || null,
          mentor: null,
          url: null,
          email: null,
        },
        stats: null,
        assignments: [],
        submissions: [],
      });
    }

    // Reconcile pending assignments against stored submissions so progress is always fresh
    await reconcileStudentAssignments(resolvedStudentId);

    const [student, studentAssignments, submissions] = await Promise.all([
      prisma.student.findUnique({
        where: { id: resolvedStudentId },
        select: {
          id: true,
          rollNumber: true,
          name: true,
          email: true,
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
        },
      }),
      prisma.studentAssignment.findMany({
        where: { studentId: resolvedStudentId },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              titleSlug: true,
              targetBranch: true,
              targetSection: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          assignment: {
            createdAt: 'desc',
          },
        },
      }),
      prisma.submission.findMany({
        where: { studentId: resolvedStudentId },
        orderBy: { timestamp: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          titleSlug: true,
          difficulty: true,
          timestamp: true,
        },
      }),
    ]);

    if (!student) {
      return NextResponse.json({
        linked: false,
        profile: {
          name: credential.studentName || credential.portalUsername,
          portalUsername: credential.portalUsername,
          enrollmentNo: credential.enrollmentNo,
          branch: credential.stream || null,
          semester: credential.semester || null,
          section: credential.section || null,
          labBatch: credential.labBatch || null,
          mentor: null,
          url: null,
          email: null,
        },
        stats: null,
        assignments: [],
        submissions: [],
      });
    }

    return NextResponse.json({
      linked: true,
      profile: {
        name: student.name || credential.studentName || credential.portalUsername,
        portalUsername: credential.portalUsername,
        enrollmentNo: credential.enrollmentNo,
        rosterRollNumber: student.rollNumber,
        branch: student.branch || credential.stream || null,
        semester: student.semester || credential.semester || null,
        section: student.section || credential.section || null,
        labBatch: credential.labBatch || null,
        mentor: student.mentor || null,
        url: student.url || null,
        email: student.email || null,
      },
      stats: {
        status: student.status,
        solvedToday: student.solvedToday ?? 0,
        totalSolved: student.totalSolved ?? 0,
        easySolved: student.easySolved ?? 0,
        mediumSolved: student.mediumSolved ?? 0,
        hardSolved: student.hardSolved ?? 0,
        globalRank: student.globalRank,
        badges: student.badges ?? 0,
        lastScrapedAt: student.lastScrapedAt,
      },
      assignments: studentAssignments.map((sa) => ({
        id: sa.id,
        assignmentId: sa.assignment.id,
        title: sa.assignment.title || sa.assignment.titleSlug,
        titleSlug: sa.assignment.titleSlug,
        status: sa.status,
        completedAt: sa.completedAt,
        assignedAt: sa.assignment.createdAt,
      })),
      submissions,
    });
  } catch (error: any) {
    console.error('Error in /api/student/me GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
