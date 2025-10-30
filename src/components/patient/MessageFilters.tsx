import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface MessageFiltersState {
  status: 'all' | 'open' | 'resolved';
  readStatus: 'all' | 'unread' | 'read';
  urgency: 'all' | 'normal' | 'urgent';
}

interface MessageFiltersProps {
  filters: MessageFiltersState;
  onFiltersChange: (filters: MessageFiltersState) => void;
}

export function MessageFilters({ filters, onFiltersChange }: MessageFiltersProps) {
  const hasActiveFilters = filters.status !== 'all' || filters.readStatus !== 'all' || filters.urgency !== 'all';

  const resetFilters = () => {
    onFiltersChange({
      status: 'all',
      readStatus: 'all',
      urgency: 'all',
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-wrap gap-2 flex-1">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <div className="flex gap-1">
                <Badge
                  variant={filters.status === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, status: 'all' })}
                >
                  All
                </Badge>
                <Badge
                  variant={filters.status === 'open' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, status: 'open' })}
                >
                  Open
                </Badge>
                <Badge
                  variant={filters.status === 'resolved' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, status: 'resolved' })}
                >
                  Resolved
                </Badge>
              </div>
            </div>

            {/* Read Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Read:</span>
              <div className="flex gap-1">
                <Badge
                  variant={filters.readStatus === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, readStatus: 'all' })}
                >
                  All
                </Badge>
                <Badge
                  variant={filters.readStatus === 'unread' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, readStatus: 'unread' })}
                >
                  Unread
                </Badge>
                <Badge
                  variant={filters.readStatus === 'read' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, readStatus: 'read' })}
                >
                  Read
                </Badge>
              </div>
            </div>

            {/* Urgency Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Urgency:</span>
              <div className="flex gap-1">
                <Badge
                  variant={filters.urgency === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, urgency: 'all' })}
                >
                  All
                </Badge>
                <Badge
                  variant={filters.urgency === 'normal' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, urgency: 'normal' })}
                >
                  Normal
                </Badge>
                <Badge
                  variant={filters.urgency === 'urgent' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => onFiltersChange({ ...filters, urgency: 'urgent' })}
                >
                  Urgent
                </Badge>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
