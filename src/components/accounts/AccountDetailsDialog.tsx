import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface AccountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  onSuccess: () => void;
}

export const AccountDetailsDialog = ({
  open,
  onOpenChange,
  account,
}: AccountDetailsDialogProps) => {
  const getDisplayRole = (account: any): string => {
    const baseRole = account.user_roles?.[0]?.role;
    
    if (baseRole === 'doctor') {
      const isProvider = account.providers && account.providers.length > 0;
      return isProvider ? 'provider' : 'practice';
    }
    
    return baseRole || 'No role';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Account Details</DialogTitle>
          <DialogDescription>View and manage account information</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{account.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{account.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge>{getDisplayRole(account)}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={account.active ? "default" : "secondary"}>
                {account.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            {account.company && (
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{account.company}</p>
              </div>
            )}
            {account.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{account.phone}</p>
              </div>
            )}
            {account.address && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{account.address}</p>
              </div>
            )}
            {account.npi && (
              <div>
                <p className="text-sm text-muted-foreground">NPI</p>
                <p className="font-medium">{account.npi}</p>
              </div>
            )}
            {account.dea && (
              <div>
                <p className="text-sm text-muted-foreground">DEA</p>
                <p className="font-medium">{account.dea}</p>
              </div>
            )}
            {account.license_number && (
              <div>
                <p className="text-sm text-muted-foreground">License Number</p>
                <p className="font-medium">{account.license_number}</p>
              </div>
            )}
          </div>

          {account.contract_url && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Contract</p>
              <Button variant="outline" asChild>
                <a href={account.contract_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Contract
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
