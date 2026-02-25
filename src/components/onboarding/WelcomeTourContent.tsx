import {
  ShoppingCart, CalendarCheck, MessageSquare, FileHeart,
  BarChart3, BellRing, Users, Headphones, Sparkles,
  UserPlus, ClipboardList, LayoutDashboard, Package,
  ClipboardCheck, Shield, FileText, TrendingUp, Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const features = [
  { icon: ShoppingCart, label: "Full Product Catalog & Ordering capabilities" },
  { icon: CalendarCheck, label: "Patient Appointment Booking — Automated scheduling with SMS reminders" },
  { icon: MessageSquare, label: "Secure Patient Messaging — HIPAA-compliant two-way communication" },
  { icon: FileHeart, label: "Digital EMR & Charting — Complete patient medical vault system" },
  { icon: BarChart3, label: "Practice Analytics Dashboard — Revenue tracking and patient insights" },
  { icon: BellRing, label: "Automated SMS Reminders — Reduce no-shows with smart notifications" },
  { icon: Users, label: "Add Staff Members and your providers" },
  { icon: Headphones, label: "Priority support" },
  { icon: Sparkles, label: "Much more…" },
];

const pages = [
  { icon: LayoutDashboard, name: "Dashboard", desc: "Overview of your practice at a glance" },
  { icon: Package, name: "Products", desc: "Browse and order from the full catalog" },
  { icon: ClipboardCheck, name: "Orders", desc: "Track and manage all orders" },
  { icon: ClipboardList, name: "Patients", desc: "Manage patient records and medical vaults" },
  { icon: Shield, name: "Providers / Staff", desc: "Add licensed providers and staff members" },
  { icon: MessageSquare, name: "Messages", desc: "HIPAA-compliant communication" },
  { icon: CalendarCheck, name: "Calendar", desc: "Appointment scheduling with SMS reminders" },
  { icon: FileText, name: "Documents", desc: "Document center for your practice" },
  { icon: TrendingUp, name: "Reports", desc: "Analytics and revenue insights" },
];

export function StepWelcome() {
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <Sparkles className="h-10 w-10 mx-auto text-primary mb-2" />
        <h2 className="text-2xl font-bold gold-text-gradient">Welcome to VitaLuxe!</h2>
        <p className="text-muted-foreground text-sm mt-1">Here's everything included in your portal:</p>
      </div>
      <div className="space-y-2.5">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
            <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-sm">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepAddProvider({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 text-center">
      <UserPlus className="h-12 w-12 mx-auto text-primary" />
      <h2 className="text-2xl font-bold">Add a Licensed Provider</h2>
      <p className="text-muted-foreground">
        To start placing orders, you'll need at least one licensed provider on your account.
        Head to <strong>User Management → Providers</strong> to add one.
      </p>
      <Button
        onClick={() => { onClose(); navigate("/providers"); }}
        variant="outline"
        className="gap-2"
      >
        <UserPlus className="h-4 w-4" /> Go to Providers
      </Button>
    </div>
  );
}

export function StepAddPatient({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 text-center">
      <ClipboardList className="h-12 w-12 mx-auto text-primary" />
      <h2 className="text-2xl font-bold">Add Your First Patient</h2>
      <p className="text-muted-foreground">
        Before placing an order, you'll need to add a patient record.
        Go to the <strong>Patients</strong> page to get started.
      </p>
      <Button
        onClick={() => { onClose(); navigate("/patients"); }}
        variant="outline"
        className="gap-2"
      >
        <ClipboardList className="h-4 w-4" /> Go to Patients
      </Button>
    </div>
  );
}

export function StepPortalPages() {
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <LayoutDashboard className="h-10 w-10 mx-auto text-primary mb-2" />
        <h2 className="text-2xl font-bold">Your Portal Pages</h2>
        <p className="text-muted-foreground text-sm mt-1">A quick look at what each page offers:</p>
      </div>
      <div className="grid gap-2">
        {pages.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
            <p.icon className="h-5 w-5 text-primary shrink-0" />
            <div>
              <span className="font-medium text-sm">{p.name}</span>
              <span className="text-muted-foreground text-xs ml-2">— {p.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepComplete() {
  return (
    <div className="space-y-4 text-center py-6">
      <Rocket className="h-14 w-14 mx-auto text-primary" />
      <h2 className="text-2xl font-bold gold-text-gradient">You're All Set!</h2>
      <p className="text-muted-foreground">
        You can replay this tutorial anytime from your <strong>Profile</strong> page.
      </p>
    </div>
  );
}
