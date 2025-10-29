import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form?: any;
}

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
}

export function FormBuilder({ open, onOpenChange, form }: FormBuilderProps) {
  const queryClient = useQueryClient();
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("intake");
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    if (form) {
      setFormName(form.form_name || "");
      setFormType(form.form_type || "intake");
      const schema = form.form_schema as any;
      if (schema?.sections?.[0]?.fields) {
        setFields(schema.sections[0].fields);
      }
    } else {
      setFormName("");
      setFormType("intake");
      setFields([]);
    }
  }, [form]);

  const addField = () => {
    setFields([
      ...fields,
      {
        id: `field-${Date.now()}`,
        type: "text",
        label: "New Field",
        required: false,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const formSchema = {
        version: "1.0",
        sections: [
          {
            id: "section-1",
            title: "Form Fields",
            fields: fields,
          },
        ],
      };

      if (form) {
        const { error } = await supabase
          .from("practice_forms")
          .update({
            form_name: formName,
            form_type: formType,
            form_schema: formSchema as any,
          })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("practice_forms")
          .insert([{
            form_name: formName,
            form_type: formType,
            form_schema: formSchema as any,
            practice_id: user.id,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-forms"] });
      toast.success(form ? "Form updated successfully" : "Form created successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to save form: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form ? "Edit Form" : "Create Form"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Form Name</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Patient Intake Form"
            />
          </div>

          <div>
            <Label>Form Type</Label>
            <Select value={formType} onValueChange={setFormType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intake">Intake</SelectItem>
                <SelectItem value="consent">Consent</SelectItem>
                <SelectItem value="medical_history">Medical History</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <Label>Form Fields</Label>
              <Button type="button" size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Field {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeField(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Field label"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) => updateField(index, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Text Area</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                          <SelectItem value="radio">Radio</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                      className="rounded"
                    />
                    <Label className="text-xs">Required</Label>
                  </div>
                </div>
              ))}

              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No fields added yet. Click "Add Field" to get started.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!formName || fields.length === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : form ? "Update Form" : "Create Form"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
