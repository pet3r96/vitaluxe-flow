import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductRepAssign } from "@/integrations/supabase/table-helpers";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Loader2, Upload, X, AlertCircle, ChevronDown } from "lucide-react";
import { ProductVariantsEditor } from "./ProductVariantsEditor";
import { useProductVariants, useSyncProductVariants } from "@/hooks/useProductVariants";
import type { ProductVariantFormData } from "@/types/domain/productVariant";
import { createEmptyVariant } from "@/types/domain/productVariant";
import { ViosProductSearch } from "./ViosProductSearch";

// VIOS Compounding Pharmacy ID - used to enforce catalog linkage
const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

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
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variants, setVariants] = useState<ProductVariantFormData[]>([]);
  
  const { data: existingVariants } = useProductVariants(product?.id);
  const syncVariants = useSyncProductVariants();
  
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    dosage_form: "",
    sig: "",
    description: "",
    base_price: "",
    topline_price: "",
    downline_price: "",
    retail_price: "",
    assigned_pharmacies: [] as string[],
    requires_prescription: false,
    product_type_id: "",
    scope_type: "global" as "global" | "scoped",
    assigned_topline_reps: [] as string[],
    vios_lf_product_id: "",
  });

  const DOSAGE_FORMS = [
    "Cream",
    "Injection",
    "Troche",
    "Capsule",
    "Tablet",
    "Nasal Spray",
    "Topical Gel",
    "Sublingual",
    "Patch",
    "Solution",
    "Suspension",
    "Other",
  ];

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
        const { data: repData } = await ProductRepAssign()
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
        dosage_form: product.dosage_form || "",
        sig: product.sig || "",
        description: product.description || "",
        base_price: product.base_price?.toString() || "",
        // Clear legacy rep prices for Rx products
        topline_price: (product.requires_prescription ? "" : product.topline_price?.toString()) || "",
        downline_price: (product.requires_prescription ? "" : product.downline_price?.toString()) || "",
        // Allow admin markup for Rx products
        retail_price: product.retail_price?.toString() || "",
        assigned_pharmacies: [],
        requires_prescription: product.requires_prescription || false,
        product_type_id: product.product_type_id || "",
        scope_type: "global",
        assigned_topline_reps: [],
        vios_lf_product_id: product.vios_lf_product_id || "",
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
  
  // Load existing variants when editing
  useEffect(() => {
    if (existingVariants && existingVariants.length > 0) {
      setVariants(existingVariants.map(v => ({
        id: v.id,
        dosage_label: v.dosage_label,
        base_price: v.base_price?.toString() || '',
        topline_price: v.topline_price?.toString() || '',
        downline_price: v.downline_price?.toString() || '',
        retail_price: v.retail_price?.toString() || '',
        active: v.active,
        product_code: v.product_code || '',
        default_sig: v.default_sig || '',
        isNew: false,
      })));
      setVariantsOpen(true);
    } else if (!product) {
      setVariants([]);
    }
  }, [existingVariants, product]);

  // Auto-sync prices when Rx toggle changes
  useEffect(() => {
    if (formData.requires_prescription) {
      // For Rx products: Clear rep prices only (admin can still markup to practices)
      setFormData(prev => ({
        ...prev,
        topline_price: "",
        downline_price: ""
      }));
    }
  }, [formData.requires_prescription]);

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

    // VIOS invariant enforcement: If VIOS is selected, require catalog linkage
    const isViosAssigned = formData.assigned_pharmacies.includes(VIOS_PHARMACY_ID);
    if (isViosAssigned && !formData.vios_lf_product_id?.trim()) {
      toast.error("VIOS Compounding requires a VIOS Product ID to be set. Please select a product from the VIOS catalog.");
      return;
    }

    // Rx-specific validation
    if (formData.requires_prescription) {
      if (formData.topline_price || formData.downline_price) {
        toast.error("Rep prices must be empty for Rx products (federal anti-kickback compliance)");
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
        dosage_form: formData.dosage_form || null,
        sig: formData.sig,
        description: formData.description || null,
        base_price: parseFloat(formData.base_price),
        // Force null for Rx products
        topline_price: formData.requires_prescription 
          ? null 
          : (formData.topline_price ? parseFloat(formData.topline_price) : null),
        downline_price: formData.requires_prescription 
          ? null 
          : (formData.downline_price ? parseFloat(formData.downline_price) : null),
        // Allow admin markup for Rx products
        retail_price: formData.retail_price ? parseFloat(formData.retail_price) : null,
        image_url: imageUrl,
        active: true,
        requires_prescription: formData.requires_prescription,
        product_type_id: formData.product_type_id,
        // VIOS API integration
        vios_lf_product_id: formData.vios_lf_product_id || null,
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
      await ProductRepAssign()
        .delete()
        .eq("product_id", productId);
      
      // Insert new assignments if scoped
      if (formData.scope_type === "scoped" && formData.assigned_topline_reps.length > 0) {
        const repAssignments = formData.assigned_topline_reps.map(rep_id => ({
          product_id: productId,
          topline_rep_id: rep_id
        }));
        
        const { error: repAssignError } = await ProductRepAssign()
          .insert(repAssignments);
        
        if (repAssignError) throw repAssignError;
      }
      
      // Sync product variants
      if (variants.length > 0) {
        await syncVariants.mutateAsync({ productId, variants });
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
      dosage_form: "",
      sig: "",
      description: "",
      base_price: "",
      topline_price: "",
      downline_price: "",
      retail_price: "",
      assigned_pharmacies: [],
      requires_prescription: false,
      product_type_id: "",
      scope_type: "global",
      assigned_topline_reps: [],
      vios_lf_product_id: "",
    });
    setImageFile(null);
    setImagePreview("");
    setVariants([]);
    setVariantsOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the product, its benefits, or use cases"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This will be displayed on the product card with hover tooltip for full text
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label htmlFor="dosage_form">Dosage Form</Label>
              <Select
                value={formData.dosage_form}
                onValueChange={(value) =>
                  setFormData({ ...formData, dosage_form: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dosage form" />
                </SelectTrigger>
                <SelectContent>
                  {DOSAGE_FORMS.map((form) => (
                    <SelectItem key={form} value={form}>
                      {form}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The physical form of the medication
              </p>
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
              <Alert className="border-gold1/50 bg-gold1/10">
                <AlertCircle className="h-4 w-4 text-gold1" />
                <AlertDescription className="text-sm text-gold1">
                  <strong>⚕️ Prescription-Required Product (Federal Compliance)</strong>
                  <ul className="list-disc pl-4 mt-2 space-y-1 text-xs">
                    <li><strong>Admin Markup Allowed:</strong> You can set any Practice Price above Base Price</li>
                    <li><strong>No Rep Commissions:</strong> Topline/Downline prices are disabled per federal anti-kickback regulations</li>
                    <li><strong>Profit Distribution:</strong> 100% of markup goes to admin (reps earn $0 on Rx sales)</li>
                  </ul>
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

          {/* VIOS Catalog Linkage - Required when VIOS Compounding is assigned */}
          {formData.assigned_pharmacies.includes(VIOS_PHARMACY_ID) && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <Label htmlFor="vios_lf_product_id" className="flex items-center gap-2">
                VIOS Catalog Product <span className="text-destructive">*</span>
              </Label>
              <ViosProductSearch
                value={formData.vios_lf_product_id}
                onChange={(medId, selectedProduct) => {
                  setFormData({ 
                    ...formData, 
                    vios_lf_product_id: medId || "",
                    // Auto-fill dosage form from catalog if not already set
                    ...(selectedProduct?.form && !formData.dosage_form && { dosage_form: selectedProduct.form })
                  });
                }}
                placeholder="Search VIOS catalog by name or Med ID..."
              />
              {!formData.vios_lf_product_id && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Products assigned to VIOS must be linked to a valid VIOS catalog product for API fulfillment.
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-muted-foreground">
                Select the matching product from the VIOS catalog. This enables direct API order routing.
              </p>
            </div>
          )}

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
                Practice Price *
                {formData.requires_prescription && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Admin Markup Allowed
                  </Badge>
                )}
              </Label>
              <Input
                id="retail_price"
                type="number"
                step="0.01"
                required
                value={formData.retail_price}
                onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
                disabled={loading}
                placeholder="Price charged to practices"
              />
              <p className="text-xs text-muted-foreground">
                {formData.requires_prescription 
                  ? "Set your markup to practices (reps will earn $0 commission)" 
                  : "Price shown to practices at checkout"}
              </p>
            </div>
          </div>

          {/* Product Variants Section */}
          <Collapsible open={variantsOpen} onOpenChange={setVariantsOpen} className="border rounded-lg">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Dosage Variants</span>
                  {variants.filter(v => !v.toDelete).length > 0 && (
                    <Badge variant="secondary">
                      {variants.filter(v => !v.toDelete).length} variant(s)
                    </Badge>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${variantsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="p-4 pt-0 border-t">
              <ProductVariantsEditor
                variants={variants}
                onChange={setVariants}
                requiresPrescription={formData.requires_prescription}
                disabled={loading}
              />
            </CollapsibleContent>
          </Collapsible>

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
