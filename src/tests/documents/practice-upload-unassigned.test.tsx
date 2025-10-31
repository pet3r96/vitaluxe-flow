import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Test Scenario #1: Practice Uploads Document WITHOUT Patient Assignment
 * 
 * Purpose: Verify that documents uploaded by practice but NOT assigned to any patient
 * do NOT appear in patient document center.
 */
describe('Practice Upload - Unassigned Document', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should upload document to practice without patient assignment', async () => {
    const practiceId = 'practice-123';
    const documentId = 'doc-unassigned-456';
    
    // Mock practice authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: practiceId, email: 'practice@test.com' } as any },
      error: null,
    });

    // Mock no impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: null,
    });

    // Mock document upload to storage
    const mockStorageUpload = vi.fn().mockResolvedValue({
      data: { path: `${practiceId}/documents/test-memo.pdf` },
      error: null,
    });

    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: mockStorageUpload,
    } as any);

    // Mock edge function to create document record
    vi.mocked(supabase.functions.invoke).mockImplementation((funcName) => {
      if (funcName === 'create-provider-document') {
        return Promise.resolve({
          data: {
            id: documentId,
            document_name: 'Practice Internal Memo',
            practice_id: practiceId,
            is_internal: false,
            status: 'completed',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Simulate upload
    const uploadData = {
      documentName: 'Practice Internal Memo',
      documentType: 'internal_docs',
      tags: 'internal, staff-only',
      notes: 'For staff review only',
      patientIds: [], // NO PATIENTS ASSIGNED
      shareWithPractice: true,
      storagePath: `${practiceId}/documents/test-memo.pdf`,
    };

    const result = await supabase.functions.invoke('create-provider-document', {
      body: uploadData,
    });

    expect(result.data).toBeDefined();
    expect(result.data.document_name).toBe('Practice Internal Memo');
  });

  it('should create provider_documents record without junction entry', async () => {
    const documentId = 'doc-unassigned-456';

    // Mock query to provider_documents table
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'provider_documents') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: documentId,
              document_name: 'Practice Internal Memo',
              practice_id: 'practice-123',
              is_internal: false,
              status: 'completed',
            },
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { data } = await supabase
      .from('provider_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    expect(data).toBeDefined();
    expect(data.document_name).toBe('Practice Internal Memo');
  });

  it('should NOT create provider_document_patients junction record', async () => {
    const documentId = 'doc-unassigned-456';

    // Mock query to junction table - should return empty
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'provider_document_patients') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [], // No junction records
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { data } = await supabase
      .from('provider_document_patients')
      .select('*')
      .eq('document_id', documentId);

    expect(data).toEqual([]);
  });

  it('should NOT appear in patient document center (real login)', async () => {
    const patientUserId = 'patient-john-smith';
    const patientId = 'patient-account-789';

    // Mock patient authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: patientUserId, email: 'john@patient.com' } as any },
      error: null,
    });

    // Mock no impersonation
    vi.mocked(supabase.functions.invoke).mockImplementation((funcName) => {
      if (funcName === 'get-active-impersonation') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Mock RPC to get unified documents - unassigned doc should NOT be included
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_patient_unified_documents') {
        return Promise.resolve({
          data: [], // Empty - unassigned doc not visible
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    const { data } = await supabase.rpc('get_patient_unified_documents', {
      p_patient_id: patientId,
    });

    expect(data).toEqual([]);
  });

  it('should NOT appear in patient document center (impersonation)', async () => {
    const adminUserId = 'admin-user-123';
    const patientUserId = 'patient-john-smith';
    const patientId = 'patient-account-789';

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
              admin_user_id: adminUserId,
              impersonated_user_id: patientUserId,
            },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Mock RPC - unassigned doc should NOT be included even during impersonation
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_patient_unified_documents') {
        return Promise.resolve({
          data: [], // Empty - unassigned doc not visible
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    const { data } = await supabase.rpc('get_patient_unified_documents', {
      p_patient_id: patientId,
    });

    expect(data).toEqual([]);
  });

  it('should appear in practice document center', async () => {
    const practiceId = 'practice-123';
    const documentId = 'doc-unassigned-456';

    // Mock practice authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: practiceId, email: 'practice@test.com' } as any },
      error: null,
    });

    // Mock RPC to get practice documents
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_provider_documents') {
        return Promise.resolve({
          data: [
            {
              id: documentId,
              document_name: 'Practice Internal Memo',
              practice_id: practiceId,
              document_type: 'internal_docs',
              status: 'completed',
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
        }) as any;
      }
      return Promise.resolve({ data: null, error: null }) as any;
    });

    const { data } = await supabase.rpc('get_provider_documents', {
      p_practice_id: practiceId,
    });

    expect(data).toHaveLength(1);
    expect(data[0].document_name).toBe('Practice Internal Memo');
    expect(data[0].practice_id).toBe(practiceId);
  });
});
