import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendAssignmentReminder } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        studentAssignments: {
          where: { status: 'pending' },
          include: {
            student: {
              select: {
                id: true,
                rollNumber: true,
                name: true,
                email: true,
              }
            }
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    let defaultDomain = '';
    let body: any = {};
    try {
      body = await req.json();
      if (body && typeof body.defaultDomain === 'string') {
        defaultDomain = body.defaultDomain.trim().replace(/^@/, '');
      }
    } catch (e) {
      // Body is optional
    }

    // Direct test email support
    if (body.testEmail && typeof body.testEmail === 'string' && body.testEmail.includes('@')) {
      await sendAssignmentReminder({
        to: body.testEmail.trim(),
        studentName: (session.user as any)?.name || 'Admin (Test)',
        rollNumber: 'DEMO',
        assignmentTitle: assignment.title || assignment.titleSlug,
        titleSlug: assignment.titleSlug,
      });
      return NextResponse.json({
        success: true,
        isTest: true,
        assignmentTitle: assignment.title || assignment.titleSlug,
        message: `Test preview email successfully sent to ${body.testEmail.trim()}!`,
        totalPending: 1,
        sent: 1,
        skippedNoEmail: 0,
        failed: 0,
      });
    }

    const pendingList = assignment.studentAssignments;
    if (pendingList.length === 0) {
      return NextResponse.json({
        message: 'All students have completed this assignment! No pending reminders needed.',
        totalPending: 0,
        sent: 0,
        skippedNoEmail: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let failed = 0;
    const skippedNoEmail: Array<{ rollNumber: string; name: string }> = [];
    const errors: Array<{ rollNumber: string; error: string }> = [];

    const startTime = Date.now();
    const MAX_DURATION_MS = 8500; // 8.5 seconds limit to stay well within Vercel timeout

    // Separate students with valid emails vs missing emails
    const recipients: Array<{ student: typeof pendingList[0]['student']; targetEmail: string }> = [];

    for (const item of pendingList) {
      const student = item.student;
      const targetEmail = student.email || (defaultDomain ? `${student.rollNumber}@${defaultDomain}` : null);

      if (!targetEmail || !targetEmail.includes('@')) {
        skippedNoEmail.push({ rollNumber: student.rollNumber, name: student.name });
      } else {
        recipients.push({ student, targetEmail });
      }
    }

    // Process valid recipients in concurrent batches of 4
    const BATCH_SIZE = 4;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > MAX_DURATION_MS) {
        break;
      }
      const batch = recipients.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async ({ student, targetEmail }) => {
        try {
          await sendAssignmentReminder({
            to: targetEmail,
            studentName: student.name,
            rollNumber: student.rollNumber,
            assignmentTitle: assignment.title || assignment.titleSlug,
            titleSlug: assignment.titleSlug,
          });
          sent++;
        } catch (err: any) {
          failed++;
          errors.push({ rollNumber: student.rollNumber, error: err.message || 'Failed to send email' });
          console.error(`Failed to send reminder email to ${student.rollNumber} (${targetEmail}):`, err);
        }
      }));

      // Small pause between batches
      await new Promise((r) => setTimeout(r, 150));
    }

    const isPartial = sent + failed < recipients.length;

    return NextResponse.json({
      success: true,
      assignmentTitle: assignment.title || assignment.titleSlug,
      totalPending: pendingList.length,
      sent,
      skippedNoEmail: skippedNoEmail.length,
      failed,
      isPartial,
      remaining: recipients.length - (sent + failed),
      skippedList: skippedNoEmail.slice(0, 20),
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Error sending assignment notifications:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
