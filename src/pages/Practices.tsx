import { useAuth } from "@/contexts/AuthContext";
import { PracticesDataTable } from "@/components/practices/PracticesDataTable";
import { RepPracticesDataTable } from "@/components/practices/RepPracticesDataTable";

const Practices = () => {
  const { effectiveRole } = useAuth();
  
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

      {isRep ? <RepPracticesDataTable /> : <PracticesDataTable />}
    </div>
  );
};

export default Practices;
