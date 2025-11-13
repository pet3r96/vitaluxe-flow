import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TreatmentPlan, 
  TreatmentPlanGoal, 
  TreatmentPlanUpdate, 
  TreatmentPlanAttachment,
  useUpdateGoal,
  useLockPlan,
  useUpdateTreatmentPlan,
  useDeleteAttachment
} from "@/hooks/useTreatmentPlans";
import { GoalsProgressIndicator } from "./GoalsProgressIndicator";
import {
  Calendar,
  User,
  Edit,
  Lock,
  Unlock,
  Plus,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { generateTreatmentPlanPDF } from "@/lib/treatmentPlanPdfGenerator";

interface TreatmentPlanDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: TreatmentPlan;
  goals: TreatmentPlanGoal[];
  updates: TreatmentPlanUpdate[];
  attachments: TreatmentPlanAttachment[];
  onEdit: () => void;
  onAddUpdate: () => void;
  patientName: string;
}

const statusConfig = {
  planned: { label: "Planned", className: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", className: "bg-yellow-500 text-white" },
  on_hold: { label: "On Hold", className: "bg-orange-500 text-white" },
  completed: { label: "Completed", className: "bg-green-500 text-white" },
  cancelled: { label: "Cancelled", className: "bg-red-500 text-white" },
};

const updateTypeLabels = {
  progress_note: { label: "Progress Note", className: "bg-blue-500" },
  status_change: { label: "Status Change", className: "bg-purple-500" },
  goal_update: { label: "Goal Update", className: "bg-green-500" },
  treatment_completed: { label: "Treatment Completed", className: "bg-emerald-500" },
  complication: { label: "Complication", className: "bg-red-500" },
  patient_feedback: { label: "Patient Feedback", className: "bg-yellow-500" },
  provider_note: { label: "Provider Note", className: "bg-indigo-500" },
};

export function TreatmentPlanDetailsDialog({
  open,
  onOpenChange,
  plan,
  goals,
  updates,
  attachments,
  onEdit,
  onAddUpdate,
  patientName,
}: TreatmentPlanDetailsDialogProps) {
  const { user, effectiveRole } = useAuth();
  const updateGoal = useUpdateGoal();
  const lockPlan = useLockPlan();
  const updatePlanStatus = useUpdateTreatmentPlan();
  const deleteAttachment = useDeleteAttachment();

  const [selectedGoal, setSelectedGoal] = useState<TreatmentPlanGoal | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [achievementNotes, setAchievementNotes] = useState("");
  const [deleteAttachmentId, setDeleteAttachmentId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const canEdit = !plan.is_locked && user?.id;
  const isAdmin = effectiveRole === 'admin';

  const handleStatusChange = async (newStatus: string) => {
    await updatePlanStatus.mutateAsync({
      planId: plan.id,
      updates: {
        status: newStatus as TreatmentPlan['status'],
        last_updated_by_user_id: user?.id,
        last_updated_by_name: user?.email || 'Unknown',
      },
    });
  };

  const handleLockToggle = async () => {
    if (!user?.id) return;
    
    await lockPlan.mutateAsync({
      planId: plan.id,
      lock: !plan.is_locked,
      userId: user.id,
      userName: user.email || 'Unknown',
    });
  };

  const handleGoalStatusChange = (goal: TreatmentPlanGoal, newStatus: TreatmentPlanGoal['status']) => {
    if (newStatus === 'achieved') {
      setSelectedGoal(goal);
      setGoalDialogOpen(true);
    } else {
      updateGoal.mutateAsync({
        goalId: goal.id,
        updates: {
          status: newStatus,
          last_updated_by_user_id: user?.id,
          last_updated_by_name: user?.email || 'Unknown',
        },
      });
    }
  };

  const confirmGoalAchievement = async () => {
    if (!selectedGoal) return;

    await updateGoal.mutateAsync({
      goalId: selectedGoal.id,
      updates: {
        status: 'achieved',
        date_achieved: new Date().toISOString(),
        achievement_notes: achievementNotes,
        last_updated_by_user_id: user?.id,
        last_updated_by_name: user?.email || 'Unknown',
      },
    });

    setGoalDialogOpen(false);
    setSelectedGoal(null);
    setAchievementNotes("");
  };

  const handleDownloadAttachment = async (attachment: TreatmentPlanAttachment) => {
    const { data, error } = await supabase.storage
      .from('patient-documents')
      .download(attachment.storage_path);

    if (error) {
      toast.error("Failed to download file");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmDeleteAttachment = async () => {
    if (!deleteAttachmentId) return;

    const attachment = attachments.find(a => a.id === deleteAttachmentId);
    if (!attachment) return;

    await deleteAttachment.mutateAsync({
      attachmentId: attachment.id,
      storagePath: attachment.storage_path,
      planId: plan.id,
    });

    setDeleteAttachmentId(null);
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await generateTreatmentPlanPDF({
        plan,
        goals,
        updates,
        attachments,
        patientName,
      });

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TreatmentPlan_${plan.plan_title.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Treatment plan downloaded successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const statusInfo = statusConfig[plan.status];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl">{plan.plan_title}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Created by {plan.created_by_name} • {format(new Date(plan.created_at), 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleDownloadPDF} 
                  variant="outline" 
                  size="sm"
                  disabled={isGeneratingPdf}
                >
                  {isGeneratingPdf ? (
                    <>
                      <Download className="h-4 w-4 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Download PDF
                    </>
                  )}
                </Button>
                {canEdit && (
                  <>
                    <Button onClick={onEdit} variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button onClick={onAddUpdate} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Update
                    </Button>
                  </>
                )}
                {isAdmin && (
                  <Button onClick={handleLockToggle} variant="outline" size="sm">
                    {plan.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
            <div className="space-y-6">
              {/* Status and Key Info */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {canEdit ? (
                    <Select value={plan.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                  )}
                </div>

                {plan.is_locked && (
                  <Badge variant="outline">
                    <Lock className="h-3 w-3 mr-1" />
                    Locked {plan.locked_at && `on ${format(new Date(plan.locked_at), 'MMM dd')}`}
                  </Badge>
                )}

                {plan.responsible_provider_name && (
                  <div className="flex items-center gap-1 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{plan.responsible_provider_name}</span>
                  </div>
                )}

                {plan.target_completion_date && (
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Target: {format(new Date(plan.target_completion_date), 'MMM dd, yyyy')}</span>
                  </div>
                )}
              </div>

              {/* Plan Details */}
              {plan.diagnosis_condition && (
                <div>
                  <h3 className="font-semibold mb-2">Diagnosis / Condition</h3>
                  <p className="text-sm text-muted-foreground">{plan.diagnosis_condition}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Treatment Protocols</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.treatment_protocols}</p>
              </div>

              {plan.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{plan.notes}</p>
                </div>
              )}

              <Separator />

              {/* Goals Section */}
              <div>
                <h3 className="font-semibold mb-4">Treatment Goals</h3>
                <GoalsProgressIndicator goals={goals} />
                
                <div className="mt-4 space-y-3">
                  {goals.map((goal) => (
                    <div key={goal.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            {goal.status === 'achieved' ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : goal.status === 'ongoing' ? (
                              <Circle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{goal.goal_description}</p>
                              
                              {/* SMART Indicators */}
                              {(goal.is_specific || goal.is_measurable || goal.is_achievable || goal.is_relevant || goal.is_time_bound) && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {goal.is_specific && <Badge variant="outline" className="text-xs">S</Badge>}
                                  {goal.is_measurable && <Badge variant="outline" className="text-xs">M</Badge>}
                                  {goal.is_achievable && <Badge variant="outline" className="text-xs">A</Badge>}
                                  {goal.is_relevant && <Badge variant="outline" className="text-xs">R</Badge>}
                                  {goal.is_time_bound && <Badge variant="outline" className="text-xs">T</Badge>}
                                </div>
                              )}

                              {goal.date_achieved && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Achieved on {format(new Date(goal.date_achieved), 'MMM dd, yyyy')}
                                </p>
                              )}

                              {goal.achievement_notes && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  {goal.achievement_notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {canEdit && (
                          <Select
                            value={goal.status}
                            onValueChange={(value) => handleGoalStatusChange(goal, value as TreatmentPlanGoal['status'])}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ongoing">Ongoing</SelectItem>
                              <SelectItem value="achieved">Achieved</SelectItem>
                              <SelectItem value="modified">Modified</SelectItem>
                              <SelectItem value="abandoned">Abandoned</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Attachments Section */}
              {attachments.length > 0 && (
                <>
                  <div>
                    <h3 className="font-semibold mb-4">Attachments ({attachments.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteAttachmentId(attachment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div>
                            <p className="text-xs font-medium truncate">{attachment.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.attachment_type.replace('_', ' ')}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleDownloadAttachment(attachment)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Timeline Section */}
              <div>
                <h3 className="font-semibold mb-4">Progress Timeline ({updates.length})</h3>
                <div className="space-y-4">
                  {updates.map((update) => {
                    const typeInfo = updateTypeLabels[update.update_type];
                    return (
                      <div key={update.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`rounded-full p-2 ${typeInfo.className}`}>
                            <FileText className="h-4 w-4 text-white" />
                          </div>
                          <div className="w-0.5 h-full bg-border mt-2" />
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${typeInfo.className} text-white text-xs`}>
                              {typeInfo.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">
                            {update.created_by_name} • {update.created_by_role}
                          </p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {update.update_content}
                          </p>
                          {update.previous_status && update.new_status && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Status changed: {update.previous_status} → {update.new_status}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Goal Achievement Dialog */}
      <AlertDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Goal as Achieved</AlertDialogTitle>
            <AlertDialogDescription>
              Congratulations! Add any notes about how this goal was achieved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Achievement notes (optional)..."
            value={achievementNotes}
            onChange={(e) => setAchievementNotes(e.target.value)}
            className="min-h-24"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGoalAchievement}>
              Mark as Achieved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Attachment Confirmation */}
      <AlertDialog open={!!deleteAttachmentId} onOpenChange={() => setDeleteAttachmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAttachment} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
