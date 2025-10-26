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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [productTypes, setProductTypes] = useState<{ id: string; name: string }[]>([]);
  const [toplineReps, setToplineReps] = useState<any[]>([]);
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
    product_type_id: "",
    scope_type: "global" as "global" | "scoped",
    assigned_topline_reps: [] as string[],
  });

  // Fetch available pharmacies, product types, and topline reps
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

    const fetchProductTypes = async () => {
      const { data, error } = await supabase
        .from("product_types")
        .select("id, name")
        .eq("active", true)
        .order("name");
      
      if (!error && data) {
        setProductTypes(data);
      }
    };
    
    const fetchToplineReps = async () => {
      const { data, error } = await supabase
        .from("reps")
        .select(`
          id,
          profiles:user_id (
            name,
            email
          )
        `)
        .eq("role", "topline");
      
      if (error) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error("Error fetching topline reps", error);
        });
      }
      if (data) setToplineReps(data);
    };

    fetchPharmacies();
    fetchProductTypes();
    fetchToplineReps();
  }, [product]);

  // Fetch existing pharmacy and rep assignments when editing
  useEffect(() => {
    const fetchAssignments = async () => {
      if (product) {
        // Fetch pharmacy assignments
        const { data: pharmacyData, error } = await supabase
          .from("product_pharmacies")
          .select("pharmacy_id")
          .eq("product_id", product.id);
        
        if (!error && pharmacyData) {
          setFormData(prev => ({
            ...prev,
            assigned_pharmacies: pharmacyData.map(pp => pp.pharmacy_id)
          }));
        }
        
        // Fetch rep assignments
        const { data: repData } = await supabase
          .from("product_rep_assignments")
          .select("topline_rep_id")
          .eq("product_id", product.id);
        
        const assignedReps = repData?.map(a => a.topline_rep_id) || [];
        setFormData(prev => ({
          ...prev,
          scope_type: assignedReps.length > 0 ? "scoped" : "global",
          assigned_topline_reps: assignedReps,
        }));
      }
    };
    fetchAssignments();
  }, [product]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        dosage: product.dosage || "",
        sig: product.sig || "",
        base_price: product.base_price?.toString() || "",
        // Clear legacy rep prices for Rx products
        topline_price: (product.requires_prescription ? "" : product.topline_price?.toString()) || "",
        downline_price: (product.requires_prescription ? "" : product.downline_price?.toString()) || "",
        // Force practice price = base price for Rx products
        retail_price: (product.requires_prescription 
          ? product.base_price?.toString() 
          : product.retail_price?.toString()) || "",
        assigned_pharmacies: [],
        requires_prescription: product.requires_prescription || false,
        product_type_id: product.product_type_id || "",
        scope_type: "global",
        assigned_topline_reps: [],
      });
      setImagePreview(product.image_url || "");
      
      // Show warning if legacy Rx product had rep prices
      if (product.requires_prescription && (product.topline_price || product.downline_price)) {
        toast.warning("Legacy pricing cleared: Rx products cannot have rep commissions");
      }
    } else {
      resetForm();
    }
  }, [product]);

  // Auto-sync prices when Rx toggle changes or base price updates
  useEffect(() => {
    if (formData.requires_prescription) {
      // For Rx products: Practice Price = Base Price, no rep markup
      setFormData(prev => ({
        ...prev,
        retail_price: prev.base_price,
        topline_price: "",
        downline_price: ""
      }));
    }
  }, [formData.requires_prescription, formData.base_price]);

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

    // Rx-specific validation
    if (formData.requires_prescription) {
      const basePrice = parseFloat(formData.base_price);
      const retailPrice = parseFloat(formData.retail_price);
      
      if (Math.abs(retailPrice - basePrice) > 0.01) {
        toast.error("Practice Price must equal Base Price for Rx products");
        return;
      }
      
      if (formData.topline_price || formData.downline_price) {
        toast.error("Rep prices must be empty for Rx products");
        return;
      }
    }

    // Non-Rx pricing validation
    if (!formData.requires_prescription) {
      const basePrice = parseFloat(formData.base_price);
      const toplinePrice = formData.topline_price ? parseFloat(formData.topline_price) : null;
      const downlinePrice = formData.downline_price ? parseFloat(formData.downline_price) : null;
      const retailPrice = formData.retail_price ? parseFloat(formData.retail_price) : null;

      if (toplinePrice && toplinePrice <= basePrice) {
        toast.error("Topline price must be greater than base price");
        return;
      }

      if (downlinePrice && toplinePrice && downlinePrice <= toplinePrice) {
        toast.error("Downline price must be greater than topline price");
        return;
      }

      if (retailPrice && downlinePrice && retailPrice < downlinePrice) {
        toast.error("Practice price must be greater than or equal to downline price");
        return;
      }

      if (retailPrice && toplinePrice && !downlinePrice && retailPrice < toplinePrice) {
        toast.error("Practice price must be greater than or equal to topline price");
        return;
      }
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
        // Force null for Rx products
        topline_price: formData.requires_prescription 
          ? null 
          : (formData.topline_price ? parseFloat(formData.topline_price) : null),
        downline_price: formData.requires_prescription 
          ? null 
          : (formData.downline_price ? parseFloat(formData.downline_price) : null),
        // Force Practice Price = Base Price for Rx
        retail_price: formData.requires_prescription 
          ? parseFloat(formData.base_price) 
          : (formData.retail_price ? parseFloat(formData.retail_price) : null),
        image_url: imageUrl,
        active: true,
        requires_prescription: formData.requires_prescription,
        product_type_id: formData.product_type_id,
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
      
      // Handle product rep assignments
      // Delete existing assignments
      await supabase
        .from("product_rep_assignments")
        .delete()
        .eq("product_id", productId);
      
      // Insert new assignments if scoped
      if (formData.scope_type === "scoped" && formData.assigned_topline_reps.length > 0) {
        const repAssignments = formData.assigned_topline_reps.map(rep_id => ({
          product_id: productId,
          topline_rep_id: rep_id
        }));
        
        const { error: repAssignError } = await supabase
          .from("product_rep_assignments")
          .insert(repAssignments);
        
        if (repAssignError) throw repAssignError;
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
      assigned_pharmacies: [],
      requires_prescription: false,
      product_type_id: "",
      scope_type: "global",
      assigned_topline_reps: [],
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

            <div className="space-y-2">
              <Label htmlFor="product_type_id">Product Type *</Label>
              <Select
                value={formData.product_type_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, product_type_id: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {productTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rep Assignment Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
            <Label className="text-base font-semibold">Rep Assignment</Label>
            <p className="text-sm text-muted-foreground">Control which topline reps can see this product</p>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input type="radio" id="product-scope-global" checked={formData.scope_type === "global"}
                  onChange={() => setFormData({ ...formData, scope_type: "global", assigned_topline_reps: [] })}
                  className="h-4 w-4" />
                <Label htmlFor="product-scope-global" className="cursor-pointer font-normal">
                  Available to All Reps (Global)
                </Label>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input type="radio" id="product-scope-specific" checked={formData.scope_type === "scoped"}
                    onChange={() => setFormData({ ...formData, scope_type: "scoped" })} className="h-4 w-4" />
                  <Label htmlFor="product-scope-specific" className="cursor-pointer font-normal">
                    Assign to Specific Topline Rep(s)
                  </Label>
                </div>
                
                {formData.scope_type === "scoped" && (
                  <div className="ml-6 space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto bg-background">
                    {toplineReps.map((rep) => (
                      <div key={rep.id} className="flex items-center space-x-2">
                        <Checkbox id={`prod-rep-${rep.id}`}
                          checked={formData.assigned_topline_reps.includes(rep.id)}
                          onCheckedChange={(checked) => {
                            setFormData({
                              ...formData,
                              assigned_topline_reps: checked
                                ? [...formData.assigned_topline_reps, rep.id]
                                : formData.assigned_topline_reps.filter(id => id !== rep.id)
                            });
                          }} />
                        <Label htmlFor={`prod-rep-${rep.id}`} className="text-sm cursor-pointer">
                          {rep.profiles.name} ({rep.profiles.email})
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {formData.scope_type === "scoped" && formData.assigned_topline_reps.length > 0 && (
              <Badge variant="secondary">Assigned to {formData.assigned_topline_reps.length} topline rep(s)</Badge>
            )}
          </div>

          {/* Prescription Requirement Toggle - MOVED TO TOP */}
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
                onCheckedChange={(checked) => {
                  // Warn when toggling OFF (prices were cleared)
                  if (!checked && formData.requires_prescription && !formData.topline_price) {
                    toast.info("Rx disabled: You'll need to enter Topline/Downline prices again");
                  }
                  
                  // Warn when toggling ON (existing prices will be cleared)
                  if (checked && !formData.requires_prescription && formData.topline_price) {
                    toast.warning("Enabling Rx: Rep prices will be cleared per federal regulations");
                  }
                  
                  setFormData({ ...formData, requires_prescription: checked });
                }}
              />
            </div>
            
            {formData.requires_prescription && (
              <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>⚠️ Prescription-required products:</strong> No rep commissions allowed per federal anti-kickback regulations.
                  Base Price will automatically equal Practice Price (no markup allowed).
                </AlertDescription>
              </Alert>
            )}
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

            {/* Conditional: Only show rep prices if NOT Rx-required */}
            {!formData.requires_prescription && (
              <>
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
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="retail_price">
                Practice Price
                {formData.requires_prescription && (
                  <Badge variant="outline" className="ml-2 text-xs">Auto-set = Base Price</Badge>
                )}
              </Label>
              <Input
                id="retail_price"
                type="number"
                step="0.01"
                value={formData.retail_price}
                onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                readOnly={formData.requires_prescription}
                className={formData.requires_prescription ? "bg-muted cursor-not-allowed" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {formData.requires_prescription 
                  ? "Automatically set to Base Price (no markup for Rx)" 
                  : "Price shown to practices at checkout"}
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
