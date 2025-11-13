import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useCreatePatientNote } from "@/hooks/usePatientNotes";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CreatePatientNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
}

export function CreatePatientNoteDialog({ 
  open, 
  onOpenChange, 
  patientAccountId 
}: CreatePatientNoteDialogProps) {
  const [noteContent, setNoteContent] = useState("");
  const [shareWithPatient, setShareWithPatient] = useState(false);
  const { user, effectiveRole } = useAuth();
  const createNote = useCreatePatientNote();

  const handleSubmit = async () => {
    if (!noteContent.trim()) {
      return;
    }

    if (noteContent.length > 10000) {
      return;
    }

    if (!user?.id || !effectiveRole) {
      return;
    }

    // Fetch user's full name from profiles table
    let userName = 'Unknown User';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      userName = profile?.full_name || user.email || 'Unknown User';
    } catch (error) {
      console.error('Error fetching user profile:', error);
      userName = user.email || 'Unknown User';
    }

    await createNote.mutateAsync({
      patient_account_id: patientAccountId,
      note_content: noteContent.trim(),
      created_by_user_id: user.id,
      created_by_role: effectiveRole,
      created_by_name: userName,
      share_with_patient: shareWithPatient,
    });

    // Reset form and close dialog
    setNoteContent("");
    setShareWithPatient(false);
    onOpenChange(false);
  };

  const characterCount = noteContent.length;
  const isNearLimit = characterCount >= 9500;
  const isOverLimit = characterCount > 10000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Patient Note</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-content">Note Content *</Label>
            <Textarea
              id="note-content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter your note about this patient..."
              className="min-h-[200px] resize-y"
              disabled={createNote.isPending}
            />
            <div className="flex justify-between items-center text-sm">
              <span className={`${isNearLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {characterCount.toLocaleString()} / 10,000 characters
                {isNearLimit && !isOverLimit && " (approaching limit)"}
                {isOverLimit && " (over limit!)"}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="share-with-patient"
              checked={shareWithPatient}
              onCheckedChange={(checked) => setShareWithPatient(checked as boolean)}
              disabled={createNote.isPending}
            />
            <Label
              htmlFor="share-with-patient"
              className="text-sm font-normal cursor-pointer"
            >
              Share this note with the patient
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            If checked, the patient will be able to view this note in their medical vault.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createNote.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!noteContent.trim() || isOverLimit || createNote.isPending}
          >
            {createNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
