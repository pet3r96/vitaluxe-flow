import { lazy, Suspense } from "react";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { usePagePerformance } from "@/hooks/usePagePerformance";

const ErrorLogsView = lazy(() => import("@/components/admin/ErrorLogsView").then(m => ({ default: m.ErrorLogsView })));

const ErrorLogs = () => {
  usePagePerformance('ErrorLogs');

  return (
    <ResponsivePage
      title="Error Logs"
      subtitle="Monitor application errors and system issues in real-time"
    >
      <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
        <ErrorLogsView />
      </Suspense>
    </ResponsivePage>
  );
};

export default ErrorLogs;
