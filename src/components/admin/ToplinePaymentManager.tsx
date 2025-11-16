import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Download, DollarSign, Users, Calendar, Loader2 } from "lucide-react";
import { downloadCSV } from "@/lib/csvExport";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

const ToplinePaymentManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedToplineFilter, setSelectedToplineFilter] = useState<string>("all");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [dateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1), // Start of year
    end: new Date()
  });

  // Fetch unpaid profits
  const { data: unpaidProfits, isLoading } = useQuery({
    queryKey: ["unpaid-topline-profits", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_profits")
        .select(`
          id,
          topline_profit,
          created_at,
          topline_id,
          payment_status,
          order_id,
          orders!inner (
            id,
            status,
            created_at
          )
        `)
        .not("topline_id", "is", null)
        .eq("payment_status", "pending")
        .eq("orders.status", "delivered")
        .eq("orders.payment_status", "paid")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch rep details
  const { data: repsData } = useQuery({
    queryKey: ["reps-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (name, email)
        `)
        .eq("role", "topline");
      
      if (error) throw error;
      return data || [];
    }
  });

  // Aggregate unpaid profits by rep
  const aggregatedByRep = useMemo(() => {
    if (!unpaidProfits || !repsData) return [];
    
    const repMap = new Map();
    
    unpaidProfits.forEach(profit => {
      const repId = profit.topline_id;
      
      if (!repMap.has(repId)) {
        const rep = repsData.find(r => r.id === repId);
        repMap.set(repId, {
          topline_rep_id: repId,
          rep_name: rep?.profiles?.name || "Unknown",
          rep_email: rep?.profiles?.email || "Unknown",
          user_id: rep?.user_id,
          total_unpaid: 0,
          order_count: 0,
          profit_ids: [],
          earliest_date: profit.created_at,
          latest_date: profit.created_at
        });
      }
      
      const rep = repMap.get(repId);
      rep.total_unpaid += parseFloat(profit.topline_profit?.toString() || '0');
      rep.order_count += 1;
      rep.profit_ids.push(profit.id);
      
      if (new Date(profit.created_at) < new Date(rep.earliest_date)) {
        rep.earliest_date = profit.created_at;
      }
      if (new Date(profit.created_at) > new Date(rep.latest_date)) {
        rep.latest_date = profit.created_at;
      }
    });
    
    return Array.from(repMap.values()).filter(rep => rep.total_unpaid > 0);
  }, [unpaidProfits, repsData]);

  // Filter by selected topline rep
  const filteredAggregatedByRep = useMemo(() => {
    if (selectedToplineFilter === "all") {
      return aggregatedByRep;
    }
    return aggregatedByRep.filter(rep => rep.topline_rep_id === selectedToplineFilter);
  }, [aggregatedByRep, selectedToplineFilter]);

  // Clear selected reps when filter changes
  useEffect(() => {
    setSelectedReps([]);
  }, [selectedToplineFilter]);

  // Summary calculations
  const totalUnpaid = filteredAggregatedByRep.reduce((sum, rep) => sum + rep.total_unpaid, 0);
  const selectedAmount = filteredAggregatedByRep
    .filter(rep => selectedReps.includes(rep.topline_rep_id))
    .reduce((sum, rep) => sum + rep.total_unpaid, 0);

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
    totalItems: filteredAggregatedByRep.length,
    itemsPerPage: 25
  });

  const paginatedReps = filteredAggregatedByRep.slice(startIndex, endIndex);

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ 
      selectedReps, 
      paymentMethod, 
      notes 
    }: { 
      selectedReps: string[], 
      paymentMethod: string, 
      notes: string 
    }) => {
      const totalAmount = aggregatedByRep
        .filter(rep => selectedReps.includes(rep.topline_rep_id))
        .reduce((sum, rep) => sum + rep.total_unpaid, 0);
      
      // Create payment batch
      const { data: batch, error: batchError } = await supabase
        .from("rep_payment_batches")
        .insert({
          batch_number: `BATCH-${format(new Date(), 'yyyy-MM-dd-HHmmss')}`,
          paid_by: (await supabase.auth.getUser()).data.user?.id || '',
          total_amount: totalAmount,
          payment_method: paymentMethod,
          notes: notes
        })
        .select()
        .single();
      
      if (batchError) throw batchError;
      
      // Create individual rep payment records
      const paymentRecords = selectedReps.map(repId => {
        const rep = aggregatedByRep.find(r => r.topline_rep_id === repId);
        return {
          batch_id: batch.id,
          topline_rep_id: repId,
          amount_paid: rep?.total_unpaid || 0,
          profit_ids: rep?.profit_ids || [],
          date_range_start: rep?.earliest_date || new Date().toISOString(),
          date_range_end: rep?.latest_date || new Date().toISOString()
        };
      });
      
      const { data: payments, error: paymentsError } = await supabase
        .from("rep_payments")
        .insert(paymentRecords)
        .select();
      
      if (paymentsError) throw paymentsError;
      
      // Update order_profits records
      for (const payment of payments) {
        const { error: updateError } = await supabase
          .from("order_profits")
          .update({ 
            payment_status: 'completed',
            payment_id: payment.id, 
            paid_at: new Date().toISOString() 
          })
          .in("id", payment.profit_ids);
        
        if (updateError) throw updateError;
      }
      
      return { batch, payments };
    },
    onSuccess: ({ batch }) => {
      toast({
        title: "Payment Completed",
        description: `Batch ${batch.batch_number} created - ${selectedReps.length} reps marked as paid`
      });
      queryClient.invalidateQueries({ queryKey: ["unpaid-topline-profits"] });
      queryClient.invalidateQueries({ queryKey: ["payment-history"] });
      queryClient.invalidateQueries({ queryKey: ["rep-profit-details"] });
      setSelectedReps([]);
      setPaymentDialogOpen(false);
      setPaymentNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Export unpaid profits
  const exportUnpaidProfits = () => {
    if (filteredAggregatedByRep.length === 0) {
      toast({
        title: "No Data",
        description: "No unpaid profits to export",
        variant: "destructive"
      });
      return;
    }

    const headers = [
      "Rep Name",
      "Rep Email",
      "Unpaid Amount",
      "Order Count",
      "Earliest Order Date",
      "Latest Order Date",
      "Date Range (Days)"
    ];

    const rows = filteredAggregatedByRep.map(rep => [
      rep.rep_name,
      rep.rep_email,
      `$${rep.total_unpaid.toFixed(2)}`,
      rep.order_count.toString(),
      format(new Date(rep.earliest_date), "yyyy-MM-dd"),
      format(new Date(rep.latest_date), "yyyy-MM-dd"),
      Math.ceil(
        (new Date(rep.latest_date).getTime() - new Date(rep.earliest_date).getTime()) / 
        (1000 * 60 * 60 * 24)
      ).toString()
    ]);

    downloadCSV(
      rows,
      headers,
      `unpaid_topline_profits_${format(dateRange.start, "yyyy-MM-dd")}_to_${format(dateRange.end, "yyyy-MM-dd")}`
    );

    toast({
      title: "Export Successful",
      description: "Unpaid profits exported to CSV"
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReps(filteredAggregatedByRep.map(rep => rep.topline_rep_id));
    } else {
      setSelectedReps([]);
    }
  };

  const handleSelectRep = (repId: string, checked: boolean) => {
    if (checked) {
      setSelectedReps([...selectedReps, repId]);
    } else {
      setSelectedReps(selectedReps.filter(id => id !== repId));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Topline Rep Payments</h1>
          <p className="text-muted-foreground mt-2">
            Manage payments to topline sales representatives
          </p>
        </div>
        
        <div className="w-[280px]">
          <Label htmlFor="topline-filter" className="text-sm font-medium mb-2 block">
            Filter by Rep
          </Label>
          <Select value={selectedToplineFilter} onValueChange={setSelectedToplineFilter}>
            <SelectTrigger id="topline-filter">
              <SelectValue placeholder="Select a topline rep" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topline Reps ({aggregatedByRep.length})</SelectItem>
              {repsData
                ?.filter(rep => aggregatedByRep.some(agg => agg.topline_rep_id === rep.id))
                ?.map(rep => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.profiles?.name || rep.profiles?.email || "Unknown"}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Unpaid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${totalUnpaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all topline reps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Reps with Unpaid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedToplineFilter === "all" ? aggregatedByRep.length : "1 selected"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Topline representatives</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">
              {format(dateRange.start, "MMM d, yyyy")} - {format(dateRange.end, "MMM d, yyyy")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Year to date</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions Toolbar */}
      {filteredAggregatedByRep.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={selectedReps.length === filteredAggregatedByRep.length && filteredAggregatedByRep.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm">
              {selectedReps.length > 0 ? `${selectedReps.length} selected` : "Select all"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportUnpaidProfits}
              disabled={filteredAggregatedByRep.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Unpaid
            </Button>
            
            <Button
              variant="default"
              onClick={() => setPaymentDialogOpen(true)}
              disabled={selectedReps.length === 0}
            >
              Mark Selected as Paid ({selectedReps.length})
              {selectedReps.length > 0 && ` - $${selectedAmount.toFixed(2)}`}
            </Button>
          </div>
        </div>
      )}

      {/* Topline Reps Table */}
      <Card>
        <CardHeader>
          <CardTitle>Unpaid Topline Profits</CardTitle>
          <CardDescription>Select reps to process payment</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Rep Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Unpaid Amount</TableHead>
                <TableHead className="text-right">Order Count</TableHead>
                <TableHead>Date Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedReps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No unpaid profits found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedReps.map((rep) => (
                  <TableRow key={rep.topline_rep_id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedReps.includes(rep.topline_rep_id)}
                        onCheckedChange={(checked) => handleSelectRep(rep.topline_rep_id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{rep.rep_name}</TableCell>
                    <TableCell className="text-muted-foreground">{rep.rep_email}</TableCell>
                    <TableCell className="text-right font-semibold text-yellow-600">
                      ${rep.total_unpaid.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{rep.order_count}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(rep.earliest_date), "MMM d, yyyy")} - {format(new Date(rep.latest_date), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredAggregatedByRep.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredAggregatedByRep.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredAggregatedByRep.length)}
        />
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>
              Process payment for {selectedReps.length} selected rep{selectedReps.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <div className="text-2xl font-bold text-green-600">
                ${selectedAmount.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="wire">Wire Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Add any notes about this payment..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => markAsPaidMutation.mutate({ selectedReps, paymentMethod, notes: paymentNotes })}
              disabled={markAsPaidMutation.isPending}
            >
              {markAsPaidMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ToplinePaymentManager;
