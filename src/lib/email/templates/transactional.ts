/**
 * Transactional Email Templates
 * These emails ALWAYS send regardless of user preferences
 */

import { wrapEmailTemplate, createTextVersion } from './shared';

export interface WelcomeEmailVariables {
  recipientName: string;
  resetLink: string;
  isPatient?: boolean;
  practiceName?: string;
  twoFactorEnabled?: boolean;
}

export function generateWelcomeEmail(vars: WelcomeEmailVariables) {
  const content = `
    <div class="content">
      <p class="greeting">Dear ${vars.recipientName},</p>
      <h2>Welcome to Vitaluxe${vars.practiceName ? ` - ${vars.practiceName}` : ''}!</h2>
      ${vars.isPatient 
        ? '<p>Your healthcare provider has created a secure patient portal account for you.</p>'
        : '<p>Your account has been created and you now have access to the Vitaluxe platform.</p>'
      }
      <p><strong>Important:</strong> You need to set your password before you can access your account.</p>
      ${vars.twoFactorEnabled 
        ? '<p><em>Note: Two-factor authentication is enabled. After setting your password, you\'ll need to set up 2FA on your next login.</em></p>'
        : ''
      }
      <div style="text-align: center;">
        <a href="${vars.resetLink}" class="button">Set Your Password</a>
      </div>
      <p style="margin-top: 30px; color: #C8A64B; font-size: 14px;">
        This link will expire in 7 days. If you did not request this account, please disregard this email.
      </p>
    </div>
  `;

  const htmlBody = wrapEmailTemplate(content);
  const textBody = createTextVersion(`
    Welcome to Vitaluxe${vars.practiceName ? ` - ${vars.practiceName}` : ''}!
    
    Dear ${vars.recipientName},
    
    ${vars.isPatient 
      ? 'Your healthcare provider has created a secure patient portal account for you.'
      : 'Your account has been created and you now have access to the Vitaluxe platform.'
    }
    
    IMPORTANT: You need to set your password before you can access your account.
    
    ${vars.twoFactorEnabled 
      ? 'Note: Two-factor authentication is enabled. After setting your password, you\'ll need to set up 2FA on your next login.'
      : ''
    }
    
    Click here to set your password: ${vars.resetLink}
    
    This link will expire in 7 days. If you did not request this account, please disregard this email.
    
    © ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `);

  return {
    subject: `Welcome to Vitaluxe${vars.practiceName ? ` - ${vars.practiceName}` : ''}`,
    htmlBody,
    textBody,
  };
}

export interface PasswordResetEmailVariables {
  recipientName: string;
  resetLink: string;
}

export function generatePasswordResetEmail(vars: PasswordResetEmailVariables) {
  const content = `
    <div class="content">
      <p class="greeting">Dear ${vars.recipientName},</p>
      <h2>Reset Your Password</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center;">
        <a href="${vars.resetLink}" class="button">Reset Password</a>
      </div>
      <p style="margin-top: 30px; color: #C8A64B; font-size: 14px;">
        This link will expire in 1 hour. If you did not request a password reset, please ignore this email.
      </p>
    </div>
  `;

  const htmlBody = wrapEmailTemplate(content);
  const textBody = createTextVersion(`
    Reset Your Password
    
    Dear ${vars.recipientName},
    
    We received a request to reset your password. Click the link below to create a new password:
    
    ${vars.resetLink}
    
    This link will expire in 1 hour. If you did not request a password reset, please ignore this email.
    
    © ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `);

  return {
    subject: 'Reset Your Vitaluxe Password',
    htmlBody,
    textBody,
  };
}

export interface VerificationEmailVariables {
  recipientName: string;
  verificationLink: string;
}

export function generateVerificationEmail(vars: VerificationEmailVariables) {
  const content = `
    <div class="content">
      <p class="greeting">Dear ${vars.recipientName},</p>
      <h2>Verify Your Email Address</h2>
      <p>Please click the button below to verify your email address and activate your account:</p>
      <div style="text-align: center;">
        <a href="${vars.verificationLink}" class="button">Verify Email</a>
      </div>
      <p style="margin-top: 30px; color: #C8A64B; font-size: 14px;">
        This link will expire in 24 hours. If you did not create an account, please ignore this email.
      </p>
    </div>
  `;

  const htmlBody = wrapEmailTemplate(content);
  const textBody = createTextVersion(`
    Verify Your Email Address
    
    Dear ${vars.recipientName},
    
    Please click the link below to verify your email address and activate your account:
    
    ${vars.verificationLink}
    
    This link will expire in 24 hours. If you did not create an account, please ignore this email.
    
    © ${new Date().getFullYear()} Vitaluxe Services. All rights reserved.
  `);

  return {
    subject: 'Verify Your Vitaluxe Email',
    htmlBody,
    textBody,
  };
}
