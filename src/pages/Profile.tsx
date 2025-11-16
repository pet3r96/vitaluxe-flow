import { useState, useEffect } from "react";
import { PracticeProfileForm } from "@/components/profile/PracticeProfileForm";
import { ProviderProfileForm } from "@/components/profile/ProviderProfileForm";
import { RepProfileForm } from "@/components/profile/RepProfileForm";
import { PharmacyProfileForm } from "@/components/profile/PharmacyProfileForm";
import { StaffProfileForm } from "@/components/profile/StaffProfileForm";
import { AdminProfileForm } from "@/components/profile/AdminProfileForm";
import { PaymentMethodsSection } from "@/components/profile/PaymentMethodsSection";
import PatientProfile from "@/pages/patient/PatientProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const navigate = useNavigate();
  const [isProvider, setIsProvider] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  
  const isRep = effectiveRole === "topline" || effectiveRole === "downline";
  const isDoctorNotProvider = effectiveRole === "doctor" && !isProvider;
  const allowedRoles = ["doctor", "topline", "downline", "provider", "patient", "pharmacy", "staff", "admin"];

  useEffect(() => {
    const checkProviderStatus = async () => {
      // If already identified as provider role, set it immediately
      if (effectiveRole === "provider") {
        setIsProvider(true);
        setLoading(false);
        return;
      }
      
      // For doctor role, check if they're also a provider
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

  if (!allowedRoles.includes(effectiveRole)) {
    return (
      <div className="patient-container">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">My Profile</h1>
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
    <div className="patient-container">
      {effectiveRole !== "patient" && (
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">My Profile</h1>
              <p className="text-muted-foreground mt-2">
                {isRep 
                  ? "Your Contact Information & Account Settings"
                  : effectiveRole === "staff"
                    ? "Your Contact Information & Account Settings"
                    : effectiveRole === "pharmacy"
                      ? "Manage your pharmacy information, licensed states, and account security"
                      : isProvider 
                        ? "Your Professional Credentials & Contact Information" 
                        : "Manage your personal information and account settings"}
              </p>
            </div>
            {isDoctorNotProvider && (
              <Button 
                onClick={() => navigate('/my-subscription')}
                variant="outline"
                className="gap-2 whitespace-nowrap"
              >
                <CreditCard className="h-4 w-4" />
                Manage Subscription
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {effectiveRole === "admin" ? (
          <AdminProfileForm />
        ) : isRep ? (
          <RepProfileForm />
        ) : effectiveRole === "staff" ? (
          <StaffProfileForm />
        ) : effectiveRole === "patient" ? (
          <PatientProfile />
        ) : effectiveRole === "pharmacy" ? (
          <PharmacyProfileForm />
        ) : isProvider ? (
          <>
            <ProviderProfileForm />
            <PaymentMethodsSection />
          </>
        ) : (
          <>
            <PracticeProfileForm />
            <PaymentMethodsSection />
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
