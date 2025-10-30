import { ReactNode, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface PracticeOnlyRouteProps {
  children: ReactNode;
}

export const PracticeOnlyRoute = ({ children }: PracticeOnlyRouteProps) => {
  const { effectiveRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only practice owners (doctors) and admins can manage subscriptions
    const allowedRoles = ['doctor', 'admin'];
    
    if (!loading && effectiveRole && !allowedRoles.includes(effectiveRole)) {
      toast.error("This page is only for medical practices", {
        description: "Pharmacy and patient accounts don't need VitaLuxePro subscriptions"
      });
      navigate("/dashboard");
    }
  }, [effectiveRole, loading, navigate]);

  if (loading) return null;

  return <>{children}</>;
};
