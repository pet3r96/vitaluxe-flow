export interface PharmacyStaffMember {
  id: string;
  user_id: string;
  pharmacy_id: string;
  role_type: string;
  active: boolean;
  can_manage_orders: boolean;
  can_manage_shipping: boolean;
  can_view_api_config: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields from profiles
  profiles?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
}

export interface AddPharmacyStaffFormData {
  fullName: string;
  email: string;
  phone: string;
  roleType: string;
  canManageOrders: boolean;
  canManageShipping: boolean;
  canViewApiConfig: boolean;
}

export const PHARMACY_STAFF_ROLE_TYPES = [
  "Pharmacist",
  "Pharmacy Technician",
  "Pharmacy Manager",
  "Shipping Coordinator",
  "Customer Service",
  "Admin",
  "Other"
];
