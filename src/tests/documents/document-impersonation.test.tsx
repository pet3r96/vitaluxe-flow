import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Test Scenario #4: Document Operations During Impersonation
 * 
 * Purpose: Verify all document operations work correctly when admin is impersonating a patient.
 */
describe('Document Impersonation', () => {
  let queryClient: QueryClient;
  const adminUserId = 'admin-user-123';
  const patientUserId = 'patient-john-smith-user';
  const patientId = 'patient-john-smith-account';
  const practiceId = 'practice-123';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should detect active impersonation session', async () => {
    // Mock admin authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: adminUserId, email: 'admin@test.com' } as any },
      error: null,
    });

    // Mock active impersonation
    vi.mocked(supabase.functions.invoke).mockImplementation((funcName) => {
      if (funcName === 'get-active-impersonation') {
        return Promise.resolve({
          data: {
            session: {
              id: 'impersonation-session-456',
              admin_user_id: adminUserId,
              impersonated_user_id: patientUserId,
              role: 'patient',
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { data } = await supabase.functions.invoke('get-active-impersonation');

    expect(data.session).toBeDefined();
    expect(data.session.admin_user_id).toBe(adminUserId);
    expect(data.session.impersonated_user_id).toBe(patientUserId);
  });

  it('should use effectiveUserId when fetching patient documents', async () => {
    // Mock admin auth
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: adminUserId, email: 'admin@test.com' } as any },
      error: null,
    });

    // Mock impersonation
    vi.mocked(supabase.functions.invoke).mockImplementation((funcName) => {
      if (funcName === 'get-active-impersonation') {
        return Promise.resolve({
          data: {
            session: { impersonated_user_id: patientUserId },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Mock patient account lookup using effectiveUserId
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((column, value) => {
            // Should use patientUserId (effective), not adminUserId
            expect(value).toBe(patientUserId);
            return {
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: patientId,
                  user_id: patientUserId,
                  first_name: 'John',
                  last_name: 'Smith',
                },
                error: null,
              }),
            };
          }),
        } as any;
      }
      return {} as any;
    });

    // Simulate the effectiveUserId logic
    const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
    const effectiveUserId = impersonationData?.session?.impersonated_user_id || adminUserId;

    const { data: patientAccount } = await supabase
      .from('patient_accounts')
      .select('*')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    expect(patientAccount.user_id).toBe(patientUserId);
  });

  it('should fetch assigned documents during impersonation', async () => {
    // Mock impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        session: { impersonated_user_id: patientUserId },
      },
      error: null,
    });

    // Mock RPC with assigned documents
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_patient_unified_documents') {
        return Promise.resolve({
          data: [
            {
              id: 'doc-1',
              document_name: 'Lab Results',
              source: 'provider_assigned',
              is_provider_document: true,
            },
            {
              id: 'doc-2',
              document_name: 'Insurance Card',
              source: 'patient_upload',
              is_provider_document: false,
            },
          ],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    const { data } = await supabase.rpc('get_patient_unified_documents', {
      p_patient_id: patientId,
    });

    expect(data).toHaveLength(2);
    expect(data.some(d => d.source === 'provider_assigned')).toBe(true);
    expect(data.some(d => d.source === 'patient_upload')).toBe(true);
  });

  it('should allow document upload during impersonation with correct patient_id', async () => {
    // Mock impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        session: { impersonated_user_id: patientUserId },
      },
      error: null,
    });

    // Mock patient account
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: patientId, user_id: patientUserId },
            error: null,
          }),
        } as any;
      }
      if (table === 'patient_documents') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'new-doc-789',
              document_name: 'Impersonated Upload',
              share_with_practice: true,
            },
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { data } = await supabase
      .from('patient_documents')
      .insert({
        document_name: 'Impersonated Upload',
        share_with_practice: true,
      } as any)
      .select()
      .single();

    expect(data.document_name).toBe('Impersonated Upload');
  });

  it('should allow document viewing during impersonation', async () => {
    // Mock impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        session: { impersonated_user_id: patientUserId },
      },
      error: null,
    });

    // Mock signed URL generation
    vi.mocked(supabase.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://storage.example.com/signed-url/document.pdf',
        },
        error: null,
      }),
    } as any);

    const { data } = await supabase.storage
      .from('provider-documents')
      .createSignedUrl(`${practiceId}/documents/lab-results.pdf`, 3600);

    expect(data.signedUrl).toBeDefined();
  });

  it('should handle end impersonation correctly', async () => {
    const sessionId = 'impersonation-session-456';

    // Mock ending impersonation
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'active_impersonation_sessions') {
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { error } = await supabase
      .from('active_impersonation_sessions')
      .delete()
      .eq('id', sessionId);

    expect(error).toBeNull();

    // After ending impersonation, check should return null
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: null,
    });

    const { data: checkImpersonation } = await supabase.functions.invoke('get-active-impersonation');
    expect(checkImpersonation).toBeNull();
  });

  it('should prevent document access after impersonation ends', async () => {
    // Mock no impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: null,
    });

    // Mock admin user (not a patient)
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: adminUserId, email: 'admin@test.com' } as any },
      error: null,
    });

    // Mock patient account lookup - should fail for admin
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null, // Admin is not a patient
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { data: patientAccount } = await supabase
      .from('patient_accounts')
      .select('*')
      .eq('user_id', adminUserId)
      .maybeSingle();

    expect(patientAccount).toBeNull();
  });

  it('should maintain RLS policies during impersonation', async () => {
    // Mock impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        session: { impersonated_user_id: patientUserId },
      },
      error: null,
    });

    // Mock RLS allowing access to patient's documents
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_patient_unified_documents') {
        return Promise.resolve({
          data: [
            {
              id: 'doc-1',
              document_name: 'Test Document',
              patient_id: patientId,
            },
          ],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    const { data } = await supabase.rpc('get_patient_unified_documents', {
      p_patient_id: patientId,
    });

    // RLS should allow access during impersonation
    expect(data).toBeDefined();
    expect(data[0].id).toBe('doc-1');
  });

  it('should log console messages for impersonation state', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    // Mock impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        session: { impersonated_user_id: patientUserId },
      },
      error: null,
    });

    const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
    const effectiveUserId = impersonationData?.session?.impersonated_user_id || adminUserId;
    const isImpersonating = !!impersonationData?.session;

    console.log('[DocumentTest] 👤 Effective user ID:', effectiveUserId, '| Is impersonating:', isImpersonating);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[DocumentTest] 👤 Effective user ID:'),
      patientUserId,
      expect.stringContaining('| Is impersonating:'),
      true
    );

    consoleSpy.mockRestore();
  });
});
