import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, FileCheck } from "lucide-react";
import { LogoPreview } from "./LogoPreview";

export function LogoTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Get current user's practice_id
  const { data: profile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      return profile;
    },
  });

  // Fetch current branding
  const { data: branding, isLoading } = useQuery({
    queryKey: ["practice-branding", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_branding")
        .select("*")
        .eq("practice_id", profile!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.id) throw new Error("No practice ID");

      // Validate file
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("File size must be less than 2MB");
      }

      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("practice-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("practice-documents")
        .getPublicUrl(filePath);

      // Update database
      const { error: dbError } = await supabase
        .from("practice_branding")
        .upsert({
          practice_id: profile.id,
          logo_url: publicUrl,
          logo_storage_path: filePath,
          updated_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      return { publicUrl, filePath };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-branding"] });
      toast({
        title: "Success",
        description: "Logo uploaded! It will now appear on all generated PDFs",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove logo mutation
  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      if (!branding?.logo_storage_path) throw new Error("No logo to remove");

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("practice-documents")
        .remove([branding.logo_storage_path]);

      if (storageError) throw storageError;

      // Update database
      const { error: dbError } = await supabase
        .from("practice_branding")
        .update({
          logo_url: null,
          logo_storage_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq("practice_id", profile!.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-branding"] });
      toast({
        title: "Logo removed",
        description: "PDFs will now use text-only headers",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Remove failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate test PDF
  const generateTestPDF = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-terms-pdf", {
        body: { test: true },
      });

      if (error) throw error;

      toast({
        title: "Test PDF generated",
        description: "Check your downloads folder",
      });
    } catch (error: any) {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = useCallback(
    (file: File) => {
      setIsUploading(true);
      uploadLogoMutation.mutate(file, {
        onSettled: () => setIsUploading(false),
      });
    },
    [uploadLogoMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Practice Logo</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your practice logo to brand all generated PDFs. If no logo is uploaded,
              PDFs will use text-only headers.
            </p>
          </div>

          {/* Preview Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">PDF Header Preview</h3>
            <LogoPreview logoUrl={branding?.logo_url} />
            <p className="text-xs text-muted-foreground">
              This is how your logo will appear on all generated PDFs
            </p>
          </div>

          {/* Upload Section */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Drop your logo here, or{" "}
              <label className="text-primary cursor-pointer hover:underline">
                browse
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  disabled={isUploading}
                />
              </label>
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, or SVG (max 2MB)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
              disabled={isUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {branding?.logo_url ? "Replace Logo" : "Upload Logo"}
            </Button>

            {branding?.logo_url && (
              <>
                <Button
                  variant="outline"
                  onClick={() => removeLogoMutation.mutate()}
                  disabled={removeLogoMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Logo
                </Button>

                <Button
                  variant="outline"
                  onClick={generateTestPDF}
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Test PDF
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
