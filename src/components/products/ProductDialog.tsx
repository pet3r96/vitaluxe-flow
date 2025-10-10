import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Upload, X, AlertCircle } from "lucide-react";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  onSuccess: () => void;
}

export const ProductDialog = ({ open, onOpenChange, product, onSuccess }: ProductDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    sig: "",
    base_price: "",
    topline_price: "",
    downline_price: "",
    retail_price: "",
    assigned_pharmacies: [] as string[],
    requires_prescription: false,
  });

  // Fetch available pharmacies with their states and priorities
  useEffect(() => {
    const fetchPharmacies = async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, name, states_serviced, priority_map")
        .eq("active", true)
        .order("name");
      
      if (!error && data) {
        setPharmacies(data);
      }
    };
    fetchPharmacies();
  }, [product]);

  // Fetch existing pharmacy assignments when editing
  useEffect(() => {
    const fetchProductPharmacies = async () => {
      if (product) {
        const { data, error } = await supabase
          .from("product_pharmacies")
          .select("pharmacy_id")
          .eq("product_id", product.id);
        
        if (!error && data) {
          setFormData(prev => ({
            ...prev,
            assigned_pharmacies: data.map(pp => pp.pharmacy_id)
          }));
        }
      }
    };
    fetchProductPharmacies();
  }, [product]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        dosage: product.dosage || "",
        sig: product.sig || "",
        base_price: product.base_price?.toString() || "",
        topline_price: product.topline_price?.toString() || "",
        downline_price: product.downline_price?.toString() || "",
        retail_price: product.retail_price?.toString() || "",
        assigned_pharmacies: [],
        requires_prescription: product.requires_prescription || false,
      });
      setImagePreview(product.image_url || "");
    } else {
      resetForm();
    }
  }, [product]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate pharmacy selection
    if (formData.assigned_pharmacies.length === 0) {
      toast.error("Please assign at least one pharmacy");
      return;
    }

    setLoading(true);

    try {
      let imageUrl = product?.image_url || null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const productData = {
        name: formData.name,
        dosage: formData.dosage,
        sig: formData.sig,
        base_price: parseFloat(formData.base_price),
        topline_price: formData.topline_price ? parseFloat(formData.topline_price) : null,
        downline_price: formData.downline_price ? parseFloat(formData.downline_price) : null,
        retail_price: formData.retail_price ? parseFloat(formData.retail_price) : null,
        image_url: imageUrl,
        active: true,
        requires_prescription: formData.requires_prescription,
      };

      let productId = product?.id;

      if (product) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);

        if (error) throw error;
        
        // Delete old pharmacy assignments
        await supabase
          .from("product_pharmacies")
          .delete()
          .eq("product_id", product.id);
        
        toast.success("Product updated successfully");
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert([productData])
          .select()
          .single();

        if (error) throw error;
        productId = newProduct.id;
        toast.success("Product created successfully");
      }

      // Insert new pharmacy assignments
      const assignments = formData.assigned_pharmacies.map(pharmacy_id => ({
        product_id: productId,
        pharmacy_id
      }));

      const { error: assignmentError } = await supabase
        .from("product_pharmacies")
        .insert(assignments);

      if (assignmentError) throw assignmentError;

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      dosage: "",
      sig: "",
      base_price: "",
      topline_price: "",
      downline_price: "",
      retail_price: "",
      assigned_pharmacies: [],
      requires_prescription: false,
    });
    setImageFile(null);
    setImagePreview("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update product information" : "Create a new product"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="image">Product Image</Label>
            <div className="flex items-center gap-4">
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-24 w-24 rounded object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("image")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {imagePreview ? "Change Image" : "Upload Image"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage</Label>
              <Input
                id="dosage"
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
              />
            </div>
          </div>

          {/* Multi-Pharmacy Assignment */}
          <div className="space-y-2">
            <Label>Assigned Pharmacies *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select all pharmacies that can fulfill this product
            </p>
            
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {pharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="flex items-start space-x-2">
                  <Checkbox
                    id={`pharmacy-${pharmacy.id}`}
                    checked={formData.assigned_pharmacies.includes(pharmacy.id)}
                    onCheckedChange={(checked) => {
                      setFormData({
                        ...formData,
                        assigned_pharmacies: checked
                          ? [...formData.assigned_pharmacies, pharmacy.id]
                          : formData.assigned_pharmacies.filter(id => id !== pharmacy.id)
                      });
                    }}
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor={`pharmacy-${pharmacy.id}`} 
                      className="text-sm font-medium cursor-pointer"
                    >
                      {pharmacy.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      States: {pharmacy.states_serviced?.join(", ") || "None"}
                    </p>
                    {pharmacy.priority_map && Object.keys(pharmacy.priority_map).length > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Priorities: {Object.entries(pharmacy.priority_map)
                          .map(([state, priority]) => `${state}(${priority})`)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              Selected: {formData.assigned_pharmacies.length} pharmacy(s)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sig">Pre-set SIG (Instructions)</Label>
            <Textarea
              id="sig"
              value={formData.sig}
              onChange={(e) => setFormData({ ...formData, sig: e.target.value })}
              placeholder="Default instructions for this product"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_price">Base Price (Admin Cost) *</Label>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Your cost to acquire this product
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topline_price">Topline Rep Price</Label>
              <Input
                id="topline_price"
                type="number"
                step="0.01"
                value={formData.topline_price}
                onChange={(e) => setFormData({ ...formData, topline_price: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="downline_price">Downline Rep Price</Label>
              <Input
                id="downline_price"
                type="number"
                step="0.01"
                value={formData.downline_price}
                onChange={(e) => setFormData({ ...formData, downline_price: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retail_price">Practice Price</Label>
              <Input
                id="retail_price"
                type="number"
                step="0.01"
                value={formData.retail_price}
                onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Price shown to practices at checkout
              </p>
            </div>
          </div>

          {/* Prescription Requirement Toggle */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="requires_prescription" className="text-base font-semibold">
                  Prescription Required
                </Label>
                <p className="text-sm text-muted-foreground">
                  Require prescription upload when ordering this product
                </p>
              </div>
              <Switch
                id="requires_prescription"
                checked={formData.requires_prescription}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, requires_prescription: checked })
                }
              />
            </div>
            
            {formData.requires_prescription && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Providers must upload a valid prescription (PDF or PNG) when adding this product to cart.
                  Orders cannot be completed without prescriptions for required products.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
