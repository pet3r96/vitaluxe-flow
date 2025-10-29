interface LogoPreviewProps {
  logoUrl?: string | null;
}

export function LogoPreview({ logoUrl }: LogoPreviewProps) {
  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Mock PDF Header */}
      <div
        className="relative h-24 flex items-center px-6"
        style={{ backgroundColor: "#C8A64B" }}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Practice logo"
              className="h-12 w-12 object-contain bg-white rounded p-1"
            />
          ) : (
            <div className="h-12 w-12 border-2 border-dashed border-white/50 rounded flex items-center justify-center">
              <span className="text-xs text-white/70">No logo</span>
            </div>
          )}

          {/* Company Text */}
          <div className="flex-1">
            <h1 className="text-white font-bold text-lg tracking-wide">
              VITALUXE SERVICES LLC
            </h1>
          </div>
        </div>
      </div>

      {/* Mock PDF Content Preview */}
      <div className="p-6 space-y-2 bg-muted/20">
        <div className="h-3 bg-muted rounded w-3/4"></div>
        <div className="h-3 bg-muted rounded w-1/2"></div>
        <div className="h-3 bg-muted rounded w-2/3"></div>
      </div>
    </div>
  );
}
