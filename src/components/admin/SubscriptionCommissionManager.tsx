import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, CheckCircle2, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";

export default function SubscriptionCommissionManager() {
  const queryClient = useQueryClient();
  const [selectedCommission, setSelectedCommission] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  
  // Fetch all subscription commissions
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["admin-subscription-commissions", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("rep_subscription_commissions")
        .select(`
          *,
          profiles!practice_id(
            id,
            full_name,
            email
          ),
          practice_subscriptions!subscription_id(
            status,
            monthly_price,
            rep_commission_percentage
          ),
          subscription_payments!payment_id(
            payment_status,
            transaction_id,
            payment_date
          ),
          paid_by_user:paid_by(
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq("payment_status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  
  const pagination = usePagination({ totalItems: commissions?.length || 0, itemsPerPage: 10 });

  // Mark commission as paid
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, method, notes }: { id: string; method: string; notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("rep_subscription_commissions")
        .update({
          payment_status: 'paid',
          payment_method: method,
          payment_notes: notes,
          paid_by: user?.id,
          paid_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission marked as paid");
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-commissions"] });
      setSelectedCommission(null);
      setPaymentMethod("");
      setPaymentNotes("");
    },
    onError: (error) => {
      toast.error(`Failed to mark as paid: ${error.message}`);
    },
  });

  const handleMarkAsPaid = () => {
    if (!selectedCommission || !paymentMethod) {
      toast.error("Please fill in all required fields");
      return;
    }

    markAsPaidMutation.mutate({
      id: selectedCommission.id,
      method: paymentMethod,
      notes: paymentNotes,
    });
  };

  // Calculate totals
  const totalPending = commissions?.filter(c => c.payment_status === 'pending')
    .reduce((sum, c) => sum + parseFloat(c.commission_amount || '0'), 0) || 0;
  const totalPaid = commissions?.filter(c => c.payment_status === 'paid')
    .reduce((sum, c) => sum + parseFloat(c.commission_amount || '0'), 0) || 0;

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Subscription Commission Management</h2>
        <p className="text-muted-foreground">Manage payouts for subscription referral commissions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPending.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {commissions?.filter(c => c.payment_status === 'pending').length || 0} commissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPaid.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {commissions?.filter(c => c.payment_status === 'paid').length || 0} commissions
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Subscription Commissions</CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead>Practice</TableHead>
                <TableHead>Commission %</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!commissions || commissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No commissions found
                  </TableCell>
                </TableRow>
              ) : (
                commissions
                  .slice(
                    pagination.startIndex,
                    pagination.endIndex
                  )
                  .map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        {format(new Date(commission.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">Rep {commission.rep_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {commission.profiles?.full_name || 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {commission.profiles?.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {commission.practice_subscriptions?.rep_commission_percentage || 20}%
                      </TableCell>
                      <TableCell className="font-medium">
                        ${parseFloat(commission.commission_amount?.toString() || '0').toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={commission.payment_status === 'paid' ? 'default' : 'secondary'}>
                          {commission.payment_status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {commission.payment_status === 'pending' && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => setSelectedCommission(commission)}
                              >
                                Mark as Paid
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Mark Commission as Paid</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Rep</Label>
                                  <p className="text-sm">Rep ID: {commission.rep_id}</p>
                                </div>
                                <div className="space-y-2">
                                  <Label>Amount</Label>
                    <p className="text-sm font-medium">
                      ${parseFloat(commission.commission_amount?.toString() || '0').toFixed(2)}
                    </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="payment-method">Payment Method *</Label>
                                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger id="payment-method">
                                      <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                                      <SelectItem value="check">Check</SelectItem>
                                      <SelectItem value="paypal">PayPal</SelectItem>
                                      <SelectItem value="venmo">Venmo</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="payment-notes">Notes</Label>
                                  <Textarea
                                    id="payment-notes"
                                    placeholder="Add any payment notes..."
                                    value={paymentNotes}
                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                  />
                                </div>
                                <Button
                                  onClick={handleMarkAsPaid}
                                  className="w-full"
                                  disabled={markAsPaidMutation.isPending}
                                >
                                  {markAsPaidMutation.isPending ? "Processing..." : "Confirm Payment"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        {commission.payment_status === 'paid' && (
                          <div className="text-sm text-muted-foreground">
                            Paid: {commission.paid_at && format(new Date(commission.paid_at), "MMM dd, yyyy")}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
          <DataTablePagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.goToPage}
            hasNextPage={pagination.hasNextPage}
            hasPrevPage={pagination.hasPrevPage}
            totalItems={commissions?.length || 0}
            startIndex={pagination.startIndex}
            endIndex={Math.min(pagination.endIndex, commissions?.length || 0)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
