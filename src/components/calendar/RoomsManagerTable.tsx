import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RoomDialog } from "./RoomDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoomsManagerTableProps {
  practiceId: string;
}

export function RoomsManagerTable({ practiceId }: RoomsManagerTableProps) {
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  const { data: rooms, isLoading, refetch } = useQuery({
    queryKey: ["practice-rooms", practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_rooms")
        .select("*")
        .eq("practice_id", practiceId)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("rooms-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "practice_rooms",
          filter: `practice_id=eq.${practiceId}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, refetch]);

  const handleEdit = (room: any) => {
    setSelectedRoom(room);
    setRoomDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedRoom(null);
    setRoomDialogOpen(true);
  };

  const handleDeleteClick = (roomId: string) => {
    setRoomToDelete(roomId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roomToDelete) return;

    try {
      const { error } = await supabase.functions.invoke("manage-practice-room", {
        body: {
          action: "delete",
          practiceId,
          roomId: roomToDelete,
        },
      });

      if (error) throw error;

      toast.success("Room deleted successfully");
      refetch();
    } catch (error: any) {
      console.error("Error deleting room:", error);
      toast.error(error.message || "Failed to delete room");
    } finally {
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading rooms...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Manage rooms for scheduling appointments
        </p>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms && rooms.length > 0 ? (
              rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {room.description || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: room.color }}
                      />
                      <span className="text-xs text-muted-foreground">{room.color}</span>
                    </div>
                  </TableCell>
                  <TableCell>{room.capacity || 1}</TableCell>
                  <TableCell>
                    <Badge variant={room.active ? "default" : "secondary"}>
                      {room.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(room)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(room.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No rooms configured. Click "Add Room" to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <RoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        practiceId={practiceId}
        room={selectedRoom}
        onSuccess={() => {
          refetch();
          setRoomDialogOpen(false);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room? This action cannot be undone.
              Any appointments assigned to this room will have their room assignment removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}