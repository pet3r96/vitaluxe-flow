import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdatePatientNote, PatientNote } from "@/hooks/usePatientNotes";
import { Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface EditPatientNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: PatientNote | null;
}

export function EditPatientNoteDialog({ 
  open, 
  onOpenChange, 
  note 
}: EditPatientNoteDialogProps) {
  const [noteContent, setNoteContent] = useState("");
  const [shareWithPatient, setShareWithPatient] = useState(false);
  const [showShareWarning, setShowShareWarning] = useState(false);
  const [showUnshareWarning, setShowUnshareWarning] = useState(false);
  const { user } = useAuth();
  const updateNote = useUpdatePatientNote();

  useEffect(() => {
    if (note) {
      setNoteContent(note.note_content);
      setShareWithPatient(note.share_with_patient);
      setShowShareWarning(false);
      setShowUnshareWarning(false);
    }
  }, [note]);

  const handleShareChange = (checked: boolean) => {
    if (!note) return;
    
    // Changing from private to shared
    if (checked && !note.share_with_patient) {
      setShowShareWarning(true);
      setShareWithPatient(checked);
    }
    // Changing from shared to private
    else if (!checked && note.share_with_patient) {
      setShowUnshareWarning(true);
      setShareWithPatient(checked);
    } else {
      setShareWithPatient(checked);
    }
  };

  const handleSubmit = async () => {
    if (!note || !noteContent.trim() || !user?.id) {
      return;
    }

    if (noteContent.length > 10000) {
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

    await updateNote.mutateAsync({
      id: note.id,
      note_content: noteContent.trim(),
      share_with_patient: shareWithPatient,
      last_edited_by_user_id: user.id,
      last_edited_by_name: userName,
    });

    onOpenChange(false);
  };

  if (!note) return null;

  const characterCount = noteContent.length;
  const isNearLimit = characterCount >= 9500;
  const isOverLimit = characterCount > 10000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Patient Note</DialogTitle>
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
              disabled={updateNote.isPending}
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
              onCheckedChange={handleShareChange}
              disabled={updateNote.isPending}
            />
            <Label
              htmlFor="share-with-patient"
              className="text-sm font-normal cursor-pointer"
            >
              Share this note with the patient
            </Label>
          </div>

          {showShareWarning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You're about to share this note with the patient. They will be able to view it in their medical vault.
              </AlertDescription>
            </Alert>
          )}

          {showUnshareWarning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You're about to make this note private. The patient will no longer be able to view it.
              </AlertDescription>
            </Alert>
          )}

          {note.last_edited_by_name && (
            <p className="text-xs text-muted-foreground">
              Last edited by {note.last_edited_by_name} on {format(new Date(note.updated_at), 'MMM dd, yyyy h:mm a')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateNote.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!noteContent.trim() || isOverLimit || updateNote.isPending}
          >
            {updateNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
