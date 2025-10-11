import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

export const MessagesView = () => {
  const { user, effectiveUserId } = useAuth();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const [isAdmin, setIsAdmin] = useState(false);
  const [recipientType, setRecipientType] = useState<"admin" | "pharmacy">("admin");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dispositionType, setDispositionType] = useState<string>("");
  const [dispositionNotes, setDispositionNotes] = useState<string>("");


  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!data);
    };
    
    checkAdminStatus();
  }, [user?.id]);


  // Fetch user's orders (for providers/practices to link to tickets)
  const { data: userOrders } = useQuery({
    queryKey: ["user-orders-for-tickets", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          status,
          total_amount,
          order_lines(
            id,
            assigned_pharmacy_id,
            product_id,
            products(name),
            pharmacies:assigned_pharmacy_id(
              id,
              name,
              user_id
            )
          )
        `)
        .eq("doctor_id", effectiveUserId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Filter to only orders with assigned pharmacies
      const ordersWithPharmacy = data?.filter(order => 
        order.order_lines?.some((line: any) => line.assigned_pharmacy_id)
      ) || [];
      
      return ordersWithPharmacy;
    },
    enabled: recipientType === "pharmacy" && !!effectiveUserId,
  });

  const { data: threads, refetch: refetchThreads } = useQuery({
    queryKey: ["message-threads", resolvedFilter, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("message_threads")
        .select(`
          *,
          thread_participants!inner(user_id),
          orders(id, status, created_at, total_amount)
        `)
        .eq("thread_participants.user_id", user?.id)
        .order("updated_at", { ascending: false });

      // Apply filter
      if (resolvedFilter === "resolved") {
        query = query.eq("resolved", true);
      } else if (resolvedFilter === "unresolved") {
        query = query.eq("resolved", false);
      }

      const { data: threadsData, error } = await query;
      if (error) throw error;

      // Fetch creator, resolver, and participant details
      if (threadsData && threadsData.length > 0) {
        const creatorIds = [...new Set(threadsData.map(t => t.created_by).filter(Boolean))];
        const resolverIds = [...new Set(threadsData.map(t => t.resolved_by).filter(Boolean))];
        const allUserIds = [...new Set([...creatorIds, ...resolverIds])];

        // Get participant details for pharmacy threads
        const threadIds = threadsData.map(t => t.id);
        const { data: participants } = await supabase
          .from("thread_participants")
          .select("thread_id, user_id, profiles(id, name, email)")
          .in("thread_id", threadIds);

        if (allUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", allUserIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          const participantMap = new Map();
          
          participants?.forEach(p => {
            if (!participantMap.has(p.thread_id)) {
              participantMap.set(p.thread_id, []);
            }
            participantMap.get(p.thread_id).push(p.profiles);
          });

          return threadsData.map(thread => ({
            ...thread,
            creator: thread.created_by ? profileMap.get(thread.created_by) : null,
            resolver: thread.resolved_by ? profileMap.get(thread.resolved_by) : null,
            participants: participantMap.get(thread.id) || [],
          }));
        }
      }

      return threadsData || [];
    },
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", selectedThread],
    queryFn: async () => {
      if (!selectedThread) return [];
      
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          profiles:sender_id(name, email)
        `)
        .eq("thread_id", selectedThread)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedThread,
  });

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    const { error } = await supabase.from("messages").insert([
      {
        thread_id: selectedThread,
        sender_id: user?.id,
        body: newMessage,
      },
    ]);

    if (error) {
      toast.error("Failed to send message");
    } else {
      setNewMessage("");
      refetchMessages();
      refetchThreads();
    }
  };

  const createThread = async () => {
    if (!newThreadSubject.trim() || !newThreadMessage.trim()) {
      toast.error("Please enter both subject and message");
      return;
    }

    // Validate order selection for order_issue threads
    if (recipientType === "pharmacy") {
      if (!selectedOrderId) {
        toast.error("Please select an order related to this issue");
        return;
      }
      if (!dispositionType) {
        toast.error("Please select an issue type");
        return;
      }
    }

    const threadType = recipientType === "pharmacy" ? "order_issue" : "support";

    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .insert([{ 
        subject: newThreadSubject, 
        created_by: effectiveUserId,
        thread_type: threadType,
        order_id: recipientType === "pharmacy" ? selectedOrderId : null,
        disposition_type: recipientType === "pharmacy" ? dispositionType : null,
      }])
      .select()
      .single();

    if (threadError) {
      toast.error("Failed to create ticket: " + threadError.message);
      console.error("Thread creation error:", threadError);
      return;
    }

    let participantIds = new Set([effectiveUserId]);

    if (recipientType === "admin") {
      // Add all admins
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminUsers && adminUsers.length > 0) {
        adminUsers.forEach(admin => participantIds.add(admin.user_id));
      }
    } else if (recipientType === "pharmacy") {
      // Auto-determine pharmacy from the selected order
      const selectedOrder = userOrders?.find(o => o.id === selectedOrderId);
      
      // Get unique pharmacy user_ids from order lines
      const pharmacyUserIds = new Set<string>();
      selectedOrder?.order_lines?.forEach((line: any) => {
        if (line.pharmacies?.user_id) {
          pharmacyUserIds.add(line.pharmacies.user_id);
        }
      });
      
      // Add all pharmacy users
      pharmacyUserIds.forEach(pharmacyUserId => {
        participantIds.add(pharmacyUserId);
      });
      
      if (pharmacyUserIds.size === 0) {
        toast.error("No pharmacy found for this order");
        return;
      }
    }

    const participants = Array.from(participantIds).map(userId => ({
      thread_id: thread.id,
      user_id: userId
    }));

    const { error: participantsError } = await supabase
      .from("thread_participants")
      .insert(participants);

    if (participantsError) {
      toast.error("Failed to add participants");
      console.error("Participants error:", participantsError);
      return;
    }

    // Create the first message
    const { error: messageError } = await supabase
      .from("messages")
      .insert([{
        thread_id: thread.id,
        sender_id: effectiveUserId,
        body: newThreadMessage,
      }]);

    if (messageError) {
      toast.error("Failed to send initial message");
      console.error("Message error:", messageError);
      return;
    }

  // Reset form
  setShowNewThread(false);
  setNewThreadSubject("");
  setNewThreadMessage("");
  setRecipientType("admin");
  setSelectedOrderId(null);
  setDispositionType("");
  setDispositionNotes("");
  setSelectedThread(thread.id);
  refetchThreads();
    
    const ticketType = threadType === "order_issue" ? "Order Issue Ticket" : "Support Ticket";
    toast.success(`${ticketType} created successfully`);
  };

  const markAsResolved = async (threadId: string) => {
    const { error } = await supabase
      .from("message_threads")
      .update({ 
        resolved: true, 
        resolved_by: user?.id,
        resolved_at: new Date().toISOString() 
      })
      .eq("id", threadId);
    
    if (error) {
      toast.error("Failed to mark as resolved");
      console.error("Mark resolved error:", error);
    } else {
      toast.success("Ticket marked as resolved");
      // Clear selection if on unresolved filter
      if (resolvedFilter === "unresolved") {
        setSelectedThread(null);
      }
      await refetchThreads();
    }
  };

  const closeOrderIssueTicket = async (threadId: string) => {
    if (!dispositionNotes.trim()) {
      toast.error("Please enter resolution notes before closing");
      return;
    }

    const { error } = await supabase
      .from("message_threads")
      .update({ 
        resolved: true, 
        resolved_by: user?.id,
        resolved_at: new Date().toISOString(),
        disposition_notes: dispositionNotes,
      })
      .eq("id", threadId);
    
    if (error) {
      toast.error("Failed to close ticket");
    } else {
      toast.success("Order issue ticket closed successfully");
      setDispositionNotes("");
      if (resolvedFilter === "unresolved") {
        setSelectedThread(null);
      }
      await refetchThreads();
    }
  };

  const reopenThread = async (threadId: string) => {
    const { error } = await supabase
      .from("message_threads")
      .update({ 
        resolved: false, 
        resolved_by: null,
        resolved_at: null 
      })
      .eq("id", threadId);
    
    if (error) {
      toast.error("Failed to reopen ticket");
      console.error("Reopen error:", error);
    } else {
      toast.success("Ticket reopened");
      // Clear selection if on resolved filter
      if (resolvedFilter === "resolved") {
        setSelectedThread(null);
      }
      await refetchThreads();
    }
  };

  const currentThread = threads?.find(t => t.id === selectedThread);

  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      <Card className="col-span-1 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isAdmin ? "All Tickets" : "My Tickets"}
          </h2>
          <Button size="sm" onClick={() => setShowNewThread(true)}>
            New Support Ticket
          </Button>
        </div>

        <div className="mb-4">
          <Select value={resolvedFilter} onValueChange={(value: any) => setResolvedFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter tickets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showNewThread && (
          <div className="mb-4 p-3 border border-border rounded-md space-y-3">
            {/* Recipient Type Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Send to:</label>
            <Select 
              value={recipientType} 
              onValueChange={(value: any) => {
                setRecipientType(value);
                setSelectedOrderId(null);
                setDispositionType("");
              }}
            >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Support / Admin</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy (Order Issue)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order Selection - Only show for order issues */}
            {recipientType === "pharmacy" && (
              <>
                {/* Order Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Related Order: *</label>
                  <Select 
                    value={selectedOrderId || ""} 
                    onValueChange={setSelectedOrderId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an order..." />
                    </SelectTrigger>
                    <SelectContent>
                      {userOrders?.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No orders with assigned pharmacies found
                        </div>
                      ) : (
                        userOrders?.map((order: any) => {
                          // Get pharmacy name from first order line
                          const pharmacyName = order.order_lines?.[0]?.pharmacies?.name || "Unknown Pharmacy";
                          
                          return (
                            <SelectItem key={order.id} value={order.id}>
                              Order from {new Date(order.created_at).toLocaleDateString()} - 
                              ${order.total_amount} ({order.status}) - {pharmacyName}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    The pharmacy will be automatically notified based on the order
                  </p>
                </div>

                {/* Issue Type / Disposition */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Issue Type: *</label>
                  <Select 
                    value={dispositionType} 
                    onValueChange={setDispositionType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select issue type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shipping_delay">Shipping Delay</SelectItem>
                      <SelectItem value="product_quality">Product Quality Issue</SelectItem>
                      <SelectItem value="wrong_order">Wrong Order Received</SelectItem>
                      <SelectItem value="missing_items">Missing Items</SelectItem>
                      <SelectItem value="damaged_product">Damaged Product</SelectItem>
                      <SelectItem value="prescription_issue">Prescription Issue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Subject & Message (same for both types) */}
            <Input
              placeholder={recipientType === "pharmacy" ? "Brief issue summary..." : "Ticket subject..."}
              value={newThreadSubject}
              onChange={(e) => setNewThreadSubject(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder={recipientType === "pharmacy" ? "Describe the order issue in detail..." : "Describe your issue..."}
              value={newThreadMessage}
              onChange={(e) => setNewThreadMessage(e.target.value)}
              rows={4}
              maxLength={2000}
            />

            <div className="flex gap-2">
              <Button size="sm" onClick={createThread}>
                {recipientType === "pharmacy" ? "Report Order Issue" : "Create Ticket"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewThread(false);
                  setNewThreadSubject("");
                  setNewThreadMessage("");
                  setRecipientType("admin");
                  setSelectedOrderId(null);
                  setDispositionType("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {threads?.map((thread) => {
            const isOrderIssue = (thread as any).thread_type === 'order_issue';
            
            return (
              <button
                key={thread.id}
                onClick={() => setSelectedThread(thread.id)}
                className={`w-full p-3 text-left rounded-md transition-colors border-l-4 ${
                  isOrderIssue 
                    ? 'border-l-orange-500' 
                    : 'border-l-blue-500'
                } ${
                  selectedThread === thread.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageCircle className="h-4 w-4 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate flex-1">{thread.subject}</p>
                      <Badge 
                        variant={thread.resolved ? "secondary" : "default"}
                        className="flex-shrink-0"
                      >
                        {thread.resolved ? "Closed" : "Open"}
                      </Badge>
                    </div>
                    
                    {/* Show thread type badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        variant="outline" 
                        className={isOrderIssue ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}
                      >
                        {isOrderIssue ? "Order Issue" : "Support"}
                      </Badge>
                      {isOrderIssue && (thread as any).disposition_type && (
                        <Badge variant="outline" className="text-xs">
                          {(thread as any).disposition_type.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>

                    {/* Show order info for order issues */}
                    {isOrderIssue && (thread as any).orders && (
                      <p className="text-xs opacity-70">
                        Order: {new Date((thread as any).orders.created_at).toLocaleDateString()} - ${(thread as any).orders.total_amount}
                      </p>
                    )}

                    {isAdmin && thread.created_by && (thread as any).creator && (
                      <p className="text-xs opacity-70">
                        By: {(thread as any).creator.name}
                      </p>
                    )}
                    <p className="text-xs opacity-70">
                      {new Date(thread.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="col-span-2 p-4 flex flex-col">
        {selectedThread ? (
          <>
            <div className="border-b border-border pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{currentThread?.subject}</h3>
                    <Badge 
                      variant="outline"
                      className={
                        (currentThread as any)?.thread_type === 'order_issue'
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }
                    >
                      {(currentThread as any)?.thread_type === 'order_issue' ? 'Order Issue' : 'Support'}
                    </Badge>
                  </div>

                  {/* Order Issue specific info */}
                  {(currentThread as any)?.thread_type === 'order_issue' && (
                    <div className="space-y-1 text-sm mb-2">
                      <p className="text-muted-foreground">
                        <strong>Issue Type:</strong> {(currentThread as any).disposition_type?.replace(/_/g, ' ')}
                      </p>
                      {(currentThread as any).orders && (
                        <p className="text-muted-foreground">
                          <strong>Order:</strong> {new Date((currentThread as any).orders.created_at).toLocaleDateString()} - 
                          ${(currentThread as any).orders.total_amount} ({(currentThread as any).orders.status})
                        </p>
                      )}
                      {(currentThread as any).participants && (currentThread as any).participants.length > 0 && (
                        <p className="text-muted-foreground">
                          <strong>Participants:</strong> {(currentThread as any).participants.map((p: any) => p.name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Resolved info */}
                  {currentThread?.resolved && (
                    <div className="mt-2 p-2 bg-muted rounded text-sm">
                      <p className="text-muted-foreground">
                        Closed by {(currentThread as any).resolver?.name || "User"} on{" "}
                        {new Date(currentThread.resolved_at).toLocaleDateString()}
                      </p>
                      {(currentThread as any).disposition_notes && (
                        <p className="mt-1">
                          <strong>Resolution:</strong> {(currentThread as any).disposition_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons based on thread type and user role */}
                <div className="flex gap-2">
                  {!currentThread?.resolved ? (
                    <>
                      {/* Support tickets: only admins can resolve */}
                      {(currentThread as any)?.thread_type === 'support' && isAdmin && (
                        <Button 
                          size="sm" 
                          onClick={() => markAsResolved(selectedThread)}
                        >
                          Mark as Resolved
                        </Button>
                      )}

                      {/* Order issue tickets: creator (practice/provider) can close */}
                      {(currentThread as any)?.thread_type === 'order_issue' && 
                       currentThread.created_by === user?.id && (
                        <div className="flex flex-col gap-2">
                          <Textarea
                            placeholder="Enter resolution notes..."
                            value={dispositionNotes}
                            onChange={(e) => setDispositionNotes(e.target.value)}
                            rows={2}
                            className="w-64"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => closeOrderIssueTicket(selectedThread)}
                            disabled={!dispositionNotes.trim()}
                          >
                            Close Issue
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Reopen logic */}
                      {isAdmin && (currentThread as any)?.thread_type === 'support' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => reopenThread(selectedThread)}
                        >
                          Reopen Ticket
                        </Button>
                      )}
                      {currentThread?.created_by === user?.id && 
                       (currentThread as any)?.thread_type === 'order_issue' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => reopenThread(selectedThread)}
                        >
                          Reopen Issue
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages?.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-md ${
                    message.sender_id === user?.id
                      ? "bg-primary text-primary-foreground ml-auto max-w-[80%]"
                      : "bg-muted mr-auto max-w-[80%]"
                  }`}
                >
                  <p className="text-xs opacity-70 mb-1">
                    {message.profiles?.name || "Unknown"} -{" "}
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
              ))}
            </div>

            {!currentThread?.resolved ? (
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={3}
                />
                <Button onClick={sendMessage} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-muted rounded-md text-center">
                <p className="text-sm text-muted-foreground">
                  This {(currentThread as any)?.thread_type === 'order_issue' ? 'issue' : 'ticket'} is closed.
                  {(currentThread as any)?.thread_type === 'support' 
                    ? (isAdmin ? " Reopen it" : " Contact an admin") 
                    : " Reopen it"
                  } to continue the conversation.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a ticket to view messages
          </div>
        )}
      </Card>
    </div>
  );
};
