// Deployment trigger - 2025-11-07 16:30
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { DeveloperRoute } from "./components/DeveloperRoute";
import { SessionTimer } from "./components/auth/SessionTimer";
import { realtimeManager } from "./lib/realtimeManager";
import { ProGate } from "./components/subscription/ProGate";

// Helper function to retry dynamic imports on failure
const lazyWithRetry = (componentImport: () => Promise<any>, componentName: string = "Component") =>
  lazy(async () => {
    const retryKey = "vitaluxe-chunk-retry";
    const hasRetried = window.sessionStorage.getItem(retryKey) === "true";
    try {
      const component = await componentImport();
      // Clear retry flag on successful load
      window.sessionStorage.removeItem(retryKey);
      return component;
    } catch (error: any) {
      const msg = error?.message || "";
      const name = error?.name || "";

      // Comprehensive chunk error detection
      const isChunkError =
        name === "ChunkLoadError" ||
        name === "SyntaxError" ||
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
          componentName,
        });

        // Auto-reload once
        if (!hasRetried) {
          window.sessionStorage.setItem(retryKey, "true");
          setTimeout(() => {
            window.location.href = window.location.pathname + "?v=" + Date.now();
          }, 1000);
          return new Promise(() => {}); // Prevent further execution
        }
      }

      console.error(`[App] Component load failed for ${componentName}:`, {
        name,
        message: msg,
        isChunkError,
        hasRetried,
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
const Cart = lazy(() => import("./pages/Cart"));
const DeliveryConfirmation = lazy(() => import("./pages/DeliveryConfirmation"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Downlines = lazy(() => import("./pages/Downlines"));
const MedSpas = lazy(() => import("./pages/MedSpas"));
const Profile = lazy(() => import("./pages/Profile"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const AppointmentDebugLogs = lazy(() => import("./pages/AppointmentDebugLogs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyDownlines = lazy(() => import("./pages/MyDownlines"));
const RepProfitReports = lazy(() => import("./pages/RepProfitReports"));
// Phase 6: ChangePassword removed (user_password_status table dropped)
const AcceptTerms = lazy(() => import("./pages/AcceptTerms"));
const AdminTermsManagement = lazy(() => import("./pages/AdminTermsManagement"));
const PharmacyApiLogs = lazy(() => import("./pages/PharmacyApiLogs"));
// Phase 6: Removed Reports, Security, AdminDiscountCodes, PracticeAuditLog, AdminAlerts (tables dropped)
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const PharmacyShipping = lazy(() => import("./pages/PharmacyShipping"));
// Phase 6: RepProductivityReport and DownlinePerformanceView removed (tables dropped)
const DashboardRouter = lazyWithRetry(() => import("./components/DashboardRouter"), "DashboardRouter");
const SubscribeToVitaLuxePro = lazy(() => import("./pages/SubscribeToVitaLuxePro"));
const PatientDashboard = lazy(() => import("./pages/patient/PatientDashboard"));
const PatientAppointments = lazy(() => import("./pages/patient/PatientAppointments"));
// Phase 6: InternalChat removed (internal_messages table dropped)
const PatientMessages = lazy(() => import("./pages/patient/PatientMessages"));
// Phase 6: PatientMedicalVault removed (legacy patient_* tables dropped)
const PatientDocuments = lazy(() => import("./pages/patient/PatientDocuments"));
const PatientProfile = lazy(() => import("./pages/patient/PatientProfile"));
const PatientOnboarding = lazy(() => import("./pages/patient/PatientOnboarding"));
// Phase 6: PatientIntakeForm removed (legacy patient_* tables dropped)
// Phase 6: PatientMobileHeader removed (dependent on deleted components)
const VideoRoom = lazy(() => import("./pages/video/VideoRoom"));
const VideoCallTest = lazy(() => import("./pages/VideoCallTest"));
const PracticeCalendar = lazy(() => import("./pages/practice/PracticeCalendar"));
const PatientInbox = lazy(() => import("./pages/practice/PatientInbox"));
const PracticePatients = lazy(() => import("./pages/practice/PracticePatients"));
const DocumentCenter = lazy(() => import("./pages/practice/DocumentCenter"));
const MySubscription = lazy(() => import("./pages/practice/MySubscription"));
const PracticeReporting = lazy(() => import("./pages/PracticeReporting"));
// Phase 6: PatientDetail removed (legacy patient_* tables dropped)
// Phase 6: PracticePatientMedicalVault removed (legacy patient_* tables dropped)
const PracticePatientIntakeForm = lazy(() => import("./pages/practice/PracticePatientIntakeForm"));
// Phase 6: Support removed (patient_messages table dropped)
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const SupportTicketThread = lazy(() => import("./pages/SupportTicketThread"));
const VideoConsultations = lazy(() => import("./pages/practice/VideoConsultations"));
const VideoGuestJoin = lazy(() => import("./pages/public/VideoGuestJoin"));
const VideoTestRoom = lazy(() => import("./pages/practice/VideoTestRoom"));
const TokenVerificationTest = lazy(() => import("./pages/practice/TokenVerificationTest"));
const AgoraDebugSuite = lazy(() => import("./pages/dev/AgoraDebugSuite"));

<Route
  path="/dev/agora-debug"
  element={
    <DeveloperRoute>
      <AgoraDebugSuite />
    </DeveloperRoute>
  }
/>;

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

// Query client imported from centralized config
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

  return <SidebarProvider defaultOpen={defaultOpen}>{children}</SidebarProvider>;
};

const App = () => {
  console.time('App-Mount');
  
  return (
    <QueryClientProvider client={queryClient}>
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
                    <ErrorBoundary>
                      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                        <Global2FADialogs />
                        <GlobalIntakeDialog />
                      </Suspense>
                    </ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/verify-email" element={<VerifyEmail />} />
                      <Route path="/change-password" element={<ChangePassword />} />
                      <Route path="/video-guest/:token" element={<VideoGuestJoin />} />
                      <Route
                        path="/accept-terms"
                        element={
                          <ProtectedRoute>
                            <AcceptTerms />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/patient-onboarding"
                        element={
                          <ProtectedRoute>
                            <PatientOnboarding />
                          </ProtectedRoute>
                        }
                      />
                      {/* Phase 6: /intake route removed (PatientIntakeForm deleted) */}
                      <Route
                        path="/subscribe-to-vitaluxepro"
                        element={
                          <ProtectedRoute>
                            <PracticeOnlyRoute>
                              <SubscribeToVitaLuxePro />
                            </PracticeOnlyRoute>
                          </ProtectedRoute>
                        }
                      />

                      {/* ========================================== */}
                      {/* VIDEO ROUTES - MUST BE BEFORE CATCH-ALL   */}
                      {/* ========================================== */}
                      <Route
                        path="/video/test"
                        element={
                          <ProtectedRoute>
                            <VideoCallTest />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/video/room"
                        element={
                          <ProtectedRoute>
                            <VideoRoom />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/*"
                        element={
                          <ProtectedRoute>
                            <SidebarLayout>
                              <div className="flex min-h-screen w-full vitaluxe-base-bg overflow-hidden">
                                <AppSidebar />
                                <main className="flex-1 flex flex-col overflow-y-auto">
                                  {/* Phase 6: PatientMobileHeader removed */}
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
                                            {/* Phase 6: /patients/:patientId removed (PatientDetail deleted) */}
                                            <Route
                                              path="/patients/:patientId/intake"
                                              element={<PracticePatientIntakeForm />}
                                            />
                                            {/* Phase 6: /practice/patients/:patientId/medical-vault removed (PracticePatientMedicalVault deleted) */}
                                            <Route path="/providers" element={<Providers />} />
                                            <Route
                                              path="/staff"
                                              element={
                                                <SubscriptionProtectedRoute>
                                                  <ProGate>
                                                    <Staff />
                                                  </ProGate>
                                                </SubscriptionProtectedRoute>
                                              }
                                            />
                                            <Route path="/products" element={<Products />} />
                                            <Route path="/orders" element={<Orders />} />
                                            <Route path="/messages" element={<Messages />} />
                                            <Route path="/pharmacies" element={<Pharmacies />} />
                                            {/* Phase 6: /reports removed (Reports page deleted) */}
                                            <Route path="/cart" element={<Cart />} />
                                            <Route path="/delivery-confirmation" element={<DeliveryConfirmation />} />
                                            <Route path="/checkout" element={<Checkout />} />
                                            <Route path="/order-confirmation" element={<Checkout />} />
                                            <Route path="/downlines" element={<MyDownlines />} />
                                            <Route path="/med-spas" element={<MedSpas />} />
                                            <Route path="/profile" element={<Profile />} />
                                            <Route path="/admin-settings" element={<AdminSettings />} />
                                            <Route path="/subscriptions" element={<Subscriptions />} />
                                            {/* Phase 6: /security removed (Security page deleted) */}
                                            <Route path="/appointment-debug" element={<AppointmentDebugLogs />} />
                                            {/* Phase 6: /support removed (Support page deleted) */}
                                            <Route path="/support-tickets" element={<SupportTickets />} />
                                            <Route
                                              path="/support-tickets/:ticketId"
                                              element={<SupportTicketThread />}
                                            />
                                            <Route path="/admin/terms" element={<AdminTermsManagement />} />
                                            {/* Phase 6: Removed /admin/discount-codes, /admin/practice-audit, /admin/alerts (pages deleted) */}
                                            <Route path="/admin/pharmacy-api-logs" element={<PharmacyApiLogs />} />
                                            <Route path="/rep-reports" element={<RepProfitReports />} />
                                            {/* Phase 6: /rep-productivity and /downline-performance removed (reports deleted) */}
                                            <Route path="/shipping" element={<PharmacyShipping />} />
                                            <Route path="/appointments" element={<PatientAppointments />} />
                                            {/* Phase 6: /medical-vault removed (PatientMedicalVault deleted) */}
                                            <Route path="/documents" element={<PatientDocuments />} />
                                            <Route path="/patient-messages" element={<PatientMessages />} />
                                            <Route
                                              path="/practice/patient-inbox"
                                              element={
                                                <SubscriptionProtectedRoute>
                                                  <PatientInbox />
                                                </SubscriptionProtectedRoute>
                                              }
                                            />
                                            <Route
                                              path="/practice-calendar"
                                              element={
                                                <SubscriptionProtectedRoute>
                                                  <PracticeCalendar />
                                                </SubscriptionProtectedRoute>
                                              }
                                            />
                                            {/* Video Consultations temporarily disabled - feature coming soon */}
                                            {/* <Route
                                              path="/video-consultations"
                                              element={
                                                <SubscriptionProtectedRoute>
                                                  <VideoConsultations />
                                                </SubscriptionProtectedRoute>
                                              }
                                            /> */}
                                            <Route
                                              path="/video-test"
                                              element={
                                                <DeveloperRoute>
                                                  <VideoTestRoom />
                                                </DeveloperRoute>
                                              }
                                            />
                                            <Route
                                              path="/token-verification-test"
                                              element={
                                                <DeveloperRoute>
                                                  <TokenVerificationTest />
                                                </DeveloperRoute>
                                              }
                                            />
                                            <Route
                                              path="/dev/agora-debug"
                                              element={
                                                <DeveloperRoute>
                                                  <AgoraDebugSuite />
                                                </DeveloperRoute>
                                              }
                                            />
                                            <Route
                                              path="/document-center"
                                              element={
                                                <SubscriptionProtectedRoute>
                                                  <DocumentCenter />
                                                </SubscriptionProtectedRoute>
                                              }
                                            />
                                            <Route path="/my-subscription" element={<MySubscription />} />
                                            <Route
                                              path="/practice-reporting"
                                              element={
                                                <SubscriptionProtectedRoute>
                                                  <PracticeReporting />
                                                </SubscriptionProtectedRoute>
                                              }
                                            />
                                            {/* Phase 6: /internal-chat removed (InternalChat deleted) */}
                                            {/* Patient Inbox removed - now integrated into Messages */}
                                            {/* Redirect old practice-patients route to new merged Patients page */}
                                            <Route
                                              path="/practice-patients"
                                              element={<Navigate to="/patients" replace />}
                                            />
                                            <Route path="*" element={<NotFound />} />
                                          </Routes>
                                        </AnimatePresence>
                                      </Suspense>
                                    </div>
                                  </div>
                                </main>
                              </div>
                            </SidebarLayout>
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
};

export default App;
