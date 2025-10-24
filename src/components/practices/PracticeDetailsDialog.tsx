import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";
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
import { ExternalLink, Copy, Pencil, Check, ChevronsUpDown, X, Info } from "lucide-react";
import { toast } from "sonner";
import { cn, sanitizeEncrypted } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { phoneSchema, npiSchema, deaSchema } from "@/lib/validators";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface PracticeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: any;
  onSuccess: () => void;
}

const practiceEditSchema = z.object({
  name: z.string().min(1, "Practice name is required").max(100),
  phone: phoneSchema,
  address: z.custom<AddressValue>().optional(),
  npi: npiSchema,
  license_number: z.string().optional(),
  dea: deaSchema,
  selectedRepId: z.string().optional(),
});

type PracticeEditFormValues = z.infer<typeof practiceEditSchema>;

export const PracticeDetailsDialog = ({
  open,
  onOpenChange,
  provider,
  onSuccess,
}: PracticeDetailsDialogProps) => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [repComboboxOpen, setRepComboboxOpen] = useState(false);
  
  const form = useForm<PracticeEditFormValues>({
    resolver: zodResolver(practiceEditSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: {},
      npi: "",
      license_number: "",
      dea: "",
      selectedRepId: "",
    },
  });


  // Check if current user is admin
  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    staleTime: 0,
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
    staleTime: 0,
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
    staleTime: 0,
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
    staleTime: 0,
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
      // Construct formatted address from structured fields if main address is missing
      const formattedAddress = provider.address || provider.address_formatted || 
        (provider.address_street ? 
          `${provider.address_street}, ${provider.address_city}, ${provider.address_state} ${provider.address_zip}` 
          : "");

      form.reset({
        name: provider.name || "",
        phone: sanitizeEncrypted(provider.phone) || "",
        address: {
          street: provider.address_street || "",
          city: provider.address_city || "",
          state: provider.address_state || "",
          zip: provider.address_zip || "",
          formatted: formattedAddress,
        },
        npi: sanitizeEncrypted(provider.npi) || "",
        license_number: sanitizeEncrypted(provider.license_number) || "",
        dea: sanitizeEncrypted(provider.dea) || "",
        selectedRepId: provider.linked_topline_id || "",
      });
    }
  }, [provider, form]);

  const handleSave = async (values: PracticeEditFormValues) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: values.name,
          phone: values.phone || null,
          address: values.address?.formatted || null,
          address_street: values.address?.street || null,
          address_city: values.address?.city || null,
          address_state: values.address?.state || null,
          address_zip: values.address?.zip || null,
          address_formatted: values.address?.formatted || null,
          npi: values.npi || null,
          license_number: values.license_number || null,
          dea: values.dea || null,
          linked_topline_id: values.selectedRepId || null,
        })
        .eq("id", provider.id);

      if (error) throw error;

      toast.success("Practice updated successfully");
      setIsEditing(false);
      form.reset(values);
      onSuccess();
    } catch (error) {
      toast.error("Failed to update practice");
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Failed to update practice", error);
      });
    }
  };

  const { data: orders } = useQuery({
    queryKey: ["practice-orders", provider?.id],
    staleTime: 0,
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
    staleTime: 0,
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
    staleTime: 0,
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
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) {
            e.preventDefault();
          }
        }}
      >
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
                  <Button 
                    size="sm" 
                    onClick={form.handleSubmit(handleSave)}
                    disabled={!form.formState.isValid || form.formState.isSubmitting}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setIsEditing(false);
                    form.reset();
                  }}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">Name</FormLabel>
                          {isEditing ? (
                            <>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </>
                          ) : (
                            <p className="font-medium">{provider.name}</p>
                          )}
                        </FormItem>
                      )}
                    />
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
                  <FormField
                    control={form.control}
                    name="npi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">NPI Number</FormLabel>
                        {isEditing ? (
                          <>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="10 digits"
                                maxLength={10}
                              />
                            </FormControl>
                            <FormMessage />
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-medium">{sanitizeEncrypted(provider.npi) || "-"}</p>
                            {sanitizeEncrypted(provider.npi) && (
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
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="license_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">License Number</FormLabel>
                        {isEditing ? (
                          <>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-medium">{sanitizeEncrypted(provider.license_number) || "-"}</p>
                            {sanitizeEncrypted(provider.license_number) && (
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
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormField
                    control={form.control}
                    name="dea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">DEA Number</FormLabel>
                        {isEditing ? (
                          <>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="XX1234567"
                                maxLength={9}
                                style={{ textTransform: 'uppercase' }}
                              />
                            </FormControl>
                            <FormMessage />
                          </>
                        ) : (
                          <p className="font-mono font-medium">{sanitizeEncrypted(provider.dea) || "-"}</p>
                        )}
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">Phone</FormLabel>
                        {isEditing ? (
                          <>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="10 digits (no formatting)"
                                maxLength={10}
                              />
                            </FormControl>
                            <FormMessage />
                          </>
                        ) : (
                          <p className="font-medium">{provider.phone || "-"}</p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                       <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">Address</FormLabel>
                        {isEditing ? (
                          <>
                            <FormControl>
                              <GoogleAddressAutocomplete 
                                value={field.value || {}}
                                onChange={field.onChange}
                                placeholder="Start typing address..."
                              />
                            </FormControl>
                            <FormMessage />
                            <Alert className="mt-2">
                              <Info className="h-4 w-4" />
                              <AlertDescription>
                                Updating this address will automatically update the shipping address for all providers in this practice.
                              </AlertDescription>
                            </Alert>
                          </>
                        ) : (
                          <p className="font-medium">
                            {provider.address || provider.address_formatted || 
                              (provider.address_street ? 
                                `${provider.address_street}, ${provider.address_city}, ${provider.address_state} ${provider.address_zip}` 
                                : "-")}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
                {isAdmin && (
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="selectedRepId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">Assigned Representative (Optional)</FormLabel>
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
                                    {field.value
                                      ? allReps?.find((rep) => rep.id === field.value)?.name
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
                                              field.onChange(rep.id);
                                              setRepComboboxOpen(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                field.value === rep.id ? "opacity-100" : "opacity-0"
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
                               {field.value && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => field.onChange("")}
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
                        </FormItem>
                      )}
                    />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
};
