import { DocumentsTab } from "@/components/documents/DocumentsTab";
import { FileText } from "lucide-react";

export default function DocumentCenter() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Document Center
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload practice documents and patient files
        </p>
      </div>

      <DocumentsTab />
    </div>
  );
}
