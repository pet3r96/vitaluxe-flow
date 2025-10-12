export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  requirements: PasswordRequirement[];
  strength: 'weak' | 'medium' | 'strong';
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

  const metCount = requirements.filter(r => r.met).length;
  const valid = metCount === requirements.length;
  
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (metCount >= requirements.length) strength = 'strong';
  else if (metCount >= requirements.length - 1) strength = 'medium';

  return { valid, requirements, strength };
}

export function getPasswordRequirementsList(): string[] {
  return [
    'Minimum 12 characters',
    'At least 1 uppercase letter (A-Z)',
    'At least 1 lowercase letter (a-z)',
    'At least 1 number (0-9)',
    'At least 1 special character (!@#$%^&*)',
    'Cannot contain your email address',
    'Must be different from temporary password'
  ];
}
