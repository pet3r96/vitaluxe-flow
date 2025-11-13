import { useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { downloadPdfFromBase64, generateScheduleFilename } from "@/lib/pdfGenerator";
import { cn } from "@/lib/utils";
import { getProviderDisplayName } from "@/utils/providerNameUtils";

interface PrintDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  practiceId: string;
  providers: any[];
  currentDate: Date;
  isProviderAccount: boolean;
  currentProviderId?: string;
  currentProviderName?: string;
}

export function PrintDayDialog({
  open,
  onOpenChange,
  practiceId,
  providers,
  currentDate,
  isProviderAccount,
  currentProviderId,
  currentProviderName
}: PrintDayDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // For provider accounts, lock to their own ID
  const effectiveProviderId = isProviderAccount ? currentProviderId : 
                              selectedProvider === "all" ? undefined : selectedProvider;

  const effectiveProviderName = isProviderAccount ? currentProviderName :
                                selectedProvider === "all" ? "All Providers" :
                                getProviderDisplayName(providers.find(p => p.id === selectedProvider)) || "Selected Provider";

  // Load preview count
  const loadPreview = async () => {
    if (!selectedDate) return;
    
    setIsLoadingPreview(true);
    try {
      const startOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T00:00:00Z';
      const endOfDay = format(selectedDate, 'yyyy-MM-dd') + 'T23:59:59Z';

      let query = supabase
        .from('patient_appointments')
        .select('id', { count: 'exact', head: true })
        .eq('practice_id', practiceId)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay);

      if (effectiveProviderId) {
        query = query.eq('provider_id', effectiveProviderId);
      }

      const { count } = await query;
      setPreviewCount(count || 0);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast({
        title: "Preview Error",
        description: "Failed to load appointment count.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!selectedDate) {
      toast({
        title: "Date Required",
        description: "Please select a date for the schedule.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-day-schedule-pdf', {
        body: {
          practiceId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          providerId: effectiveProviderId
        }
      });

      if (error) throw error;

      if (!data?.success || !data?.pdf) {
        throw new Error('Failed to generate PDF');
      }

      // Download the PDF
      const filename = generateScheduleFilename(selectedDate, effectiveProviderName);
      downloadPdfFromBase64(data.pdf, filename);

      toast({
        title: "Schedule Downloaded",
        description: `Daily schedule downloaded successfully (${data.appointmentCount} appointments)`,
      });

      onOpenChange(false);

    } catch (error: any) {
      console.error('Error generating PDF:', error);
      
      let errorMessage = "Failed to generate schedule. Please try again.";
      if (error.message?.includes('authenticated')) {
        errorMessage = "Authentication required. Please log in again.";
      } else if (error.message?.includes('permission')) {
        errorMessage = "You don't have permission to print this schedule.";
      } else if (error.message?.includes('own schedule')) {
        errorMessage = "You can only print your own schedule.";
      }

      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Daily Schedule
          </DialogTitle>
          <DialogDescription>
            Generate a printable PDF schedule for the selected date and provider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setPreviewCount(null);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Provider Selection */}
          {isProviderAccount ? (
            <div className="space-y-2">
              <Label>Provider</Label>
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted border">
                <Printer className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Your Appointments Only</p>
                  <p className="text-xs text-muted-foreground">{currentProviderName}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Provider Filter</Label>
              <RadioGroup
                value={selectedProvider}
                onValueChange={(value) => {
                  setSelectedProvider(value);
                  setPreviewCount(null);
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    All Providers
                  </Label>
                </div>
                {providers.map((provider) => (
                  <div key={provider.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={provider.id} id={provider.id} />
                    <Label htmlFor={provider.id} className="font-normal cursor-pointer">
                      {getProviderDisplayName(provider)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Preview Section */}
          <div className="p-4 rounded-md bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Preview</p>
                {previewCount !== null ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {previewCount} appointment{previewCount !== 1 ? 's' : ''} scheduled
                    {selectedDate && ` for ${format(selectedDate, 'MMM d, yyyy')}`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Click preview to see appointment count
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreview}
                disabled={isLoadingPreview || !selectedDate}
              >
                {isLoadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Preview"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGeneratePDF}
            disabled={!selectedDate || isGenerating}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
