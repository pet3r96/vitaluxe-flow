import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format, addDays, addWeeks, addMonths, startOfWeek, startOfMonth, startOfDay } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export type CalendarView = 'day' | 'week' | 'week-provider' | 'month' | 'agenda';

interface CalendarHeaderProps {
  currentDate: Date;
  view: CalendarView;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  filtersOpen?: boolean;
  onFiltersOpenChange?: (open: boolean) => void;
  filterCount?: number;
}

export function CalendarHeader({ 
  currentDate, 
  view, 
  onDateChange, 
  onViewChange,
  filtersOpen,
  onFiltersOpenChange,
  filterCount = 0
}: CalendarHeaderProps) {
  const getDateDisplay = () => {
    switch (view) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
      case 'week-provider':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = addDays(weekStart, 6);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'agenda':
        return format(currentDate, 'MMMM yyyy');
      default:
        return '';
    }
  };

  const handlePrevious = () => {
    switch (view) {
      case 'day':
        onDateChange(addDays(currentDate, -1));
        break;
      case 'week':
      case 'week-provider':
        onDateChange(addWeeks(currentDate, -1));
        break;
      case 'month':
      case 'agenda':
        onDateChange(addMonths(currentDate, -1));
        break;
    }
  };

  const handleNext = () => {
    switch (view) {
      case 'day':
        onDateChange(addDays(currentDate, 1));
        break;
      case 'week':
      case 'week-provider':
        onDateChange(addWeeks(currentDate, 1));
        break;
      case 'month':
      case 'agenda':
        onDateChange(addMonths(currentDate, 1));
        break;
    }
  };

  const handleToday = () => {
    onDateChange(startOfDay(new Date()));
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleToday}>
          Today
        </Button>
        <Button variant="ghost" size="icon" onClick={handlePrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[220px] font-semibold">
              {getDateDisplay()}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => date && onDateChange(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Segmented View Switcher */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
        <Button 
          variant={view === 'day' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('day')}
          className="text-xs"
        >
          Day
        </Button>
        <Button 
          variant={view === 'week' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('week')}
          className="text-xs"
        >
          Week (Time)
        </Button>
        <Button 
          variant={view === 'week-provider' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('week-provider')}
          className="text-xs"
        >
          Week (Provider)
        </Button>
        <Button 
          variant={view === 'month' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('month')}
          className="text-xs"
        >
          Month
        </Button>
        <Button 
          variant={view === 'agenda' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('agenda')}
          className="text-xs"
        >
          Agenda
        </Button>
      </div>
    </div>
  );
}
