import { CreditCard, Building2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaymentMethod } from "@/types/payment";

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethod;
  onSetDefault: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export const PaymentMethodCard = ({
  paymentMethod,
  onSetDefault,
  onDelete,
  isDeleting
}: PaymentMethodCardProps) => {
  return (
    <div className="p-4 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {paymentMethod.payment_type === 'credit_card' ? (
            <>
              <CreditCard className="h-4 w-4" />
              <span className="font-medium">
                {paymentMethod.card_type} •••• {paymentMethod.card_last_five}
              </span>
              {paymentMethod.card_expiry && (
                <span className="text-xs text-muted-foreground">
                  Exp: {paymentMethod.card_expiry}
                </span>
              )}
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4" />
              <span className="font-medium">
                {paymentMethod.bank_name} {paymentMethod.account_type} •••• {paymentMethod.account_last_five}
              </span>
            </>
          )}
          {paymentMethod.is_default && (
            <Badge variant="secondary">Default</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!paymentMethod.is_default && (
            <Button variant="ghost" size="sm" onClick={onSetDefault}>
              <Star className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={isDeleting}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {paymentMethod.billing_street && (
        <p className="text-xs text-muted-foreground">
          {paymentMethod.billing_street}, {paymentMethod.billing_city}, {paymentMethod.billing_state} {paymentMethod.billing_zip}
        </p>
      )}
    </div>
  );
};
