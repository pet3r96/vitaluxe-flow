import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentsTab } from "@/components/documents/DocumentsTab";
import { FormsTab } from "@/components/forms/FormsTab";
import { CompletedFormsTab } from "@/components/forms/CompletedFormsTab";
import { LogoTab } from "@/components/branding/LogoTab";
import { FileText, ClipboardList, CheckSquare, Image } from "lucide-react";

export default function DocumentsAndForms() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Documents & Forms</h1>
        <p className="text-muted-foreground mt-2">
          Manage clinical documents and patient forms
        </p>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            My Documents
          </TabsTrigger>
          <TabsTrigger value="forms" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            My Forms
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Completed Forms
          </TabsTrigger>
          <TabsTrigger value="logo" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            My Logo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-6">
          <DocumentsTab />
        </TabsContent>

        <TabsContent value="forms" className="mt-6">
          <FormsTab />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <CompletedFormsTab />
        </TabsContent>

        <TabsContent value="logo" className="mt-6">
          <LogoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}