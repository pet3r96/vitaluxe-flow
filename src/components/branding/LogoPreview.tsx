import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogoPreviewProps {
  logoUrl?: string | null;
  logoStoragePath?: string | null;
  practiceName?: string;
}

export function LogoPreview({ logoUrl, logoStoragePath, practiceName = "" }: LogoPreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const displayName = practiceName || "VITALUXE SERVICES LLC";

  useEffect(() => {
    async function getSignedUrl() {
      if (!logoStoragePath) {
        setSignedUrl(null);
        return;
      }

      try {
        const { data, error } = await supabase.storage
          .from("provider-documents")
          .createSignedUrl(logoStoragePath, 3600); // 1 hour expiry

        if (error) throw error;
        setSignedUrl(data.signedUrl);
      } catch (error) {
        console.error("Error getting signed URL for logo:", error);
        setSignedUrl(null);
      }
    }

    getSignedUrl();
  }, [logoStoragePath]);

  const displayUrl = signedUrl || logoUrl;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Mock PDF Header */}
      <div
        className="relative h-24 flex items-center px-6"
        style={{ backgroundColor: "#C8A64B" }}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-4">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Practice logo"
              className="h-12 w-12 object-contain bg-white rounded p-1"
            />
          ) : (
            <div className="h-12 w-12 border-2 border-dashed border-white/50 rounded flex items-center justify-center">
              <span className="text-xs text-white/70">No logo</span>
            </div>
          )}

          {/* Company Text */}
          {displayName && (
            <div className="flex-1">
              <h1 className="text-white font-bold text-lg tracking-wide">
                {displayName}
              </h1>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
