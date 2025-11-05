import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Terminal, Info, CheckCircle2, XCircle } from "lucide-react";

interface ConsoleLog {
  id: string;
  timestamp: number;
  type: 'log' | 'error' | 'warn';
  message: string;
  data?: any;
}

export default function AppointmentDebugLogs() {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);

  useEffect(() => {
    // Intercept console logs for appointment-related messages
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const createLogEntry = (type: 'log' | 'error' | 'warn', args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      if (message.includes('[validate-appointment-time]') || 
          message.includes('[find-soonest-availability]')) {
        const newLog: ConsoleLog = {
          id: Date.now() + Math.random().toString(),
          timestamp: Date.now(),
          type,
          message,
          data: args.find(arg => typeof arg === 'object')
        };
        setLogs(prev => [newLog, ...prev].slice(0, 100)); // Keep last 100 logs
      }
    };

    console.log = function(...args) {
      createLogEntry('log', args);
      originalLog.apply(console, args);
    };

    console.error = function(...args) {
      createLogEntry('error', args);
      originalError.apply(console, args);
    };

    console.warn = function(...args) {
      createLogEntry('warn', args);
      originalWarn.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
  };

  const parseDebugData = (message: string) => {
    try {
      const jsonMatch = message.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      return null;
    }
    return null;
  };

  const getLogIcon = (message: string) => {
    if (message.includes('APPROVED')) return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (message.includes('REJECTED')) return <XCircle className="h-4 w-4 text-red-600" />;
    if (message.includes('SKIPPED')) return <XCircle className="h-4 w-4 text-yellow-600" />;
    if (message.includes('BLOCKED')) return <XCircle className="h-4 w-4 text-orange-600" />;
    if (message.includes('CONFLICT')) return <XCircle className="h-4 w-4 text-red-600" />;
    return <Info className="h-4 w-4 text-blue-600" />;
  };

  const renderLogEntry = (log: ConsoleLog) => {
    const debugData = parseDebugData(log.message);
    const isValidation = log.message.includes('[validate-appointment-time]');
    const isAvailability = log.message.includes('[find-soonest-availability]');

    return (
      <div key={log.id} className="border-b border-border pb-4 mb-4 last:border-0">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {getLogIcon(log.message)}
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-mono">
              {formatTimestamp(log.timestamp)}
            </span>
          </div>
          <div className="flex gap-2">
            {isValidation && <Badge variant="outline">Validation</Badge>}
            {isAvailability && <Badge variant="outline">Availability</Badge>}
            <Badge variant={log.type === 'error' ? 'destructive' : 'secondary'}>
              {log.type}
            </Badge>
          </div>
        </div>

        {debugData ? (
          <div className="space-y-2 mt-2">
            {debugData.appointmentDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">Date:</span>
                <span>{debugData.appointmentDate} {debugData.appointmentTime}</span>
                {debugData.duration && <span className="text-muted-foreground">({debugData.duration}min)</span>}
              </div>
            )}
            {debugData.practiceTimezone && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">Timezone:</span>
                <span className="font-mono">{debugData.practiceTimezone}</span>
              </div>
            )}
            {debugData.practiceHours && (
              <div className="text-sm">
                <span className="font-medium">Practice Hours:</span>
                <span className="ml-2 font-mono">
                  {debugData.practiceHours.start} - {debugData.practiceHours.end}
                  {debugData.practiceHours.isClosed && " (CLOSED)"}
                </span>
              </div>
            )}
            {debugData.dayName && (
              <div className="text-sm">
                <span className="font-medium">Day:</span>
                <span className="ml-2">{debugData.dayName} (Day {debugData.dayOfWeek})</span>
              </div>
            )}
            {(debugData.nowInPractice || debugData.todayYMD) && (
              <div className="text-sm">
                <span className="font-medium">Current Time in Practice TZ:</span>
                <span className="ml-2 font-mono">
                  {debugData.todayYMD} {debugData.nowMinutes ? `(${debugData.nowMinutes} minutes)` : ''}
                </span>
              </div>
            )}
            {(debugData.startIso || debugData.endIso) && (
              <div className="text-sm">
                <span className="font-medium">UTC Times:</span>
                <div className="ml-2 font-mono text-xs text-muted-foreground">
                  Start: {debugData.startIso}<br/>
                  End: {debugData.endIso}
                </div>
              </div>
            )}
            <details className="text-xs mt-2">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View full debug data
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded overflow-auto max-h-96 text-xs">
                {JSON.stringify(debugData, null, 2)}
              </pre>
            </details>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm font-mono bg-muted p-3 rounded break-all whitespace-pre-wrap">
              {log.message}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Appointment Debug Logs</h1>
        <p className="text-muted-foreground">
          Real-time debugging for timezone calculations and availability checks
        </p>
      </div>

      <Alert className="mb-6">
        <Terminal className="h-4 w-4" />
        <AlertDescription className="ml-2">
          <strong>How to use:</strong> This page captures console logs from appointment validation and availability checks in real-time.
          Try booking an appointment or checking availability to see detailed timezone calculations and validation steps.
          All logs are also available in your browser's DevTools console.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Debug Console</CardTitle>
              <CardDescription>
                Showing last {logs.length} appointment-related log{logs.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogs([])}
            >
              Clear Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[700px] overflow-y-auto pr-2">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No logs captured yet</p>
                <p className="text-sm text-muted-foreground">
                  Try validating an appointment time or searching for availability to see debug logs appear here.
                </p>
              </div>
            ) : (
              logs.map(renderLogEntry)
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Debug Information Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Validation Logs</h3>
            <p className="text-sm text-muted-foreground">
              Shows timezone conversions, practice hours, and why a time slot was approved or rejected.
              Look for "APPROVED", "REJECTED", "Before opening", "After closing", "Blocked", or "Already booked" messages.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Availability Logs</h3>
            <p className="text-sm text-muted-foreground">
              Shows the search process for finding the next available slot, including which days and times were checked,
              why slots were skipped (closed, blocked, conflict), and the final recommendation.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Timezone Details</h3>
            <p className="text-sm text-muted-foreground">
              Each log shows the practice timezone, current time in that timezone, and UTC ISO strings used for database queries.
              This helps verify that time zone conversions are correct across all operations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
