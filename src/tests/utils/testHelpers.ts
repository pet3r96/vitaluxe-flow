import { vi } from 'vitest';

/**
 * Mock user data generator
 */
export const generateMockUser = (role: string, overrides = {}) => ({
  id: crypto.randomUUID(),
  email: `test-${role}@vitaluxe.test`,
  role,
  status: 'active',
  verified_at: new Date().toISOString(),
  temp_password: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Mock Supabase responses
 */
export const mockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error,
});

/**
 * Mock SES email sending
 */
export const mockSESSend = vi.fn().mockResolvedValue({
  MessageId: 'test-message-id',
});

/**
 * Generate mock verification link
 */
export const generateMockVerificationLink = (userId: string) => 
  `http://localhost:5173/verify?token=${userId}`;

/**
 * Generate mock temp password
 */
export const generateMockTempPassword = () => 
  'TempPass' + Math.random().toString(36).slice(2, 10) + '!';

/**
 * Wait for async operations
 */
export const waitForAsync = () => 
  new Promise(resolve => setTimeout(resolve, 0));

/**
 * Mock database state manager
 */
export class MockDatabase {
  private users: Map<string, any> = new Map();
  private sessions: Map<string, any> = new Map();
  
  async insertUser(userData: any) {
    // Validate required fields
    if (!userData.email) {
      throw new Error('Email is required');
    }
    if (!userData.role) {
      throw new Error('Role is required');
    }
    
    const id = userData.id || crypto.randomUUID();
    const user = { ...userData, id };
    this.users.set(id, user);
    return user;
  }
  
  async findUserByEmail(email: string) {
    return Array.from(this.users.values()).find(u => u.email === email);
  }
  
  async updateUser(id: string, updates: any) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }
  
  async createSession(userId: string) {
    const sessionId = crypto.randomUUID();
    const session = { id: sessionId, userId, createdAt: new Date() };
    this.sessions.set(sessionId, session);
    return session;
  }
  
  clear() {
    this.users.clear();
    this.sessions.clear();
  }
}
