import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

export const StaffDiagnostics = () => {
  const { effectiveUserId, effectiveRole, effectivePracticeId } = useAuth();
  
  const { data: diagnostics } = useQuery({
    queryKey: ['staff-diagnostics', effectiveUserId],
    queryFn: async () => {
      const checks = {
        hasPracticeId: !!effectivePracticeId,
        practiceStaff: null as any,
        canOrder: false,
        providerCount: 0,
        supportTicketCount: 0,
        messageThreadCount: 0,
      };
      
      // Check providers membership (unified table)
      const { data: staffData } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', effectiveUserId)
        .neq('role_type', 'provider')
        .eq('active', true)
        .maybeSingle();
      
      checks.practiceStaff = staffData;
      checks.canOrder = staffData?.can_order ?? false;
      
      // Check provider access
      const { count: providerCount } = await supabase
        .from('providers')
        .select('*', { count: 'exact', head: true })
        .eq('practice_id', effectivePracticeId);
      
      checks.providerCount = providerCount ?? 0;
      
      // Check support tickets access
      const { count: ticketCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('practice_id', effectivePracticeId);
      
      checks.supportTicketCount = ticketCount ?? 0;
      
      // Check message threads access
      const { count: threadCount } = await supabase
        .from('message_threads')
        .select('*', { count: 'exact', head: true });
      
      checks.messageThreadCount = threadCount ?? 0;
      
      return checks;
    },
    enabled: effectiveRole === 'staff',
  });
  
  if (effectiveRole !== 'staff') return null;
  
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="text-xs space-y-1">
          <div className="font-semibold mb-2">Staff Access Diagnostics</div>
          <div className="flex items-center gap-2">
            {diagnostics?.hasPracticeId ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
            <span>Practice ID: {effectivePracticeId || 'Missing'}</span>
          </div>
          <div className="flex items-center gap-2">
            {diagnostics?.practiceStaff ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
            <span>Staff Membership: {diagnostics?.practiceStaff ? 'Active' : 'Missing'}</span>
          </div>
          <div className="flex items-center gap-2">
            {diagnostics?.canOrder ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
            <span>Can Order: {diagnostics?.canOrder ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center gap-2">
            {(diagnostics?.providerCount ?? 0) > 0 ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
            <span>Providers visible: {diagnostics?.providerCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            {(diagnostics?.supportTicketCount ?? 0) >= 0 ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
            <span>Support tickets visible: {diagnostics?.supportTicketCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            {(diagnostics?.messageThreadCount ?? 0) >= 0 ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
            <span>Message threads visible: {diagnostics?.messageThreadCount ?? 0}</span>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
