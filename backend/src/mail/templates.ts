// Shared HTML shell so every transactional email looks like it came from the
// same product, without pulling in a template engine dependency for what is
// currently a handful of short, mostly-static emails.
function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0b0c;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;background:#0b0b0c;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#17171a;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="color:#f2994a;font-size:20px;font-weight:700;">HaiVE</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px 32px;color:#e8e8ea;font-size:15px;line-height:1.6;">
                <h1 style="font-size:20px;margin:0 0 16px 0;color:#ffffff;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function otpBlock(code: string): string {
  return `<div style="margin:20px 0;padding:16px;background:#0b0b0c;border-radius:8px;text-align:center;">
    <span style="font-size:28px;letter-spacing:8px;font-weight:700;color:#f2994a;">${code}</span>
  </div>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: 'Welcome to HaiVE',
    html: shell(
      `Welcome aboard, ${name}`,
      `<p>Your HaiVE workspace is ready. You can sign in and start chatting with your AI agents right away.</p>`,
    ),
  };
}

export function verifyEmailOtp(code: string): { subject: string; html: string } {
  return {
    subject: 'Verify your email — HaiVE',
    html: shell(
      'Verify your email',
      `<p>Enter this code to verify your email address. It expires in 10 minutes.</p>${otpBlock(code)}<p>If you didn't request this, you can safely ignore this email.</p>`,
    ),
  };
}

export function passwordResetOtp(code: string): { subject: string; html: string } {
  return {
    subject: 'Reset your password — HaiVE',
    html: shell(
      'Reset your password',
      `<p>Use this code to reset your password. It expires in 15 minutes.</p>${otpBlock(code)}<p>If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    ),
  };
}

export function notificationEmail(title: string, description: string): { subject: string; html: string } {
  return {
    subject: title,
    html: shell(
      title,
      `<p>${description}</p><p style="margin-top:24px;color:#9a9aa0;font-size:13px;">You're receiving this because email notifications are enabled in your HaiVE Settings — you can turn them off any time under Settings &rsaquo; Notifications.</p>`,
    ),
  };
}

export function twoFactorEnabledEmail(): { subject: string; html: string } {
  return {
    subject: 'Two-factor authentication enabled — HaiVE',
    html: shell(
      'Two-factor authentication is now on',
      `<p>Your account now requires a code from your authenticator app to sign in, in addition to your password.</p><p>If you didn't make this change, secure your account immediately: sign in, change your password, and disable two-factor authentication under Settings &rsaquo; Security.</p>`,
    ),
  };
}
