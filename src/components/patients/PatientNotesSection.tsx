import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePatientNotes, useDeletePatientNote, PatientNote } from "@/hooks/usePatientNotes";
import { CreatePatientNoteDialog } from "./CreatePatientNoteDialog";
import { EditPatientNoteDialog } from "./EditPatientNoteDialog";
import { Plus, Search, Edit, Trash2, Share2, Lock, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface PatientNotesSectionProps {
  patientAccountId: string;
  patientName?: string;
}

export function PatientNotesSection({ patientAccountId, patientName }: PatientNotesSectionProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<PatientNote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'shared' | 'private'>('all');
  
  const { data: notes = [], isLoading } = usePatientNotes(patientAccountId);
  const deleteNote = useDeletePatientNote();
  const { user } = useAuth();

  // Filter notes based on search and filter type
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.note_content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filterType === 'all' ? true :
      filterType === 'shared' ? note.share_with_patient :
      !note.share_with_patient;
    return matchesSearch && matchesFilter;
  });

  const handleEdit = (note: PatientNote) => {
    setSelectedNote(note);
    setEditDialogOpen(true);
  };

  const handleDelete = (note: PatientNote) => {
    setSelectedNote(note);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedNote) return;
    await deleteNote.mutateAsync({
      id: selectedNote.id,
      patientAccountId: patientAccountId,
    });
    setDeleteDialogOpen(false);
    setSelectedNote(null);
  };

  const canEditNote = (note: PatientNote) => {
    return user?.id === note.created_by_user_id;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Patient Notes</h2>
          <p className="text-sm text-muted-foreground">
            Manage notes for {patientName || 'this patient'}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter notes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Notes</SelectItem>
            <SelectItem value="shared">Shared Only</SelectItem>
            <SelectItem value="private">Private Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery || filterType !== 'all' 
                ? 'No notes match your search criteria.' 
                : 'No notes yet. Add your first note to track patient information.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">
                        {note.created_by_name}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {note.created_by_role}
                      </Badge>
                      {note.share_with_patient ? (
                        <Badge variant="default" className="text-xs">
                          <Share2 className="h-3 w-3 mr-1" />
                          Shared with Patient
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Private to Practice
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      {note.last_edited_by_name && (
                        <span className="ml-2">
                          • Edited by {note.last_edited_by_name}
                        </span>
                      )}
                    </p>
                  </div>
                  {canEditNote(note) && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(note)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(note)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{note.note_content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <CreatePatientNoteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        patientAccountId={patientAccountId}
      />

      <EditPatientNoteDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        note={selectedNote}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
              {selectedNote?.share_with_patient && (
                <span className="block mt-2 text-destructive">
                  This note is currently shared with the patient and will be removed from their view.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
