import { ErrorLogsView } from "@/components/admin/ErrorLogsView";

const ErrorLogs = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Error Logs</h1>
        <p className="text-muted-foreground mt-2">
          Monitor application errors and system issues in real-time
        </p>
      </div>

      <ErrorLogsView />
    </div>
  );
};

export default ErrorLogs;
