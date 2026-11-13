import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMultiAssignmentReminder } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Admin privileges required.' }, { status: 401 });
    }

    if (!process.env.EMAIL_PASS) {
      return NextResponse.json({
        error: 'EMAIL_PASS is not configured. Please add the 16-character Google App Password in your .env file or Vercel Environment Variables.'
      }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { assignmentIds, testEmail, recipientMode = 'bcc', previewOnly = false } = body;
    let defaultDomain = '';
    if (typeof body.defaultDomain === 'string') {
      defaultDomain = body.defaultDomain.trim().replace(/^@/, '');
    }

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json({ error: 'Please select at least one assignment.' }, { status: 400 });
    }

    // Fetch assignments
    const assignments = await prisma.assignment.findMany({
      where: { id: { in: assignmentIds } },
      select: {
        id: true,
        title: true,
        titleSlug: true,
        targetBranch: true,
        targetSection: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (assignments.length === 0) {
      return NextResponse.json({ error: 'None of the selected assignments were found.' }, { status: 404 });
    }

    // 1. Direct Test Email preview support
    if (testEmail && typeof testEmail === 'string' && testEmail.includes('@')) {
      await sendMultiAssignmentReminder({
        to: testEmail.trim(),
        recipientName: (session.user as any)?.name || 'Admin (Test)',
        assignments: assignments.map(a => ({
          title: a.title || a.titleSlug,
          titleSlug: a.titleSlug,
        })),
        isTest: true,
      });

      return NextResponse.json({
        success: true,
        isTest: true,
        message: `Test digest email with ${assignments.length} problem${assignments.length > 1 ? 's' : ''} sent to ${testEmail.trim()}!`,
        assignmentsCount: assignments.length,
      });
    }

    // 2. Query all pending student assignments for the selected problems
    const pendingStudentAssignments = await prisma.studentAssignment.findMany({
      where: {
        assignmentId: { in: assignmentIds },
        status: 'pending',
      },
      select: {
        assignmentId: true,
        student: {
          select: {
            id: true,
            rollNumber: true,
            name: true,
            email: true,
            branch: true,
            section: true,
          },
        },
      },
    });

    // Group unique students
    const uniqueStudentsMap = new Map<string, {
      id: string;
      rollNumber: string;
      name: string;
      email: string | null;
      branch: string | null;
      section: string | null;
      pendingCount: number;
    }>();

    for (const psa of pendingStudentAssignments) {
      const student = psa.student;
      const existing = uniqueStudentsMap.get(student.id);
      if (existing) {
        existing.pendingCount += 1;
      } else {
        uniqueStudentsMap.set(student.id, {
          ...student,
          pendingCount: 1,
        });
      }
    }

    const uniqueStudents = Array.from(uniqueStudentsMap.values());
    const validRecipients: Array<{ email: string; rollNumber: string; name: string }> = [];
    const skippedNoEmail: Array<{ rollNumber: string; name: string }> = [];

    for (const student of uniqueStudents) {
      const targetEmail = student.email || (defaultDomain ? `${student.rollNumber}@${defaultDomain}` : null);
      if (targetEmail && targetEmail.includes('@')) {
        validRecipients.push({
          email: targetEmail.trim().toLowerCase(),
          rollNumber: student.rollNumber,
          name: student.name,
        });
      } else {
        skippedNoEmail.push({
          rollNumber: student.rollNumber,
          name: student.name,
        });
      }
    }

    // Deduplicate distinct recipient emails
    const uniqueEmailList = Array.from(new Set(validRecipients.map(r => r.email)));
    const estimatedBatches = Math.ceil(uniqueEmailList.length / 85) || (uniqueEmailList.length > 0 ? 1 : 0);

    // If preview only, return the statistics without sending
    if (previewOnly) {
      return NextResponse.json({
        success: true,
        preview: true,
        assignments: assignments.map(a => ({
          id: a.id,
          title: a.title || a.titleSlug,
          titleSlug: a.titleSlug,
        })),
        totalAssignments: assignments.length,
        totalUniquePendingStudents: uniqueStudents.length,
        totalRecipientsWithEmail: uniqueEmailList.length,
        skippedNoEmailCount: skippedNoEmail.length,
        estimatedBatches,
        skippedSample: skippedNoEmail.slice(0, 10),
      });
    }

    if (uniqueEmailList.length === 0) {
      return NextResponse.json({
        success: true,
        totalUniquePendingStudents: uniqueStudents.length,
        totalRecipients: 0,
        skippedNoEmail: skippedNoEmail.length,
        emailsSent: 0,
        assignmentsCount: assignments.length,
        message: 'No student emails found for the pending students. Please upload student emails or specify a college domain fallback.',
        skippedList: skippedNoEmail.slice(0, 20),
      });
    }

    // 3. Batch emails into chunks of 85 recipients per message (Gmail safe limit is 100)
    const CHUNK_SIZE = 85;
    const emailChunks: string[][] = [];
    for (let i = 0; i < uniqueEmailList.length; i += CHUNK_SIZE) {
      emailChunks.push(uniqueEmailList.slice(i, i + CHUNK_SIZE));
    }

    let batchesSent = 0;
    let failedBatches = 0;
    const errors: string[] = [];

    const senderEmail = process.env.EMAIL_USER || 'leetcodetrackernotify@gmail.com';

    for (const chunk of emailChunks) {
      try {
        await sendMultiAssignmentReminder({
          to: recipientMode === 'cc' ? senderEmail : undefined,
          bcc: recipientMode === 'cc' ? undefined : chunk,
          cc: recipientMode === 'cc' ? chunk : undefined,
          assignments: assignments.map(a => ({
            title: a.title || a.titleSlug,
            titleSlug: a.titleSlug,
          })),
          recipientName: 'Students',
        });
        batchesSent++;
      } catch (err: any) {
        failedBatches++;
        errors.push(err.message || 'Failed to dispatch email batch');
        console.error('Failed to send bulk email chunk:', err);
      }
    }

    return NextResponse.json({
      success: batchesSent > 0,
      totalUniquePendingStudents: uniqueStudents.length,
      totalRecipients: uniqueEmailList.length,
      skippedNoEmail: skippedNoEmail.length,
      emailsSent: batchesSent, // Each batch of up to 85 recipients counts as 1 single email
      failedBatches,
      assignmentsCount: assignments.length,
      recipientMode,
      errors: errors.slice(0, 10),
      skippedList: skippedNoEmail.slice(0, 20),
    });

  } catch (error: any) {
    console.error('Error in bulk notify route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
