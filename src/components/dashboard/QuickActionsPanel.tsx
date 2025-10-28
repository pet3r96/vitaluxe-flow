import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, FileText, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActionsPanel() {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Calendar,
      label: "View My Schedule (See your appointments)",
      onClick: () => navigate("/practice-calendar"),
      color: "text-primary",
    },
    {
      icon: Users,
      label: "Review Patient Vault (Access patient records)",
      onClick: () => navigate("/patients"),
      color: "text-blue-600",
    },
    {
      icon: FileText,
      label: "Documents & Forms (Manage files and forms)",
      onClick: () => navigate("/documents-and-forms"),
      color: "text-green-600",
    },
    {
      icon: AlertCircle,
      label: "Patient Follow-Ups (View reminders)",
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
        <div className="grid grid-cols-1 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="outline"
                className="w-full justify-start items-center p-4 hover:bg-accent gap-3"
                onClick={action.onClick}
              >
                <Icon className={`h-6 w-6 flex-shrink-0 ${action.color}`} />
                <div className="font-medium text-sm text-left">{action.label}</div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}