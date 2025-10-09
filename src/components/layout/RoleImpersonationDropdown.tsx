import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserCog, Shield, Stethoscope, Building2, Users, TrendingUp, Check } from "lucide-react";

const roleConfig = {
  admin: { label: "Admin", icon: Shield },
  doctor: { label: "Doctor", icon: Stethoscope },
  pharmacy: { label: "Pharmacy", icon: Building2 },
  topline: { label: "Topline Rep", icon: TrendingUp },
  downline: { label: "Downline Rep", icon: Users },
};

export function RoleImpersonationDropdown() {
  const { actualRole, effectiveRole, isImpersonating, setImpersonation } = useAuth();

  if (actualRole !== 'admin') return null;

  const CurrentIcon = effectiveRole ? roleConfig[effectiveRole as keyof typeof roleConfig]?.icon || Shield : Shield;
  const currentLabel = effectiveRole ? roleConfig[effectiveRole as keyof typeof roleConfig]?.label || 'Admin' : 'Admin';

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
        {Object.entries(roleConfig).map(([role, config]) => {
          const Icon = config.icon;
          const isActive = effectiveRole === role;
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => setImpersonation(role === 'admin' ? null : role)}
              className="gap-2 cursor-pointer"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{config.label}</span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
