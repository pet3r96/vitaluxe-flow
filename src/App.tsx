import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ImpersonationBanner } from "./components/layout/ImpersonationBanner";
import { RoleImpersonationDropdown } from "./components/layout/RoleImpersonationDropdown";
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
import NotFound from "./pages/NotFound";
import RepDashboard from "./pages/RepDashboard";
import MyDownlines from "./pages/MyDownlines";
import RepProfitReports from "./pages/RepProfitReports";
import { DashboardRouter } from "./components/DashboardRouter";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ImpersonationBanner />
                  <SidebarProvider>
                    <div className="flex min-h-screen w-full bg-background">
                      <AppSidebar />
                      <main className="flex-1 p-8 bg-[hsl(var(--main-content-bg))]">
                        <div className="mb-6 flex justify-end">
                          <RoleImpersonationDropdown />
                        </div>
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
                          <Route path="/rep-reports" element={<RepProfitReports />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
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
  </QueryClientProvider>
);

export default App;
