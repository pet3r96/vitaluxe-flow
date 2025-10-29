import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Settings, Download, Clock } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns";
import { CalendarHeader, CalendarView } from "@/components/calendar/CalendarHeader";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { MonthView } from "@/components/calendar/MonthView";
import { AgendaView } from "@/components/calendar/AgendaView";
import { CreateAppointmentDialog } from "@/components/calendar/CreateAppointmentDialog";
import { AppointmentDetailsDialog } from "@/components/calendar/AppointmentDetailsDialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { CalendarSettingsDialog } from "@/components/calendar/CalendarSettingsDialog";
import { BlockTimeDialog } from "@/components/calendar/BlockTimeDialog";
import { PrintDayDialog } from "@/components/calendar/PrintDayDialog";

export default function PracticeCalendar() {
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

  const practiceId = effectivePracticeId || user?.id;
  const isProviderView = effectiveRole === 'provider';

  // Calculate date range based on view
  const getDateRange = () => {
    switch (view) {
      case 'day':
        return {
          start: format(currentDate, 'yyyy-MM-dd'),
          end: format(currentDate, 'yyyy-MM-dd')
        };
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return {
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(weekEnd, 'yyyy-MM-dd')
        };
      case 'month':
      case 'agenda':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return {
          start: format(monthStart, 'yyyy-MM-dd'),
          end: format(monthEnd, 'yyyy-MM-dd')
        };
      default:
        return {
          start: format(currentDate, 'yyyy-MM-dd'),
          end: format(currentDate, 'yyyy-MM-dd')
        };
    }
  };

  // Fetch calendar data
  const { data: calendarData, isLoading, refetch } = useQuery({
    queryKey: ['calendar-data', practiceId, getDateRange(), selectedProviders, selectedRooms, selectedStatuses, isProviderView],
    queryFn: async () => {
      const dateRange = getDateRange();
      
      const { data, error } = await supabase.functions.invoke('get-calendar-data', {
        body: {
          practiceId,
          startDate: `${dateRange.start}T00:00:00Z`,
          endDate: `${dateRange.end}T23:59:59Z`,
          providers: selectedProviders.length > 0 ? selectedProviders : undefined,
          rooms: selectedRooms.length > 0 ? selectedRooms : undefined,
          statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
          effectiveProviderUserId: isProviderView ? effectiveUserId : undefined,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!practiceId,
  });

  // Set up realtime subscription for appointments and rooms
  useEffect(() => {
    if (!practiceId) return;

    const appointmentsChannel = supabase
      .channel('calendar-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_appointments',
          filter: `practice_id=eq.${practiceId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    const roomsChannel = supabase
      .channel('room-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'practice_rooms',
          filter: `practice_id=eq.${practiceId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
      supabase.removeChannel(roomsChannel);
    };
  }, [practiceId, refetch]);

  const appointments = calendarData?.appointments || [];
  const settings = calendarData?.settings || {
    slot_duration: 15,
    start_hour: 7,
    end_hour: 20,
    working_days: [1, 2, 3, 4, 5],
  };
  const providers = calendarData?.providers || [];
  const rooms = calendarData?.rooms || [];

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none p-6 border-b">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Practice Calendar</h1>
              <p className="text-muted-foreground">Manage appointments and schedules</p>
            </div>
            <div className="flex gap-2 ml-8">
              <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            <Button variant="outline" size="sm" onClick={() => setPrintDayOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Print Day
            </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBlockTimeOpen(true)}>
              <Clock className="h-4 w-4 mr-2" />
              Block Time
            </Button>
            <Button variant="secondary" onClick={handleWalkInAppointment}>
              <Clock className="h-4 w-4 mr-2" />
              Walk-in Patient
            </Button>
            <Button onClick={handleCreateAppointment}>
              <Plus className="h-4 w-4 mr-2" />
              New Appointment
            </Button>
          </div>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <div className="p-4 h-full overflow-y-auto">
            <CalendarFilters
              providers={providers}
              rooms={rooms}
              selectedProviders={selectedProviders}
              selectedRooms={selectedRooms}
              selectedStatuses={selectedStatuses}
              onProviderToggle={handleProviderToggle}
              onRoomToggle={handleRoomToggle}
              onStatusToggle={handleStatusToggle}
              isProviderView={isProviderView}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={80}>
          <div className="p-6 h-full flex flex-col">
            <CalendarHeader
              currentDate={currentDate}
              view={view}
              onDateChange={setCurrentDate}
              onViewChange={setView}
            />

            <div className="flex-1 mt-4 overflow-hidden">
              {view === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  appointments={appointments}
                  startHour={settings.start_hour}
                  endHour={settings.end_hour}
                  slotDuration={settings.slot_duration}
                  onAppointmentClick={handleAppointmentClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  providers={providers}
                  selectedProviders={selectedProviders}
                />
              )}

              {view === 'day' && (
                <DayView
                  currentDate={currentDate}
                  appointments={appointments}
                  startHour={settings.start_hour}
                  endHour={settings.end_hour}
                  slotDuration={settings.slot_duration}
                  onAppointmentClick={handleAppointmentClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  providers={providers}
                  selectedProviders={selectedProviders}
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
        </ResizablePanel>
      </ResizablePanelGroup>

      <CreateAppointmentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        practiceId={practiceId!}
        defaultDate={defaultDate}
        defaultProviderId={defaultProviderId}
        providers={providers}
        rooms={rooms}
        isWalkIn={isWalkIn}
        isProviderAccount={isProviderAccount}
      />

      <AppointmentDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        appointment={selectedAppointment}
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
    </div>
  );
}
