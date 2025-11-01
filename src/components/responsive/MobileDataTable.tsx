import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface MobileTableAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface MobileTableField {
  label: string;
  value: ReactNode;
  badge?: boolean;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export interface MobileTableRowProps {
  title: string;
  subtitle?: string;
  fields: MobileTableField[];
  actions?: MobileTableAction[];
  onClick?: () => void;
}

/**
 * Mobile-optimized card-based table row
 */
export const MobileTableRow = ({ 
  title, 
  subtitle, 
  fields, 
  actions,
  onClick 
}: MobileTableRowProps) => {
  return (
    <Card 
      className={`p-3 ${onClick ? 'cursor-pointer hover:bg-muted/50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{title}</div>
          {subtitle && (
            <div className="text-sm text-muted-foreground truncate">{subtitle}</div>
          )}
          
          <div className="mt-2 space-y-1.5">
            {fields.map((field, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">{field.label}:</span>
                {field.badge ? (
                  <Badge variant={field.badgeVariant || 'default'} className="text-xs">
                    {field.value}
                  </Badge>
                ) : (
                  <span className="truncate">{field.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {actions && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  className={action.variant === 'destructive' ? 'text-destructive' : ''}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </Card>
  );
};

export interface MobileDataTableProps {
  rows: MobileTableRowProps[];
  emptyMessage?: string;
}

/**
 * Mobile-optimized data table using cards instead of table
 */
export const MobileDataTable = ({ rows, emptyMessage = 'No items found' }: MobileDataTableProps) => {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <MobileTableRow key={idx} {...row} />
      ))}
    </div>
  );
};
