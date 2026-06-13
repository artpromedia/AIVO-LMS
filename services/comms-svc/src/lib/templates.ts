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
    case "recommendation_pending":
      return renderRecommendationPending(data);
    case "mfa_code":
      return renderMfaCode(data);
    case "district_admin_invite":
      return renderDistrictAdminInvite(data);
    case "parent_invite":
      return renderParentInvite(data);
    case "trial_ending":
      return renderTrialEnding(data);
    case "school_admin_invite":
      return renderSchoolAdminInvite(data);
    case "teacher_invite":
      return renderTeacherInvite(data);
    case "staff_credentials":
      return renderStaffCredentials(data);
    case "teacher_invite_parent":
      return renderTeacherInviteParent(data);
    case "contribution_nudge":
      return renderContributionNudge(data);
    case "invite_expiry_warning":
      return renderInviteExpiryWarning(data);
    case "brain_profile_ready":
      return renderBrainProfileReady(data);
    case "brain_profile_changed":
      return renderBrainProfileChanged(data);
    case "brain_changes_reminder":
      return renderBrainChangesReminder(data);
    // Sprint C-16 — contributor "your input shaped X" acknowledgement. One
    // template family, role-aware wording (teacher / caregiver / therapist).
    case "contribution_acknowledged_teacher":
      return renderContributionAcknowledged(data, "teacher");
    case "contribution_acknowledged_caregiver":
      return renderContributionAcknowledged(data, "caregiver");
    case "contribution_acknowledged_therapist":
      return renderContributionAcknowledged(data, "therapist");
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

function renderRecommendationPending(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "Your child";
  const count = Number(data.count ?? 1);
  const topTitle = (data.topTitle as string) || "a learning plan update";
  const plural = count > 1;
  const html = baseLayout(`
    <h1 class="title">Approval needed: learning plan update${plural ? "s" : ""}</h1>
    <p class="body-text">AIVO has ${plural ? `${count} recommendations` : "a recommendation"} ready for <span class="highlight">${learnerName}</span> — starting with: <strong>${topTitle}</strong>.</p>
    <p class="body-text">Nothing changes until you approve it. Review the evidence and approve, adjust, or decline.</p>
    <p style="text-align:center"><a href="${data.reviewUrl || "#"}" class="btn">Review recommendation${plural ? "s" : ""}</a></p>
  `);
  return {
    subject: plural
      ? `${count} learning recommendations await your approval for ${learnerName}`
      : `A learning recommendation awaits your approval for ${learnerName}`,
    html,
    text: `AIVO has ${plural ? `${count} recommendations` : "a recommendation"} awaiting your approval for ${learnerName}: ${topTitle}. Review at ${data.reviewUrl || "your parent dashboard"}.`,
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

function renderParentInvite(data: TemplateData) {
  const name = (data.name as string) || "there";
  const districtName = (data.districtName as string) || "your school district";
  const schoolName = (data.schoolName as string) || "";
  const inviteUrl = (data.inviteUrl as string) || "#";
  const where = schoolName ? `${schoolName} (${districtName})` : districtName;
  const html = baseLayout(`
    <h1 class="title">You've been invited to ${BRAND_NAME}</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text"><span class="highlight">${where}</span> has invited you to join ${BRAND_NAME} as a parent. Once you accept, you can add your learner and get them started with personalized, adaptive learning.</p>
    <p style="text-align:center"><a href="${inviteUrl}" class="btn">Accept Invitation</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">This invitation expires in 72 hours. After accepting, you'll set your own password — no temporary password is ever emailed. If you weren't expecting this, you can safely ignore this email.</p>
  `);
  return {
    subject: `You're invited to join ${where} on ${BRAND_NAME}`,
    html,
    text: `${where} has invited you to join ${BRAND_NAME} as a parent. Accept your invitation here: ${inviteUrl}\n\nThis link expires in 72 hours. You'll set your own password — no temporary password is emailed.`,
  };
}

function renderTrialEnding(data: TemplateData) {
  const name = (data.name as string) || "there";
  const trialEndDate = (data.trialEndDate as string) || "soon";
  const daysLeft = data.daysLeft != null ? Number(data.daysLeft) : null;
  const renewalUrl = (data.renewalUrl as string) || "#";
  const whenText =
    daysLeft != null && daysLeft >= 0
      ? daysLeft === 0
        ? "today"
        : daysLeft === 1
          ? "tomorrow"
          : `in ${daysLeft} days`
      : `on ${trialEndDate}`;
  const html = baseLayout(`
    <h1 class="title">Your AIVO free trial ends ${whenText}</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">Your AIVO Learning free trial ends <span class="highlight">${whenText}</span> (${trialEndDate}). To keep your learner's personalized tutors, Brain Clone, and progress without interruption, add a plan before it ends.</p>
    <p style="text-align:center"><a href="${renewalUrl}" class="btn">Choose a plan</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">If you've already added a plan, you can ignore this email. Paid plans include a 30-day money-back guarantee.</p>
  `);
  return {
    subject: `Your AIVO free trial ends ${whenText}`,
    html,
    text: `Your AIVO Learning free trial ends ${whenText} (${trialEndDate}). Add a plan to keep your learner's tutors and progress: ${renewalUrl}`,
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

function renderTeacherInvite(data: TemplateData) {
  const name = (data.name as string) || "there";
  const schoolName = (data.schoolName as string) || "your school";
  const inviteUrl = (data.inviteUrl as string) || "#";
  const html = baseLayout(`
    <h1 class="title">You've been invited to teach on AIVO Learning</h1>
    <p class="body-text">Hi ${name},</p>
    <p class="body-text">You've been invited to join <span class="highlight">${schoolName}</span> on AIVO Learning as a teacher. You'll be able to manage your classes, lesson plans, and learners.</p>
    <p style="text-align:center"><a href="${inviteUrl}" class="btn">Accept Invitation</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">This invitation expires in 72 hours. After accepting, you'll be asked to set a password. If you weren't expecting this, you can safely ignore this email.</p>
  `);
  return {
    subject: `You're invited to teach at ${schoolName} on AIVO Learning`,
    html,
    text: `You've been invited to join ${schoolName} on AIVO Learning as a teacher. Accept your invitation here: ${inviteUrl}\n\nThis link expires in 72 hours.`,
  };
}

function renderTeacherInviteParent(data: TemplateData) {
  const teacherName = (data.teacherName as string) || "Your child's teacher";
  const schoolName = (data.schoolName as string) || "the school";
  const childName = (data.childName as string) || "your child";
  const acceptUrl = (data.acceptUrl as string) || "#";
  const notes = (data.notes as string) || "";
  const html = baseLayout(`
    <h1 class="title">${teacherName} would like to connect with you about ${childName}</h1>
    <p class="body-text">Hi,</p>
    <p class="body-text"><strong>${teacherName}</strong> at <span class="highlight">${schoolName}</span> has invited you to connect on AIVO Learning so they can share progress, observations, and goals for <strong>${childName}</strong> with you.</p>
    ${notes ? `<p class="body-text" style="background:#F5F3FF;padding:12px 16px;border-radius:8px;border-left:3px solid ${BRAND_COLOR};"><em>"${notes}"</em></p>` : ""}
    <p style="text-align:center"><a href="${acceptUrl}" class="btn">Accept invitation</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">This invitation expires in 72 hours. Sign in with the email this message was sent to. If you weren't expecting this, you can safely ignore the email.</p>
  `);
  return {
    subject: `${teacherName} at ${schoolName} invited you to connect about ${childName}`,
    html,
    text: `${teacherName} at ${schoolName} has invited you to connect about ${childName} on AIVO Learning.${notes ? `\n\nNote: ${notes}` : ""}\nAccept: ${acceptUrl}\n\nThis link expires in 72 hours.`,
  };
}

// Sprint C-08 — warm nudge to a teammate who accepted a learning-team invite
// but hasn't added their perspective yet. ONE call to action, opt-out honored
// via the preferences link, never a nagging tone. Sent at most once per
// member per 7 days (comms-svc invite-reminder batch enforces the cap).
function renderContributionNudge(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "a learner";
  const inviterName = (data.inviterName as string) || "Their family";
  const kind = (data.kind as string) || "teammate";
  const contributeUrl = (data.contributeUrl as string) || "#";
  const unsubscribeUrl = (data.unsubscribeUrl as string) || "";
  const roleWord =
    kind === "teacher"
      ? "classroom view"
      : kind === "therapist"
        ? "clinical view"
        : "everyday view";
  const html = baseLayout(`
    <h1 class="title">${learnerName}'s plan is waiting on your perspective</h1>
    <p class="body-text">${inviterName} invited you to ${learnerName}'s learning team, and you're in — thank you.</p>
    <p class="body-text">When you're ready, about <strong>10 minutes</strong> of your ${roleWord} helps shape ${learnerName}'s learning plan. There are no wrong answers — just what you see.</p>
    <p style="text-align:center"><a href="${contributeUrl}" class="btn">Add my perspective</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">No rush, and no pressure — you can do this whenever it suits you.${
      unsubscribeUrl
        ? ` If you'd rather not get these reminders, <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">turn them off</a>.`
        : ""
    }</p>
  `);
  return {
    subject: `${learnerName}'s family invited you — 10 minutes of your perspective shapes their learning plan`,
    html,
    text: `${inviterName} invited you to ${learnerName}'s learning team. About 10 minutes of your perspective helps shape ${learnerName}'s learning plan — there are no wrong answers. Add yours: ${contributeUrl}${
      unsubscribeUrl ? `\n\nTo stop these reminders: ${unsubscribeUrl}` : ""
    }`,
  };
}

// Sprint C-08 — pre-expiry warning for a teacher→parent token invite that is
// still pending and about to lapse. Warm, single CTA, honest about the clock.
function renderInviteExpiryWarning(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your child";
  const teacherName = (data.teacherName as string) || "Your child's teacher";
  const acceptUrl = (data.acceptUrl as string) || "#";
  const hoursLeft = data.hoursLeft != null ? Number(data.hoursLeft) : null;
  const whenText =
    hoursLeft != null && hoursLeft >= 0
      ? hoursLeft <= 1
        ? "within the hour"
        : `in about ${hoursLeft} hours`
      : "soon";
  const html = baseLayout(`
    <h1 class="title">${teacherName}'s invitation expires ${whenText}</h1>
    <p class="body-text"><strong>${teacherName}</strong> invited you to connect on AIVO Learning about <strong>${learnerName}</strong>. That invitation link expires <span class="highlight">${whenText}</span>.</p>
    <p class="body-text">Accepting takes a minute and lets the two of you share progress, observations, and goals for ${learnerName}.</p>
    <p style="text-align:center"><a href="${acceptUrl}" class="btn">Accept before it expires</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">If the link has already expired, ask ${teacherName} to send a fresh one. If you weren't expecting this, you can safely ignore this email.</p>
  `);
  return {
    subject: `Reminder: ${teacherName}'s invitation about ${learnerName} expires ${whenText}`,
    html,
    text: `${teacherName} invited you to connect about ${learnerName} on AIVO Learning, and the link expires ${whenText}. Accept: ${acceptUrl}\n\nIf it has already expired, ask ${teacherName} for a fresh invitation.`,
  };
}

// Sprint C-13 — SCREEN 0: the drafted learning profile is ready for first
// review. Warm, single CTA, no jargon. Copy intent per report §4.2:
// "Maya finished her Discovery Adventure. AIVO has drafted her learning
// profile — it's waiting for you to review it." CTA "See what we learned."
function renderBrainProfileReady(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your learner";
  const reviewUrl = (data.reviewUrl as string) || "#";
  const unsubscribeUrl = (data.unsubscribeUrl as string) || "";
  const html = baseLayout(`
    <h1 class="title">${learnerName}'s learning profile is ready</h1>
    <p class="body-text"><strong>${learnerName}</strong> finished their Discovery Adventure. We've drafted ${learnerName}'s learning profile — it's waiting for you to review it.</p>
    <p class="body-text">You'll see what we learned about how ${learnerName} likes to learn, the supports we suggest, and where they're already strong. Nothing starts until you've had a look and approved it.</p>
    <p style="text-align:center"><a href="${reviewUrl}" class="btn">See what we learned</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">Take your time — there's no deadline.${
      unsubscribeUrl
        ? ` If you'd rather not get these emails, <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">turn them off</a>.`
        : ""
    }</p>
  `);
  return {
    subject: `${learnerName}'s learning profile is ready for you to review`,
    html,
    text: `${learnerName} finished their Discovery Adventure. We've drafted ${learnerName}'s learning profile — it's waiting for you to review it. See what we learned: ${reviewUrl}${
      unsubscribeUrl ? `\n\nTo stop these emails: ${unsubscribeUrl}` : ""
    }`,
  };
}

// Sprint C-13 — a structural change landed after approval (supports/level/team
// shift). Honest about what changed and why, strengths-respecting, one CTA to
// the change timeline where the parent can review + acknowledge or adjust.
function renderBrainProfileChanged(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your learner";
  const summary = (data.summary as string) || `We adjusted ${learnerName}'s supports.`;
  const reviewUrl = (data.reviewUrl as string) || "#";
  const unsubscribeUrl = (data.unsubscribeUrl as string) || "";
  const html = baseLayout(`
    <h1 class="title">We adjusted ${learnerName}'s supports — take a look</h1>
    <p class="body-text">${summary}</p>
    <p class="body-text">${learnerName}'s lessons are carrying on as usual. When you have a moment, have a look at what changed and let us know it looks right — or adjust it.</p>
    <p style="text-align:center"><a href="${reviewUrl}" class="btn">See what changed</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">There's no rush, and nothing is paused.${
      unsubscribeUrl
        ? ` If you'd rather not get these emails, <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">turn them off</a>.`
        : ""
    }</p>
  `);
  return {
    subject: `A quick update to ${learnerName}'s learning profile`,
    html,
    text: `${summary}\n\n${learnerName}'s lessons are carrying on as usual. See what changed and confirm it looks right (or adjust it): ${reviewUrl}${
      unsubscribeUrl ? `\n\nTo stop these emails: ${unsubscribeUrl}` : ""
    }`,
  };
}

// Sprint C-13 — the gentle digest reminder for structural changes that have sat
// un-acknowledged for a week. One reminder per change (ledger-capped). Never
// nagging: the window is non-blocking and lessons keep running.
function renderBrainChangesReminder(data: TemplateData) {
  const learnerName = (data.learnerName as string) || "your learner";
  const count = data.count != null ? Number(data.count) : 1;
  const reviewUrl = (data.reviewUrl as string) || "#";
  const unsubscribeUrl = (data.unsubscribeUrl as string) || "";
  const changeWord = count === 1 ? "an update" : `${count} updates`;
  const itWord = count === 1 ? "it" : "them";
  const html = baseLayout(`
    <h1 class="title">${changeWord.charAt(0).toUpperCase() + changeWord.slice(1)} to ${learnerName}'s profile is waiting for you</h1>
    <p class="body-text">A little while ago we adjusted ${learnerName}'s learning profile, and ${itWord} ${count === 1 ? "is" : "are"} still waiting for your review.</p>
    <p class="body-text">Nothing is paused — ${learnerName}'s lessons are running as usual. Reviewing takes a moment and helps us keep the profile matched to ${learnerName}.</p>
    <p style="text-align:center"><a href="${reviewUrl}" class="btn">Review what changed</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">This is the only reminder we'll send about ${itWord}.${
      unsubscribeUrl
        ? ` If you'd rather not get these emails, <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">turn them off</a>.`
        : ""
    }</p>
  `);
  return {
    subject: `${changeWord.charAt(0).toUpperCase() + changeWord.slice(1)} to ${learnerName}'s profile is waiting for your review`,
    html,
    text: `A little while ago we adjusted ${learnerName}'s learning profile, and ${itWord} ${count === 1 ? "is" : "are"} still waiting for your review. Nothing is paused. Review: ${reviewUrl}${
      unsubscribeUrl ? `\n\nTo stop these emails: ${unsubscribeUrl}` : ""
    }`,
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

/** HTML-escape an interpolated value. The contributor acknowledgement folds a
 *  user-authored reasoning snippet into the email body, so it must be escaped
 *  (defence against HTML/script injection — the snippet is the contributor's
 *  own words, never trusted markup). */
function escapeHtml(s: string): string {
  return s.replace(
    /[<>&"']/g,
    (c) =>
      (({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }) as Record<
        string,
        string
      >)[c] ?? c,
  );
}

/**
 * Sprint C-16 — the contributor "your input shaped X" acknowledgement. One
 * template family, role-aware wording. Sent when a parent APPROVES a brain
 * profile that folded THIS contributor's input.
 *
 * THE PRIVACY RULE (content-safety tested). This template names ONLY:
 *   - the learner's FIRST name (`learnerFirstName`),
 *   - the contributor's OWN folded item labels + their own reasoning snippets
 *     (`items` — each { label, reasoning }).
 * It MUST NOT surface another contributor's content, the child's functioning
 * level / diagnoses / mastery, or any parent-private data. The web stack passes
 * only label + reasoning for the contributor's own role; this renderer never
 * receives anything else. The reasoning snippet is escaped (user-authored).
 *
 * Tone: gratitude without flattery, specificity without disclosure, ONE optional
 * CTA ("see your contributions"). A therapist is addressed as a clinical
 * professional; a caregiver may be ESL — plain, warm language.
 */
function renderContributionAcknowledged(
  data: TemplateData,
  role: "teacher" | "caregiver" | "therapist",
) {
  const learnerFirstName = escapeHtml((data.learnerFirstName as string) || "your learner");
  const contributionsUrl = (data.contributionsUrl as string) || "#";
  const unsubscribeUrl = (data.unsubscribeUrl as string) || "";
  const rawItems = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
  // Normalise + escape. Only label + reasoning are ever present (privacy).
  const items = rawItems
    .map((i) => ({
      label: escapeHtml(String(i.label ?? "").trim()),
      reasoning: escapeHtml(String(i.reasoning ?? "").trim()),
    }))
    .filter((i) => i.label.length > 0);

  const inputWord =
    role === "therapist"
      ? "clinical note"
      : role === "teacher"
        ? "classroom note"
        : "observation";
  const youWord = role === "therapist" ? "your clinical input" : "what you shared";

  // The headline support — the most tangible "this is what your note did".
  const lead = items[0];
  const leadLine = lead
    ? `your ${inputWord} helped keep <span class="highlight">${lead.label}</span> active for ${learnerFirstName}`
    : `your ${inputWord} is now part of ${learnerFirstName}'s plan`;

  const itemsHtml =
    items.length > 0
      ? `<ul class="body-text">${items
          .map(
            (i) =>
              `<li><strong>${i.label}</strong>${i.reasoning ? ` — <span style="color:#6b7280">${i.reasoning}</span>` : ""}</li>`,
          )
          .join("")}</ul>`
      : "";

  const html = baseLayout(`
    <h1 class="title">Your input shaped ${learnerFirstName}'s learning plan</h1>
    <p class="body-text">Thank you — ${leadLine}. It's now part of ${learnerFirstName}'s approved learning plan.</p>
    ${items.length > 0 ? `<p class="body-text">Here's what ${youWord} helped put in place:</p>${itemsHtml}` : ""}
    <p style="text-align:center"><a href="${contributionsUrl}" class="btn">See your contributions</a></p>
    <p class="body-text" style="font-size:13px;color:#6b7280">Have something new to add? You can share another ${inputWord} any time.${
      unsubscribeUrl
        ? ` If you'd rather not get these emails, <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">turn them off</a>.`
        : ""
    }</p>
  `);

  const textItems =
    items.length > 0
      ? `\n\n${items.map((i) => `- ${i.label}${i.reasoning ? `: ${i.reasoning}` : ""}`).join("\n")}`
      : "";
  return {
    subject: `Your input shaped ${learnerFirstName}'s learning plan`,
    html,
    text: `Thank you — ${lead ? `your ${inputWord} helped keep ${lead.label} active for ${learnerFirstName}` : `your ${inputWord} is now part of ${learnerFirstName}'s plan`}. It's now part of ${learnerFirstName}'s approved learning plan.${textItems}\n\nSee your contributions: ${contributionsUrl}${
      unsubscribeUrl ? `\n\nTo stop these emails: ${unsubscribeUrl}` : ""
    }`,
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
  {
    id: "recommendation_pending",
    name: "Recommendation Awaiting Approval",
    channels: ["email", "push"],
  },
  { id: "mfa_code", name: "MFA Verification Code", channels: ["email"] },
  { id: "district_admin_invite", name: "District Admin Invite", channels: ["email"] },
  { id: "parent_invite", name: "Parent Invite (into district tenant)", channels: ["email"] },
  { id: "trial_ending", name: "Trial Ending Reminder", channels: ["email", "in_app"] },
  { id: "school_admin_invite", name: "School Admin Invite", channels: ["email"] },
  { id: "teacher_invite", name: "Teacher Invite", channels: ["email"] },
  { id: "staff_credentials", name: "Staff Credentials (Temp Password)", channels: ["email"] },
  { id: "teacher_invite_parent", name: "Teacher → Parent Invite", channels: ["email"] },
  { id: "contribution_nudge", name: "Team Contribution Nudge", channels: ["email"] },
  { id: "invite_expiry_warning", name: "Invite Expiry Warning", channels: ["email"] },
  { id: "brain_profile_ready", name: "Learning Profile Ready (Screen 0)", channels: ["email", "in_app"] },
  { id: "brain_profile_changed", name: "Learning Profile Changed", channels: ["email", "in_app"] },
  { id: "brain_changes_reminder", name: "Profile Change Review Reminder", channels: ["email"] },
  {
    id: "contribution_acknowledged_teacher",
    name: "Contribution Acknowledged (Teacher)",
    channels: ["email", "in_app"],
  },
  {
    id: "contribution_acknowledged_caregiver",
    name: "Contribution Acknowledged (Caregiver)",
    channels: ["email", "in_app"],
  },
  {
    id: "contribution_acknowledged_therapist",
    name: "Contribution Acknowledged (Therapist)",
    channels: ["email", "in_app"],
  },
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
