import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMerchantFee = () => {
  const { data: feePercentage, isLoading } = useQuery({
    queryKey: ["merchant-fee-percentage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "merchant_processing_fee_percentage")
        .single();

      if (error) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error("Error fetching merchant fee", error);
        });
        return 3.75; // Fallback default
      }

      return parseFloat(data.setting_value as string);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const calculateMerchantFee = (subtotal: number, shipping: number) => {
    const percentage = feePercentage || 3.75;
    const baseAmount = subtotal + shipping;
    return (baseAmount * percentage) / 100;
  };

  return {
    feePercentage: feePercentage || 3.75,
    isLoading,
    calculateMerchantFee,
  };
};
