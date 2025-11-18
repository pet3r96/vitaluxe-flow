import { ErrorLogsView } from "@/components/admin/ErrorLogsView";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const ErrorLogs = () => {
  return (
    <ResponsivePage
      title="Error Logs"
      subtitle="Monitor application errors and system issues in real-time"
    >
      <ErrorLogsView />
    </ResponsivePage>
  );
};

export default ErrorLogs;
