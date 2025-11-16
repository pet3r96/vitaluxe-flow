import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSharedPatientNotes } from "@/hooks/usePatientNotes";
import { Share2, Loader2, FileText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SharedNotesSectionProps {
  patientAccountId: string;
}

export function SharedNotesSection({ patientAccountId }: SharedNotesSectionProps) {
  const { data: sharedNotes = [], isLoading } = useSharedPatientNotes(patientAccountId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Notes from Your Care Team
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sharedNotes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Notes from Your Care Team
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            No shared notes yet. Your care team hasn't shared any notes with you.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Notes from Your Care Team
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Your care team has shared the following notes with you
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sharedNotes.map((note) => (
          <div key={note.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{note.created_by_name}</p>
                  <Badge variant="outline" className="text-xs">
                    {note.created_by_role}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(note.created_at), 'MMM dd, yyyy h:mm a')}
                  {' • '}
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  {note.last_edited_by_name && (
                    <>
                      {' • '}
                      Edited by {note.last_edited_by_name}
                    </>
                  )}
                </p>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-3">{note.note_content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
