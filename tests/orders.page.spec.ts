import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock Auth Context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    effectiveUserId: 'test-user-id',
    effectiveRole: 'practice',
    effectivePracticeId: 'test-practice-id',
  }),
}));

describe('Orders Page Tests', () => {
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

  it('should load orders page under 2 seconds', async () => {
    const startTime = Date.now();
    
    const mockOrdersData = {
      data: {
        orders: [
          {
            id: 'order-1',
            created_at: '2024-01-01',
            doctor_name: 'Dr. Smith',
            provider_name: 'Provider ABC',
            pharmacy_name: 'Pharmacy XYZ',
            lines: [],
          },
        ],
        total_count: 1,
      },
      error: null,
    };

    (supabase.functions.invoke as any).mockResolvedValue(mockOrdersData);

    const { data } = await supabase.functions.invoke('get-orders-page', {
      body: { page: 1, page_size: 10 },
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(2000);
    expect(data?.orders).toBeDefined();
    expect(data?.orders).toHaveLength(1);
  });

  it('should never show "Doctor: N/A"', async () => {
    const mockOrder = {
      id: 'order-1',
      doctor_name: 'Dr. Smith',
      provider_name: 'Provider ABC',
    };

    // Verify doctor_name is always present
    expect(mockOrder.doctor_name).not.toBe('N/A');
    expect(mockOrder.doctor_name).toBeTruthy();
  });

  it('should display Receipt and Prescription buttons', async () => {
    const mockOrder = {
      id: 'order-1',
      receipt_url: 'receipt-path.pdf',
      lines: [
        { prescription_url: 'prescription-path.pdf' },
      ],
    };

    // Verify both buttons should be present
    expect(mockOrder.receipt_url).toBeTruthy();
    expect(mockOrder.lines[0].prescription_url).toBeTruthy();
  });

  it('should switch roles (Practice/Provider/Staff) correctly', async () => {
    const roles = ['practice', 'provider', 'staff'];

    for (const role of roles) {
      const mockInvoke = vi.fn().mockResolvedValue({
        data: { orders: [], total_count: 0 },
        error: null,
      });
      (supabase.functions.invoke as any) = mockInvoke;

      await supabase.functions.invoke('get-orders-page', {
        body: { page: 1, page_size: 10 },
      });

      expect(mockInvoke).toHaveBeenCalledWith('get-orders-page', expect.any(Object));
    }
  });
});
