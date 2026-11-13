import nodemailer from 'nodemailer';

export interface SendReminderOptions {
  to: string;
  studentName: string;
  rollNumber: string;
  assignmentTitle: string;
  titleSlug: string;
}

export function getEmailTransporter() {
  const user = process.env.EMAIL_USER || 'leetcodetrackernotify@gmail.com';
  const pass = process.env.EMAIL_PASS;

  if (!pass) {
    throw new Error('EMAIL_PASS is not configured. Please add the 16-character Google App Password in .env or Vercel Environment Variables.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
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
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; width: 36px; height: 36px; line-height: 36px; background-color: #f59e0b; color: #ffffff; font-weight: 800; font-size: 20px; border-radius: 8px; text-align: center; margin-right: 12px; vertical-align: middle;">L</div>
                    <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; vertical-align: middle;">LeetCode Tracker</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.2); color: #fde68a; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">Assignment Reminder</span>
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
              <div style="background-color: #f1f5f9; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Assigned Problem</div>
                <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${displayTitle}</div>
                <div style="font-size: 13px; color: #64748b;">Slug: <code>${titleSlug}</code></div>
              </div>

              <!-- Action Call to Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${problemUrl}" target="_blank" style="display: inline-block; background-color: #f59e0b; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                      Solve on LeetCode &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                <strong>Important:</strong> Once you submit an Accepted (AC) solution on LeetCode with your linked account, the tracker will automatically record your completion on the next synchronization.
              </p>
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
    text: `Hello ${studentName},\n\nYou have an assigned LeetCode problem: ${displayTitle}.\n\nPlease solve and submit your solution here:\n${problemUrl}\n\nOnce submitted and accepted, your progress will be updated automatically on the tracker.\n\nBest regards,\nLeetCode Tracker`,
    html: htmlContent,
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'Importance': 'Normal',
    },
  });
}
