import nodemailer from 'nodemailer';

export interface SendReminderOptions {
  to: string;
  studentName: string;
  rollNumber: string;
  assignmentTitle: string;
  titleSlug: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;

export function getEmailTransporter() {
  const user = process.env.EMAIL_USER || 'leetcodetrackernotify@gmail.com';
  const pass = process.env.EMAIL_PASS;

  if (!pass) {
    throw new Error('EMAIL_PASS is not configured. Please add the 16-character Google App Password in .env or Vercel Environment Variables.');
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
      auth: {
        user,
        pass,
      },
    });
  }

  return cachedTransporter;
}

export async function sendAssignmentReminder(options: SendReminderOptions) {
  const { to, studentName, rollNumber, assignmentTitle, titleSlug } = options;
  const problemUrl = `https://leetcode.com/problems/${titleSlug}/`;
  const senderEmail = process.env.EMAIL_USER || 'leetcodetrackernotify@gmail.com';
  const displayTitle = assignmentTitle || titleSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const transporter = getEmailTransporter();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pending LeetCode Assignment Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #a40e19 0%, #7d0b13 100%); padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; width: 36px; height: 36px; line-height: 36px; background-color: #ffffff; color: #a40e19; font-weight: 800; font-size: 20px; border-radius: 8px; text-align: center; margin-right: 12px; vertical-align: middle;">L</div>
                    <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; vertical-align: middle;">LeetCode Tracker</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">Assignment Reminder</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5; color: #334155;">
                Hello <strong>${studentName}</strong> <span style="color: #64748b;">(Roll No: ${rollNumber})</span>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                This is a friendly reminder from your mentor that you have a <strong>pending LeetCode assignment</strong> that has not been submitted yet:
              </p>

              <!-- Problem Card Box -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #a40e19; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Assigned Problem</div>
                <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${displayTitle}</div>
                <div style="font-size: 13px; color: #64748b;">Slug: <code>${titleSlug}</code></div>
              </div>

              <!-- Action Call to Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${problemUrl}" target="_blank" style="display: inline-block; background-color: #a40e19; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(164, 14, 25, 0.25);">
                      Solve on LeetCode &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Note Box -->
              <div style="background-color: #fdf2f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px 16px; margin-bottom: 8px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; line-height: 1.5; color: #991b1b;">
                  <strong>Note:</strong> If you have already done this question previously, kindly <strong>resubmit</strong> the solution on the LeetCode portal. The tracker will automatically detect your submission and mark your assignment as completed on the next synchronization.
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7f1d1d;">
                  Please ensure you submit using your registered LeetCode account so your progress is tracked accurately.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 4px 0;">This is an automated notification from LeetCode Tracker.</p>
              <p style="margin: 0;">Sent via ${senderEmail}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return transporter.sendMail({
    from: `"LeetCode Tracker" <${senderEmail}>`,
    to,
    replyTo: senderEmail,
    subject: `LeetCode Assignment: ${displayTitle}`,
    text: `Hello ${studentName},\n\nYou have an assigned LeetCode problem: ${displayTitle}.\n\nPlease solve and submit your solution here:\n${problemUrl}\n\nNote: If you have already done this question previously, kindly resubmit the question on the LeetCode portal. The tracker will automatically detect your submission and mark your assignment as completed on the next synchronization.\n\nBest regards,\nLeetCode Tracker`,
    html: htmlContent,
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'Importance': 'Normal',
    },
  });
}

export interface SendMultiAssignmentOptions {
  to?: string;
  cc?: string[];
  bcc?: string[];
  assignments: Array<{ title?: string | null; titleSlug: string }>;
  recipientName?: string;
  isTest?: boolean;
  batchIndex?: number;
  totalBatches?: number;
  startQuestionIndex?: number;
}

export async function sendMultiAssignmentReminder(options: SendMultiAssignmentOptions) {
  const { 
    to, 
    cc, 
    bcc, 
    assignments, 
    recipientName = 'Students', 
    isTest = false,
    batchIndex,
    totalBatches,
    startQuestionIndex,
  } = options;
  const senderEmail = process.env.EMAIL_USER || 'leetcodetrackernotify@gmail.com';
  const transporter = getEmailTransporter();

  if (!assignments || assignments.length === 0) {
    throw new Error('At least one assignment must be provided for the reminder email.');
  }

  const batchPrefix = (totalBatches && totalBatches > 1 && batchIndex !== undefined)
    ? `[Part ${batchIndex + 1}/${totalBatches}] `
    : '';

  const primaryTitle = assignments[0].title || assignments[0].titleSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const subject = assignments.length === 1
    ? `${isTest ? '[TEST PREVIEW] ' : ''}${batchPrefix}LeetCode Assignment: ${primaryTitle}`
    : `${isTest ? '[TEST PREVIEW] ' : ''}${batchPrefix}LeetCode Assignments: ${primaryTitle} (+${assignments.length - 1} more)`;

  const problemsHtml = assignments.map((a, index) => {
    const title = a.title || a.titleSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const problemUrl = `https://leetcode.com/problems/${a.titleSlug}/`;
    const problemNumber = (startQuestionIndex !== undefined ? startQuestionIndex : 0) + index + 1;
    return `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #a40e19; border-radius: 8px; padding: 16px 20px; margin-bottom: 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="vertical-align: top;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">
                Problem #${problemNumber}
              </div>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                ${title}
              </div>
              <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                Slug: <code>${a.titleSlug}</code>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 6px;">
              <a href="${problemUrl}" target="_blank" style="display: inline-block; background-color: #a40e19; color: #ffffff; font-weight: 600; font-size: 13px; text-decoration: none; padding: 8px 16px; border-radius: 6px; box-shadow: 0 2px 4px rgba(164, 14, 25, 0.25);">
                Solve on LeetCode &rarr;
              </a>
            </td>
          </tr>
        </table>
      </div>
    `;
  }).join('');

  const plainTextList = assignments.map((a, i) => {
    const title = a.title || a.titleSlug;
    const problemNumber = (startQuestionIndex !== undefined ? startQuestionIndex : 0) + i + 1;
    return `${problemNumber}. ${title} (https://leetcode.com/problems/${a.titleSlug}/)`;
  }).join('\n');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pending LeetCode Assignments Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); overflow: hidden; border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #a40e19 0%, #7d0b13 100%); padding: 26px 30px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; width: 34px; height: 34px; line-height: 34px; background-color: #ffffff; color: #a40e19; font-weight: 800; font-size: 19px; border-radius: 8px; text-align: center; margin-right: 10px; vertical-align: middle;">L</div>
                    <span style="color: #ffffff; font-size: 19px; font-weight: 700; letter-spacing: -0.5px; vertical-align: middle;">LeetCode Tracker</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">
                      ${assignments.length} ${assignments.length === 1 ? 'Problem' : 'Problems'}${totalBatches && totalBatches > 1 ? ` &bull; Part ${(batchIndex || 0) + 1} of ${totalBatches}` : ''}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${isTest ? `
          <!-- Test Notice Banner -->
          <tr>
            <td style="background-color: #fff1f2; border-bottom: 1px solid #fecdd3; padding: 10px 24px; text-align: center; font-size: 12px; font-weight: 600; color: #a40e19;">
              ℹ️ TEST PREVIEW EMAIL &bull; This is how the reminder will look to students.
            </td>
          </tr>` : ''}

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 30px;">
              <p style="margin: 0 0 14px 0; font-size: 16px; line-height: 1.5; color: #334155;">
                Hello <strong>${recipientName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                This is a friendly reminder from your mentor that you have <strong>${assignments.length} pending LeetCode assignment${assignments.length > 1 ? 's' : ''}${totalBatches && totalBatches > 1 ? ` (Part ${(batchIndex || 0) + 1} of ${totalBatches})` : ''}</strong> waiting for your submission. Please solve and submit the following problem${assignments.length > 1 ? 's' : ''}:
              </p>

              <!-- Problems List -->
              ${problemsHtml}

              <div style="background-color: #fdf2f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px 16px; margin-top: 20px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; line-height: 1.5; color: #991b1b;">
                  <strong>Note:</strong> If you have already done any of these questions previously, kindly <strong>resubmit</strong> your solution on the LeetCode portal. The tracker will automatically detect your submission and mark your assignment as completed on the next synchronization.
                </p>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #7f1d1d;">
                  Please ensure you submit using your registered LeetCode account so your progress is tracked accurately.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 30px; text-align: center; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0 0 4px 0;">This is an automated notification from LeetCode Tracker.</p>
              <p style="margin: 0;">Sent via ${senderEmail}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  // Destination configuration:
  // If 'to' is specified explicitly (like a test email), send directly to 'to'.
  // If bulk send with BCC, set 'to' to the sender address so students don't see each other's emails, and put recipients in 'bcc'.
  const effectiveTo = to || `"LeetCode Students" <${senderEmail}>`;

  return transporter.sendMail({
    from: `"LeetCode Tracker" <${senderEmail}>`,
    to: effectiveTo,
    cc: cc && cc.length > 0 ? cc : undefined,
    bcc: bcc && bcc.length > 0 ? bcc : undefined,
    replyTo: senderEmail,
    subject,
    text: `Hello ${recipientName},\n\nYou have ${assignments.length} pending LeetCode assignment(s) waiting for submission:\n\n${plainTextList}\n\nNote: If you have already done any of these questions previously, kindly resubmit the question on the LeetCode portal. The tracker will automatically detect your submission and record your completion on the next synchronization.\n\nBest regards,\nLeetCode Tracker`,
    html: htmlContent,
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'Importance': 'Normal',
    },
  });
}
