import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SupportTicketThread() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [replyMessage, setReplyMessage] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["support-ticket-replies", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });

  const replyMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!user?.email || !ticket) throw new Error("Not authenticated");

      const { error } = await supabase.from("support_ticket_replies").insert({
        ticket_id: ticketId,
        replied_by: user.id,
        replied_by_role: effectiveRole,
        replied_by_email: user.email,
        message,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket-replies", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
    },
    onError: () => {
      toast.error("Failed to send reply");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: "open" | "in_progress" | "waiting_response" | "resolved" | "closed") => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("support_tickets")
        .update({
          resolved: true,
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolutionNotes || null,
        })
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket resolved");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: () => {
      toast.error("Failed to resolve ticket");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading ticket...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Ticket not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canResolve = effectiveRole === "admin" || !ticket.resolved;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate("/support-tickets")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Tickets
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{ticket.ticket_number}</Badge>
                <Badge variant={ticket.resolved ? "secondary" : "default"}>
                  {ticket.status}
                </Badge>
                <Badge
                  variant={ticket.priority === "urgent" ? "destructive" : "outline"}
                >
                  {ticket.priority}
                </Badge>
                <Badge variant="outline">
                  {ticket.ticket_type.replace(/_/g, " ")}
                </Badge>
              </div>
              <CardTitle>{ticket.subject}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Created by {ticket.created_by_name || ticket.created_by_email} •{" "}
                {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
              </p>
            </div>

            {effectiveRole === "admin" && !ticket.resolved && (
              <Select
                value={ticket.status}
                onValueChange={(value) => updateStatusMutation.mutate(value as "open" | "in_progress" | "waiting_response" | "resolved" | "closed")}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_response">Waiting Response</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{ticket.description}</p>
        </CardContent>
      </Card>

      {replies.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Replies</h2>
          {replies.map((reply) => (
            <Card key={reply.id}>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {reply.replied_by_name || reply.replied_by_email}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {reply.replied_by_role}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <Separator />
                  <p className="whitespace-pre-wrap">{reply.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!ticket.resolved && (
        <Card>
          <CardHeader>
            <CardTitle>Add Reply</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Type your reply..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              className="min-h-[120px]"
            />
            <Button
              onClick={() => replyMutation.mutate(replyMessage)}
              disabled={!replyMessage.trim() || replyMutation.isPending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Send Reply
            </Button>
          </CardContent>
        </Card>
      )}

      {canResolve && !ticket.resolved && (
        <Card>
          <CardHeader>
            <CardTitle>Resolve Ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Optional resolution notes..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Resolved
            </Button>
          </CardContent>
        </Card>
      )}

      {ticket.resolved && ticket.resolution_notes && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{ticket.resolution_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
