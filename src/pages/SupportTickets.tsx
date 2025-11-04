import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, CheckCircle2, Clock } from "lucide-react";
import { CreateSupportTicketDialog } from "@/components/support-tickets/CreateSupportTicketDialog";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface SupportTicket {
  id: string;
  ticket_number: string;
  ticket_type: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  created_by_email: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  last_reply_at: string | null;
  resolved: boolean;
  support_ticket_replies: { id: string }[];
}

export default function SupportTickets() {
  const { effectiveRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "open" | "resolved">("all");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", effectiveRole],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          support_ticket_replies(id)
        `)
        .order("created_at", { ascending: false });

      // Filter by practice_id for staff and doctors
      if (effectiveRole === "staff") {
        // Get staff's practice_id with better error handling
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: staffData, error: staffError } = await supabase
          .from("practice_staff")
          .select("practice_id")
          .eq("user_id", user?.id)
          .eq("active", true)
          .maybeSingle();

        if (staffError) {
          console.error('[SupportTickets] Error fetching staff practice:', staffError);
          throw staffError;
        }

        if (!staffData?.practice_id) {
          console.warn('[SupportTickets] ⚠️ Staff has no active practice');
          return [];
        }

        console.log('[SupportTickets] Staff viewing tickets for practice:', staffData.practice_id);
        query = query.eq("practice_id", staffData.practice_id);
      } else if (effectiveRole === "doctor") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq("practice_id", user.id);
        }
      }
      // Admin sees all tickets (no filter)

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: ["admin", "doctor", "staff", "provider", "topline", "downline", "pharmacy"].includes(
      effectiveRole
    ),
  });

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "open" && !ticket.resolved) ||
      (activeTab === "resolved" && ticket.resolved);

    return matchesSearch && matchesTab;
  });

  const openCount = tickets.filter((t) => !t.resolved).length;
  const resolvedCount = tickets.filter((t) => t.resolved).length;

  if (!["admin", "doctor", "staff", "provider", "topline", "downline", "pharmacy"].includes(effectiveRole)) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              You don't have permission to access support tickets.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Support Tickets</h1>
          <p className="text-muted-foreground">
            Manage and track your support requests
          </p>
        </div>
        <CreateSupportTicketDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedCount}</div>
            <p className="text-xs text-muted-foreground">Successfully closed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets.length}</div>
            <p className="text-xs text-muted-foreground">All time tickets</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
              <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
              <TabsTrigger value="resolved">Resolved ({resolvedCount})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-4">
              {isLoading ? (
                <p className="text-center text-muted-foreground py-8">
                  Loading tickets...
                </p>
              ) : filteredTickets.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No tickets found
                </p>
              ) : (
                filteredTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={`/support-tickets/${ticket.id}`}
                    className="block"
                  >
                    <Card className="hover:border-primary transition-colors cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">{ticket.ticket_number}</Badge>
                              <Badge variant={ticket.resolved ? "secondary" : "default"}>
                                {ticket.status}
                              </Badge>
                              <Badge
                                variant={
                                  ticket.priority === "urgent"
                                    ? "destructive"
                                    : "outline"
                                }
                              >
                                {ticket.priority}
                              </Badge>
                              <Badge variant="outline">
                                {ticket.ticket_type.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <h3 className="font-semibold">{ticket.subject}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {ticket.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                From: {ticket.created_by_name || ticket.created_by_email}
                              </span>
                              <span>
                                {formatDistanceToNow(new Date(ticket.created_at), {
                                  addSuffix: true,
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {ticket.support_ticket_replies?.length || 0} replies
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
