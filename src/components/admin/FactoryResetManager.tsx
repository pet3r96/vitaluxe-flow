import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, AlertCircle, Eye, Trash2, Loader2, CheckCircle2 } from "lucide-react";

interface DryRunResponse {
  mode: 'dryRun';
  admin_verified: boolean;
  admin_email: string;
  admin_user_id: string;
  current_counts: Record<string, number>;
  preserved_tables: Record<string, number>;
  total_records_to_delete: number;
  estimated_time_seconds: number;
}

interface ExecuteResponse {
  success: boolean;
  mode: 'execute';
  deleted_counts: Record<string, number>;
  final_counts: Record<string, number>;
  total_deleted: number;
  execution_time_seconds: number;
  admin_preserved: {
    user_id: string;
    email: string;
    role: string;
  };
}

const CountsTable = ({ data, title }: { data: Record<string, number>; title: string }) => {
  const entries = Object.entries(data).filter(([_, count]) => count > 0);
  
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead className="text-right">Records</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([table, count]) => (
              <TableRow key={table}>
                <TableCell className="font-mono text-sm">{table}</TableCell>
                <TableCell className="text-right">{count.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export const FactoryResetManager = () => {
  const [dryRunData, setDryRunData] = useState<DryRunResponse | null>(null);
  const [isLoadingDryRun, setIsLoadingDryRun] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteResponse | null>(null);
  
  // Delete Orders state
  const [isDeletingOrders, setIsDeletingOrders] = useState(false);
  const [showDeleteOrdersDialog, setShowDeleteOrdersDialog] = useState(false);
  const [deleteOrdersConfirmText, setDeleteOrdersConfirmText] = useState("");
  const [deleteOrdersResult, setDeleteOrdersResult] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDryRun = async () => {
    setIsLoadingDryRun(true);
    setExecuteResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('factory-reset', {
        body: { mode: 'dryRun' }
      });

      if (error) throw error;

      setDryRunData(data);
      toast({
        title: "Preview Complete",
        description: `Ready to delete ${data.total_records_to_delete.toLocaleString()} records`,
      });
    } catch (error: any) {
      console.error('Dry run error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to preview deletion',
        variant: "destructive",
      });
    } finally {
      setIsLoadingDryRun(false);
    }
  };

  const handleExecute = async () => {
    if (confirmText !== "ERASE ALL") {
      toast({
        title: "Error",
        description: "Please type ERASE ALL to confirm",
        variant: "destructive",
      });
      return;
    }

    setIsExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("factory-reset", {
        body: { mode: "execute" },
      });

      if (error) throw error;

      setExecuteResult(data);
      setShowConfirmDialog(false);
      setConfirmText("");
      toast({
        title: "Success",
        description: `Factory reset complete! Deleted ${data.total_deleted} records in ${data.execution_time_seconds}s`,
      });
    } catch (error: any) {
      console.error("Execution error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to execute factory reset",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDeleteOrders = async () => {
    if (deleteOrdersConfirmText !== "DELETE ALL ORDERS") {
      toast({
        title: "Error",
        description: "Please type DELETE ALL ORDERS to confirm",
        variant: "destructive",
      });
      return;
    }

    setIsDeletingOrders(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-all-orders", {
        body: { confirm: "DELETE ALL ORDERS" },
      });

      if (error) throw error;

      setDeleteOrdersResult(data);
      setShowDeleteOrdersDialog(false);
      setDeleteOrdersConfirmText("");
      
      // Invalidate orders-related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-lines"] });
      queryClient.invalidateQueries({ queryKey: ["order-profits"] });
      
      toast({
        title: "Success",
        description: `Deleted ${data.total_deleted} order records in ${data.execution_time_seconds}s`,
      });
    } catch (error: any) {
      console.error("Delete orders error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete orders",
        variant: "destructive",
      });
    } finally {
      setIsDeletingOrders(false);
    }
  };

  const resetState = () => {
    setDryRunData(null);
    setExecuteResult(null);
    setConfirmText("");
  };

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Factory Reset (Danger Zone)
        </CardTitle>
        <CardDescription>
          Permanently delete all test data and users (except admin@vitaluxeservice.com). 
          This preserves system configuration but cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning Alert */}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> This will permanently delete all orders, 
            products, users, and data except the admin account and system configuration.
          </AlertDescription>
        </Alert>

        {/* Dry Run Section */}
        {!dryRunData && !executeResult && (
          <Button 
            onClick={handleDryRun}
            disabled={isLoadingDryRun || isExecuting}
            variant="outline"
            className="w-full"
          >
            {isLoadingDryRun ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Preview...
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Preview Deletion (Dry Run)
              </>
            )}
          </Button>
        )}

        {/* Dry Run Results */}
        {dryRunData && !executeResult && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Admin Account:</strong> {dryRunData.admin_email}</p>
                  <p><strong>Total Records to Delete:</strong> {dryRunData.total_records_to_delete.toLocaleString()}</p>
                  <p><strong>Estimated Time:</strong> ~{dryRunData.estimated_time_seconds} seconds</p>
                </div>
              </AlertDescription>
            </Alert>

            <CountsTable data={dryRunData.current_counts} title="Records to Delete" />
            <CountsTable data={dryRunData.preserved_tables} title="Preserved Configuration Tables" />

            <div className="flex gap-2">
              <Button
                onClick={() => setShowConfirmDialog(true)}
                disabled={isExecuting}
                variant="destructive"
                className="flex-1"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Everything Now ({dryRunData.total_records_to_delete.toLocaleString()} records)
              </Button>
              <Button
                onClick={resetState}
                variant="outline"
                disabled={isExecuting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Execute Results */}
        {executeResult && (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-1">
                  <p><strong>Factory Reset Complete</strong></p>
                  <p>Deleted {executeResult.total_deleted.toLocaleString()} records in {executeResult.execution_time_seconds}s</p>
                  <p>Admin account preserved: {executeResult.admin_preserved.email}</p>
                </div>
              </AlertDescription>
            </Alert>

            <CountsTable data={executeResult.final_counts} title="Final Counts (Verification)" />

            <Button
              onClick={() => {
                resetState();
                handleDryRun();
              }}
              variant="outline"
              className="w-full"
            >
              <Eye className="mr-2 h-4 w-4" />
              Run Another Preview
            </Button>
          </div>
        )}

        {/* Loading Overlay */}
        {isExecuting && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <strong>Deleting data...</strong> This may take 30-60 seconds. Please do not close this window.
            </AlertDescription>
          </Alert>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Irreversible Factory Reset
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>This action will:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Delete ALL orders, products, and inventory</li>
                  <li>Remove ALL users except admin@vitaluxeservice.com</li>
                  <li>Erase ALL logs and security events (except admin)</li>
                  <li>Cannot be undone or reversed</li>
                </ul>
                <p className="font-semibold mt-4">Type "ERASE ALL" to confirm:</p>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ERASE ALL"
              className="font-mono"
            />

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleExecute}
                disabled={confirmText !== "ERASE ALL"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirm Deletion
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Orders Section */}
        <Card className="border-destructive/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete All Orders
            </CardTitle>
            <CardDescription>
              Remove all order data while preserving users, products, and other entities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will permanently delete all orders, order lines, shipping logs, and related data. 
                Users, products, pharmacies, and other entities will be preserved.
              </AlertDescription>
            </Alert>

            <Button
              variant="destructive"
              onClick={() => setShowDeleteOrdersDialog(true)}
              disabled={isDeletingOrders}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeletingOrders ? "Deleting..." : "Delete All Orders"}
            </Button>

            {deleteOrdersResult && (
              <div className="space-y-4 mt-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Deletion completed in {deleteOrdersResult.execution_time_seconds}s
                  </AlertDescription>
                </Alert>

                <CountsTable data={deleteOrdersResult.deleted_counts} title="Deleted Records" />
                <p className="text-sm text-muted-foreground">
                  Total deleted: <strong>{deleteOrdersResult.total_deleted}</strong> records
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Orders Confirmation Dialog */}
        <AlertDialog open={showDeleteOrdersDialog} onOpenChange={setShowDeleteOrdersDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Order Deletion
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>This action will permanently delete all orders and related data. This cannot be undone.</p>
                <p className="font-semibold mt-4">Type "DELETE ALL ORDERS" to confirm:</p>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Input
              value={deleteOrdersConfirmText}
              onChange={(e) => setDeleteOrdersConfirmText(e.target.value)}
              placeholder="DELETE ALL ORDERS"
              className="font-mono"
            />

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteOrdersConfirmText("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteOrders}
                disabled={isDeletingOrders || deleteOrdersConfirmText !== "DELETE ALL ORDERS"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingOrders ? "Deleting..." : "Delete Orders"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
