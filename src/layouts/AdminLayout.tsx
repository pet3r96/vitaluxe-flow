import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useResponsive } from "@/hooks/use-mobile";
import { getResponsivePadding } from "@/lib/responsive";

export default function AdminLayout() {
  const { isMobile } = useResponsive();
  const padding = getResponsivePadding(isMobile);
  
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className={`flex-1 overflow-y-auto ${padding}`}>
          <div className="min-h-full max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
