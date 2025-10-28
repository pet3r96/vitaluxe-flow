import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MessageCircle,
  FileText,
  BarChart3,
  Bell,
  Bot,
  Sparkles
} from "lucide-react";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpgradeDialog = ({ open, onOpenChange }: UpgradeDialogProps) => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Calendar,
      title: "Patient Appointment Booking",
      description: "Automated scheduling with SMS reminders"
    },
    {
      icon: MessageCircle,
      title: "Secure Patient Messaging",
      description: "HIPAA-compliant two-way communication"
    },
    {
      icon: FileText,
      title: "Digital EMR & Charting",
      description: "Complete patient medical vault system"
    },
    {
      icon: BarChart3,
      title: "Practice Analytics Dashboard",
      description: "Revenue tracking and patient insights"
    },
    {
      icon: Bell,
      title: "Automated SMS Reminders",
      description: "Reduce no-shows with smart notifications"
    },
    {
      icon: Bot,
      title: "AI-Assisted Triage",
      description: "Intelligent symptom checker for patients"
    }
  ];

  const handleStartTrial = () => {
    onOpenChange(false);
    navigate('/subscribe-to-futuremd');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-amber-500" />
            <DialogTitle className="text-2xl">Transform Your Practice with FutureMD Pro</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Upgrade to a complete virtual front desk + EMR-lite system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 my-6">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-6 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-foreground">$250</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
              7-Day Free Trial
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-sm">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4">
            <Button
              onClick={handleStartTrial}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold h-12 text-base"
            >
              Start 7-Day Free Trial
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            No credit card required for trial • Cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
