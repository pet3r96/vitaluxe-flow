import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentBookingDialog } from "@/components/patient/AppointmentBookingDialog";
import { RescheduleRequestDialog } from "@/components/patient/RescheduleRequestDialog";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Download, Video, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PatientAppointments() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  const { data: appointments, refetch } = useQuery({
    queryKey: ["patient-appointments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          practice:profiles!patient_appointments_practice_id_fkey(name, address_street, address_city, address_state),
          provider:profiles!patient_appointments_provider_id_fkey(name),
          patient_account:patient_accounts!patient_appointments_patient_id_fkey(user_id)
        `)
        .eq('patient_accounts.user_id', user.id)
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const handleCancelAppointment = async (appointmentId: string) => {
    const { error } = await supabase.functions.invoke("cancel-appointment", {
      body: { appointmentId },
    });

    if (error) {
      toast.error("Failed to cancel appointment");
      return;
    }

    toast.success("Appointment cancelled");
    refetch();
  };

  const handleAddToCalendar = async (appointmentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-calendar-event", {
        body: { appointmentId },
      });

      if (error) throw error;

      const blob = new Blob([data as string], { type: 'text/calendar' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appointment-${appointmentId}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Calendar event downloaded");
    } catch (error: any) {
      toast.error("Failed to generate calendar event");
    }
  };

  const getConfirmationBadge = (confirmationType: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      'pending': { variant: 'secondary', label: 'Pending' },
      'confirmed': { variant: 'default', label: 'Confirmed' },
      'modified_by_practice': { variant: 'outline', label: 'Modified by Practice' }
    };
    const config = variants[confirmationType] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getVisitTypeBadge = (visitType: string) => {
    return visitType === 'virtual' 
      ? <Badge variant="outline" className="gap-1"><Video className="h-3 w-3" />Virtual</Badge>
      : <Badge variant="outline" className="gap-1"><Building className="h-3 w-3" />In-Person</Badge>;
  };

  const upcoming = appointments?.filter((a: any) => new Date(a.start_time) >= new Date()) || [];
  const past = appointments?.filter((a: any) => new Date(a.start_time) < new Date()) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
          <p className="text-muted-foreground">Manage your scheduled visits</p>
        </div>
        <Button onClick={() => setBookingOpen(true)}>
          <Calendar className="mr-2 h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No upcoming appointments
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcoming.map((appt: any) => (
                <Card key={appt.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>{appt.practice?.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(appt.start_time), "EEEE, MMMM dd, yyyy 'at' h:mm a")}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        {getConfirmationBadge(appt.confirmation_type)}
                        {appt.visit_type && getVisitTypeBadge(appt.visit_type)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {appt.reason_for_visit && (
                      <div>
                        <p className="text-sm font-medium">Reason for Visit</p>
                        <p className="text-sm text-muted-foreground">{appt.reason_for_visit}</p>
                      </div>
                    )}
                    {appt.provider && (
                      <p className="text-sm">Provider: {appt.provider.name}</p>
                    )}
                    {appt.practice && appt.visit_type === 'in_person' && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span>
                          {appt.practice.address_street}, {appt.practice.address_city}, {appt.practice.address_state}
                        </span>
                      </div>
                    )}
                    {appt.notes && (
                      <p className="text-sm text-muted-foreground">Notes: {appt.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAppointment(appt);
                          setRescheduleOpen(true);
                        }}
                      >
                        Request Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToCalendar(appt.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Add to Calendar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelAppointment(appt.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Past Appointments</h2>
          {past.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No past appointments
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {past.map((appt: any) => (
                <Card key={appt.id} className="opacity-75">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-base">{appt.practice?.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(appt.start_time), "EEEE, MMMM dd, yyyy 'at' h:mm a")}
                        </CardDescription>
                        {appt.reason_for_visit && (
                          <p className="text-sm text-muted-foreground mt-1">{appt.reason_for_visit}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge variant="outline">{appt.status}</Badge>
                        {appt.visit_type && getVisitTypeBadge(appt.visit_type)}
                      </div>
                    </div>
                  </CardHeader>
                  {appt.visit_summary_url && (
                    <CardContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(appt.visit_summary_url, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        View Visit Summary
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AppointmentBookingDialog open={bookingOpen} onOpenChange={setBookingOpen} onSuccess={refetch} />
      {selectedAppointment && (
        <RescheduleRequestDialog 
          open={rescheduleOpen} 
          onOpenChange={setRescheduleOpen} 
          appointment={selectedAppointment}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
