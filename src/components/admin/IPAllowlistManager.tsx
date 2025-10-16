import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Globe, Plus, Trash2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const IPAllowlistManager = () => {
  const [newIP, setNewIP] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ipToDelete, setIpToDelete] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch current user's IP
  const { data: currentIP } = useQuery({
    queryKey: ['current-ip'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_client_ip');
      if (error) throw error;
      return data;
    }
  });

  // Fetch IP allowlist
  const { data: allowlist, isLoading } = useQuery({
    queryKey: ['admin-ip-allowlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_ip_allowlist' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    }
  });

  // Check if current IP is allowed
  const isCurrentIPAllowed = allowlist?.some(
    (ip: any) => ip.ip_address === currentIP && ip.active
  );

  // Validate IP address format
  const validateIP = (ip: string): boolean => {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  };

  // Add IP mutation
  const addIPMutation = useMutation({
    mutationFn: async ({ ip, description }: { ip: string; description: string }) => {
      const { error } = await supabase
        .from('admin_ip_allowlist' as any)
        .insert({
          ip_address: ip,
          description: description || null,
          active: true
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ip-allowlist'] });
      setNewIP("");
      setNewDescription("");
      toast.success("IP address added to allowlist");
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error("This IP address is already in the allowlist");
      } else {
        toast.error("Failed to add IP address");
      }
    }
  });

  // Toggle IP active status
  const toggleIPMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('admin_ip_allowlist' as any)
        .update({ active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ip-allowlist'] });
      toast.success("IP status updated");
    },
    onError: () => {
      toast.error("Failed to update IP status");
    }
  });

  // Delete IP mutation
  const deleteIPMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_ip_allowlist' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ip-allowlist'] });
      toast.success("IP address removed from allowlist");
      setDeleteConfirmOpen(false);
      setIpToDelete(null);
    },
    onError: () => {
      toast.error("Failed to remove IP address");
    }
  });

  const handleAddIP = () => {
    if (!newIP) {
      toast.error("Please enter an IP address");
      return;
    }
    if (!validateIP(newIP)) {
      toast.error("Invalid IP address format");
      return;
    }
    addIPMutation.mutate({ ip: newIP, description: newDescription });
  };

  const handleAddCurrentIP = () => {
    if (!currentIP) {
      toast.error("Could not determine your current IP");
      return;
    }
    addIPMutation.mutate({
      ip: currentIP,
      description: "Added via 'Add My IP' button"
    });
  };

  const handleDeleteConfirm = (ip: any) => {
    if (ip.ip_address === '127.0.0.1' || ip.ip_address === '::1') {
      toast.error("Cannot delete localhost IPs (required for development)");
      return;
    }
    setIpToDelete(ip);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = () => {
    if (ipToDelete) {
      deleteIPMutation.mutate(ipToDelete.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current IP Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Your Current IP Address
          </CardTitle>
          <CardDescription>
            Your current IP address and its status in the allowlist
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">IP Address</div>
                <div className="text-2xl font-mono font-semibold">{String(currentIP || "Loading...")}</div>
              </div>
              <div className="flex items-center gap-2">
                {isCurrentIPAllowed ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Allowed
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    Not Allowed
                  </Badge>
                )}
              </div>
            </div>

            {!isCurrentIPAllowed && currentIP && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Access Restricted</AlertTitle>
                <AlertDescription>
                  Your current IP is not in the allowlist. Click the button below to add it and gain access to sensitive security features.
                </AlertDescription>
              </Alert>
            )}

            {!isCurrentIPAllowed && (
              <Button
                onClick={handleAddCurrentIP}
                disabled={addIPMutation.isPending || !currentIP}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add My IP to Allowlist
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* IP Allowlist Table */}
      <Card>
        <CardHeader>
          <CardTitle>IP Address Allowlist</CardTitle>
          <CardDescription>
            Manage which IP addresses can access sensitive security features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : allowlist && allowlist.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowlist.map((ip: any) => (
                  <TableRow key={ip.id}>
                    <TableCell className="font-mono">{ip.ip_address}</TableCell>
                    <TableCell>{ip.description ? String(ip.description) : "-"}</TableCell>
                    <TableCell>
                      {ip.active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(ip.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={ip.active}
                          onCheckedChange={(checked) =>
                            toggleIPMutation.mutate({ id: ip.id, active: checked })
                          }
                          disabled={toggleIPMutation.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteConfirm(ip)}
                          disabled={deleteIPMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No IP addresses in allowlist
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New IP Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add New IP Address</CardTitle>
          <CardDescription>
            Add a new IP address to the allowlist (supports IPv4 and IPv6)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip-address">IP Address</Label>
              <Input
                id="ip-address"
                placeholder="192.168.1.100 or 2001:0db8:85a3::8a2e:0370:7334"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Admin Office, Home Network"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddIP}
              disabled={addIPMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Allowlist
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove IP Address?</AlertDialogTitle>
            <AlertDialogDescription>
              {ipToDelete?.ip_address === currentIP ? (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    You are about to remove your current IP address ({ipToDelete?.ip_address}).
                    You will lose access to sensitive security features until you add it back.
                  </AlertDescription>
                </Alert>
              ) : (
                `Are you sure you want to remove ${ipToDelete?.ip_address} from the allowlist?`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remove IP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IPAllowlistManager;
