import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, FileCheck } from "lucide-react";
import { LogoPreview } from "./LogoPreview";
import { downloadPdfFromBase64 } from "@/lib/pdfGenerator";
import { useAuth } from "@/contexts/AuthContext";

export function LogoTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { effectivePracticeId } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [practiceName, setPracticeName] = useState("");
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Fetch current branding
  const { data: branding, isLoading } = useQuery({
    queryKey: ["practice-branding", effectivePracticeId],
    enabled: !!effectivePracticeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_branding")
        .select("*")
        .eq("practice_id", effectivePracticeId!)
        .maybeSingle();

      if (error) throw error;
      
      // Set practice name from database (rehydrate even if empty string)
      setPracticeName(data?.practice_name ?? "");
      
      // Diagnostic log
      console.info("[LogoTab] Loaded branding for practice:", effectivePracticeId, data);
      
      return data;
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!effectivePracticeId) throw new Error("No practice ID");

      // Validate file
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("File size must be less than 2MB");
      }

      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const filePath = `${effectivePracticeId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("provider-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("provider-documents")
        .getPublicUrl(filePath);

      // Update database
      const { error: dbError } = await supabase
        .from("practice_branding")
        .upsert({
          practice_id: effectivePracticeId,
          logo_url: publicUrl,
          logo_storage_path: filePath,
          practice_name: practiceName || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'practice_id'
        });

      if (dbError) throw dbError;

      return { publicUrl, filePath };
    },
    onSuccess: ({ publicUrl, filePath }) => {
      // Optimistically update cache immediately
      queryClient.setQueryData(["practice-branding", effectivePracticeId], (prev: any) => ({
        ...(prev || {}),
        practice_id: effectivePracticeId,
        logo_url: publicUrl,
        logo_storage_path: filePath,
        practice_name: practiceName || null,
        updated_at: new Date().toISOString(),
      }));
      
      // Invalidate with specific key
      queryClient.invalidateQueries({ queryKey: ["practice-branding", effectivePracticeId] });
      
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
        .from("provider-documents")
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
        .eq("practice_id", effectivePracticeId!);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      // Optimistically update cache immediately
      queryClient.setQueryData(["practice-branding", effectivePracticeId], (prev: any) => ({
        ...(prev || {}),
        logo_url: null,
        logo_storage_path: null,
        practice_name: practiceName || null,
        updated_at: new Date().toISOString(),
      }));
      
      // Invalidate with specific key
      queryClient.invalidateQueries({ queryKey: ["practice-branding", effectivePracticeId] });
      
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

  // Update practice name mutation (silent background save)
  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!effectivePracticeId) throw new Error("No practice ID");

      const { error } = await supabase
        .from("practice_branding")
        .upsert({
          practice_id: effectivePracticeId,
          practice_name: newName || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'practice_id'
        });

      if (error) throw error;
      return newName;
    },
    onSuccess: (newName) => {
      // Optimistically update cache immediately
      queryClient.setQueryData(["practice-branding", effectivePracticeId], (prev: any) => ({
        ...(prev || {}),
        practice_id: effectivePracticeId,
        practice_name: newName || null,
        updated_at: new Date().toISOString(),
      }));
      
      // Invalidate with specific key
      queryClient.invalidateQueries({ queryKey: ["practice-branding", effectivePracticeId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Auto-save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Explicit save with toast
  const handleExplicitSave = useCallback(() => {
    updateNameMutation.mutate(practiceName, {
      onSuccess: () => {
        toast({
          title: "Practice name saved",
          description: "Your branding has been updated",
        });
      },
    });
  }, [practiceName, updateNameMutation, toast]);

  // Debounced auto-save
  const handleNameChange = useCallback((value: string) => {
    setPracticeName(value);
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer for auto-save
    debounceTimerRef.current = setTimeout(() => {
      updateNameMutation.mutate(value);
    }, 800);
  }, [updateNameMutation]);

  // Auto-save on blur
  const handleBlur = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    updateNameMutation.mutate(practiceName);
  }, [practiceName, updateNameMutation]);

  // Save on Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      handleExplicitSave();
    }
  }, [handleExplicitSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Generate preview PDF
  const generatePreviewPDF = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-branding-preview-pdf");

      if (error) throw error;

      if (data?.pdfBase64) {
        downloadPdfFromBase64(data.pdfBase64, data.filename || "Branding_Preview.pdf");
        toast({
          title: "Preview generated",
          description: "Your branding preview PDF has been downloaded",
        });
      }
    } catch (error: any) {
      toast({
        title: "Preview failed",
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

          {/* Practice Name Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="practice-name" className="text-sm font-medium">
                Practice Name (Optional)
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExplicitSave}
                disabled={updateNameMutation.isPending}
              >
                Save Name
              </Button>
            </div>
            <input
              id="practice-name"
              type="text"
              value={practiceName}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="Leave blank for white-label (logo only)"
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              This name will appear next to your logo on created forms. Auto-saves as you type.
            </p>
          </div>

          {/* Preview Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">PDF Header Preview</h3>
            <LogoPreview logoUrl={branding?.logo_url} practiceName={practiceName} />
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
              <Button
                variant="outline"
                onClick={() => removeLogoMutation.mutate()}
                disabled={removeLogoMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Logo
              </Button>
            )}

            {(branding?.logo_url || practiceName) && (
              <Button
                variant="outline"
                onClick={generatePreviewPDF}
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Preview PDF
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
