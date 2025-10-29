import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MessageSquare, FileText, Activity } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PatientDashboard() {
  const navigate = useNavigate();

  const { data: upcomingAppts } = useQuery({
    queryKey: ["upcoming-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_appointments")
        .select("*, practice:profiles!patient_appointments_practice_id_fkey(name)")
        .gte("appointment_date", new Date().toISOString())
        .order("appointment_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-messages-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("patient_messages")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: recentDocs } = useQuery({
    queryKey: ["recent-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your patient portal</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/appointments")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingAppts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/messages")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadMessages || 0}</div>
            <p className="text-xs text-muted-foreground">From providers</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/documents")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentDocs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Recent uploads</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/medical-vault")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medical Records</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground">View health data</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Your scheduled visits</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingAppts && upcomingAppts.length > 0 ? (
              <div className="space-y-4">
                {upcomingAppts.map((appt: any) => (
                  <div key={appt.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{appt.practice?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(appt.appointment_date), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate("/appointments")}>
                      View
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No upcoming appointments</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/appointments")}>
              <Calendar className="mr-2 h-4 w-4" />
              Book Appointment
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/messages")}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Message Provider
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
