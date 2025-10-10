import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

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
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    sig: "",
    base_price: "",
    topline_price: "",
    downline_price: "",
    retail_price: "",
  });

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
      };

      if (product) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", product.id);

        if (error) throw error;
        toast.success("Product updated successfully");
      } else {
        const { error } = await supabase.from("products").insert([productData]);

        if (error) throw error;
        toast.success("Product created successfully");
      }

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
              <Label htmlFor="retail_price">Provider Price</Label>
              <Input
                id="retail_price"
                type="number"
                step="0.01"
                value={formData.retail_price}
                onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Price shown to providers/practices at checkout
              </p>
            </div>
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
