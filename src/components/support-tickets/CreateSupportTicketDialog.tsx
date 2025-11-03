import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const ticketSchema = z.object({
  ticketType: z.enum([
    "pharmacy_order_issue",
    "practice_to_admin",
    "rep_to_admin",
    "pharmacy_to_admin",
    "pharmacy_to_practice",
  ]),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  orderId: z.string().optional(),
  practiceId: z.string().optional(),
}).refine(
  (data) => {
    if (data.ticketType === "pharmacy_order_issue" && !data.orderId) {
      return false;
    }
    return true;
  },
  {
    message: "Order selection is required for pharmacy order issues",
    path: ["orderId"],
  }
);

type TicketFormData = z.infer<typeof ticketSchema>;

export function CreateSupportTicketDialog() {
  const [open, setOpen] = useState(false);
  const { user, effectiveRole } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      ticketType: getDefaultTicketType(effectiveRole),
      subject: "",
      description: "",
      priority: "medium",
    },
  });

  const ticketType = form.watch("ticketType");

  // Fetch recent orders for dropdown
  const { data: userOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["user-orders-for-tickets", user?.id, effectiveRole],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("orders")
        .select(`
          id,
          created_at,
          doctor_id,
          total_amount,
          status,
          order_lines!inner(patient_name, patient_id)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      
      // Filter based on role
      if (effectiveRole === "doctor") {
        query = query.eq("doctor_id", user.id);
      } else if (effectiveRole === "staff") {
        const { data: providerData } = await supabase
          .from("providers")
          .select("practice_id")
          .eq("user_id", user.id)
          .single();
        
        if (providerData?.practice_id) {
          query = query.eq("doctor_id", providerData.practice_id);
        }
      }
      // Admin sees all orders (no filter)
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && ticketType === "pharmacy_order_issue",
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      if (!user?.email) throw new Error("Not authenticated");

      const ticketData: any = {
        ticket_type: data.ticketType,
        subject: data.subject,
        description: data.description,
        priority: data.priority,
        created_by: user.id,
        created_by_role: effectiveRole,
        created_by_email: user.email,
        status: "open",
      };

      // Add related entity IDs based on ticket type
      if (data.ticketType === "pharmacy_order_issue" && data.orderId) {
        ticketData.order_id = data.orderId;
        
        // Get pharmacy and practice info from order
        const { data: orderData } = await supabase
          .from("orders")
          .select("doctor_id, order_lines(assigned_pharmacy_id)")
          .eq("id", data.orderId)
          .single();

        if (orderData) {
          ticketData.practice_id = orderData.doctor_id;
          if (orderData.order_lines?.[0]?.assigned_pharmacy_id) {
            ticketData.pharmacy_id = orderData.order_lines[0].assigned_pharmacy_id;
          }
        }
      } else if (data.ticketType === "pharmacy_to_practice" && data.practiceId) {
        ticketData.practice_id = data.practiceId;
        
        // Get pharmacy ID from current user
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (pharmacyData) {
          ticketData.pharmacy_id = pharmacyData.id;
        }
      } else if (effectiveRole === "doctor" || effectiveRole === "staff") {
        // For practice users, add their practice_id
        if (effectiveRole === "doctor") {
          ticketData.practice_id = user.id;
        } else {
          const { data: providerData } = await supabase
            .from("providers")
            .select("practice_id")
            .eq("user_id", user.id)
            .single();

          if (providerData) {
            ticketData.practice_id = providerData.practice_id;
          }
        }
      } else if (effectiveRole === "pharmacy") {
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (pharmacyData) {
          ticketData.pharmacy_id = pharmacyData.id;
        }
      }

      const { error } = await supabase.from("support_tickets").insert(ticketData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Support ticket created successfully");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create support ticket");
    },
  });

  const onSubmit = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const availableTicketTypes = getAvailableTicketTypes(effectiveRole);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Submit a support request to the appropriate team
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="ticketType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ticket Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ticket type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableTicketTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {ticketType === "pharmacy_order_issue" && (
              <FormField
                control={form.control}
                name="orderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={ordersLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            ordersLoading 
                              ? "Loading orders..." 
                              : userOrders?.length 
                                ? "Select an order" 
                                : "No orders found"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userOrders?.map((order: any) => {
                          const patientName = order.order_lines?.[0]?.patient_name || 'Unknown Patient';
                          return (
                            <SelectItem key={order.id} value={order.id}>
                              {format(new Date(order.created_at), "MMM dd, yyyy")} - 
                              ${order.total_amount?.toFixed(2)} ({order.status})
                              {` - ${patientName}`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {ticketType === "pharmacy_to_practice" && (
              <FormField
                control={form.control}
                name="practiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Practice ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter practice ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of your support request"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTicketMutation.isPending}>
                {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function getDefaultTicketType(role: string): any {
  switch (role) {
    case "topline":
    case "downline":
      return "rep_to_admin";
    case "pharmacy":
      return "pharmacy_to_admin";
    case "doctor":
    case "staff":
      return "practice_to_admin";
    default:
      return "practice_to_admin";
  }
}

function getAvailableTicketTypes(role: string) {
  const allTypes = [
    { value: "pharmacy_order_issue", label: "Pharmacy Order Issue" },
    { value: "practice_to_admin", label: "General Support (Admin)" },
    { value: "rep_to_admin", label: "Contact Admin" },
    { value: "pharmacy_to_admin", label: "Contact Admin" },
    { value: "pharmacy_to_practice", label: "Contact Practice" },
  ];

  switch (role) {
    case "topline":
    case "downline":
      return allTypes.filter((t) => t.value === "rep_to_admin");
    case "pharmacy":
      return allTypes.filter((t) =>
        ["pharmacy_to_admin", "pharmacy_to_practice", "pharmacy_order_issue"].includes(
          t.value
        )
      );
    case "doctor":
    case "staff":
      return allTypes.filter((t) =>
        ["practice_to_admin", "pharmacy_order_issue"].includes(t.value)
      );
    case "admin":
      return allTypes;
    default:
      return allTypes.filter((t) => t.value === "practice_to_admin");
  }
}
