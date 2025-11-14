import { useState } from "react";
import { X, ChevronDown, ChevronRight, Calendar as CalendarIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MiniCalendar } from "./MiniCalendar";
import { ProviderAvatar } from "./ProviderAvatar";
import { AppointmentSearchInput } from "./AppointmentSearchInput";
import { AppointmentSearchResults } from "./AppointmentSearchResults";
import { AppointmentsList } from "./AppointmentsList";
import { useAppointmentSearch } from "@/hooks/useAppointmentSearch";
import { cn } from "@/lib/utils";
import { getProviderDisplayName } from "@/utils/providerNameUtils";

interface CalendarSidebarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  providers: any[];
  rooms: any[];
  selectedProviders: string[];
  selectedRooms: string[];
  selectedStatuses: string[];
  onProviderToggle: (id: string) => void;
  onRoomToggle: (id: string) => void;
  onStatusToggle: (status: string) => void;
  appointments?: any[];
  isOpen: boolean;
  onClose: () => void;
  onAppointmentSelect?: (appointment: any) => void;
  defaultTab?: 'appointments' | 'filters';
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-emerald-500' },
  { value: 'checked_in', label: 'Checked In', color: 'bg-amber-500' },
  { value: 'being_treated', label: 'Being Treated', color: 'bg-purple-500' },
  { value: 'completed', label: 'Completed', color: 'bg-gray-500' },
];

export function CalendarSidebar({
  currentDate,
  onDateChange,
  providers,
  rooms,
  selectedProviders,
  selectedRooms,
  selectedStatuses,
  onProviderToggle,
  onRoomToggle,
  onStatusToggle,
  appointments = [],
  isOpen,
  onClose,
  onAppointmentSelect,
  defaultTab = 'appointments'
}: CalendarSidebarProps) {
  const [providersExpanded, setProvidersExpanded] = useState(true);
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [statusesExpanded, setStatusesExpanded] = useState(false);

  // Search functionality
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    handleSearchSubmit
  } = useAppointmentSearch({
    appointments,
    maxResults: 20,
    debounceMs: 300
  });

  const handleSearchResultClick = (appointment: any) => {
    if (onAppointmentSelect) {
      onAppointmentSelect(appointment);
      // On mobile, close sidebar after selection
      if (window.innerWidth < 1024) {
        onClose();
      }
    }
  };

  const todayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.start_time);
    const today = new Date();
    return aptDate.toDateString() === today.toDateString() &&
           apt.status !== 'cancelled' && 
           apt.status !== 'no_show';
  });

  const pendingCount = appointments.filter(apt => 
    apt.status === 'pending' && apt.confirmation_type === 'pending'
  ).length;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div 
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-50 w-[300px] sm:w-[320px] bg-card border-r flex flex-col transition-transform duration-300 lg:translate-x-0 shadow-lg lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-background/95 backdrop-blur">
          <h2 className="font-semibold text-base sm:text-lg">My Appointments</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs for Appointments vs Filters */}
        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-3 sm:mx-4 mt-3 sm:mt-4 grid w-auto grid-cols-2">
            <TabsTrigger value="appointments" className="text-xs sm:text-sm">Appointments</TabsTrigger>
            <TabsTrigger value="filters" className="text-xs sm:text-sm">
              <Filter className="h-3 w-3 mr-1" />
              Filters
            </TabsTrigger>
          </TabsList>

          {/* Appointments List Tab */}
          <TabsContent value="appointments" className="flex-1 overflow-hidden mt-0">
            <AppointmentsList
              appointments={appointments}
              currentDate={currentDate}
              onAppointmentClick={handleSearchResultClick}
              selectedAppointmentId={undefined}
            />
          </TabsContent>

          {/* Filters Tab */}
          <TabsContent value="filters" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
            {/* Search Section */}
            <div>
              <AppointmentSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={handleSearchSubmit}
              />
            </div>

            {isSearching ? (
              /* Search Results View */
              <div className="h-[calc(100vh-250px)] -mx-4 -mb-6">
                <AppointmentSearchResults
                  results={searchResults}
                  onSelect={handleSearchResultClick}
                  query={searchQuery}
                  maxInitialResults={8}
                />
              </div>
            ) : (
              /* Normal Sidebar View */
              <>
                {/* Mini Calendar */}
                <div>
                  <MiniCalendar
                    currentDate={currentDate}
                    onDateChange={onDateChange}
                    appointments={appointments}
                  />
                </div>

                <Separator />

                {/* Quick Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Today</span>
                <Badge variant="secondary" className="font-semibold">
                  {todayAppointments.length}
                </Badge>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending</span>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 font-semibold">
                    {pendingCount}
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Providers & Staff */}
            <div>
              <button
                onClick={() => setProvidersExpanded(!providersExpanded)}
                className="w-full flex items-center justify-between text-sm font-semibold mb-3 hover:text-primary transition-colors"
              >
                <span>Providers & Staff ({selectedProviders.length}/{providers.length})</span>
                {providersExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {providersExpanded && (
                <div className="space-y-2">
                  {providers.map((provider) => (
                    <div key={provider.id} className="flex items-center gap-2 group">
                      <Checkbox
                        id={`provider-${provider.id}`}
                        checked={selectedProviders.includes(provider.id)}
                        onCheckedChange={() => onProviderToggle(provider.id)}
                      />
                      <label
                        htmlFor={`provider-${provider.id}`}
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                      >
                        <ProviderAvatar provider={provider} size="sm" />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {getProviderDisplayName(provider)}
                            </div>
                            {provider.specialty && (
                              <div className="text-xs text-muted-foreground truncate">
                                {provider.specialty}
                              </div>
                            )}
                          </div>
                          <Badge 
                            variant={provider.type === 'provider' ? 'default' : 'secondary'} 
                            className="text-xs shrink-0"
                          >
                            {provider.type === 'provider' ? 'Provider' : 'Staff'}
                          </Badge>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rooms */}
            {rooms.length > 0 && (
              <>
                <Separator />
                <div>
                  <button
                    onClick={() => setRoomsExpanded(!roomsExpanded)}
                    className="w-full flex items-center justify-between text-sm font-semibold mb-3 hover:text-primary transition-colors"
                  >
                    <span>Rooms ({selectedRooms.length}/{rooms.length})</span>
                    {roomsExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  
                  {roomsExpanded && (
                    <div className="space-y-2">
                      {rooms.map((room) => (
                        <div key={room.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`room-${room.id}`}
                            checked={selectedRooms.includes(room.id)}
                            onCheckedChange={() => onRoomToggle(room.id)}
                          />
                          <label
                            htmlFor={`room-${room.id}`}
                            className="text-sm flex-1 cursor-pointer"
                          >
                            {room.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Status Filters */}
            <Separator />
            <div>
              <button
                onClick={() => setStatusesExpanded(!statusesExpanded)}
                className="w-full flex items-center justify-between text-sm font-semibold mb-3 hover:text-primary transition-colors"
              >
                <span>Status ({selectedStatuses.length})</span>
                {statusesExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {statusesExpanded && (
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((status) => (
                    <div key={status.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`status-${status.value}`}
                        checked={selectedStatuses.includes(status.value)}
                        onCheckedChange={() => onStatusToggle(status.value)}
                      />
                      <label
                        htmlFor={`status-${status.value}`}
                        className="text-sm flex-1 cursor-pointer flex items-center gap-2"
                      >
                        <div className={cn("h-2 w-2 rounded-full", status.color)} />
                        {status.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
