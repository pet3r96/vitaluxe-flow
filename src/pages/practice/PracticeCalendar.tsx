import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Download, Clock, Filter, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarHeader, CalendarView } from "@/components/calendar/CalendarHeader";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { WeekViewByTime } from "@/components/calendar/WeekViewByTime";
import { WeekViewByProvider } from "@/components/calendar/WeekViewByProvider";
import { DayView } from "@/components/calendar/DayView";
import { MonthView } from "@/components/calendar/MonthView";
import { AgendaView } from "@/components/calendar/AgendaView";
import { CreateAppointmentDialog } from "@/components/calendar/CreateAppointmentDialog";
import { AppointmentDetailsDialog } from "@/components/calendar/AppointmentDetailsDialog";
import { WaitingRoomPanel } from "@/components/calendar/WaitingRoomPanel";
import { BeingTreatedPanel } from "@/components/calendar/BeingTreatedPanel";
import { CompleteAppointmentDialog } from "@/components/calendar/CompleteAppointmentDialog";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { CalendarQuickActions } from "@/components/calendar/CalendarQuickActions";
import { CalendarSettingsDialog } from "@/components/calendar/CalendarSettingsDialog";
import { BlockTimeDialog } from "@/components/calendar/BlockTimeDialog";
import { PrintDayDialog } from "@/components/calendar/PrintDayDialog";
import { Menu } from "lucide-react";

export default function PracticeCalendar() {
  const navigate = useNavigate();
  const { user, effectivePracticeId, isProviderAccount, effectiveRole, effectiveUserId } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultProviderId, setDefaultProviderId] = useState<string | undefined>();
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [blockTimeOpen, setBlockTimeOpen] = useState(false);
  const [printDayOpen, setPrintDayOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [appointmentToComplete, setAppointmentToComplete] = useState<any>(null);
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState<string | null>(null);

  const practiceId = effectivePracticeId || user?.id;
  const isProviderView = effectiveRole === 'provider';

  // Calculate date range based on view - memoized
  const getDateRange = useCallback(() => {
    switch (view) {
      case 'day':
        return {
          startDate: format(currentDate, 'yyyy-MM-dd'),
          endDate: format(currentDate, 'yyyy-MM-dd')
        };
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return {
          startDate: format(weekStart, 'yyyy-MM-dd'),
          endDate: format(weekEnd, 'yyyy-MM-dd')
        };
      case 'month':
      case 'agenda':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return {
          startDate: format(monthStart, 'yyyy-MM-dd'),
          endDate: format(monthEnd, 'yyyy-MM-dd')
        };
      default:
        return {
          startDate: format(currentDate, 'yyyy-MM-dd'),
          endDate: format(currentDate, 'yyyy-MM-dd')
        };
    }
  }, [view, currentDate]);

  // Fetch calendar data with realtime updates
  const { data: calendarData, isLoading, refetch } = useRealtimeQuery(
    ['patient_appointments', practiceId, view, currentDate.toISOString(), JSON.stringify(selectedProviders), JSON.stringify(selectedRooms), JSON.stringify(selectedStatuses), String(isProviderView)],
    async () => {
      const { startDate, endDate } = getDateRange();
      
      // Use local timezone boundaries
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      
      const { data, error } = await supabase.functions.invoke('get-calendar-data', {
        body: {
          practiceId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          providers: selectedProviders.length > 0 ? selectedProviders : undefined,
          rooms: selectedRooms.length > 0 ? selectedRooms : undefined,
          statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
          effectiveProviderUserId: isProviderView ? effectiveUserId : undefined,
        },
      });

      if (error) throw error;
      return data;
    },
    {
      enabled: !!practiceId,
      staleTime: 30 * 1000, // 30 seconds - balance freshness with performance
      gcTime: 300000, // 5 minutes
      refetchOnWindowFocus: true, // Refetch when user returns to tab
    }
  );

  // Fetch providers and staff using unified hook
  const { data: providersData } = useRealtimeQuery(
    ['providers-and-staff', practiceId],
    async () => {
      if (!practiceId) return [];

      console.info('[PracticeCalendar] Fetching providers and staff');

      // Fetch providers via edge function
      const { data: providersResponse, error: provError } = await supabase.functions.invoke('list-providers', {
        body: { practice_id: practiceId }
      });

      if (provError) throw provError;
      const providers = providersResponse?.providers || [];

      // Fetch staff via edge function
      const { data: staffResponse, error: staffError } = await supabase.functions.invoke('list-staff', {
        body: { practice_id: practiceId }
      });

      if (staffError) throw staffError;
      const staff = staffResponse?.staff || [];

      // Combine and add type indicator
      const combined = [
        ...providers.map((p: any) => ({ ...p, type: 'provider' })),
        ...staff.map((s: any) => ({
          id: s.id,
          user_id: s.user_id,
          profiles: s.profiles,
          type: 'staff',
          full_name: s.profiles?.full_name || s.profiles?.name || 'Staff Member',
        }))
      ];

      console.info('[PracticeCalendar] ✅ Providers and staff loaded:', {
        providers: providers.length,
        staff: staff.length,
        total: combined.length
      });

      return combined;
    },
    {
      enabled: !!practiceId,
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: true,
    }
  );

  const appointments = calendarData?.appointments || [];
  const blockedTime = calendarData?.blockedTime || [];
  const pendingAppointments = appointments.filter((apt: any) => 
    apt.status === 'pending' && apt.confirmation_type === 'pending'
  );
  const settings = calendarData?.settings || {
    slot_duration: 15,
    start_hour: 7,
    end_hour: 20,
    working_days: [1, 2, 3, 4, 5],
  };
  const providers = providersData || [];
  const rooms = calendarData?.rooms || [];

  // Initialize selected providers with all provider IDs on first load
  // IMPORTANT: Auto-select all providers for both practice owners AND staff
  useEffect(() => {
    if (providers.length > 0 && selectedProviders.length === 0) {
      console.log(`🔧 Auto-selecting all ${providers.length} providers for ${effectiveRole}`);
      setSelectedProviders(providers.map((p: any) => p.id));
    }
  }, [providers, effectiveRole]);

  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders((prev) =>
      prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : [...prev, providerId]
    );
  };

  const handleRoomToggle = (roomId: string) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handleAppointmentClick = (appointment: any) => {
    setSelectedAppointment(appointment);
    setDetailsDialogOpen(true);
  };

  const handleTimeSlotClick = (date: Date, providerId?: string) => {
    setDefaultDate(date);
    setDefaultProviderId(providerId);
    setCreateDialogOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    setView('day');
  };

  const handleCreateAppointment = () => {
    setDefaultDate(undefined);
    setDefaultProviderId(undefined);
    setIsWalkIn(false);
    setCreateDialogOpen(true);
  };

  const handleWalkInAppointment = () => {
    setDefaultDate(new Date());
    setDefaultProviderId(undefined);
    setIsWalkIn(true);
    setCreateDialogOpen(true);
  };

  const handleCompleteAppointment = (appointment: any) => {
    setAppointmentToComplete(appointment);
    setCompleteDialogOpen(true);
  };

  // Handle search result selection - navigate to appointment
  const handleSearchResultClick = (appointment: any) => {
    // 1. Navigate to appointment date
    const appointmentDate = new Date(appointment.start_time);
    setCurrentDate(appointmentDate);
    
    // 2. Switch to appropriate view for better focus
    if (view === 'month' || view === 'agenda') {
      setView('day');
    }
    
    // 3. Highlight appointment temporarily
    setHighlightedAppointmentId(appointment.id);
    
    // 4. Scroll to appointment after render
    setTimeout(() => {
      const element = document.querySelector(`[data-appointment-id="${appointment.id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
    
    // 5. Open details dialog
    setSelectedAppointment(appointment);
    setDetailsDialogOpen(true);
    
    // 6. Clear highlight after animation
    setTimeout(() => {
      setHighlightedAppointmentId(null);
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <CalendarSidebar
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        providers={providers}
        rooms={rooms}
        selectedProviders={selectedProviders}
        selectedRooms={selectedRooms}
        selectedStatuses={selectedStatuses}
        onProviderToggle={handleProviderToggle}
        onRoomToggle={handleRoomToggle}
        onStatusToggle={handleStatusToggle}
        appointments={appointments}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onAppointmentSelect={handleSearchResultClick}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Compact Header */}
        <div className="flex-none px-4 py-3 border-b bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold">Practice Calendar</h1>
                <div className="hidden md:flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPrintDayOpen(true)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Quick Actions - Inline */}
            <div className="hidden sm:block">
              <CalendarQuickActions
                onNewAppointment={handleCreateAppointment}
                onWalkIn={handleWalkInAppointment}
                onBlockTime={() => setBlockTimeOpen(true)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Calendar Section - Scrollable */}
          <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto min-h-0">
            <CalendarHeader
              currentDate={currentDate}
              view={view}
              onDateChange={setCurrentDate}
              onViewChange={setView}
            />

            {/* Pending Appointments Alert */}
            {pendingAppointments.length > 0 && (
              <div className="mt-4 p-3 bg-gold1/10 border border-gold1/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-gold1" />
                  <p className="text-sm font-medium text-gold1">
                    You have {pendingAppointments.length} appointment request{pendingAppointments.length > 1 ? 's' : ''} awaiting review
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-amber-300 dark:border-amber-700"
                  onClick={() => navigate('/dashboard')}
                >
                  Review Now
                </Button>
              </div>
            )}

            <div className="mt-4 flex-shrink-0">
              {view === 'week' && (
                <WeekViewByTime
                  currentDate={currentDate}
                  appointments={appointments}
                  blockedTime={blockedTime}
                  startHour={settings.start_hour}
                  endHour={settings.end_hour}
                  slotDuration={settings.slot_duration}
                  onAppointmentClick={handleAppointmentClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  providers={providers}
                  selectedProviders={selectedProviders}
                  highlightedAppointmentId={highlightedAppointmentId}
                />
              )}

              {view === 'week-provider' && (
                <WeekViewByProvider
                  currentDate={currentDate}
                  appointments={appointments}
                  providers={providers}
                  selectedProviders={selectedProviders}
                  onAppointmentClick={handleAppointmentClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  highlightedAppointmentId={highlightedAppointmentId}
                />
              )}

              {view === 'day' && (
                <DayView
                  currentDate={currentDate}
                  appointments={appointments}
                  blockedTime={blockedTime}
                  startHour={settings.start_hour}
                  endHour={settings.end_hour}
                  slotDuration={settings.slot_duration}
                  onAppointmentClick={handleAppointmentClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  providers={providers}
                  selectedProviders={selectedProviders}
                  highlightedAppointmentId={highlightedAppointmentId}
                />
              )}

              {view === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  appointments={appointments}
                  onDateClick={handleDateClick}
                  onAppointmentClick={handleAppointmentClick}
                />
              )}

              {view === 'agenda' && (
                <AgendaView
                  currentDate={currentDate}
                  appointments={appointments}
                  onAppointmentClick={handleAppointmentClick}
                />
              )}
            </div>
          </div>

          {/* Stacked Panels - Always Visible at Bottom, Collapsed by Default */}
          <div className="flex-none flex flex-col gap-3 px-3 sm:px-4 py-3 border-t bg-muted/20 max-h-[40vh] overflow-y-auto">
            {/* Waiting Room Panel - Collapsed by Default */}
            <WaitingRoomPanel
              practiceId={practiceId}
              providers={providers}
              onAppointmentClick={handleAppointmentClick}
              currentDate={currentDate}
            />

            {/* Being Treated Panel - Collapsed by Default */}
            <BeingTreatedPanel
              practiceId={practiceId}
              providers={providers}
              rooms={rooms}
              onCompleteAppointment={handleCompleteAppointment}
              onAppointmentClick={handleAppointmentClick}
              currentDate={currentDate}
            />
          </div>
        </div>
      </div>

      <CreateAppointmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        practiceId={practiceId!}
        defaultDate={defaultDate}
        defaultProviderId={defaultProviderId}
        providers={providers}
        rooms={rooms}
        isWalkIn={isWalkIn}
      />

      <AppointmentDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        appointment={selectedAppointment}
        providers={providers}
        rooms={rooms}
      />

      <CalendarSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        practiceId={practiceId!}
        currentSettings={settings}
        onSettingsUpdate={() => refetch()}
      />

      <BlockTimeDialog
        open={blockTimeOpen}
        onOpenChange={setBlockTimeOpen}
        practiceId={practiceId!}
        providers={providers}
        isProviderAccount={isProviderAccount}
        defaultProviderId={isProviderAccount && providers.length === 1 ? providers[0].id : undefined}
        onSuccess={() => {
          refetch();
          setBlockTimeOpen(false);
        }}
      />

      <PrintDayDialog
        open={printDayOpen}
        onOpenChange={setPrintDayOpen}
        practiceId={practiceId!}
        providers={providers}
        currentDate={currentDate}
        isProviderAccount={isProviderAccount}
        currentProviderId={isProviderAccount && providers.length === 1 ? providers[0].id : undefined}
        currentProviderName={isProviderAccount && providers.length === 1 ? providers[0].name : undefined}
      />

      <CompleteAppointmentDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        appointment={appointmentToComplete}
        providers={providers}
        rooms={rooms}
        onSuccess={() => {
          refetch();
          setCompleteDialogOpen(false);
        }}
      />
    </div>
  );
}
