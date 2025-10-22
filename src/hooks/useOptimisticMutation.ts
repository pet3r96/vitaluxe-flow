import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

/**
 * Hook for optimistic updates - updates UI immediately before server confirms
 * Provides better perceived performance for user actions
 */
export const useOptimisticMutation = <TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  {
    queryKey,
    onSuccess,
    onError,
    updateFn,
    successMessage,
    errorMessage,
  }: {
    queryKey: string[];
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    updateFn: (oldData: any, variables: TVariables) => any;
    successMessage?: string;
    errorMessage?: string;
  }
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData(queryKey, (old: any) => updateFn(old, variables));

      // Return context with previous data
      return { previousData };
    },
    onError: (error, variables, context: any) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      
      toast({
        title: "Error",
        description: errorMessage || "An error occurred. Please try again.",
        variant: "destructive",
      });
      
      onError?.(error as Error);
    },
    onSuccess: (data) => {
      if (successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }
      onSuccess?.(data);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure sync with server
      queryClient.invalidateQueries({ queryKey });
    },
  });
};
