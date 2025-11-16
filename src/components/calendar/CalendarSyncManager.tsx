import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CalendarSyncManagerProps {
  practiceId: string;
  userId: string;
}

export function CalendarSyncManager({ practiceId, userId }: CalendarSyncManagerProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showInstructions, setShowInstructions] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch existing sync token
  const { data: syncToken, isLoading } = useQuery({
    queryKey: ["calendar-sync-token", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_sync_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  // Generate or regenerate token
  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-calendar-sync-token");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-token", userId] });
      toast.success("Calendar sync URL generated successfully");
    },
    onError: (error) => {
      console.error("Error generating sync token:", error);
      toast.error("Failed to generate sync URL");
    },
  });

  // Toggle sync status
  const toggleSyncMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from("calendar_sync_tokens")
        .update({ is_active: isActive })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-token", userId] });
      toast.success(syncToken?.is_active ? "Calendar sync disabled" : "Calendar sync enabled");
    },
    onError: (error) => {
      console.error("Error toggling sync:", error);
      toast.error("Failed to update sync status");
    },
  });

  // Export calendar
  const exportCalendarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("export-calendar-ics", {
        body: { startDate, endDate },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Create blob and download
      const blob = new Blob([data], { type: "text/calendar" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vitaluxe-calendar.ics";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Calendar exported successfully");
    },
    onError: (error) => {
      console.error("Error exporting calendar:", error);
      toast.error("Failed to export calendar");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL copied to clipboard");
  };

  const feedUrl = syncToken?.token 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${syncToken.token}`
    : "";

  if (isLoading) {
    return <div className="text-center py-4">Loading sync settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Sync */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="sync-enabled">Enable Calendar Sync</Label>
          <p className="text-sm text-muted-foreground">
            Allow this calendar to be synced with external calendar apps
          </p>
        </div>
        <Switch
          id="sync-enabled"
          checked={syncToken?.is_active || false}
          onCheckedChange={(checked) => {
            if (!syncToken) {
              generateTokenMutation.mutate();
            } else {
              toggleSyncMutation.mutate(checked);
            }
          }}
          disabled={toggleSyncMutation.isPending}
        />
      </div>

      {/* Sync URL Section */}
      {syncToken?.is_active && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Calendar Sync URL</Label>
            <div className="flex gap-2">
              <Input
                value={feedUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(feedUrl)}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => generateTokenMutation.mutate()}
                disabled={generateTokenMutation.isPending}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <Alert>
              <AlertDescription>
                ⚠️ Keep this URL private - anyone with it can view your appointments
              </AlertDescription>
            </Alert>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label>Subscribe in Your Calendar App</Label>
            
            <Collapsible
              open={showInstructions === "google"}
              onOpenChange={() => setShowInstructions(showInstructions === "google" ? null : "google")}
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Google Calendar
                  {showInstructions === "google" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/50">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Open Google Calendar</li>
                  <li>Click the "+" next to "Other calendars"</li>
                  <li>Select "From URL"</li>
                  <li>Paste the sync URL above</li>
                  <li>Click "Add calendar"</li>
                </ol>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible
              open={showInstructions === "apple"}
              onOpenChange={() => setShowInstructions(showInstructions === "apple" ? null : "apple")}
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Apple Calendar
                  {showInstructions === "apple" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/50">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Open Calendar app</li>
                  <li>Go to File → New Calendar Subscription</li>
                  <li>Paste the sync URL above</li>
                  <li>Click Subscribe</li>
                  <li>Configure refresh frequency and click OK</li>
                </ol>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible
              open={showInstructions === "outlook"}
              onOpenChange={() => setShowInstructions(showInstructions === "outlook" ? null : "outlook")}
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  Outlook Calendar
                  {showInstructions === "outlook" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-4 border rounded-md bg-muted/50">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Open Outlook Calendar</li>
                  <li>Click "Add calendar" → "Subscribe from web"</li>
                  <li>Paste the sync URL above</li>
                  <li>Name your calendar and click "Import"</li>
                </ol>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="space-y-4 pt-6 border-t">
        <Label>One-Time Export</Label>
        <p className="text-sm text-muted-foreground">
          Download appointments as a .ics file to import into any calendar app
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button
          onClick={() => exportCalendarMutation.mutate()}
          disabled={exportCalendarMutation.isPending}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Export as .ics File
        </Button>
      </div>
    </div>
  );
}
