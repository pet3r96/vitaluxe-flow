import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MessageSquare, FileText, Activity, AlertCircle, Clock, Pill, Video, Building, Heart } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IntakePromptCard } from "@/components/patient/IntakePromptCard";
import { getPatientPracticeSubscription } from "@/lib/patientSubscriptionCheck";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PatientVirtualWaitingRoom } from "@/components/video/PatientVirtualWaitingRoom";
import { usePatientDashboard } from "@/hooks/usePatientDashboard";


export default function PatientDashboard() {
  const navigate = useNavigate();
  const [practiceSubscription, setPracticeSubscription] = useState<any>(null);
  const { effectiveUserId, effectiveRole } = useAuth();

  // Use batched dashboard data hook
  const { data: dashboardData, isLoading: loadingDashboard } = usePatientDashboard(effectiveUserId, effectiveRole);

  // Extract data from batched response
  const patientAccount = dashboardData?.patientAccount;
  const medicalVault = dashboardData?.medicalVault;
  const nextAppointment = dashboardData?.nextAppointment;
  const unreadCount = dashboardData?.unreadMessagesCount || 0;
  const recentAppointments = dashboardData?.recentAppointments || [];
  const recentMessages = dashboardData?.recentMessages || [];

  const loadingAccount = loadingDashboard;
  const loadingVault = loadingDashboard;
  const loadingAppt = loadingDashboard;
  const loadingMessages = loadingDashboard;

  // Check if medical vault is complete
  const isMedicalVaultComplete = (vault: any) => {
    if (!vault) return false;
    return !!(vault.blood_type && vault.allergies_count > 0 && vault.medications_count > 0);
  };

  const vaultComplete = isMedicalVaultComplete(medicalVault);
  const medicationCount = medicalVault?.medications_count || 0;

  // Check practice subscription status
  useEffect(() => {
    const checkPracticeSubscription = async () => {
      if (patientAccount?.id) {
        const status = await getPatientPracticeSubscription(patientAccount.id);
        setPracticeSubscription(status);
      }
    };
    checkPracticeSubscription();
  }, [patientAccount?.id]);

  if (loadingAccount) {
    return (
      <div className="patient-container">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="patient-container w-full max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="text-center mb-6 sm:mb-8 px-2">
        <h1 className="patient-section-header">
          Welcome, {patientAccount?.first_name || 'Patient'}
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm md:text-base mt-1">Your personal health dashboard</p>
      </div>

      {/* Practice Subscription Warning */}
      {practiceSubscription && !practiceSubscription.isSubscribed && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Limited Access</AlertTitle>
          <AlertDescription>
            {practiceSubscription.practiceName}'s subscription is currently inactive. 
            Appointment booking and some features are temporarily unavailable. 
            Please contact your practice for more information.
          </AlertDescription>
        </Alert>
      )}

      {/* Intake Form Prompt - only show if intake not complete */}
      {!patientAccount?.intake_completed_at && (
        <IntakePromptCard onComplete={() => navigate('/intake')} />
      )}

      {/* Medical Vault Onboarding Alert - only show if intake is complete */}
      {patientAccount?.intake_completed_at && !loadingVault && (() => {
        const shouldShowBanner = !medicalVault?.has_data;
        console.log('[PatientDashboard] 🎗️ Banner decision:', {
          intake_completed: !!patientAccount?.intake_completed_at,
          loading_vault: loadingVault,
          has_data: medicalVault?.has_data,
          should_show: shouldShowBanner,
          vault_medications: medicalVault?.medications_count || 0,
          vault_allergies: medicalVault?.allergies_count || 0,
          vault_total: (medicalVault?.medications_count || 0) + (medicalVault?.allergies_count || 0) + 
                       (medicalVault?.conditions_count || 0) + (medicalVault?.surgeries_count || 0)
        });
        return shouldShowBanner;
      })() && (
        <Alert className="border-warning bg-warning/10">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Complete Your Medical Vault</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>Help your healthcare team provide better care by completing your medical information.</span>
            <Button 
              variant="default" 
              size="sm" 
              className="ml-4"
              onClick={() => navigate('/medical-vault')}
            >
              Get Started
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats Cards */}
      <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
        {/* Next Appointment Card */}
        <Card 
          variant="modern"
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-primary overflow-hidden relative touch-manipulation"
          onClick={() => navigate("/appointments")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-[11px] sm:text-xs font-medium">Next Appointment</CardTitle>
            <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 sm:p-4 md:p-6 pt-0">
            {loadingAppt ? (
              <Skeleton className="h-8 w-24" />
            ) : nextAppointment ? (
              <>
                <div className="text-xl sm:text-2xl font-bold mb-1">
                  {format(new Date(nextAppointment.start_time), "MMM dd")}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                  {nextAppointment.visit_type === 'video' ? (
                    <><Video className="h-3 w-3" /> Video Call</>
                  ) : (
                    <><Building className="h-3 w-3" /> In-Person</>
                  )}
                  {' • '}
                  {format(new Date(nextAppointment.start_time), "h:mm a")}
                </p>
              </>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold mb-1">None</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">No upcoming visits</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Unread Messages Card */}
        <Card 
          variant="modern"
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-accent overflow-hidden relative touch-manipulation"
          onClick={() => navigate("/messages")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-[11px] sm:text-xs font-medium">Unread Messages</CardTitle>
            <div className="p-1.5 sm:p-2 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors relative">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 sm:p-4 md:p-6 pt-0">
            {loadingMessages ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold mb-1">{unreadCount}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">From providers</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Medication Reminders Card */}
        <Card 
          variant="modern"
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-secondary overflow-hidden relative touch-manipulation"
          onClick={() => navigate("/medical-vault")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-[11px] sm:text-xs font-medium">Active Medications</CardTitle>
            <div className="p-1.5 sm:p-2 rounded-full bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
              <Pill className="h-4 w-4 sm:h-5 sm:w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 sm:p-4 md:p-6 pt-0">
            {loadingVault ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold mb-1">{medicationCount}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Current prescriptions</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Medical Vault Status Card */}
        <Card 
          variant="modern"
          className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-gold1 overflow-hidden relative touch-manipulation"
          onClick={() => navigate("/medical-vault")}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gold1/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10 p-3 sm:p-4 md:p-6">
            <CardTitle className="text-[11px] sm:text-xs font-medium">Medical Vault</CardTitle>
            <div className="p-1.5 sm:p-2 rounded-full bg-gold1/10 group-hover:bg-gold1/20 transition-colors">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-gold1" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10 p-3 sm:p-4 md:p-6 pt-0">
            {loadingVault ? (
              <Skeleton className="h-8 w-20" />
            ) : medicalVault?.has_data ? (
              <>
                <div className="text-lg sm:text-xl font-bold mb-1 text-success">Complete</div>
                {medicalVault.updated_at && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(medicalVault.updated_at), { addSuffix: true })}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold mb-1 text-warning">Empty</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Not yet set up</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Video Appointments Section */}
      {patientAccount?.id && (
        <div className="mt-6">
          <PatientVirtualWaitingRoom 
            patientId={patientAccount.id}
            onJoinSession={(sessionId) => navigate(`/video-room/${sessionId}`)}
          />
        </div>
      )}

      {/* Recent Activity Section */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Recent Appointments */}
        <Card variant="modern" className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Recent Appointments
            </CardTitle>
            <CardDescription>Your past visits</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {recentAppointments.length > 0 ? (
              <div className="space-y-2">
                {recentAppointments.map((appt: any) => (
                  <div 
                    key={appt.id} 
                    className="group relative p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 cursor-pointer"
                    onClick={() => navigate("/appointments")}
                  >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex justify-between items-start pl-2">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            appt.status === 'completed' ? 'bg-success' :
                            appt.status === 'cancelled' ? 'bg-destructive' :
                            appt.status === 'no_show' ? 'bg-warning' :
                            'bg-muted-foreground'
                          }`} />
                          <p className="font-semibold text-foreground">{appt.practice?.name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(appt.start_time), "MMM dd, yyyy 'at' h:mm a")}
                        </p>
                        <Badge 
                          variant={appt.status === 'completed' ? 'default' : 'outline'} 
                          className="text-xs capitalize"
                        >
                          {appt.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {appt.visit_summary_url && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(appt.visit_summary_url, '_blank');
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No recent appointments</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card variant="modern" className="overflow-hidden w-full">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent p-3 sm:p-4 md:p-6">
            <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Recent Messages
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Latest communications</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {recentMessages.length > 0 ? (
              <div className="space-y-2">
                {recentMessages.map((msg: any) => (
                  <div 
                    key={msg.id} 
                    className="group relative p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-accent/30 transition-all duration-200 cursor-pointer"
                    onClick={() => navigate("/messages")}
                  >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent rounded-r opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-start gap-3 pl-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                        {(msg.sender?.name || 'P')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{msg.subject}</p>
                          {!msg.read_at && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 shrink-0 animate-pulse">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          From: {msg.sender?.name || 'Provider'}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No recent messages</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Medical Vault Snapshot */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick Actions */}
        <Card variant="modern" className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3">
              <div 
                className="group flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 cursor-pointer"
                onClick={() => navigate("/appointments")}
              >
                <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Book Appointment</p>
                  <p className="text-xs text-muted-foreground">Schedule a visit</p>
                </div>
              </div>
              
              <div 
                className="group flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-gold1/5 hover:border-gold1/30 transition-all duration-200 cursor-pointer"
                onClick={() => navigate("/medical-vault")}
              >
                <div className="p-2.5 rounded-lg bg-gold1/10 group-hover:bg-gold1/20 transition-colors">
                  <Activity className="h-5 w-5 text-gold1" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Update Medical Vault</p>
                  <p className="text-xs text-muted-foreground">Manage health records</p>
                </div>
              </div>
              
              <div 
                className="group flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 cursor-pointer"
                onClick={() => navigate("/messages")}
              >
                <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Message Provider</p>
                  <p className="text-xs text-muted-foreground">Send secure message</p>
                </div>
              </div>
              
              <div 
                className="group flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-secondary/5 hover:border-secondary/30 transition-all duration-200 cursor-pointer"
                onClick={() => navigate("/documents")}
              >
                <div className="p-2.5 rounded-lg bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                  <FileText className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">View Documents</p>
                  <p className="text-xs text-muted-foreground">Access medical files</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Vault Snapshot */}
        <Card variant="modern" className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-gold1/5 to-transparent">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gold1" />
              Medical Vault Snapshot
            </CardTitle>
            <CardDescription>Key health information</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {loadingVault ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : medicalVault?.has_data ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Blood Type</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{medicalVault.blood_type || 'Not set'}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium">Allergies</span>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {medicalVault.allergies_count}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-secondary" />
                    <span className="text-sm font-medium">Medications</span>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {medicalVault.medications_count}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Conditions</span>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {medicalVault.conditions_count}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gold1" />
                    <span className="text-sm font-medium">Surgeries</span>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {medicalVault.surgeries_count}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium">Immunizations</span>
                  </div>
                  <Badge variant="outline" className="font-semibold">
                    {medicalVault.immunizations_count}
                  </Badge>
                </div>
                
                <Button 
                  className="w-full mt-4 group" 
                  variant="default"
                  onClick={() => navigate("/medical-vault")}
                >
                  View Full Vault
                  <Activity className="ml-2 h-4 w-4 group-hover:rotate-90 transition-transform" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mx-auto mb-4 p-4 rounded-full bg-muted/50 w-fit">
                  <Activity className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">Your medical vault is empty</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Start building your health profile today
                </p>
                <Button onClick={() => navigate("/medical-vault")} className="mt-2">
                  Set Up Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
