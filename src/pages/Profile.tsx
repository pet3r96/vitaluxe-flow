import { PracticeProfileForm } from "@/components/profile/PracticeProfileForm";
import { BankAccountsSection } from "@/components/profile/BankAccountsSection";
import { useAuth } from "@/contexts/AuthContext";

const Profile = () => {
  const { effectiveRole } = useAuth();
  const isPractice = effectiveRole === "doctor"; // doctor role represents practices

  if (!isPractice) {
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
        <PracticeProfileForm />
        <BankAccountsSection />
      </div>
    </div>
  );
};

export default Profile;
