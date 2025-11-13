import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validatePhone } from "@/lib/validators";

interface AddRepRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddRepRequestDialog = ({ open, onOpenChange, onSuccess }: AddRepRequestDialogProps) => {
  const { user, effectiveRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({ phone: "" });
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: "",
    role: "downline", // Toplines can only add downlines under them
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.valid) {
        setValidationErrors({ phone: phoneResult.error || "" });
        toast.error("Please fix validation errors before submitting");
        return;
      }
    }

    // Security check: toplines can only add downlines
    if (effectiveRole === "topline" && formData.role !== "downline") {
      toast.error("Topline representatives can only request downline representatives");
      return;
    }
    
    setLoading(true);

    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // For downlines requesting downlines, they assign to their own topline
      let assigned_topline_user_id = null;
      if (formData.role === "downline") {
        if (effectiveRole === "topline") {
          // Topline requesting downline - assign to themselves
          assigned_topline_user_id = user.id;
        } else if (effectiveRole === "downline") {
          // Downline requesting downline - find their topline
          const { data: repData } = await supabase
            .from("reps")
            .select("assigned_topline_id")
            .eq("user_id", user.id)
            .eq("role", "downline")
            .maybeSingle();

          if (repData?.assigned_topline_id) {
            const { data: toplineRep } = await supabase
              .from("reps")
              .select("user_id")
              .eq("id", repData.assigned_topline_id)
              .maybeSingle();
            
            assigned_topline_user_id = toplineRep?.user_id || null;
          }
        }
      }

      const { error } = await supabase
        .from("pending_reps")
        .insert([{
          created_by_user_id: user.id,
          created_by_role: effectiveRole as any,
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone || null,
          company: formData.company || null,
          role: formData.role as any,
          assigned_topline_user_id: assigned_topline_user_id,
        }]);

      if (error) throw error;

      toast.success("Representative request submitted for admin approval");
      onSuccess?.();
      onOpenChange(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        company: "",
        role: "downline",
      });
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error submitting rep request", error);
      });
      toast.error(error.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request New Representative</DialogTitle>
          <DialogDescription>
            {effectiveRole === "topline" 
              ? "Submit a request for a new downline representative who will be assigned under you. An admin will review and approve it."
              : "Submit a request for a new downline representative. An admin will review and approve it."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone || ""}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                setFormData({ ...formData, phone: value });
                setValidationErrors({ ...validationErrors, phone: "" });
              }}
              onBlur={() => {
                if (formData.phone) {
                  const result = validatePhone(formData.phone);
                  setValidationErrors({ ...validationErrors, phone: result.error || "" });
                }
              }}
              placeholder="1234567890"
              maxLength={10}
              className={validationErrors.phone ? "border-destructive" : ""}
            />
            {validationErrors.phone && (
              <p className="text-sm text-destructive">{validationErrors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};