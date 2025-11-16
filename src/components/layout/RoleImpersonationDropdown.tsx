import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserCog, Shield, Stethoscope, Building2, Users, TrendingUp, Check, ChevronRight, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const roleConfig = {
  admin: { label: "Admin", icon: Shield },
  doctor: { label: "Practice", icon: Building2 },
  provider: { label: "Provider", icon: Users },
  pharmacy: { label: "Pharmacy", icon: Building2 },
  topline: { label: "Topline Rep", icon: TrendingUp },
  downline: { label: "Downline Rep", icon: Users },
  patient: { label: "Patient", icon: User },
  staff: { label: "Staff", icon: Users },
};

export function RoleImpersonationDropdown() {
  const { canImpersonate, effectiveRole, impersonatedUserName, isImpersonating, setImpersonation, clearImpersonation } = useAuth();

  // Fetch users grouped by role
  const { data: usersByRole } = useQuery({
    queryKey: ["users-by-role"],
    queryFn: async () => {
      // Fetch all active profiles first
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, email, active")
        .eq("active", true);

      if (profilesError) throw profilesError;

      // Fetch all user roles (EXCLUDING admin - admins cannot be impersonated)
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["doctor", "provider", "pharmacy", "topline", "downline", "staff"]);

      if (rolesError) throw rolesError;

      // Get all admin user IDs to filter them out
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      
      const adminUserIds = new Set((adminRoles || []).map(r => r.user_id));

      // Create a map of user_id to profile
      const profileMap = new Map(
        (profilesData || []).map(p => [p.id, p])
      );

      // Group users by role
      const grouped: Record<string, Array<{ id: string; name: string; email: string }>> = {
        doctor: [],
        provider: [],
        pharmacy: [],
        topline: [],
        downline: [],
        patient: [],
        staff: [],
      };

      rolesData?.forEach((roleItem: any) => {
        const profile = profileMap.get(roleItem.user_id);
        // CRITICAL: Filter out admins - they cannot be impersonated
        if (profile && grouped[roleItem.role] && !adminUserIds.has(profile.id)) {
          grouped[roleItem.role].push({
            id: profile.id,
            name: profile.name,
            email: profile.email,
          });
        }
      });

      // Ensure pharmacies appear (keep existing pharmacy logic)
      const { data: pharmaciesData, error: pharmaciesError } = await supabase
        .from("pharmacies")
        .select("user_id, name, contact_email, active")
        .eq("active", true)
        .not("user_id", "is", null);

      if (!pharmaciesError && pharmaciesData) {
        grouped.pharmacy = pharmaciesData
          .filter((ph: any) => !!ph.user_id)
          .map((ph: any) => ({
            id: ph.user_id as string,
            name: ph.name as string,
            email: ph.contact_email as string,
          }));
      }

      // Fetch patient accounts
      const { data: patientsData, error: patientsError } = await supabase
        .from("patient_accounts")
        .select("user_id, first_name, last_name, email")
        .eq("status", "active");

      if (!patientsError && patientsData) {
        grouped.patient = patientsData.map((patient: any) => ({
          id: patient.user_id as string,
          name: `${patient.first_name} ${patient.last_name}`,
          email: patient.email as string,
        }));
      }

      return grouped;
    },
    enabled: canImpersonate,
  });

  // Only show for the authorized admin
  if (!canImpersonate) return null;

  const CurrentIcon = effectiveRole ? roleConfig[effectiveRole as keyof typeof roleConfig]?.icon || Shield : Shield;
  const currentLabel = impersonatedUserName 
    ? `${roleConfig[effectiveRole as keyof typeof roleConfig]?.label || 'Admin'}: ${impersonatedUserName}`
    : effectiveRole ? roleConfig[effectiveRole as keyof typeof roleConfig]?.label || 'Admin' : 'Admin';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`gap-2 ${isImpersonating ? 'border-primary text-primary' : ''}`}
        >
          <UserCog className="h-4 w-4" />
          <span>View as: {currentLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch Role View
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => clearImpersonation()}
          className="gap-2 cursor-pointer"
        >
          <Shield className="h-4 w-4" />
          <span className="flex-1">Admin</span>
          {effectiveRole === 'admin' && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        
        {Object.entries(roleConfig)
          .filter(([role]) => role !== 'admin')
          .map(([role, config]) => {
            const Icon = config.icon;
            const users = usersByRole?.[role] || [];
            
            if (users.length === 0) {
              return (
                <DropdownMenuItem
                  key={role}
                  disabled
                  className="gap-2 opacity-50"
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{config.label}</span>
                  <span className="text-xs text-muted-foreground">(No users)</span>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuSub key={role}>
                <DropdownMenuSubTrigger className="gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{config.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56 max-h-[300px] overflow-y-auto">
                  {users.map((user) => (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={() => setImpersonation(user.id, role, user.name)}
                      className="gap-2 cursor-pointer"
                    >
                      <span className="flex-1 truncate">
                        {user.name}
                        <span className="block text-xs text-muted-foreground truncate">
                          {user.email}
                        </span>
                      </span>
                      {effectiveRole === role && impersonatedUserName === user.name && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
