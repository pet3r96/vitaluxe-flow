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
  // Safety check: try to use auth context, but gracefully handle if not available
  let isImpersonating = false;
  try {
    const auth = useAuth();
    isImpersonating = auth.isImpersonating || false;
  } catch (error) {
    // Auth context not available yet - this is OK during initial render
    console.warn('Auth context not available in GlobalImpersonationBanner');
  }
  
  return (
    <>
      <ImpersonationBanner />
      {/* Add responsive top padding when impersonating to prevent content overlap */}
      <div className={isImpersonating ? "pt-12 sm:pt-11" : ""}>
        {children}
      </div>
    </>
  );
}
