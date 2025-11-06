import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { toast } from "sonner";

interface VideoComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
}

export function VideoComingSoonDialog({ 
  open, 
  onOpenChange, 
  feature = "Video Appointments" 
}: VideoComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto rounded-full bg-primary/10 p-4 mb-4">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {feature} Coming Soon! 🚀
          </DialogTitle>
          <DialogDescription className="text-center space-y-4">
            <p>We're building HIPAA-compliant Twilio Video integration with:</p>
            <ul className="text-left space-y-2 max-w-md mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <span>Secure 1-on-1 video consultations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <span>Encrypted recordings (auto-deleted after 30 days)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <span>In-app or link-based access for patients</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <span>VitaLuxePro exclusive feature</span>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground pt-4">
              This feature will be available soon. We'll notify you when it's ready!
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Got It
          </Button>
          <Button 
            onClick={() => {
              toast.success("We'll notify you when video calls are ready!");
              onOpenChange(false);
            }}
            className="flex-1"
          >
            Notify Me When Ready
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
