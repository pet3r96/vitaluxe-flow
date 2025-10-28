import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function TriageForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData(e.currentTarget);
      const { data, error } = await supabase.functions.invoke("process-triage-submission", {
        body: {
          chiefComplaint: formData.get("chief_complaint"),
          symptoms: formData.get("symptoms"),
          symptomOnset: formData.get("symptom_onset"),
          symptomSeverity: formData.get("symptom_severity"),
          additionalInfo: formData.get("additional_info"),
        },
      });

      if (error) throw error;

      setResult(data);
      toast.success("Symptom analysis complete");
    } catch (error: any) {
      toast.error(error.message || "Failed to process triage");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tell Us Your Symptoms</CardTitle>
        <CardDescription>
          Provide detailed information about what you're experiencing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chief_complaint">Main Concern *</Label>
            <Input
              id="chief_complaint"
              name="chief_complaint"
              placeholder="e.g., Headache, Fever, Cough"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="symptoms">Detailed Symptoms *</Label>
            <Textarea
              id="symptoms"
              name="symptoms"
              placeholder="Describe your symptoms in detail..."
              rows={4}
              required
              disabled={loading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="symptom_onset">When did it start? *</Label>
              <Select name="symptom_onset" required disabled={loading}>
                <SelectTrigger id="symptom_onset">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="less_than_hour">Less than an hour ago</SelectItem>
                  <SelectItem value="today">Earlier today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="few_days">A few days ago</SelectItem>
                  <SelectItem value="week">About a week ago</SelectItem>
                  <SelectItem value="longer">More than a week ago</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="symptom_severity">Severity *</Label>
              <Select name="symptom_severity" required disabled={loading}>
                <SelectTrigger id="symptom_severity">
                  <SelectValue placeholder="Rate severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild - Barely noticeable</SelectItem>
                  <SelectItem value="moderate">Moderate - Noticeable discomfort</SelectItem>
                  <SelectItem value="severe">Severe - Significant pain/discomfort</SelectItem>
                  <SelectItem value="unbearable">Unbearable - Extreme pain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional_info">Additional Information</Label>
            <Textarea
              id="additional_info"
              name="additional_info"
              placeholder="Any other relevant information (medications, allergies, etc.)"
              rows={3}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Analyzing Symptoms..." : "Submit for AI Analysis"}
          </Button>
        </form>

        {result && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Analysis Complete</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Urgency Level:</span>
                <Badge
                  variant={
                    result.urgencyLevel === "emergency"
                      ? "destructive"
                      : result.urgencyLevel === "urgent"
                      ? "default"
                      : "secondary"
                  }
                >
                  {result.urgencyLevel}
                </Badge>
              </div>

              {result.aiRecommendation && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Recommendation:</p>
                  <p className="text-sm">{result.aiRecommendation}</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Your submission has been sent to your provider for review. They will respond shortly.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
