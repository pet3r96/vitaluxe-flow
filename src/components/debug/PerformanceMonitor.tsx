import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Database } from "lucide-react";

/**
 * Performance Monitor Component (Dev Only)
 * 
 * Displays real-time performance metrics:
 * - Page load time
 * - Query cache stats
 * - Slow queries detection
 * 
 * Usage: Add to layout in development mode only
 */
export const PerformanceMonitor = () => {
  const [pageLoadTime, setPageLoadTime] = useState<number | null>(null);
  const [slowQueries, setSlowQueries] = useState<string[]>([]);

  useEffect(() => {
    // Measure page load time
    if (performance && performance.timing) {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      setPageLoadTime(loadTime);
    }

    // Monitor query performance
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        // Log slow network requests (>2 seconds)
        if (entry.duration > 2000) {
          console.warn(`🐌 Slow query detected: ${entry.name} took ${entry.duration.toFixed(0)}ms`);
          setSlowQueries(prev => [...prev, `${entry.name} (${entry.duration.toFixed(0)}ms)`].slice(-5));
        }
      });
    });

    observer.observe({ entryTypes: ['resource', 'navigation'] });

    return () => observer.disconnect();
  }, []);

  // Only show in development
  if (import.meta.env.PROD) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg z-50 bg-background/95 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Performance Monitor
          </CardTitle>
          <Badge variant="outline" className="text-xs">DEV</Badge>
        </div>
        <CardDescription className="text-xs">Real-time metrics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Page Load
          </span>
          <Badge variant={pageLoadTime && pageLoadTime < 2000 ? "success" : "destructive"}>
            {pageLoadTime ? `${(pageLoadTime / 1000).toFixed(2)}s` : 'Measuring...'}
          </Badge>
        </div>

        {slowQueries.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              Slow Queries (Last 5)
            </span>
            {slowQueries.map((query, idx) => (
              <div key={idx} className="text-xs text-orange-600 dark:text-orange-400 truncate">
                {query}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t text-muted-foreground">
          <p className="text-xs">
            Monitor console for detailed logs
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
