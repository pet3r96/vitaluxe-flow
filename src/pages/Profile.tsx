import { ProviderProfileForm } from "@/components/profile/ProviderProfileForm";
import { BankAccountsSection } from "@/components/profile/BankAccountsSection";
import { useAuth } from "@/contexts/AuthContext";

const Profile = () => {
  const { effectiveRole } = useAuth();
  const isProvider = effectiveRole === "doctor";

  if (!isProvider) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-2">Access Denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-2">
          Account, Shipping & Bank Information
        </p>
      </div>

      <div className="space-y-6">
        <ProviderProfileForm />
        <BankAccountsSection />
      </div>
    </div>
  );
};

export default Profile;
