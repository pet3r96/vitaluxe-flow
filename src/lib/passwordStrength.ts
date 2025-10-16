// Common leaked passwords (top 100 most common)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', '12345678', '12345', '1234567', 'password1',
  '12345678910', 'qwerty', 'abc123', '111111', '1234567890', '1234', 'password123',
  'qwerty123', '000000', 'iloveyou', '1q2w3e4r', 'qwertyuiop', '123123', 'monkey',
  'dragon', '654321', 'passw0rd', 'master', 'superman', 'batman', 'trustno1',
  'hello', 'freedom', 'whatever', 'letmein', 'welcome', 'admin', 'login',
  'princess', 'solo', 'sunshine', 'starwars', 'football', 'shadow', 'baseball'
]);

// Sequential patterns
const SEQUENTIAL_PATTERNS = [
  '123456', '234567', '345678', '456789', '567890',
  'abcdef', 'bcdefg', 'cdefgh', 'defghi', 'efghij'
];

// Keyboard patterns
const KEYBOARD_PATTERNS = [
  'qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'qwertyuiop',
  'asdfghjkl', 'zxcvbnm', '1qaz2wsx', 'qweasd'
];

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  requirements: PasswordRequirement[];
  strength: 'weak' | 'medium' | 'strong';
  feedback?: string;
}

/**
 * Validates password strength against HIPAA-compliant requirements
 */
export function validatePasswordStrength(
  password: string,
  email: string = '',
  oldPassword: string = ''
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
    }
  ];

  // Email check
  if (email) {
    const emailUsername = email.toLowerCase().split('@')[0];
    requirements.push({
      label: 'Does not contain email address',
      met: !password.toLowerCase().includes(emailUsername)
    });
  }

  // Old password check
  if (oldPassword) {
    requirements.push({
      label: 'Different from previous password',
      met: password !== oldPassword
    });
  }

  // Check against common passwords
  const isCommonPassword = COMMON_PASSWORDS.has(password.toLowerCase());
  requirements.push({
    label: 'Not a commonly used password',
    met: !isCommonPassword
  });

  // Check for sequential patterns
  const hasSequentialPattern = SEQUENTIAL_PATTERNS.some(pattern =>
    password.toLowerCase().includes(pattern)
  );
  requirements.push({
    label: 'No sequential patterns (e.g., 123456)',
    met: !hasSequentialPattern
  });

  // Check for keyboard patterns
  const hasKeyboardPattern = KEYBOARD_PATTERNS.some(pattern =>
    password.toLowerCase().includes(pattern)
  );
  requirements.push({
    label: 'No keyboard patterns (e.g., qwerty)',
    met: !hasKeyboardPattern
  });

  // Calculate strength
  const metCount = requirements.filter(r => r.met).length;
  const valid = metCount === requirements.length;
  
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (metCount >= requirements.length) {
    strength = 'strong';
  } else if (metCount >= requirements.length - 2) {
    strength = 'medium';
  }

  // Generate feedback
  let feedback = '';
  if (isCommonPassword) {
    feedback = '⚠️ This password appears in known data breaches. Choose a unique password.';
  } else if (hasSequentialPattern) {
    feedback = 'Avoid sequential patterns like "123456" or "abcdef".';
  } else if (hasKeyboardPattern) {
    feedback = 'Avoid keyboard patterns like "qwerty" or "asdfgh".';
  } else if (password.length < 12) {
    feedback = 'Password must be at least 12 characters long.';
  } else if (metCount < requirements.length) {
    feedback = 'Please meet all password requirements for maximum security.';
  }

  return {
    valid,
    requirements,
    strength,
    feedback
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
    'Must be different from previous password',
    'Not a commonly used password',
    'No sequential patterns (123456, abcdef)',
    'No keyboard patterns (qwerty, asdfgh)'
  ];
}
