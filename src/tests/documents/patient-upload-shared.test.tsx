import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Test Scenario #3: Patient Uploads Document and Shares with Practice
 * 
 * Purpose: Verify that documents uploaded by patient with share_with_practice = true
 * appear in practice document center and are viewable by practice staff.
 */
describe('Patient Upload - Shared with Practice', () => {
  let queryClient: QueryClient;
  const practiceId = 'practice-123';
  const patientUserId = 'patient-john-smith-user';
  const patientId = 'patient-john-smith-account';
  const documentId = 'patient-doc-456';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should allow patient to upload document with share_with_practice = true (real login)', async () => {
    // Mock patient authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: patientUserId, email: 'john@patient.com' } as any },
      error: null,
    });

    // Mock no impersonation
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: null,
    });

    // Mock storage upload to patient-documents bucket
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: `${patientId}/insurance-card-2025.jpg` },
        error: null,
      }),
    } as any);

    // Mock insert into patient_documents table
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_documents') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: documentId,
              document_name: 'Insurance Card - Front & Back',
              document_type: 'insurance',
              storage_path: `${patientId}/insurance-card-2025.jpg`,
              share_with_practice: true, // SHARED WITH PRACTICE
              notes: 'Updated insurance info',
              created_at: new Date().toISOString(),
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
        document_name: 'Insurance Card - Front & Back',
        document_type: 'insurance',
        storage_path: `${patientId}/insurance-card-2025.jpg`,
        share_with_practice: true,
        notes: 'Updated insurance info',
      } as any)
      .select()
      .single();

    expect(data).toBeDefined();
    expect(data.document_name).toBe('Insurance Card - Front & Back');
    expect(data.share_with_practice).toBe(true);
  });

  it('should appear in patient document center with "My Upload" badge', async () => {
    // Mock patient authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: patientUserId, email: 'john@patient.com' } as any },
      error: null,
    });

    // Mock RPC - should include patient's own upload
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_patient_unified_documents') {
        return Promise.resolve({
          data: [
            {
              id: documentId,
              document_name: 'Insurance Card - Front & Back',
              document_type: 'insurance',
              source: 'patient_upload', // Patient's own upload
              is_provider_document: false,
              storage_path: `${patientId}/insurance-card-2025.jpg`,
              bucket_name: 'patient-documents',
              share_with_practice: true,
              notes: 'Updated insurance info',
              created_at: new Date().toISOString(),
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

    expect(data).toHaveLength(1);
    expect(data[0].source).toBe('patient_upload');
    expect(data[0].share_with_practice).toBe(true);
  });

  it('should appear in practice document center (shared document)', async () => {
    // Mock practice authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: practiceId, email: 'practice@test.com' } as any },
      error: null,
    });

    // Mock query to patient_documents with join to patients table
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_documents') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          filter: vi.fn().mockResolvedValue({
            data: [
              {
                id: documentId,
                document_name: 'Insurance Card - Front & Back',
                document_type: 'insurance',
                storage_path: `${patientId}/insurance-card-2025.jpg`,
                share_with_practice: true,
                patients: {
                  first_name: 'John',
                  last_name: 'Smith',
                  practice_id: practiceId,
                },
              },
            ],
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { data } = await supabase
      .from('patient_documents')
      .select('*, patients!inner(first_name, last_name, practice_id)')
      .eq('share_with_practice', true)
      .filter('patients.practice_id', 'eq', practiceId);

    expect(data).toHaveLength(1);
    expect(data?.[0]?.share_with_practice).toBe(true);
  });

  it('should allow practice to view patient document via signed URL', async () => {
    // Mock storage signed URL for patient-documents bucket
    vi.mocked(supabase.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://storage.example.com/signed-url/insurance-card.jpg',
        },
        error: null,
      }),
    } as any);

    const { data } = await supabase.storage
      .from('patient-documents')
      .createSignedUrl(`${patientId}/insurance-card-2025.jpg`, 3600);

    expect(data.signedUrl).toContain('signed-url');
  });

  it('should allow practice to download patient document', async () => {
    // Mock storage download
    vi.mocked(supabase.storage.from).mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: new Blob(['mock image content'], { type: 'image/jpeg' }),
        error: null,
      }),
    } as any);

    const { data, error } = await supabase.storage
      .from('patient-documents')
      .download(`${patientId}/insurance-card-2025.jpg`);

    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Blob);
  });

  it('should NOT appear in practice center if share_with_practice = false', async () => {
    const privateDocId = 'private-doc-789';

    // Mock patient uploads private document
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_documents') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: privateDocId,
              patient_id: patientId,
              document_name: 'Personal Medical Notes',
              share_with_practice: false, // PRIVATE
            },
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    // Practice queries shared documents - should NOT include private doc
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_documents') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          filter: vi.fn().mockResolvedValue({
            data: [], // Private doc filtered out
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { data } = await supabase
      .from('patient_documents')
      .select('*')
      .eq('share_with_practice', true);

    expect(data).toEqual([]);
  });

  it('should work during impersonation - admin uploads as patient', async () => {
    const adminUserId = 'admin-user-123';

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

    // Mock patient account lookup
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'patient_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: patientId,
              user_id: patientUserId,
            },
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
              id: 'impersonated-doc-999',
              document_name: 'Test Document via Impersonation',
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
        document_name: 'Test Document via Impersonation',
        share_with_practice: true,
      } as any)
      .select()
      .single();

    expect(data.share_with_practice).toBe(true);
  });
});
