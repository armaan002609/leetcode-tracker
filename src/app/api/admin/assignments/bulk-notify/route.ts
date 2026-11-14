import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendMultiAssignmentReminder } from '@/lib/email';
import { isAssignmentMatch } from '@/lib/scraping/titleNormalizer';

export const dynamic = 'force-dynamic';

function formatEmailError(errorMsg: string): string {
  if (errorMsg.includes('550-5.4.5') || errorMsg.toLowerCase().includes('daily user sending limit exceeded')) {
    return 'Gmail Daily Limit Reached (Error 550-5.4.5): Google has locked this account for up to 24 hours because the 500-recipient limit was exceeded earlier today. To send right now without waiting, update EMAIL_USER and EMAIL_PASS in your .env file to a fresh Gmail account.';
  }
  return errorMsg;
}

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
    const { 
      assignmentIds, 
      testEmail, 
      recipientMode = 'bcc', 
      previewOnly = false,
      filterBranch = '',
      filterSection = '',
    } = body;
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

    // Split questions into chunks based on user preference (default: 10, or 20/25/all)
    const rawChunkSize = body.questionsPerEmail ? parseInt(body.questionsPerEmail, 10) : 10;
    const QUESTION_CHUNK_SIZE = (rawChunkSize && rawChunkSize > 0) ? Math.min(rawChunkSize, 100) : 10;
    const questionChunks: typeof assignments[] = [];
    for (let i = 0; i < assignments.length; i += QUESTION_CHUNK_SIZE) {
      questionChunks.push(assignments.slice(i, i + QUESTION_CHUNK_SIZE));
    }

    // 1. Direct Test Email preview support
    if (testEmail && typeof testEmail === 'string' && testEmail.includes('@')) {
      const firstChunk = questionChunks[0] || assignments;
      try {
        await sendMultiAssignmentReminder({
          to: testEmail.trim(),
          recipientName: (session.user as any)?.name || 'Admin (Test)',
          assignments: firstChunk.map(a => ({
            title: a.title || a.titleSlug,
            titleSlug: a.titleSlug,
          })),
          isTest: true,
          batchIndex: 0,
          totalBatches: questionChunks.length,
          startQuestionIndex: 0,
        });

        const testMsg = questionChunks.length > 1
          ? `Test preview of Part 1 (first ${QUESTION_CHUNK_SIZE} problems of ${assignments.length}) sent to ${testEmail.trim()}! In live send, ${questionChunks.length} separate emails (up to ${QUESTION_CHUNK_SIZE} questions each) will be dispatched.`
          : `Test digest email with ${assignments.length} problem${assignments.length > 1 ? 's' : ''} sent to ${testEmail.trim()}!`;

        return NextResponse.json({
          success: true,
          isTest: true,
          message: testMsg,
          assignmentsCount: assignments.length,
          questionBatchesCount: questionChunks.length,
        });
      } catch (err: any) {
        console.error('Error sending test email:', err);
        return NextResponse.json({ error: formatEmailError(err.message || 'Failed to send test email') }, { status: 400 });
      }
    }

    // 2. Query pending student assignments for the selected problems, filtered by branch/section if provided
    const studentFilter: any = {};
    if (typeof filterBranch === 'string' && filterBranch.trim() !== '' && filterBranch.toLowerCase() !== 'all') {
      studentFilter.branch = { equals: filterBranch.trim(), mode: 'insensitive' };
    }
    if (typeof filterSection === 'string' && filterSection.trim() !== '' && filterSection.toLowerCase() !== 'all') {
      studentFilter.section = { equals: filterSection.trim(), mode: 'insensitive' };
    }

    const pendingStudentAssignments = await prisma.studentAssignment.findMany({
      where: {
        assignmentId: { in: assignmentIds },
        status: 'pending',
        ...(Object.keys(studentFilter).length > 0 ? { student: studentFilter } : {}),
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

    // In-memory verification for exact branch and section matching
    const rawPendingAssignments = pendingStudentAssignments.filter(psa => {
      const student = psa.student;
      if (filterBranch && filterBranch.trim() !== '' && filterBranch.toLowerCase() !== 'all') {
        if (!student.branch || student.branch.trim().toLowerCase() !== filterBranch.trim().toLowerCase()) {
          return false;
        }
      }
      if (filterSection && filterSection.trim() !== '' && filterSection.toLowerCase() !== 'all') {
        if (!student.section || student.section.trim().toLowerCase() !== filterSection.trim().toLowerCase()) {
          return false;
        }
      }
      return true;
    });

    // Reconcile against any matching submissions in DB so students who already solved the question aren't emailed
    const studentIds = Array.from(new Set(rawPendingAssignments.map(p => p.student.id)));
    const assignmentMap = new Map(assignments.map(a => [a.id, a]));

    const submissions = studentIds.length > 0 ? await prisma.submission.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, title: true, titleSlug: true, timestamp: true }
    }) : [];

    const subsByStudent = new Map<string, typeof submissions>();
    for (const sub of submissions) {
      const list = subsByStudent.get(sub.studentId) || [];
      list.push(sub);
      subsByStudent.set(sub.studentId, list);
    }

    const validPendingAssignments: typeof rawPendingAssignments = [];
    for (const psa of rawPendingAssignments) {
      const asgn = assignmentMap.get(psa.assignmentId);
      const studentSubs = subsByStudent.get(psa.student.id) || [];
      const match = asgn ? studentSubs.find(s => isAssignmentMatch(asgn, s)) : null;

      if (match) {
        // Mark as completed in DB in background so they don't stay pending
        prisma.studentAssignment.updateMany({
          where: { studentId: psa.student.id, assignmentId: psa.assignmentId },
          data: { status: 'completed', completedAt: match.timestamp }
        }).catch(err => console.error('Error auto-updating completed assignment in bulk notify:', err));
      } else {
        validPendingAssignments.push(psa);
      }
    }

    // Student ID -> target email (or fallback)
    const studentEmailMap = new Map<string, string>();
    const skippedNoEmailMap = new Map<string, { rollNumber: string; name: string }>();

    // Set of assignment IDs pending for each student: studentId -> Set<assignmentId>
    const studentPendingAssignmentIds = new Map<string, Set<string>>();

    const studentRollMap = new Map<string, string>();
    for (const psa of validPendingAssignments) {
      const s = psa.student;
      studentRollMap.set(s.id, s.rollNumber);
      if (!studentPendingAssignmentIds.has(s.id)) {
        studentPendingAssignmentIds.set(s.id, new Set());
      }
      studentPendingAssignmentIds.get(s.id)!.add(psa.assignmentId);

      const targetEmail = s.email || (defaultDomain ? `${s.rollNumber}@${defaultDomain}` : null);
      if (targetEmail && targetEmail.includes('@')) {
        studentEmailMap.set(s.id, targetEmail.trim().toLowerCase());
      } else {
        skippedNoEmailMap.set(s.id, { rollNumber: s.rollNumber, name: s.name });
      }
    }

    const totalAvailablePendingStudents = studentPendingAssignmentIds.size;
    const allPendingStudentIds = Array.from(studentPendingAssignmentIds.keys()).sort((a, b) => {
      const rollA = studentRollMap.get(a) || '';
      const rollB = studentRollMap.get(b) || '';
      return rollA.localeCompare(rollB, undefined, { numeric: true });
    });

    const parsedMaxStudents = body.maxStudents ? parseInt(body.maxStudents, 10) : undefined;
    const parsedOffset = body.studentOffset ? parseInt(body.studentOffset, 10) : 0;

    let targetedStudentIds = allPendingStudentIds;
    if (parsedMaxStudents && parsedMaxStudents > 0) {
      targetedStudentIds = allPendingStudentIds.slice(parsedOffset, parsedOffset + parsedMaxStudents);
    }
    const targetedSet = new Set(targetedStudentIds);

    // Filter studentEmailMap and studentPendingAssignmentIds to targeted students
    const activeStudentPendingAssignmentIds = new Map<string, Set<string>>();
    for (const [id, set] of studentPendingAssignmentIds.entries()) {
      if (targetedSet.has(id)) {
        activeStudentPendingAssignmentIds.set(id, set);
      }
    }

    const activeStudentEmailMap = new Map<string, string>();
    for (const [id, email] of studentEmailMap.entries()) {
      if (targetedSet.has(id)) {
        activeStudentEmailMap.set(id, email);
      }
    }

    const activeUniqueEmails = Array.from(new Set(activeStudentEmailMap.values()));

    // Calculate total estimated dispatches & total recipient deliveries
    const SAFE_RECIPIENT_BATCH_SIZE = 20;
    let totalEstimatedDispatches = 0;
    let totalRecipientDeliveries = 0;

    for (const qChunk of questionChunks) {
      const chunkIds = new Set(qChunk.map(a => a.id));
      const chunkEmails = new Set<string>();
      for (const [studentId, assignedSet] of activeStudentPendingAssignmentIds.entries()) {
        if (Array.from(assignedSet).some(id => chunkIds.has(id))) {
          const email = activeStudentEmailMap.get(studentId);
          if (email) chunkEmails.add(email);
        }
      }
      const batchesForChunk = Math.ceil(chunkEmails.size / SAFE_RECIPIENT_BATCH_SIZE) || (chunkEmails.size > 0 ? 1 : 0);
      totalEstimatedDispatches += batchesForChunk;
      totalRecipientDeliveries += chunkEmails.size;
    }

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
        questionBatchesCount: questionChunks.length,
        questionsPerEmail: QUESTION_CHUNK_SIZE,
        totalAvailablePendingStudents,
        currentBatchStudentCount: targetedStudentIds.length,
        currentBatchRange: [
          targetedStudentIds.length > 0 ? parsedOffset + 1 : 0,
          Math.min(parsedOffset + targetedStudentIds.length, totalAvailablePendingStudents)
        ],
        hasNextBatch: (parsedOffset + targetedStudentIds.length) < totalAvailablePendingStudents,
        nextBatchOffset: parsedOffset + targetedStudentIds.length,
        maxStudents: parsedMaxStudents || 0,
        studentOffset: parsedOffset,
        totalUniquePendingStudents: targetedStudentIds.length,
        totalRecipientsWithEmail: activeUniqueEmails.length,
        skippedNoEmailCount: skippedNoEmailMap.size,
        estimatedBatches: totalEstimatedDispatches || (activeUniqueEmails.length > 0 ? questionChunks.length : 0),
        totalRecipientDeliveries,
        isOverGmailLimit: totalRecipientDeliveries > 450,
        gmailDailyLimit: 500,
        skippedSample: Array.from(skippedNoEmailMap.values()).slice(0, 10),
        filterBranch: filterBranch || '',
        filterSection: filterSection || '',
      });
    }

    if (activeUniqueEmails.length === 0) {
      return NextResponse.json({
        success: true,
        totalUniquePendingStudents: targetedStudentIds.length,
        totalRecipients: 0,
        skippedNoEmail: skippedNoEmailMap.size,
        emailsSent: 0,
        questionBatchesCount: questionChunks.length,
        assignmentsCount: assignments.length,
        message: 'No student emails found for the pending students in this batch. Please upload student emails or specify a college domain fallback.',
        skippedList: Array.from(skippedNoEmailMap.values()).slice(0, 20),
      });
    }

    // 3. Dispatch emails: grouped by question chunks
    let totalEmailsSent = 0;
    let failedBatches = 0;
    const errors: string[] = [];

    const senderEmail = process.env.EMAIL_USER || 'leetcodetrackernotify@gmail.com';

    let recipientGreeting = 'Students';
    if (filterBranch && filterSection) {
      recipientGreeting = `${filterBranch} (Section ${filterSection}) Students`;
    } else if (filterBranch) {
      recipientGreeting = `${filterBranch} Students`;
    } else if (filterSection) {
      recipientGreeting = `Section ${filterSection} Students`;
    }

    for (let qIndex = 0; qIndex < questionChunks.length; qIndex++) {
      const qChunk = questionChunks[qIndex];
      const chunkIds = new Set(qChunk.map(a => a.id));

      // Get all student emails who have at least 1 pending question in this question chunk
      const chunkEmailsSet = new Set<string>();
      for (const [studentId, assignedSet] of activeStudentPendingAssignmentIds.entries()) {
        const hasPending = Array.from(assignedSet).some(id => chunkIds.has(id));
        if (hasPending) {
          const email = activeStudentEmailMap.get(studentId);
          if (email) chunkEmailsSet.add(email);
        }
      }

      const chunkEmailList = Array.from(chunkEmailsSet);
      if (chunkEmailList.length === 0) {
        continue;
      }

      // Safe batch size of 20 recipients per message to prevent triggering Gmail anti-spam abuse
      const RECIPIENT_BATCH_SIZE = 20;
      for (let rIdx = 0; rIdx < chunkEmailList.length; rIdx += RECIPIENT_BATCH_SIZE) {
        const recipientBatch = chunkEmailList.slice(rIdx, rIdx + RECIPIENT_BATCH_SIZE);
        try {
          await sendMultiAssignmentReminder({
            bcc: recipientMode === 'cc' ? undefined : recipientBatch,
            cc: recipientMode === 'cc' ? recipientBatch : undefined,
            assignments: qChunk.map(a => ({
              title: a.title || a.titleSlug,
              titleSlug: a.titleSlug,
            })),
            recipientName: recipientGreeting,
            batchIndex: qIndex,
            totalBatches: questionChunks.length,
            startQuestionIndex: qIndex * QUESTION_CHUNK_SIZE,
          });
          totalEmailsSent++;
        } catch (err: any) {
          failedBatches++;
          errors.push(`Part ${qIndex + 1}: ${err.message || 'Failed to dispatch email'}`);
          console.error(`Failed to send question chunk ${qIndex + 1}:`, err);
        }

        // 2000ms delay between sends to keep SMTP connection stable and prevent rate-limits
        if (questionChunks.length > 1 || chunkEmailList.length > RECIPIENT_BATCH_SIZE) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    return NextResponse.json({
      success: totalEmailsSent > 0,
      totalUniquePendingStudents: targetedStudentIds.length,
      totalRecipients: activeUniqueEmails.length,
      skippedNoEmail: skippedNoEmailMap.size,
      emailsSent: totalEmailsSent,
      questionBatchesCount: questionChunks.length,
      failedBatches,
      assignmentsCount: assignments.length,
      recipientMode,
      filterBranch: filterBranch || '',
      filterSection: filterSection || '',
      errors: errors.slice(0, 10),
      skippedList: Array.from(skippedNoEmailMap.values()).slice(0, 20),
    });

  } catch (error: any) {
    console.error('Error in bulk notify route:', error);
    return NextResponse.json({ error: formatEmailError(error.message || 'Internal Server Error') }, { status: 500 });
  }
}
