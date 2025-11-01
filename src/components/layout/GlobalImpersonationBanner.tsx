import { useAuth } from "@/contexts/AuthContext";
import { ImpersonationBanner } from "./ImpersonationBanner";

/**
 * GlobalImpersonationBanner - Root-level wrapper for impersonation UI
 * 
 * This component ensures the impersonation banner is visible across ALL routes
 * in the application, including auth, terms acceptance, and protected pages.
 * 
 * Key features:
 * - Renders banner at the root level (above all routing)
 * - Automatically adds spacing when banner is visible
 * - Prevents content from being hidden behind fixed banner
 * 
 * Usage: Wrap the entire Routes component in App.tsx
 */
interface GlobalImpersonationBannerProps {
  children: React.ReactNode;
}

export function GlobalImpersonationBanner({ children }: GlobalImpersonationBannerProps) {
  const { isImpersonating } = useAuth();
  
  return (
    <>
      <ImpersonationBanner />
      {/* Add responsive top padding when impersonating to prevent content overlap */}
      <div className={isImpersonating ? "pt-[48px] sm:pt-[44px]" : ""}>
        {children}
      </div>
    </>
  );
}
