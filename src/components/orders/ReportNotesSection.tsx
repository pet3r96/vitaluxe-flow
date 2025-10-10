import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ReportNotesSectionProps {
  orderId: string;
  initialNotes: string | null;
  doctorId: string;
  onSuccess: () => void;
}

export const ReportNotesSection = ({
  orderId,
  initialNotes,
  doctorId,
  onSuccess,
}: ReportNotesSectionProps) => {
  const [notes, setNotes] = useState(initialNotes || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { effectiveRole, effectiveUserId } = useAuth();

  const canEdit = effectiveRole === 'admin' || effectiveUserId === doctorId;

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ report_notes: notes })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Notes Saved",
        description: "Report notes have been updated successfully.",
      });

      setIsEditing(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error saving notes:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(initialNotes || "");
    setIsEditing(false);
  };

  if (!canEdit && !initialNotes) {
    return null;
  }

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" />
          Internal Report Notes
        </Label>
        {!isEditing && canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        For Admin/Practice view only. Document order summaries, special notes, or reporting details.
      </p>

      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter internal notes, summaries, or reporting details..."
            rows={6}
            className="resize-none"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Notes"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              size="sm"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-foreground whitespace-pre-wrap p-3 bg-background rounded border border-border min-h-[100px]">
          {notes || <span className="text-muted-foreground italic">No notes added yet.</span>}
        </div>
      )}
    </div>
  );
};
