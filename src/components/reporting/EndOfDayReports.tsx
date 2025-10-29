import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CheckCircle2, XCircle, MessageSquare, Download } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface EndOfDayReportsProps {
  dateRange: { from: Date; to: Date };
}

export function EndOfDayReports({ dateRange }: EndOfDayReportsProps) {
  const { data: dailyData, isLoading } = useQuery({
    queryKey: ["end-of-day", dateRange],
    queryFn: async () => {
      const { data: appointments, error } = await supabase
        .from("patient_appointments")
        .select(`
          id,
          status,
          start_time,
          end_time,
          service_type,
          patients (
            first_name,
            last_name
          ),
          providers (
            users (
              full_name
            )
          )
        `)
        .gte("start_time", dateRange.from.toISOString())
        .lte("start_time", dateRange.to.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      const scheduled = appointments?.length || 0;
      const completed = appointments?.filter(a => a.status === 'completed').length || 0;
      const noShows = appointments?.filter(a => a.status === 'no_show').length || 0;
      const cancelled = appointments?.filter(a => a.status === 'cancelled').length || 0;

      // Messages sent (approximate)
      const { count: messageCount } = await supabase
        .from("messages")
        .select("*", { count: 'exact', head: true })
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      return {
        scheduled,
        completed,
        noShows,
        cancelled,
        messagesSent: messageCount || 0,
        appointments: appointments || [],
      };
    },
  });

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(20);
      doc.text("VitaLuxe Services", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(16);
      doc.text("End-of-Day Report", pageWidth / 2, 30, { align: "center" });
      
      doc.setFontSize(12);
      const dateStr = dateRange.from.getTime() === dateRange.to.getTime()
        ? format(dateRange.from, "MMMM dd, yyyy")
        : `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd, yyyy")}`;
      doc.text(dateStr, pageWidth / 2, 38, { align: "center" });

      // Summary Section
      doc.setFontSize(14);
      doc.text("Daily Summary", 20, 55);
      
      doc.setFontSize(11);
      let yPos = 65;
      doc.text(`Scheduled Appointments: ${dailyData?.scheduled}`, 20, yPos);
      yPos += 7;
      doc.text(`Completed: ${dailyData?.completed}`, 20, yPos);
      yPos += 7;
      doc.text(`No-Shows: ${dailyData?.noShows}`, 20, yPos);
      yPos += 7;
      doc.text(`Cancelled: ${dailyData?.cancelled}`, 20, yPos);
      yPos += 7;
      doc.text(`Messages Sent: ${dailyData?.messagesSent}`, 20, yPos);

      // Appointments Table
      yPos += 15;
      doc.setFontSize(14);
      doc.text("Appointment Details", 20, yPos);
      
      yPos += 10;
      doc.setFontSize(9);
      
      dailyData?.appointments.slice(0, 20).forEach((apt: any) => {
        const patient = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients;
        const provider = Array.isArray(apt.providers) ? apt.providers[0] : apt.providers;
        const providerUsers = provider?.users ? 
          (Array.isArray(provider.users) ? provider.users[0] : provider.users) 
          : null;

        const time = format(new Date(apt.start_time), "h:mm a");
        const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown';
        const providerName = providerUsers?.full_name || 'N/A';
        const status = apt.status;

        const line = `${time} | ${patientName} | ${providerName} | ${status}`;
        
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(line, 20, yPos);
        yPos += 6;
      });

      doc.save(`end-of-day-report-${format(dateRange.from, "yyyy-MM-dd")}.pdf`);
      toast.success("Report exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export report");
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyData?.scheduled}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyData?.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Shows</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyData?.noShows}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailyData?.messagesSent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportToPDF} className="gap-2">
          <Download className="h-4 w-4" />
          Export to PDF
        </Button>
      </div>

      {/* Appointment Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyData?.appointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No appointments for this date range
                    </TableCell>
                  </TableRow>
                ) : (
                  dailyData?.appointments.map((apt: any) => {
                    const patient = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients;
                    const provider = Array.isArray(apt.providers) ? apt.providers[0] : apt.providers;
                    const providerUsers = provider?.users ? 
                      (Array.isArray(provider.users) ? provider.users[0] : provider.users) 
                      : null;

                    return (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">
                          {format(new Date(apt.start_time), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          {patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown'}
                        </TableCell>
                        <TableCell>{providerUsers?.full_name || 'N/A'}</TableCell>
                        <TableCell>{apt.service_type || 'General'}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            apt.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                            apt.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                            apt.status === 'no_show' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {apt.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
