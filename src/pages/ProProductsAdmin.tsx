import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, FileDown, Loader2 } from "lucide-react";
import {
  useProProducts,
  useCreateProProduct,
  useUpdateProProduct,
  useDeleteProProduct,
  ProProduct,
  ProProductFormData,
} from "@/hooks/useProProductsAdmin";
import { ProProductImageGenerator } from "@/components/admin/ProProductImageGenerator";
import { generateProProductCatalogPDF } from "@/lib/proProductCatalogPdfGenerator";
import { toast } from "sonner";

export default function ProProductsAdmin() {
  const { data: products, isLoading } = useProProducts();
  const createProduct = useCreateProProduct();
  const updateProduct = useUpdateProProduct();
  const deleteProduct = useDeleteProProduct();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDownloadingCatalog, setIsDownloadingCatalog] = useState(false);
  const [editing, setEditing] = useState<ProProduct | null>(null);
  const [form, setForm] = useState<ProProductFormData>({
    name: "",
    price: 0,
    description: "",
    active: true,
    sort_order: 0,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", price: 0, description: "", active: true, sort_order: 0 });
    setDialogOpen(true);
  };

  const openEdit = (p: ProProduct) => {
    setEditing(p);
    setForm({
      name: p.name,
      price: p.price,
      description: p.description || "",
      active: p.active,
      sort_order: p.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await updateProduct.mutateAsync({ id: editing.id, ...form });
    } else {
      await createProduct.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  return (
    <div className="responsive-page space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Professional Products Management</h1>
          <p className="text-muted-foreground">Manage the professional-use peptide catalog, pricing, and images</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setIsDownloadingCatalog(true);
              try {
                const blob = await generateProProductCatalogPDF();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Pro_Product_Catalog_${format(new Date(), "yyyy-MM-dd")}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Catalog downloaded!");
              } catch (err: any) {
                toast.error(err.message || "Failed to generate catalog");
              } finally {
                setIsDownloadingCatalog(false);
              }
            }}
            disabled={isDownloadingCatalog}
          >
            {isDownloadingCatalog ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            {isDownloadingCatalog ? "Generating..." : "Product Catalog"}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="images">AI Images</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Sort Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>${p.price.toLocaleString()}</TableCell>
                    <TableCell>{p.sort_order}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.active ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteProduct.mutate(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {products?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No products yet. Click "Add Product" to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="images">
          <ProProductImageGenerator />
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. BPC 157 10mg"
              />
            </div>
            <div>
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name || form.price <= 0 || createProduct.isPending || updateProduct.isPending}
            >
              {editing ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
