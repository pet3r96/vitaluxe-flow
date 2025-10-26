import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FileText, Tag } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { useToast } from "@/hooks/use-toast";

const RepProfitReports = () => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const { toast } = useToast();
  const [earningFilter, setEarningFilter] = useState<"all" | "non-rx" | "rx-only" | "dev-fees">("all");

  // Get rep ID
  const { data: repData } = useQuery({
    queryKey: ["rep-data", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select("*")
        .eq("user_id", effectiveUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // Get unified earnings (commissions + practice dev fees)
  const { data: earningsData, isLoading } = useQuery({
    queryKey: ["rep-earnings", repData?.id, effectiveRole],
    enabled: !!repData?.id && !!effectiveRole,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_rep_earnings', { _rep_id: repData.id });
      
      if (error) throw error;
      
      // Sort by created_at descending (newest first)
      return (data || []).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  // Filter based on earning type
  const filteredEarnings = useMemo(() => {
    if (!earningsData) return [];
    
    if (earningFilter === "non-rx") {
      // Only non-Rx product commissions
      return earningsData.filter(item => 
        item.earning_type === 'product_commission' && !item.is_rx_required
      );
    } else if (earningFilter === "rx-only") {
      // Only Rx-required product commissions
      return earningsData.filter(item => 
        item.earning_type === 'product_commission' && item.is_rx_required
      );
    } else if (earningFilter === "dev-fees") {
      // Only Practice Development Fees
      return earningsData.filter(item => 
        item.earning_type === 'practice_dev_fee'
      );
    }
    
    // "all" - show everything
    return earningsData;
  }, [earningsData, earningFilter]);

  const totalEarnings = useMemo(() => 
    earningsData
      ?.filter(item => item.order_status !== 'cancelled')
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0,
    [earningsData]
  );

  const unpaidEarnings = useMemo(() => 
    earningsData
      ?.filter(item => 
        item.payment_status !== 'completed' && 
        item.payment_status !== 'paid' &&
        item.order_status !== 'cancelled'
      )
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0,
    [earningsData]
  );

  const paidEarnings = useMemo(() => 
    earningsData
      ?.filter(item => 
        (item.payment_status === 'completed' || item.payment_status === 'paid') &&
        item.order_status !== 'cancelled'
      )
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0,
    [earningsData]
  );

  // Sales breakdown (topline only)
  const directSalesEarnings = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return earningsData
      ?.filter(item => item.order_status !== 'cancelled')
      .filter(item => item.earning_type === 'product_commission')
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0;
  }, [earningsData, effectiveRole]);

  const practiceDevFees = useMemo(() => {
    if (effectiveRole !== 'topline') return 0;
    return earningsData
      ?.filter(item => item.earning_type === 'practice_dev_fee')
      .reduce((sum, item) => sum + parseFloat(item.amount?.toString() || '0'), 0) || 0;
  }, [earningsData, effectiveRole]);

  const {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    hasNextPage,
    hasPrevPage
  } = usePagination({
    totalItems: filteredEarnings?.length || 0,
    itemsPerPage: 25
  });

  const paginatedEarnings = filteredEarnings?.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profit Reports</h1>
          <p className="text-muted-foreground mt-2">Detailed breakdown of your earnings</p>
        </div>
        
        <Select value={earningFilter} onValueChange={(value: any) => setEarningFilter(value)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Earnings</SelectItem>
            <SelectItem value="non-rx">Non-Rx Commissions</SelectItem>
            <SelectItem value="rx-only">Rx Commissions</SelectItem>
            <SelectItem value="dev-fees">Practice Dev Fees</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Commissions + Development Fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Unpaid Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">${unpaidEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Paid Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${paidEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Received</p>
          </CardContent>
        </Card>
      </div>

      {effectiveRole === 'topline' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Earnings Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Product Commissions</p>
                <p className="text-2xl font-bold">${directSalesEarnings.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Practice Development Fees</p>
                <p className="text-2xl font-bold">${practiceDevFees.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Earnings History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference #</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : paginatedEarnings?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No earnings data yet
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEarnings?.map((earning: any) => (
                  <TableRow key={`${earning.earning_type}-${earning.id}`}>
                    <TableCell>
                      {format(new Date(earning.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={
                        earning.earning_type === 'practice_dev_fee' 
                          ? 'default' 
                          : 'secondary'
                      }>
                        {earning.earning_type === 'practice_dev_fee' 
                          ? 'Dev Fee' 
                          : 'Commission'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{earning.description}</span>
                        {earning.practice_name && (
                          <span className="text-xs text-muted-foreground">
                            {earning.practice_name}
                          </span>
                        )}
                        {earning.is_rx_required && (
                          <Badge variant="outline" className="text-xs w-fit">
                            Rx - No Commission
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="font-mono text-sm">
                      {earning.reference_number}
                    </TableCell>
                    
                    <TableCell>
                      <span className="font-medium">
                        ${parseFloat(earning.amount?.toString() || '0').toFixed(2)}
                      </span>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={
                          earning.payment_status === 'completed' || earning.payment_status === 'paid' 
                            ? 'default' 
                            : 'secondary'
                        }>
                          {earning.payment_status === 'completed' || earning.payment_status === 'paid' 
                            ? 'Paid' 
                            : 'Pending'}
                        </Badge>
                        
                        {earning.earning_type === 'practice_dev_fee' && 
                         earning.payment_status === 'paid' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {earning.payment_method && (
                              <div>Via: {earning.payment_method}</div>
                            )}
                            {earning.paid_at && (
                              <div>
                                Paid: {format(new Date(earning.paid_at), "MMM dd, yyyy")}
                              </div>
                            )}
                            {earning.payment_notes && (
                              <div className="italic">Note: {earning.payment_notes}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {earning.earning_type === 'practice_dev_fee' && earning.pdf_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.storage
                                .from("practice-development-invoices")
                                .createSignedUrl(earning.pdf_url, 3600);
                              
                              if (error) throw error;
                              
                              const response = await fetch(data.signedUrl);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${earning.invoice_number}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                              
                              toast({
                                title: "Invoice downloaded",
                                description: "Your invoice has been downloaded successfully."
                              });
                            } catch (error) {
                              console.error("Error downloading invoice:", error);
                              toast({
                                title: "Download failed",
                                description: "Failed to download invoice",
                                variant: "destructive"
                              });
                            }
                          }}
                          title="Download Invoice"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredEarnings && filteredEarnings.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          totalItems={filteredEarnings.length}
          startIndex={startIndex}
          endIndex={Math.min(endIndex, filteredEarnings.length)}
        />
      )}
    </div>
  );
};

export default RepProfitReports;
