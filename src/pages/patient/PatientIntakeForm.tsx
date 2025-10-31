import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";

const intakeSchema = z.object({
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender_at_birth: z.string().min(1, "Gender is required"),
  phone: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 10, "Phone must be exactly 10 digits"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(5, "Zip code is required"),
  emergency_contact_name: z.string().min(1, "Emergency contact name is required"),
  emergency_contact_relationship: z.string().min(1, "Relationship is required"),
  emergency_contact_phone: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 10, "Phone must be exactly 10 digits"),
  emergency_contact_email: z.string().email().optional().or(z.literal("")),
  height_feet: z.string().optional(),
  height_inches: z.string().optional(),
  weight: z.string().optional(),
  blood_type: z.string().optional(),
  pharmacy_name: z.string().min(1, "Pharmacy name is required"),
  pharmacy_address: z.string().min(1, "Pharmacy address is required"),
  pharmacy_city: z.string().min(1, "Pharmacy city is required"),
  pharmacy_state: z.string().min(1, "Pharmacy state is required"),
  pharmacy_zip: z.string().min(5, "Pharmacy zip is required"),
  pharmacy_phone: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 10, "Phone must be exactly 10 digits"),
});

type IntakeFormData = z.infer<typeof intakeSchema>;

interface MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
}

interface AllergyEntry {
  name: string;
  reaction: string;
  severity: string;
}

interface ConditionEntry {
  name: string;
  diagnosed_date: string;
  status: string;
}

interface SurgeryEntry {
  type: string;
  date: string;
  notes: string;
}

export default function PatientIntakeForm() {
  const navigate = useNavigate();
  const { effectiveUserId } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [allergies, setAllergies] = useState<AllergyEntry[]>([]);
  const [conditions, setConditions] = useState<ConditionEntry[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryEntry[]>([]);

  // Fetch existing patient account data
  const { data: patientAccount, isLoading } = useQuery({
    queryKey: ['patient-account', effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      date_of_birth: "",
      gender_at_birth: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
      emergency_contact_email: "",
      height_feet: "",
      height_inches: "",
      weight: "",
      blood_type: "",
      pharmacy_name: "",
      pharmacy_address: "",
      pharmacy_city: "",
      pharmacy_state: "",
      pharmacy_zip: "",
      pharmacy_phone: "",
    },
  });

  // Pre-fill form with existing data
  useEffect(() => {
    if (patientAccount) {
      form.reset({
        date_of_birth: patientAccount.date_of_birth || "",
        gender_at_birth: patientAccount.gender_at_birth || "",
        phone: patientAccount.phone || "",
        address: patientAccount.address || "",
        city: patientAccount.city || "",
        state: patientAccount.state || "",
        zip_code: patientAccount.zip_code || "",
        emergency_contact_name: patientAccount.emergency_contact_name || "",
        emergency_contact_relationship: "",
        emergency_contact_phone: patientAccount.emergency_contact_phone || "",
        emergency_contact_email: "",
        height_feet: "",
        height_inches: "",
        weight: "",
        blood_type: "",
        pharmacy_name: "",
        pharmacy_address: "",
        pharmacy_city: "",
        pharmacy_state: "",
        pharmacy_zip: "",
        pharmacy_phone: "",
      });
    }
  }, [patientAccount, form]);

  const handleAddressChange = (value: AddressValue) => {
    form.setValue("address", value.street || "");
    form.setValue("city", value.city || "");
    form.setValue("state", value.state || "");
    form.setValue("zip_code", value.zip || "");
  };

  const handlePharmacyAddressChange = (value: AddressValue) => {
    form.setValue("pharmacy_address", value.street || "");
    form.setValue("pharmacy_city", value.city || "");
    form.setValue("pharmacy_state", value.state || "");
    form.setValue("pharmacy_zip", value.zip || "");
  };

  const onSubmit = async (data: IntakeFormData) => {
    if (!patientAccount?.id) {
      toast.error("Patient account not found");
      return;
    }

    setSubmitting(true);
    try {
      // Update patient_accounts
      const { error: accountError } = await supabase
        .from('patient_accounts')
        .update({
          date_of_birth: data.date_of_birth,
          gender_at_birth: data.gender_at_birth,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          intake_completed_at: new Date().toISOString(),
        })
        .eq('id', patientAccount.id);

      if (accountError) throw accountError;

      // Insert vitals if provided
      if (data.height_feet || data.weight) {
        const heightInches = (parseInt(data.height_feet || "0") * 12) + parseInt(data.height_inches || "0");
        await supabase.from('patient_vitals').upsert({
          patient_account_id: patientAccount.id,
          height: heightInches > 0 ? heightInches : null,
          weight: data.weight ? parseFloat(data.weight) : null,
          date_recorded: new Date().toISOString(),
        });
      }

      // Update medical vault with blood type
      if (data.blood_type) {
        // Check if vault record exists
        const { data: existingVault } = await supabase
          .from('patient_medical_vault')
          .select('id')
          .eq('patient_id', patientAccount.id)
          .maybeSingle();

        if (existingVault) {
          // Update existing record
          await supabase
            .from('patient_medical_vault')
            .update({ blood_type: data.blood_type })
            .eq('id', existingVault.id);
        } else {
          // Insert new record - use type assertion due to generated types
          await supabase
            .from('patient_medical_vault')
            .insert({
              patient_id: patientAccount.id,
              blood_type: data.blood_type,
            } as any);
        }
      }

      // Insert medications
      if (medications.length > 0) {
        const medEntries = medications.map(med => ({
          patient_account_id: patientAccount.id,
          medication_name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          start_date: new Date().toISOString(),
          is_active: true,
        }));
        await supabase.from('patient_medications').insert(medEntries);
      }

      // Insert allergies
      if (allergies.length > 0) {
        const allergyEntries = allergies.map(allergy => ({
          patient_account_id: patientAccount.id,
          allergen_name: allergy.name,
          reaction: allergy.reaction,
          severity: allergy.severity,
        }));
        await supabase.from('patient_allergies').insert(allergyEntries);
      }

      // Insert conditions
      if (conditions.length > 0) {
        const conditionEntries = conditions.map(condition => ({
          patient_account_id: patientAccount.id,
          condition_name: condition.name,
          date_diagnosed: condition.diagnosed_date,
          status: condition.status,
        }));
        await supabase.from('patient_conditions').insert(conditionEntries);
      }

      // Insert surgeries
      if (surgeries.length > 0) {
        const surgeryEntries = surgeries.map(surgery => ({
          patient_account_id: patientAccount.id,
          surgery_type: surgery.type,
          surgery_date: surgery.date,
          notes: surgery.notes,
        }));
        await supabase.from('patient_surgeries').insert(surgeryEntries);
      }

      // Insert or update pharmacy
      const { data: existingPharmacy } = await supabase
        .from('patient_pharmacies')
        .select('id')
        .eq('patient_account_id', patientAccount.id)
        .eq('is_preferred', true)
        .maybeSingle();

      if (existingPharmacy) {
        await supabase
          .from('patient_pharmacies')
          .update({
            pharmacy_name: data.pharmacy_name,
            address: data.pharmacy_address,
            city: data.pharmacy_city,
            state: data.pharmacy_state,
            zip_code: data.pharmacy_zip,
            phone: data.pharmacy_phone,
          })
          .eq('id', existingPharmacy.id);
      } else {
        await supabase.from('patient_pharmacies').insert({
          patient_account_id: patientAccount.id,
          pharmacy_name: data.pharmacy_name,
          address: data.pharmacy_address,
          city: data.pharmacy_city,
          state: data.pharmacy_state,
          zip_code: data.pharmacy_zip,
          phone: data.pharmacy_phone,
          is_preferred: true,
        });
      }

      // Insert or update emergency contact
      const { data: existingContact } = await supabase
        .from('patient_emergency_contacts')
        .select('id')
        .eq('patient_account_id', patientAccount.id)
        .maybeSingle();

      if (existingContact) {
        await supabase
          .from('patient_emergency_contacts')
          .update({
            name: data.emergency_contact_name,
            relationship: data.emergency_contact_relationship,
            phone: data.emergency_contact_phone,
            email: data.emergency_contact_email || null,
          })
          .eq('id', existingContact.id);
      } else {
        await supabase.from('patient_emergency_contacts').insert({
          patient_account_id: patientAccount.id,
          name: data.emergency_contact_name,
          relationship: data.emergency_contact_relationship,
          phone: data.emergency_contact_phone,
          email: data.emergency_contact_email || null,
        });
      }

      toast.success("Intake form completed successfully!");
      navigate('/dashboard');
    } catch (error) {
      console.error('Intake submission error:', error);
      toast.error("Failed to submit intake form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="patient-container max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="patient-section-header">Patient Intake Form</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">Complete your medical information to help us provide better care</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
          {/* Personal Demographics */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Personal Information</CardTitle>
              <CardDescription>Basic demographic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <Input value={patientAccount?.first_name || ""} disabled />
                </FormItem>
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <Input value={patientAccount?.last_name || ""} disabled />
                </FormItem>
              </div>
              
              <FormItem>
                <FormLabel>Email</FormLabel>
                <Input value={patientAccount?.email || ""} disabled />
              </FormItem>

              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender_at_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender at Birth *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Intersex">Intersex</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Address</CardTitle>
              <CardDescription>Your residential address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoogleAddressAutocomplete
                label="Street Address *"
                value={{
                  street: form.watch("address"),
                  city: form.watch("city"),
                  state: form.watch("state"),
                  zip: form.watch("zip_code"),
                  status: "unverified",
                  source: "user_input",
                }}
                onChange={handleAddressChange}
                required
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Emergency Contact</CardTitle>
              <CardDescription>Someone we can contact in case of emergency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergency_contact_relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Sibling">Sibling</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Friend">Friend</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergency_contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergency_contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Vitals */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Vital Information</CardTitle>
              <CardDescription>Basic health measurements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="height_feet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (feet)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="8" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="height_inches"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height (inches)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (lbs)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="blood_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blood Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Medical History - Medications */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Current Medications</CardTitle>
              <CardDescription>List any medications you're currently taking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {medications.map((med, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input
                    placeholder="Medication name"
                    value={med.name}
                    onChange={(e) => {
                      const newMeds = [...medications];
                      newMeds[index].name = e.target.value;
                      setMedications(newMeds);
                    }}
                  />
                  <Input
                    placeholder="Dosage"
                    value={med.dosage}
                    onChange={(e) => {
                      const newMeds = [...medications];
                      newMeds[index].dosage = e.target.value;
                      setMedications(newMeds);
                    }}
                  />
                  <Select
                    value={med.frequency}
                    onValueChange={(value) => {
                      const newMeds = [...medications];
                      newMeds[index].frequency = value;
                      setMedications(newMeds);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Once daily">Once daily</SelectItem>
                      <SelectItem value="Twice daily">Twice daily</SelectItem>
                      <SelectItem value="Three times daily">Three times daily</SelectItem>
                      <SelectItem value="As needed">As needed</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setMedications(medications.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setMedications([...medications, { name: "", dosage: "", frequency: "" }])}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Medication
              </Button>
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Allergies</CardTitle>
              <CardDescription>List any known allergies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {allergies.map((allergy, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input
                    placeholder="Allergen name"
                    value={allergy.name}
                    onChange={(e) => {
                      const newAllergies = [...allergies];
                      newAllergies[index].name = e.target.value;
                      setAllergies(newAllergies);
                    }}
                  />
                  <Input
                    placeholder="Reaction"
                    value={allergy.reaction}
                    onChange={(e) => {
                      const newAllergies = [...allergies];
                      newAllergies[index].reaction = e.target.value;
                      setAllergies(newAllergies);
                    }}
                  />
                  <Select
                    value={allergy.severity}
                    onValueChange={(value) => {
                      const newAllergies = [...allergies];
                      newAllergies[index].severity = value;
                      setAllergies(newAllergies);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mild">Mild</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Severe">Severe</SelectItem>
                      <SelectItem value="Life-threatening">Life-threatening</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAllergies(allergies.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setAllergies([...allergies, { name: "", reaction: "", severity: "" }])}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Allergy
              </Button>
            </CardContent>
          </Card>

          {/* Medical Conditions */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Medical Conditions</CardTitle>
              <CardDescription>List any current or past medical conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conditions.map((condition, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input
                    placeholder="Condition name"
                    value={condition.name}
                    onChange={(e) => {
                      const newConditions = [...conditions];
                      newConditions[index].name = e.target.value;
                      setConditions(newConditions);
                    }}
                  />
                  <Input
                    type="date"
                    placeholder="Diagnosed date"
                    value={condition.diagnosed_date}
                    onChange={(e) => {
                      const newConditions = [...conditions];
                      newConditions[index].diagnosed_date = e.target.value;
                      setConditions(newConditions);
                    }}
                  />
                  <Select
                    value={condition.status}
                    onValueChange={(value) => {
                      const newConditions = [...conditions];
                      newConditions[index].status = value;
                      setConditions(newConditions);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                      <SelectItem value="Managed">Managed</SelectItem>
                      <SelectItem value="Chronic">Chronic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setConditions(conditions.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setConditions([...conditions, { name: "", diagnosed_date: "", status: "" }])}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Condition
              </Button>
            </CardContent>
          </Card>

          {/* Past Surgeries */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Past Surgeries</CardTitle>
              <CardDescription>List any surgical procedures you've had</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {surgeries.map((surgery, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <Input
                      placeholder="Surgery type"
                      value={surgery.type}
                      onChange={(e) => {
                        const newSurgeries = [...surgeries];
                        newSurgeries[index].type = e.target.value;
                        setSurgeries(newSurgeries);
                      }}
                    />
                    <Input
                      type="date"
                      value={surgery.date}
                      onChange={(e) => {
                        const newSurgeries = [...surgeries];
                        newSurgeries[index].date = e.target.value;
                        setSurgeries(newSurgeries);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setSurgeries(surgeries.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Notes (optional)"
                    value={surgery.notes}
                    onChange={(e) => {
                      const newSurgeries = [...surgeries];
                      newSurgeries[index].notes = e.target.value;
                      setSurgeries(newSurgeries);
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setSurgeries([...surgeries, { type: "", date: "", notes: "" }])}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Surgery
              </Button>
            </CardContent>
          </Card>

          {/* Pharmacy Information */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Preferred Pharmacy</CardTitle>
              <CardDescription>Where you'd like prescriptions sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="pharmacy_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pharmacy Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., CVS Pharmacy" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <GoogleAddressAutocomplete
                label="Pharmacy Address *"
                value={{
                  street: form.watch("pharmacy_address"),
                  city: form.watch("pharmacy_city"),
                  state: form.watch("pharmacy_state"),
                  zip: form.watch("pharmacy_zip"),
                  status: "unverified",
                  source: "user_input",
                }}
                onChange={handlePharmacyAddressChange}
                required
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="pharmacy_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pharmacy_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pharmacy_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pharmacy_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pharmacy Phone *</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Complete Intake'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
