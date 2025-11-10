import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, FileText, Calendar, Package, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

export function RecentActivityWidget({ className }: { className?: string }) {
  const { effectivePracticeId, effectiveRole, effectiveUserId } = useAuth();
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recent-activity", effectivePracticeId, effectiveRole, effectiveUserId],
    enabled: !!effectiveUserId,
    queryFn: async () => {
      if (!effectiveUserId) return [] as any[];
      
      // For pharmacies, get orders and messages
      if (effectiveRole === 'pharmacy') {
        const { data: pharmacyData } = await supabase
          .from('pharmacies')
          .select('id')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (!pharmacyData) return [];

        // Get recent order lines (limited to prevent timeout)
        const { data: orderLines } = await supabase
          .from('order_lines')
          .select(`
            order_id,
            updated_at,
            orders!inner(id, status, updated_at)
          `)
          .eq('assigned_pharmacy_id', pharmacyData.id)
          .order('updated_at', { ascending: false })
          .limit(10);

        const combined: any[] = [];
        const seenOrders = new Set();

        orderLines?.forEach((line: any) => {
          if (!seenOrders.has(line.order_id)) {
            seenOrders.add(line.order_id);
            combined.push({
              type: "order",
              icon: Package,
              description: `Order #${line.order_id.slice(0, 8)} - ${line.orders.status}`,
              time: line.orders.updated_at,
            });
          }
        });

        // Get recent messages
        const { data: messages } = await supabase
          .from('message_threads')
          .select('id, subject, updated_at, thread_type')
          .or(`created_by.eq.${effectiveUserId},thread_participants.user_id.eq.${effectiveUserId}`)
          .order('updated_at', { ascending: false })
          .limit(5);

        messages?.forEach((msg: any) => {
          combined.push({
            type: "message",
            icon: FileText,
            description: `${msg.thread_type === 'support' ? 'Support' : 'Order Issue'}: ${msg.subject}`,
            time: msg.updated_at,
          });
        });

        return combined
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 5);
      }

      // Reps: show their own support tickets
      if (effectiveRole === 'topline' || effectiveRole === 'downline') {
        const { data: threads } = await supabase
          .from('message_threads')
          .select('id, subject, updated_at')
          .eq('thread_type', 'support')
          .eq('created_by', effectiveUserId)
          .order('updated_at', { ascending: false })
          .limit(5);

        return (threads || []).map(t => ({
          type: 'message',
          icon: FileText,
          description: `Support: ${t.subject}`,
          time: t.updated_at,
        }));
      }

      // Admin: show threads the admin created or participates in
      if (effectiveRole === 'admin') {
        // Use two separate queries to avoid nested relation issues with or()
        const [createdThreadsResult, participantThreadsResult] = await Promise.all([
          // Threads created by admin
          supabase
            .from('message_threads')
            .select('id, subject, updated_at, thread_type')
            .eq('created_by', effectiveUserId)
            .order('updated_at', { ascending: false })
            .limit(10),
          
          // Threads where admin is participant
          supabase
            .from('thread_participants')
            .select(`
              thread_id,
              message_threads!inner(
                id,
                subject,
                updated_at,
                thread_type
              )
            `)
            .eq('user_id', effectiveUserId)
            .order('message_threads.updated_at', { ascending: false })
            .limit(10)
        ]);

        // Combine and deduplicate threads
        const threadMap = new Map();
        
        // Add created threads
        createdThreadsResult.data?.forEach((thread: any) => {
          threadMap.set(thread.id, thread);
        });
        
        // Add participant threads
        participantThreadsResult.data?.forEach((pt: any) => {
          const thread = pt.message_threads;
          if (thread && !threadMap.has(thread.id)) {
            threadMap.set(thread.id, thread);
          }
        });

        // Sort by updated_at and take top 5
        const allThreads = Array.from(threadMap.values())
          .sort((a: any, b: any) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )
          .slice(0, 5);

        return allThreads.map((t: any) => ({
          type: 'message',
          icon: FileText,
          description: `${t.thread_type === 'support' ? 'Support' : 'Order Issue'}: ${t.subject}`,
          time: t.updated_at,
        }));
      }

      // For practices, get their orders
      if (!effectivePracticeId) return [] as any[];
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, updated_at")
        .eq("doctor_id", effectivePracticeId)
        .order("updated_at", { ascending: false })
        .limit(5) as any;
      
      // Get recent appointments
      const { data: appointments } = await supabase
        .from("patient_appointments")
        .select("id, status, updated_at, practice_id, patient_accounts(id, first_name, last_name)")
        .eq("practice_id", effectivePracticeId)
        .order("updated_at", { ascending: false })
        .limit(5) as any;
      
      // Get recent documents (if accessible)
      const { data: documents } = await supabase
        .from("provider_documents" as any)
        .select("id, document_name, status, updated_at, practice_id")
        .eq("practice_id", effectivePracticeId)
        .order("updated_at", { ascending: false })
        .limit(5) as any;

      // Combine and sort all activities
      const combined: any[] = [];

      orders?.forEach((order) => {
        combined.push({
          type: "order",
          icon: Package,
          description: `Order status changed to ${order.status}`,
          time: order.updated_at,
        });
      });

      appointments?.forEach((appt) => {
        const patientName = appt.patient_accounts 
          ? `${appt.patient_accounts.first_name || ''} ${appt.patient_accounts.last_name || ''}`.trim() || 'Patient'
          : 'Patient';
        combined.push({
          type: "appointment",
          icon: Calendar,
          description: `Appointment ${appt.status} - ${patientName}`,
          time: appt.updated_at,
        });
      });

      documents?.forEach((doc) => {
        combined.push({
          type: "document",
          icon: FileText,
          description: `Document "${doc.document_name}" ${doc.status}`,
          time: doc.updated_at,
        });
      });

      // Sort by time and take top 5
      return combined
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5);
    },
    refetchInterval: 60000,
  });

  return (
    <Card variant="modern" className={className}>
      <CardHeader className="bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/30 dark:to-teal-900/20">
        <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted/50 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-2">
            {activities.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <div 
                  key={index} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-br from-teal-50/50 to-teal-100/30 dark:from-teal-950/20 dark:to-teal-900/10 hover:scale-[1.01] transition-transform duration-200"
                >
                  <Icon className="h-5 w-5 mt-0.5 text-teal-600 dark:text-teal-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-16 w-16 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}