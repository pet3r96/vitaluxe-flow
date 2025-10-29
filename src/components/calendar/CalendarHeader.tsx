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

export type CalendarView = 'day' | 'week' | 'month' | 'agenda';

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
        {onFiltersOpenChange && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onFiltersOpenChange(!filtersOpen)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {filterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filterCount}
              </Badge>
            )}
          </Button>
        )}
        
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
            <Button variant="outline" className="min-w-[200px]">
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

      <Select value={view} onValueChange={(v) => onViewChange(v as CalendarView)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Day</SelectItem>
          <SelectItem value="week">Week</SelectItem>
          <SelectItem value="month">Month</SelectItem>
          <SelectItem value="agenda">Agenda</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
