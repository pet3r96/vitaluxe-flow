import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InvoiceListProps {
  invoices: any[];
}

export function InvoiceList({ invoices }: InvoiceListProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      succeeded: "default",
      paid: "default",
      pending: "secondary",
      failed: "destructive",
      refunded: "outline",
    };
    return variants[status] || "outline";
  };

  const handleDownload = (invoiceId: string) => {
    // TODO: Implement PDF download
    console.log("Download invoice:", invoiceId);
  };

  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View and download your past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No invoices yet</p>
            <p className="text-sm mt-1">Your invoices will appear here after billing</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing History</CardTitle>
        <CardDescription>View and download your past invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {invoice.transaction_id || `PAY-${invoice.id.slice(0, 8)}`}
                </TableCell>
                <TableCell>
                  {format(new Date(invoice.created_at), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusBadge(invoice.payment_status)}>
                    {invoice.payment_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(invoice.id)}
                    disabled
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
