import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface Provider {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  specialty?: string;
}

interface Room {
  id: string;
  name: string;
  color: string;
}

interface CalendarFiltersProps {
  providers: Provider[];
  rooms: Room[];
  selectedProviders: string[];
  selectedRooms: string[];
  selectedStatuses: string[];
  onProviderToggle: (providerId: string) => void;
  onRoomToggle: (roomId: string) => void;
  onStatusToggle: (status: string) => void;
  isProviderView?: boolean;
}

const appointmentStatuses = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-500' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
  { value: 'no_show', label: 'No Show', color: 'bg-orange-500' },
];

export function CalendarFilters({
  providers,
  rooms,
  selectedProviders,
  selectedRooms,
  selectedStatuses,
  onProviderToggle,
  onRoomToggle,
  onStatusToggle,
  isProviderView = false,
}: CalendarFiltersProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Providers Filter - Hidden for provider view */}
        {!isProviderView && (
          <>
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Providers</Label>
              {providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No providers found</p>
              ) : (
                <div className="space-y-2">
                  {providers.map((provider) => (
                    <div key={provider.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`provider-${provider.id}`}
                        checked={selectedProviders.includes(provider.id)}
                        onCheckedChange={() => onProviderToggle(provider.id)}
                      />
                      <Label
                        htmlFor={`provider-${provider.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {provider.full_name || `${provider.first_name} ${provider.last_name}`}
                        {provider.specialty && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({provider.specialty})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />
          </>
        )}

        {/* Rooms Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Rooms</Label>
          {rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rooms configured</p>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <div key={room.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`room-${room.id}`}
                    checked={selectedRooms.includes(room.id)}
                    onCheckedChange={() => onRoomToggle(room.id)}
                  />
                  <Label
                    htmlFor={`room-${room.id}`}
                    className="text-sm font-normal cursor-pointer flex-1 flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: room.color }}
                    />
                    {room.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Status Filter */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Status</Label>
          <div className="space-y-2">
            {appointmentStatuses.map((status) => (
              <div key={status.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status.value}`}
                  checked={selectedStatuses.includes(status.value)}
                  onCheckedChange={() => onStatusToggle(status.value)}
                />
                <Label
                  htmlFor={`status-${status.value}`}
                  className="text-sm font-normal cursor-pointer flex-1 flex items-center gap-2"
                >
                  <div className={`w-3 h-3 rounded-full ${status.color}`} />
                  {status.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Active Filters Summary */}
        {(selectedProviders.length > 0 || selectedRooms.length > 0 || selectedStatuses.length > 0) && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Active Filters</Label>
              <div className="flex flex-wrap gap-1">
                {selectedProviders.length > 0 && (
                  <Badge variant="secondary">{selectedProviders.length} Providers</Badge>
                )}
                {selectedRooms.length > 0 && (
                  <Badge variant="secondary">{selectedRooms.length} Rooms</Badge>
                )}
                {selectedStatuses.length > 0 && (
                  <Badge variant="secondary">{selectedStatuses.length} Statuses</Badge>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
