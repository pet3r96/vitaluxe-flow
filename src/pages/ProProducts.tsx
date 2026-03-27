import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, FileDown } from "lucide-react";
import { useActiveProProducts } from "@/hooks/useProProductsAdmin";
import { useProCart, useProCartCount, useAddToProCart, useClearProCart } from "@/hooks/useProCart";
import { useProOrders, useCreateProOrder } from "@/hooks/useProOrders";
import { useAuth } from "@/contexts/AuthContext";
import { ProProductCard } from "@/components/pro-products/ProProductCard";
import { ProCartSheet } from "@/components/pro-products/ProCartSheet";
import { generateProOrderPdf, proOrderPdfToBase64 } from "@/lib/proOrderPdfGenerator";
import { generateProProductCatalogPDF } from "@/lib/proProductCatalogPdfGenerator";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ProProducts() {
  const { data: products, isLoading } = useActiveProProducts();
  const { data: cartItems = [] } = useProCart();
  const { data: cartCount = 0 } = useProCartCount();
  const { data: orders = [] } = useProOrders();
  const addToCart = useAddToProCart();
  const clearCart = useClearProCart();
  const createOrder = useCreateProOrder();
  const { user, effectivePracticeId } = useAuth();

  const [cartOpen, setCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingCatalog, setIsDownloadingCatalog] = useState(false);

  const handleDownloadCatalog = async () => {
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
  };

  const handleSubmitOrder = async () => {
    if (!user || cartItems.length === 0) return;
    if (!effectivePracticeId) {
      toast.error("You must be associated with a practice to submit professional product orders.");
      return;
    }
    setIsSubmitting(true);

    try {
      // Get practice profile for contact info and shipping address
      let contactName = "";
      let contactEmail = user.email || "";
      let contactPhone = "";
      let shipToAddress: Record<string, string> = {};

      if (effectivePracticeId) {
        const { data: practice } = await supabase
          .from("profiles")
          .select("name, email, phone, shipping_address_street, shipping_address_suite, shipping_address_city, shipping_address_state, shipping_address_zip")
          .eq("id", effectivePracticeId)
          .single();

        if (practice) {
          contactName = practice.name || "";
          contactEmail = practice.email || contactEmail;
          contactPhone = practice.phone || "";
          shipToAddress = {
            street: practice.shipping_address_street || "",
            suite: practice.shipping_address_suite || "",
            city: practice.shipping_address_city || "",
            state: practice.shipping_address_state || "",
            zip: practice.shipping_address_zip || "",
          };
        }
      }

      const lineItems = cartItems.map((item) => ({
        product_id: item.pro_product_id,
        name: item.pro_products.name,
        price: item.pro_products.price,
        quantity: item.quantity,
        total: item.pro_products.price * item.quantity,
      }));

      const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
      const shipping = 20;
      const total = subtotal + shipping;

      // Generate PDF
      const pdf = generateProOrderPdf({
        contactName,
        contactEmail,
        contactPhone,
        shipToAddress,
        orderDate: format(new Date(), "MM/dd/yyyy"),
        lineItems,
        subtotal,
        shipping,
        total,
      });

      const pdfBase64 = proOrderPdfToBase64(pdf);

      // Save order record
      await createOrder.mutateAsync({
        user_id: user.id,
        practice_id: effectivePracticeId || null,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        ship_to_address: shipToAddress,
        line_items: lineItems,
        subtotal,
        shipping,
        total,
        notes: null,
      });

      // Email PDF to operations
      await supabase.functions.invoke("send-pro-order", {
        body: {
          pdfBase64,
          contactName,
          contactEmail,
          practiceId: effectivePracticeId,
          orderTotal: total,
          itemCount: lineItems.length,
        },
      });

      // Auto-download PDF
      pdf.save(`Pro_Order_${format(new Date(), "yyyy-MM-dd")}.pdf`);

      // Clear cart
      await clearCart.mutateAsync();
      setCartOpen(false);
      toast.success("Order submitted! PDF has been downloaded and sent to operations.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="responsive-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Professional Products</h1>
          <p className="text-muted-foreground">Professional-use peptides — ships to practice only</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadCatalog}
            disabled={isDownloadingCatalog}
          >
            <FileDown className="h-5 w-5 mr-1" />
            {isDownloadingCatalog ? "Generating..." : "Product Catalog"}
          </Button>
          <Button variant="outline" className="relative" onClick={() => setCartOpen(true)}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="history">Order History</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products?.map((product) => (
                <ProProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={(id, qty) => addToCart.mutate({ productId: id, quantity: qty })}
                  isAdding={addToCart.isPending}
                />
              ))}
              {products?.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-12">
                  No products available yet.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{format(new Date(order.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {(order.line_items as any[]).length} item(s)
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${order.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {order.contact_name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <ProCartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        items={cartItems}
        onSubmitOrder={handleSubmitOrder}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
