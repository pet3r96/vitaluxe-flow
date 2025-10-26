import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { X, Plus } from "lucide-react";
import { format, addDays, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const DEFAULT_NOTES = `Notes:
- This invoice represents the monthly Practice Development Fee for non-clinical administrative, educational, and compliance-related services.
- Compensation is not based on or related to prescription volume, order value, or revenue generation.
- All activities performed under this agreement are administrative, relationship management, and educational in nature.
- This invoice covers the period of active provider engagement and practice support only.`;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toplineReps: Array<{ id: string; name: string; email: string }>;
  existingInvoice?: any;
}

export function InvoiceTemplateDialog({ 
  open, 
  onOpenChange, 
  toplineReps,
  existingInvoice 
}: InvoiceTemplateDialogProps) {
  const queryClient = useQueryClient();
  const [selectedRepId, setSelectedRepId] = useState("");
  const [billingMonth, setBillingMonth] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [isGenerating, setIsGenerating] = useState(false);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  // Initialize with default line items
  useEffect(() => {
    if (open && !existingInvoice) {
      const defaultItems = [
        {
          id: crypto.randomUUID(),
          description: "Practice Engagement & Support (Non-Clinical) — Number of active practices supported: 12",
          quantity: 1,
          rate: 1500.00,
          amount: 1500.00
        },
        {
          id: crypto.randomUUID(),
          description: "Administrative Coordination & Onboarding Activities",
          quantity: 1,
          rate: 750.00,
          amount: 750.00
        },
        {
          id: crypto.randomUUID(),
          description: "Compliance & Communication Oversight (Monthly Review & Training Support)",
          quantity: 1,
          rate: 500.00,
          amount: 500.00
        },
        {
          id: crypto.randomUUID(),
          description: "Reporting & Account Management Activities",
          quantity: 1,
          rate: 250.00,
          amount: 250.00
        }
      ];
      setLineItems(defaultItems);
      setNotes(DEFAULT_NOTES);
      
      // Initialize rate inputs
      const rateMap: Record<string, string> = {};
      defaultItems.forEach(item => {
        rateMap[item.id] = item.rate.toFixed(2);
      });
      setRateInputs(rateMap);
    }
  }, [open, existingInvoice]);

  // Load existing invoice data
  useEffect(() => {
    if (existingInvoice) {
      setSelectedRepId(existingInvoice.topline_rep_id);
      setBillingMonth(format(new Date(existingInvoice.billing_month), "yyyy-MM"));
      setInvoiceDate(format(new Date(existingInvoice.invoice_date), "yyyy-MM-dd"));
      const items = existingInvoice.invoice_template_data.line_items;
      setLineItems(items);
      setNotes(existingInvoice.invoice_template_data.notes);
      
      // Initialize rate inputs from existing data
      const rateMap: Record<string, string> = {};
      items.forEach((item: LineItem) => {
        rateMap[item.id] = (item.rate ?? 0).toFixed(2);
      });
      setRateInputs(rateMap);
    }
  }, [existingInvoice]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const totalDue = subtotal;
  const dueDate = invoiceDate ? addDays(new Date(invoiceDate), 15) : null;

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(items => items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Auto-calculate amount
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate;
        }
        return updated;
      }
      return item;
    }));
  };

  const addLineItem = () => {
    const newId = crypto.randomUUID();
    setLineItems([...lineItems, {
      id: newId,
      description: "",
      quantity: 1,
      rate: 0,
      amount: 0
    }]);
    setRateInputs(prev => ({ ...prev, [newId]: "0.00" }));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      toast.error("At least one line item is required");
      return;
    }
    setLineItems(items => items.filter(item => item.id !== id));
    setRateInputs(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const generateInvoiceNumber = async () => {
    const currentYear = new Date().getFullYear();
    const prefix = `VLX-${currentYear}-`;
    
    const { data: latestInvoice } = await supabase
      .from("practice_development_fee_invoices")
      .select("invoice_number")
      .ilike("invoice_number", `${prefix}%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    let nextNumber = 1;
    
    if (latestInvoice?.invoice_number) {
      const lastNumber = parseInt(latestInvoice.invoice_number.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }
    
    return `${prefix}${nextNumber.toString().padStart(5, '0')}`;
  };

  const validateForm = () => {
    if (!selectedRepId) {
      toast.error("Please select a representative");
      return false;
    }
    if (!billingMonth) {
      toast.error("Please select a billing month");
      return false;
    }
    if (lineItems.length === 0) {
      toast.error("At least one line item is required");
      return false;
    }
    
    for (const item of lineItems) {
      if (!item.description.trim()) {
        toast.error("All line items must have a description");
        return false;
      }
      if (item.quantity <= 0) {
        toast.error("Quantity must be greater than 0");
        return false;
      }
      if (item.rate <= 0) {
        toast.error("Rate must be greater than 0");
        return false;
      }
    }
    
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;

    try {
      const invoiceNumber = existingInvoice?.invoice_number || await generateInvoiceNumber();
      const billingMonthDate = startOfMonth(new Date(billingMonth));
      
      const dueDateStr = dueDate ? format(dueDate, "yyyy-MM-dd") : null;
      
      const invoiceData = {
        invoice_number: invoiceNumber,
        topline_rep_id: selectedRepId,
        billing_month: format(billingMonthDate, "yyyy-MM-dd"),
        invoice_date: invoiceDate,
        due_date: dueDateStr,
        amount: totalDue,
        invoice_template_data: {
          line_items: lineItems,
          notes,
          subtotal,
          total_due: totalDue
        } as any
      };

      if (existingInvoice) {
        const { error } = await supabase
          .from("practice_development_fee_invoices")
          .update(invoiceData)
          .eq("id", existingInvoice.id);
        
        if (error) throw error;
        toast.success("Invoice draft updated");
      } else {
        const { error } = await supabase
          .from("practice_development_fee_invoices")
          .insert([invoiceData]);
        
        if (error) throw error;
        toast.success("Invoice draft saved");
      }

      queryClient.invalidateQueries({ queryKey: ["practice-development-invoices"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save invoice draft");
    }
  };

  const handleGenerateInvoice = async () => {
    if (!validateForm()) return;

    try {
      setIsGenerating(true);
      
      const invoiceNumber = existingInvoice?.invoice_number || await generateInvoiceNumber();
      const billingMonthDate = startOfMonth(new Date(billingMonth));
      
      const dueDateStr = dueDate ? format(dueDate, "yyyy-MM-dd") : null;
      
      const invoiceData = {
        invoice_number: invoiceNumber,
        topline_rep_id: selectedRepId,
        billing_month: format(billingMonthDate, "yyyy-MM-dd"),
        invoice_date: invoiceDate,
        due_date: dueDateStr,
        amount: totalDue,
        invoice_template_data: {
          line_items: lineItems,
          notes,
          subtotal,
          total_due: totalDue
        } as any
      };


      let invoiceId = existingInvoice?.id;
      
      if (existingInvoice) {
        const { error } = await supabase
          .from("practice_development_fee_invoices")
          .update(invoiceData)
          .eq("id", existingInvoice.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("practice_development_fee_invoices")
          .insert([invoiceData])
          .select()
          .single();
        
        if (error) throw error;
        invoiceId = data.id;
      }

      // Generate PDF
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
        "generate-practice-development-invoice",
        { body: { invoice_id: invoiceId } }
      );

      if (pdfError) throw pdfError;

      toast.success("Invoice generated successfully");
      queryClient.invalidateQueries({ queryKey: ["practice-development-invoices"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingInvoice ? "Edit Invoice" : "Create Invoice"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Representative</Label>
              <Select value={selectedRepId} onValueChange={setSelectedRepId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rep" />
                </SelectTrigger>
                <SelectContent>
                  {toplineReps.map(rep => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Billing Month</Label>
              <Input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Invoice Date</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Line Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Line Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="font-medium">#{index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(item.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rate</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">$</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={rateInputs[item.id] ?? (item.rate ?? 0).toFixed(2)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/,/g, "");
                          if (raw === "" || /^[0-9]*\.?[0-9]{0,2}$/.test(raw)) {
                            setRateInputs(prev => ({ ...prev, [item.id]: raw }));
                            const num = parseFloat(raw);
                            updateLineItem(item.id, "rate", isNaN(num) ? 0 : num);
                          }
                        }}
                        onBlur={() => {
                          const raw = (rateInputs[item.id] ?? "").replace(/,/g, "");
                          const num = parseFloat(raw);
                          const formatted = isNaN(num) ? "0.00" : num.toFixed(2);
                          setRateInputs(prev => ({ ...prev, [item.id]: formatted }));
                          updateLineItem(item.id, "rate", isNaN(num) ? 0 : num);
                        }}
                        className="pl-7 bg-background border-input hover:border-primary focus:border-primary cursor-text"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="text"
                      value={`$${item.amount.toFixed(2)}`}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
            />
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total Due:</span>
              <span>${totalDue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Due Date:</span>
              <span>
                {dueDate && invoiceDate ? format(dueDate, "MMMM d, yyyy") : "—"} (Net 15)
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button onClick={handleGenerateInvoice} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}