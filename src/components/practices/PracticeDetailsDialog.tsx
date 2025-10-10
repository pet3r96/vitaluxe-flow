import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

interface PracticeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: any;
  onSuccess: () => void;
}

export const PracticeDetailsDialog = ({
  open,
  onOpenChange,
  provider,
}: PracticeDetailsDialogProps) => {
  const { data: orders } = useQuery({
    queryKey: ["practice-orders", provider?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, created_at, status, total_amount")
        .eq("doctor_id", provider.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!provider?.id && open,
  });

  const { data: stats } = useQuery({
    queryKey: ["practice-stats", provider?.id],
    queryFn: async () => {
      const { data: allOrders, error } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("doctor_id", provider.id);

      if (error) throw error;

      const totalOrders = allOrders?.length || 0;
      const totalRevenue = allOrders?.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        totalOrders,
        totalRevenue,
        avgOrderValue,
      };
    },
    enabled: !!provider?.id && open,
  });

  const { data: providers } = useQuery({
    queryKey: ["practice-providers", provider?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select(`
          id,
          active,
          created_at,
          user_id
        `)
        .eq("practice_id", provider.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch profile details for each provider
      const userIds = data.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, full_name, email, npi, dea, license_number, phone")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Merge provider data with profile data
      return data.map(provider => ({
        ...provider,
        profile: profiles?.find(p => p.id === provider.user_id) || null
      }));
    },
    enabled: !!provider?.id && open,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Practice Details</span>
            <Badge variant={provider.active ? "default" : "secondary"}>
              {provider.active ? "Active" : "Inactive"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{provider.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{provider.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account Created</p>
                  <p className="font-medium">
                    {new Date(provider.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Credentials */}
          <Card>
            <CardHeader>
              <CardTitle>Medical Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">NPI Number</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-medium">{provider.npi || "-"}</p>
                    {provider.npi && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(provider.npi, "NPI")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">License Number</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-medium">{provider.license_number || "-"}</p>
                    {provider.license_number && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(provider.license_number, "License")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">DEA Number</p>
                  <p className="font-mono font-medium">{provider.dea || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact & Practice Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact & Practice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company/Practice</p>
                  <p className="font-medium">{provider.company || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{provider.phone || "-"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{provider.address || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold text-primary">{stats?.totalOrders || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    ${(stats?.totalRevenue || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    ${(stats?.avgOrderValue || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Providers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Providers</span>
                <Badge variant="outline">{providers?.length || 0} Total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {providers && providers.length > 0 ? (
                <div className="space-y-3">
                  {providers.map((prov) => (
                    <div key={prov.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <p className="font-medium">{prov.profile?.full_name || prov.profile?.name}</p>
                        <p className="text-sm text-muted-foreground">{prov.profile?.email}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          {prov.profile?.npi && <span>NPI: {prov.profile.npi}</span>}
                          {prov.profile?.license_number && <span>License: {prov.profile.license_number}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={prov.active ? "default" : "secondary"}>
                          {prov.active ? "Active" : "Inactive"}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Added {new Date(prov.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No providers assigned to this practice yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Contract Document */}
          {provider.contract_url && (
            <Card>
              <CardHeader>
                <CardTitle>Contract Document</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => window.open(provider.contract_url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Contract
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recent Orders */}
          {orders && orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${Number(order.total_amount).toFixed(2)}</p>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
