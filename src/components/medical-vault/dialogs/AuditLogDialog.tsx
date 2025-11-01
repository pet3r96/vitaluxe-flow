import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, User, Calendar, Activity, Download } from "lucide-react";
import type { AuditLog } from "@/hooks/useAuditLogs";
import { generateAuditReportPDF } from "@/lib/auditReportPdfGenerator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AuditLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditLogs: AuditLog[];
  patientName?: string;
  patientAccountId?: string;
  isLoading?: boolean;
}

export function AuditLogDialog({ open, onOpenChange, auditLogs, patientName, patientAccountId, isLoading }: AuditLogDialogProps) {
  const handleDownload = async () => {
    try {
      // For now, use the provided auditLogs, but in future we might want to re-fetch
      const logsToExport = auditLogs || [];
      
      if (logsToExport.length === 0) {
        toast({ 
          title: "No Data", 
          description: "No audit logs found to export", 
          variant: "destructive" 
        });
        return;
      }
      
      const pdfBlob = await generateAuditReportPDF(patientName || 'Patient', logsToExport);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${patientName?.replace(/\s+/g, '_')}_Audit_Log_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Audit report downloaded" });
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: "Error", description: "Failed to download audit report", variant: "destructive" });
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'created':
        return 'success';
      case 'updated':
        return 'info';
      case 'deleted':
        return 'destructive';
      case 'pre_intake_completed':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getEntityTypeDisplay = (entityType: string) => {
    const mapping: Record<string, string> = {
      medication: 'Medication',
      condition: 'Medical Condition',
      allergy: 'Allergy',
      vital: 'Vital Signs',
      immunization: 'Immunization',
      surgery: 'Surgery',
      pharmacy: 'Pharmacy',
      emergency_contact: 'Emergency Contact',
      demographics: 'Demographics',
      pre_intake_form: 'Pre-Intake Form',
    };
    return mapping[entityType] || entityType;
  };

  const getRoleDisplay = (role?: string) => {
    if (!role) return 'System';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Medical Vault Audit Log
              {patientName && <span className="text-muted-foreground">- {patientName}</span>}
            </DialogTitle>
            <Button onClick={handleDownload} size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50 animate-spin" />
              <p>Loading audit logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit log entries found</p>
              <p className="text-xs mt-2">
                Actions performed in this session will appear here after being logged.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={getActionBadgeVariant(log.action_type)}>
                          {log.action_type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {getEntityTypeDisplay(log.entity_type)}
                        </Badge>
                        {log.entity_name && (
                          <span className="font-medium">{log.entity_name}</span>
                        )}
                      </div>
                      
                      {log.change_summary && (
                        <p className="text-sm text-muted-foreground">
                          {log.change_summary}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(log.created_at), 'MMM dd, yyyy h:mm a')}
                    </div>
                    {log.changed_by_role && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        By: {getRoleDisplay(log.changed_by_role)}
                      </div>
                    )}
                  </div>
                  
                  {(log.old_data || log.new_data) && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        View details
                      </summary>
                      <div className="mt-2 space-y-2 p-2 bg-muted/30 rounded">
                        {log.old_data && (
                          <div>
                            <p className="font-medium mb-1">Previous Data:</p>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(log.old_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_data && (
                          <div>
                            <p className="font-medium mb-1">New Data:</p>
                            <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
