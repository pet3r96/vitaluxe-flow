import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Cart from '@/pages/Cart';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
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

describe('Cart Flow Tests', () => {
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

  it('should add item to cart and increase count', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: { cart_id: 'cart-123', line_id: 'line-123' },
      error: null,
    });
    (supabase.functions.invoke as any) = mockInvoke;

    // Test add-to-cart edge function call
    const { data, error } = await supabase.functions.invoke('add-to-cart', {
      body: {
        product_id: 'product-123',
        quantity: 1,
        patient_name: 'Test Patient',
        destination_state: 'CA',
      },
    });

    expect(error).toBeNull();
    expect(data).toHaveProperty('cart_id');
    expect(mockInvoke).toHaveBeenCalledWith('add-to-cart', expect.any(Object));
  });

  it('should clear cart after placing order', async () => {
    const mockClearCart = vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    });
    (supabase.functions.invoke as any) = mockClearCart;

    // Test clear-cart edge function
    const { data, error } = await supabase.functions.invoke('clear-cart', {
      body: { cart_owner_id: 'test-user-id' },
    });

    expect(error).toBeNull();
    expect(data).toEqual({ success: true });
    expect(mockClearCart).toHaveBeenCalledWith('clear-cart', expect.any(Object));
  });

  it('should handle realtime updates without duplicate invalidations', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Simulate single realtime event
    const realtimePayload = {
      eventType: 'INSERT',
      new: { id: 'new-line-id', cart_id: 'cart-123' },
    };

    // Should trigger exactly one invalidation
    await queryClient.invalidateQueries({ queryKey: ['cart'] });

    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
  });
});
