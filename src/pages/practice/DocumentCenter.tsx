import { DocumentsTab } from "@/components/documents/DocumentsTab";
import { FileText } from "lucide-react";

export default function DocumentCenter() {
  return (
    <div className="patient-container">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">Document Center</h1>
        </div>
        <p className="text-muted-foreground">
          Upload practice documents and patient files
        </p>
      </div>

      <DocumentsTab />
    </div>
  );
}
