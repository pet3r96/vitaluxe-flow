import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, FileText, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActionsPanel() {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Calendar,
      label: "View My Schedule",
      description: "See your appointments",
      onClick: () => navigate("/practice-calendar"),
      color: "text-primary",
    },
    {
      icon: Users,
      label: "Review Patient Vault",
      description: "Access patient records",
      onClick: () => navigate("/patients"),
      color: "text-blue-600",
    },
    {
      icon: FileText,
      label: "Documents & Forms",
      description: "Manage files and forms",
      onClick: () => navigate("/documents-and-forms"),
      color: "text-green-600",
    },
    {
      icon: AlertCircle,
      label: "Patient Follow-Ups",
      description: "View reminders",
      onClick: () => navigate("/patients"),
      color: "text-orange-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="outline"
                className="h-auto flex-col items-start p-4 hover:bg-accent"
                onClick={action.onClick}
              >
                <Icon className={`h-6 w-6 mb-2 ${action.color}`} />
                <div className="text-left">
                  <div className="font-semibold text-sm">{action.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {action.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}