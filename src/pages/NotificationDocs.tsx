import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, AlertCircle, Code, CheckCircle } from "lucide-react";

export default function NotificationDocs() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-8 w-8" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Notification System Documentation</h1>
          <p className="text-sm text-muted-foreground">
            Complete guide to the Vitaluxe multi-channel notification system
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Event Types</TabsTrigger>
          <TabsTrigger value="variables">Template Variables</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 prose prose-sm max-w-none">
              <p>
                The Vitaluxe notification system delivers messages across three channels:
              </p>
              <ul className="space-y-2">
                <li>
                  <strong>In-App Notifications:</strong> Real-time browser notifications visible in the
                  notification bell
                </li>
                <li>
                  <strong>Email:</strong> Branded HTML emails sent via Postmark
                </li>
                <li>
                  <strong>SMS:</strong> Text messages delivered via Twilio toll-free messaging service
                </li>
              </ul>

              <h3 className="text-lg font-semibold mt-6">How It Works</h3>
              <ol className="space-y-2">
                <li>System creates notification record in database</li>
                <li>Edge function <code>send-notification</code> retrieves notification details</li>
                <li>User preferences are checked for each channel</li>
                <li>Templates are loaded (practice-specific or default)</li>
                <li>Variables are replaced with actual data</li>
                <li>Messages are dispatched via Postmark and/or Twilio</li>
                <li>Delivery status is tracked in <code>notification_logs</code></li>
              </ol>

              <div className="bg-muted p-4 rounded-lg mt-6">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Key Features
                </h4>
                <ul className="mt-2 space-y-1">
                  <li>✅ Per-user opt-in/opt-out preferences</li>
                  <li>✅ Practice-specific template customization</li>
                  <li>✅ Automatic appointment reminders (scheduled daily)</li>
                  <li>✅ Real-time delivery status tracking</li>
                  <li>✅ SMS STOP/HELP command handling</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Event Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    event: "appointment_confirmed",
                    label: "Appointment Confirmed",
                    trigger: "When a new appointment is booked",
                    channels: ["email", "sms", "in_app"],
                  },
                  {
                    event: "appointment_reminder",
                    label: "Appointment Reminder",
                    trigger: "24 hours before scheduled appointment (automated)",
                    channels: ["email", "sms"],
                  },
                  {
                    event: "appointment_cancelled",
                    label: "Appointment Cancelled",
                    trigger: "When an appointment is cancelled",
                    channels: ["email", "sms", "in_app"],
                  },
                  {
                    event: "appointment_rescheduled",
                    label: "Appointment Rescheduled",
                    trigger: "When an appointment date/time is changed",
                    channels: ["email", "sms", "in_app"],
                  },
                  {
                    event: "patient_message_received",
                    label: "Patient Message Received",
                    trigger: "When a patient sends a message to their provider",
                    channels: ["in_app"],
                  },
                ].map((item) => (
                  <div key={item.event} className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{item.label}</h4>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{item.event}</code>
                        <p className="text-sm text-muted-foreground mt-1">{item.trigger}</p>
                      </div>
                      <div className="flex gap-1">
                        {item.channels.map((ch) => (
                          <Badge key={ch} variant="outline" className="text-xs">
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variables" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Template Variables Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Use these variables in your notification templates. They will be automatically replaced with
                actual data.
              </p>

              <div className="space-y-4">
                {[
                  { var: "{{first_name}}", desc: "Patient's first name", example: "John" },
                  { var: "{{last_name}}", desc: "Patient's last name", example: "Doe" },
                  {
                    var: "{{date_time}}",
                    desc: "Appointment date and time (formatted)",
                    example: "Dec 25, 2024 at 2:30 PM",
                  },
                  { var: "{{time}}", desc: "Appointment time only", example: "2:30 PM" },
                  { var: "{{provider_name}}", desc: "Provider's full name", example: "Dr. Sarah Smith" },
                  { var: "{{practice_name}}", desc: "Practice name", example: "Vitaluxe Services" },
                  {
                    var: "{{practice_address}}",
                    desc: "Practice full address",
                    example: "123 Main St, Suite 100",
                  },
                ].map((item) => (
                  <div key={item.var} className="flex items-start gap-4 p-3 bg-muted rounded-lg">
                    <code className="bg-background px-3 py-1 rounded font-mono text-sm whitespace-nowrap">
                      {item.var}
                    </code>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.desc}</p>
                      <p className="text-xs text-muted-foreground mt-1">Example: {item.example}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">💡 Pro Tip</h4>
                <p className="text-sm text-muted-foreground">
                  When editing templates, click on variable badges to insert them at your cursor position.
                  Variables are case-sensitive and must match exactly (including the curly braces).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                SMS Compliance & Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <h4 className="font-semibold">TCPA Compliance</h4>
                <p className="text-sm mt-2">
                  The Telephone Consumer Protection Act (TCPA) requires explicit consent before sending SMS
                  messages. Vitaluxe handles this through:
                </p>
                <ul className="text-sm mt-2 space-y-1 ml-4">
                  <li>• Opt-in during registration</li>
                  <li>• Automatic "Reply STOP to opt out" footer on all SMS</li>
                  <li>• STOP/HELP command processing</li>
                  <li>• Per-event preference management</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">SMS Best Practices</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <strong>Keep it short:</strong> SMS messages should be under 160 characters when possible
                  </li>
                  <li>
                    <strong>Include practice name:</strong> Help patients identify the sender immediately
                  </li>
                  <li>
                    <strong>Be direct:</strong> Lead with the most important information
                  </li>
                  <li>
                    <strong>Timing matters:</strong> Avoid sending between 9 PM - 8 AM local time
                  </li>
                  <li>
                    <strong>Test thoroughly:</strong> Use the "Send Test" feature before rolling out new
                    templates
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Automatic Opt-Out Handling</h4>
                <p className="text-sm text-muted-foreground">
                  When a patient replies "STOP" to any SMS, they are automatically:
                </p>
                <ol className="text-sm mt-2 space-y-1 ml-4 list-decimal">
                  <li>Unsubscribed from all SMS notifications</li>
                  <li>Sent a confirmation message</li>
                  <li>Preference saved in <code>notification_preferences</code> table</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshooting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-2">Notifications Not Sending</h4>
                <ol className="text-sm space-y-2 ml-4 list-decimal">
                  <li>Check user's notification preferences in their profile settings</li>
                  <li>
                    Verify secrets are configured: <code>TWILIO_MESSAGING_SERVICE_SID</code>,{" "}
                    <code>POSTMARK_API_KEY</code>
                  </li>
                  <li>
                    Review <strong>Notification Logs</strong> page for error messages
                  </li>
                  <li>Check edge function logs in Cloud dashboard</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-2">SMS Delivery Issues</h4>
                <ul className="text-sm space-y-2 ml-4 list-disc">
                  <li>Verify phone number format (must include country code)</li>
                  <li>Check Twilio account balance and service status</li>
                  <li>
                    Confirm toll-free number is approved for{" "}
                    <a
                      href="https://www.twilio.com/docs/messaging/services#messaging-use-case"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      A2P messaging
                    </a>
                  </li>
                  <li>Review Twilio delivery logs for carrier-level errors</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Email Delivery Issues</h4>
                <ul className="text-sm space-y-2 ml-4 list-disc">
                  <li>Check spam folder</li>
                  <li>Verify Postmark sender signature is verified</li>
                  <li>Review Postmark activity stream for bounce/spam reports</li>
                  <li>Ensure <code>POSTMARK_FROM_EMAIL</code> matches verified domain</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Template Variables Not Replacing</h4>
                <ul className="text-sm space-y-2 ml-4 list-disc">
                  <li>Check variable spelling (case-sensitive)</li>
                  <li>Ensure double curly braces: <code>{'{{'}variable{'}}'}</code></li>
                  <li>Verify metadata contains the required key</li>
                  <li>Use "Send Test" to preview with sample data</li>
                </ul>
              </div>

              <div className="p-4 bg-muted rounded-lg mt-6">
                <h4 className="font-semibold">Need More Help?</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Check the notification logs page for detailed error messages and delivery status. Edge
                  function logs are available in the Cloud dashboard under Functions.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
