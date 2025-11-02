import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
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
import { Loader2 } from "lucide-react";

interface RequestProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const RequestProductDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: RequestProductDialogProps) => {
  const { user, effectiveUserId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    sig: "",
    description: "",
    vitaluxe_price: "",
    product_type_id: "",
    product_type_name: "",
    requires_prescription: false,
  });

  // Fetch current pharmacy
  const { data: pharmacy } = useQuery({
    queryKey: ["current-pharmacy", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, name")
        .eq("user_id", effectiveUserId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId && open,
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectiveUserId || !pharmacy) {
      toast({
        title: "Error",
        description: "User or pharmacy not found",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name || !formData.vitaluxe_price) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!formData.product_type_id && !formData.product_type_name) {
      toast({
        title: "Error",
        description: "Please select a product type or enter a new one",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload image if provided
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `product-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      const requestData = {
        created_by_user_id: effectiveUserId,
        pharmacy_id: pharmacy.id,
        name: formData.name,
        dosage: formData.dosage || null,
        sig: formData.sig || null,
        description: formData.description || null,
        vitaluxe_price: parseFloat(formData.vitaluxe_price),
        product_type_id: formData.product_type_id || null,
        product_type_name: formData.product_type_name || null,
        requires_prescription: formData.requires_prescription,
        image_url: imageUrl,
        status: "pending",
      };

      const { error } = await supabase
        .from("pending_product_requests")
        .insert([requestData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product request submitted for admin review",
      });

      // Reset form
      setFormData({
        name: "",
        dosage: "",
        sig: "",
        description: "",
        vitaluxe_price: "",
        product_type_id: "",
        product_type_name: "",
        requires_prescription: false,
      });
      setImageFile(null);

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error submitting product request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit product request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request New Product</DialogTitle>
          <DialogDescription>
            Submit a new product request for admin review and approval
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter product name"
              required
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
                placeholder="e.g., 10mg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vitaluxe_price">
                VitaLuxe Price <span className="text-destructive">*</span>
              </Label>
              <Input
                id="vitaluxe_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.vitaluxe_price}
                onChange={(e) =>
                  setFormData({ ...formData, vitaluxe_price: e.target.value })
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sig">Sig (Instructions)</Label>
            <Textarea
              id="sig"
              value={formData.sig}
              onChange={(e) =>
                setFormData({ ...formData, sig: e.target.value })
              }
              placeholder="Enter dosage instructions"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe the product, its benefits, or use cases"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_type">Product Type</Label>
            <Select
              value={formData.product_type_id}
              onValueChange={(value) =>
                setFormData({ ...formData, product_type_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select existing type" />
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

          <div className="space-y-2">
            <Label htmlFor="product_type_name">
              Or Request New Product Type
            </Label>
            <Input
              id="product_type_name"
              value={formData.product_type_name}
              onChange={(e) =>
                setFormData({ ...formData, product_type_name: e.target.value })
              }
              placeholder="Enter new product type name"
              disabled={!!formData.product_type_id}
            />
            <p className="text-sm text-muted-foreground">
              Leave blank if selecting existing type above
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="requires_prescription"
              checked={formData.requires_prescription}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requires_prescription: checked })
              }
            />
            <Label htmlFor="requires_prescription">
              Requires Prescription (Rx)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Product Image</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
