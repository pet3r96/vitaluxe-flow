import { Badge } from "@/components/ui/badge";

interface RefillFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = [
  { id: "all", label: "All Prescriptions" },
  { id: "eligible", label: "Eligible for Refill" },
  { id: "expiring", label: "Expiring Soon" },
  { id: "recent", label: "Recently Ordered" },
];

export function RefillFilters({ activeFilter, onFilterChange }: RefillFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Badge
          key={filter.id}
          variant={activeFilter === filter.id ? "default" : "outline"}
          className="cursor-pointer hover:bg-primary/20 transition-colors"
          onClick={() => onFilterChange(filter.id)}
        >
          {filter.label}
        </Badge>
      ))}
    </div>
  );
}
