import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendAssignmentReminder } from '@/lib/email';
import { isAssignmentMatch } from '@/lib/scraping/titleNormalizer';

export const dynamic = 'force-dynamic';

function formatEmailError(errorMsg: string): string {
  if (errorMsg.includes('550-5.4.5') || errorMsg.toLowerCase().includes('daily user sending limit exceeded')) {
    return 'Gmail Daily Limit Reached (Error 550-5.4.5): Google has temporarily paused sending from this account. Please try again later or update EMAIL_USER / EMAIL_PASS in .env.';
  }
  if (errorMsg.includes('69585') || errorMsg.toLowerCase().includes('message blocked')) {
    return 'Message was blocked by the email provider. Waiting briefly between individual sends helps prevent blocks.';
  }
  return errorMsg;
}

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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const defaultDomain =
      typeof body.defaultDomain === 'string'
        ? body.defaultDomain.trim().replace(/^@/, '')
        : '';

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        titleSlug: true,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Optional direct test email support
    if (body.testEmail && typeof body.testEmail === 'string' && body.testEmail.includes('@')) {
      try {
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
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: formatEmailError(err.message || 'Failed to send test email') },
          { status: 500 }
        );
      }
    }

    // Strictly enforce single individual student sending to prevent mail blocking
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    if (!studentId) {
      return NextResponse.json(
        { error: 'Please select an individual student to send a reminder email. Bulk sending is disabled to protect your email account from getting blocked.' },
        { status: 400 }
      );
    }

    const studentAssignment = await prisma.studentAssignment.findFirst({
      where: {
        assignmentId: id,
        studentId,
      },
      include: {
        student: {
          select: {
            id: true,
            rollNumber: true,
            name: true,
            email: true,
            branch: true,
            semester: true,
            section: true,
          },
        },
      },
    });

    if (!studentAssignment) {
      return NextResponse.json(
        { error: 'Student is not assigned to this question.' },
        { status: 404 }
      );
    }

    const student = studentAssignment.student;

    if (studentAssignment.status === 'completed') {
      return NextResponse.json({
        success: false,
        alreadyCompleted: true,
        completedAt: studentAssignment.completedAt,
        studentId: student.id,
        message: `${student.name} (${student.rollNumber}) has already completed this question.`,
      });
    }

    // Reconcile against stored submissions so we don't email someone who already solved it
    const studentSubmissions = await prisma.submission.findMany({
      where: { studentId: student.id },
      select: { title: true, titleSlug: true, timestamp: true },
    });

    const match = studentSubmissions.find(sub => isAssignmentMatch(assignment, sub));
    if (match) {
      await prisma.studentAssignment.update({
        where: { id: studentAssignment.id },
        data: { status: 'completed', completedAt: match.timestamp },
      });

      return NextResponse.json({
        success: false,
        alreadyCompleted: true,
        completedAt: match.timestamp,
        studentId: student.id,
        message: `${student.name} (${student.rollNumber}) has already solved this question. Status updated to Done.`,
      });
    }

    const targetEmail =
      (student.email && student.email.trim()) ||
      (defaultDomain ? `${student.rollNumber}@${defaultDomain}` : '');

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json(
        {
          error: `No email address found for ${student.name} (${student.rollNumber}). Please add their email on the Student Emails page or enter a college domain fallback.`,
        },
        { status: 400 }
      );
    }

    try {
      await sendAssignmentReminder({
        to: targetEmail,
        studentName: student.name,
        rollNumber: student.rollNumber,
        assignmentTitle: assignment.title || assignment.titleSlug,
        titleSlug: assignment.titleSlug,
      });
    } catch (err: any) {
      console.error(`Failed to send reminder email to ${student.rollNumber} (${targetEmail}):`, err);
      return NextResponse.json(
        { error: formatEmailError(err.message || 'Failed to send email') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      email: targetEmail,
      assignmentTitle: assignment.title || assignment.titleSlug,
      message: `Reminder email sent to ${student.name} (${targetEmail}).`,
    });
  } catch (error: any) {
    console.error('Error sending individual assignment notification:', error);
    return NextResponse.json(
      { error: formatEmailError(error.message || 'Internal Server Error') },
      { status: 500 }
    );
  }
}
