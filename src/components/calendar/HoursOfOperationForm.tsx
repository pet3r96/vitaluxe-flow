import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy } from "lucide-react";

interface HoursOfOperationFormProps {
  practiceId: string;
  currentSettings: {
    slot_duration: number;
    start_hour: number;
    end_hour: number;
    working_days: number[];
    buffer_time?: number;
    allow_overlap?: boolean;
  };
  onSuccess: () => void;
}

const DAYS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
  value: i,
}));

export function HoursOfOperationForm({ practiceId, currentSettings, onSuccess }: HoursOfOperationFormProps) {
  const [slotDuration, setSlotDuration] = useState(currentSettings.slot_duration);
  const [bufferTime, setBufferTime] = useState(currentSettings.buffer_time || 0);
  const [daySettings, setDaySettings] = useState<Record<number, { enabled: boolean; start: number; end: number }>>(
    DAYS.reduce((acc, day) => {
      acc[day.value] = {
        enabled: currentSettings.working_days.includes(day.value),
        start: currentSettings.start_hour,
        end: currentSettings.end_hour,
      };
      return acc;
    }, {} as Record<number, { enabled: boolean; start: number; end: number }>)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleDayToggle = (dayValue: number, enabled: boolean) => {
    setDaySettings((prev) => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], enabled },
    }));
  };

  const handleTimeChange = (dayValue: number, field: "start" | "end", value: number) => {
    setDaySettings((prev) => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], [field]: value },
    }));
  };

  const handleApplyToAll = () => {
    const firstEnabledDay = DAYS.find((day) => daySettings[day.value].enabled);
    if (!firstEnabledDay) {
      toast.error("Please enable at least one day first");
      return;
    }

    const template = daySettings[firstEnabledDay.value];
    setDaySettings((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        const dayValue = parseInt(key);
        if (updated[dayValue].enabled) {
          updated[dayValue] = { ...updated[dayValue], start: template.start, end: template.end };
        }
      });
      return updated;
    });
    toast.success("Hours applied to all enabled days");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const workingDays = DAYS.filter((day) => daySettings[day.value].enabled).map((day) => day.value);

      if (workingDays.length === 0) {
        toast.error("Please enable at least one working day");
        return;
      }

      // Calculate average start/end hours from enabled days
      const enabledDays = workingDays.map((d) => daySettings[d]);
      const avgStart = Math.round(enabledDays.reduce((sum, d) => sum + d.start, 0) / enabledDays.length);
      const avgEnd = Math.round(enabledDays.reduce((sum, d) => sum + d.end, 0) / enabledDays.length);

      // Prepare per-day settings for practice_calendar_hours
      const daySettingsPayload = DAYS.map((day) => ({
        dayOfWeek: day.value,
        enabled: daySettings[day.value].enabled,
        startTime: `${String(daySettings[day.value].start).padStart(2, '0')}:00:00`,
        endTime: `${String(daySettings[day.value].end).padStart(2, '0')}:00:00`,
      }));

      const { error } = await supabase.functions.invoke("update-appointment-settings", {
        body: {
          practiceId,
          slotDuration,
          startHour: avgStart,
          endHour: avgEnd,
          workingDays,
          bufferTime,
          allowOverlap: false,
          daySettings: daySettingsPayload,
        },
      });

      if (error) throw error;

      toast.success("Calendar settings updated successfully");
      onSuccess();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Slot Duration & Buffer Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Appointment Slot Duration</Label>
          <Select value={slotDuration.toString()} onValueChange={(v) => setSlotDuration(parseInt(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="45">45 minutes</SelectItem>
              <SelectItem value="60">60 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Buffer Time Between Appointments</Label>
          <Select value={bufferTime.toString()} onValueChange={(v) => setBufferTime(parseInt(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No buffer</SelectItem>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Days of the Week */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Working Days & Hours</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleApplyToAll}>
            <Copy className="h-4 w-4 mr-2" />
            Apply to All
          </Button>
        </div>

        <div className="space-y-3">
          {DAYS.map((day) => (
            <div key={day.value} className="flex items-center gap-4">
              <div className="flex items-center space-x-2 w-32">
                <Checkbox
                  checked={daySettings[day.value].enabled}
                  onCheckedChange={(checked) => handleDayToggle(day.value, checked as boolean)}
                />
                <Label className="font-normal">{day.label}</Label>
              </div>

              {daySettings[day.value].enabled && (
                <div className="flex items-center gap-2 flex-1">
                  <Select
                    value={daySettings[day.value].start.toString()}
                    onValueChange={(v) => handleTimeChange(day.value, "start", parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={hour.value.toString()}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-muted-foreground">to</span>

                  <Select
                    value={daySettings[day.value].end.toString()}
                    onValueChange={(v) => handleTimeChange(day.value, "end", parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={hour.value.toString()}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}