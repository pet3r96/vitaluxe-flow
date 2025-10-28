import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PracticeCalendar() {
  const queryClient = useQueryClient();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["practice-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_appointments")
        .select(`
          *,
          patient:patient_accounts(first_name, last_name, phone, email)
        `)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("patient_appointments")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-appointments"] });
      toast.success("Appointment status updated");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const upcoming = appointments?.filter(
    (a) => new Date(a.start_time) > new Date() && a.status !== "cancelled"
  );
  const past = appointments?.filter((a) => new Date(a.start_time) <= new Date());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Appointment Calendar</h1>
        <p className="text-muted-foreground">Manage patient appointments</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {appointments?.filter(
                (a) =>
                  format(new Date(a.start_time), "yyyy-MM-dd") ===
                  format(new Date(), "yyyy-MM-dd")
              ).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcoming?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {appointments?.filter((a) => a.status === "completed").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Appointments</CardTitle>
          <CardDescription>Scheduled patient visits</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming && upcoming.length > 0 ? (
            <div className="space-y-4">
              {upcoming.map((appt: any) => (
                <div key={appt.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {appt.patient?.first_name} {appt.patient?.last_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(appt.start_time), "MMMM dd, yyyy 'at' h:mm a")}</span>
                    </div>
                    {appt.patient?.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{appt.patient.phone}</span>
                      </div>
                    )}
                    {appt.patient?.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{appt.patient.email}</span>
                      </div>
                    )}
                    {appt.notes && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded">{appt.notes}</p>
                    )}
                  </div>
                  <Select
                    value={appt.status}
                    onValueChange={(status) =>
                      updateStatusMutation.mutate({ id: appt.id, status })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no_show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No upcoming appointments</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
