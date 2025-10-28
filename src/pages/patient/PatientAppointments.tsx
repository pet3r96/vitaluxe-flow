import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppointmentBookingDialog } from "@/components/patient/AppointmentBookingDialog";
import { format } from "date-fns";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PatientAppointments() {
  const [bookingOpen, setBookingOpen] = useState(false);

  const { data: appointments, refetch } = useQuery({
    queryKey: ["patient-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          practice:profiles!patient_appointments_practice_id_fkey(name, address_street, address_city, address_state),
          provider:profiles!patient_appointments_provider_id_fkey(name)
        `)
        .order("appointment_date", { ascending: true });
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

  const upcoming = appointments?.filter((a: any) => new Date(a.appointment_date) >= new Date()) || [];
  const past = appointments?.filter((a: any) => new Date(a.appointment_date) < new Date()) || [];

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
                      <div>
                        <CardTitle>{appt.practice?.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(appt.appointment_date), "EEEE, MMMM dd, yyyy 'at' h:mm a")}
                        </CardDescription>
                      </div>
                      <Badge variant={appt.status === "confirmed" ? "default" : "secondary"}>
                        {appt.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {appt.provider && (
                      <p className="text-sm">Provider: {appt.provider.name}</p>
                    )}
                    {appt.practice && (
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
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelAppointment(appt.id)}
                      >
                        Cancel Appointment
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
                      <div>
                        <CardTitle className="text-base">{appt.practice?.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(appt.appointment_date), "EEEE, MMMM dd, yyyy 'at' h:mm a")}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{appt.status}</Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AppointmentBookingDialog open={bookingOpen} onOpenChange={setBookingOpen} onSuccess={refetch} />
    </div>
  );
}
