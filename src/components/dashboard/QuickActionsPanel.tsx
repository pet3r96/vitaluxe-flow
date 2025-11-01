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
      label: "Document Center (Manage practice and patient files)",
      onClick: () => navigate("/document-center"),
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
    <Card variant="modern">
      <CardHeader className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20">
        <CardTitle className="text-indigo-700 dark:text-indigo-300">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="outline"
                className="w-full justify-start items-center p-5 hover:bg-accent/50 hover:scale-[1.02] transition-all duration-200 gap-4 h-auto"
                onClick={action.onClick}
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br from-accent/50 to-accent/30`}>
                  <Icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div className="font-semibold text-sm text-left flex-1">{action.label}</div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}