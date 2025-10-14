import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const formSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(20, "Code must be at most 20 characters")
    .regex(/^[A-Z0-9]+$/, "Code must contain only uppercase letters and numbers"),
  discount_percentage: z
    .number()
    .min(1, "Discount must be at least 1%")
    .max(100, "Discount cannot exceed 100%"),
  description: z.string().optional(),
  active: z.boolean().default(true),
  valid_from: z.date().optional(),
  valid_until: z.date().optional(),
  max_uses: z.number().optional(),
  max_uses_per_user: z.number().optional(),
});

interface DiscountCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountCode?: any;
  onSuccess: () => void;
}

export const DiscountCodeDialog = ({
  open,
  onOpenChange,
  discountCode,
  onSuccess,
}: DiscountCodeDialogProps) => {
  const { toast } = useToast();
  const isEditing = !!discountCode;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      discount_percentage: 10,
      description: "",
      active: true,
      valid_from: undefined,
      valid_until: undefined,
      max_uses: undefined,
      max_uses_per_user: 1,
    },
  });

  useEffect(() => {
    if (discountCode) {
      form.reset({
        code: discountCode.code,
        discount_percentage: parseFloat(discountCode.discount_percentage),
        description: discountCode.description || "",
        active: discountCode.active,
        valid_from: discountCode.valid_from ? new Date(discountCode.valid_from) : undefined,
        valid_until: discountCode.valid_until ? new Date(discountCode.valid_until) : undefined,
        max_uses: discountCode.max_uses || undefined,
        max_uses_per_user: discountCode.max_uses_per_user || 1,
      });
    } else {
      form.reset({
        code: "",
        discount_percentage: 10,
        description: "",
        active: true,
        valid_from: undefined,
        valid_until: undefined,
        max_uses: undefined,
        max_uses_per_user: 1,
      });
    }
  }, [discountCode, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("discount_codes")
          .update({
            code: values.code,
            discount_percentage: values.discount_percentage,
            description: values.description,
            active: values.active,
            valid_from: values.valid_from?.toISOString(),
            valid_until: values.valid_until?.toISOString(),
            max_uses: values.max_uses || null,
            max_uses_per_user: values.max_uses_per_user || 1,
          })
          .eq("id", discountCode.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Discount code updated successfully",
        });
      } else {
        const { error } = await supabase.from("discount_codes").insert({
          code: values.code,
          discount_percentage: values.discount_percentage,
          description: values.description,
          active: values.active,
          valid_from: values.valid_from?.toISOString(),
          valid_until: values.valid_until?.toISOString(),
          max_uses: values.max_uses || null,
          max_uses_per_user: values.max_uses_per_user || 1,
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Discount code created successfully",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save discount code",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Discount Code" : "Create Discount Code"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the discount code details below"
              : "Create a new discount code for practices to use at checkout"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="WELCOME10"
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>
                    Uppercase letters and numbers only (e.g., SAVE20, NEWYEAR2024)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discount_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      min={1}
                      max={100}
                      step={0.01}
                    />
                  </FormControl>
                  <FormDescription>
                    Percentage to discount from the total (1-100%)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="New customer promotion - 10% off first order"
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Internal description to help identify the purpose of this code
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valid_from"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Valid From (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Immediately</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Valid Until (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>No expiration</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Usage Limits Section */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/50">
              <div className="space-y-1">
                <h4 className="font-medium">Usage Limits</h4>
                <p className="text-sm text-muted-foreground">
                  Control how many times this code can be used
                </p>
              </div>

              <FormField
                control={form.control}
                name="max_uses_per_user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <span className="font-semibold">Per Customer</span>
                      <Badge variant="outline" className="text-xs">Recommended</Badge>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                        value={field.value || ""}
                        min={1}
                        placeholder="1"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      <strong>How many times EACH customer can use this code.</strong>
                      <br />
                      Example: Set to <code className="bg-muted px-1 rounded">1</code> = each customer can use it once
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <span className="font-semibold">Total Global Limit</span>
                      <Badge variant="secondary" className="text-xs">Optional</Badge>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                        value={field.value || ""}
                        min={1}
                        placeholder="Leave empty for unlimited"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      <strong>Total uses across ALL customers (optional cap).</strong>
                      <br />
                      Example: Set to <code className="bg-muted px-1 rounded">100</code> = only first 100 customers can use it
                      <br />
                      Leave empty = unlimited total uses
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Visual Example Section */}
              <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 space-y-2">
                <h5 className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                  💡 Configuration Examples:
                </h5>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded shrink-0">Per Customer: 1, Total: (empty)</span>
                    <span>= Each customer uses it once, unlimited customers ✅</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded shrink-0">Per Customer: 1, Total: 100</span>
                    <span>= First 100 customers each use it once</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded shrink-0">Per Customer: 5, Total: (empty)</span>
                    <span>= VIP customers can use it 5 times each</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded shrink-0">Per Customer: (empty), Total: 1</span>
                    <span>= Only 1 customer total can use it (old behavior)</span>
                  </div>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <FormDescription>
                      Only active codes can be used at checkout
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Update" : "Create"} Discount Code
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
