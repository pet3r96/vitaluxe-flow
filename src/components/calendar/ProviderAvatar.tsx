import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface ProviderAvatarProps {
  provider: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
    specialty?: string;
  };
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base"
};

export function ProviderAvatar({ provider, size = "md", className }: ProviderAvatarProps) {
  const initials = `${provider.first_name?.[0] || ''}${provider.last_name?.[0] || ''}`.toUpperCase();
  
  // Generate consistent color based on name
  const colorIndex = (provider.first_name + provider.last_name).length % 6;
  const colors = [
    "bg-blue-500 text-white",
    "bg-purple-500 text-white",
    "bg-green-500 text-white",
    "bg-orange-500 text-white",
    "bg-pink-500 text-white",
    "bg-cyan-500 text-white"
  ];

  if (provider.avatar_url) {
    return (
      <img
        src={provider.avatar_url}
        alt={`${provider.first_name} ${provider.last_name}`}
        className={cn("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div 
      className={cn(
        "rounded-full flex items-center justify-center font-semibold",
        sizeClasses[size],
        colors[colorIndex],
        className
      )}
    >
      {initials || <User className="h-3 w-3" />}
    </div>
  );
}
