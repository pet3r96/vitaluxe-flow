import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ImpersonationBanner } from "./components/layout/ImpersonationBanner";
import { RoleImpersonationDropdown } from "./components/layout/RoleImpersonationDropdown";
import { NotificationBell } from "./components/notifications/NotificationBell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Practices from "./pages/Practices";
import Patients from "./pages/Patients";
import Providers from "./pages/Providers";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Messages from "./pages/Messages";
import Pharmacies from "./pages/Pharmacies";
import Reports from "./pages/Reports";
import Cart from "./pages/Cart";
import OrderConfirmation from "./pages/OrderConfirmation";
import Downlines from "./pages/Downlines";
import MedSpas from "./pages/MedSpas";
import Profile from "./pages/Profile";
import AdminSettings from "./pages/AdminSettings";
import Security from "@/pages/Security";
import NotFound from "./pages/NotFound";
import RepDashboard from "./pages/RepDashboard";
import MyDownlines from "./pages/MyDownlines";
import RepProfitReports from "./pages/RepProfitReports";
import ChangePassword from "./pages/ChangePassword";
import AcceptTerms from "@/pages/AcceptTerms";
import AdminTermsManagement from "@/pages/AdminTermsManagement";
import AdminDiscountCodes from "@/pages/AdminDiscountCodes";

import { DashboardRouter } from "./components/DashboardRouter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ImpersonationBanner />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route path="/accept-terms" element={<ProtectedRoute><AcceptTerms /></ProtectedRoute>} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="flex min-h-screen w-full bg-background overflow-hidden">
                      <AppSidebar />
                      <main className="flex-1 flex flex-col overflow-y-auto bg-[hsl(var(--main-content-bg))]">
                        <div className="sticky top-0 z-10 flex items-center justify-between p-4 lg:p-6 border-b border-border bg-[hsl(var(--main-content-bg))]">
                          <SidebarTrigger className="lg:hidden" />
                          <div className="ml-auto flex items-center gap-2">
                            <NotificationBell />
                            <RoleImpersonationDropdown />
                          </div>
                        </div>
                        <div className="flex-1 p-4 sm:p-6 lg:p-8">
                          <Routes>
                          <Route path="/" element={<DashboardRouter />} />
                          <Route path="/dashboard" element={<DashboardRouter />} />
                          <Route path="/accounts" element={<Accounts />} />
                          <Route path="/practices" element={<Practices />} />
                          <Route path="/patients" element={<Patients />} />
                          <Route path="/providers" element={<Providers />} />
                          <Route path="/products" element={<Products />} />
                          <Route path="/orders" element={<Orders />} />
                          
                          <Route path="/messages" element={<Messages />} />
                          <Route path="/pharmacies" element={<Pharmacies />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/cart" element={<Cart />} />
                          <Route path="/order-confirmation" element={<OrderConfirmation />} />
                          <Route path="/downlines" element={<MyDownlines />} />
                          <Route path="/med-spas" element={<MedSpas />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/admin-settings" element={<AdminSettings />} />
                          <Route path="/security" element={<Security />} />
                          <Route path="/admin/terms" element={<AdminTermsManagement />} />
                          <Route path="/admin/discount-codes" element={<AdminDiscountCodes />} />
                          <Route path="/rep-reports" element={<RepProfitReports />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                        </div>
                      </main>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
