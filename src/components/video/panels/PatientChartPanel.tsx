import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface PatientChartPanelProps {
  patientId: string;
  chart?: any;
  isCollapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}

export const PatientChartPanel = ({
  patientId,
  chart,
  isCollapsed = false,
  onToggle,
  className,
}: PatientChartPanelProps) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (isCollapsed) {
    return (
      <div className={cn('relative h-full border-l border-border', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="absolute top-4 -left-10 rotate-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex flex-col items-center justify-center h-full p-2 gap-2">
          <FileText className="w-6 h-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground writing-mode-vertical-rl transform rotate-180">
            Patient Chart
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Patient Chart</h2>
        </div>
        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="overview" className="rounded-none">Overview</TabsTrigger>
          <TabsTrigger value="vitals" className="rounded-none">Vitals</TabsTrigger>
          <TabsTrigger value="meds" className="rounded-none">Meds</TabsTrigger>
          <TabsTrigger value="allergies" className="rounded-none">Allergies</TabsTrigger>
          <TabsTrigger value="notes" className="rounded-none">Notes</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Overview Tab */}
          <TabsContent value="overview" className="p-4 space-y-4 m-0">
            {!chart ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Loading patient chart...</p>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Patient Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="text-foreground font-medium">
                        {chart.first_name} {chart.last_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DOB:</span>
                      <span className="text-foreground">{chart.birth_date || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gender:</span>
                      <span className="text-foreground capitalize">{chart.gender || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Active Conditions</h3>
                  {chart.conditions && chart.conditions.length > 0 ? (
                    <div className="space-y-2">
                      {chart.conditions.slice(0, 3).map((condition: any, index: number) => (
                        <div key={index} className="p-2 rounded bg-muted/50 text-sm">
                          {condition.condition_name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active conditions</p>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Current Medications</h3>
                  {chart.medications && chart.medications.length > 0 ? (
                    <div className="space-y-2">
                      {chart.medications.slice(0, 3).map((med: any, index: number) => (
                        <div key={index} className="p-2 rounded bg-muted/50">
                          <p className="text-sm font-medium">{med.medication_name}</p>
                          <p className="text-xs text-muted-foreground">{med.dosage}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No current medications</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Vitals Tab */}
          <TabsContent value="vitals" className="p-4 space-y-4 m-0">
            <div className="text-sm text-muted-foreground">
              <p>Vital signs data will appear here</p>
            </div>
          </TabsContent>

          {/* Medications Tab */}
          <TabsContent value="meds" className="p-4 space-y-4 m-0">
            <div className="text-sm text-muted-foreground">
              <p>Medications list will appear here</p>
            </div>
          </TabsContent>

          {/* Allergies Tab */}
          <TabsContent value="allergies" className="p-4 space-y-4 m-0">
            <div className="text-sm text-muted-foreground">
              <p>Allergies information will appear here</p>
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="p-4 space-y-4 m-0">
            <div className="text-sm text-muted-foreground">
              <p>Provider notes will appear here</p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};
