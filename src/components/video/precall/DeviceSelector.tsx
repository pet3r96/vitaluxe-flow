import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Video, Mic, Volume2 } from "lucide-react";

interface DeviceSelectorProps {
  deviceType: "camera" | "microphone" | "speaker";
  devices: MediaDeviceInfo[];
  selectedDevice: string | null;
  onSelect: (deviceId: string) => void;
  onTest?: () => void;
}

export function DeviceSelector({
  deviceType,
  devices,
  selectedDevice,
  onSelect,
  onTest,
}: DeviceSelectorProps) {
  const getIcon = () => {
    switch (deviceType) {
      case "camera":
        return <Video className="w-4 h-4" />;
      case "microphone":
        return <Mic className="w-4 h-4" />;
      case "speaker":
        return <Volume2 className="w-4 h-4" />;
    }
  };

  const getLabel = () => {
    switch (deviceType) {
      case "camera":
        return "Camera";
      case "microphone":
        return "Microphone";
      case "speaker":
        return "Speaker";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {getIcon()}
        {getLabel()}
      </Label>
      <div className="flex gap-2">
        <Select value={selectedDevice || undefined} onValueChange={onSelect}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={`Select ${deviceType}`} />
          </SelectTrigger>
          <SelectContent>
            {devices.length === 0 ? (
              <SelectItem value="none" disabled>
                No {deviceType}s found
              </SelectItem>
            ) : (
              devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `${getLabel()} ${device.deviceId.slice(0, 8)}`}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {onTest && (
          <Button variant="outline" size="sm" onClick={onTest}>
            Test
          </Button>
        )}
      </div>
    </div>
  );
}
