import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex flex-nowrap h-auto items-center rounded-lg backdrop-blur-sm bg-background/60 border border-border/50",
      "p-1 sm:p-1.5 lg:p-2 mb-6 gap-1 sm:gap-1.5",
      "overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent",
      "shadow-sm hover:shadow-md transition-shadow duration-300",
      "md:inline-flex md:justify-center",
      "-webkit-overflow-scrolling-touch", // Smooth momentum scrolling on iOS
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md",
      "px-3 py-2.5 sm:px-4 text-sm font-medium shrink-0",
      "transition-all duration-300 ease-in-out",
      "hover:bg-background/70 hover:text-foreground hover:scale-[1.02]",
      "data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80",
      "data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/20",
      "data-[state=active]:scale-[1.02]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "min-h-[44px] touch-target",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "animate-fade-in",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
