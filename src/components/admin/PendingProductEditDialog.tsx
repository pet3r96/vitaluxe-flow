import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCurrentCSRFToken } from "@/lib/csrf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PendingProductEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: any;
  onSuccess: () => void;
}

export const PendingProductEditDialog = ({
  open,
  onOpenChange,
  request,
  onSuccess,
}: PendingProductEditDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [createNewType, setCreateNewType] = useState(!!request?.product_type_name);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    sig: "",
    base_price: "",
    topline_price: "",
    downline_price: "",
    retail_price: "",
    product_type_id: "",
    requires_prescription: false,
    assigned_pharmacies: [] as string[],
    assigned_topline_reps: [] as string[],
    scope_type: "global",
    admin_notes: "",
  });

  useEffect(() => {
    if (request) {
      setFormData({
        name: request.name || "",
        dosage: request.dosage || "",
        sig: request.sig || "",
        base_price: request.vitaluxe_price?.toString() || "",
        topline_price: request.topline_price?.toString() || "",
        downline_price: request.downline_price?.toString() || "",
        retail_price: request.retail_price?.toString() || "",
        product_type_id: request.product_type_id || "",
        requires_prescription: request.requires_prescription || false,
        assigned_pharmacies: [request.pharmacy_id],
        assigned_topline_reps: request.assigned_topline_reps || [],
        scope_type: request.scope_type || "global",
        admin_notes: request.admin_notes || "",
      });
      setCreateNewType(!!request.product_type_name && !request.product_type_id);
    }
  }, [request]);

  // Fetch product types
  const { data: productTypes } = useQuery({
    queryKey: ["product-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch pharmacies
  const { data: pharmacies } = useQuery({
    queryKey: ["pharmacies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch topline reps from user_roles
  const { data: toplineReps } = useQuery({
    queryKey: ["topline-reps"],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "topline");
      
      if (roleError) throw roleError;
      
      const userIds = roleData?.map(r => r.user_id) || [];
      if (userIds.length === 0) return [];
      
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
        
      if (profileError) throw profileError;
      return profiles?.map(p => ({ id: p.id, name: p.full_name || 'Unknown' })) || [];
    },
    enabled: open && formData.scope_type === "scoped",
  });

  const handleApprove = async () => {
    if (!formData.base_price) {
      toast({
        title: "Error",
        description: "Base price is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.assigned_pharmacies.length === 0) {
      toast({
        title: "Error",
        description: "At least one pharmacy must be assigned",
        variant: "destructive",
      });
      return;
    }

    if (formData.scope_type === "scoped" && formData.assigned_topline_reps.length === 0) {
      toast({
        title: "Error",
        description: "At least one rep must be assigned for scoped products",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = '/auth', 2000);
        return;
      }

      const csrfToken = await getCurrentCSRFToken();

      const { error } = await supabase.functions.invoke(
        "approve-pending-product",
        {
          body: {
            requestId: request.id,
            action: "approve",
            adminData: {
              name: formData.name,
              dosage: formData.dosage,
              sig: formData.sig,
              base_price: parseFloat(formData.base_price),
              topline_price: formData.topline_price
                ? parseFloat(formData.topline_price)
                : null,
              downline_price: formData.downline_price
                ? parseFloat(formData.downline_price)
                : null,
              retail_price: formData.retail_price
                ? parseFloat(formData.retail_price)
                : null,
              product_type_id: createNewType ? null : formData.product_type_id,
              create_new_type: createNewType,
              product_type_name: request.product_type_name,
              requires_prescription: formData.requires_prescription,
              image_url: request.image_url,
              assigned_pharmacies: formData.assigned_pharmacies,
              assigned_topline_reps:
                formData.scope_type === "scoped"
                  ? formData.assigned_topline_reps
                  : [],
              scope_type: formData.scope_type,
            },
            adminNotes: formData.admin_notes,
          },
          headers: {
            "x-csrf-token": csrfToken || "",
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product request approved and product created",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error approving request:", error);
      
      // Handle session errors specifically
      if (error?.message?.includes('session') || error?.message?.includes('Unauthorized') || error?.message?.includes('JWT')) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = '/auth', 2000);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to approve request",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const isReadOnly = request?.status !== "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isReadOnly ? "View" : "Review"} Product Request
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "View product request details"
              : "Review and complete the product details before approval"}
          </DialogDescription>
        </DialogHeader>

        {request?.product_type_name && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This request includes a new product type:{" "}
              <strong>{request.product_type_name}</strong>
              {!isReadOnly && (
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="create_new_type"
                    checked={createNewType}
                    onCheckedChange={(checked) =>
                      setCreateNewType(checked as boolean)
                    }
                  />
                  <Label htmlFor="create_new_type">
                    Create new product type "{request.product_type_name}"
                  </Label>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pharmacy</Label>
              <Input value={request?.pharmacy_name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Requested By</Label>
              <Input value={request?.user_name || ""} disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={isReadOnly}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={formData.dosage}
                onChange={(e) =>
                  setFormData({ ...formData, dosage: e.target.value })
                }
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>VitaLuxe Price (Reference)</Label>
              <Input value={`$${request?.vitaluxe_price || 0}`} disabled />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sig">Sig</Label>
            <Textarea
              id="sig"
              value={formData.sig}
              onChange={(e) =>
                setFormData({ ...formData, sig: e.target.value })
              }
              disabled={isReadOnly}
              rows={2}
            />
          </div>

          {!createNewType && (
            <div className="space-y-2">
              <Label htmlFor="product_type">Product Type</Label>
              <Select
                value={formData.product_type_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, product_type_id: value })
                }
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="requires_prescription"
              checked={formData.requires_prescription}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requires_prescription: checked })
              }
              disabled={isReadOnly}
            />
            <Label htmlFor="requires_prescription">
              Requires Prescription (Rx)
            </Label>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Pricing (Admin Sets)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_price">Base Price *</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) =>
                    setFormData({ ...formData, base_price: e.target.value })
                  }
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retail_price">Retail Price</Label>
                <Input
                  id="retail_price"
                  type="number"
                  step="0.01"
                  value={formData.retail_price}
                  onChange={(e) =>
                    setFormData({ ...formData, retail_price: e.target.value })
                  }
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {!formData.requires_prescription && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="topline_price">Topline Price</Label>
                  <Input
                    id="topline_price"
                    type="number"
                    step="0.01"
                    value={formData.topline_price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        topline_price: e.target.value,
                      })
                    }
                    disabled={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="downline_price">Downline Price</Label>
                  <Input
                    id="downline_price"
                    type="number"
                    step="0.01"
                    value={formData.downline_price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        downline_price: e.target.value,
                      })
                    }
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            )}
            {formData.requires_prescription && (
              <p className="text-sm text-muted-foreground mt-2">
                Rx products cannot have topline/downline pricing (compliance)
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Pharmacy Assignment *</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-3">
              {pharmacies?.map((pharmacy) => (
                <div key={pharmacy.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`pharmacy-${pharmacy.id}`}
                    checked={formData.assigned_pharmacies.includes(pharmacy.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          assigned_pharmacies: [
                            ...formData.assigned_pharmacies,
                            pharmacy.id,
                          ],
                        });
                      } else {
                        setFormData({
                          ...formData,
                          assigned_pharmacies:
                            formData.assigned_pharmacies.filter(
                              (id) => id !== pharmacy.id
                            ),
                        });
                      }
                    }}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor={`pharmacy-${pharmacy.id}`}>
                    {pharmacy.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Rep Assignment</h3>
            <RadioGroup
              value={formData.scope_type}
              onValueChange={(value) =>
                setFormData({ ...formData, scope_type: value })
              }
              disabled={isReadOnly}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="global" id="global" />
                <Label htmlFor="global">Global (All Reps)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scoped" id="scoped" />
                <Label htmlFor="scoped">Scoped (Specific Reps Only)</Label>
              </div>
            </RadioGroup>

            {formData.scope_type === "scoped" && (
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto border rounded p-3">
                {toplineReps?.map((rep) => (
                  <div key={rep.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`rep-${rep.id}`}
                      checked={formData.assigned_topline_reps.includes(rep.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            assigned_topline_reps: [
                              ...formData.assigned_topline_reps,
                              rep.id,
                            ],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            assigned_topline_reps:
                              formData.assigned_topline_reps.filter(
                                (id) => id !== rep.id
                              ),
                          });
                        }
                      }}
                      disabled={isReadOnly}
                    />
                    <Label htmlFor={`rep-${rep.id}`}>{rep.name}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_notes">Admin Notes</Label>
            <Textarea
              id="admin_notes"
              value={formData.admin_notes}
              onChange={(e) =>
                setFormData({ ...formData, admin_notes: e.target.value })
              }
              disabled={isReadOnly}
              rows={3}
            />
          </div>

          {isReadOnly && request?.status === "rejected" && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Rejection Reason:</strong> {request.rejection_reason}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {isReadOnly ? "Close" : "Cancel"}
            </Button>
            {!isReadOnly && (
              <Button onClick={handleApprove} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve & Create Product
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
