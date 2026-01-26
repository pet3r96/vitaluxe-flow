import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Upload, CheckCircle2, XCircle, AlertCircle, Loader2, FileSpreadsheet, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

interface ProductVariant {
  id: string;
  label: string;
  base_price: number;
  product_code: string | null;
  product: {
    id: string;
    name: string;
    product_type: string | null;
    dosage_form: string | null;
  };
}

interface ImportPreview {
  variant_id: string;
  vios_med_id: string;
  productName?: string;
  variantLabel?: string;
  status: "pending" | "success" | "error";
  message?: string;
}

export function ViosMedIdManager() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [importData, setImportData] = useState<ImportPreview[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch all VIOS-assigned product variants
  const { data: variants, isLoading } = useQuery({
    queryKey: ["vios-product-variants"],
    queryFn: async () => {
      // First get product IDs assigned to VIOS
      const { data: assignments, error: assignError } = await supabase
        .from("product_pharmacies")
        .select("product_id")
        .eq("pharmacy_id", VIOS_PHARMACY_ID);

      if (assignError) throw assignError;
      
      const productIds = assignments?.map(a => a.product_id) || [];
      if (productIds.length === 0) return [];

      // Fetch variants for those products
      const { data: variantData, error: variantError } = await supabase
        .from("product_variants")
        .select(`
          id,
          label,
          base_price,
          product_code,
          product:products!inner (
            id,
            name,
            product_type,
            dosage_form
          )
        `)
        .in("product_id", productIds)
        .order("label");

      if (variantError) throw variantError;
      return variantData as unknown as ProductVariant[];
    }
  });

  // Filter variants based on search
  const filteredVariants = variants?.filter(v => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      v.product.name.toLowerCase().includes(search) ||
      v.label.toLowerCase().includes(search) ||
      v.product_code?.toLowerCase().includes(search)
    );
  });

  // Stats
  const totalVariants = variants?.length || 0;
  const mappedVariants = variants?.filter(v => v.product_code)?.length || 0;
  const unmappedVariants = totalVariants - mappedVariants;

  // Export CSV
  const handleExport = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Please log in to export");
        return;
      }

      const response = await supabase.functions.invoke("export-vios-products", {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Handle CSV response - could be string or already parsed
      let csvContent: string;
      if (typeof response.data === "string") {
        csvContent = response.data;
      } else {
        // If it's an error object
        throw new Error(response.data?.error || "Export failed");
      }

      // Download the file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vios-products-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${totalVariants} variants to CSV`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Parse CSV file
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error("CSV file appears to be empty");
          return;
        }

        // Parse header
        const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
        const variantIdIndex = header.findIndex(h => h === "variant_id");
        const medIdIndex = header.findIndex(h => h === "vios_med_id" || h === "med_id");

        if (variantIdIndex === -1) {
          toast.error("CSV must have a 'variant_id' column");
          return;
        }

        if (medIdIndex === -1) {
          toast.error("CSV must have a 'vios_med_id' column");
          return;
        }

        // Parse data rows
        const preview: ImportPreview[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const variantId = values[variantIdIndex]?.trim();
          const medId = values[medIdIndex]?.trim();

          if (!variantId || !medId) continue;

          // Look up variant info from current data
          const variant = variants?.find(v => v.id === variantId);

          preview.push({
            variant_id: variantId,
            vios_med_id: medId,
            productName: variant?.product.name,
            variantLabel: variant?.label,
            status: variant ? "pending" : "error",
            message: variant ? undefined : "Variant not found"
          });
        }

        if (preview.length === 0) {
          toast.error("No valid rows found in CSV");
          return;
        }

        setImportData(preview);
        toast.success(`Parsed ${preview.length} rows for import`);
      } catch (error) {
        console.error("Parse error:", error);
        toast.error("Failed to parse CSV file");
      }
    };

    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = "";
  }, [variants]);

  // Apply import
  const handleImport = async () => {
    const validRows = importData.filter(r => r.status !== "error");
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setIsImporting(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error("Please log in to import");
        return;
      }

      const response = await supabase.functions.invoke("import-vios-med-ids", {
        body: {
          rows: validRows.map(r => ({
            variant_id: r.variant_id,
            vios_med_id: r.vios_med_id
          })),
          preview: false
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data as {
        success: boolean;
        updated: number;
        failed: number;
        errors: string[];
      };

      if (result.success) {
        toast.success(`Successfully updated ${result.updated} variants`);
        setImportData([]);
        queryClient.invalidateQueries({ queryKey: ["vios-product-variants"] });
      } else {
        toast.error(`Import completed with ${result.failed} failures`);
        if (result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mapped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mappedVariants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unmapped</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{unmappedVariants}</div>
          </CardContent>
        </Card>
      </div>

      {/* Export/Import Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export & Import Med IDs
          </CardTitle>
          <CardDescription>
            Export all VIOS products to CSV, fill in Med IDs from your VIOS report, then import back
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Products CSV
            </Button>
            
            <div className="relative">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="gap-2 pointer-events-none">
                <Upload className="h-4 w-4" />
                Upload Filled CSV
              </Button>
            </div>
          </div>

          {/* Import Preview */}
          {importData.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Import Preview ({importData.length} rows)</h4>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setImportData([])}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleImport}
                    disabled={isImporting}
                    className="gap-2"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Apply {importData.filter(r => r.status !== "error").length} Mappings
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[200px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead>Med ID</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.slice(0, 50).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{row.productName || "—"}</TableCell>
                        <TableCell>{row.variantLabel || row.variant_id.slice(0, 8)}</TableCell>
                        <TableCell className="font-mono text-xs">{row.vios_med_id}</TableCell>
                        <TableCell>
                          {row.status === "error" ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {row.message}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                              <AlertCircle className="h-3 w-3" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {importData.length > 50 && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    And {importData.length - 50} more rows...
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Mappings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Variant Mappings</CardTitle>
          <CardDescription>
            All product variants assigned to VIOS Compounding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>VIOS Med ID</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVariants?.map((variant) => (
                    <TableRow key={variant.id}>
                      <TableCell className="font-medium">{variant.product.name}</TableCell>
                      <TableCell className="text-muted-foreground">{variant.product.product_type || "—"}</TableCell>
                      <TableCell>{variant.label}</TableCell>
                      <TableCell>${variant.base_price?.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {variant.product_code || "—"}
                      </TableCell>
                      <TableCell>
                        {variant.product_code ? (
                          <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Mapped
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                            <AlertCircle className="h-3 w-3" />
                            Unmapped
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredVariants?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchQuery ? "No variants match your search" : "No variants found"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper to parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}
