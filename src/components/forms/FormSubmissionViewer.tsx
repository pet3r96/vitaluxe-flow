import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface FormSubmissionViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: any;
}

export function FormSubmissionViewer({ open, onOpenChange, submission }: FormSubmissionViewerProps) {
  if (!submission) return null;

  const formData = submission.form_data || {};
  const signatureData = submission.signature_data;

  const downloadPDF = () => {
    // TODO: Implement PDF generation
    alert("PDF download coming soon");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{submission.practice_forms?.form_name}</span>
            <Button variant="outline" size="sm" onClick={downloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Patient</p>
              <p className="font-medium">
                {submission.patients?.first_name} {submission.patients?.last_name}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <Badge variant={submission.status === "signed" ? "default" : "secondary"}>
                {submission.status}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Completed</p>
              <p className="font-medium">
                {submission.completed_at
                  ? format(new Date(submission.completed_at), "MMM d, yyyy 'at' h:mm a")
                  : "Not completed"}
              </p>
            </div>
            {submission.signed_at && (
              <div>
                <p className="text-muted-foreground">Signed</p>
                <p className="font-medium">
                  {format(new Date(submission.signed_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-4">Form Responses</h3>
            <div className="space-y-4">
              {Object.keys(formData).length > 0 ? (
                Object.entries(formData).map(([key, value]) => (
                  <div key={key} className="border-b pb-3">
                    <p className="text-sm text-muted-foreground mb-1">{key}</p>
                    <p className="font-medium">{String(value)}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">No responses recorded</p>
              )}
            </div>
          </div>

          {signatureData && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Signature</h3>
              <div className="border rounded p-4 bg-muted">
                {signatureData.signature_image ? (
                  <img
                    src={signatureData.signature_image}
                    alt="Signature"
                    className="max-w-xs mx-auto"
                  />
                ) : (
                  <p className="text-center text-muted-foreground">No signature image available</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
