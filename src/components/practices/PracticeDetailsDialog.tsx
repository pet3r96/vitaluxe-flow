import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ExternalLink, Copy, Pencil, Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  onSuccess,
}: PracticeDetailsDialogProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [repComboboxOpen, setRepComboboxOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    npi: "",
    license_number: "",
    dea: "",
    selectedRepId: "",
  });

  // Check if current user is admin
  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      return data?.role;
    },
  });

  const isAdmin = userRole === "admin";

  // Fetch all topline and downline reps
  // Fetch topline reps
  const { data: toplineReps } = useQuery({
    queryKey: ["topline-reps-for-practices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "topline")
        .eq("active", true)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && isAdmin,
  });

  // Fetch downline reps
  const { data: downlineReps } = useQuery({
    queryKey: ["downline-reps-for-practices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "downline")
        .eq("active", true)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && isAdmin,
  });

  // Combine both arrays and sort by name
  const allReps = [...(toplineReps || []), ...(downlineReps || [])].sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  // Fetch current assigned rep
  const { data: assignedRep } = useQuery({
    queryKey: ["practice-assigned-rep", provider?.id],
    queryFn: async () => {
      if (!provider?.linked_topline_id) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq("id", provider.linked_topline_id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!provider?.linked_topline_id && open,
  });

  // Initialize form data when provider changes
  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name || "",
        email: provider.email || "",
        phone: provider.phone || "",
        address: provider.address || "",
        npi: provider.npi || "",
        license_number: provider.license_number || "",
        dea: provider.dea || "",
        selectedRepId: provider.linked_topline_id || "",
      });
    }
  }, [provider]);

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          phone: formData.phone,
          address: formData.address,
          npi: formData.npi,
          license_number: formData.license_number,
          dea: formData.dea,
          linked_topline_id: formData.selectedRepId || null,
        })
        .eq("id", provider.id);

      if (error) throw error;

      toast.success("Practice updated successfully");
      setIsEditing(false);
      onSuccess();
    } catch (error) {
      toast.error("Failed to update practice");
      console.error(error);
    }
  };

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
            <div className="flex items-center gap-2">
              <Badge variant={provider.active ? "default" : "secondary"}>
                {provider.active ? "Active" : "Inactive"}
              </Badge>
              {isAdmin && !isEditing && (
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {isAdmin && isEditing && (
                <>
                  <Button size="sm" onClick={handleSave}>
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
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
                  {isEditing ? (
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{provider.name}</p>
                  )}
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
                  {isEditing ? (
                    <Input
                      value={formData.npi}
                      onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                    />
                  ) : (
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
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">License Number</p>
                  {isEditing ? (
                    <Input
                      value={formData.license_number}
                      onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    />
                  ) : (
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
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">DEA Number</p>
                  {isEditing ? (
                    <Input
                      value={formData.dea}
                      onChange={(e) => setFormData({ ...formData, dea: e.target.value })}
                    />
                  ) : (
                    <p className="font-mono font-medium">{provider.dea || "-"}</p>
                  )}
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
                  <p className="text-sm text-muted-foreground">Phone</p>
                  {isEditing ? (
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{provider.phone || "-"}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  {isEditing ? (
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{provider.address || "-"}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Assigned Representative (Optional)</p>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Popover open={repComboboxOpen} onOpenChange={setRepComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              size="sm"
                              aria-expanded={repComboboxOpen}
                              className="w-full justify-between"
                            >
                              {formData.selectedRepId
                                ? allReps?.find((rep) => rep.id === formData.selectedRepId)?.name
                                : "Select representative (optional)..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search reps..." />
                              <CommandList>
                                <CommandEmpty>No representative found.</CommandEmpty>
                                <CommandGroup>
                                  {allReps?.map((rep) => (
                                    <CommandItem
                                      key={rep.id}
                                      value={`${rep.name} ${rep.email}`}
                                      onSelect={() => {
                                        setFormData({ ...formData, selectedRepId: rep.id });
                                        setRepComboboxOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.selectedRepId === rep.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{rep.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {rep.email} • {rep.user_roles[0].role}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {formData.selectedRepId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData({ ...formData, selectedRepId: "" })}
                          >
                            Clear selection
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="font-medium">
                        {assignedRep ? `${assignedRep.name} (${assignedRep.user_roles[0].role})` : "None (Admin managed)"}
                      </p>
                    )}
                  </div>
                )}
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
