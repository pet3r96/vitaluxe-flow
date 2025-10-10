import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Mail, Phone, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function MyDownlines() {
  const { user, effectiveUserId } = useAuth();

  // Get topline rep ID
  // Topline rep lookup via reps removed to avoid backend policy recursion; not required for listing downlines


  // Get downlines assigned to this topline (supports both assignment and profile linkage)
  const { data: downlines, isLoading: isDownlinesLoading } = useQuery({
    queryKey: ["my-downlines", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, company")
        .eq("linked_topline_id", effectiveUserId)
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveUserId,
  });

  // Get practice count for each downline
  const practiceCountsMap: Record<string, number> = {};

  if (isDownlinesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading downlines...</div>
      </div>
    );
  }


  const downlineList = downlines || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Downlines</h1>
          <p className="text-muted-foreground mt-1">
            Manage your network of downline representatives
          </p>
        </div>
      </div>

      {downlineList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No downlines yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Contact your administrator to have downline reps assigned to you
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {downlineList.map((downline: any) => (
            <Card key={downline.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{downline.name}</CardTitle>
                  <Badge variant="secondary">Downline</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{downline.email}</span>
                </div>
                {downline.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{downline.phone}</span>
                  </div>
                )}
                {downline.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{downline.company}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Practices:</span>
                  <Badge variant="outline">{practiceCountsMap?.[downline.id] || 0}</Badge>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Network Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Downlines:</span>
            <span className="text-2xl font-bold text-primary">{downlineList.length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
