import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, DollarSign, Clock, HardDrive } from "lucide-react";

interface PricingConfig {
  id: string;
  rate_per_minute: number;
  included_minutes_per_month: number;
  storage_rate_per_gb_per_month: number;
  effective_from: string;
  notes: string | null;
  created_at: string;
}

export function VideoUsagePricingSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPricing, setCurrentPricing] = useState<PricingConfig | null>(null);
  const [ratePerMinute, setRatePerMinute] = useState("0.10");
  const [includedMinutes, setIncludedMinutes] = useState("100");
  const [storageRate, setStorageRate] = useState("0.50");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadCurrentPricing();
  }, []);

  const loadCurrentPricing = async () => {
    try {
      const { data, error } = await supabase
        .from("video_usage_pricing")
        .select("*")
        .order("effective_from", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      if (data) {
        setCurrentPricing(data);
        setRatePerMinute(data.rate_per_minute.toString());
        setIncludedMinutes(data.included_minutes_per_month.toString());
        setStorageRate(data.storage_rate_per_gb_per_month.toString());
        setNotes(data.notes || "");
      }
    } catch (error: any) {
      console.error("Error loading pricing:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("video_usage_pricing")
        .insert({
          rate_per_minute: parseFloat(ratePerMinute),
          included_minutes_per_month: parseInt(includedMinutes),
          storage_rate_per_gb_per_month: parseFloat(storageRate),
          notes: notes || null,
          effective_from: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Pricing updated",
        description: "New pricing configuration has been saved.",
      });

      await loadCurrentPricing();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Video Usage Pricing Configuration
        </CardTitle>
        <CardDescription>
          Set billing rates for video minutes and recording storage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="rate-per-minute" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Rate per Minute ($)
            </Label>
            <Input
              id="rate-per-minute"
              type="number"
              step="0.01"
              min="0"
              value={ratePerMinute}
              onChange={(e) => setRatePerMinute(e.target.value)}
              placeholder="0.10"
            />
            <p className="text-xs text-muted-foreground">
              Cost charged per video minute
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="included-minutes" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Included Minutes/Month
            </Label>
            <Input
              id="included-minutes"
              type="number"
              min="0"
              value={includedMinutes}
              onChange={(e) => setIncludedMinutes(e.target.value)}
              placeholder="100"
            />
            <p className="text-xs text-muted-foreground">
              Free minutes included per practice
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storage-rate" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage Rate per GB/Month ($)
            </Label>
            <Input
              id="storage-rate"
              type="number"
              step="0.01"
              min="0"
              value={storageRate}
              onChange={(e) => setStorageRate(e.target.value)}
              placeholder="0.50"
            />
            <p className="text-xs text-muted-foreground">
              Cost per GB of recording storage
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this pricing configuration"
            rows={3}
          />
        </div>

        {currentPricing && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="text-sm font-medium mb-2">Current Active Pricing</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate per Minute:</span>
                <span className="font-medium">${currentPricing.rate_per_minute}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Included Minutes:</span>
                <span className="font-medium">{currentPricing.included_minutes_per_month} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage Rate:</span>
                <span className="font-medium">${currentPricing.storage_rate_per_gb_per_month}/GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective Since:</span>
                <span className="font-medium">
                  {new Date(currentPricing.effective_from).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save New Pricing Configuration
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
