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
import { CreateSupportTicketDialog } from "@/components/support/CreateSupportTicketDialog";

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
  const { effectiveRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all support threads (admin only)
  const { data: supportThreads, isLoading } = useQuery<PatientMessage[]>({
    queryKey: ["support-threads", searchQuery],
    queryFn: async (): Promise<PatientMessage[]> => {
      // @ts-ignore - Supabase types can cause deep instantiation issues
      const result = await supabase
        .from("patient_messages")
        .select("*")
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
    enabled: ["admin", "doctor", "staff", "provider"].includes(effectiveRole || ""),
  });

  // Calculate stats
  const [allPage, setAllPage] = useState(1);
  const [openPage, setOpenPage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const itemsPerPage = 10;
  
  const openTicketsList = supportThreads?.filter(t => !t.resolved) || [];
  const resolvedTicketsList = supportThreads?.filter(t => t.resolved) || [];
  
  const openTickets = openTicketsList.length;
  const resolvedTickets = resolvedTicketsList.length;
  
  // Pagination logic for each tab
  const allTotalPages = Math.ceil((supportThreads?.length || 0) / itemsPerPage);
  const allStartIndex = (allPage - 1) * itemsPerPage;
  const allEndIndex = allStartIndex + itemsPerPage;
  const paginatedAllTickets = supportThreads?.slice(allStartIndex, allEndIndex) || [];

  const openTotalPages = Math.ceil(openTicketsList.length / itemsPerPage);
  const openStartIndex = (openPage - 1) * itemsPerPage;
  const openEndIndex = openStartIndex + itemsPerPage;
  const paginatedOpenTickets = openTicketsList.slice(openStartIndex, openEndIndex);

  const resolvedTotalPages = Math.ceil(resolvedTicketsList.length / itemsPerPage);
  const resolvedStartIndex = (resolvedPage - 1) * itemsPerPage;
  const resolvedEndIndex = resolvedStartIndex + itemsPerPage;
  const paginatedResolvedTickets = resolvedTicketsList.slice(resolvedStartIndex, resolvedEndIndex);

  // Allow admin, doctor, staff, and provider roles to access support
  const allowedRoles = ["admin", "doctor", "staff", "provider"];
  if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold gold-text-gradient">Support Center</h1>
          <p className="text-muted-foreground mt-2">
            Manage support tickets and help users across the platform
          </p>
        </div>
        <CreateSupportTicketDialog />
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
          <Tabs defaultValue="open" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Tickets</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
              ) : paginatedAllTickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No support tickets found</div>
              ) : (
                <>
                  {paginatedAllTickets.map((ticket) => (
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
                  ))}
                  
                  {/* Pagination */}
                  {allTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {allStartIndex + 1}-{Math.min(allEndIndex, supportThreads?.length || 0)} of {supportThreads?.length || 0}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAllPage(p => Math.max(1, p - 1))}
                          disabled={allPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: allTotalPages }, (_, i) => i + 1).map(page => (
                            <Button
                              key={page}
                              variant={allPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setAllPage(page)}
                              className="w-8"
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAllPage(p => Math.min(allTotalPages, p + 1))}
                          disabled={allPage === allTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="open" className="space-y-4">
              {openTicketsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No open tickets</div>
              ) : (
                <>
                  {paginatedOpenTickets.map((ticket) => (
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
                            {format(new Date(ticket.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                          </span>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/messages?thread=${ticket.thread_id}`}>View Thread</a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Pagination */}
                  {openTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {openStartIndex + 1}-{Math.min(openEndIndex, openTicketsList.length)} of {openTicketsList.length}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOpenPage(p => Math.max(1, p - 1))}
                          disabled={openPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: openTotalPages }, (_, i) => i + 1).map(page => (
                            <Button
                              key={page}
                              variant={openPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setOpenPage(page)}
                              className="w-8"
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOpenPage(p => Math.min(openTotalPages, p + 1))}
                          disabled={openPage === openTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-4">
              {resolvedTicketsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No resolved tickets</div>
              ) : (
                <>
                  {paginatedResolvedTickets.map((ticket) => (
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
                            {format(new Date(ticket.created_at), "MMM dd, yyyy 'at' hh:mm a")}
                          </span>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/messages?thread=${ticket.thread_id}`}>View Thread</a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Pagination */}
                  {resolvedTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {resolvedStartIndex + 1}-{Math.min(resolvedEndIndex, resolvedTicketsList.length)} of {resolvedTicketsList.length}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResolvedPage(p => Math.max(1, p - 1))}
                          disabled={resolvedPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: resolvedTotalPages }, (_, i) => i + 1).map(page => (
                            <Button
                              key={page}
                              variant={resolvedPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setResolvedPage(page)}
                              className="w-8"
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResolvedPage(p => Math.min(resolvedTotalPages, p + 1))}
                          disabled={resolvedPage === resolvedTotalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Support;
