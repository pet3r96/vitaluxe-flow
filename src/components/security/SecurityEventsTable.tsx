import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const SecurityEventsTable = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Security Events
        </CardTitle>
        <CardDescription>
          Failed logins, brute force attempts, and suspicious activity detection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-2">Security Events Monitoring</p>
          <p className="text-sm">
            This feature tracks failed login attempts, brute force attacks, and anomalous behavior.
            <br />
            Requires edge functions from Phase 2-3 to be deployed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
