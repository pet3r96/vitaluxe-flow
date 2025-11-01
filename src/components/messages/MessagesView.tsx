import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, AlertCircle, Headset, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { logger } from "@/lib/logger";
import { useMessageAlerts } from "@/hooks/useMessageAlerts";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export const MessagesView = () => {
  const { user, effectiveUserId, effectiveRole, effectivePracticeId } = useAuth();
  const { isSubscribed } = useSubscription();
  const queryClient = useQueryClient();
  const { markThreadAsRead } = useMessageAlerts();
  const isMobile = useIsMobile();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showThreadList, setShowThreadList] = useState(true);
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
  const [activeTicketTab, setActiveTicketTab] = useState<"support" | "order_issues">("support");
  
  // Pagination state
  const [supportPage, setSupportPage] = useState(1);
  const [orderIssuesPage, setOrderIssuesPage] = useState(1);
  const [allTicketsPage, setAllTicketsPage] = useState(1);


  // Redirect patients to their dedicated messaging interface
  useEffect(() => {
    if (effectiveRole === 'patient') {
      window.location.href = '/patient-messages';
    }
  }, [effectiveRole]);

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
    queryKey: ["user-orders-for-tickets", effectiveUserId, effectiveRole],
    staleTime: 10000, // 10 seconds - messages need frequent updates
    queryFn: async () => {
      let doctorId = effectiveUserId;
      
      // For staff members, get their practice_id first
      if (effectiveRole === "staff") {
        const { data: staffData } = await supabase
          .from("practice_staff")
          .select("practice_id")
          .eq("user_id", effectiveUserId)
          .eq("active", true)
          .maybeSingle();
        
        if (!staffData || !staffData.practice_id) {
          return []; // Staff record not found or inactive
        }
        
        doctorId = staffData.practice_id;
      }
      
      // Now query orders using the correct doctor_id (practice_id for staff)
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
            patient_name,
            products(name),
            pharmacies!left(
              id,
              name,
              user_id
            )
          )
        `)
        .eq("doctor_id", doctorId)
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
    queryKey: ["message-threads", resolvedFilter, effectiveUserId, isAdmin, effectivePracticeId],
    staleTime: 30000, // 30 seconds
    queryFn: async () => {
      // CLIENT-SIDE SECURITY: Validate practice context for non-admins
      if (!isAdmin && effectivePracticeId && (effectiveRole === 'doctor' || effectiveRole === 'provider')) {
        logger.info('Loading messages with practice context', { 
          effectivePracticeId, 
          effectiveRole,
          effectiveUserId 
        });
      }
      
      // For non-admins: Fetch support tickets (created by user) separately from order issues (participant-based)
      if (!isAdmin) {
        // For reps (topline/downline), only show support tickets to admin
        if (effectiveRole === 'topline' || effectiveRole === 'downline') {
          // Fetch only support tickets created by rep
          let supportQuery = supabase
            .from("message_threads")
            .select(`
              *,
              thread_participants(user_id),
              orders(id, status, created_at, total_amount)
            `)
            .eq("thread_type", "support")
            .eq("created_by", effectiveUserId)
            .order("updated_at", { ascending: false });

          // Apply resolved filter
          if (resolvedFilter === "resolved") {
            supportQuery = supportQuery.eq("resolved", true);
          } else if (resolvedFilter === "unresolved") {
            supportQuery = supportQuery.eq("resolved", false);
          }

          const { data: supportData, error: supportError } = await supportQuery;

          if (supportError) throw supportError;

          const threadsData = supportData || [];
          
          // Fetch creator, resolver, and participant details
          if (threadsData.length > 0) {
            const creatorIds = [...new Set(threadsData.map(t => t.created_by).filter(Boolean))];
            const resolverIds = [...new Set(threadsData.map(t => t.resolved_by).filter(Boolean))];
            const allUserIds = [...new Set([...creatorIds, ...resolverIds])];

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

          return threadsData;
        }
        
        // For other roles (practices, pharmacies): show support tickets and order issues
        // Fetch support tickets created by user
        let supportQuery = supabase
          .from("message_threads")
          .select(`
            *,
            thread_participants(user_id),
            orders(id, status, created_at, total_amount)
          `)
          .eq("thread_type", "support")
          .eq("created_by", effectiveUserId)
          .order("updated_at", { ascending: false });

        // Fetch order issues where user is a participant
        let orderIssuesQuery = supabase
          .from("message_threads")
          .select(`
            *,
            thread_participants!inner(user_id),
            orders(id, status, created_at, total_amount)
          `)
          .eq("thread_type", "order_issue")
          .eq("thread_participants.user_id", effectiveUserId)
          .order("updated_at", { ascending: false });

        // Apply resolved filter
        if (resolvedFilter === "resolved") {
          supportQuery = supportQuery.eq("resolved", true);
          orderIssuesQuery = orderIssuesQuery.eq("resolved", true);
        } else if (resolvedFilter === "unresolved") {
          supportQuery = supportQuery.eq("resolved", false);
          orderIssuesQuery = orderIssuesQuery.eq("resolved", false);
        }

        const [{ data: supportData, error: supportError }, { data: orderIssuesData, error: orderError }] = await Promise.all([
          supportQuery,
          orderIssuesQuery
        ]);

        if (supportError) throw supportError;
        if (orderError) throw orderError;

        // Combine and sort by updated_at
        const threadsData = [...(supportData || []), ...(orderIssuesData || [])]
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        
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
      } else {
        // Admin: Fetch all threads with simple query
        let query = supabase
          .from("message_threads")
          .select(`
            *,
            thread_participants(user_id),
            orders(id, status, created_at, total_amount)
          `)
          .order("updated_at", { ascending: false });

        // Apply resolved filter
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
      }
    },
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", selectedThread],
    staleTime: 30000, // 30 seconds
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
        sender_id: effectiveUserId,
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

  // Mark thread as read when viewing it
  useEffect(() => {
    if (selectedThread && messages && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      markThreadAsRead(selectedThread, latestMessage.id);
    }
  }, [selectedThread, messages, markThreadAsRead]);

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
      logger.error("Thread creation error", threadError);
      return;
    }

    const participantIds = new Set([effectiveUserId]);

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
      
      // Get the pharmacy from the first order line (all lines should have same pharmacy)
      const firstLinePharmacy = selectedOrder?.order_lines?.find((line: any) => 
        line.assigned_pharmacy_id && line.pharmacies?.user_id
      );
      
      if (!firstLinePharmacy?.pharmacies?.user_id) {
        toast.error("No pharmacy found for this order");
        return;
      }
      
      // Add only the assigned pharmacy user to participants
      participantIds.add(firstLinePharmacy.pharmacies.user_id);
      
      // Validation: Ensure all order lines go to the same pharmacy
      const allSamePharmacy = selectedOrder?.order_lines?.every((line: any) => 
        !line.assigned_pharmacy_id || line.assigned_pharmacy_id === firstLinePharmacy.assigned_pharmacy_id
      );
      
      if (!allSamePharmacy) {
        logger.warn("Order has multiple pharmacies assigned", { orderId: selectedOrderId });
      }
    }

    logger.info("Creating ticket with participants", logger.sanitize({
      creator: effectiveUserId,
      participants: Array.from(participantIds),
      threadType: threadType,
      orderId: selectedOrderId
    }));

    const participants = Array.from(participantIds).map(userId => ({
      thread_id: thread.id,
      user_id: userId
    }));

    const { error: participantsError } = await supabase
      .from("thread_participants")
      .insert(participants);

    if (participantsError) {
      toast.error("Failed to add participants");
      logger.error("Participants error", participantsError);
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
      logger.error("Message error", messageError);
      return;
    }

    // Show loading state
    const loadingToast = toast.loading("Loading your new ticket...");

    // Refresh threads list
    await queryClient.invalidateQueries({ queryKey: ["message-threads"] });
    await refetchThreads();

    // Reset form
    setShowNewThread(false);
    setNewThreadSubject("");
    setNewThreadMessage("");
    setRecipientType("admin");
    setSelectedOrderId(null);
    setDispositionType("");
    setDispositionNotes("");
    
    // Select the new thread
    setSelectedThread(thread.id);

    // Dismiss loading and show success
    toast.dismiss(loadingToast);
    const ticketType = threadType === "order_issue" ? "Order Issue Ticket" : "Support Ticket";
    toast.success(`${ticketType} created successfully`);
  };

  const markAsResolved = async (threadId: string) => {
    const { error } = await supabase
      .from("message_threads")
      .update({ 
        resolved: true, 
        resolved_by: effectiveUserId,
        resolved_at: new Date().toISOString() 
      })
      .eq("id", threadId);
    
    if (error) {
      toast.error("Failed to mark as resolved");
      logger.error("Mark resolved error", error);
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
        resolved_by: effectiveUserId,
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
      logger.error("Reopen error", error);
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
  
  // Filter threads by type
  const supportTickets = threads?.filter(t => (t as any).thread_type !== 'order_issue') || [];
  const orderIssueTickets = threads?.filter(t => (t as any).thread_type === 'order_issue') || [];

  // Reset pagination when filters or tabs change
  useEffect(() => {
    setSupportPage(1);
  }, [resolvedFilter, activeTicketTab]);

  useEffect(() => {
    setOrderIssuesPage(1);
  }, [resolvedFilter, activeTicketTab]);

  useEffect(() => {
    setAllTicketsPage(1);
  }, [resolvedFilter]);

  // Pagination for support tickets (admin)
  const {
    currentPage: supportCurrentPage,
    totalPages: supportTotalPages,
    startIndex: supportStartIndex,
    endIndex: supportEndIndex,
    goToPage: supportGoToPage,
    hasNextPage: supportHasNextPage,
    hasPrevPage: supportHasPrevPage
  } = usePagination({
    totalItems: supportTickets.length,
    itemsPerPage: 25,
    initialPage: supportPage
  });

  useEffect(() => {
    setSupportPage(supportCurrentPage);
  }, [supportCurrentPage]);

  const paginatedSupportTickets = supportTickets.slice(supportStartIndex, supportEndIndex);

  // Pagination for order issues (admin)
  const {
    currentPage: orderIssuesCurrentPage,
    totalPages: orderIssuesTotalPages,
    startIndex: orderIssuesStartIndex,
    endIndex: orderIssuesEndIndex,
    goToPage: orderIssuesGoToPage,
    hasNextPage: orderIssuesHasNextPage,
    hasPrevPage: orderIssuesHasPrevPage
  } = usePagination({
    totalItems: orderIssueTickets.length,
    itemsPerPage: 25,
    initialPage: orderIssuesPage
  });

  useEffect(() => {
    setOrderIssuesPage(orderIssuesCurrentPage);
  }, [orderIssuesCurrentPage]);

  const paginatedOrderIssueTickets = orderIssueTickets.slice(orderIssuesStartIndex, orderIssuesEndIndex);

  // Pagination for all tickets (non-admin)
  const {
    currentPage: allTicketsCurrentPage,
    totalPages: allTicketsTotalPages,
    startIndex: allTicketsStartIndex,
    endIndex: allTicketsEndIndex,
    goToPage: allTicketsGoToPage,
    hasNextPage: allTicketsHasNextPage,
    hasPrevPage: allTicketsHasPrevPage
  } = usePagination({
    totalItems: threads?.length || 0,
    itemsPerPage: 25,
    initialPage: allTicketsPage
  });

  useEffect(() => {
    setAllTicketsPage(allTicketsCurrentPage);
  }, [allTicketsCurrentPage]);

  const paginatedAllTickets = threads?.slice(allTicketsStartIndex, allTicketsEndIndex);

  const handleSelectThread = (threadId: string) => {
    setSelectedThread(threadId);
    if (isMobile) {
      setShowThreadList(false);
    }
  };

  const handleBackToThreads = () => {
    setShowThreadList(true);
    setSelectedThread(null);
  };

  return (
    <div className={`flex gap-4 ${isMobile ? 'flex-col h-auto' : 'lg:grid lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr] h-[calc(100vh-12rem)]'}`}>
      {(!isMobile || showThreadList) && (
      <Card className={cn("p-3 sm:p-4 flex flex-col", isMobile ? "w-full" : "")}>
        {isMobile && selectedThread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToThreads}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </Button>
        )}
        <div className="mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold">
            {isAdmin ? "All Tickets" : "My Tickets"}
          </h2>
          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-1">
              You can view all support and order issue tickets for oversight
            </p>
          )}
        </div>

        <div className="mb-3 sm:mb-4">
          <Select value={resolvedFilter} onValueChange={(value: any) => setResolvedFilter(value)}>
            <SelectTrigger className="text-sm sm:text-base">
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
          <div className="mb-3 sm:mb-4 p-3 border border-border rounded-md space-y-3">
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
                {/* Only show pharmacy option for practices, providers, staff, and admins */}
                {(effectiveRole === "doctor" || effectiveRole === "provider" || effectiveRole === "admin" || effectiveRole === "staff") && (
                  <SelectItem value="pharmacy">Pharmacy (Order Issue)</SelectItem>
                )}
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
                          // Get pharmacy name and patient name from first order line
                          const firstLine = order.order_lines?.[0];
                          const pharmacyName = firstLine?.pharmacies?.name || "Unknown Pharmacy";
                          const patientName = firstLine?.patient_name || "Unknown Patient";
                          const shortOrderId = order.id.slice(0, 8); // First 8 chars of UUID
                          
                          return (
                            <SelectItem key={order.id} value={order.id}>
                              Order #{shortOrderId} - Patient: {patientName} - ${order.total_amount} - {new Date(order.created_at).toLocaleDateString()} - {pharmacyName}
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
                      <SelectItem value="order_on_hold">Order On Hold</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                      <SelectItem value="cannot_fulfill">Cannot Fulfill</SelectItem>
                      <SelectItem value="invalid_prescription">Invalid Prescription</SelectItem>
                      <SelectItem value="incorrect_dosage">Incorrect Dosage</SelectItem>
                      <SelectItem value="patient_request">Patient Request</SelectItem>
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
              className="text-base"
            />
            <Textarea
              placeholder={recipientType === "pharmacy" ? "Describe the order issue in detail..." : "Describe your issue..."}
              value={newThreadMessage}
              onChange={(e) => setNewThreadMessage(e.target.value)}
              rows={isMobile ? 3 : 4}
              maxLength={2000}
              className="text-base"
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" onClick={createThread} className="w-full sm:w-auto">
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
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Admin View: Tabbed Interface */}
        {isAdmin ? (
          <Tabs value={activeTicketTab} onValueChange={(v: any) => setActiveTicketTab(v)} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="support" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <Headset className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Support</span>
                <span className="sm:hidden">Supp.</span> ({supportTickets.length})
              </TabsTrigger>
              <TabsTrigger value="order_issues" className="gap-1 sm:gap-2 text-xs sm:text-sm">
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Order Issues</span>
                <span className="sm:hidden">Orders</span> ({orderIssueTickets.length})
              </TabsTrigger>
            </TabsList>

            {/* Support Tickets Tab */}
            <TabsContent value="support" className="flex-1 flex flex-col space-y-3 sm:space-y-4 mt-3 sm:mt-4">
              <Button size="sm" onClick={() => setShowNewThread(true)} className="w-full text-sm sm:text-base">
                New Support Ticket
              </Button>
              
              <div className="flex-1 overflow-y-auto space-y-1.5 sm:space-y-2">
                {paginatedSupportTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No support tickets</p>
                ) : (
                  paginatedSupportTickets.map((thread) => {
                    const isOrderIssue = (thread as any).thread_type === 'order_issue';
                    
                    return (
                      <button
                        key={thread.id}
                        onClick={() => handleSelectThread(thread.id)}
                        className={`w-full p-2 sm:p-3 text-left rounded-md transition-colors border-l-4 border-l-blue-500 ${
                          selectedThread === thread.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm sm:text-base font-medium truncate flex-1">{thread.subject}</p>
                              <Badge 
                                variant={thread.resolved ? "secondary" : "default"}
                                className="flex-shrink-0 text-xs"
                              >
                                {thread.resolved ? "Closed" : "Open"}
                              </Badge>
                            </div>

                            {thread.created_by && (thread as any).creator && (
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
                  })
                )}
              </div>

              {/* Pagination Controls */}
              {supportTickets.length > 0 && (
                <DataTablePagination
                  currentPage={supportCurrentPage}
                  totalPages={supportTotalPages}
                  onPageChange={supportGoToPage}
                  hasNextPage={supportHasNextPage}
                  hasPrevPage={supportHasPrevPage}
                  totalItems={supportTickets.length}
                  startIndex={supportStartIndex}
                  endIndex={supportEndIndex}
                />
              )}
            </TabsContent>

            {/* Order Issues Tab */}
            <TabsContent value="order_issues" className="flex-1 flex flex-col space-y-3 sm:space-y-4 mt-3 sm:mt-4">
              <div className="text-xs sm:text-sm text-muted-foreground bg-muted/50 p-2 sm:p-3 rounded-md">
                <p className="font-medium">Order issue tickets are created by practices/providers</p>
                <p className="text-xs mt-1">These tickets are conversations between practices and pharmacies regarding specific orders</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 sm:space-y-2">
                {paginatedOrderIssueTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No order issue tickets</p>
                ) : (
                  paginatedOrderIssueTickets.map((thread) => {
                    const isOrderIssue = (thread as any).thread_type === 'order_issue';
                    
                    return (
                      <button
                        key={thread.id}
                        onClick={() => handleSelectThread(thread.id)}
                        className={`w-full p-2 sm:p-3 text-left rounded-md transition-colors border-l-4 border-l-gold1 ${
                          selectedThread === thread.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm sm:text-base font-medium truncate flex-1">{thread.subject}</p>
                              <Badge 
                                variant={thread.resolved ? "secondary" : "default"}
                                className="flex-shrink-0 text-xs"
                              >
                                {thread.resolved ? "Closed" : "Open"}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                              {(thread as any).disposition_type && (
                                <Badge variant="outline" className="text-xs">
                                  {(thread as any).disposition_type.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </div>

                            {(thread as any).orders && (
                              <p className="text-xs opacity-70">
                                Order: {new Date((thread as any).orders.created_at).toLocaleDateString()} - ${(thread as any).orders.total_amount}
                              </p>
                            )}

                            {thread.created_by && (thread as any).creator && (
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
                  })
                )}
              </div>

              {/* Pagination Controls */}
              {orderIssueTickets.length > 0 && (
                <DataTablePagination
                  currentPage={orderIssuesCurrentPage}
                  totalPages={orderIssuesTotalPages}
                  onPageChange={orderIssuesGoToPage}
                  hasNextPage={orderIssuesHasNextPage}
                  hasPrevPage={orderIssuesHasPrevPage}
                  totalItems={orderIssueTickets.length}
                  startIndex={orderIssuesStartIndex}
                  endIndex={orderIssuesEndIndex}
                />
              )}
            </TabsContent>

          </Tabs>
        ) : (
          /* Non-Admin View: Single list */
          <>
            <Button size="sm" onClick={() => setShowNewThread(true)} className="w-full mb-3 sm:mb-4 text-sm sm:text-base">
              New Ticket
            </Button>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
              {paginatedAllTickets?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tickets found</p>
              ) : (
                paginatedAllTickets?.map((thread) => {
                  const isOrderIssue = (thread as any).thread_type === 'order_issue';
                  
                  return (
                    <button
                      key={thread.id}
                      onClick={() => handleSelectThread(thread.id)}
                      className={`w-full p-2 sm:p-3 text-left rounded-md transition-colors border-l-4 ${
                        isOrderIssue 
                          ? 'border-l-gold1' 
                          : 'border-l-blue-500'
                      } ${
                        selectedThread === thread.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm sm:text-base font-medium truncate flex-1">{thread.subject}</p>
                            <Badge 
                              variant={thread.resolved ? "secondary" : "default"}
                              className="flex-shrink-0 text-xs"
                            >
                              {thread.resolved ? "Closed" : "Open"}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge 
                              variant="outline" 
                              className={isOrderIssue ? "bg-gold1/10 text-gold1 border-gold1/30" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"}
                            >
                              {isOrderIssue ? "Order Issue" : "Support"}
                            </Badge>
                            {isOrderIssue && (thread as any).disposition_type && (
                              <Badge variant="outline" className="text-xs">
                                {(thread as any).disposition_type.replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </div>

                          {isOrderIssue && (thread as any).orders && (
                            <p className="text-xs opacity-70">
                              Order: {new Date((thread as any).orders.created_at).toLocaleDateString()} - ${(thread as any).orders.total_amount}
                            </p>
                          )}

                          <p className="text-xs opacity-70">
                            {new Date(thread.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {threads && threads.length > 0 && (
              <DataTablePagination
                currentPage={allTicketsCurrentPage}
                totalPages={allTicketsTotalPages}
                onPageChange={allTicketsGoToPage}
                hasNextPage={allTicketsHasNextPage}
                hasPrevPage={allTicketsHasPrevPage}
                totalItems={threads.length}
                startIndex={allTicketsStartIndex}
                endIndex={allTicketsEndIndex}
              />
            )}
          </>
        )}
      </Card>
      )}

      {(!isMobile || !showThreadList) && (
      <Card className={cn("p-3 sm:p-4 flex flex-col", isMobile ? "w-full min-h-[calc(100vh-8rem)]" : "flex-1")}>
        {isMobile && selectedThread && (
          <div className="pb-3 mb-3 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToThreads}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tickets
            </Button>
          </div>
        )}
        {selectedThread ? (
          <>
            <div className="border-b border-border pb-3 sm:pb-4 mb-3 sm:mb-4">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-semibold">{currentThread?.subject}</h3>
                    <Badge 
                      variant="outline"
                      className={
                        (currentThread as any)?.thread_type === 'order_issue'
                          ? "bg-gold1/10 text-gold1 border-gold1/30 text-xs"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs"
                      }
                    >
                      {(currentThread as any)?.thread_type === 'order_issue' ? 'Order Issue' : 'Support'}
                    </Badge>
                  </div>

                  {/* Order Issue specific info */}
                  {(currentThread as any)?.thread_type === 'order_issue' && (
                    <div className="space-y-1 text-xs sm:text-sm mb-2">
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
                    <div className="mt-2 p-2 bg-muted rounded text-xs sm:text-sm">
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
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {!currentThread?.resolved ? (
                    <>
            {/* Support tickets: creator or admin can resolve */}
            {(currentThread as any)?.thread_type === 'support' && 
             (currentThread.created_by === user?.id || isAdmin) && (
              <Button 
                size="sm" 
                onClick={() => markAsResolved(selectedThread)}
              >
                Mark as Resolved
              </Button>
            )}

            {/* Order issue tickets: creator (practice/provider) or admin can close */}
            {(currentThread as any)?.thread_type === 'order_issue' && 
             (currentThread.created_by === user?.id || isAdmin) && (
                        <div className="flex flex-col gap-2">
                          <Textarea
                            placeholder="Enter resolution notes..."
                            value={dispositionNotes}
                            onChange={(e) => setDispositionNotes(e.target.value)}
                            rows={2}
                            className="w-full sm:w-64 text-base"
                          />
                          <Button 
                            size="sm" 
                            onClick={() => closeOrderIssueTicket(selectedThread)}
                            disabled={!dispositionNotes.trim()}
                            className="w-full sm:w-auto"
                          >
                            Close Issue
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Reopen logic */}
            {(currentThread.created_by === user?.id || isAdmin) && 
             (currentThread as any)?.thread_type === 'support' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => reopenThread(selectedThread)}
              >
                Reopen Ticket
              </Button>
            )}
            {(currentThread?.created_by === user?.id || isAdmin) && 
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

            <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 mb-3 sm:mb-4 px-1">
              {messages?.map((message) => (
                <div
                  key={message.id}
                  className={`p-2 sm:p-3 rounded-md text-sm sm:text-base ${
                    message.sender_id === user?.id
                      ? "bg-primary text-primary-foreground ml-auto max-w-[85%] sm:max-w-[80%]"
                      : "bg-muted mr-auto max-w-[85%] sm:max-w-[80%]"
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
                  rows={isMobile ? 2 : 3}
                  className="text-base"
                />
                <Button onClick={sendMessage} size="icon" className="flex-shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="p-2 sm:p-3 bg-muted rounded-md text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">
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
          <div className="flex items-center justify-center h-full text-sm sm:text-base text-muted-foreground">
            Select a ticket to view messages
          </div>
        )}
      </Card>
      )}
    </div>
  );
};
