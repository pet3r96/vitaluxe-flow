import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PatientAppointments from '@/pages/patient/PatientAppointments';
import { supabase } from '@/integrations/supabase/client';

// Helper to wait for async operations
const waitFor = async (callback: () => void, timeout = 3000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      callback();
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  callback(); // Final attempt
};

// Mock the supabase client
vi.mock('@/integrations/supabase/client');

describe('Patient Appointment Cancellation', () => {
  let queryClient: QueryClient;
  const mockAppointment = {
    id: 'appt-123',
    start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    end_time: new Date(Date.now() + 90000000).toISOString(),
    status: 'scheduled',
    confirmation_type: 'confirmed',
    visit_type: 'in_person',
    reason_for_visit: 'Regular checkup',
    practice_id: 'practice-1',
    provider_id: 'provider-1',
    street: '333 South Miami Avenue',
    city: 'Miami',
    state: 'FL',
    zip: '33130',
    practice: {
      id: 'practice-1',
      name: 'Test Practice',
      address_formatted: '333 South Miami Avenue, Miami, FL 33130',
      address_street: '333 South Miami Avenue',
      address_city: 'Miami',
      address_state: 'FL',
      address_zip: '33130',
    },
    provider: {
      id: 'provider-1',
      display_name: 'Dr. Test Provider'
    }
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock auth
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } as any },
      error: null,
    });

    // Mock impersonation check
    vi.mocked(supabase.functions.invoke).mockImplementation((fnName: string) => {
      if (fnName === 'get-active-impersonation') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Mock RPC call
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [mockAppointment],
      error: null,
    } as any);
  });

  it('should display cancel button for upcoming appointments', async () => {
    const { getByText, getAllByRole } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('Test Practice')).toBeInTheDocument();
    });

    const cancelButtons = getAllByRole('button', { name: /cancel/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
  });

  it('should show confirmation dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    
    const { getByText, getByRole } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('Test Practice')).toBeInTheDocument();
    });

    const cancelButton = getByRole('button', { name: /^Cancel$/ });
    await user.click(cancelButton);

    expect(getByText('Cancel this appointment?')).toBeInTheDocument();
    expect(getByText(/remove the visit from your upcoming list/i)).toBeInTheDocument();
    expect(getByRole('button', { name: /keep appointment/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /yes, cancel/i })).toBeInTheDocument();
  });

  it('should call cancel-appointment edge function when confirmed', async () => {
    const user = userEvent.setup();
    const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    vi.mocked(supabase.functions.invoke).mockImplementation((fnName: string, options?: any) => {
      if (fnName === 'cancel-appointment') {
        return mockInvoke(fnName, options);
      }
      if (fnName === 'get-active-impersonation') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { getByText, getByRole } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('Test Practice')).toBeInTheDocument();
    });

    const cancelButton = getByRole('button', { name: /^Cancel$/ });
    await user.click(cancelButton);

    const confirmButton = getByRole('button', { name: /yes, cancel/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('cancel-appointment', {
        body: { appointmentId: 'appt-123' }
      });
    });
  });

  it('should remove appointment from list optimistically after cancellation', async () => {
    const user = userEvent.setup();
    vi.mocked(supabase.functions.invoke).mockImplementation((fnName: string) => {
      if (fnName === 'cancel-appointment') {
        return Promise.resolve({ data: { success: true }, error: null });
      }
      if (fnName === 'get-active-impersonation') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { getByText, getByRole, queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('Test Practice')).toBeInTheDocument();
    });

    const cancelButton = getByRole('button', { name: /^Cancel$/ });
    await user.click(cancelButton);

    const confirmButton = getByRole('button', { name: /yes, cancel/i });
    await user.click(confirmButton);

    // Appointment should be removed from the list
    await waitFor(() => {
      expect(queryByText('Test Practice')).not.toBeInTheDocument();
    });
  });

  it('should handle cancellation errors gracefully', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Cancellation failed');
    vi.mocked(supabase.functions.invoke).mockImplementation((fnName: string) => {
      if (fnName === 'cancel-appointment') {
        return Promise.resolve({ data: null, error: mockError });
      }
      if (fnName === 'get-active-impersonation') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { getByText, getByRole } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('Test Practice')).toBeInTheDocument();
    });

    const cancelButton = getByRole('button', { name: /^Cancel$/ });
    await user.click(cancelButton);

    const confirmButton = getByRole('button', { name: /yes, cancel/i });
    await user.click(confirmButton);

    // Appointment should still be visible after error
    await waitFor(() => {
      expect(getByText('Test Practice')).toBeInTheDocument();
    });
  });

  it('should display time in 12-hour format', async () => {
    const morningAppt = {
      ...mockAppointment,
      start_time: new Date('2025-11-01T09:00:00Z').toISOString(), // 9 AM
    };

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [morningAppt],
      error: null,
    } as any);

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Should show 12-hour format with AM/PM, not 24-hour format
      const text = container.textContent || '';
      expect(text).toMatch(/at \d{1,2}:\d{2} [AP]M/i);
    });
  });

  it('should display practice address for in-person appointments', async () => {
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('333 South Miami Avenue, Miami, FL 33130')).toBeInTheDocument();
    });
  });

  it('should not display address for virtual appointments', async () => {
    const virtualAppt = {
      ...mockAppointment,
      visit_type: 'virtual',
    };

    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [virtualAppt],
      error: null,
    } as any);

    const { getByText, queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <PatientAppointments />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('Test Practice')).toBeInTheDocument();
    });

    expect(queryByText('333 South Miami Avenue')).not.toBeInTheDocument();
    expect(getByText(/virtual/i)).toBeInTheDocument();
  });
});
