import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Shield, Ban, CheckCircle2, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function IPBanlistManager() {
  const [newIP, setNewIP] = useState("");
  const [description, setDescription] = useState("");
  const [bannedReason, setBannedReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Get current user's IP
  const { data: currentIP } = useQuery({
    queryKey: ['current-ip'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_client_ip' as any);
      if (error) throw error;
      return data as string;
    }
  });

  // Get IP banlist
  const { data: banlist, isLoading } = useQuery({
    queryKey: ['ip-banlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_ip_banlist' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const isCurrentIPBanned = (banlist as any[])?.some(
    (entry: any) => entry.ip_address === currentIP && entry.banned
  );

  // Add IP to banlist
  const addIPMutation = useMutation({
    mutationFn: async ({ ip, description, reason }: { ip: string; description?: string; reason: string }) => {
      const { error } = await supabase
        .from('admin_ip_banlist' as any)
        .insert({
          ip_address: ip,
          description,
          banned_reason: reason,
          banned: true
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-banlist'] });
      toast.success("IP address banned successfully");
      setNewIP("");
      setDescription("");
      setBannedReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to ban IP address");
    }
  });

  // Toggle ban status
  const toggleBanMutation = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const { error } = await supabase
        .from('admin_ip_banlist' as any)
        .update({ banned, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-banlist'] });
      toast.success("IP status updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update IP status");
    }
  });

  // Delete IP from banlist
  const deleteIPMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('admin_ip_banlist' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ip-banlist'] });
      toast.success("IP removed from ban list");
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove IP");
    }
  });

  const validateIP = (ip: string) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  };

  const handleAddIP = () => {
    if (!newIP || !bannedReason) {
      toast.error("IP address and ban reason are required");
      return;
    }
    if (!validateIP(newIP)) {
      toast.error("Invalid IP address format");
      return;
    }
    addIPMutation.mutate({ ip: newIP, description, reason: bannedReason });
  };

  const handleBanCurrentIP = () => {
    if (!currentIP || !bannedReason) {
      toast.error("Ban reason is required");
      return;
    }
    addIPMutation.mutate({
      ip: String(currentIP),
      description: "Self-banned via Ban This IP button",
      reason: bannedReason
    });
  };

  const handleDeleteConfirm = (id: string) => {
    deleteIPMutation.mutate(id);
  };

  const handleDelete = (id: string, ip: string) => {
    setDeleteConfirm(id);
  };

  return (
    <div className="space-y-6">
      {/* Current IP Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Current IP Address
          </CardTitle>
          <CardDescription>
            All IP addresses have access by default unless explicitly banned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {isCurrentIPBanned ? (
                  <>
                    <Ban className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">Your IP is currently banned</p>
                      <p className="text-sm text-muted-foreground">{currentIP}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Your IP has access</p>
                      <p className="text-sm text-muted-foreground">{currentIP}</p>
                    </div>
                  </>
                )}
              </div>
              <Badge variant={isCurrentIPBanned ? "destructive" : "default"}>
                {isCurrentIPBanned ? "Banned" : "Allowed"}
              </Badge>
            </div>

            {!isCurrentIPBanned && (
              <div className="border-t pt-4">
                <div className="flex items-start gap-2 mb-3 text-amber-600">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">
                    Warning: Banning your current IP will immediately restrict your access to sensitive security features.
                  </p>
                </div>
                <Textarea
                  placeholder="Reason for banning this IP..."
                  value={bannedReason}
                  onChange={(e) => setBannedReason(e.target.value)}
                  className="mb-2"
                />
                <Button
                  onClick={handleBanCurrentIP}
                  variant="destructive"
                  disabled={!bannedReason || addIPMutation.isPending}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Ban This IP
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manage IP Ban List Card */}
      <Card>
        <CardHeader>
          <CardTitle>IP Ban List Management</CardTitle>
          <CardDescription>
            Explicitly ban IP addresses from accessing sensitive admin features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add IP Form */}
          <div className="space-y-3 border-b pb-4">
            <Input
              placeholder="IP Address (e.g., 192.168.1.1)"
              value={newIP}
              onChange={(e) => setNewIP(e.target.value)}
            />
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Textarea
              placeholder="Ban reason (required)"
              value={bannedReason}
              onChange={(e) => setBannedReason(e.target.value)}
            />
            <Button
              onClick={handleAddIP}
              disabled={addIPMutation.isPending}
              className="w-full"
            >
              <Ban className="h-4 w-4 mr-2" />
              Ban IP Address
            </Button>
          </div>

          {/* Banlist Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading ban list...</div>
          ) : banlist && banlist.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ban Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Banned At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banlist.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.ip_address}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.description || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{entry.banned_reason || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={entry.banned ? "destructive" : "default"}>
                        {entry.banned ? "Banned" : "Allowed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.banned_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleBanMutation.mutate({
                          id: entry.id,
                          banned: !entry.banned
                        })}
                        disabled={toggleBanMutation.isPending}
                      >
                        {entry.banned ? "Unban" : "Ban"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(entry.id, entry.ip_address)}
                        disabled={deleteIPMutation.isPending}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No banned IPs. All IP addresses have access by default.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove IP from Ban List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore access for this IP address. This action can be reversed by adding the IP back to the ban list.
              {(banlist as any[])?.find((e: any) => e.id === deleteConfirm)?.ip_address === currentIP && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-sm font-medium text-amber-900">
                    ⚠️ This is your current IP address. Removing it from the ban list will restore your access to sensitive features.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDeleteConfirm(deleteConfirm)}>
              Remove from Ban List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
