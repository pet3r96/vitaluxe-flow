import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Clock, User, MapPin, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProviderAvatar } from "./ProviderAvatar";
import { cn } from "@/lib/utils";

interface AppointmentSearchResultsProps {
  results: any[];
  onSelect: (appointment: any) => void;
  query: string;
  maxInitialResults?: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-400 text-yellow-950',
  scheduled: 'bg-sky-400 text-white',
  confirmed: 'bg-emerald-400 text-white',
  checked_in: 'bg-amber-400 text-white',
  being_treated: 'bg-purple-500 text-white',
  completed: 'bg-gray-400 text-white',
  cancelled: 'bg-red-400 text-white',
  no_show: 'bg-orange-400 text-white',
};

export function AppointmentSearchResults({
  results,
  onSelect,
  query,
  maxInitialResults = 8
}: AppointmentSearchResultsProps) {
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const displayedResults = showAll ? results : results.slice(0, maxInitialResults);
  const hasMore = results.length > maxInitialResults;

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
    setShowAll(false);
  }, [query, results.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => 
            prev < displayedResults.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (displayedResults[selectedIndex]) {
            onSelect(displayedResults[selectedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results.length, displayedResults, selectedIndex, onSelect]);

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  }, [selectedIndex]);

  if (results.length === 0) {
    return (
      <div className="p-8 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium text-muted-foreground">
          No appointments found
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Try a different search term
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground">
          Found {results.length} appointment{results.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ScrollArea className="flex-1" ref={resultsRef}>
        <div className="p-2 space-y-1">
          {displayedResults.map((appointment, index) => {
            const patientName = `${appointment.patient_accounts?.first_name} ${appointment.patient_accounts?.last_name}`;
            const providerName = appointment.providers
              ? `${appointment.providers.first_name} ${appointment.providers.last_name}`
              : null;
            const appointmentDate = new Date(appointment.start_time);
            const isToday = appointmentDate.toDateString() === new Date().toDateString();
            const isPast = appointmentDate < new Date();
            const statusColor = statusColors[appointment.status] || statusColors.scheduled;

            return (
              <div
                key={appointment.id}
                ref={(el) => (itemRefs.current[index] = el)}
                onClick={() => onSelect(appointment)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  "group rounded-lg p-3 cursor-pointer transition-all",
                  "hover:bg-accent hover:shadow-sm",
                  selectedIndex === index && "bg-accent shadow-sm ring-2 ring-primary/20"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Provider Avatar */}
                  {appointment.providers && (
                    <div className="shrink-0 mt-0.5">
                      <ProviderAvatar provider={appointment.providers} size="sm" />
                    </div>
                  )}

                  {/* Appointment Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Patient Name */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm truncate">
                        {patientName}
                      </h4>
                      <Badge 
                        className={cn("text-xs shrink-0", statusColor)}
                        variant="secondary"
                      >
                        {appointment.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className={cn(
                        "font-medium",
                        isToday && "text-primary",
                        isPast && !isToday && "text-muted-foreground/60"
                      )}>
                        {isToday ? 'Today' : format(appointmentDate, 'MMM d, yyyy')}
                      </span>
                      <span>•</span>
                      <span>{format(appointmentDate, 'h:mm a')}</span>
                    </div>

                    {/* Provider & Room */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {providerName && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate">{providerName}</span>
                        </div>
                      )}
                      {appointment.practice_rooms && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{appointment.practice_rooms.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Arrow Icon */}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Show More Button */}
        {hasMore && !showAll && (
          <div className="p-2 pt-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(true);
              }}
            >
              Show {results.length - maxInitialResults} more results
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Keyboard Hints */}
      <div className="px-4 py-2 border-t bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Use ↑↓ to navigate</span>
          <span>Press Enter to open</span>
        </div>
      </div>
    </div>
  );
}