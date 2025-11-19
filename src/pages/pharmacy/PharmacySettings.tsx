import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Building2, MapPin, Phone, Save } from "lucide-react";

export default function PharmacySettings() {
  const { effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    address_street: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    phone: ''
  });

  // Fetch pharmacy data
  const { data: pharmacy, isLoading } = useQuery({
    queryKey: ['pharmacy-settings', effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();

      if (error) throw error;
      
      // Set form data
      if (data) {
        setFormData({
          name: data.name || '',
          address_street: data.address_street || '',
          address_city: data.address_city || '',
          address_state: data.address_state || '',
          address_zip: data.address_zip || '',
          phone: data.phone || ''
        });
      }
      
      return data;
    },
    enabled: !!effectiveUserId
  });

  // Update pharmacy mutation
  const updatePharmacy = useMutation({
    mutationFn: async (updates: typeof formData) => {
      if (!pharmacy?.id) throw new Error('No pharmacy found');
      
      // Build formatted address
      const address_formatted = `${updates.address_street}, ${updates.address_city}, ${updates.address_state} ${updates.address_zip}`;
      
      const { error } = await supabase
        .from('pharmacies')
        .update({
          ...updates,
          address_formatted
        })
        .eq('id', pharmacy.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-settings'] });
      toast.success('Settings updated successfully');
      logger.info('[PharmacySettings] Updated pharmacy settings');
    },
    onError: (error: any) => {
      logger.error('[PharmacySettings] Failed to update', error);
      toast.error('Failed to update settings', {
        description: error.message
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.address_street || !formData.address_city || !formData.address_state || !formData.address_zip) {
      toast.error('Address fields are required', {
        description: 'Please provide complete shipping address for order fulfillment'
      });
      return;
    }
    
    updatePharmacy.mutate(formData);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pharmacy Settings</h1>
        <p className="text-muted-foreground">Manage your pharmacy information and shipping address</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Pharmacy Information
            </CardTitle>
            <CardDescription>
              Basic details about your pharmacy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Pharmacy Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Pharmacy Name"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Shipping Address
            </CardTitle>
            <CardDescription>
              This address will be used for order fulfillment and shipping
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address_street">Street Address *</Label>
              <Input
                id="address_street"
                value={formData.address_street}
                onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                placeholder="123 Main Street"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="address_city">City *</Label>
                <Input
                  id="address_city"
                  value={formData.address_city}
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  placeholder="Miami"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state">State *</Label>
                <Input
                  id="address_state"
                  value={formData.address_state}
                  onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                  placeholder="FL"
                  maxLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_zip">ZIP Code *</Label>
                <Input
                  id="address_zip"
                  value={formData.address_zip}
                  onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                  placeholder="33101"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(305) 555-0100"
              />
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={updatePharmacy.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updatePharmacy.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
