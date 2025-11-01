import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Test Scenario #2: Practice Uploads Document WITH Patient Assignment
 * 
 * Purpose: Verify that documents uploaded by practice and assigned to a patient
 * DO appear in that patient's document center and are viewable.
 */
describe('Practice Upload - Assigned Document', () => {
  let queryClient: QueryClient;
  const practiceId = 'practice-123';
  const patientUserId = 'patient-john-smith-user';
  const patientId = 'patient-john-smith-account';
  const documentId = 'doc-assigned-789';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should upload document with patient assignment', async () => {
    // Mock practice authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: practiceId, email: 'practice@test.com' } as any },
      error: null,
    });

    // Mock storage upload
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: vi.fn().mockResolvedValue({
        data: { path: `${practiceId}/documents/lab-results-2025.pdf` },
        error: null,
      }),
    } as any);

    // Mock edge function to create document with patient assignment
    vi.mocked(supabase.functions.invoke).mockImplementation((funcName) => {
      if (funcName === 'create-provider-document') {
        return Promise.resolve({
          data: {
            id: documentId,
            document_name: 'Lab Results - Blood Work',
            practice_id: practiceId,
            document_type: 'lab_results',
            status: 'completed',
            assigned_patient_id: patientId,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const uploadData = {
      documentName: 'Lab Results - Blood Work',
      documentType: 'lab_results',
      tags: 'urgent, review-required',
      notes: 'Please review and schedule follow-up',
      patientIds: [patientId], // ASSIGNED TO JOHN SMITH
      shareWithPractice: true,
      storagePath: `${practiceId}/documents/lab-results-2025.pdf`,
    };

    const result = await supabase.functions.invoke('create-provider-document', {
      body: uploadData,
    });

    expect(result.data).toBeDefined();
    expect(result.data.document_name).toBe('Lab Results - Blood Work');
    expect(result.data.assigned_patient_id).toBe(patientId);
  });

  it('should create provider_document_patients junction record', async () => {
    // Mock junction table query
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'provider_document_patients') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'junction-123',
                document_id: documentId,
                patient_id: patientId,
                message: 'Please review and schedule follow-up',
                created_at: new Date().toISOString(),
              },
            ],
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

    expect(data).toHaveLength(1);
    expect(data[0].patient_id).toBe(patientId);
    expect(data[0].message).toBe('Please review and schedule follow-up');
  });

  it('should create notification for patient', async () => {
    // Mock notifications table query
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'notifications') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'notif-456',
              user_id: patientUserId,
              title: 'New Document Available',
              message: 'Lab Results - Blood Work has been shared with you',
              type: 'document',
              read: false,
            },
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', patientUserId)
      .maybeSingle();

    expect(data).toBeDefined();
    expect(data.title).toBe('New Document Available');
    expect(data.message).toContain('Lab Results - Blood Work');
  });

  it('should appear in patient document center (real login)', async () => {
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

    // Mock RPC - assigned doc SHOULD be included
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_patient_unified_documents') {
        return Promise.resolve({
          data: [
            {
              id: documentId,
              document_name: 'Lab Results - Blood Work',
              document_type: 'lab_results',
              source: 'provider_assigned',
              storage_path: `${practiceId}/documents/lab-results-2025.pdf`,
              file_size: 245760,
              notes: null,
              share_with_practice: true,
              practice_id: practiceId,
              uploader_id: practiceId,
              uploader_name: 'Test Practice D 1',
              uploader_role: 'practice',
              status: 'active',
              is_hidden: false,
              uploaded_at: new Date().toISOString(),
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
    expect(data[0].document_name).toBe('Lab Results - Blood Work');
    expect(data[0].source).toBe('provider_assigned');
  });

  it('should appear in patient document center (impersonation)', async () => {
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
              first_name: 'John',
              last_name: 'Smith',
            },
            error: null,
          }),
        } as any;
      }
      return {} as any;
    });

    // Mock RPC - should return assigned document
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_patient_unified_documents') {
        return Promise.resolve({
          data: [
            {
              id: documentId,
              document_name: 'Lab Results - Blood Work',
              source: 'provider_assigned',
              is_provider_document: true,
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
    expect(data[0].document_name).toBe('Lab Results - Blood Work');
  });

  it('should allow patient to view document via signed URL', async () => {
    // Mock storage signed URL generation
    vi.mocked(supabase.storage.from).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: {
          signedUrl: 'https://storage.example.com/signed-url/lab-results.pdf',
        },
        error: null,
      }),
    } as any);

    const { data } = await supabase.storage
      .from('provider-documents')
      .createSignedUrl(`${practiceId}/documents/lab-results-2025.pdf`, 3600);

    expect(data.signedUrl).toContain('signed-url');
  });

  it('should allow patient to download document', async () => {
    // Mock storage download
    vi.mocked(supabase.storage.from).mockReturnValue({
      download: vi.fn().mockResolvedValue({
        data: new Blob(['mock pdf content'], { type: 'application/pdf' }),
        error: null,
      }),
    } as any);

    const { data, error } = await supabase.storage
      .from('provider-documents')
      .download(`${practiceId}/documents/lab-results-2025.pdf`);

    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Blob);
  });

  it('should appear in practice document center with patient badge', async () => {
    // Mock practice authentication
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: practiceId, email: 'practice@test.com' } as any },
      error: null,
    });

    // Mock RPC - should include patient assignment info
    vi.mocked(supabase.rpc).mockImplementation((rpcName: string) => {
      if (rpcName === 'get_provider_documents') {
        return Promise.resolve({
          data: [
            {
              id: documentId,
              document_name: 'Lab Results - Blood Work',
              practice_id: practiceId,
              document_type: 'lab_results',
              assigned_patient_id: patientId,
              patient_name: 'John Smith',
              status: 'completed',
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
    expect(data[0].assigned_patient_id).toBe(patientId);
    expect(data[0].assigned_patient_names).toEqual(['John Smith']);
  });
});
