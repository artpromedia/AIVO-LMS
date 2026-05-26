const BRAND_COLOR = "#7C3AED";
const BRAND_NAME = "AIVO Learning";

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #F5F3FF; font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { display: inline-block; width: 48px; height: 48px; border-radius: 24px; background: ${BRAND_COLOR}; color: #fff; font-size: 18px; font-weight: 800; line-height: 48px; text-align: center; letter-spacing: 1px; }
    .title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 16px 0 8px; }
    .subtitle { font-size: 14px; color: #6b7280; }
    .body-text { font-size: 15px; line-height: 1.6; color: #374151; }
    .btn { display: inline-block; padding: 12px 32px; background: ${BRAND_COLOR}; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 16px 0; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9ca3af; }
    .highlight { color: ${BRAND_COLOR}; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">A</div>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
      <p>AI-powered adaptive learning for every child.</p>
    </div>
  </div>
</body>
</html>`;
}

export interface TemplateData {
  [key: string]: unknown;
}

export function renderTemplate(
  templateId: string,
  data: TemplateData,
): { subject: string; html: string; text: string } {
  switch (templateId) {
    case "welcome":
      return renderWelcome(data);
    case "collaboration_invite":
      return renderCollaborationInvite(data);
    case "password_reset":
      return renderPasswordReset(data);
    case "progress_report":
      return renderProgressReport(data);
    case "milestone_achieved":
      return renderMilestone(data);
    case "session_reminder":
      return renderSessionReminder(data);
    case "iep_update":
      return renderIEPUpdate(data);
    case "mfa_code":
      return renderMfaCode(data);
    case "district_admin_invite":
      return renderDistrictAdminInvite(data);
    case "school_admin_invite":
      return renderSchoolAdminInvite(data);
    case "staff_credentials":
      return renderStaffCredentials(data);
    case "iep_in_review_parent":
      return renderIepInReviewParent(data);
    case "iep_finalised_parent":
      return renderIepFinalisedParent(data);
    case "iep_comment_mention":
      return renderIepCommentMention(data);
    case "iep_progress_note":
      return renderIepProgressNote(data);
    case "iep_progress_report_sent":
      return renderIepProgressReportSent(data);
    case "iep_amendment_proposed":
      return renderIepAmendmentProposed(data);
    case "iep_amendment_acknowledged":
      return renderIepAmendmentAcknowledged(data);
    case "iep_review_reminder":
      return renderIepReviewReminder(data);
    case "evaluation_submitted":
      return renderEvaluationSubmittedParent(data);
    case "evaluation_submitted_admin":
      return renderEvaluationSubmittedAdmin(data);
    case "evaluation_decided":
      return renderEvaluationDecidedParent(data);
    case "newsletter_confirmation":
      return renderNewsletterConfirmation(data);
    default:
      return renderGeneric(data);
  }
}

function renderWelcome(data: TemplateData) {
  const name = (data.name as string) || "there";
  const html = baseLayout(`
    <h1 class="title">Welcome to ${BRAND_NAME}!</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">We're thrilled to have you join the AIVO family. You've taken the first step toward personalized, adaptive learning for your child.</p>
    <p class="body-text"><strong>Here's what to do next:</strong></p>
    <ol class="body-text">
      <li>Add your child's profile</li>
      <li>Complete the parent assessment</li>
      <li>Watch as AIVO builds a personalized Brain Clone</li>
      <li>Start learning with 14 AI tutors</li>
    </ol>
    <p style="text-align:center"><a href="${data.dashboardUrl || "#"}" class="btn">Go to Dashboard</a></p>
    <p class="body-text">If you have any questions, we're here to help!</p>
  `);
  return {
    subject: `Welcome to ${BRAND_NAME}, ${name}!`,
    html,
    text: `Welcome to ${BRAND_NAME}!\n\nHi ${name}, we're thrilled to have you join. Add your child's profile and complete the parent assessment to get started.`,
  };
}

function renderCollaborationInvite(data: TemplateData) {
  const inviterName = (data.inviterName as string) || "A parent";
  const learnerName = (data.learnerName as string) || "their child";
  const role = (data.role as string) || "team member";
  const html = baseLayout(`
    <h1 class="title">You're Invited to Join a Learning Team</h1>
    <p class="body-text"><span class="highlight">${inviterName}</span> has invited you to join <span class="highlight">${learnerName}</span>'s learning team as a <strong>${role}</strong>.</p>
    <p class="body-text">As part of the team, you'll be able to view progress, contribute observations, and help support ${learnerName}'s learning journey.</p>
    <p style="text-align:center"><a href="${data.acceptUrl || "#"}" class="btn">Accept Invitation</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">If you weren't expecting this invitation, you can safely ignore this email.</p>
  `);
  return {
    subject: `${inviterName} invited you to ${learnerName}'s learning team`,
    html,
    text: `${inviterName} invited you to join ${learnerName}'s learning team as a ${role}. Accept the invitation to get started.`,
  };
}

function renderPasswordReset(data: TemplateData) {
  const html = baseLayout(`
    <h1 class="title">Reset Your Password</h1>
    <p class="body-text">We received a request to reset your password. Click the button below to create a new one:</p>
    <p style="text-align:center"><a href="${data.resetUrl || "#"}" class="btn">Reset Password</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `);
  return {
    subject: "Reset your AIVO password",
    html,
    text: `Reset your password by visiting: ${data.resetUrl || "#"}. This link expires in 1 hour.`,
  };
}

function renderProgressReport(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "Your child";
  const period = (data.period as string) || "this week";
  const html = baseLayout(`
    <h1 class="title">Weekly Progress Report</h1>
    <p class="body-text">Here's how <span class="highlight">${learnerName}</span> did ${period}:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Sessions completed</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${data.sessions || 0}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">XP earned</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${data.xp || 0}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">Streak</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${data.streak || 0} days</td></tr>
      <tr><td style="padding:8px">Badges earned</td><td style="padding:8px;text-align:right;font-weight:700">${data.badges || 0}</td></tr>
    </table>
    <p style="text-align:center"><a href="${data.dashboardUrl || "#"}" class="btn">View Full Report</a></p>
  `);
  return {
    subject: `${learnerName}'s weekly progress report`,
    html,
    text: `${learnerName}'s progress ${period}: ${data.sessions || 0} sessions, ${data.xp || 0} XP, ${data.streak || 0} day streak.`,
  };
}

function renderMilestone(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "Your child";
  const milestone = (data.milestone as string) || "a new milestone";
  const html = baseLayout(`
    <h1 class="title">Milestone Achieved!</h1>
    <p class="body-text"><span class="highlight">${learnerName}</span> just reached <strong>${milestone}</strong>!</p>
    <p class="body-text">${(data.description as string) || "Keep up the amazing work!"}</p>
    <p style="text-align:center"><a href="${data.dashboardUrl || "#"}" class="btn">View Achievement</a></p>
  `);
  return {
    subject: `${learnerName} achieved: ${milestone}`,
    html,
    text: `${learnerName} just reached ${milestone}! ${(data.description as string) || ""}`,
  };
}

function renderSessionReminder(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "Your child";
  const tutorName = (data.tutorName as string) || "their tutor";
  const html = baseLayout(`
    <h1 class="title">Session Reminder</h1>
    <p class="body-text">Just a friendly reminder that <span class="highlight">${learnerName}</span> has a session with <strong>${tutorName}</strong> coming up!</p>
    <p class="body-text">Regular practice helps build strong learning habits.</p>
    <p style="text-align:center"><a href="${data.sessionUrl || "#"}" class="btn">Start Session</a></p>
  `);
  return {
    subject: `Reminder: ${learnerName}'s session with ${tutorName}`,
    html,
    text: `Reminder: ${learnerName} has a session with ${tutorName} coming up.`,
  };
}

function renderIEPUpdate(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "Your child";
  const goalName = (data.goalName as string) || "an IEP goal";
  const html = baseLayout(`
    <h1 class="title">IEP Goal Update</h1>
    <p class="body-text">There's an update on <span class="highlight">${learnerName}</span>'s IEP goal: <strong>${goalName}</strong></p>
    <p class="body-text">${(data.update as string) || "Progress has been recorded."}</p>
    <p style="text-align:center"><a href="${data.iepUrl || "#"}" class="btn">View IEP Goals</a></p>
  `);
  return {
    subject: `IEP update for ${learnerName}: ${goalName}`,
    html,
    text: `IEP update for ${learnerName}: ${goalName}. ${(data.update as string) || ""}`,
  };
}

function renderMfaCode(data: TemplateData) {
  const code = (data.code as string) || "000000";
  const name = (data.name as string) || "there";
  const html = baseLayout(`
    <h1 class="title">Your Verification Code</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">Use the following code to complete your sign-in. This code expires in 10 minutes.</p>
    <div style="text-align:center;margin:24px 0">
      <div style="display:inline-block;padding:16px 40px;background:#F5F3FF;border-radius:12px;letter-spacing:8px;font-size:32px;font-weight:800;color:${BRAND_COLOR};font-family:monospace">${code}</div>
    </div>
    <p class="body-text" style="font-size:13px;color:#6b7280">If you didn't request this code, please ignore this email or contact support if you believe your account has been compromised.</p>
  `);
  return {
    subject: `${code} is your ${BRAND_NAME} verification code`,
    html,
    text: `Your ${BRAND_NAME} verification code is: ${code}. This code expires in 10 minutes. If you didn't request this, please ignore this email.`,
  };
}

function renderGeneric(data: TemplateData) {
  const html = baseLayout(`
    <h1 class="title">${(data.title as string) || "Notification"}</h1>
    <p class="body-text">${(data.message as string) || ""}</p>
    ${data.actionUrl ? `<p style="text-align:center"><a href="${data.actionUrl}" class="btn">${(data.actionText as string) || "View"}</a></p>` : ""}
  `);
  return {
    subject: (data.subject as string) || (data.title as string) || "AIVO Notification",
    html,
    text: (data.message as string) || "",
  };
}

function renderDistrictAdminInvite(data: TemplateData) {
  const name = (data.name as string) || "there";
  const districtName = (data.districtName as string) || "your district";
  const inviteUrl = (data.inviteUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">You've been invited as a district administrator</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">You've been invited to join <span class="highlight">${districtName}</span> on AIVO Learning as a district administrator. This role gives you the ability to manage schools, classrooms, staff, and learner rosters across the district.</p>
    <p style="text-align:center"><a href="${inviteUrl}" class="btn">Accept Invitation</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">This invitation expires in 72 hours. After accepting, you'll be asked to set a password and enroll in multi-factor authentication. If you weren't expecting this, you can safely ignore this email.</p>
  `);
  return {
    subject: `You're invited to administer ${districtName} on AIVO Learning`,
    html,
    text: `You've been invited as a district administrator for ${districtName} on AIVO Learning. Accept your invitation here: ${inviteUrl}\n\nThis link expires in 72 hours.`,
  };
}

function renderSchoolAdminInvite(data: TemplateData) {
  const name = (data.name as string) || "there";
  const schoolName = (data.schoolName as string) || "your school";
  const inviteUrl = (data.inviteUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">You've been invited as a school administrator</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">You've been invited to administer <span class="highlight">${schoolName}</span> on AIVO Learning. School admins manage teachers, classrooms, and staff within a single school.</p>
    <p style="text-align:center"><a href="${inviteUrl}" class="btn">Accept Invitation</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">This invitation expires in 72 hours. After accepting, you'll be asked to set a password and enroll in multi-factor authentication. If you weren't expecting this, you can safely ignore this email.</p>
  `);
  return {
    subject: `You're invited to administer ${schoolName} on AIVO Learning`,
    html,
    text: `You've been invited as a school administrator for ${schoolName} on AIVO Learning. Accept your invitation here: ${inviteUrl}\n\nThis link expires in 72 hours.`,
  };
}

function renderStaffCredentials(data: TemplateData) {
  const name = (data.name as string) || "there";
  const roleLabel = (data.roleLabel as string) || "staff member";
  const schoolName = (data.schoolName as string) || "your school";
  const tempPassword = (data.tempPassword as string) || "";
  const loginUrl = (data.loginUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">Your AIVO Learning account is ready</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">An administrator has created an AIVO Learning account for you as a ${roleLabel} at <span class="highlight">${schoolName}</span>.</p>
    <p class="body-text"><strong>Temporary password:</strong></p>
    <p style="text-align:center;font-family:monospace;font-size:18px;background:#F3F4F6;padding:12px 16px;border-radius:8px;letter-spacing:1px;">${tempPassword}</p>
    <p style="text-align:center"><a href="${loginUrl}" class="btn">Sign in</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">You'll be required to change this password the first time you sign in. If you weren't expecting this email, please contact your school administrator.</p>
  `);
  return {
    subject: `Your AIVO Learning account is ready`,
    html,
    text: `Your AIVO Learning account is ready. Temporary password: ${tempPassword}\nSign in here: ${loginUrl}\nYou'll be required to change this password on first sign-in.`,
  };
}

function renderIepInReviewParent(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const iepUrl = (data.iepUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">Action needed: review and sign ${learnerName}'s IEP</h1>
    <p class="body-text">${learnerName}'s case manager has prepared a draft IEP and is ready for your review.</p>
    <p class="body-text">Please read each section carefully, leave any comments or questions for the team, and add your signature when you're ready.</p>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">Review and sign</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">The IEP becomes active only once all required team members have signed.</p>
  `);
  return {
    subject: `Action needed: review and sign ${learnerName}'s IEP`,
    html,
    text: `${learnerName}'s draft IEP is ready for your review and signature. Open: ${iepUrl}`,
  };
}

function renderIepFinalisedParent(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const iepUrl = (data.iepUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">${learnerName}'s IEP is now active</h1>
    <p class="body-text">All required signatures are in. ${learnerName}'s IEP is finalised and active.</p>
    <p class="body-text">You can revisit the document any time to track progress on goals.</p>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">View active IEP</a></p>
  `);
  return {
    subject: `${learnerName}'s IEP is now active`,
    html,
    text: `${learnerName}'s IEP has been signed by all required team members and is now active. View: ${iepUrl}`,
  };
}

function renderIepCommentMention(data: TemplateData) {
  const name = (data.name as string) || "there";
  const section = (data.section as string) || "the IEP";
  const snippet = (data.snippet as string) || "";
  const iepUrl = (data.iepUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">You were mentioned in an IEP comment</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">A teammate mentioned you in a comment on the <span class="highlight">${section}</span> section.</p>
    <blockquote style="margin:16px 0;padding:12px 16px;background:#F5F3FF;border-left:4px solid ${BRAND_COLOR};border-radius:8px;font-style:italic;color:#374151">${snippet}</blockquote>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">Open the IEP</a></p>
  `);
  return {
    subject: `You were mentioned in the ${section} section of an IEP`,
    html,
    text: `${name}, you were mentioned in a comment on the ${section} section: "${snippet}". Open: ${iepUrl}`,
  };
}

function renderIepProgressNote(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const snippet = (data.snippet as string) || "";
  const iepUrl = (data.iepUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">New progress note for ${learnerName}</h1>
    <p class="body-text">A teacher or therapist shared an update on ${learnerName}'s IEP.</p>
    <blockquote style="margin:16px 0;padding:12px 16px;background:#F5F3FF;border-left:4px solid ${BRAND_COLOR};border-radius:8px;font-style:italic;color:#374151">${snippet}</blockquote>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">View update</a></p>
  `);
  return {
    subject: `New IEP update for ${learnerName}`,
    html,
    text: `${learnerName}'s team shared a new progress note: "${snippet}". View: ${iepUrl}`,
  };
}

function renderIepProgressReportSent(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const period = (data.period as string) || "this period";
  const iepUrl = (data.iepUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">${learnerName}'s ${period} progress report is ready</h1>
    <p class="body-text">The case manager has shared the latest IEP progress report covering ${period}.</p>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">Read the report</a></p>
  `);
  return {
    subject: `${learnerName}'s ${period} IEP progress report`,
    html,
    text: `The ${period} IEP progress report for ${learnerName} is ready. Read it here: ${iepUrl}`,
  };
}

function renderIepAmendmentProposed(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const summary = (data.summary as string) || "an amendment to the IEP";
  const iepUrl = (data.iepUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">Action needed: amendment proposed</h1>
    <p class="body-text">The case manager has proposed an amendment to ${learnerName}'s IEP:</p>
    <blockquote style="margin:16px 0;padding:12px 16px;background:#F5F3FF;border-left:4px solid ${BRAND_COLOR};border-radius:8px;color:#374151">${summary}</blockquote>
    <p class="body-text">Please review and acknowledge or raise any objections.</p>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">Review amendment</a></p>
  `);
  return {
    subject: `Action needed: amendment to ${learnerName}'s IEP`,
    html,
    text: `An amendment to ${learnerName}'s IEP needs your review: "${summary}". Review: ${iepUrl}`,
  };
}

function renderIepAmendmentAcknowledged(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "the learner";
  const response = (data.response as string) || "responded to";
  const summary = (data.summary as string) || "the amendment";
  const iepUrl = (data.iepUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">The family ${response} an amendment</h1>
    <p class="body-text">${learnerName}'s family has <strong>${response}</strong> the amendment:</p>
    <blockquote style="margin:16px 0;padding:12px 16px;background:#F5F3FF;border-left:4px solid ${BRAND_COLOR};border-radius:8px;color:#374151">${summary}</blockquote>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">Open the IEP</a></p>
  `);
  return {
    subject: `Family ${response} an amendment to ${learnerName}'s IEP`,
    html,
    text: `${learnerName}'s family has ${response} the amendment "${summary}". Open: ${iepUrl}`,
  };
}

function renderIepReviewReminder(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const threshold = (data.threshold as number) || 30;
  const reviewDate = (data.reviewDate as string) || "soon";
  const recipientRole = (data.recipientRole as string) || "parent";
  const iepUrl = (data.iepUrl as string) || "#";
  const isCM = recipientRole === "case_manager";
  const headline = isCM
    ? `Annual review for ${learnerName} is due in ${threshold} days`
    : `${learnerName}'s annual IEP review is in ${threshold} days`;
  const body = isCM
    ? `Please confirm meeting logistics, prepare goals progress, and notify the team. Annual review date: <strong>${reviewDate}</strong>.`
    : `${learnerName}'s annual IEP review is scheduled for <strong>${reviewDate}</strong>. Your case manager will reach out to schedule the meeting.`;
  const html = baseLayout(`
    <h1 class="title">${headline}</h1>
    <p class="body-text">${body}</p>
    <p style="text-align:center"><a href="${iepUrl}" class="btn">Open the IEP</a></p>
  `);
  return {
    subject: headline,
    html,
    text: `${headline}. Open: ${iepUrl}`,
  };
}

// Evaluation lifecycle notifications (sprint task #10). Sent when an
// eligibility evaluation moves draft → submitted (parent + tenant
// district admins) and submitted → eligibility_determined (parent only).
function renderEvaluationSubmittedParent(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const url = (data.url as string) || "#";
  const html = baseLayout(`
    <h1 class="title">${learnerName}'s evaluation has been submitted</h1>
    <p class="body-text">The evaluation team has submitted ${learnerName}'s eligibility evaluation for review. You'll receive another notification once a decision has been recorded.</p>
    <p style="text-align:center"><a href="${url}" class="btn">Open dashboard</a></p>
  `);
  return {
    subject: `${learnerName}'s evaluation has been submitted`,
    html,
    text: `${learnerName}'s eligibility evaluation has been submitted by the team. View: ${url}`,
  };
}

function renderEvaluationSubmittedAdmin(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "a learner";
  const url = (data.url as string) || "#";
  const html = baseLayout(`
    <h1 class="title">New eligibility evaluation submitted</h1>
    <p class="body-text">An eligibility evaluation for ${learnerName} has been submitted in your district and is awaiting team decision.</p>
    <p style="text-align:center"><a href="${url}" class="btn">Open district dashboard</a></p>
  `);
  return {
    subject: `New eligibility evaluation submitted — ${learnerName}`,
    html,
    text: `An eligibility evaluation for ${learnerName} has been submitted. View: ${url}`,
  };
}

function renderEvaluationDecidedParent(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const url = (data.url as string) || "#";
  const decision = String(data.decision || "needs_more_data").replace(/_/g, " ");
  const html = baseLayout(`
    <h1 class="title">Eligibility decision recorded for ${learnerName}</h1>
    <p class="body-text">The IEP team has recorded an eligibility decision: <strong>${decision}</strong>.</p>
    <p class="body-text">Open the dashboard to view the team rationale and next steps.</p>
    <p style="text-align:center"><a href="${url}" class="btn">View decision</a></p>
  `);
  return {
    subject: `Eligibility decision for ${learnerName}: ${decision}`,
    html,
    text: `The IEP team has recorded an eligibility decision for ${learnerName}: ${decision}. View: ${url}`,
  };
}

function renderNewsletterConfirmation(_data: TemplateData) {
  const html = baseLayout(`
    <h1 class="title">You're subscribed!</h1>
    <p class="body-text">Thanks for signing up — you're now on the AIVO Learning newsletter list.</p>
    <p class="body-text">Here's what you can expect:</p>
    <ul class="body-text">
      <li>Platform updates and new AI tutor releases</li>
      <li>Learning tips for parents and educators</li>
      <li>Special offers and early access invites</li>
    </ul>
    <p style="text-align:center"><a href="https://aivolearning.com" class="btn">Explore AIVO Learning</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">You can unsubscribe at any time by replying STOP to any email.</p>
  `);
  return {
    subject: "You're subscribed to AIVO Learning news",
    html,
    text: `Thanks for signing up! You'll receive AIVO Learning updates, tips, and special offers. Reply STOP to unsubscribe.`,
  };
}

export const AVAILABLE_TEMPLATES = [
  { id: "welcome", name: "Welcome Email", channels: ["email"] },
  { id: "collaboration_invite", name: "Collaboration Invite", channels: ["email"] },
  { id: "password_reset", name: "Password Reset", channels: ["email"] },
  { id: "progress_report", name: "Weekly Progress Report", channels: ["email"] },
  { id: "milestone_achieved", name: "Milestone Achievement", channels: ["email", "push"] },
  { id: "session_reminder", name: "Session Reminder", channels: ["push", "email"] },
  { id: "iep_update", name: "IEP Goal Update", channels: ["email", "push"] },
  { id: "mfa_code", name: "MFA Verification Code", channels: ["email"] },
  { id: "district_admin_invite", name: "District Admin Invite", channels: ["email"] },
  { id: "school_admin_invite", name: "School Admin Invite", channels: ["email"] },
  { id: "staff_credentials", name: "Staff Credentials (Temp Password)", channels: ["email"] },
  { id: "iep_in_review_parent", name: "IEP — In Review (Parent)", channels: ["email"] },
  { id: "iep_finalised_parent", name: "IEP — Finalised (Parent)", channels: ["email"] },
  { id: "iep_comment_mention", name: "IEP — Comment Mention", channels: ["email"] },
  { id: "iep_progress_note", name: "IEP — Progress Note (Parent)", channels: ["email"] },
  {
    id: "iep_progress_report_sent",
    name: "IEP — Progress Report Sent (Parent)",
    channels: ["email"],
  },
  { id: "iep_amendment_proposed", name: "IEP — Amendment Proposed (Parent)", channels: ["email"] },
  {
    id: "iep_amendment_acknowledged",
    name: "IEP — Amendment Response (Team)",
    channels: ["email"],
  },
  { id: "iep_review_reminder", name: "IEP — Annual Review Reminder", channels: ["email"] },
  { id: "evaluation_submitted", name: "Evaluation — Submitted (Parent)", channels: ["email"] },
  {
    id: "evaluation_submitted_admin",
    name: "Evaluation — Submitted (District Admin)",
    channels: ["email"],
  },
  {
    id: "evaluation_decided",
    name: "Evaluation — Decision Recorded (Parent)",
    channels: ["email"],
  },
  {
    id: "newsletter_confirmation",
    name: "Newsletter Subscription Confirmation",
    channels: ["email"],
  },
];
