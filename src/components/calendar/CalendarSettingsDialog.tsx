import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoursOfOperationForm } from "./HoursOfOperationForm";
import { RoomsManagerTable } from "./RoomsManagerTable";
import { CalendarSyncManager } from "./CalendarSyncManager";
import { useAuth } from "@/contexts/AuthContext";

interface CalendarSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  currentSettings: {
    slot_duration: number;
    start_hour: number;
    end_hour: number;
    working_days: number[];
    buffer_time?: number;
    allow_overlap?: boolean;
  };
  onSettingsUpdate: () => void;
}

export function CalendarSettingsDialog({
  open,
  onOpenChange,
  practiceId,
  currentSettings,
  onSettingsUpdate,
}: CalendarSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("hours");
  const { user } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
          <DialogDescription>
            Configure your practice calendar hours, rooms, and preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hours">Hours of Operation</TabsTrigger>
            <TabsTrigger value="rooms">Rooms Manager</TabsTrigger>
            <TabsTrigger value="sync">Calendar Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="hours" className="space-y-4">
            <HoursOfOperationForm
              practiceId={practiceId}
              currentSettings={currentSettings}
              onSuccess={() => {
                onSettingsUpdate();
                onOpenChange(false);
              }}
            />
          </TabsContent>

          <TabsContent value="rooms" className="space-y-4">
            <RoomsManagerTable practiceId={practiceId} />
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <CalendarSyncManager 
              practiceId={practiceId} 
              userId={user?.id || ""} 
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}