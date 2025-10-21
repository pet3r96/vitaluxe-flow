import { describe, it, expect, vi } from 'vitest';
import { 
  generateMockTempPassword, 
  generateMockVerificationLink,
  mockSESSend 
} from '../utils/testHelpers';

/**
 * Unit Tests for Auth Service Functions
 * Tests individual utility functions
 */

describe('Auth Service Unit Tests', () => {
  describe('Password generation', () => {
    it('should generate valid temp passwords', () => {
      const password = generateMockTempPassword();
      
      expect(password).toMatch(/^TempPass.*!$/);
      expect(password.length).toBeGreaterThan(10);
    });

    it('should generate unique passwords', () => {
      const pass1 = generateMockTempPassword();
      const pass2 = generateMockTempPassword();
      
      expect(pass1).not.toBe(pass2);
    });
  });

  describe('Verification link generation', () => {
    it('should generate valid verification links', () => {
      const userId = crypto.randomUUID();
      const link = generateMockVerificationLink(userId);
      
      expect(link).toContain('verify');
      expect(link).toContain(userId);
    });
  });

  describe('Email sending', () => {
    it('should send verification emails', async () => {
      const email = 'test@vitaluxe.test';
      const link = generateMockVerificationLink(crypto.randomUUID());
      
      await mockSESSend({
        to: email,
        template: 'signup_verification',
        data: { verification_link: link },
      });
      
      expect(mockSESSend).toHaveBeenCalledWith({
        to: email,
        template: 'signup_verification',
        data: { verification_link: link },
      });
    });

    it('should send temp password emails', async () => {
      const email = 'admin-created@vitaluxe.test';
      const tempPassword = generateMockTempPassword();
      
      await mockSESSend({
        to: email,
        template: 'admin_temp_password',
        data: { temp_password: tempPassword, login_link: 'http://localhost:5173/auth' },
      });
      
      expect(mockSESSend).toHaveBeenCalledWith({
        to: email,
        template: 'admin_temp_password',
        data: { temp_password: tempPassword, login_link: 'http://localhost:5173/auth' },
      });
    });
  });
});
