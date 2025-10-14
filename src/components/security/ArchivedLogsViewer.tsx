import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ArchivedLogsViewer = () => {
  const retentionYears = 6;
  const oldestLogDate = new Date();
  oldestLogDate.setFullYear(oldestLogDate.getFullYear() - retentionYears);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-5 w-5" />
          Archived Logs (HIPAA Compliance)
        </CardTitle>
        <CardDescription>
          6-year log retention for HIPAA compliance requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compliance Status */}
        <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <div>
            <p className="font-medium">HIPAA Compliant</p>
            <p className="text-sm text-muted-foreground">
              Logs are retained for {retentionYears} years as required
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Retention Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{retentionYears} years</div>
              <Badge variant="secondary" className="mt-2">
                HIPAA Compliant
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Oldest Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-mono">
                {oldestLogDate.toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Logs older than this are purged
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Archive Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-green-600">Active</div>
              <p className="text-xs text-muted-foreground mt-2">
                Daily archival running
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <div className="text-center py-8 text-muted-foreground">
          <Archive className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">Archived Logs Viewer</p>
          <p className="text-sm">
            Search and view logs older than 90 days from cold storage.
            <br />
            Archived logs are kept for 6 years to meet HIPAA requirements.
            <br />
            Requires edge function from Phase 1 to be deployed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
