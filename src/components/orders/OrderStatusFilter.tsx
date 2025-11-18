import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { memo } from "react";

interface OrderStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
  statusConfigs?: Array<{ status_key: string; display_name: string }>;
}

export const OrderStatusFilter = memo(({ value, onChange, statusConfigs }: OrderStatusFilterProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-[180px]">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Statuses</SelectItem>
        {statusConfigs?.map((config) => (
          <SelectItem key={config.status_key} value={config.status_key}>
            {config.display_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

OrderStatusFilter.displayName = "OrderStatusFilter";
