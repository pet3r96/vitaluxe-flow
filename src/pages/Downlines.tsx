import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Mail, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Downlines() {
  const { user } = useAuth();

  const { data: downlines, isLoading } = useQuery({
    queryKey: ["downlines", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("linked_topline_id", user?.id)
        .eq("active", true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
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
            Manage your network of representatives
          </p>
        </div>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Downline
        </Button>
      </div>

      {downlineList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No downlines yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start building your network by adding representatives
            </p>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Your First Downline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {downlineList.map((downline: any) => (
            <Card key={downline.id}>
              <CardHeader>
                <CardTitle className="text-lg">{downline.name}</CardTitle>
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
                  <div className="text-sm">
                    <span className="font-medium">Company:</span> {downline.company}
                  </div>
                )}
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
