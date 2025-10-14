import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DiscountCodeDialog } from "@/components/admin/DiscountCodeDialog";
import { DiscountCodeStatsDialog } from "@/components/admin/DiscountCodeStatsDialog";
import { Plus, Search, Tag, MoreHorizontal, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
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

const AdminDiscountCodes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<any>(null);
  const { toast } = useToast();

  const { data: discountCodes, refetch } = useQuery({
    queryKey: ["admin-discount-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const handleToggleActive = async (code: any) => {
    const { error } = await supabase
      .from("discount_codes")
      .update({ active: !code.active })
      .eq("id", code.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update discount code",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Discount code ${code.active ? "deactivated" : "activated"}`,
      });
      refetch();
    }
  };

  const filteredCodes = discountCodes?.filter((code) =>
    code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    code.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pagination = usePagination({
    totalItems: filteredCodes?.length || 0,
    itemsPerPage: 25,
    initialPage: 1,
  });

  const paginatedCodes = filteredCodes?.slice(
    pagination.startIndex,
    pagination.endIndex
  );

  const handleDelete = async (code: any) => {
    const { error } = await supabase
      .from("discount_codes")
      .delete()
      .eq("id", code.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete discount code",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Discount code deleted successfully",
      });
      refetch();
    }
    setDeleteConfirmCode(null);
  };

  const getStatusBadge = (code: any) => {
    const now = new Date();
    const validUntil = code.valid_until ? new Date(code.valid_until) : null;
    const isExpired = validUntil && validUntil < now;
    const isMaxedOut = code.max_uses && code.current_uses >= code.max_uses;

    if (!code.active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (isMaxedOut) {
      return <Badge variant="destructive">Max Uses Reached</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Active</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Discount Codes</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage discount codes for practices
          </p>
        </div>
        <Button onClick={() => {
          setSelectedCode(null);
          setShowDialog(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Discount Code
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            All Discount Codes
          </CardTitle>
          <CardDescription>
            Manage discount percentages, expiration dates, and usage limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Valid Period</TableHead>
            <TableHead>Usage Limits</TableHead>
            <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCodes && paginatedCodes.length > 0 ? (
                    paginatedCodes.map((code) => (
                      <TableRow key={code.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold">{code.code}</span>
                            {code.description && (
                              <span className="text-xs text-muted-foreground">{code.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-semibold">
                            {code.discount_percentage}% OFF
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(code)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>From: {code.valid_from ? format(new Date(code.valid_from), "MMM d, yyyy") : "Immediately"}</span>
                            <span>Until: {code.valid_until ? format(new Date(code.valid_until), "MMM d, yyyy") : "No expiration"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5 text-xs">
                            {/* Per-User Limit */}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs shrink-0">
                                Per User
                              </Badge>
                              <span className="font-medium">
                                {(code as any).max_uses_per_user || "Unlimited"}
                              </span>
                            </div>
                            
                            {/* Global Limit with Progress Bar */}
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Total
                              </Badge>
                              <div className="flex flex-col flex-1">
                                <span className="font-medium">
                                  {code.current_uses} / {code.max_uses || "∞"}
                                </span>
                                {code.max_uses && (
                                  <div className="w-full h-1.5 bg-secondary rounded-full mt-1">
                                    <div
                                      className="h-full bg-primary rounded-full"
                                      style={{
                                        width: `${Math.min((code.current_uses / code.max_uses) * 100, 100)}%`,
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedCode(code);
                                  setShowDialog(true);
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedCode(code);
                                  setShowStatsDialog(true);
                                }}
                              >
                                <TrendingUp className="h-4 w-4 mr-2" />
                                View Statistics
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(code)}
                              >
                                {code.active ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  navigator.clipboard.writeText(code.code);
                                  toast({
                                    title: "Copied!",
                                    description: "Code copied to clipboard",
                                  });
                                }}
                              >
                                Copy Code
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmCode(code)}
                                className="text-destructive focus:text-destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? "No discount codes found" : "No discount codes yet. Create your first one!"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              onPageChange={pagination.goToPage}
              hasNextPage={pagination.hasNextPage}
              hasPrevPage={pagination.hasPrevPage}
              totalItems={filteredCodes?.length || 0}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
            />
          </div>
        </CardContent>
      </Card>

      <DiscountCodeDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        discountCode={selectedCode}
        onSuccess={() => {
          refetch();
          setShowDialog(false);
          setSelectedCode(null);
        }}
      />

      <DiscountCodeStatsDialog
        open={showStatsDialog}
        onOpenChange={setShowStatsDialog}
        discountCode={selectedCode}
      />

      <AlertDialog
        open={!!deleteConfirmCode}
        onOpenChange={(open) => !open && setDeleteConfirmCode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discount Code?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the code "{deleteConfirmCode?.code}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirmCode)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDiscountCodes;
