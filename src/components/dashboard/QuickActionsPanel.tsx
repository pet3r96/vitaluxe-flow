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
      onClick: () => navigate("/practice-calendar"),
      color: "text-primary",
    },
    {
      icon: Users,
      label: "Review Patient Vault",
      onClick: () => navigate("/patients"),
      color: "text-blue-600",
    },
    {
      icon: FileText,
      label: "Document Center",
      onClick: () => navigate("/document-center"),
      color: "text-green-600",
    },
    {
      icon: AlertCircle,
      label: "Patient Follow-Ups",
      onClick: () => navigate("/patients"),
      color: "text-orange-600",
    },
  ];

  return (
    <Card variant="modern" className="h-full">
      <CardHeader className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20">
        <CardTitle className="text-indigo-700 dark:text-indigo-300">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant="outline"
                className="w-full justify-start items-center p-4 hover:bg-accent/50 hover:scale-[1.01] transition-all duration-200 gap-3 h-auto min-h-[60px]"
                onClick={action.onClick}
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br from-accent/50 to-accent/30 flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div className="font-semibold text-sm text-left flex-1 truncate leading-tight">
                  {action.label}
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}