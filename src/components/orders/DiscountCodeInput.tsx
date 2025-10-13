import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tag, Loader2, X } from "lucide-react";

interface DiscountCodeInputProps {
  onDiscountApplied: (code: string, percentage: number) => void;
  onDiscountRemoved: () => void;
  currentCode?: string;
  currentPercentage?: number;
}

export const DiscountCodeInput = ({
  onDiscountApplied,
  onDiscountRemoved,
  currentCode,
  currentPercentage
}: DiscountCodeInputProps) => {
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const handleApply = async () => {
    if (!code.trim()) {
      toast({
        title: "Enter a code",
        description: "Please enter a discount code",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.rpc('validate_discount_code', {
        p_code: code.trim()
      });

      if (error) throw error;

      const result = data[0];
      if (result.valid) {
        onDiscountApplied(code.trim().toUpperCase(), result.discount_percentage);
        toast({
          title: "Discount applied!",
          description: `${result.discount_percentage}% off your order`
        });
        setCode("");
      } else {
        toast({
          title: "Invalid code",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to validate discount code",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  if (currentCode) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              {currentCode} applied
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {currentPercentage}% discount
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscountRemoved}
          className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Enter discount code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          className="pl-10"
          disabled={isValidating}
        />
      </div>
      <Button
        onClick={handleApply}
        disabled={isValidating || !code.trim()}
        variant="outline"
      >
        {isValidating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Apply"
        )}
      </Button>
    </div>
  );
};
