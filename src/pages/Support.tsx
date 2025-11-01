import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LifeBuoy, MessageSquare, Search, Mail, Phone, Clock } from "lucide-react";
import { format } from "date-fns";

interface PatientMessage {
  id: string;
  subject: string | null;
  message_body: string | null;
  created_at: string;
  resolved: boolean | null;
  thread_id: string | null;
  patient_id: string | null;
}

const Support = () => {
  const { userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all support threads (admin only)
  const { data: supportThreads, isLoading } = useQuery<PatientMessage[]>({
    queryKey: ["support-threads", searchQuery],
    queryFn: async (): Promise<PatientMessage[]> => {
      // @ts-ignore - Supabase types can cause deep instantiation issues
      const result = await supabase
        .from("patient_messages")
        .select("*")
        .eq("thread_type", "support")
        .order("created_at", { ascending: false});

      if (result.error) throw result.error;
      
      const tickets = (result.data || []) as PatientMessage[];
      
      // Apply search filter client-side
      if (searchQuery && tickets.length > 0) {
        return tickets.filter(ticket => 
          ticket.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ticket.message_body?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      return tickets;
    },
    enabled: userRole === "admin",
  });

  // Calculate stats
  const openTickets = supportThreads?.filter(t => !t.resolved).length || 0;
  const resolvedTickets = supportThreads?.filter(t => t.resolved).length || 0;
  const recentTickets = supportThreads?.slice(0, 5) || [];

  if (userRole !== "admin") {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Support Center</h1>
        <p className="text-muted-foreground mt-2">
          Manage support tickets and help users across the platform
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <LifeBuoy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedTickets}</div>
            <p className="text-xs text-muted-foreground">Successfully closed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supportThreads?.length || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>VitaLuxe Support Contact</CardTitle>
          <CardDescription>Direct contact information for urgent matters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">support@vitaluxe.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">1-800-VITA-LUX</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Monday - Friday, 9:00 AM - 6:00 PM EST</span>
          </div>
        </CardContent>
      </Card>

      {/* Support Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>View and manage all support requests</CardDescription>
          <div className="flex items-center gap-2 mt-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets by subject or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Tickets</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
              ) : recentTickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No support tickets found</div>
              ) : (
                recentTickets.map((ticket) => (
                  <Card key={ticket.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{ticket.subject || "No Subject"}</CardTitle>
                          <CardDescription>
                            Patient ID: {ticket.patient_id?.slice(0, 8)}...
                          </CardDescription>
                        </div>
                        <Badge variant={ticket.resolved ? "secondary" : "default"}>
                          {ticket.resolved ? "Resolved" : "Open"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.message_body}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/messages?thread=${ticket.thread_id}`}>View Thread</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="open" className="space-y-4">
              {supportThreads?.filter(t => !t.resolved).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No open tickets</div>
              ) : (
                supportThreads?.filter(t => !t.resolved).map((ticket) => (
                  <Card key={ticket.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{ticket.subject || "No Subject"}</CardTitle>
                          <CardDescription>
                            Patient ID: {ticket.patient_id?.slice(0, 8)}...
                          </CardDescription>
                        </div>
                        <Badge>Open</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.message_body}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), "MMM dd, yyyy")}
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/messages?thread=${ticket.thread_id}`}>View Thread</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-4">
              {supportThreads?.filter(t => t.resolved).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No resolved tickets</div>
              ) : (
                supportThreads?.filter(t => t.resolved).map((ticket) => (
                  <Card key={ticket.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">{ticket.subject || "No Subject"}</CardTitle>
                          <CardDescription>
                            Patient ID: {ticket.patient_id?.slice(0, 8)}...
                          </CardDescription>
                        </div>
                        <Badge variant="secondary">Resolved</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.message_body}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(ticket.created_at), "MMM dd, yyyy")}
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/messages?thread=${ticket.thread_id}`}>View Thread</a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Support;
