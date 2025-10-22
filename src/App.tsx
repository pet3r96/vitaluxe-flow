import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { GlobalImpersonationBanner } from "@/components/layout/GlobalImpersonationBanner";
import { RoleImpersonationDropdown } from "./components/layout/RoleImpersonationDropdown";
import { NotificationBell } from "./components/notifications/NotificationBell";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load all page components for better code splitting
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Practices = lazy(() => import("./pages/Practices"));
const Patients = lazy(() => import("./pages/Patients"));
const Providers = lazy(() => import("./pages/Providers"));
const Products = lazy(() => import("./pages/Products"));
const Orders = lazy(() => import("./pages/Orders"));
const Messages = lazy(() => import("./pages/Messages"));
const Pharmacies = lazy(() => import("./pages/Pharmacies"));
const Reports = lazy(() => import("./pages/Reports"));
const Cart = lazy(() => import("./pages/Cart"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Downlines = lazy(() => import("./pages/Downlines"));
const MedSpas = lazy(() => import("./pages/MedSpas"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const Security = lazy(() => import("./pages/Security"));
const NotFound = lazy(() => import("./pages/NotFound"));
const RepDashboard = lazy(() => import("./pages/RepDashboard"));
const MyDownlines = lazy(() => import("./pages/MyDownlines"));
const RepProfitReports = lazy(() => import("./pages/RepProfitReports"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const AcceptTerms = lazy(() => import("./pages/AcceptTerms"));
const AdminTermsManagement = lazy(() => import("./pages/AdminTermsManagement"));
const AdminDiscountCodes = lazy(() => import("./pages/AdminDiscountCodes"));
const EmergencyAdminRecovery = lazy(() => import("./pages/EmergencyAdminRecovery"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const DashboardRouter = lazy(() => import("./components/DashboardRouter").then(m => ({ default: m.DashboardRouter })));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes - increased for better caching
      gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: false, // Don't refetch on component mount if data is fresh
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <AuthProvider>
            <GlobalImpersonationBanner>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
                  <Route path="/accept-terms" element={<ProtectedRoute><AcceptTerms /></ProtectedRoute>} />
                  <Route path="/emergency-admin-recovery" element={<EmergencyAdminRecovery />} />
                  <Route
                    path="/dashboard/*"
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
                                <Suspense fallback={<PageLoader />}>
                                  <Routes>
                                    <Route path="/" element={<DashboardRouter />} />
                                    <Route path="accounts" element={<Accounts />} />
                                    <Route path="practices" element={<Practices />} />
                                    <Route path="patients" element={<Patients />} />
                                    <Route path="providers" element={<Providers />} />
                                    <Route path="products" element={<Products />} />
                                    <Route path="orders" element={<Orders />} />
                                    <Route path="messages" element={<Messages />} />
                                    <Route path="pharmacies" element={<Pharmacies />} />
                                    <Route path="reports" element={<Reports />} />
                                    <Route path="cart" element={<Cart />} />
                                    <Route path="order-confirmation" element={<OrderConfirmation />} />
                                    <Route path="downlines" element={<MyDownlines />} />
                                    <Route path="med-spas" element={<MedSpas />} />
                                    <Route path="profile" element={<Profile />} />
                                    <Route path="admin-settings" element={<AdminSettings />} />
                                    <Route path="security" element={<Security />} />
                                    <Route path="admin/terms" element={<AdminTermsManagement />} />
                                    <Route path="admin/discount-codes" element={<AdminDiscountCodes />} />
                                    <Route path="rep-reports" element={<RepProfitReports />} />
                                    <Route path="*" element={<NotFound />} />
                                  </Routes>
                                </Suspense>
                              </div>
                            </main>
                          </div>
                        </SidebarProvider>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </GlobalImpersonationBanner>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
