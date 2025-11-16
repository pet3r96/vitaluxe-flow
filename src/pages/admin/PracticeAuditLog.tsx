import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText, Clock } from "lucide-react";

export default function PracticeAuditLog() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Practice Audit Log</h1>
        <p className="text-muted-foreground">View all practice activities and changes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Comprehensive audit trail of practice activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Audit log entries will appear here</p>
            <p className="text-sm mt-2">Track all practice modifications and user actions</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
