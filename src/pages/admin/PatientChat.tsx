import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function PatientChat() {
  const { data: messages, isLoading } = useQuery({
    queryKey: ['admin-patient-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Patient Chat</h1>
        <p className="text-muted-foreground">View patient message threads</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Messages ({messages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading messages...</div>
          ) : (
            <div className="space-y-4">
              {messages?.map((message) => (
                <div key={message.id} className="border-b pb-4 last:border-0">
                  <p className="text-sm line-clamp-2">{message.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(message.created_at || '').toLocaleString()}
                  </p>
                </div>
              ))}
              {!messages?.length && (
                <p className="text-center text-muted-foreground py-8">No messages found</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
