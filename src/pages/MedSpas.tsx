import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Phone, Mail, Plus } from "lucide-react";

export default function MedSpas() {
  const { data: medSpas, isLoading } = useQuery({
    queryKey: ["med-spas"],
    queryFn: async () => {
      // This would query a med_spas table if it existed
      // For now, returning empty array as placeholder
      return [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading med spas...</div>
      </div>
    );
  }

  const spaList = medSpas || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Med Spas</h1>
          <p className="text-muted-foreground mt-1">
            Manage your medical spa clients
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Med Spa
        </Button>
      </div>

      {spaList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No med spas yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start adding your medical spa clients to track orders and commissions
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Med Spa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {spaList.map((spa: any) => (
            <Card key={spa.id}>
              <CardHeader>
                <CardTitle className="text-lg">{spa.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {spa.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{spa.address}</span>
                  </div>
                )}
                {spa.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{spa.phone}</span>
                  </div>
                )}
                {spa.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{spa.email}</span>
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
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Med Spas:</span>
            <span className="font-semibold">{spaList.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active Accounts:</span>
            <span className="font-semibold">{spaList.filter((s: any) => s.active).length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
