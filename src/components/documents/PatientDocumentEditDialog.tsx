import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logMedicalVaultChange } from "@/hooks/useAuditLogs";

interface PatientDocumentEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    id: string;
    document_name: string;
    document_type: string;
    notes?: string | null;
    share_with_practice?: boolean;
    source: string;
  };
  onSuccess: () => void;
}

export function PatientDocumentEditDialog({
  open,
  onOpenChange,
  document,
  onSuccess,
}: PatientDocumentEditDialogProps) {
  const [notes, setNotes] = useState(document.notes || "");
  const [shareWithPractice, setShareWithPractice] = useState(document.share_with_practice ?? true);
  const [saving, setSaving] = useState(false);

const handleSave = async () => {
  setSaving(true);
  try {
    const prevNotes = document.notes || null;
    const prevShare = document.share_with_practice ?? true;

    const { error } = await supabase
      .from("patient_documents")
      .update({
        notes,
        share_with_practice: shareWithPractice,
      } as any)
      .eq("id", document.id);

    if (error) throw error;

    // Fetch patient_id for audit logging
    const { data: pd, error: pdError } = await supabase
      .from('patient_documents')
      .select('patient_id')
      .eq('id', document.id)
      .maybeSingle();

    if (!pdError && pd?.patient_id) {
      const { data: userRes } = await supabase.auth.getUser();
      await logMedicalVaultChange({
        patientAccountId: pd.patient_id,
        actionType: 'updated',
        entityType: 'document',
        entityId: document.id,
        entityName: document.document_name,
        changedByUserId: userRes?.user?.id,
        changedByRole: 'patient',
        oldData: { notes: prevNotes, share_with_practice: prevShare },
        newData: { notes, share_with_practice: shareWithPractice },
        changeSummary: 'Updated document notes/sharing',
      });
    }

    toast({
      title: "Document Updated",
      description: "Your document has been updated successfully.",
    });

    onSuccess();
    onOpenChange(false);
  } catch (error: any) {
    toast({
      title: "Update Failed",
      description: error.message || "Could not update document",
      variant: "destructive",
    });
  } finally {
    setSaving(false);
  }
};

  if (document.source === 'provider_assigned') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Edit Document</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This document was uploaded by your practice and cannot be edited. If you need to hide it from your view, you can use the "Hide" option.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Document Name</Label>
            <Input value={document.document_name} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">Document name cannot be changed</p>
          </div>

          <div>
            <Label>Document Type</Label>
            <Input 
              value={document.document_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} 
              disabled 
              className="bg-muted" 
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this document..."
              rows={4}
            />
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="share"
              checked={shareWithPractice}
              onCheckedChange={(checked) => setShareWithPractice(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="share"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Share with Practice
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, your healthcare providers and staff can view this document. Uncheck to keep it private.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
