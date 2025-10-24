import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download } from "lucide-react";

interface OrdersToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onExport: () => void;
  totalOrders: number;
}

export const OrdersToolbar = ({
  searchQuery,
  onSearchChange,
  onExport,
  totalOrders,
}: OrdersToolbarProps) => {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by order ID, patient name, doctor, product..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Button
        variant="outline"
        onClick={onExport}
        disabled={totalOrders === 0}
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
};
