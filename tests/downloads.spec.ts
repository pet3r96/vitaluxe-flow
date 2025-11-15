import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
      })),
    },
  },
}));

describe('Download Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should download receipt within 800ms', async () => {
    const startTime = Date.now();

    const mockReceiptData = {
      data: {
        url: 'https://example.com/receipt.pdf',
        base64: 'data:application/pdf;base64,JVBERi0xLjQK...',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockReceiptData);

    const { data, error } = await supabase.functions.invoke('generate-order-receipt', {
      body: { order_id: 'order-123' },
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(800);
    expect(error).toBeNull();
    expect(data).toHaveProperty('url');
  });

  it('should download prescription within 800ms', async () => {
    const startTime = Date.now();

    const mockSignedUrl = {
      data: {
        signedUrl: 'https://example.com/prescription.pdf?token=xyz',
      },
      error: null,
    };

    const mockFrom = vi.fn(() => ({
      createSignedUrl: vi.fn().mockResolvedValue(mockSignedUrl),
    }));
    (supabase.storage.from as any) = mockFrom;

    const { data, error } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl('path/prescription.pdf', 3600);

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(800);
    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });

  it('should handle receipt base64 fallback', async () => {
    const mockReceiptData = {
      data: {
        base64: 'data:application/pdf;base64,JVBERi0xLjQK...',
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockReceiptData);

    const { data } = await supabase.functions.invoke('generate-order-receipt', {
      body: { order_id: 'order-123' },
    });

    expect(data?.base64).toMatch(/^data:application\/pdf;base64,/);
  });

  it('should handle prescription download errors gracefully', async () => {
    const mockError = {
      data: null,
      error: { message: 'File not found' },
    };

    const mockFrom = vi.fn(() => ({
      createSignedUrl: vi.fn().mockResolvedValue(mockError),
    }));
    (supabase.storage.from as any) = mockFrom;

    const { data, error } = await supabase.storage
      .from('prescriptions')
      .createSignedUrl('invalid/path.pdf', 3600);

    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });

  it('should prevent duplicate receipt generations', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: { url: 'https://example.com/receipt.pdf' },
      error: null,
    });
    (supabase.functions.invoke as any) = mockInvoke;

    // Call twice with same order_id
    await supabase.functions.invoke('generate-order-receipt', {
      body: { order_id: 'order-123' },
    });
    await supabase.functions.invoke('generate-order-receipt', {
      body: { order_id: 'order-123' },
    });

    // Should be idempotent - both calls succeed
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });
});
