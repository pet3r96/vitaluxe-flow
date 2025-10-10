import { useState, useEffect } from "react";
import { PracticeProfileForm } from "@/components/profile/PracticeProfileForm";
import { ProviderProfileForm } from "@/components/profile/ProviderProfileForm";
import { BankAccountsSection } from "@/components/profile/BankAccountsSection";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const Profile = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [isProvider, setIsProvider] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkProviderStatus = async () => {
      if (!effectiveUserId || effectiveRole !== "doctor") {
        setLoading(false);
        return;
      }
      
      const { data } = await supabase
        .from("providers")
        .select("id")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      setIsProvider(!!data);
      setLoading(false);
    };
    
    checkProviderStatus();
  }, [effectiveUserId, effectiveRole]);

  if (effectiveRole !== "doctor") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-2">Access Denied</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-2">
          {isProvider 
            ? "Your Professional Credentials & Contact Information" 
            : "Practice Information, Shipping & Bank Account Details"}
        </p>
      </div>

      <div className="space-y-6">
        {isProvider ? (
          <ProviderProfileForm />
        ) : (
          <>
            <PracticeProfileForm />
            <BankAccountsSection />
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
