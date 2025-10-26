import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Eye, CheckCircle, Download, DollarSign, FileText, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { InvoiceTemplateDialog } from "./InvoiceTemplateDialog";
import { downloadCSV } from "@/lib/csvExport";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export default function PracticeDevelopmentFeeManager() {
  const queryClient = useQueryClient();
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedRep, setSelectedRep] = useState<any>(null);
  const [feeAmount, setFeeAmount] = useState("");
  const [feeNotes, setFeeNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Fetch topline reps
  const { data: toplineReps = [] } = useQuery({
    queryKey: ["topline-reps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("id, user_id, role, profiles(name, email)")
        .eq("role", "topline");
      
      if (error) throw error;
      return data.map(rep => ({
        id: rep.id,
        name: rep.profiles?.name || "Unknown",
        email: rep.profiles?.email || ""
      }));
    }
  });

  // Fetch practice development fees
  const { data: fees = [] } = useQuery({
    queryKey: ["practice-development-fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_development_fees")
        .select(`
          *,
          reps!practice_development_fees_topline_rep_id_fkey(
            id,
            profiles(name, email)
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["practice-development-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_development_fee_invoices")
        .select(`
          *,
          reps!practice_development_fee_invoices_topline_rep_id_fkey(
            id,
            profiles(name, email)
          )
        `)
        .order("invoice_date", { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const repMatch = selectedRepFilter === "all" || invoice.topline_rep_id === selectedRepFilter;
    const statusMatch = statusFilter === "all" || invoice.payment_status === statusFilter;
    return repMatch && statusMatch;
  });

  // Pagination
  const { 
    currentPage, 
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredInvoices.length,
    itemsPerPage: 25
  });

  // Paginate filtered invoices
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  // Calculate summary stats
  const totalMonthlyFees = fees
    .filter(f => f.active)
    .reduce((sum, f) => sum + parseFloat(String(f.monthly_amount || "0")), 0);
  
  const outstandingAmount = invoices
    .filter(i => i.payment_status === "pending")
    .reduce((sum, i) => sum + parseFloat(String(i.amount || "0")), 0);
  
  const activeRepsCount = fees.filter(f => f.active).length;

  // Mutations
  const setFeeMutation = useMutation({
    mutationFn: async ({ repId, amount, notes }: { repId: string; amount: number; notes: string }) => {
      // Check if fee already exists
      const { data: existing } = await supabase
        .from("practice_development_fees")
        .select("id")
        .eq("topline_rep_id", repId)
        .eq("active", true)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("practice_development_fees")
          .update({ monthly_amount: amount, notes, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("practice_development_fees")
          .insert([{ topline_rep_id: repId, monthly_amount: amount, notes }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-development-fees"] });
      toast.success("Fee configuration saved");
      setIsFeeDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error saving fee:", error);
      toast.error("Failed to save fee configuration");
    }
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ invoiceId, method, notes }: { invoiceId: string; method: string; notes: string }) => {
      const { error } = await supabase
        .from("practice_development_fee_invoices")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: method,
          payment_notes: notes
        })
        .eq("id", invoiceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-development-invoices"] });
      toast.success("Invoice marked as paid");
      setIsPaymentDialogOpen(false);
    },
    onError: (error) => {
      console.error("Error marking as paid:", error);
      toast.error("Failed to mark invoice as paid");
    }
  });

  const handleViewPDF = async (invoice: any) => {
    if (!invoice.pdf_url) {
      toast.error("PDF not generated yet");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("practice-development-invoices")
        .createSignedUrl(invoice.pdf_url, 3600);
      
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Error viewing PDF:", error);
      toast.error("Failed to load PDF");
    }
  };

  const handleExportCSV = () => {
    const csvData = filteredInvoices.map(invoice => [
      invoice.invoice_number,
            invoice.reps?.profiles?.name || "Unknown",
            invoice.reps?.profiles?.email || "",
            format(new Date(invoice.billing_month), "MMMM yyyy"),
            format(new Date(invoice.invoice_date), "MMM dd, yyyy"),
            format(new Date(invoice.due_date), "MMM dd, yyyy"),
            `$${parseFloat(String(invoice.amount)).toFixed(2)}`,
      invoice.payment_status,
      invoice.paid_at ? format(new Date(invoice.paid_at), "MMM dd, yyyy") : "—",
      invoice.payment_method || "—"
    ]);

    const headers = [
      "Invoice Number",
      "Rep Name",
      "Rep Email",
      "Billing Month",
      "Invoice Date",
      "Due Date",
      "Amount",
      "Status",
      "Paid Date",
      "Payment Method"
    ];

    downloadCSV(csvData, headers, "practice-development-fees");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Practice Development Fees</h1>
        <p className="text-muted-foreground mt-2">
          Manage monthly fees and invoices for topline representatives
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalMonthlyFees.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Configured for {activeRepsCount} reps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${outstandingAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {invoices.filter(i => i.payment_status === "pending").length} pending invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reps</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRepsCount}</div>
            <p className="text-xs text-muted-foreground">With active fee configurations</p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Configuration</CardTitle>
          <CardDescription>Set monthly fees for topline representatives</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Monthly Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {toplineReps.map(rep => {
                const fee = fees.find(f => f.topline_rep_id === rep.id && f.active);
                return (
                  <TableRow key={rep.id}>
                  <TableCell className="font-medium">{rep.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rep.email}</TableCell>
                    <TableCell>
                      {fee ? `$${parseFloat(fee.monthly_amount.toString()).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {fee ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Not Set</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRep(rep);
                          setFeeAmount(fee?.monthly_amount?.toString() || "");
                          setFeeNotes(fee?.notes || "");
                          setIsFeeDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        {fee ? "Edit" : "Set Fee"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoice Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoice Management</CardTitle>
              <CardDescription>Create and manage practice development fee invoices</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => setIsInvoiceDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Filter by Rep</Label>
              <Select value={selectedRepFilter} onValueChange={setSelectedRepFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  {toplineReps.map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label>Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Rep Name</TableHead>
                <TableHead>Billing Month</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.reps?.profiles?.name || "Unknown"}</TableCell>
                  <TableCell>
                    {format(new Date(invoice.billing_month), "MMMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${parseFloat(invoice.amount.toString()).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={invoice.payment_status === "paid" ? "default" : "secondary"}>
                      {invoice.payment_status === "paid" ? "Paid" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.due_date), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {invoice.pdf_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPDF(invoice)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {invoice.payment_status === "pending" && (
                        <>
                          {!invoice.pdf_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setIsInvoiceDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentMethod("");
                              setPaymentNotes("");
                              setIsPaymentDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            totalItems={filteredInvoices.length}
            startIndex={startIndex}
            endIndex={endIndex}
          />
        </CardContent>
      </Card>

      {/* Invoice Template Dialog */}
      <InvoiceTemplateDialog
        open={isInvoiceDialogOpen}
        onOpenChange={(open) => {
          setIsInvoiceDialogOpen(open);
          if (!open) setSelectedInvoice(null);
        }}
        toplineReps={toplineReps}
        existingInvoice={selectedInvoice}
      />

      {/* Fee Configuration Dialog */}
      <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRep ? `Set Fee for ${selectedRep.name}` : "Set Fee"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={feeNotes}
                onChange={(e) => setFeeNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes about this fee configuration..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedRep || !feeAmount) {
                  toast.error("Please enter a fee amount");
                  return;
                }
                setFeeMutation.mutate({
                  repId: selectedRep.id,
                  amount: parseFloat(feeAmount),
                  notes: feeNotes
                });
              }}
            >
              Save Fee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Notes (Optional)</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes about this payment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!paymentMethod) {
                  toast.error("Please select a payment method");
                  return;
                }
                markPaidMutation.mutate({
                  invoiceId: selectedInvoice.id,
                  method: paymentMethod,
                  notes: paymentNotes
                });
              }}
            >
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}