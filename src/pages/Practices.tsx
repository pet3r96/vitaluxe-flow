import { useAuth } from "@/contexts/AuthContext";
import { PracticesDataTable } from "@/components/practices/PracticesDataTable";
import { RepPracticesDataTable } from "@/components/practices/RepPracticesDataTable";
import { RepPendingPracticesTable } from "@/components/practices/RepPendingPracticesTable";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEffect } from "react";

const Practices = () => {
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();

  // Redirect patients away from this admin/rep-only page
  useEffect(() => {
    if (effectiveRole === 'patient') {
      toast.error("This page is for practice administrators and representatives only.");
      navigate("/dashboard");
    }
  }, [effectiveRole, navigate]);
  
  const isRep = effectiveRole === "topline" || effectiveRole === "downline";
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
          {isRep ? "My Practices" : "Practice Management"}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          {isRep 
            ? "View practices assigned to you" 
            : "Manage all medical practices in the system"}
        </p>
      </div>

      {isRep ? (
        <>
          <RepPracticesDataTable />
          <Separator className="my-8" />
          <RepPendingPracticesTable />
        </>
      ) : (
        <PracticesDataTable />
      )}
    </div>
  );
};

export default Practices;
