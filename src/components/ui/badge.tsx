import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline: "text-foreground border-border hover:bg-accent/50",
        success: "border-transparent bg-success/15 text-success dark:bg-success/20 dark:text-success border-success/30 shadow-sm",
        warning: "border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30",
        info: "border-transparent bg-info/15 text-info dark:bg-info/20 dark:text-info border-info/30",
        gold: "border-transparent bg-gold-gradient text-white shadow-sm hover:shadow-md",
        goldOutline: "bg-gold1/10 text-gold1 border-gold1/30 hover:bg-gold1/20 dark:bg-gold1/15 dark:text-gold2",
      },
      size: {
        xs: "text-[10px] py-0 px-1.5 gap-0.5",
        sm: "text-xs py-0.5 px-2 gap-1",
        md: "text-xs py-0.5 px-2.5 gap-1",
        lg: "text-sm py-1 px-3 gap-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
