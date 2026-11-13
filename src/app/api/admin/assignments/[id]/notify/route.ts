import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendAssignmentReminder } from '@/lib/email';

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
    try {
      const body = await req.json();
      if (body && typeof body.defaultDomain === 'string') {
        defaultDomain = body.defaultDomain.trim().replace(/^@/, '');
      }
    } catch (e) {
      // Body is optional
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

    // Send emails with batching and small delays to adhere to SMTP limits
    for (const item of pendingList) {
      const student = item.student;
      const targetEmail = student.email || (defaultDomain ? `${student.rollNumber}@${defaultDomain}` : null);

      if (!targetEmail) {
        skippedNoEmail.push({ rollNumber: student.rollNumber, name: student.name });
        continue;
      }

      try {
        await sendAssignmentReminder({
          to: targetEmail,
          studentName: student.name,
          rollNumber: student.rollNumber,
          assignmentTitle: assignment.title || assignment.titleSlug,
          titleSlug: assignment.titleSlug,
        });
        sent++;
        // Small delay between sends (200ms)
        await new Promise((r) => setTimeout(r, 200));
      } catch (err: any) {
        failed++;
        errors.push({ rollNumber: student.rollNumber, error: err.message || 'Failed to send email' });
        console.error(`Failed to send reminder email to ${student.rollNumber} (${targetEmail}):`, err);
      }
    }

    return NextResponse.json({
      success: true,
      assignmentTitle: assignment.title || assignment.titleSlug,
      totalPending: pendingList.length,
      sent,
      skippedNoEmail: skippedNoEmail.length,
      failed,
      skippedList: skippedNoEmail.slice(0, 20),
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Error sending assignment notifications:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
