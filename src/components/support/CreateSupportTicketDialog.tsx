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
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { logger } from "@/lib/logger";

const ticketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
  patientEmail: z.string().email("Must be a valid email address"),
});

type TicketFormData = z.infer<typeof ticketSchema>;

export function CreateSupportTicketDialog() {
  const [open, setOpen] = useState(false);
  const { effectiveUserId } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      message: "",
      patientEmail: "",
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      logger.info('[CreateSupportTicket] Starting mutation', { subject: data.subject, patientEmail: data.patientEmail });
      
      // Find patient by email and get their practice_id and name
      const { data: patient, error: patientError } = await supabase
        .from("patient_accounts")
        .select("id, practice_id, first_name, last_name")
        .eq("email", data.patientEmail.toLowerCase())
        .maybeSingle();

      logger.info('[CreateSupportTicket] Patient lookup result', { patientFound: !!patient, error: patientError?.message });

      if (patientError) throw patientError;

      if (!patient) {
        throw new Error(`No patient found with email: ${data.patientEmail}`);
      }

      // CRITICAL FIX: Use patient's practice_id
      const targetPracticeId = patient.practice_id;

      if (!targetPracticeId) {
        throw new Error('Patient is not assigned to any practice');
      }

      // Get current user for created_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create a new message thread
      const threadId = crypto.randomUUID();
      
      const insertData = {
        patient_id: patient.id,
        practice_id: targetPracticeId, // ← Use patient's practice
        sender_id: effectiveUserId!,
        sender_type: "admin",
        subject: data.subject,
        body: data.message,
        thread_id: threadId,
        resolved: false,
      };
      
      logger.info('[CreateSupportTicket] Creating ticket', { patientId: patient.id, practiceId: targetPracticeId });

      const { data: insertResult, error } = await supabase
        .from("patient_messages")
        .insert(insertData)
        .select()
        .single();

      logger.info('[CreateSupportTicket] Insert result', { success: !!insertResult, error: error?.message });

      if (error) {
        logger.error('[CreateSupportTicket] Insert error details', error, {
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      return insertResult;
    },
    onSuccess: () => {
      toast.success("Support ticket created successfully");
      queryClient.invalidateQueries({ queryKey: ["support-threads"] });
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Create a new support ticket on behalf of a patient
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="patient@example.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
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
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of the support request"
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
