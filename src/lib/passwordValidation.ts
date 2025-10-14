import zxcvbn from 'zxcvbn';

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  requirements: PasswordRequirement[];
  strength: 'weak' | 'medium' | 'strong';
  zxcvbnScore: number;
  feedback?: string;
  crackTimeDisplay?: string;
}

/**
 * HIPAA-compliant password validation
 */
export function validatePasswordStrength(
  password: string,
  email: string,
  oldPassword?: string
): PasswordValidationResult {
  const requirements: PasswordRequirement[] = [
    {
      label: 'At least 12 characters',
      met: password.length >= 12
    },
    {
      label: 'Contains uppercase letter (A-Z)',
      met: /[A-Z]/.test(password)
    },
    {
      label: 'Contains lowercase letter (a-z)',
      met: /[a-z]/.test(password)
    },
    {
      label: 'Contains number (0-9)',
      met: /[0-9]/.test(password)
    },
    {
      label: 'Contains special character (!@#$%^&*)',
      met: /[!@#$%^&*]/.test(password)
    },
    {
      label: 'Does not contain email address',
      met: !password.toLowerCase().includes(email.toLowerCase().split('@')[0])
    }
  ];

  if (oldPassword) {
    requirements.push({
      label: 'Different from temporary password',
      met: password !== oldPassword
    });
  }

  // Use zxcvbn for industry-standard password strength
  const zxcvbnResult = zxcvbn(password, [email, email.split('@')[0]]);
  
  // Require zxcvbn score >= 3 (strong)
  requirements.push({
    label: 'Industry-standard strength score (strong)',
    met: zxcvbnResult.score >= 3
  });

  const metCount = requirements.filter(r => r.met).length;
  const valid = metCount === requirements.length;
  
  // Determine strength based on zxcvbn score
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (zxcvbnResult.score >= 3) strength = 'strong';
  else if (zxcvbnResult.score >= 2) strength = 'medium';
  else strength = 'weak';

  // Get user-friendly feedback with breach warnings
  let feedback = zxcvbnResult.feedback.suggestions?.[0] || '';
  
  // Add explicit breach warning if dictionary words detected
  if (zxcvbnResult.feedback.warning && zxcvbnResult.score < 3) {
    feedback = zxcvbnResult.feedback.warning + '. ' + feedback;
  }
  
  // Enhanced feedback for very weak passwords
  if (zxcvbnResult.score < 2 && !feedback) {
    feedback = '⚠️ This password appears in known data breaches. Choose a unique password.';
  }

  // Format crack time display
  const crackTimeDisplay = String(zxcvbnResult.crack_times_display.offline_slow_hashing_1e4_per_second);

  return { 
    valid, 
    requirements, 
    strength,
    zxcvbnScore: zxcvbnResult.score,
    feedback,
    crackTimeDisplay
  };
}

export function getPasswordRequirementsList(): string[] {
  return [
    'Minimum 12 characters',
    'At least 1 uppercase letter (A-Z)',
    'At least 1 lowercase letter (a-z)',
    'At least 1 number (0-9)',
    'At least 1 special character (!@#$%^&*)',
    'Cannot contain your email address',
    'Must be different from temporary password',
    'Industry-standard strength score (strong)'
  ];
}
