import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface RefillSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function RefillSearchBar({ value, onChange }: RefillSearchBarProps) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search by order #, patient name, or product..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
