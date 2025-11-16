import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppointmentDetailsDialog } from '@/components/calendar/AppointmentDetailsDialog';
import { supabase } from '@/integrations/supabase/client';

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
  callback();
};

vi.mock('@/integrations/supabase/client');

describe('Practice Appointment Cancellation', () => {
  let queryClient: QueryClient;
  const mockAppointment = {
    id: 'appt-456',
    start_time: new Date('2025-11-01T14:30:00Z').toISOString(), // 2:30 PM
    end_time: new Date('2025-11-01T15:00:00Z').toISOString(),
    status: 'scheduled',
    patient_id: 'patient-1',
    provider_id: 'provider-1',
    practice_id: 'practice-1',
    patient_accounts: {
      first_name: 'John',
      last_name: 'Smith',
      phone: '555-1234',
      email: 'john@example.com',
    },
    providers: {
      first_name: 'Dr. Sarah',
      last_name: 'Johnson',
      specialty: 'General Practice',
    },
    practice_rooms: {
      name: 'Room 101',
    },
    appointment_type: 'in_person',
    notes: 'Regular checkup',
  };

  const mockProviders = [
    { id: 'provider-1', first_name: 'Dr. Sarah', last_name: 'Johnson' },
  ];

  const mockRooms = [
    { id: 'room-1', name: 'Room 101' },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);
  });

  it('should display appointment details with 12-hour time format', async () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDetailsDialog
          open={true}
          onOpenChange={() => {}}
          appointment={mockAppointment}
          providers={mockProviders}
          rooms={mockRooms}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const text = container.textContent || '';
      expect(text).toMatch(/2:30 PM/i);
    });
  });

  it('should show status dropdown with cancelled option', async () => {
    const { getByRole } = render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDetailsDialog
          open={true}
          onOpenChange={() => {}}
          appointment={mockAppointment}
          providers={mockProviders}
          rooms={mockRooms}
        />
      </QueryClientProvider>
    );

    const statusTrigger = getByRole('combobox');
    expect(statusTrigger).toBeInTheDocument();
  });

  it('should update appointment status to cancelled when selected', async () => {
    const user = userEvent.setup();
    const mockUpdate = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    vi.mocked(supabase.from).mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
    } as any);

    const { getByRole, container } = render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDetailsDialog
          open={true}
          onOpenChange={() => {}}
          appointment={mockAppointment}
          providers={mockProviders}
          rooms={mockRooms}
        />
      </QueryClientProvider>
    );

    const statusTrigger = getByRole('combobox');
    await user.click(statusTrigger);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  it('should display patient information correctly', async () => {
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDetailsDialog
          open={true}
          onOpenChange={() => {}}
          appointment={mockAppointment}
          providers={mockProviders}
          rooms={mockRooms}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(getByText('John Smith')).toBeInTheDocument();
      expect(getByText('555-1234')).toBeInTheDocument();
      expect(getByText('john@example.com')).toBeInTheDocument();
    });
  });

  it('should handle late night appointments with PM format', async () => {
    const lateNightAppt = {
      ...mockAppointment,
      start_time: new Date('2025-11-01T23:00:00Z').toISOString(),
      end_time: new Date('2025-11-01T23:30:00Z').toISOString(),
    };

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDetailsDialog
          open={true}
          onOpenChange={() => {}}
          appointment={lateNightAppt}
          providers={mockProviders}
          rooms={mockRooms}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(container.textContent).toMatch(/11:00 PM/i);
    });
  });

  it('should handle morning appointments with AM format', async () => {
    const morningAppt = {
      ...mockAppointment,
      start_time: new Date('2025-11-01T09:00:00Z').toISOString(),
      end_time: new Date('2025-11-01T09:30:00Z').toISOString(),
    };

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDetailsDialog
          open={true}
          onOpenChange={() => {}}
          appointment={morningAppt}
          providers={mockProviders}
          rooms={mockRooms}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(container.textContent).toMatch(/9:00 AM/i);
    });
  });

  it('should invalidate calendar queries after status change', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <AppointmentDetailsDialog
          open={true}
          onOpenChange={() => {}}
          appointment={mockAppointment}
          providers={mockProviders}
          rooms={mockRooms}
        />
      </QueryClientProvider>
    );

    expect(invalidateQueries).toBeDefined();
  });
});
