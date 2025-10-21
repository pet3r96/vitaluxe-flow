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
import { AlertTriangle, AlertCircle, Eye, Trash2, Loader2, CheckCircle2, UserX } from "lucide-react";

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
  
  // Clear Storage state
  const [isClearingStorage, setIsClearingStorage] = useState(false);
  const [showClearStorageDialog, setShowClearStorageDialog] = useState(false);
  const [clearStorageConfirmText, setClearStorageConfirmText] = useState("");
  const [clearStorageResult, setClearStorageResult] = useState<any>(null);
  
  // Bulk delete users state
  const [bulkDeleteEmails, setBulkDeleteEmails] = useState("");
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<any>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  
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

      // Check if we have valid data even if there's an error reported
      const hasValidData = data && typeof data.total_deleted === 'number';
      
      if (!hasValidData && error) {
        throw error;
      }

      // Use data even if error is present (edge function might succeed but report error)
      const resultData = data || { total_deleted: 0, execution_time_seconds: 0, deleted_counts: {} };
      
      setDeleteOrdersResult(resultData);
      setShowDeleteOrdersDialog(false);
      setDeleteOrdersConfirmText("");
      
      // Invalidate orders-related queries to refresh the UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["order-lines"] }),
        queryClient.invalidateQueries({ queryKey: ["order-profits"] }),
        queryClient.invalidateQueries({ queryKey: ["commissions"] }),
      ]);
      
      toast({
        title: "Success",
        description: `Deleted ${resultData.total_deleted} order records in ${resultData.execution_time_seconds}s`,
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

  const handleClearStorage = async () => {
    if (clearStorageConfirmText !== "CLEAR ALL STORAGE") {
      toast({
        title: "Error",
        description: "Please type CLEAR ALL STORAGE to confirm",
        variant: "destructive",
      });
      return;
    }

    setIsClearingStorage(true);
    try {
      const { data, error } = await supabase.functions.invoke("clear-storage-files", {
        body: { confirm: "CLEAR ALL STORAGE" },
      });

      const hasValidData = data && typeof data.total_files_deleted === 'number';
      
      if (!hasValidData && error) {
        throw error;
      }

      const resultData = data || { total_files_deleted: 0, execution_time_seconds: 0, cleared_buckets: {} };
      
      setClearStorageResult(resultData);
      setShowClearStorageDialog(false);
      setClearStorageConfirmText("");
      
      toast({
        title: "Success",
        description: `Cleared ${resultData.total_files_deleted} files from storage in ${resultData.execution_time_seconds}s`,
      });
    } catch (error: any) {
      console.error("Clear storage error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear storage files",
        variant: "destructive",
      });
    } finally {
      setIsClearingStorage(false);
    }
  };

  const handleBulkDeleteUsers = async () => {
    setBulkDeleteLoading(true);
    setBulkDeleteResult(null);

    try {
      // Parse emails from textarea (comma or newline separated)
      const emails = bulkDeleteEmails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(e => e.length > 0);

      if (emails.length === 0) {
        toast({
          title: "Error",
          description: "Please enter at least one email address",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('cleanup-test-data', {
        body: { emails }
      });
      
      if (error) throw error;
      
      setBulkDeleteResult(data);
      setShowBulkDeleteConfirm(false);
      
      if (data.success) {
        toast({
          title: "Success",
          description: `Successfully deleted ${data.totals.deleted} user(s)`
        });
      } else {
        toast({
          title: "Partial Success",
          description: `Deleted ${data.totals.deleted} user(s) with ${data.totals.errors} error(s)`,
          variant: "default"
        });
      }
    } catch (error: any) {
      console.error('Error deleting users:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete users",
        variant: "destructive"
      });
      setBulkDeleteResult({ error: error.message });
    } finally {
      setBulkDeleteLoading(false);
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
          Permanently delete all test data and users (except admin users). 
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
                  <li>Remove ALL users except admin users</li>
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

        {/* Clear Storage Section */}
        <Card className="border-destructive/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Clear All Storage Files
            </CardTitle>
            <CardDescription>
              Remove all files from storage buckets (receipts, prescriptions, contracts, terms-signed, quarantine)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will permanently delete all uploaded files from storage buckets. 
                Product images will be preserved. This action cannot be undone.
              </AlertDescription>
            </Alert>

            <Button
              variant="destructive"
              onClick={() => setShowClearStorageDialog(true)}
              disabled={isClearingStorage}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isClearingStorage ? "Clearing..." : "Clear All Storage Files"}
            </Button>

            {clearStorageResult && (
              <div className="space-y-4 mt-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Cleared {clearStorageResult.total_files_deleted} files in {clearStorageResult.execution_time_seconds}s
                  </AlertDescription>
                </Alert>

                {clearStorageResult.cleared_buckets && Object.keys(clearStorageResult.cleared_buckets).length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Bucket Results</h3>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Bucket</TableHead>
                            <TableHead className="text-right">Files Deleted</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(clearStorageResult.cleared_buckets).map(([bucket, result]: [string, any]) => (
                            <TableRow key={bucket}>
                              <TableCell className="font-mono text-sm">{bucket}</TableCell>
                              <TableCell className="text-right">{result.files_deleted}</TableCell>
                              <TableCell>
                                {result.errors && result.errors.length > 0 ? (
                                  <span className="text-destructive text-xs">{result.errors[0]}</span>
                                ) : (
                                  <span className="text-green-600 text-xs">✓ Success</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clear Storage Confirmation Dialog */}
        <AlertDialog open={showClearStorageDialog} onOpenChange={setShowClearStorageDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Storage Cleanup
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>This action will permanently delete all files from these storage buckets:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Receipts</li>
                  <li>Prescriptions</li>
                  <li>Contracts</li>
                  <li>Terms Signed</li>
                  <li>Quarantine</li>
                </ul>
                <p className="text-xs text-muted-foreground">Note: Product images will NOT be deleted</p>
                <p className="font-semibold mt-4">Type "CLEAR ALL STORAGE" to confirm:</p>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Input
              value={clearStorageConfirmText}
              onChange={(e) => setClearStorageConfirmText(e.target.value)}
              placeholder="CLEAR ALL STORAGE"
              className="font-mono"
            />

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setClearStorageConfirmText("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearStorage}
                disabled={isClearingStorage || clearStorageConfirmText !== "CLEAR ALL STORAGE"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isClearingStorage ? "Clearing..." : "Clear Storage"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Users Section */}
        <Card className="border-destructive/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <UserX className="h-5 w-5" />
              Bulk Delete Users by Email
            </CardTitle>
            <CardDescription>
              Delete test users by providing their email addresses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Users with orders or patients will not be deleted (safety check enabled). 
                Only test accounts without data can be removed.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Addresses (one per line or comma-separated)</label>
              <textarea
                className="w-full min-h-[120px] p-3 rounded-md border bg-background text-sm font-mono"
                placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                value={bulkDeleteEmails}
                onChange={(e) => setBulkDeleteEmails(e.target.value)}
                disabled={bulkDeleteLoading}
              />
            </div>

            <Button
              variant="destructive"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkDeleteLoading || !bulkDeleteEmails.trim()}
            >
              {bulkDeleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting Users...
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Delete Users
                </>
              )}
            </Button>

            {bulkDeleteResult && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="font-semibold">Summary:</span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600">✓ Deleted: {bulkDeleteResult.totals?.deleted || 0}</span>
                    <span className="text-red-600">✗ Errors: {bulkDeleteResult.totals?.errors || 0}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {bulkDeleteResult.results?.map((result: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-md text-sm ${
                        result.success ? 'bg-green-50 dark:bg-green-950 border border-green-200' : 'bg-red-50 dark:bg-red-950 border border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-mono font-semibold">{result.email}</span>
                        <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                          {result.success ? '✓' : '✗'}
                        </span>
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">{result.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete These Users?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>This will permanently delete the specified user accounts and their associated data (reps, providers, roles, carts).</p>
                <p className="text-sm text-muted-foreground">Users with orders or patients will be skipped for safety.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDeleteUsers} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Yes, Delete Users
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
