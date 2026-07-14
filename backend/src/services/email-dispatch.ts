import { prisma } from '../lib/prisma';
import { sendEmail, getOrCreateUnsubscribeToken, buildUnsubscribeUrl } from '../lib/email';
import bcrypt from 'bcryptjs';
import { marked } from 'marked';
import { createSignedUrl } from '../lib/storage';

// ── Partner Invite Email ──────────────────────────────────────────────────────

// Shared "hardcoded teal template" — used for the default Invite & Certify
// welcome email and reused as-is for the Partner Payments welcome email so
// both onboarding paths send visually identical partner-facing emails.
export async function buildPartnerWelcomeEmail(opts: {
  recipientName: string;
  recipientEmail: string;
  courseTitle?: string;
  loginUrl: string;
}): Promise<{ subject: string; html: string; text: string }> {
  const { recipientName, recipientEmail, courseTitle, loginUrl } = opts;

  const subject = courseTitle
    ? `You're invited to Shero Training — ${courseTitle}`
    : `You're invited to Shero Training`;

  const bodyHtml = `
    <h1 style="font-size:24px;font-weight:700;color:#111;margin:0 0 24px;">Welcome to Shero Training</h1>
    <p style="color:#333;font-size:15px;line-height:1.6;">Hi ${recipientName || 'there'},</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">🎉 Welcome to Shero Training!</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">We're excited to have you join the <strong>${courseTitle ?? 'Shero'}</strong> training.</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">This is a simple, self-paced course that you can complete anytime from your laptop or desktop. Along the way, you'll learn key concepts through engaging training modules, test your knowledge with quick quizzes, and showcase your skills through a final practical assessment.</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">Once your submission is approved, you'll receive your Shero Certificate instantly.</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">Ready to get started?</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">👉 Click the button below and begin your learning journey today.</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">We look forward to supporting you every step of the way.</p>
    <p style="color:#333;font-size:15px;line-height:1.6;">Warm regards,<br>Team Shero</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${loginUrl}" style="background:#0d9488;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px;">Open Partner Hub</a>
    </div>
    <p style="color:#666;font-size:13px;line-height:1.5;">Or paste this link into your browser:<br>
      <a href="${loginUrl}" style="color:#0d9488;word-break:break-all;">${loginUrl}</a>
    </p>
    <p style="color:#888;font-size:12px;margin-top:24px;">This link will sign you in directly. If you didn't expect this email, you can safely ignore it.</p>
  `;

  const unsubToken = await getOrCreateUnsubscribeToken(recipientEmail);
  const unsubUrl   = buildUnsubscribeUrl(unsubToken);

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:32px 24px">
    ${bodyHtml}
    <hr style="margin-top:32px;border:none;border-top:1px solid #eee">
    <p style="color:#999;font-size:12px;text-align:center;">You received this email because of an action on Shero Training.<br>
      <a href="${unsubUrl}" style="color:#999;">Unsubscribe from these emails</a>
    </p>
  </body></html>`;

  return { subject, html, text: `You're invited to Shero Training. Click here to start: ${loginUrl}` };
}

export async function sendPartnerInviteEmail(inviteId: string): Promise<{ link: string; email: string; emailed: boolean }> {
  const invite = await prisma.lpPartnerInvite.findUniqueOrThrow({ where: { id: inviteId } });

  // Ensure user exists
  let userId = invite.userId;
  if (!userId) {
    const email = invite.recipientEmail.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const hash = await bcrypt.hash(tempPassword, 12);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: hash,
          emailConfirmed: true,
          profile: { create: { displayName: invite.recipientName } },
          userRoles: { create: { role: 'kitchen_partner' } },
        },
      });
    }
    userId = user.id;
    await prisma.lpPartnerInvite.update({ where: { id: invite.id }, data: { userId } });
  }

  // Partners always sign in through the email+OTP flow — never the
  // password-based /login page. The invite's own token is only carried in
  // the URL for continuity/logging; verify-otp re-checks approval by email.
  const siteUrl   = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  const loginUrl  = `${siteUrl}/partner-login?token=${invite.token}`;

  // Get course welcome letter
  let courseTitle: string | undefined;
  let customSubject: string | undefined;
  let customBodyMd: string | undefined;
  if (invite.courseId) {
    const course = await prisma.lpCourse.findUnique({
      where:  { id: invite.courseId },
      select: { title: true, welcomeLetter: true },
    });
    courseTitle   = course?.title;
    const wl      = (course?.welcomeLetter ?? {}) as { subject?: string; body_md?: string };
    customSubject = wl.subject?.trim() || undefined;
    customBodyMd  = wl.body_md?.trim() || undefined;
  }

  let subject: string;
  let html: string;
  let text: string;

  if (customBodyMd) {
    // Admin-defined Welcome Letter — replace tokens, then convert markdown → HTML
    subject = (customSubject ?? (courseTitle ? `You're invited to Shero Training — ${courseTitle}` : `You're invited to Shero Training`))
      .replaceAll('{{partner_name}}', invite.recipientName ?? '')
      .replaceAll('{{course_title}}', courseTitle ?? '');

    const replaced = customBodyMd
      .replaceAll('{{partner_name}}', invite.recipientName ?? 'there')
      .replaceAll('{{course_title}}', courseTitle ?? '')
      .replaceAll('{{invite_link}}', loginUrl);
    const renderedMarkdown = marked.parse(replaced, { async: false }) as string;

    // Append the styled CTA button + link fallback (markdown can't easily make a styled button)
    const bodyHtml = `
      <div style="font-size:15px;line-height:1.6;color:#333;">${renderedMarkdown}</div>
      <div style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}" style="background:#0d9488;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px;">Open Partner Hub</a>
      </div>
      <p style="color:#666;font-size:13px;line-height:1.5;">Or paste this link into your browser:<br>
        <a href="${loginUrl}" style="color:#0d9488;word-break:break-all;">${loginUrl}</a>
      </p>
      <p style="color:#888;font-size:12px;margin-top:24px;">This link will sign you in directly. If you didn't expect this email, you can safely ignore it.</p>
    `;

    const unsubToken = await getOrCreateUnsubscribeToken(invite.recipientEmail);
    const unsubUrl   = buildUnsubscribeUrl(unsubToken);
    html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;max-width:600px;margin:0 auto;padding:32px 24px">
      ${bodyHtml}
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee">
      <p style="color:#999;font-size:12px;text-align:center;">You received this email because of an action on Shero Training.<br>
        <a href="${unsubUrl}" style="color:#999;">Unsubscribe from these emails</a>
      </p>
    </body></html>`;
    text = `You're invited to Shero Training. Click here to start: ${loginUrl}`;
  } else {
    // Fallback — shared hardcoded teal template, same one used by Partner Payments
    ({ subject, html, text } = await buildPartnerWelcomeEmail({
      recipientName:  invite.recipientName ?? 'there',
      recipientEmail: invite.recipientEmail,
      courseTitle,
      loginUrl,
    }));
  }

  await sendEmail({
    to:           invite.recipientEmail,
    subject,
    html,
    text,
    templateName: 'partner-invite',
    messageId:    `partner-invite-${invite.id}-${Date.now()}`,
  });

  return { link: loginUrl, email: invite.recipientEmail, emailed: true };
}

// ── Physical Visit Emails ─────────────────────────────────────────────────────

type EmailKind   = 'assigned' | 'rescheduled';
type EmailTarget = 'visitor' | 'partner' | 'both';

export async function sendPhysicalVisitEmails(
  visitId: string,
  kind: EmailKind,
  target: EmailTarget = 'both',
): Promise<void> {
  const visit = await prisma.lpPhysicalVisit.findUniqueOrThrow({ where: { id: visitId } });

  let tok = await prisma.lpPhysicalVisitToken.findUnique({ where: { visitId } });
  if (!tok) {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    tok = await prisma.lpPhysicalVisitToken.create({ data: { visitId, token } });
  }

  const siteUrl   = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
  const portalUrl = `${siteUrl}/visitor/physical-visit?token=${tok.token}`;

  const [prof, invite] = await Promise.all([
    prisma.profile.findUnique({ where: { id: visit.userId } }),
    prisma.lpPartnerInvite.findFirst({
      where:  { userId: visit.userId, courseId: visit.courseId },
      select: { recipientEmail: true, recipientName: true, kitchenLocation: true },
    }),
  ]);

  const recipeIds = Array.isArray(visit.productIds) ? visit.productIds as string[] : [];
  const cuisineId = visit.cuisineId;
  const [recipes, cuisine] = await Promise.all([
    recipeIds.length ? prisma.lpRecipe.findMany({ where: { id: { in: recipeIds } } }) : [],
    cuisineId ? prisma.lpCuisine.findUnique({ where: { id: cuisineId } }) : null,
  ]);

  const partnerName     = prof?.displayName ?? invite?.recipientName ?? 'Partner';
  const partnerEmail    = invite?.recipientEmail ?? null;
  const cuisineName     = cuisine?.name ?? null;
  const assignedProducts = recipes.map((r: { foodName: string }) => r.foodName);

  async function enqueue(to: string, subject: string, html: string, label: string) {
    await sendEmail({
      to, subject, html,
      text:         `Shero Physical Visit — ${subject}`,
      templateName: label,
      messageId:    `${label}-${visitId}-${Date.now()}`,
    });
  }

  const wantVisitor = (target === 'both' || target === 'visitor') && visit.visitorEmail;
  const wantPartner = (target === 'both' || target === 'partner') && partnerEmail;

  if (wantVisitor && visit.visitorEmail) {
    if (kind === 'assigned') {
      const html = buildVisitorEmail({
        visitorName:      visit.visitorName ?? undefined,
        partnerName,
        partnerEmail:     partnerEmail ?? undefined,
        partnerLocation:  visit.partnerLocation ?? invite?.kitchenLocation ?? undefined,
        partnerState:     visit.partnerState ?? undefined,
        partnerCountry:   visit.partnerCountry ?? undefined,
        partnerPhone:     visit.partnerPhone ?? undefined,
        partnerAddress:   visit.partnerAddress ?? undefined,
        cuisineName:      cuisineName ?? undefined,
        assignedProducts,
        visitDate:        visit.visitDate ?? '',
        visitTime:        visit.visitTime ?? '',
        remarks:          visit.remarks ?? undefined,
        portalUrl,
      });
      await enqueue(visit.visitorEmail, `Physical Visit Assigned — ${partnerName}`, html, 'physical-visit-visitor');
    } else {
      const html = buildVisitorEmail({
        visitorName:     visit.visitorName ?? undefined,
        partnerName,
        partnerEmail:    partnerEmail ?? undefined,
        partnerLocation: visit.partnerLocation ?? invite?.kitchenLocation ?? undefined,
        partnerState:    visit.partnerState ?? undefined,
        partnerCountry:  visit.partnerCountry ?? undefined,
        partnerPhone:    visit.partnerPhone ?? undefined,
        partnerAddress:  visit.partnerAddress ?? undefined,
        cuisineName:     cuisineName ?? undefined,
        assignedProducts,
        visitDate:       visit.visitDate ?? '',
        visitTime:       visit.visitTime ?? '',
        remarks:         visit.remarks ?? undefined,
        portalUrl,
        heading:         'Physical Kitchen Visit Rescheduled',
      });
      await enqueue(visit.visitorEmail, `Physical Visit Rescheduled — ${partnerName}`, html, 'physical-visit-rescheduled');
    }
    await prisma.lpPhysicalVisit.update({ where: { id: visitId }, data: { visitorEmailSentAt: new Date(), emailStatus: 'sent', lastEmailKind: kind } });
  }

  if (wantPartner && partnerEmail) {
    if (kind === 'assigned') {
      const html = buildPartnerEmail({ partnerName, visitorName: visit.visitorName ?? undefined, visitorPhone: visit.visitorPhone ?? undefined, cuisineName: cuisineName ?? undefined, assignedProducts, visitDate: visit.visitDate ?? '', visitTime: visit.visitTime ?? '', remarks: visit.remarks ?? undefined });
      await enqueue(partnerEmail, 'Your Shero Physical Visit Has Been Scheduled', html, 'physical-visit-partner');
    } else {
      const html = buildPartnerEmail({
        partnerName,
        visitorName:     visit.visitorName ?? undefined,
        visitorPhone:    visit.visitorPhone ?? undefined,
        cuisineName:     cuisineName ?? undefined,
        assignedProducts,
        visitDate:       visit.visitDate ?? '',
        visitTime:       visit.visitTime ?? '',
        remarks:         visit.remarks ?? undefined,
        heading:         'Physical Kitchen Visit Rescheduled',
      });
      await enqueue(partnerEmail, 'Your Shero Physical Visit Has Been Rescheduled', html, 'physical-visit-rescheduled-partner');
    }
    await prisma.lpPhysicalVisit.update({ where: { id: visitId }, data: { partnerEmailSentAt: new Date(), emailStatus: 'sent' } });
  }
}

// ── Email HTML builders (inline templates) ────────────────────────────────────

const EMAIL_WRAPPER = (body: string) => `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%">
  <tr><td style="background:#0d9488;padding:24px 32px">
    <p style="margin:0;font-size:13px;color:#ccfbf1;letter-spacing:0.05em;text-transform:uppercase;font-weight:600">Shero Home Food</p>
  </td></tr>
  <tr><td style="padding:32px">${body}</td></tr>
  <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="margin:0;color:#9ca3af;font-size:12px">Thank you for supporting Shero Home Food quality standards.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

const BOX = (title: string, rows: string) =>
  `<div style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:20px;overflow:hidden">
    <div style="background:#f0fdfa;padding:12px 16px;border-bottom:1px solid #ccfbf1">
      <p style="margin:0;font-size:13px;font-weight:700;color:#0d9488;text-transform:uppercase;letter-spacing:0.05em">${title}</p>
    </div>
    <div style="padding:16px">${rows}</div>
  </div>`;

// Table-based, not flexbox — flexbox isn't reliably rendered by many email
// clients (notably Outlook desktop), which can make row values disappear.
const ROW = (label: string, value: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr>
    <td valign="top" style="font-size:13px;font-weight:600;color:#374151;width:140px">${label}</td>
    <td valign="top" style="font-size:13px;color:#4b5563">${value || '—'}</td>
  </tr></table>`;

const BULLET_LIST = (items: string[]) =>
  items.length ? `<ul style="margin:4px 0 0 0;padding-left:20px">${items.map(i => `<li style="font-size:13px;color:#4b5563;margin-bottom:4px">${i}</li>`).join('')}</ul>` : '<span style="font-size:13px;color:#9ca3af">—</span>';

const CTA_BUTTON = (href: string, label: string) =>
  `<div style="text-align:center;margin:28px 0 20px">
    <a href="${href}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:700;padding:14px 40px;border-radius:50px;text-decoration:none">${label}</a>
  </div>
  <p style="text-align:center;margin:0 0 8px;font-size:12px;color:#9ca3af">Or open this link:</p>
  <p style="text-align:center;margin:0;word-break:break-all"><a href="${href}" style="font-size:12px;color:#0d9488">${href}</a></p>`;

function buildVisitorEmail(p: {
  visitorName?: string; partnerName: string; partnerEmail?: string;
  partnerLocation?: string; partnerState?: string; partnerCountry?: string; partnerPhone?: string; partnerAddress?: string;
  cuisineName?: string; assignedProducts: string[];
  visitDate: string; visitTime: string; remarks?: string; portalUrl: string;
  heading?: string;
}): string {
  const partnerBox = BOX('Partner Details',
    ROW('Name', p.partnerName) +
    ROW('Email', p.partnerEmail ?? '') +
    ROW('Phone', p.partnerPhone ?? '') +
    ROW('Address', p.partnerAddress ?? '') +
    ROW('State', p.partnerState ?? '') +
    ROW('Country', p.partnerCountry ?? ''),
  );
  const cookingBox = BOX('Assigned Cooking',
    ROW('Cuisine', p.cuisineName ?? '') +
    `<div style="margin-bottom:8px"><span style="font-size:13px;font-weight:600;color:#374151">Assigned Products:</span>${BULLET_LIST(p.assignedProducts)}</div>`,
  );
  const visitBox = BOX('Visit Details',
    ROW('Visit Date', p.visitDate) +
    ROW('Visit Time', p.visitTime) +
    (p.remarks ? ROW('Remarks', p.remarks) : ''),
  );

  const heading = p.heading ?? 'Physical Kitchen Visit Assigned';
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151">Hi ${p.visitorName ?? 'there'},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6">
      You have been assigned to inspect a Shero Home Food partner kitchen. Please review the details below and complete the inspection through the Visitor Portal.
    </p>
    ${partnerBox}${cookingBox}${visitBox}
    ${CTA_BUTTON(p.portalUrl, 'Start Physical Visit')}
  `;
  return EMAIL_WRAPPER(body);
}

function buildPartnerEmail(p: {
  partnerName: string; visitorName?: string; visitorPhone?: string;
  cuisineName?: string; assignedProducts?: string[];
  visitDate: string; visitTime: string; remarks?: string;
  heading?: string;
}): string {
  const visitorBox = BOX('Visitor Details',
    ROW('Name', p.visitorName ?? '') +
    ROW('Phone', p.visitorPhone ?? ''),
  );
  const cookingBox = BOX('Assigned Cooking',
    ROW('Cuisine', p.cuisineName ?? '') +
    `<div style="margin-bottom:8px"><span style="font-size:13px;font-weight:600;color:#374151">Products to Cook:</span>${BULLET_LIST(p.assignedProducts ?? [])}</div>`,
  );
  const visitBox = BOX('Visit Details',
    ROW('Visit Date', p.visitDate) +
    ROW('Visit Time', p.visitTime) +
    (p.remarks ? ROW('Remarks', p.remarks) : ''),
  );

  const heading = p.heading ?? 'Physical Kitchen Visit Scheduled';
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">${heading}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151">Hi ${p.partnerName},</p>
    <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6">
      A Shero visitor has been scheduled to inspect your kitchen. Please ensure your kitchen is ready for the visit.
    </p>
    ${visitorBox}${cookingBox}${visitBox}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center">Please prepare the assigned dishes and have your kitchen ready before the visit time.</p>
  `;
  return EMAIL_WRAPPER(body);
}

// ── Partner Certification Email ───────────────────────────────────────────────

export async function sendCertificationEmail(
  userId:   string,
  courseId: string,
  certCode: string,
): Promise<void> {
  const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';

  const [invite, course, resources] = await Promise.all([
    prisma.lpPartnerInvite.findFirst({
      where:  { userId, courseId },
      select: { recipientEmail: true, recipientName: true, token: true },
    }),
    prisma.lpCourse.findUnique({
      where:  { id: courseId },
      select: { title: true },
    }),
    prisma.sftPartnerResource.findMany({ where: { courseId }, orderBy: { sortOrder: 'asc' } }),
  ]);

  if (!invite?.recipientEmail) return;

  // Partners always sign in through email+OTP — never the password /login page.
  const loginUrl = `${siteUrl}/partner-login?token=${invite.token}`;

  // Generate signed download URLs for each resource (valid 7 days)
  const resourceRows = await Promise.all(
    resources.map(async (r) => {
      const url = r.filePath ? await createSignedUrl('sft-practice', r.filePath).catch(() => null) : null;
      return { title: r.title, url };
    }),
  );

  const resourceItems = resourceRows
    .map(r =>
      r.url
        ? `<li style="margin-bottom:10px;font-size:14px;color:#374151"><a href="${r.url}" style="color:#0d9488;font-weight:600">${r.title}</a> — <a href="${r.url}" style="color:#0d9488">Download</a></li>`
        : `<li style="margin-bottom:10px;font-size:14px;color:#374151">${r.title}</li>`,
    )
    .join('');

  const resourceSection = resources.length > 0
    ? BOX('Your Resources & Downloads',
        `<p style="margin:0 0 10px;font-size:13px;color:#6b7280">These resources are now unlocked in your Partner Hub.</p>
         <ul style="margin:4px 0;padding-left:20px">${resourceItems}</ul>`)
    : '';

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827">Congratulations, ${invite.recipientName}! 🎉</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#374151">You are now a certified Shero Kitchen Partner.</p>
    <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6">
      Your physical kitchen visit has been approved. Your Shero certificate is ready and your training resources are now unlocked.
    </p>
    ${BOX('Your Certificate',
      ROW('Course',           course?.title ?? 'Shero Training') +
      ROW('Certificate Code', certCode) +
      ROW('Status',           '&#10003; Approved &amp; Certified'),
    )}
    ${resourceSection}
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6">
      Log in to your Partner Hub to view and download your certificate, access all resources, and begin your journey as a Shero partner.
    </p>
    ${CTA_BUTTON(loginUrl, 'Open Partner Hub')}
  `;

  await sendEmail({
    to:           invite.recipientEmail,
    subject:      `You're Certified! — Shero Kitchen Partner`,
    html:         EMAIL_WRAPPER(body),
    text:         `Congratulations ${invite.recipientName}! You are now a certified Shero Kitchen Partner. Certificate Code: ${certCode}. Log in at: ${loginUrl}`,
    templateName: 'partner-certified',
    messageId:    `partner-certified-${userId}-${courseId}-${Date.now()}`,
  });
}