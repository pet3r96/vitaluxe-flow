import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Building2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NewMessageDialog({ open, onOpenChange, onSuccess }: NewMessageDialogProps) {
  const { session } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  console.log("🔍 NewMessageDialog rendered, open:", open);

  // Get patient's practice info using edge function to handle impersonation correctly
  const { data: practiceData, isLoading: isLoadingPractice, error: practiceError, refetch } = useQuery<{
    patientAccountId: string;
    practiceId: string | null;
    practice: {
      name: string | null;
      city: string | null;
      state: string | null;
    } | null;
  }>({
    queryKey: ["patient-practice-info", open],
    queryFn: async () => {
      const reqId = crypto.randomUUID();
      console.log(`🔄 [${reqId}] Invoking get-patient-practice edge function...`);
      
      const token = session?.access_token;
      if (!token) {
        console.error(`❌ [${reqId}] No access token available`);
        throw new Error("Authentication required");
      }
      
      try {
        const { data, error } = await supabase.functions.invoke("get-patient-practice", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        console.log(`📦 [${reqId}] Edge function raw response:`, { data, error });
        
        if (error) {
          console.error(`❌ [${reqId}] Edge function error:`, error);
          
          // Detect error type for better user feedback
          const errorName = (error as any)?.name || "UnknownError";
          const errorMessage = error.message || "Unknown error occurred";
          
          throw new Error(`${errorName}: ${errorMessage}`);
        }
        
        if (!data) {
          console.error(`❌ [${reqId}] No data returned from edge function`);
          throw new Error("No data returned from practice lookup");
        }
        
        console.log(`✅ [${reqId}] Practice data retrieved successfully:`, data);
        
        return data as {
          patientAccountId: string;
          practiceId: string | null;
          practice: {
            name: string | null;
            city: string | null;
            state: string | null;
          } | null;
        };
      } catch (err) {
        console.error(`💥 [${reqId}] Exception in queryFn:`, err);
        throw err;
      }
    },
    enabled: open && !!session?.access_token,
    retry: 1,
    retryDelay: 500,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  console.log("📊 Query state:", { 
    isLoading: isLoadingPractice, 
    hasError: !!practiceError, 
    hasData: !!practiceData,
    data: practiceData 
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Message is required");
      if (!practiceData?.practiceId) throw new Error("No practice assigned");

      const { data, error } = await supabase.functions.invoke("send-patient-message", {
        body: {
          subject: subject.trim() || "Patient Message",
          message: message.trim(),
        },
      });

      if (error) {
        const errorMsg = error?.context?.body?.error || error.message;
        throw new Error(errorMsg);
      }

      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Message sent to your practice");
      setSubject("");
      setMessage("");
      onSuccess();
    },
    onError: (error: any) => {
      console.error("Send message error:", error);
      
      // Map server errors to user-friendly messages
      const errorMsg = error?.message || "Failed to send message";
      
      if (errorMsg.includes("Patient account not found")) {
        toast.error("This user doesn't have a patient account.");
      } else if (errorMsg.includes("No practice assigned")) {
        toast.error("No practice is assigned to this patient yet. Please assign one first.");
      } else if (errorMsg.includes("Failed to send a request") || errorMsg.includes("FunctionsFetchError")) {
        toast.error("We couldn't reach the messaging service. Please try again in a moment.");
      } else {
        toast.error(errorMsg);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMutation.mutate();
  };

  const hasPractice = practiceData?.practiceId && practiceData?.practice;
  const canSend = hasPractice && message.trim() && !sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Send a secure message to your healthcare practice
          </DialogDescription>
        </DialogHeader>

        {isLoadingPractice ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading practice information...</span>
          </div>
        ) : practiceError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>Failed to load practice information.</p>
                <p className="text-xs">Error: {practiceError.message}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : hasPractice ? (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-sm">To: {practiceData.practice!.name}</p>
              {practiceData.practice!.city && (
                <p className="text-sm text-muted-foreground">
                  {practiceData.practice!.city}, {practiceData.practice!.state}
                </p>
              )}
            </div>
          </div>
        ) : practiceData && !practiceData.practiceId ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No practice is assigned to this patient. Messages cannot be sent until a practice is assigned.
            </AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this message about?"
              maxLength={200}
              disabled={!hasPractice || sendMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={6}
              required
              className="resize-none"
              disabled={!hasPractice || sendMutation.isPending}
            />
            {hasPractice && (
              <p className="text-xs text-muted-foreground">
                This message will be sent securely to your practice and their staff
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSend}>
              {sendMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Message
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
