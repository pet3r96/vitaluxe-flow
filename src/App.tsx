// Deployment trigger - 2025-11-07 16:30
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { GlobalImpersonationBanner } from "@/components/layout/GlobalImpersonationBanner";
import { Topbar } from "./components/layout/Topbar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useResponsive } from "@/hooks/use-mobile";
import { Global2FADialogs } from "./components/auth/Global2FADialogs";
import { GlobalIntakeDialog } from "./components/patient/GlobalIntakeDialog";
import { SubscriptionProtectedRoute } from "./components/subscription/SubscriptionProtectedRoute";
import { PracticeOnlyRoute } from "./components/subscription/PracticeOnlyRoute";
import { SessionTimer } from "./components/auth/SessionTimer";
import { realtimeManager } from "./lib/realtimeManager";
import { ProGate } from "./components/subscription/ProGate";

// Helper function to retry dynamic imports on failure
const lazyWithRetry = (componentImport: () => Promise<any>, componentName: string = 'Component') => lazy(async () => {
  const retryKey = 'vitaluxe-chunk-retry';
  const hasRetried = window.sessionStorage.getItem(retryKey) === 'true';
  try {
    const component = await componentImport();
    // Clear retry flag on successful load
    window.sessionStorage.removeItem(retryKey);
    return component;
  } catch (error: any) {
    const msg = error?.message || '';
    const name = error?.name || '';
    
    // Comprehensive chunk error detection
    const isChunkError = 
      name === 'ChunkLoadError' ||
      name === 'SyntaxError' ||
      /Unexpected token/.test(msg) ||
      /Failed to fetch dynamically imported module/.test(msg) ||
      /error loading dynamically imported module/.test(msg) ||
      /Importing a module script failed/.test(msg) ||
      /'text\/html' is not a valid JavaScript MIME type/.test(msg) ||
      /Failed to fetch/.test(msg) ||
      /Loading chunk/.test(msg);

    if (isChunkError) {
      console.warn(`[App] Chunk load error for ${componentName}, attempting auto-reload...`, {
        errorName: name,
        errorMessage: msg,
        hasRetried,
        componentName
      });
      
      // Auto-reload once
      if (!hasRetried) {
        window.sessionStorage.setItem(retryKey, 'true');
        setTimeout(() => {
          window.location.href = window.location.pathname + '?v=' + Date.now();
        }, 1000);
        return new Promise(() => {}); // Prevent further execution
      }
    }
    
    console.error(`[App] Component load failed for ${componentName}:`, {
      name,
      message: msg,
      isChunkError,
      hasRetried
    });
    
    throw error;
  }
});

// Lazy load all page components for better code splitting
const Auth = lazy(() => import("./pages/Auth"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Practices = lazy(() => import("./pages/Practices"));
const Representatives = lazy(() => import("./pages/Representatives"));
const Patients = lazy(() => import("./pages/Patients"));
const Providers = lazy(() => import("./pages/Providers"));
const Staff = lazy(() => import("./pages/Staff"));
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
const AppointmentDebugLogs = lazy(() => import("./pages/AppointmentDebugLogs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyDownlines = lazy(() => import("./pages/MyDownlines"));
const RepProfitReports = lazy(() => import("./pages/RepProfitReports"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const AcceptTerms = lazy(() => import("./pages/AcceptTerms"));
const AdminTermsManagement = lazy(() => import("./pages/AdminTermsManagement"));
const AdminDiscountCodes = lazy(() => import("./pages/AdminDiscountCodes"));
const PracticeAuditLog = lazy(() => import("./pages/PracticeAuditLog"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const PharmacyShipping = lazy(() => import("./pages/PharmacyShipping"));
const RepProductivityReport = lazy(() => import("./components/reports/RepProductivityReport"));
const DownlinePerformanceView = lazy(() => import("./components/reports/DownlinePerformanceView"));
const DashboardRouter = lazyWithRetry(() => import("./components/DashboardRouter"), "DashboardRouter");
const SubscribeToVitaLuxePro = lazy(() => import("./pages/SubscribeToVitaLuxePro"));
const PatientDashboard = lazy(() => import("./pages/patient/PatientDashboard"));
const PatientAppointments = lazy(() => import("./pages/patient/PatientAppointments"));
const InternalChat = lazy(() => import("./pages/InternalChat"));
const PatientMessages = lazy(() => import("./pages/patient/PatientMessages"));
const PatientMedicalVault = lazy(() => import("./pages/patient/PatientMedicalVault"));
const PatientDocuments = lazy(() => import("./pages/patient/PatientDocuments"));
const PatientProfile = lazy(() => import("./pages/patient/PatientProfile"));
const PatientOnboarding = lazy(() => import("./pages/patient/PatientOnboarding"));
const PatientIntakeForm = lazy(() => import("./pages/patient/PatientIntakeForm"));
const PatientMobileHeader = lazy(() => import("./components/patient/PatientMobileHeader").then(m => ({ default: m.PatientMobileHeader })));
const PatientVideoRoom = lazy(() => import("./pages/patient/PatientVideoRoom"));
const PracticeCalendar = lazy(() => import("./pages/practice/PracticeCalendar"));
const VideoConsultationRoom = lazy(() => import("./pages/practice/VideoConsultationRoom"));
const PatientInbox = lazy(() => import("./pages/practice/PatientInbox"));
const PracticePatients = lazy(() => import("./pages/practice/PracticePatients"));
const DocumentCenter = lazy(() => import("./pages/practice/DocumentCenter"));
const MySubscription = lazy(() => import("./pages/practice/MySubscription"));
const PracticeReporting = lazy(() => import("./pages/PracticeReporting"));
const PatientDetail = lazyWithRetry(() => import("./pages/PatientDetail"), "PatientDetail");
const PracticePatientMedicalVault = lazyWithRetry(() => import("./pages/practice/PatientMedicalVault"), "PracticePatientMedicalVault");
const PracticePatientIntakeForm = lazy(() => import("./pages/practice/PracticePatientIntakeForm"));
const Support = lazy(() => import("./pages/Support"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const SupportTicketThread = lazy(() => import("./pages/SupportTicketThread"));
const VideoConsultations = lazy(() => import("./pages/practice/VideoConsultations"));
const VideoGuestJoin = lazy(() => import("./pages/public/VideoGuestJoin"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      // 5min - realtime keeps data fresh
      gcTime: 10 * 60 * 1000,
      // 10min garbage collection
      refetchOnMount: false,
      // Trust realtime updates
      refetchOnWindowFocus: true,
      // Sync on tab return
      retry: 1,
      // Fast failure
      retryDelay: 1000
    }
  }
});

// Initialize realtime manager with React Query client for automatic cache invalidation
realtimeManager.setQueryClient(queryClient);

// SessionTimerWrapper component to access auth context and location
const SessionTimerWrapper = () => {
  // Timer is now in Topbar - no longer needed here
  return null;
};

// Wrapper removed - subscriptions are now automatic on first login
// Users are auto-enrolled in 14-day trial when they create a practice account

// Sidebar wrapper - defaults to expanded for best navigation visibility
const SidebarLayout = ({ children }: { children: React.ReactNode }) => {
  const { isMobile } = useResponsive();
  const defaultOpen = true; // Always start expanded (full length) by default
  
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {children}
    </SidebarProvider>
  );
};

const App = () => <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
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
                <GlobalIntakeDialog />
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/change-password" element={<ChangePassword />} />
                  <Route path="/video-guest/:token" element={<VideoGuestJoin />} />
                  <Route path="/accept-terms" element={<ProtectedRoute><AcceptTerms /></ProtectedRoute>} />
                  <Route path="/patient-onboarding" element={<ProtectedRoute><PatientOnboarding /></ProtectedRoute>} />
                  <Route path="/intake" element={<ProtectedRoute><PatientIntakeForm /></ProtectedRoute>} />
                  <Route path="/subscribe-to-vitaluxepro" element={<ProtectedRoute><PracticeOnlyRoute><SubscribeToVitaLuxePro /></PracticeOnlyRoute></ProtectedRoute>} />
                  
                  {/* Video Routes - Full Screen (No Layout) */}
                  <Route path="/patient/video/:sessionId" element={<ProtectedRoute><PatientVideoRoom /></ProtectedRoute>} />
                  <Route path="/practice/video/:sessionId" element={<ProtectedRoute><SubscriptionProtectedRoute><VideoConsultationRoom /></SubscriptionProtectedRoute></ProtectedRoute>} />
                   <Route path="/*" element={<ProtectedRoute>
                        <SidebarLayout>
                          <div className="flex min-h-screen w-full vitaluxe-base-bg overflow-hidden">
                            <AppSidebar />
                            <main className="flex-1 flex flex-col overflow-y-auto">
                              <PatientMobileHeader />
                              <Topbar />
                              <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 pt-14 md:pt-4 overflow-x-hidden relative bg-gray-100 dark:bg-stone-900 rounded-none">
                                <div className="relative z-10">
                                <Suspense fallback={<PageLoader />}>
                                  <AnimatePresence mode="wait">
                                    <Routes>
                                      <Route path="/" element={<DashboardRouter />} />
                                      <Route path="/dashboard" element={<DashboardRouter />} />
                                      <Route path="/accounts" element={<Accounts />} />
                                      <Route path="/practices" element={<Practices />} />
                                      <Route path="/representatives" element={<Representatives />} />
                                      <Route path="/patients" element={<Patients />} />
                                      <Route path="/patients/:patientId" element={<PatientDetail />} />
                                      <Route path="/patients/:patientId/intake" element={<PracticePatientIntakeForm />} />
                                      <Route path="/practice/patients/:patientId/medical-vault" element={<PracticePatientMedicalVault />} />
                                      <Route path="/providers" element={<Providers />} />
                                      <Route path="/staff" element={<SubscriptionProtectedRoute><ProGate><Staff /></ProGate></SubscriptionProtectedRoute>} />
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
                      <Route path="/appointment-debug" element={<AppointmentDebugLogs />} />
                      <Route path="/support" element={<Support />} />
                      <Route path="/support-tickets" element={<SupportTickets />} />
                      <Route path="/support-tickets/:ticketId" element={<SupportTicketThread />} />
                      <Route path="/admin/terms" element={<AdminTermsManagement />} />
                                      <Route path="/admin/discount-codes" element={<AdminDiscountCodes />} />
                                      <Route path="/admin/practice-audit" element={<PracticeAuditLog />} />
                                      <Route path="/rep-reports" element={<RepProfitReports />} />
                                      <Route path="/rep-productivity" element={<RepProductivityReport />} />
                                      <Route path="/downline-performance" element={<DownlinePerformanceView />} />
                                      <Route path="/shipping" element={<PharmacyShipping />} />
                                       <Route path="/appointments" element={<PatientAppointments />} />
                                       <Route path="/medical-vault" element={<PatientMedicalVault />} />
                                       <Route path="/documents" element={<PatientDocuments />} />
                                       <Route path="/patient-messages" element={<PatientMessages />} />
                                       <Route path="/practice/patient-inbox" element={<SubscriptionProtectedRoute><PatientInbox /></SubscriptionProtectedRoute>} />
                                       <Route path="/practice-calendar" element={<SubscriptionProtectedRoute><PracticeCalendar /></SubscriptionProtectedRoute>} />
                                       <Route path="/video-consultations" element={<SubscriptionProtectedRoute><VideoConsultations /></SubscriptionProtectedRoute>} />
                                       <Route path="/document-center" element={<SubscriptionProtectedRoute><DocumentCenter /></SubscriptionProtectedRoute>} />
                                      <Route path="/my-subscription" element={<SubscriptionProtectedRoute><MySubscription /></SubscriptionProtectedRoute>} />
                                      <Route path="/practice-reporting" element={<SubscriptionProtectedRoute><PracticeReporting /></SubscriptionProtectedRoute>} />
                                      <Route path="/internal-chat" element={<SubscriptionProtectedRoute><InternalChat /></SubscriptionProtectedRoute>} />
                                      {/* Patient Inbox removed - now integrated into Messages */}
                                      {/* Redirect old practice-patients route to new merged Patients page */}
                                      <Route path="/practice-patients" element={<Navigate to="/patients" replace />} />
                                      <Route path="*" element={<NotFound />} />
                                    </Routes>
                                  </AnimatePresence>
                                </Suspense>
                                </div>
                              </div>
                            </main>
                          </div>
                        </SidebarLayout>
                      </ProtectedRoute>} />
                </Routes>
              </Suspense>
              </GlobalImpersonationBanner>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
    </TooltipProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </QueryClientProvider>;
export default App; // deploy trigger 2 - 2025-11-07 16:36