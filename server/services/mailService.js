import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Creates and returns a Nodemailer transporter instance based on environment variables
 */
const createTransporter = () => {
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');

  if (!emailUser || !emailPass) {
    console.warn('[MailService] EMAIL_USER or EMAIL_PASS not fully configured in .env. Email notifications will be simulated in console.');
    return null;
  }

  // Create transporter for Gmail / Google Workspace
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

/**
 * Sends an email notification to the admin when a task is completed
 * @param {Object} params
 * @param {Object} params.task - The completed task object
 * @param {Object} params.completedBy - The user who completed the task
 */
export const sendTaskCompletedEmail = async ({ task, completedBy }) => {
  const adminEmail = (process.env.ADMIN_EMAIL || '24aiml024@charusat.edu.in').trim();
  const emailUser = (process.env.EMAIL_USER || adminEmail).trim();
  const transporter = createTransporter();

  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981'
  };

  const priorityColor = priorityColors[task.priority?.toLowerCase()] || '#3b82f6';
  const completedByName = completedBy?.name || 'A team member';
  const completedByEmail = completedBy?.email || 'N/A';
  const completedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px 32px; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; }
          .content { padding: 32px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #ffffff; background-color: ${priorityColor}; }
          .task-box { background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 6px; padding: 18px; margin: 20px 0; }
          .task-title { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
          .task-desc { font-size: 14px; color: #475569; margin: 0; line-height: 1.5; }
          .info-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          .info-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
          .info-table td.label { color: #64748b; font-weight: 600; width: 35%; }
          .info-table td.value { color: #1e293b; font-weight: 500; }
          .footer { background-color: #f8fafc; padding: 18px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Task Completed Notification</h1>
            <p>A task assigned on the Kanban Board has been marked as completed.</p>
          </div>
          <div class="content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span class="badge">${task.priority ? task.priority.toUpperCase() + ' PRIORITY' : 'NORMAL'}</span>
              <span style="font-size: 13px; color: #64748b;">${completedAt}</span>
            </div>
            
            <div class="task-box">
              <div class="task-title">${task.title || 'Untitled Task'}</div>
              ${task.description ? `<p class="task-desc">${task.description}</p>` : '<p class="task-desc" style="font-style: italic; color: #94a3b8;">No description provided.</p>'}
            </div>

            <table class="info-table">
              <tr>
                <td class="label">Completed By:</td>
                <td class="value">${completedByName} (${completedByEmail})</td>
              </tr>
              <tr>
                <td class="label">Status:</td>
                <td class="value"><strong style="color: #10b981;">Completed</strong></td>
              </tr>
              <tr>
                <td class="label">Task ID:</td>
                <td class="value" style="font-family: monospace; font-size: 12px;">${task._id || task.id}</td>
              </tr>
              <tr>
                <td class="label">Admin Email:</td>
                <td class="value">${adminEmail}</td>
              </tr>
            </table>
          </div>
          <div class="footer">
            Kanban Board Task Notification System &bull; Automatically generated alert
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Task Completed Notification
-------------------------------------------
Task: ${task.title}
Priority: ${task.priority || 'medium'}
Description: ${task.description || 'None'}
Completed By: ${completedByName} (${completedByEmail})
Completed At: ${completedAt}
Task ID: ${task._id || task.id}
Admin Recipient: ${adminEmail}
-------------------------------------------
`;

  if (!transporter) {
    console.log(`\n================== [SIMULATED EMAIL NOTIFICATION] ==================`);
    console.log(`To: ${adminEmail}`);
    console.log(`From: ${emailUser}`);
    console.log(`Subject: ✅ Task Completed: "${task.title}"`);
    console.log(`Completed By: ${completedByName} (${completedByEmail})`);
    console.log(`Priority: ${task.priority}`);
    console.log(`====================================================================\n`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Kanban Board" <${emailUser}>`,
      to: adminEmail,
      subject: `✅ Task Completed: "${task.title}" (${completedByName})`,
      text: textContent,
      html: htmlContent
    });

    console.log(`[MailService] Email sent successfully to ${adminEmail}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MailService Error] Failed to send email via SMTP to ${adminEmail}:`, error.message);
    console.log(`\n[MailService Fallback] If using Gmail/Google Workspace, please verify if 2-Step Verification is enabled and an App Password (16 characters) is generated for EMAIL_PASS.\n`);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a password reset email to a user with a secure reset link
 * @param {Object} params
 * @param {Object} params.user - User requesting reset ({ name, email })
 * @param {string} params.resetUrl - Full reset URL
 */
export const sendPasswordResetEmail = async ({ user, resetUrl }) => {
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const transporter = createTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #1e293b, #0f172a); padding: 28px 32px; color: #ffffff; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 24px 0; text-align: center; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
          .note { font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 20px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
          .footer { background-color: #f8fafc; padding: 16px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Reset Request</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px; margin-top: 0;">Hi <strong>${user.name || 'there'}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">
              You recently requested to reset your password for your Kanban Board account. Click the button below to set a new password:
            </p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="btn" target="_blank">Reset My Password</a>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              Or copy and paste this URL into your browser:<br>
              <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
            </p>
            <div class="note">
              ⏱️ <strong>This link will expire in 15 minutes.</strong><br>
              If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </div>
          </div>
          <div class="footer">
            Kanban Board Security Team &bull; This is an automated message
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Password Reset Request
-------------------------------------------
Hi ${user.name || 'there'},

You recently requested to reset your password for your Kanban Board account.
Please visit the link below to choose a new password:
${resetUrl}

This link is valid for 15 minutes.

If you did not request this, please ignore this email.
-------------------------------------------
`;

  if (!transporter) {
    console.log(`\n================== [SIMULATED PASSWORD RESET EMAIL] ==================`);
    console.log(`To: ${user.email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`======================================================================\n`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Kanban Board Security" <${emailUser}>`,
      to: user.email,
      subject: `🔒 Password Reset Request - Kanban Board`,
      text: textContent,
      html: htmlContent
    });

    console.log(`[MailService] Password reset email sent to ${user.email}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[MailService Error] Failed to send password reset email to ${user.email}:`, error.message);
    return { success: false, error: error.message };
  }
};

