import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ALLOWED_EMAILS = [
  'sporn.dylan@gmail.com',
  'info@vitaluxeservices.com'
];

export const DeveloperRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isAllowed = ALLOWED_EMAILS.includes(user.email || '');

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground">
            This is a developer-only diagnostic tool.
          </p>
          <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
            <p className="text-muted-foreground">Your email: <span className="font-mono text-foreground">{user.email}</span></p>
            <p className="text-muted-foreground">Required: Super Admin access</p>
          </div>
          <Button onClick={() => window.history.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
