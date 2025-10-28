import { TriageForm } from "@/components/patient/TriageForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle } from "lucide-react";

export default function PatientTriage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Symptom Checker</h1>
        <p className="text-muted-foreground">Get AI-powered symptom analysis and guidance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TriageForm />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p>Describe your symptoms in detail</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p>Our AI analyzes your information</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p>Receive urgency assessment and recommendations</p>
              </div>
              <div className="flex gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p>Your provider reviews your submission</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-orange-900 dark:text-orange-100">
                <AlertTriangle className="h-4 w-4" />
                Important Notice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-orange-900 dark:text-orange-100">
              <p>This is NOT emergency medical advice.</p>
              <p className="font-semibold">If you are experiencing a medical emergency, call 911 immediately.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">When to Seek Immediate Care</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Chest pain or pressure</li>
                <li>Difficulty breathing</li>
                <li>Sudden severe headache</li>
                <li>Loss of consciousness</li>
                <li>Severe bleeding</li>
                <li>Signs of stroke</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
