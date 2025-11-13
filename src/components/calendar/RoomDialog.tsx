import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  room?: any;
  onSuccess: () => void;
}

const DEFAULT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

export function RoomDialog({ open, onOpenChange, practiceId, room, onSuccess }: RoomDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [capacity, setCapacity] = useState(1);
  const [active, setActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (room) {
      setName(room.name || "");
      setDescription(room.description || "");
      setColor(room.color || "#3B82F6");
      setCapacity(room.capacity || 1);
      setActive(room.active !== undefined ? room.active : true);
    } else {
      setName("");
      setDescription("");
      setColor("#3B82F6");
      setCapacity(1);
      setActive(true);
    }
  }, [room, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Room name is required");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-practice-room", {
        body: {
          action: room ? "update" : "create",
          practiceId,
          roomId: room?.id,
          name: name.trim(),
          description: description.trim() || null,
          color,
          capacity,
          active,
        },
      });

      if (error) throw error;

      toast.success(room ? "Room updated successfully" : "Room created successfully");
      onSuccess();
    } catch (error: any) {
      console.error("Error saving room:", error);
      toast.error(error.message || "Failed to save room");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{room ? "Edit Room" : "Add Room"}</DialogTitle>
          <DialogDescription>
            {room ? "Update room details" : "Create a new room for scheduling appointments"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Room 1, Treatment Room A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional room description"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded border-2 ${color === c ? "border-primary" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-8 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Active</Label>
            <Switch id="active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : room ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}