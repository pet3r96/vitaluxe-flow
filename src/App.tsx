import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { GlobalImpersonationBanner } from "@/components/layout/GlobalImpersonationBanner";
import { RoleImpersonationDropdown } from "./components/layout/RoleImpersonationDropdown";
import { NotificationBell } from "./components/notifications/NotificationBell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Global2FADialogs } from "./components/auth/Global2FADialogs";
import { UpgradePromptDialog } from "@/components/subscription/UpgradePromptDialog";
import { SubscriptionProtectedRoute } from "./components/subscription/SubscriptionProtectedRoute";
import { SessionTimer } from "./components/auth/SessionTimer";

// Helper function to retry dynamic imports on failure
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const retryKey = 'vitaluxe-chunk-retry';
    const hasRetried = window.sessionStorage.getItem(retryKey) === 'true';

    try {
      const component = await componentImport();
      // Clear retry flag on successful load
      window.sessionStorage.removeItem(retryKey);
      return component;
    } catch (error: any) {
      // Detect chunk load errors more reliably
      const isChunkError = 
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('dynamically imported module') ||
        error?.message?.includes('Loading chunk');
      
      console.error('Component load error:', {
        name: error?.name,
        message: error?.message,
        isChunkError,
        hasRetried
      });
      
      // Only retry once for chunk errors
      if (isChunkError && !hasRetried) {
        console.warn('Chunk load failed, reloading page...');
        window.sessionStorage.setItem(retryKey, 'true');
        // Small delay to ensure error is logged
        setTimeout(() => window.location.reload(), 100);
        return new Promise(() => {}); // Prevent further execution
      }
      
      // Either not a chunk error, or already retried
      throw error;
    }
  });

// Lazy load all page components for better code splitting
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Practices = lazy(() => import("./pages/Practices"));
const Representatives = lazy(() => import("./pages/Representatives"));
const Patients = lazy(() => import("./pages/Patients"));
const Providers = lazy(() => import("./pages/Providers"));
const Products = lazy(() => import("./pages/Products"));
const Orders = lazy(() => import("./pages/Orders"));
const Messages = lazy(() => import("./pages/Messages"));
const Pharmacies = lazy(() => import("./pages/Pharmacies"));
const Reports = lazy(() => import("./pages/Reports"));
const Cart = lazy(() => import("./pages/Cart"));
const DeliveryConfirmation = lazy(() => import("./pages/DeliveryConfirmation"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Downlines = lazy(() => import("./pages/Downlines"));
const MedSpas = lazy(() => import("./pages/MedSpas"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Security = lazy(() => import("./pages/Security"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyDownlines = lazy(() => import("./pages/MyDownlines"));
const RepProfitReports = lazy(() => import("./pages/RepProfitReports"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const AcceptTerms = lazy(() => import("./pages/AcceptTerms"));
const AdminTermsManagement = lazy(() => import("./pages/AdminTermsManagement"));
const AdminDiscountCodes = lazy(() => import("./pages/AdminDiscountCodes"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const PharmacyShipping = lazy(() => import("./pages/PharmacyShipping"));
const RepProductivityReport = lazy(() => import("./components/reports/RepProductivityReport"));
const DownlinePerformanceView = lazy(() => import("./components/reports/DownlinePerformanceView"));
const DashboardRouter = lazyWithRetry(() => import("./components/DashboardRouter"));
const SubscribeToVitaLuxePro = lazy(() => import("./pages/SubscribeToVitaLuxePro"));
const PatientDashboard = lazy(() => import("./pages/patient/PatientDashboard"));
const PatientAppointments = lazy(() => import("./pages/patient/PatientAppointments"));
const PatientMessages = lazy(() => import("./pages/patient/PatientMessages"));
const PatientMedicalVault = lazy(() => import("./pages/patient/PatientMedicalVault"));
const PatientDocuments = lazy(() => import("./pages/patient/PatientDocuments"));
const PatientTriage = lazy(() => import("./pages/patient/PatientTriage"));
const PatientProfile = lazy(() => import("./pages/patient/PatientProfile"));
const PatientOnboarding = lazy(() => import("./pages/patient/PatientOnboarding"));
const PracticeCalendar = lazy(() => import("./pages/practice/PracticeCalendar"));
const PatientInbox = lazy(() => import("./pages/practice/PatientInbox"));
const TriageQueue = lazy(() => import("./pages/practice/TriageQueue"));
const PracticePatients = lazy(() => import("./pages/practice/PracticePatients"));
const DocumentsAndForms = lazy(() => import("./pages/practice/DocumentsAndForms"));
const MySubscription = lazy(() => import("./pages/practice/MySubscription"));

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

// SessionTimerWrapper component to access auth context and location
const SessionTimerWrapper = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Only show timer when user is authenticated and not on auth page
  if (!user || location.pathname === '/auth') {
    return null;
  }
  
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <SessionTimer userId={user.id} />
      </div>
    );
};

// Wrapper to protect SubscribeToVitaLuxePro route - only practice owners (doctors who are NOT provider accounts)
const SubscribeToVitaLuxeProWrapper = () => {
  const { effectiveRole, isProviderAccount } = useAuth();
  const location = useLocation();
  
  if (effectiveRole !== 'doctor' || isProviderAccount) {
    return <NotFound />;
  }
  
  return <SubscribeToVitaLuxePro />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <SessionTimerWrapper />
              <GlobalImpersonationBanner>
                <Global2FADialogs />
                <UpgradePromptDialog />
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  <Route path="/accept-terms" element={<ProtectedRoute><AcceptTerms /></ProtectedRoute>} />
                  <Route path="/patient-onboarding" element={<ProtectedRoute><PatientOnboarding /></ProtectedRoute>} />
                  <Route path="/subscribe-to-vitaluxepro" element={<ProtectedRoute><SubscribeToVitaLuxeProWrapper /></ProtectedRoute>} />
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
                                <Suspense fallback={<PageLoader />}>
                                  <Routes>
                                    <Route path="/" element={<DashboardRouter />} />
                                    <Route path="/dashboard" element={<DashboardRouter />} />
                                    <Route path="/accounts" element={<Accounts />} />
                                    <Route path="/practices" element={<Practices />} />
                                    <Route path="/representatives" element={<Representatives />} />
                                    <Route path="/patients" element={<Patients />} />
                                    <Route path="/providers" element={<Providers />} />
                                    <Route path="/products" element={<Products />} />
                                    <Route path="/orders" element={<Orders />} />
                                    <Route path="/messages" element={<Messages />} />
                                    <Route path="/pharmacies" element={<Pharmacies />} />
                                    <Route path="/reports" element={<Reports />} />
                                    <Route path="/cart" element={<Cart />} />
                                    <Route path="/delivery-confirmation" element={<DeliveryConfirmation />} />
                                    <Route path="/checkout" element={<Checkout />} />
                                    <Route path="/order-confirmation" element={<Checkout />} />
                                    <Route path="/downlines" element={<MyDownlines />} />
                                    <Route path="/med-spas" element={<MedSpas />} />
                                    <Route path="/profile" element={<Profile />} />
                                    <Route path="/admin-settings" element={<AdminSettings />} />
                                    <Route path="/subscriptions" element={<Subscriptions />} />
                                    <Route path="/security" element={<Security />} />
                                    <Route path="/admin/terms" element={<AdminTermsManagement />} />
                                    <Route path="/admin/discount-codes" element={<AdminDiscountCodes />} />
                                    <Route path="/rep-reports" element={<RepProfitReports />} />
                                    <Route path="/rep-productivity" element={<RepProductivityReport />} />
                                    <Route path="/downline-performance" element={<DownlinePerformanceView />} />
                                    <Route path="/shipping" element={<PharmacyShipping />} />
                                    <Route path="/appointments" element={<SubscriptionProtectedRoute><PatientAppointments /></SubscriptionProtectedRoute>} />
                                    <Route path="/medical-vault" element={<SubscriptionProtectedRoute><PatientMedicalVault /></SubscriptionProtectedRoute>} />
                                    <Route path="/documents" element={<PatientDocuments />} />
                                    <Route path="/triage" element={<SubscriptionProtectedRoute><PatientTriage /></SubscriptionProtectedRoute>} />
                                    <Route path="/practice-calendar" element={<SubscriptionProtectedRoute><PracticeCalendar /></SubscriptionProtectedRoute>} />
                                    <Route path="/documents-and-forms" element={<SubscriptionProtectedRoute><DocumentsAndForms /></SubscriptionProtectedRoute>} />
                                    <Route path="/my-subscription" element={<SubscriptionProtectedRoute><MySubscription /></SubscriptionProtectedRoute>} />
                                    {/* Patient Inbox removed - now integrated into Messages */}
                                    <Route path="/triage-queue" element={<SubscriptionProtectedRoute><TriageQueue /></SubscriptionProtectedRoute>} />
                                    {/* Redirect old practice-patients route to new merged Patients page */}
                                    <Route path="/practice-patients" element={<Navigate to="/patients" replace />} />
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
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
    </TooltipProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
